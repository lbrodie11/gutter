import { git } from "../git.js";
import { extractQuestionTargets } from "./discover.js";
import { sanitizeAuthorName, sanitizePath, sanitizeText } from "./sanitize.js";
export const FOLLOW_UP_SUBJECT_RE = /\b(fix(?:es|ed|up)?|forgot(?:ten)?|miss(?:ed|ing)?|follow[- ]?up|oops|amend|repair|patch|sync|companion)\b/i;
/**
 * Load the chronological first-parent commit stream with file status and rename tracking
 * (`git log --first-parent -m -M --name-status -z --use-mailmap`).
 */
export function loadFirstParentStream(root, branchHeadSha, oldestBaseSha) {
    const rangeArg = oldestBaseSha ? `${oldestBaseSha}..${branchHeadSha}` : branchHeadSha;
    const raw = git(root, [
        'log',
        '--first-parent',
        '-m',
        '-M',
        '--use-mailmap',
        '--name-status',
        '-z',
        '--format=%x1e%H%x1f%ct%x1f%cI%x1f%aN%x1f%aE%x1f%s%x00',
        rangeArg,
    ], { allowFail: true });
    const commits = [];
    const records = raw.split('\x1e');
    for (const rec of records) {
        if (!rec.trim())
            continue;
        const nulIdx = rec.indexOf('\0');
        if (nulIdx < 0)
            continue;
        const header = rec.slice(0, nulIdx).replace(/^\n+/, '');
        const body = rec.slice(nulIdx + 1);
        const [sha = '', ctStr = '', cIso = '', aName = '', aEmail = '', subject = ''] = header.split('\x1f');
        const cleanSha = sha.trim();
        if (!cleanSha)
            continue;
        const parts = body.split('\0').filter((p) => p.length > 0);
        const changes = [];
        const touchedPaths = new Set();
        for (let i = 0; i < parts.length;) {
            const token = parts[i++].trim();
            if (!token)
                continue;
            const code = token[0];
            if (code === 'R' || code === 'C') {
                const oldPath = parts[i++] ?? '';
                const newPath = parts[i++] ?? '';
                if (!newPath)
                    continue;
                const sim = Number(token.slice(1));
                if (code === 'R') {
                    changes.push({
                        status: 'R',
                        path: newPath,
                        oldPath,
                        similarity: Number.isFinite(sim) ? sim : 100,
                    });
                    if (oldPath)
                        touchedPaths.add(oldPath);
                    touchedPaths.add(newPath);
                }
                else {
                    changes.push({ status: 'A', path: newPath });
                    touchedPaths.add(newPath);
                }
            }
            else if (code === 'A' || code === 'M' || code === 'D') {
                const path = parts[i++] ?? '';
                if (!path)
                    continue;
                changes.push({ status: code, path });
                touchedPaths.add(path);
            }
        }
        const cleanName = aName.trim();
        const cleanEmail = aEmail.trim().toLowerCase();
        commits.push({
            sha: cleanSha,
            committerTimeSec: Number(ctStr),
            committerIso: cIso.trim(),
            authorName: cleanName,
            authorEmail: cleanEmail,
            authorKey: `${cleanName.toLowerCase()} <${cleanEmail}>`,
            subject: subject.trim(),
            changes,
            touchedPaths,
        });
    }
    // Reverse so stream is in chronological order (oldest -> newest).
    commits.reverse();
    return commits;
}
function isSameAuthorAsPr(prAuthors, commitAuthorKey, commitEmail) {
    if (prAuthors.includes(commitAuthorKey))
        return true;
    if (commitEmail) {
        const suffix = `<${commitEmail}>`;
        if (prAuthors.some((a) => a.endsWith(suffix)))
            return true;
    }
    return false;
}
export function intervalLowBucketOf(low) {
    if (low === null || !Number.isFinite(low))
        return 'none';
    if (low < 0.3)
        return '0-0.3';
    if (low < 0.5)
        return '0.3-0.5';
    return '0.5+';
}
export function scoreSingleTarget(targetFile, ctx) {
    const safeTargetFile = sanitizePath(targetFile);
    if (ctx.resolvedAtMergeTargets.has(targetFile)) {
        return {
            targetFile: safeTargetFile,
            status: 'resolvedAtMerge',
            commitSha: ctx.unit.mergeCommitSha,
            delayHours: 0,
            sameAuthor: true,
            authorName: ctx.unit.authorNames[0] ? sanitizeAuthorName(ctx.unit.authorNames[0]) : null,
            targetRenamed: false,
            renamedTo: null,
            raFollowUpSignals: [],
            matchesRaFollowUp: false,
            sharedWithOtherPrs: false,
        };
    }
    const windowSeconds = ctx.windowDays * 86400;
    const windowEndSec = ctx.unit.mergedAtSec + windowSeconds;
    let currentPath = targetFile;
    let targetRenamed = false;
    let renamedTo = null;
    let renameCommit = null;
    for (let idx = ctx.startIndexAfterMerge; idx < ctx.chronologicalStream.length; idx++) {
        const commit = ctx.chronologicalStream[idx];
        const inWindow = commit.committerTimeSec > ctx.unit.mergedAtSec && commit.committerTimeSec <= windowEndSec;
        let matchedModification = false;
        let matchedDeletion = false;
        for (const ch of commit.changes) {
            if (ch.status === 'R' && ch.oldPath === currentPath) {
                currentPath = ch.path;
                if (inWindow) {
                    targetRenamed = true;
                    renamedTo = sanitizePath(ch.path);
                    if (!renameCommit)
                        renameCommit = commit;
                    if ((ch.similarity ?? 100) < 100) {
                        matchedModification = true;
                    }
                }
                continue;
            }
            if (!inWindow)
                continue;
            if (ch.path === currentPath) {
                if (ch.status === 'D') {
                    matchedDeletion = true;
                    break;
                }
                if (ch.status === 'M' || ch.status === 'A') {
                    matchedModification = true;
                }
            }
            if (ctx.brokenImportPath && ch.path === ctx.brokenImportPath && (ch.status === 'A' || ch.status === 'M')) {
                matchedModification = true;
            }
        }
        if (!inWindow)
            continue;
        const delayHours = Number(Math.max(0, (commit.committerTimeSec - ctx.unit.mergedAtSec) / 3600).toFixed(2));
        const sameAuthor = isSameAuthorAsPr(ctx.unit.authors, commit.authorKey, commit.authorEmail);
        if (matchedDeletion) {
            return {
                targetFile: safeTargetFile,
                status: 'targetDeleted',
                commitSha: commit.sha,
                delayHours,
                sameAuthor,
                authorName: commit.authorName ? sanitizeAuthorName(commit.authorName) : null,
                targetRenamed,
                renamedTo,
                raFollowUpSignals: [],
                matchesRaFollowUp: false,
                sharedWithOtherPrs: false,
            };
        }
        if (matchedModification) {
            const signals = [];
            let touchesPrFile = false;
            for (const p of commit.touchedPaths) {
                if (ctx.prChangedFiles.has(p)) {
                    touchesPrFile = true;
                    break;
                }
            }
            if (touchesPrFile)
                signals.push('shared-file');
            if (sameAuthor && idx === ctx.startIndexAfterMerge)
                signals.push('immediate-same-author');
            if (FOLLOW_UP_SUBJECT_RE.test(commit.subject))
                signals.unshift('subject-cue');
            const matchesRaFollowUp = sameAuthor && (touchesPrFile || idx === ctx.startIndexAfterMerge || FOLLOW_UP_SUBJECT_RE.test(commit.subject));
            return {
                targetFile: safeTargetFile,
                status: 'followedUp',
                commitSha: commit.sha,
                delayHours,
                sameAuthor,
                authorName: commit.authorName ? sanitizeAuthorName(commit.authorName) : null,
                targetRenamed,
                renamedTo,
                raFollowUpSignals: signals,
                matchesRaFollowUp,
                sharedWithOtherPrs: false,
            };
        }
    }
    if (targetRenamed && renameCommit) {
        const delayHours = Number(Math.max(0, (renameCommit.committerTimeSec - ctx.unit.mergedAtSec) / 3600).toFixed(2));
        const sameAuthor = isSameAuthorAsPr(ctx.unit.authors, renameCommit.authorKey, renameCommit.authorEmail);
        return {
            targetFile: safeTargetFile,
            status: 'targetRenamed',
            commitSha: renameCommit.sha,
            delayHours,
            sameAuthor,
            authorName: renameCommit.authorName ? sanitizeAuthorName(renameCommit.authorName) : null,
            targetRenamed: true,
            renamedTo,
            raFollowUpSignals: [],
            matchesRaFollowUp: false,
            sharedWithOtherPrs: false,
        };
    }
    const isCensored = windowEndSec > ctx.newestCommitSec;
    return {
        targetFile: safeTargetFile,
        status: isCensored ? 'censored' : 'notFollowedUp',
        commitSha: null,
        delayHours: null,
        sameAuthor: null,
        authorName: null,
        targetRenamed: false,
        renamedTo: null,
        raFollowUpSignals: [],
        matchesRaFollowUp: false,
        sharedWithOtherPrs: false,
    };
}
/**
 * Aggregate target outcomes into a question-level outcome status.
 */
export function aggregateQuestionStatus(kind, targets) {
    if (kind === 'wide-surface' || targets.length === 0) {
        return 'unscorable';
    }
    if (targets.some((t) => t.status === 'followedUp'))
        return 'followedUp';
    if (targets.some((t) => t.status === 'notFollowedUp'))
        return 'notFollowedUp';
    if (targets.some((t) => t.status === 'targetRenamed'))
        return 'targetRenamed';
    if (targets.some((t) => t.status === 'targetDeleted'))
        return 'targetDeleted';
    if (targets.some((t) => t.status === 'resolvedAtMerge'))
        return 'resolvedAtMerge';
    if (targets.some((t) => t.status === 'censored'))
        return 'censored';
    return 'unscorable';
}
export function scoreBriefQuestions(brief, ctx) {
    const extracted = extractQuestionTargets(brief);
    const safeAuthors = ctx.unit.authorNames.map((n) => sanitizeAuthorName(n));
    return brief.checklist.map((item, idx) => {
        const info = extracted[idx];
        if (item.kind === 'wide-surface' || info.targetFiles.length === 0) {
            return {
                id: sanitizeText(item.id, 160),
                kind: item.kind,
                question: sanitizeText(item.question, 400),
                authorNames: safeAuthors,
                intervalLow: info.intervalLow,
                intervalLowBucket: intervalLowBucketOf(info.intervalLow),
                status: 'unscorable',
                targets: [],
                sameAuthorHit: false,
                matchesRaFollowUpHit: false,
            };
        }
        const brokenPath = item.kind === 'broken-import' ? item.id.replace(/^check:broken:/, '') : undefined;
        const targets = info.targetFiles.map((tf) => scoreSingleTarget(tf, {
            ...ctx,
            brokenImportPath: brokenPath,
        }));
        const status = aggregateQuestionStatus(item.kind, targets);
        const sameAuthorHit = targets.some((t) => t.status === 'followedUp' && t.sameAuthor === true);
        const matchesRaFollowUpHit = targets.some((t) => t.status === 'followedUp' && t.matchesRaFollowUp);
        return {
            id: sanitizeText(item.id, 160),
            kind: item.kind,
            question: sanitizeText(item.question, 400),
            authorNames: safeAuthors,
            intervalLow: info.intervalLow,
            intervalLowBucket: intervalLowBucketOf(info.intervalLow),
            status,
            targets,
            sameAuthorHit,
            matchesRaFollowUpHit,
        };
    });
}
/**
 * Mark `sharedWithOtherPrs = true` on any `followedUp` outcome whose `commitSha`
 * appears as a `followedUp` commit on 2 or more distinct PRs under the same policy.
 */
export function markSharedFollowUpCommits(questionsByPr) {
    const prsByCommit = new Map();
    for (const { prId, questions } of questionsByPr) {
        for (const q of questions) {
            for (const t of q.targets) {
                if (t.status === 'followedUp' && t.commitSha) {
                    let set = prsByCommit.get(t.commitSha);
                    if (!set) {
                        set = new Set();
                        prsByCommit.set(t.commitSha, set);
                    }
                    set.add(prId);
                }
            }
        }
    }
    let sharedOutcomesCount = 0;
    for (const { questions } of questionsByPr) {
        const countedFilesInPr = new Set();
        for (const q of questions) {
            for (const t of q.targets) {
                if (t.status === 'followedUp' && t.commitSha) {
                    const count = prsByCommit.get(t.commitSha)?.size ?? 0;
                    if (count > 1) {
                        t.sharedWithOtherPrs = true;
                        if (!countedFilesInPr.has(t.targetFile)) {
                            countedFilesInPr.add(t.targetFile);
                            sharedOutcomesCount++;
                        }
                    }
                }
            }
        }
    }
    return sharedOutcomesCount;
}
