import { compileRaSkipPattern, type SafeRaRepoConfig } from '../config.ts';
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Minimal glob matcher matching `repo-archaeology`'s `PathMatcher` (`*`, `?`, `**`, `{a,b}`).
 */
export function globToRegExp(pattern: string): RegExp {
  let g = pattern.trim().replace(/\\/g, '/');
  if (g.startsWith('./')) g = g.slice(2);
  if (g.startsWith('/')) g = g.slice(1);
  else if (!g.slice(0, -1).includes('/')) g = `**/${g}`;
  if (g.endsWith('/')) g += '**';

  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i]!;
    if (c === '*') {
      if (g[i + 1] === '*') {
        const atSegmentStart = i === 0 || g[i - 1] === '/';
        const followedBySlash = g[i + 2] === '/';
        if (atSegmentStart && followedBySlash) {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const end = g.indexOf('}', i);
      if (end > i) {
        re += `(?:${g
          .slice(i + 1, end)
          .split(',')
          .map(escapeRegExp)
          .join('|')})`;
        i = end;
      } else {
        re += '\\{';
      }
    } else {
      re += escapeRegExp(c);
    }
  }
  return new RegExp(`^${re}$`);
}

export function isEligibleCandidateFile(path: string): boolean {
  if (!path) return false;
  if (IGNORED_PATH_RE.test(path)) return false;
  if (IGNORED_DIR_RE.test(path)) return false;
  if (IGNORED_EXT_RE.test(path)) return false;
  return true;
}

export function buildCandidateFilter(raSettings?: SafeRaRepoConfig): (path: string) => boolean {
  const useDefaultIgnores = raSettings?.useDefaultIgnores !== false;
  const customPatterns = (raSettings?.ignore ?? []).filter((p) => p.trim() !== '').map(globToRegExp);
  if (useDefaultIgnores && customPatterns.length === 0) {
    return isEligibleCandidateFile;
  }
  return (path: string): boolean => {
    if (!path) return false;
    if (useDefaultIgnores && !isEligibleCandidateFile(path)) return false;
    for (const rx of customPatterns) {
      if (rx.test(path)) return false;
    }
    return true;
  };
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
  subject: string;
  isAutomated: boolean;
  rawFiles: string[];
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
    const rawUniqueFiles = [
      ...new Set(
        body
          .split('\0')
          .map((f) => f.trim())
          .filter((f) => f.length > 0),
      ),
    ];
    const uniqueFiles = rawUniqueFiles.filter((f) => isEligibleCandidateFile(f));
    const isAutomated = isBotOrAgentStrings([aName, aEmail], [subject]);
    const isMergeOrSweep =
      parents.length > 1 || uniqueFiles.length === 0 || uniqueFiles.length > MAX_FILES_PER_HISTORY_COMMIT;

    commitsBySha.set(cleanSha, {
      sha: cleanSha,
      parents,
      committerTimeSec: ct,
      subject: subject.trim(),
      isAutomated,
      rawFiles: rawUniqueFiles,
      eligibleFiles: uniqueFiles,
      isMergeOrSweep,
    });
  }

  return { commitsBySha };
}

/**
 * Return the shortest parent-hop distance from `descendantSha` back to `ancestorSha`
 * (`0` when equal, `null` when `ancestorSha` is not in the ancestry of `descendantSha`).
 */
export function ancestryDistanceInHistoryGraph(
  root: string,
  graph: HistoryGraph,
  ancestorSha: string,
  descendantSha: string,
): number | null {
  if (ancestorSha === descendantSha) return 0;
  if (!graph.commitsBySha.has(ancestorSha) || !graph.commitsBySha.has(descendantSha)) {
    try {
      git(root, ['merge-base', '--is-ancestor', ancestorSha, descendantSha]);
      return 1;
    } catch {
      return null;
    }
  }
  const distBySha = new Map<string, number>([[descendantSha, 0]]);
  const queue: string[] = [descendantSha];
  let idx = 0;
  while (idx < queue.length) {
    const sha = queue[idx++]!;
    const dist = distBySha.get(sha)!;
    if (sha === ancestorSha) return dist;
    const node = graph.commitsBySha.get(sha);
    if (!node) continue;
    for (const p of node.parents) {
      if (p === ancestorSha) return dist + 1;
      if (!distBySha.has(p)) {
        distBySha.set(p, dist + 1);
        queue.push(p);
      }
    }
  }
  return null;
}

/**
 * Check whether `ancestorSha` is in the git ancestry of `descendantSha`
 * (using the in-memory `HistoryGraph` parent pointers when available).
 */
export function isAncestorInHistoryGraph(
  root: string,
  graph: HistoryGraph,
  ancestorSha: string,
  descendantSha: string,
): boolean {
  return ancestryDistanceInHistoryGraph(root, graph, ancestorSha, descendantSha) !== null;
}

function hasCustomRaHistorySettings(raSettings?: SafeRaRepoConfig): boolean {
  if (!raSettings) return false;
  return (
    raSettings.maxCommits !== undefined ||
    raSettings.maxFilesPerCommit !== undefined ||
    raSettings.since !== undefined ||
    (raSettings.ignore !== undefined && raSettings.ignore.length > 0) ||
    raSettings.useDefaultIgnores === false ||
    (raSettings.skipCommits !== undefined && raSettings.skipCommits.length > 0) ||
    (raSettings.skipCommitPrefixes !== undefined && raSettings.skipCommitPrefixes.length > 0)
  );
}

/**
 * Return usable non-merge, non-bot, non-sweep commits in the exact git ancestry of `baseSha`,
 * applying any snapshot `.repo-archaeology.json` filter settings (`ignore`, `useDefaultIgnores`,
 * `maxCommits`, `maxFilesPerCommit`, `since`, `skipCommits`, `skipCommitPrefixes`).
 */
export function getUsableAncestorsAtBase(
  graph: HistoryGraph,
  baseSha: string,
  maxCommits?: number,
  raSettings?: SafeRaRepoConfig,
): HistoryGraphCommit[] {
  const effectiveMaxCommits = maxCommits ?? raSettings?.maxCommits ?? MAX_HISTORY_COMMITS;
  const custom = hasCustomRaHistorySettings(raSettings);
  const candidateFilter = custom ? buildCandidateFilter(raSettings) : isEligibleCandidateFile;
  const maxFilesPerCommit = raSettings?.maxFilesPerCommit ?? MAX_FILES_PER_HISTORY_COMMIT;
  let skipFilter: RegExp | undefined;
  try {
    skipFilter = compileRaSkipPattern(raSettings?.skipCommits, raSettings?.skipCommitPrefixes);
  } catch {
    skipFilter = undefined;
  }
  const sinceSec =
    raSettings?.since && Number.isFinite(Date.parse(raSettings.since))
      ? Math.floor(Date.parse(raSettings.since) / 1000)
      : undefined;

  const visited = new Set<string>();
  const queue: string[] = [baseSha];
  visited.add(baseSha);

  const usable: HistoryGraphCommit[] = [];
  let headIdx = 0;

  while (headIdx < queue.length) {
    const sha = queue[headIdx++]!;
    const node = graph.commitsBySha.get(sha);
    if (!node) continue;

    if (!custom) {
      if (!node.isMergeOrSweep && !node.isAutomated) {
        usable.push(node);
      }
    } else if (node.parents.length <= 1 && !node.isAutomated) {
      const skippedBySubject = skipFilter ? skipFilter.test(node.subject) : false;
      const skippedBySince = sinceSec !== undefined && node.committerTimeSec < sinceSec;
      if (!skippedBySubject && !skippedBySince) {
        const filteredFiles = node.rawFiles.filter(candidateFilter);
        if (filteredFiles.length > 0 && filteredFiles.length <= maxFilesPerCommit) {
          usable.push({
            ...node,
            eligibleFiles: filteredFiles,
            isMergeOrSweep: false,
          });
        }
      }
    }

    for (const p of node.parents) {
      if (!visited.has(p)) {
        visited.add(p);
        queue.push(p);
      }
    }
  }

  usable.sort((a, b) => b.committerTimeSec - a.committerTimeSec || a.sha.localeCompare(b.sha));
  return usable.slice(0, effectiveMaxCommits);
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
  raSettings?: SafeRaRepoConfig,
): AsOfHistoryStats {
  const baseNode = graph.commitsBySha.get(baseSha);
  const baseTimeSec = baseNode?.committerTimeSec ?? 0;
  const recentCutoffSec = baseTimeSec - 30 * 86400;

  const ancestors = getUsableAncestorsAtBase(graph, baseSha, raSettings?.maxCommits, raSettings);
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
  raSettings?: SafeRaRepoConfig;
}): Record<BaselineName, BaselineProposalSet> {
  const { k, headFiles, prChangedFiles, stats, scoreCtx, raSettings } = opts;

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

  const isEligible = buildCandidateFilter(raSettings);
  // Eligible candidate pool at `head`: exists at `head`, not touched by PR, passes snapshot RA filters.
  const candidates = headFiles.filter((f) => !prChangedFiles.has(f) && isEligible(f));

  const touchedTopDirs = new Set<string>();
  const touchedModules = new Set<string>();
  for (const f of prChangedFiles) {
    if (isEligible(f)) {
      touchedTopDirs.add(topDirectoryKey(f));
      touchedModules.add(moduleOf(f));
    }
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
    const targets = files.map((f) => ({
      ...scoreSingleTarget(f, scoreCtx),
      // Keep author names strictly in per-question detail (Req 12).
      authorName: null,
    }));
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
  raSettings?: SafeRaRepoConfig;
}): string[] {
  const minShared = opts.minShared ?? opts.raSettings?.minShared ?? 3;
  const isEligible = buildCandidateFilter(opts.raSettings);
  const headFileSet = new Set(opts.headFiles);
  const missed: string[] = [];

  for (const [candidate, sharedCount] of opts.stats.coChangeCountsForTouched) {
    if (sharedCount < minShared) continue;
    if (opts.prChangedFiles.has(candidate)) continue;
    if (opts.askedTargetFiles.has(candidate)) continue;
    if (!headFileSet.has(candidate)) continue;
    if (!isEligible(candidate)) continue;

    const outcome = scoreSingleTarget(candidate, opts.scoreCtx);
    if (outcome.status === 'followedUp') {
      missed.push(candidate);
    }
  }

  return missed.sort();
}
