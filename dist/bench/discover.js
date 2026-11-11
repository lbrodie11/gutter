import { git, isShallowRepo, repoRoot, resolveMergeBase, resolveSha } from "../git.js";
const MERGE_PR_RE = /^Merge pull request #(\d+)\b/;
const SQUASH_PR_RE = /\(#(\d+)\)\s*$/;
function parseSinceSeconds(since) {
    if (!since)
        return undefined;
    if (/^\d+$/.test(since.trim()))
        return Number(since.trim());
    const ms = Date.parse(since);
    if (Number.isNaN(ms)) {
        throw new Error(`Invalid --since date "${since}" (expected ISO date such as 2026-01-01)`);
    }
    return Math.floor(ms / 1000);
}
/** Collect distinct `.mailmap`-resolved author keys (`name <email>`) and author names for a PR. */
function collectPrAuthors(root, base, head, fallbackName, fallbackEmail) {
    const raw = git(root, ['log', '--use-mailmap', '--format=%aN%x1f%aE%x1e', `${base}..${head}`], { allowFail: true });
    const keys = new Set();
    const names = new Set();
    for (const rec of raw.split('\x1e')) {
        const trimmed = rec.trim();
        if (!trimmed)
            continue;
        const [name = '', email = ''] = trimmed.split('\x1f');
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        if (cleanName || cleanEmail) {
            keys.add(`${cleanName.toLowerCase()} <${cleanEmail}>`);
        }
        if (cleanName)
            names.add(cleanName);
    }
    if (keys.size === 0 && (fallbackName || fallbackEmail)) {
        keys.add(`${fallbackName.trim().toLowerCase()} <${fallbackEmail.trim().toLowerCase()}>`);
    }
    if (names.size === 0 && fallbackName.trim()) {
        names.add(fallbackName.trim());
    }
    return { keys: [...keys], names: [...names] };
}
/**
 * Walk `git rev-list --first-parent <branch>` offline and classify every commit
 * into one of the five preregistered buckets.
 */
export function discoverChangeUnits(opts) {
    const root = repoRoot(opts.cwd);
    const branch = opts.branch ?? 'HEAD';
    const branchHeadSha = resolveSha(root, branch);
    if (!branchHeadSha) {
        throw new Error(`Branch or ref "${branch}" not found in ${root}`);
    }
    const prsLimit = opts.prs ?? 200;
    const sinceSec = parseSinceSeconds(opts.since);
    const shallow = isShallowRepo(root);
    // Format: sha \x1f treeSha \x1f parents \x1f committerTimestamp \x1f committerIso \x1f mailmapAuthorName \x1f mailmapAuthorEmail \x1f subject \x1e
    const rawLog = git(root, [
        'log',
        '--first-parent',
        '--use-mailmap',
        '--format=%H%x1f%T%x1f%P%x1f%ct%x1f%cI%x1f%aN%x1f%aE%x1f%s%x1e',
        branchHeadSha,
    ]);
    const rawRecords = rawLog
        .split('\x1e')
        .map((r) => r.trim())
        .filter(Boolean);
    // First pass: map commit timestamps and tree SHAs so we can check parent timestamps and empty diffs in O(1).
    const commitTimeBySha = new Map();
    const treeShaByCommit = new Map();
    const parsedRows = [];
    for (const rec of rawRecords) {
        const [sha = '', treeSha = '', parentsStr = '', ctStr = '', cIso = '', authorName = '', authorEmail = '', subject = '',] = rec.split('\x1f');
        if (!sha)
            continue;
        const parents = parentsStr.trim().split(/\s+/).filter(Boolean);
        const ct = Number(ctStr);
        commitTimeBySha.set(sha, ct);
        treeShaByCommit.set(sha, treeSha);
        parsedRows.push({ sha, treeSha, parents, ct, cIso, authorName, authorEmail, subject });
    }
    const getCommitInfo = (sha) => {
        const cachedCt = commitTimeBySha.get(sha);
        const cachedTree = treeShaByCommit.get(sha);
        if (cachedCt !== undefined && cachedTree !== undefined) {
            return { ct: cachedCt, treeSha: cachedTree };
        }
        const out = git(root, ['log', '-1', '--format=%ct%x1f%T', sha], { allowFail: true }).trim();
        if (!out)
            return undefined;
        const [ctRaw = '', tree = ''] = out.split('\x1f');
        const n = Number(ctRaw);
        if (Number.isFinite(n) && tree) {
            commitTimeBySha.set(sha, n);
            treeShaByCommit.set(sha, tree);
            return { ct: n, treeSha: tree };
        }
        return undefined;
    };
    const firstParentCommits = [];
    const classified = {
        mergeCommitHigh: 0,
        mergeCommitMedium: 0,
        squashMedium: 0,
        octopus: 0,
        notAPr: 0,
        changeUnitLow: 0,
    };
    const exclusions = {
        octopus: 0,
        notAPr: 0,
        rootCommit: 0,
        beforeSince: 0,
        missingMergeBase: 0,
        emptyDiff: 0,
        beyondPrsLimit: 0,
        historyUnavailable: 0,
        noQuestions: 0,
        unscorableOnly: 0,
        resolvedAtMergeOnly: 0,
        censored: 0,
    };
    const candidatePrs = [];
    const candidateChangeUnits = [];
    for (const row of parsedRows) {
        let anomaly = false;
        for (const p of row.parents) {
            const pInfo = getCommitInfo(p);
            if (pInfo !== undefined && row.ct < pInfo.ct) {
                anomaly = true;
                break;
            }
        }
        firstParentCommits.push({
            commitSha: row.sha,
            parents: row.parents,
            committerTimeSec: row.ct,
            mergedAt: row.cIso,
            authorName: row.authorName,
            authorEmail: row.authorEmail,
            subject: row.subject,
            timestampAnomaly: anomaly,
        });
        if (row.parents.length > 2) {
            classified.octopus++;
            exclusions.octopus++;
            continue;
        }
        if (row.parents.length === 2) {
            const m = MERGE_PR_RE.exec(row.subject);
            const prNumber = m ? Number(m[1]) : null;
            const confidence = prNumber !== null ? 'high' : 'medium';
            if (confidence === 'high')
                classified.mergeCommitHigh++;
            else
                classified.mergeCommitMedium++;
            if (sinceSec !== undefined && row.ct < sinceSec) {
                exclusions.beforeSince++;
                continue;
            }
            const [parent1 = '', parent2 = ''] = row.parents;
            const headInfo = getCommitInfo(parent2);
            const baseResolved = headInfo ? resolveMergeBase(root, parent1, parent2) : undefined;
            const baseInfo = baseResolved ? getCommitInfo(baseResolved) : undefined;
            if (!headInfo || !baseResolved || !baseInfo) {
                exclusions.missingMergeBase++;
                if (shallow)
                    exclusions.historyUnavailable++;
                continue;
            }
            if (headInfo.ct < baseInfo.ct) {
                anomaly = true;
            }
            if (baseInfo.treeSha === headInfo.treeSha) {
                exclusions.emptyDiff++;
                continue;
            }
            const authors = collectPrAuthors(root, baseResolved, parent2, row.authorName, row.authorEmail);
            candidatePrs.push({
                prNumber,
                mergeCommitSha: row.sha,
                head: parent2,
                base: baseResolved,
                firstParentSha: parent1,
                detection: 'merge-commit',
                confidence,
                mergedAt: row.cIso,
                mergedAtSec: row.ct,
                subject: row.subject,
                authors: authors.keys,
                authorNames: authors.names,
                timestampAnomaly: anomaly,
                history: shallow ? 'unavailable' : 'available',
            });
            continue;
        }
        if (row.parents.length === 1) {
            const parent1 = row.parents[0];
            const m = SQUASH_PR_RE.exec(row.subject);
            const cleanName = row.authorName.trim();
            const cleanEmail = row.authorEmail.trim().toLowerCase();
            const singleAuthors = cleanName || cleanEmail ? [`${cleanName.toLowerCase()} <${cleanEmail}>`] : [];
            const singleNames = cleanName ? [cleanName] : [];
            if (m) {
                classified.squashMedium++;
                if (sinceSec !== undefined && row.ct < sinceSec) {
                    exclusions.beforeSince++;
                    continue;
                }
                const parentInfo = getCommitInfo(parent1);
                if (!parentInfo) {
                    exclusions.missingMergeBase++;
                    if (shallow)
                        exclusions.historyUnavailable++;
                    continue;
                }
                if (parentInfo.treeSha === row.treeSha) {
                    exclusions.emptyDiff++;
                    continue;
                }
                candidatePrs.push({
                    prNumber: Number(m[1]),
                    mergeCommitSha: row.sha,
                    head: row.sha,
                    base: parent1,
                    firstParentSha: parent1,
                    detection: 'squash-subject',
                    confidence: 'medium',
                    mergedAt: row.cIso,
                    mergedAtSec: row.ct,
                    subject: row.subject,
                    authors: singleAuthors,
                    authorNames: singleNames,
                    timestampAnomaly: anomaly,
                    history: shallow ? 'unavailable' : 'available',
                });
                continue;
            }
            // 1-parent commit without (#n):
            if (!opts.includeUnnumbered) {
                classified.notAPr++;
                exclusions.notAPr++;
                continue;
            }
            classified.changeUnitLow++;
            if (sinceSec !== undefined && row.ct < sinceSec) {
                continue;
            }
            const parentInfo = getCommitInfo(parent1);
            if (!parentInfo || parentInfo.treeSha === row.treeSha) {
                continue;
            }
            candidateChangeUnits.push({
                prNumber: null,
                mergeCommitSha: row.sha,
                head: row.sha,
                base: parent1,
                firstParentSha: parent1,
                detection: 'change-unit',
                confidence: 'low',
                mergedAt: row.cIso,
                mergedAtSec: row.ct,
                subject: row.subject,
                authors: singleAuthors,
                authorNames: singleNames,
                timestampAnomaly: anomaly,
                history: shallow ? 'unavailable' : 'available',
            });
            continue;
        }
        // Root commit (0 parents): cannot form a base..head PR change unit.
        classified.notAPr++;
        exclusions.notAPr++;
        exclusions.rootCommit++;
    }
    // Assign deterministic, collision-free IDs (so cherry-picks carrying (#n) stay distinct).
    const prNumberCounts = new Map();
    for (const c of candidatePrs) {
        if (c.prNumber !== null) {
            prNumberCounts.set(c.prNumber, (prNumberCounts.get(c.prNumber) ?? 0) + 1);
        }
    }
    const allEligiblePrs = candidatePrs.map((c) => {
        let id;
        if (c.prNumber !== null) {
            const count = prNumberCounts.get(c.prNumber) ?? 1;
            id = count > 1 ? `#${c.prNumber}@${c.mergeCommitSha.slice(0, 7)}` : `#${c.prNumber}`;
        }
        else {
            id = `merge@${c.mergeCommitSha.slice(0, 7)}`;
        }
        return { id, ...c };
    });
    const allEligibleChangeUnits = candidateChangeUnits.map((c) => ({
        id: `unit@${c.mergeCommitSha.slice(0, 7)}`,
        ...c,
    }));
    const eligiblePrs = allEligiblePrs.slice(0, prsLimit);
    if (allEligiblePrs.length > prsLimit) {
        exclusions.beyondPrsLimit = allEligiblePrs.length - prsLimit;
    }
    const eligibleChangeUnits = allEligibleChangeUnits.slice(0, prsLimit);
    const newestCommitSec = firstParentCommits.reduce((max, c) => Math.max(max, c.committerTimeSec), 0);
    return {
        root,
        branch,
        branchHeadSha,
        newestCommitSec,
        shallow,
        firstParentCommits,
        eligiblePrs,
        allEligiblePrs,
        eligibleChangeUnits,
        funnel: {
            discovered: firstParentCommits.length,
            classified,
            eligible: allEligiblePrs.length,
            evaluated: 0,
            scored: 0,
            changeUnitsDiscovered: classified.changeUnitLow,
            changeUnitsEligible: allEligibleChangeUnits.length,
            changeUnitsEvaluated: 0,
            changeUnitsScored: 0,
            exclusions,
        },
    };
}
/**
 * Extract the target files and all referenced files for each checklist item in a `GutterBrief`.
 */
export function extractQuestionTargets(brief) {
    const depsById = new Map(brief.dependents.entries.map((d) => [d.id, d]));
    const forgottenById = new Map(brief.forgotten.items.map((f) => [f.id, f]));
    const familiesById = new Map(brief.forgotten.families.map((f) => [f.id, f]));
    const testsById = new Map(brief.tests.map((t) => [t.id, t]));
    return brief.checklist.map((item) => {
        const targetFiles = new Set();
        const namedFiles = new Set();
        let intervalLow = null;
        for (const evId of item.evidence) {
            if (item.kind === 'forgotten-companion') {
                const f = forgottenById.get(evId);
                if (f) {
                    targetFiles.add(f.file);
                    namedFiles.add(f.file);
                    namedFiles.add(f.changed);
                    intervalLow = f.interval.low;
                }
            }
            else if (item.kind === 'family-drift') {
                const fam = familiesById.get(evId);
                if (fam) {
                    for (const m of fam.untouchedMembers) {
                        targetFiles.add(m);
                        namedFiles.add(m);
                    }
                    for (const m of fam.changedMembers) {
                        namedFiles.add(m);
                    }
                }
            }
            else if (item.kind === 'untested-change') {
                const t = testsById.get(evId);
                if (t) {
                    namedFiles.add(t.source);
                    const untouched = t.candidates.filter((c) => !c.changed);
                    for (const c of untouched.length ? untouched : t.candidates) {
                        targetFiles.add(c.path);
                        namedFiles.add(c.path);
                    }
                }
            }
            else if (item.kind === 'broken-import') {
                const d = depsById.get(evId);
                if (d) {
                    namedFiles.add(d.file);
                    for (const imp of [...d.untouchedImporters, ...d.changedImporters]) {
                        targetFiles.add(imp);
                        namedFiles.add(imp);
                    }
                }
            }
            else if (item.kind === 'wide-surface') {
                const d = depsById.get(evId);
                if (d) {
                    namedFiles.add(d.file);
                    for (const imp of d.untouchedImporters) {
                        namedFiles.add(imp);
                    }
                }
            }
        }
        return {
            checklistId: item.id,
            kind: item.kind,
            targetFiles: [...targetFiles],
            namedFiles: [...namedFiles],
            intervalLow,
        };
    });
}
/**
 * For merge commits, check whether the merge commit's tree (`mergeCommitSha`)
 * differs from `head` (`parent2`) on any file named by a question, and whether
 * the merge commit itself changed any suggested target file (`resolvedAtMerge`).
 */
export function analyzeMergeResolution(root, unit, briefs) {
    if (unit.detection !== 'merge-commit' || unit.mergeCommitSha === unit.head) {
        return {
            mergeDiffers: false,
            mergeDifferingFiles: [],
            resolvedAtMergeTargets: new Set(),
        };
    }
    const allNamed = new Set();
    const allTargets = new Set();
    for (const brief of briefs) {
        for (const q of extractQuestionTargets(brief)) {
            for (const f of q.namedFiles)
                allNamed.add(f);
            for (const t of q.targetFiles)
                allTargets.add(t);
        }
    }
    if (allNamed.size === 0) {
        return {
            mergeDiffers: false,
            mergeDifferingFiles: [],
            resolvedAtMergeTargets: new Set(),
        };
    }
    // Files whose content in the merge result differs from the PR head (`parent2`).
    const diffFromHeadRaw = git(root, ['diff', '--name-only', '-z', unit.head, unit.mergeCommitSha], { allowFail: true });
    const diffFromHead = new Set(diffFromHeadRaw.split('\0').filter(Boolean));
    // Files that the merge commit changed relative to `parent1` (the target branch right before merge).
    const diffFromParent1Raw = git(root, ['diff', '--name-only', '-z', unit.firstParentSha, unit.mergeCommitSha], {
        allowFail: true,
    });
    const diffFromParent1 = new Set(diffFromParent1Raw.split('\0').filter(Boolean));
    const mergeDifferingFiles = [...allNamed].filter((f) => diffFromHead.has(f)).sort();
    const resolvedAtMergeTargets = new Set();
    for (const target of allTargets) {
        // If the merge commit changed a suggested target relative to `head` AND relative to `parent1`,
        // the merge commit itself edited/resolved that suggested file.
        if (diffFromHead.has(target) && diffFromParent1.has(target)) {
            resolvedAtMergeTargets.add(target);
        }
    }
    return {
        mergeDiffers: mergeDifferingFiles.length > 0,
        mergeDifferingFiles,
        resolvedAtMergeTargets,
    };
}
