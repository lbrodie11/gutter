import type { GutterBrief } from '../contract.ts';
import { git } from '../git.ts';
import type { DiscoveredChangeUnit } from './discover.ts';
import { extractQuestionTargets } from './discover.ts';
import type {
  QuestionOutcomeRecord,
  RaFollowUpSignal,
  TargetOutcomeRecord,
  TargetOutcomeStatus,
} from './model.ts';

export const FOLLOW_UP_SUBJECT_RE =
  /\b(fix(?:es|ed|up)?|forgot(?:ten)?|miss(?:ed|ing)?|follow[- ]?up|oops|amend|repair|patch|sync|companion)\b/i;

export interface FirstParentFileChange {
  status: 'A' | 'M' | 'D' | 'R';
  path: string;
  oldPath?: string;
  similarity?: number;
}

export interface FirstParentStreamCommit {
  sha: string;
  committerTimeSec: number;
  committerIso: string;
  authorName: string;
  authorEmail: string;
  authorKey: string;
  subject: string;
  changes: FirstParentFileChange[];
  touchedPaths: Set<string>;
}

/**
 * Load the chronological first-parent commit stream with file status and rename tracking
 * (`git log --first-parent -m -M --name-status -z --use-mailmap`).
 */
export function loadFirstParentStream(
  root: string,
  branchHeadSha: string,
  oldestBaseSha?: string,
): FirstParentStreamCommit[] {
  const rangeArg = oldestBaseSha ? `${oldestBaseSha}..${branchHeadSha}` : branchHeadSha;
  const raw = git(
    root,
    [
      'log',
      '--first-parent',
      '-m',
      '-M',
      '--use-mailmap',
      '--name-status',
      '-z',
      '--format=%x1e%H%x1f%ct%x1f%cI%x1f%aN%x1f%aE%x1f%s%x00',
      rangeArg,
    ],
    { allowFail: true },
  );

  const commits: FirstParentStreamCommit[] = [];
  const records = raw.split('\x1e');

  for (const rec of records) {
    if (!rec.trim()) continue;
    const nulIdx = rec.indexOf('\0');
    if (nulIdx < 0) continue;
    const header = rec.slice(0, nulIdx).replace(/^\n+/, '');
    const body = rec.slice(nulIdx + 1);
    const [sha = '', ctStr = '', cIso = '', aName = '', aEmail = '', subject = ''] = header.split('\x1f');
    const cleanSha = sha.trim();
    if (!cleanSha) continue;

    const parts = body.split('\0').filter((p) => p.length > 0);
    const changes: FirstParentFileChange[] = [];
    const touchedPaths = new Set<string>();

    for (let i = 0; i < parts.length; ) {
      const token = parts[i++]!.trim();
      if (!token) continue;
      const code = token[0];
      if (code === 'R' || code === 'C') {
        const oldPath = parts[i++] ?? '';
        const newPath = parts[i++] ?? '';
        if (!newPath) continue;
        const sim = Number(token.slice(1));
        if (code === 'R') {
          changes.push({
            status: 'R',
            path: newPath,
            oldPath,
            similarity: Number.isFinite(sim) ? sim : 100,
          });
          if (oldPath) touchedPaths.add(oldPath);
          touchedPaths.add(newPath);
        } else {
          changes.push({ status: 'A', path: newPath });
          touchedPaths.add(newPath);
        }
      } else if (code === 'A' || code === 'M' || code === 'D') {
        const path = parts[i++] ?? '';
        if (!path) continue;
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

function isSameAuthorAsPr(prAuthors: readonly string[], commitAuthorKey: string, commitEmail: string): boolean {
  if (prAuthors.includes(commitAuthorKey)) return true;
  if (commitEmail) {
    const suffix = `<${commitEmail}>`;
    if (prAuthors.some((a) => a.endsWith(suffix))) return true;
  }
  return false;
}

export function intervalLowBucketOf(low: number | null): '0-0.3' | '0.3-0.5' | '0.5+' | 'none' {
  if (low === null || !Number.isFinite(low)) return 'none';
  if (low < 0.3) return '0-0.3';
  if (low < 0.5) return '0.3-0.5';
  return '0.5+';
}

export interface ScoreTargetContext {
  unit: DiscoveredChangeUnit;
  prChangedFiles: ReadonlySet<string>;
  resolvedAtMergeTargets: ReadonlySet<string>;
  chronologicalStream: readonly FirstParentStreamCommit[];
  startIndexAfterMerge: number;
  newestCommitSec: number;
  windowDays: number;
  /** Optional deleted/renamed path that, if re-added/restored in the window, resolves a broken-import question. */
  brokenImportPath?: string;
}

export function scoreSingleTarget(targetFile: string, ctx: ScoreTargetContext): TargetOutcomeRecord {
  if (ctx.resolvedAtMergeTargets.has(targetFile)) {
    return {
      targetFile,
      status: 'resolvedAtMerge',
      commitSha: ctx.unit.mergeCommitSha,
      delayHours: 0,
      sameAuthor: true,
      authorName: ctx.unit.authorNames[0] ?? null,
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
  let renamedTo: string | null = null;
  let renameCommit: FirstParentStreamCommit | null = null;

  for (let idx = ctx.startIndexAfterMerge; idx < ctx.chronologicalStream.length; idx++) {
    const commit = ctx.chronologicalStream[idx]!;
    if (commit.committerTimeSec > windowEndSec) {
      break;
    }

    let matchedModification = false;
    let matchedDeletion = false;

    for (const ch of commit.changes) {
      if (ch.status === 'R' && ch.oldPath === currentPath) {
        currentPath = ch.path;
        targetRenamed = true;
        renamedTo = ch.path;
        if (!renameCommit) renameCommit = commit;
        if ((ch.similarity ?? 100) < 100) {
          matchedModification = true;
        }
        continue;
      }
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

    const delayHours = Number(Math.max(0, (commit.committerTimeSec - ctx.unit.mergedAtSec) / 3600).toFixed(2));
    const sameAuthor = isSameAuthorAsPr(ctx.unit.authors, commit.authorKey, commit.authorEmail);

    if (matchedDeletion) {
      return {
        targetFile,
        status: 'targetDeleted',
        commitSha: commit.sha,
        delayHours,
        sameAuthor,
        authorName: commit.authorName || null,
        targetRenamed,
        renamedTo,
        raFollowUpSignals: [],
        matchesRaFollowUp: false,
        sharedWithOtherPrs: false,
      };
    }

    if (matchedModification) {
      const signals: RaFollowUpSignal[] = [];
      let touchesPrFile = false;
      for (const p of commit.touchedPaths) {
        if (ctx.prChangedFiles.has(p)) {
          touchesPrFile = true;
          break;
        }
      }
      if (touchesPrFile) signals.push('shared-file');
      if (sameAuthor && idx === ctx.startIndexAfterMerge) signals.push('immediate-same-author');
      if (FOLLOW_UP_SUBJECT_RE.test(commit.subject)) signals.unshift('subject-cue');

      const matchesRaFollowUp =
        sameAuthor && (touchesPrFile || idx === ctx.startIndexAfterMerge || FOLLOW_UP_SUBJECT_RE.test(commit.subject));

      return {
        targetFile,
        status: 'followedUp',
        commitSha: commit.sha,
        delayHours,
        sameAuthor,
        authorName: commit.authorName || null,
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
      targetFile,
      status: 'targetRenamed',
      commitSha: renameCommit.sha,
      delayHours,
      sameAuthor,
      authorName: renameCommit.authorName || null,
      targetRenamed: true,
      renamedTo,
      raFollowUpSignals: [],
      matchesRaFollowUp: false,
      sharedWithOtherPrs: false,
    };
  }

  const isCensored = windowEndSec > ctx.newestCommitSec;
  return {
    targetFile,
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
export function aggregateQuestionStatus(
  kind: GutterBrief['checklist'][number]['kind'],
  targets: readonly TargetOutcomeRecord[],
): TargetOutcomeStatus {
  if (kind === 'wide-surface' || targets.length === 0) {
    return 'unscorable';
  }
  if (targets.some((t) => t.status === 'followedUp')) return 'followedUp';
  if (targets.some((t) => t.status === 'notFollowedUp')) return 'notFollowedUp';
  if (targets.some((t) => t.status === 'targetRenamed')) return 'targetRenamed';
  if (targets.some((t) => t.status === 'targetDeleted')) return 'targetDeleted';
  if (targets.some((t) => t.status === 'resolvedAtMerge')) return 'resolvedAtMerge';
  if (targets.some((t) => t.status === 'censored')) return 'censored';
  return 'unscorable';
}

export function scoreBriefQuestions(
  brief: GutterBrief,
  ctx: Omit<ScoreTargetContext, 'brokenImportPath'>,
): QuestionOutcomeRecord[] {
  const extracted = extractQuestionTargets(brief);
  return brief.checklist.map((item, idx) => {
    const info = extracted[idx]!;
    if (item.kind === 'wide-surface' || info.targetFiles.length === 0) {
      return {
        id: item.id,
        kind: item.kind,
        question: item.question,
        intervalLow: info.intervalLow,
        intervalLowBucket: intervalLowBucketOf(info.intervalLow),
        status: 'unscorable',
        targets: [],
        sameAuthorHit: false,
        matchesRaFollowUpHit: false,
      };
    }

    const brokenPath = item.kind === 'broken-import' ? item.id.replace(/^check:broken:/, '') : undefined;
    const targets = info.targetFiles.map((tf) =>
      scoreSingleTarget(tf, {
        ...ctx,
        brokenImportPath: brokenPath,
      }),
    );
    const status = aggregateQuestionStatus(item.kind, targets);
    const sameAuthorHit = targets.some((t) => t.status === 'followedUp' && t.sameAuthor === true);
    const matchesRaFollowUpHit = targets.some((t) => t.status === 'followedUp' && t.matchesRaFollowUp);

    return {
      id: item.id,
      kind: item.kind,
      question: item.question,
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
export function markSharedFollowUpCommits(
  questionsByPr: readonly { prId: string; questions: QuestionOutcomeRecord[] }[],
): number {
  const prsByCommit = new Map<string, Set<string>>();
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
    for (const q of questions) {
      for (const t of q.targets) {
        if (t.status === 'followedUp' && t.commitSha) {
          const count = prsByCommit.get(t.commitSha)?.size ?? 0;
          if (count > 1) {
            t.sharedWithOtherPrs = true;
            sharedOutcomesCount++;
          }
        }
      }
    }
  }
  return sharedOutcomesCount;
}
