import { isAutomatedAuthor } from '../evidence/automation.ts';
import { moduleOf } from '../evidence/changes.ts';
import { git } from '../git.ts';
import type { BaselineName, BaselineProposalSet } from './model.ts';
import type { ScoreTargetContext } from './outcomes.ts';
import { scoreSingleTarget } from './outcomes.ts';

const IGNORED_PATH_RE =
  /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|uv\.lock|Pipfile\.lock|Gemfile\.lock|composer\.lock|CHANGELOG[^/]*|HISTORY\.md|\.repo-archaeology\.verdicts\.json)$/i;
const IGNORED_DIR_RE =
  /(?:^|\/)(?:dist|build|out|coverage|node_modules|vendor|\.next|\.nuxt|\.svelte-kit|__snapshots__)\//;
const IGNORED_EXT_RE = /\.(?:min\.js|min\.css|map|snap|tsbuildinfo)$|\.generated\./i;

const AGENT_SUBJECT_OR_AUTHOR_RE =
  /\b(?:copilot|claude|cursor|devin|codex|dependabot|renovate|github-actions| release-please|semantic-release|greenkeeper|snyk-bot)\b/i;

export function isEligibleCandidateFile(path: string): boolean {
  if (!path) return false;
  if (IGNORED_PATH_RE.test(path)) return false;
  if (IGNORED_DIR_RE.test(path)) return false;
  if (IGNORED_EXT_RE.test(path)) return false;
  return true;
}

export function isGeneratedOrLockfilePath(path: string): boolean {
  return !isEligibleCandidateFile(path);
}

export function isDependencyOrVersionPath(path: string): boolean {
  return (
    /(?:^|\/)(?:package\.json|jsr\.json|deno\.jsonc?|Cargo\.toml|pyproject\.toml|go\.mod|version\.ts|version\.js)$/i.test(
      path,
    ) || IGNORED_PATH_RE.test(path)
  );
}

export function isBotOrAgentStrings(authors: readonly string[], subjects: readonly string[]): boolean {
  for (const a of authors) {
    if (isAutomatedAuthor(a) || AGENT_SUBJECT_OR_AUTHOR_RE.test(a)) return true;
  }
  for (const s of subjects) {
    if (AGENT_SUBJECT_OR_AUTHOR_RE.test(s)) return true;
  }
  return false;
}

/** Top-level directory key for `popular-near` matching. */
export function topDirectoryKey(path: string): string {
  const firstSlash = path.indexOf('/');
  if (firstSlash < 0) return '(root)';
  return path.slice(0, firstSlash);
}

export interface HistoryGraphCommit {
  sha: string;
  parents: string[];
  committerTimeSec: number;
  isAutomated: boolean;
  eligibleFiles: string[];
  isMergeOrSweep: boolean;
}

export interface HistoryGraph {
  commitsBySha: Map<string, HistoryGraphCommit>;
}

const MAX_FILES_PER_HISTORY_COMMIT = 25;
const MAX_HISTORY_COMMITS = 5000;

/**
 * Load the commit graph once so per-PR baseline and co-change ancestor queries
 * run in memory strictly over each PR's `base` ancestry.
 */
export function loadHistoryGraph(root: string, branchHeadSha: string): HistoryGraph {
  const raw = git(
    root,
    [
      'log',
      '--use-mailmap',
      '--name-only',
      '-z',
      '--format=%x1e%H%x1f%P%x1f%ct%x1f%aN%x1f%aE%x1f%s%x00',
      branchHeadSha,
    ],
    { allowFail: true },
  );

  const commitsBySha = new Map<string, HistoryGraphCommit>();
  for (const rec of raw.split('\x1e')) {
    if (!rec.trim()) continue;
    const nulIdx = rec.indexOf('\0');
    if (nulIdx < 0) continue;
    const header = rec.slice(0, nulIdx).replace(/^\n+/, '');
    const body = rec.slice(nulIdx + 1);
    const [sha = '', parentsStr = '', ctStr = '', aName = '', aEmail = '', subject = ''] = header.split('\x1f');
    const cleanSha = sha.trim();
    if (!cleanSha) continue;

    const parents = parentsStr.trim().split(/\s+/).filter(Boolean);
    const ct = Number(ctStr);
    const files = body
      .split('\0')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && isEligibleCandidateFile(f));

    const uniqueFiles = [...new Set(files)];
    const isAutomated = isBotOrAgentStrings([aName, aEmail], [subject]);
    const isMergeOrSweep = parents.length > 1 || uniqueFiles.length === 0 || uniqueFiles.length > MAX_FILES_PER_HISTORY_COMMIT;

    commitsBySha.set(cleanSha, {
      sha: cleanSha,
      parents,
      committerTimeSec: ct,
      isAutomated,
      eligibleFiles: uniqueFiles,
      isMergeOrSweep,
    });
  }

  return { commitsBySha };
}

/**
 * Return usable non-merge, non-bot, non-sweep commits in the exact git ancestry of `baseSha`.
 */
export function getUsableAncestorsAtBase(
  graph: HistoryGraph,
  baseSha: string,
  maxCommits: number = MAX_HISTORY_COMMITS,
): HistoryGraphCommit[] {
  const visited = new Set<string>();
  const queue: string[] = [baseSha];
  visited.add(baseSha);

  const usable: HistoryGraphCommit[] = [];
  let headIdx = 0;

  while (headIdx < queue.length) {
    const sha = queue[headIdx++]!;
    const node = graph.commitsBySha.get(sha);
    if (!node) continue;

    if (!node.isMergeOrSweep && !node.isAutomated) {
      usable.push(node);
    }

    for (const p of node.parents) {
      if (!visited.has(p)) {
        visited.add(p);
        queue.push(p);
      }
    }
  }

  usable.sort((a, b) => b.committerTimeSec - a.committerTimeSec || a.sha.localeCompare(b.sha));
  return usable.slice(0, maxCommits);
}

export interface AsOfHistoryStats {
  baseTimeSec: number;
  changeCountByFile: Map<string, number>;
  lastChangedSecByFile: Map<string, number>;
  recent30dCountByFile: Map<string, number>;
  coChangeCountsForTouched: Map<string, number>;
}

/**
 * Compute per-file change frequencies, 30-day recency counts, and co-change counts
 * strictly from commits in the ancestry of `baseSha`.
 */
export function computeAsOfHistoryStats(
  graph: HistoryGraph,
  baseSha: string,
  prTouchedFiles: ReadonlySet<string>,
): AsOfHistoryStats {
  const baseNode = graph.commitsBySha.get(baseSha);
  const baseTimeSec = baseNode?.committerTimeSec ?? 0;
  const recentCutoffSec = baseTimeSec - 30 * 86400;

  const ancestors = getUsableAncestorsAtBase(graph, baseSha);
  const changeCountByFile = new Map<string, number>();
  const lastChangedSecByFile = new Map<string, number>();
  const recent30dCountByFile = new Map<string, number>();
  const coChangeCountsForTouched = new Map<string, number>();

  for (const commit of ancestors) {
    const isRecent = commit.committerTimeSec >= recentCutoffSec && commit.committerTimeSec <= baseTimeSec;
    let touchesPrFile = false;
    for (const f of commit.eligibleFiles) {
      if (prTouchedFiles.has(f)) {
        touchesPrFile = true;
        break;
      }
    }

    for (const f of commit.eligibleFiles) {
      changeCountByFile.set(f, (changeCountByFile.get(f) ?? 0) + 1);
      const prevLast = lastChangedSecByFile.get(f);
      if (prevLast === undefined || commit.committerTimeSec > prevLast) {
        lastChangedSecByFile.set(f, commit.committerTimeSec);
      }
      if (isRecent) {
        recent30dCountByFile.set(f, (recent30dCountByFile.get(f) ?? 0) + 1);
      }
      if (touchesPrFile && !prTouchedFiles.has(f)) {
        coChangeCountsForTouched.set(f, (coChangeCountsForTouched.get(f) ?? 0) + 1);
      }
    }
  }

  return {
    baseTimeSec,
    changeCountByFile,
    lastChangedSecByFile,
    recent30dCountByFile,
    coChangeCountsForTouched,
  };
}

/**
 * Propose and score `popular`, `popular-near`, and `recent` baselines for a PR
 * with `k` scorable suggested targets, using only `base` ancestry and `head` tree files.
 */
export function computeAndScoreBaselines(opts: {
  k: number;
  headFiles: readonly string[];
  prChangedFiles: ReadonlySet<string>;
  stats: AsOfHistoryStats;
  scoreCtx: Omit<ScoreTargetContext, 'brokenImportPath'>;
}): Record<BaselineName, BaselineProposalSet> {
  const { k, headFiles, prChangedFiles, stats, scoreCtx } = opts;

  if (k <= 0) {
    const empty = (baseline: BaselineName): BaselineProposalSet => ({
      baseline,
      kRequested: 0,
      proposedCount: 0,
      shortfall: 0,
      targets: [],
      anyFollowedUp: false,
    });
    return {
      popular: empty('popular'),
      'popular-near': empty('popular-near'),
      recent: empty('recent'),
    };
  }

  // Eligible candidate pool at `head`: exists at `head`, not touched by PR, passes filters.
  const candidates = headFiles.filter((f) => !prChangedFiles.has(f) && isEligibleCandidateFile(f));

  const touchedTopDirs = new Set<string>();
  const touchedModules = new Set<string>();
  for (const f of prChangedFiles) {
    touchedTopDirs.add(topDirectoryKey(f));
    touchedModules.add(moduleOf(f));
  }

  const compareByPopularity = (a: string, b: string): number => {
    const ca = stats.changeCountByFile.get(a) ?? 0;
    const cb = stats.changeCountByFile.get(b) ?? 0;
    if (cb !== ca) return cb - ca;
    const la = stats.lastChangedSecByFile.get(a) ?? 0;
    const lb = stats.lastChangedSecByFile.get(b) ?? 0;
    if (lb !== la) return lb - la;
    return a.localeCompare(b);
  };

  const compareByRecency = (a: string, b: string): number => {
    const ra = stats.recent30dCountByFile.get(a) ?? 0;
    const rb = stats.recent30dCountByFile.get(b) ?? 0;
    if (rb !== ra) return rb - ra;
    return compareByPopularity(a, b);
  };

  const popularCandidates = candidates
    .filter((f) => (stats.changeCountByFile.get(f) ?? 0) > 0)
    .sort(compareByPopularity)
    .slice(0, k);

  const popularNearCandidates = candidates
    .filter(
      (f) =>
        (stats.changeCountByFile.get(f) ?? 0) > 0 &&
        (touchedTopDirs.has(topDirectoryKey(f)) || touchedModules.has(moduleOf(f))),
    )
    .sort(compareByPopularity)
    .slice(0, k);

  const recentCandidates = candidates
    .filter((f) => (stats.recent30dCountByFile.get(f) ?? 0) > 0)
    .sort(compareByRecency)
    .slice(0, k);

  const buildSet = (baseline: BaselineName, files: string[]): BaselineProposalSet => {
    const targets = files.map((f) => scoreSingleTarget(f, scoreCtx));
    return {
      baseline,
      kRequested: k,
      proposedCount: targets.length,
      shortfall: Math.max(0, k - targets.length),
      targets,
      anyFollowedUp: targets.some((t) => t.status === 'followedUp'),
    };
  };

  return {
    popular: buildSet('popular', popularCandidates),
    'popular-near': buildSet('popular-near', popularNearCandidates),
    recent: buildSet('recent', recentCandidates),
  };
}

/**
 * Identify historical co-change partners (>= 3 shared commits in `base` ancestry)
 * that existed at `head`, were untouched by the PR, were NOT asked about by Gutter,
 * and changed in the follow-up window after the PR (`missedFollowUps`).
 */
export function computeMissedFollowUpFiles(opts: {
  headFiles: readonly string[];
  prChangedFiles: ReadonlySet<string>;
  askedTargetFiles: ReadonlySet<string>;
  stats: AsOfHistoryStats;
  scoreCtx: Omit<ScoreTargetContext, 'brokenImportPath'>;
  minShared?: number;
}): string[] {
  const minShared = opts.minShared ?? 3;
  const headFileSet = new Set(opts.headFiles);
  const missed: string[] = [];

  for (const [candidate, sharedCount] of opts.stats.coChangeCountsForTouched) {
    if (sharedCount < minShared) continue;
    if (opts.prChangedFiles.has(candidate)) continue;
    if (opts.askedTargetFiles.has(candidate)) continue;
    if (!headFileSet.has(candidate)) continue;
    if (!isEligibleCandidateFile(candidate)) continue;

    const outcome = scoreSingleTarget(candidate, opts.scoreCtx);
    if (outcome.status === 'followedUp') {
      missed.push(candidate);
    }
  }

  return missed.sort();
}
