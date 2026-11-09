import type { GutterBrief } from '../contract.ts';
import { git, isShallowRepo, repoRoot, resolveMergeBase, resolveSha } from '../git.ts';

export type DetectionKind = 'merge-commit' | 'squash-subject' | 'change-unit';
export type DetectionConfidence = 'high' | 'medium' | 'low';
export type SkippedBucket = 'octopus' | 'not-a-pr';

export interface DiscoveredCommit {
  /** First-parent commit SHA on the target branch (the merge commit or squash commit). */
  commitSha: string;
  parents: string[];
  committerTimeSec: number;
  mergedAt: string;
  authorName: string;
  authorEmail: string;
  subject: string;
  timestampAnomaly: boolean;
}

export interface DiscoveredChangeUnit {
  /** Unique identifier (`#123`, `#123@abc1234` on duplicate PR numbers, or `merge@abc1234` / `unit@abc1234`). */
  id: string;
  prNumber: number | null;
  /** First-parent commit SHA on the branch where this PR landed. */
  mergeCommitSha: string;
  /** Commit SHA of the PR head as Gutter would have seen it (`parent2` for merges, `commit` for squash). */
  head: string;
  /** Commit SHA of the comparison base (`merge-base(parent1, parent2)` for merges, `parent1` for squash). */
  base: string;
  /** First parent on the target branch. */
  firstParentSha: string;
  detection: DetectionKind;
  confidence: DetectionConfidence;
  mergedAt: string;
  mergedAtSec: number;
  subject: string;
  /** Distinct normalized author identities (`name <email>` after `.mailmap`) across the PR's commits. */
  authors: string[];
  /** Distinct author display names (no emails, for safe reporting). */
  authorNames: string[];
  timestampAnomaly: boolean;
  history: 'available' | 'unavailable';
}

export interface ClassifiedBuckets {
  mergeCommitHigh: number;
  mergeCommitMedium: number;
  squashMedium: number;
  octopus: number;
  notAPr: number;
  changeUnitLow: number;
}

export interface FunnelExclusions {
  octopus: number;
  notAPr: number;
  rootCommit: number;
  beforeSince: number;
  missingMergeBase: number;
  emptyDiff: number;
  beyondPrsLimit: number;
  historyUnavailable: number;
  noQuestions: number;
  unscorableOnly: number;
  resolvedAtMergeOnly: number;
  censored: number;
}

export interface BenchFunnel {
  discovered: number;
  classified: ClassifiedBuckets;
  eligible: number;
  evaluated: number;
  scored: number;
  changeUnitsDiscovered: number;
  changeUnitsEligible: number;
  changeUnitsEvaluated: number;
  changeUnitsScored: number;
  exclusions: FunnelExclusions;
}

export interface DiscoverOptions {
  cwd: string;
  branch?: string;
  prs?: number;
  since?: string;
  includeUnnumbered?: boolean;
}

export interface DiscoveryResult {
  root: string;
  branch: string;
  branchHeadSha: string;
  newestCommitSec: number;
  shallow: boolean;
  firstParentCommits: DiscoveredCommit[];
  /** Newest N eligible PRs (up to `prs`, default 200), newest first. */
  eligiblePrs: DiscoveredChangeUnit[];
  /** All eligible PRs before applying the `--prs` cap. */
  allEligiblePrs: DiscoveredChangeUnit[];
  /** Separate unnumbered change-units when `--include-unnumbered` is set (never pooled with PRs). */
  eligibleChangeUnits: DiscoveredChangeUnit[];
  funnel: BenchFunnel;
}

const MERGE_PR_RE = /^Merge pull request #(\d+)\b/;
const SQUASH_PR_RE = /\(#(\d+)\)\s*$/;

function parseSinceSeconds(since?: string): number | undefined {
  if (!since) return undefined;
  if (/^\d+$/.test(since.trim())) return Number(since.trim());
  const ms = Date.parse(since);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid --since date "${since}" (expected ISO date such as 2026-01-01)`);
  }
  return Math.floor(ms / 1000);
}

/** Collect distinct `.mailmap`-resolved author keys (`name <email>`) and author names for a PR. */
function collectPrAuthors(
  root: string,
  base: string,
  head: string,
  fallbackName: string,
  fallbackEmail: string,
): { keys: string[]; names: string[] } {
  const raw = git(root, ['log', '--use-mailmap', '--format=%aN%x1f%aE%x1e', `${base}..${head}`], { allowFail: true });
  const keys = new Set<string>();
  const names = new Set<string>();
  for (const rec of raw.split('\x1e')) {
    const trimmed = rec.trim();
    if (!trimmed) continue;
    const [name = '', email = ''] = trimmed.split('\x1f');
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName || cleanEmail) {
      keys.add(`${cleanName.toLowerCase()} <${cleanEmail}>`);
    }
    if (cleanName) names.add(cleanName);
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
export function discoverChangeUnits(opts: DiscoverOptions): DiscoveryResult {
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
  const commitTimeBySha = new Map<string, number>();
  const treeShaByCommit = new Map<string, string>();
  const parsedRows: {
    sha: string;
    treeSha: string;
    parents: string[];
    ct: number;
    cIso: string;
    authorName: string;
    authorEmail: string;
    subject: string;
  }[] = [];

  for (const rec of rawRecords) {
    const [
      sha = '',
      treeSha = '',
      parentsStr = '',
      ctStr = '',
      cIso = '',
      authorName = '',
      authorEmail = '',
      subject = '',
    ] = rec.split('\x1f');
    if (!sha) continue;
    const parents = parentsStr.trim().split(/\s+/).filter(Boolean);
    const ct = Number(ctStr);
    commitTimeBySha.set(sha, ct);
    treeShaByCommit.set(sha, treeSha);
    parsedRows.push({ sha, treeSha, parents, ct, cIso, authorName, authorEmail, subject });
  }

  const getCommitInfo = (sha: string): { ct: number; treeSha: string } | undefined => {
    const cachedCt = commitTimeBySha.get(sha);
    const cachedTree = treeShaByCommit.get(sha);
    if (cachedCt !== undefined && cachedTree !== undefined) {
      return { ct: cachedCt, treeSha: cachedTree };
    }
    const out = git(root, ['log', '-1', '--format=%ct%x1f%T', sha], { allowFail: true }).trim();
    if (!out) return undefined;
    const [ctRaw = '', tree = ''] = out.split('\x1f');
    const n = Number(ctRaw);
    if (Number.isFinite(n) && tree) {
      commitTimeBySha.set(sha, n);
      treeShaByCommit.set(sha, tree);
      return { ct: n, treeSha: tree };
    }
    return undefined;
  };

  const firstParentCommits: DiscoveredCommit[] = [];
  const classified: ClassifiedBuckets = {
    mergeCommitHigh: 0,
    mergeCommitMedium: 0,
    squashMedium: 0,
    octopus: 0,
    notAPr: 0,
    changeUnitLow: 0,
  };
  const exclusions: FunnelExclusions = {
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

  const candidatePrs: Omit<DiscoveredChangeUnit, 'id'>[] = [];
  const candidateChangeUnits: Omit<DiscoveredChangeUnit, 'id'>[] = [];

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
      const confidence: DetectionConfidence = prNumber !== null ? 'high' : 'medium';
      if (confidence === 'high') classified.mergeCommitHigh++;
      else classified.mergeCommitMedium++;

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
        if (shallow) exclusions.historyUnavailable++;
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
      const parent1 = row.parents[0]!;
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
          if (shallow) exclusions.historyUnavailable++;
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
  const prNumberCounts = new Map<number, number>();
  for (const c of candidatePrs) {
    if (c.prNumber !== null) {
      prNumberCounts.set(c.prNumber, (prNumberCounts.get(c.prNumber) ?? 0) + 1);
    }
  }

  const allEligiblePrs: DiscoveredChangeUnit[] = candidatePrs.map((c) => {
    let id: string;
    if (c.prNumber !== null) {
      const count = prNumberCounts.get(c.prNumber) ?? 1;
      id = count > 1 ? `#${c.prNumber}@${c.mergeCommitSha.slice(0, 7)}` : `#${c.prNumber}`;
    } else {
      id = `merge@${c.mergeCommitSha.slice(0, 7)}`;
    }
    return { id, ...c };
  });

  const allEligibleChangeUnits: DiscoveredChangeUnit[] = candidateChangeUnits.map((c) => ({
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

export interface QuestionTargetInfo {
  checklistId: string;
  kind: GutterBrief['checklist'][number]['kind'];
  /** Target files suggested by this question (empty for unscorable kinds like `wide-surface`). */
  targetFiles: string[];
  /** All files referenced by this question (both changed source files and suggested target files). */
  namedFiles: string[];
  /** Confidence interval low bound when applicable (`forgotten-companion`). */
  intervalLow: number | null;
}

/**
 * Extract the target files and all referenced files for each checklist item in a `GutterBrief`.
 */
export function extractQuestionTargets(brief: GutterBrief): QuestionTargetInfo[] {
  const depsById = new Map(brief.dependents.entries.map((d) => [d.id, d]));
  const forgottenById = new Map(brief.forgotten.items.map((f) => [f.id, f]));
  const familiesById = new Map(brief.forgotten.families.map((f) => [f.id, f]));
  const testsById = new Map(brief.tests.map((t) => [t.id, t]));

  return brief.checklist.map((item) => {
    const targetFiles = new Set<string>();
    const namedFiles = new Set<string>();
    let intervalLow: number | null = null;

    for (const evId of item.evidence) {
      if (item.kind === 'forgotten-companion') {
        const f = forgottenById.get(evId);
        if (f) {
          targetFiles.add(f.file);
          namedFiles.add(f.file);
          namedFiles.add(f.changed);
          intervalLow = f.interval.low;
        }
      } else if (item.kind === 'family-drift') {
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
      } else if (item.kind === 'untested-change') {
        const t = testsById.get(evId);
        if (t) {
          namedFiles.add(t.source);
          const untouched = t.candidates.filter((c) => !c.changed);
          for (const c of untouched.length ? untouched : t.candidates) {
            targetFiles.add(c.path);
            namedFiles.add(c.path);
          }
        }
      } else if (item.kind === 'broken-import') {
        const d = depsById.get(evId);
        if (d) {
          namedFiles.add(d.file);
          for (const imp of [...d.untouchedImporters, ...d.changedImporters]) {
            targetFiles.add(imp);
            namedFiles.add(imp);
          }
        }
      } else if (item.kind === 'wide-surface') {
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

export interface MergeResolutionCheck {
  mergeDiffers: boolean;
  mergeDifferingFiles: string[];
  /** Suggested target files that the merge commit itself changed relative to `head` (`resolvedAtMerge`). */
  resolvedAtMergeTargets: Set<string>;
}

/**
 * For merge commits, check whether the merge commit's tree (`mergeCommitSha`)
 * differs from `head` (`parent2`) on any file named by a question, and whether
 * the merge commit itself changed any suggested target file (`resolvedAtMerge`).
 */
export function analyzeMergeResolution(
  root: string,
  unit: Pick<DiscoveredChangeUnit, 'detection' | 'mergeCommitSha' | 'head' | 'firstParentSha'>,
  briefs: readonly GutterBrief[],
): MergeResolutionCheck {
  if (unit.detection !== 'merge-commit' || unit.mergeCommitSha === unit.head) {
    return {
      mergeDiffers: false,
      mergeDifferingFiles: [],
      resolvedAtMergeTargets: new Set(),
    };
  }

  const allNamed = new Set<string>();
  const allTargets = new Set<string>();
  for (const brief of briefs) {
    for (const q of extractQuestionTargets(brief)) {
      for (const f of q.namedFiles) allNamed.add(f);
      for (const t of q.targetFiles) allTargets.add(t);
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
  const resolvedAtMergeTargets = new Set<string>();
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
