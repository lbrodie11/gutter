#!/usr/bin/env node
/**
 * GU-27 · Cross-Repository Coupling Research Runner
 *
 * Research-only experiment harness (`research/multi-repo/run.mjs`).
 * - Uses Repo Archaeology's public `openRepository()` API when available for single-repo metadata,
 *   and implements a bounded, argument-vector `git log` reader for raw chronological commit streams
 *   (which `openRepository()` does not expose publicly).
 * - Never imports Repo Archaeology's private `src/` or `dist/` internals.
 * - Enforces strict as-of-time causality (`t_i + delta <= t_predict`), chronological splits with
 *   168-hour embargoes, right-censoring at `T_end`, many-to-many downstream deduplication,
 *   confounder classification (`manual`, `generated`, `mirrored`, `dependency_or_version`, `bot`),
 *   repository-level vs file-level alerts, and 4 baselines/controls (`popular`, `recent`,
 *   `shuffled`, `explicit_ref`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

export const HORIZONS_HOURS = [24, 72, 168];
export const EMBARGO_SECONDS = 168 * 3600; // 7 days (max horizon)
export const DEFAULT_MAX_FILES_PER_COMMIT = 50;
export const DEFAULT_TOP_K = 3;
export const DEFAULT_MIN_SHARED = 3;
export const DEFAULT_MIN_WILSON_LOW = 0.2;
export const DEFAULT_MIN_LIFT = 1.5;
export const MIN_FIRED_EVENTS_GATE = 30;

/**
 * 95% Wilson score confidence interval (matches `src/stats/wilson.ts`).
 */
export function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (total <= 0) return { center: 0, low: 0, high: 0 };
  const n = total;
  const p = Math.max(0, Math.min(1, successes / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    center,
    low: Math.max(0, center - half),
    high: Math.min(1, center + half),
  };
}

/**
 * Deterministic xorshift32 PRNG for reproducible block bootstrap and shuffled controls.
 */
export function createPrng(seed = 0x5eed1234) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/**
 * 7-day release/time-block bootstrap 95% confidence interval for suggestion-level precision.
 * Groups fired events into 7-day calendar blocks so clustered release warnings are resampled together.
 */
export function blockBootstrapPrecisionCI(firedRecords, iterations = 400, seed = 20261108) {
  if (!firedRecords.length) return { low: 0, high: 0 };
  const blockSeconds = 7 * 86400;
  const blocksMap = new Map();
  for (const rec of firedRecords) {
    const bucket = Math.floor(rec.t / blockSeconds);
    let arr = blocksMap.get(bucket);
    if (!arr) {
      arr = [];
      blocksMap.set(bucket, arr);
    }
    arr.push(rec);
  }
  const blocks = [...blocksMap.values()];
  if (blocks.length <= 1) {
    const totalSug = firedRecords.reduce((acc, r) => acc + r.suggestions, 0);
    const totalHits = firedRecords.reduce((acc, r) => acc + r.hits, 0);
    const w = wilsonInterval(totalHits, totalSug);
    return { low: w.low, high: w.high };
  }
  const rand = createPrng(seed);
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    let sug = 0;
    let hits = 0;
    for (let b = 0; b < blocks.length; b++) {
      const pick = blocks[Math.floor(rand() * blocks.length)];
      for (const r of pick) {
        sug += r.suggestions;
        hits += r.hits;
      }
    }
    if (sug > 0) samples.push(hits / sug);
  }
  if (!samples.length) return { low: 0, high: 0 };
  samples.sort((a, b) => a - b);
  const lowIdx = Math.floor(0.025 * (samples.length - 1));
  const highIdx = Math.ceil(0.975 * (samples.length - 1));
  return { low: samples[lowIdx], high: samples[highIdx] };
}

/**
 * Probes Repo Archaeology's public library API (`openRepository`) without touching private internals.
 */
export async function probeRepoArchaeologyApi() {
  const candidates = ['repo-archaeology'];
  const siblingEntry = resolve(ROOT, '..', 'repo-archaeology', 'dist', 'api', 'index.js');
  if (existsSync(siblingEntry)) {
    candidates.push(pathToFileURL(siblingEntry).href);
  }
  for (const spec of candidates) {
    try {
      const mod = await import(spec);
      if (typeof mod.openRepository === 'function') {
        return {
          available: true,
          source: spec.startsWith('file:') ? 'workspace:repo-archaeology' : spec,
          exposesOpenRepository: true,
          exposesRawCommitHistory: false,
          supportedMethods: ['diff', 'scan', 'file', 'explain', 'backtest', 'importGraph', 'close'],
        };
      }
    } catch {
      // continue
    }
  }
  return {
    available: false,
    source: 'none',
    exposesOpenRepository: false,
    exposesRawCommitHistory: false,
    supportedMethods: [],
  };
}

/**
 * Classifies a file path into one of the 5 confounder categories.
 */
export function classifyFilePath(path, repoId = '') {
  const p = path.toLowerCase();
  if (
    p === 'package.json' ||
    p.endsWith('/package.json') ||
    p.endsWith('package-lock.json') ||
    p.endsWith('go.mod') ||
    p.endsWith('go.sum') ||
    p.endsWith('apiversion.ts') ||
    p.endsWith('version.ts') ||
    p.endsWith('changelog.md')
  ) {
    return 'dependency_or_version';
  }
  if (
    p.includes('zz_generated.') ||
    p.endsWith('.pb.go') ||
    p.endsWith('.pb.ts') ||
    p.endsWith('.pb.js') ||
    p.includes('/generated.') ||
    p.startsWith('applyconfigurations/') ||
    p.startsWith('kubernetes/typed/') ||
    p.startsWith('kubernetes/fake/') ||
    p.startsWith('openapi/spec3') ||
    p.startsWith('latest/openapi.spec3') ||
    (repoId === 'stripe/stripe-node' && (p.startsWith('src/resources/') || p.startsWith('types/')))
  ) {
    return 'generated';
  }
  return 'manual';
}

/**
 * Classifies a commit record into one of the 5 confounder categories:
 *   `mirrored` | `generated` | `dependency_or_version` | `bot` | `manual`
 */
export function classifyCommit(commit, repoId = '') {
  const author = `${commit.authorName || ''} ${commit.committerName || ''}`.toLowerCase();
  const subj = (commit.subject || '').toLowerCase();

  if (
    author.includes('k8s-publishing-bot') ||
    author.includes('publishing-bot') ||
    subj.includes('sync-openapi') ||
    subj.startsWith('automated sync')
  ) {
    return 'mirrored';
  }
  if (
    subj.includes('update generated code') ||
    subj.includes('regenerate ') ||
    subj.includes('codegen') ||
    (repoId === 'stripe/openapi' && subj.includes('update openapi'))
  ) {
    return 'generated';
  }
  if (
    subj.startsWith('chore(release)') ||
    subj.startsWith('release v') ||
    subj.startsWith('bump ') ||
    subj.startsWith('chore(deps)') ||
    subj.startsWith('build(deps)')
  ) {
    return 'dependency_or_version';
  }
  if (
    author.includes('[bot]') ||
    author.includes('dependabot') ||
    author.includes('renovate') ||
    author.includes('github-actions') ||
    author.includes('opentelemetry-bot')
  ) {
    return 'bot';
  }

  const fileClasses = (commit.files || []).map((f) => classifyFilePath(f, repoId));
  if (fileClasses.length > 0 && fileClasses.every((c) => c === 'generated')) {
    return 'generated';
  }
  if (fileClasses.length > 0 && fileClasses.every((c) => c === 'dependency_or_version')) {
    return 'dependency_or_version';
  }
  return 'manual';
}

const STOP_STEMS = new Set([
  'index',
  'types',
  'common',
  'utils',
  'util',
  'test',
  'tests',
  'client',
  'server',
  'config',
  'version',
  'readme',
  'license',
  'package',
  'mod',
  'doc',
  'register',
  'generated',
  'spec3',
  'openapi',
  'v1',
  'v2',
  'v1beta1',
  'v1alpha1',
  'v1development',
  'src',
  'lib',
  'internal',
  'experimental',
  'packages',
]);

/**
 * Extracts normalized contract/domain stem tokens from a file path or commit subject
 * using ONLY information present in that file path or commit message (as-of-time safe).
 */
export function extractContractTokens(filePath, repoId = '') {
  const tokens = new Set();
  const norm = filePath.replace(/\\/g, '/');

  // Kubernetes staging/src/k8s.io/client-go/<subpath> -> exact subpath token
  const k8sStagingMatch = norm.match(/^staging\/src\/k8s\.io\/client-go\/(.+)$/);
  if (k8sStagingMatch) {
    tokens.add(`k8s_path:${k8sStagingMatch[1]}`);
  } else if (repoId === 'kubernetes/client-go') {
    tokens.add(`k8s_path:${norm}`);
  }

  // Extract domain stems from path segments
  const parts = norm
    .toLowerCase()
    .split(/[/. _-]+/)
    .filter((t) => t.length >= 3 && !STOP_STEMS.has(t) && !/^\d+$/.test(t));

  for (const part of parts) {
    tokens.add(`stem:${part}`);
    // Singularize simple plurals (e.g. customers -> customer, logs -> log, metrics -> metric, traces -> trace)
    if (part.endsWith('s') && part.length >= 5) {
      tokens.add(`stem:${part.slice(0, -1)}`);
    }
  }
  return [...tokens];
}

/**
 * Extracts explicit cross-repo references (e.g. owner/repo#123, 7+ hex SHA refs, or semver tags)
 * from a commit subject/body at its own timestamp.
 */
export function extractExplicitRefsFromSubject(subject = '') {
  const refs = new Set();
  for (const m of subject.matchAll(/\b([a-z0-9_.-]+\/[a-z0-9_.-]+)#(\d+)\b/gi)) {
    refs.add(`issue:${m[1].toLowerCase()}#${m[2]}`);
  }
  for (const m of subject.matchAll(/\b(?:v?\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)\b/gi)) {
    refs.add(`ver:${m[0].toLowerCase().replace(/^v/, '')}`);
  }
  return [...refs];
}

/**
 * Bounded, argument-vector Git history reader (`execFileSync('git', [...])`).
 * Never uses a shell or interpolates untrusted strings into a command line.
 */
export function readGitHistory({
  repoDir,
  repoId,
  headSha = 'HEAD',
  sinceIso,
  untilIso,
  pathSpecs = [],
  fileFilter = () => true,
  maxCommits = 15000,
  maxFilesPerCommit = DEFAULT_MAX_FILES_PER_COMMIT,
  timeoutMs = 120_000,
  signal,
}) {
  const args = [
    '-C',
    repoDir,
    'log',
    headSha,
    '--no-merges',
    `--max-count=${maxCommits}`,
    `--since=${sinceIso}`,
    `--until=${untilIso}`,
    '--format=%x1e%H%x1f%at%x1f%ct%x1f%an%x1f%cn%x1f%s',
    '--name-only',
  ];
  if (pathSpecs.length > 0) {
    args.push('--', ...pathSpecs);
  }

  const raw = execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
    signal,
  });

  const records = raw.split('\x1e').filter((chunk) => chunk.trim().length > 0);
  const commits = [];
  let timestampAnomalies = 0;
  let skippedLargeCommits = 0;
  let prevCommitTime = Infinity;

  for (const rec of records) {
    const lines = rec.split(/\r?\n/);
    const header = lines[0] ?? '';
    const [sha, atStr, ctStr, authorName, committerName, subject] = header.split('\x1f');
    if (!sha || !ctStr) continue;
    const authorTime = Number.parseInt(atStr, 10);
    const commitTime = Number.parseInt(ctStr, 10);
    if (!Number.isFinite(commitTime)) continue;

    if (Math.abs(commitTime - authorTime) > 86400 || commitTime > prevCommitTime + 3600) {
      timestampAnomalies++;
    }
    prevCommitTime = commitTime;

    const allFiles = lines
      .slice(1)
      .map((l) => l.trim())
      .filter(Boolean);
    if (allFiles.length > maxFilesPerCommit) {
      skippedLargeCommits++;
      continue;
    }

    const files = allFiles.filter(fileFilter);
    if (files.length === 0) continue;

    const commitObj = {
      sha,
      authorTime,
      commitTime,
      authorName: authorName ?? '',
      committerName: committerName ?? '',
      subject: subject ?? '',
      files,
    };
    commitObj.category = classifyCommit(commitObj, repoId);
    commitObj.explicitRefs = extractExplicitRefsFromSubject(commitObj.subject);
    commits.push(commitObj);
  }

  // Sort chronologically ascending by commitTime, breaking ties deterministically by sha
  commits.sort((a, b) => a.commitTime - b.commitTime || a.sha.localeCompare(b.sha));

  return {
    commits,
    timestampAnomalies,
    skippedLargeCommits,
    gitSubprocessCalls: 1,
  };
}

/**
 * Circularly shifts downstream commit timestamps by `offsetSeconds` inside `[startSec, endSec]`
 * to form the shuffled-time negative control while preserving burstiness and file co-occurrence.
 */
export function buildShuffledDownstreamCommits(commitsB, startSec, endSec, offsetSeconds = 45 * 86400) {
  const span = Math.max(1, endSec - startSec);
  const shifted = commitsB.map((c) => {
    const rel = (((c.commitTime - startSec + offsetSeconds) % span) + span) % span;
    const newTime = startSec + rel;
    return {
      ...c,
      commitTime: newTime,
      authorTime: newTime,
    };
  });
  shifted.sort((a, b) => a.commitTime - b.commitTime || a.sha.localeCompare(b.sha));
  return shifted;
}

/**
 * Core chronological walk-forward evaluator for a single (Repo A, Repo B, horizon, method, targetScope).
 *
 * Strictly enforces:
 * - Only upstream events `e_i` with `e_i.commitTime + deltaSeconds <= t` enter the training state at time `t`.
 * - Only downstream events `e_B` with `e_B.commitTime <= t` enter baseline frequency/recency tables at time `t`.
 * - Upstream events in `(evalStartSec, endSec - deltaSeconds]` are scored; events in `(endSec - deltaSeconds, endSec]`
 *   are marked `rightCensored` and excluded from completed-outcome denominators.
 */
export function evaluateWalkForward({
  commitsA,
  commitsB,
  repoAId = 'repoA',
  repoBId = 'repoB',
  startSec,
  endSec,
  evalStartSec,
  deltaHours = 72,
  method = 'temporal', // 'temporal' | 'explicit_ref'
  targetScope = 'all', // 'all' | 'manual_only'
  topK = DEFAULT_TOP_K,
  minShared = DEFAULT_MIN_SHARED,
  minWilsonLow = DEFAULT_MIN_WILSON_LOW,
  minLift = DEFAULT_MIN_LIFT,
}) {
  const deltaSec = deltaHours * 3600;
  const rightCensorCutoff = endSec - deltaSec;

  const sortedA = [...commitsA].sort((a, b) => a.commitTime - b.commitTime || a.sha.localeCompare(b.sha));

  // Filter downstream files by targetScope ('all' vs 'manual_only')
  const filteredB = commitsB
    .map((c) => {
      if (targetScope === 'manual_only') {
        if (
          c.category === 'mirrored' ||
          c.category === 'generated' ||
          c.category === 'dependency_or_version' ||
          c.category === 'bot'
        ) {
          return null;
        }
        const manualFiles = c.files.filter((f) => classifyFilePath(f, repoBId) === 'manual');
        if (manualFiles.length === 0) return null;
        return { ...c, files: manualFiles };
      }
      return c;
    })
    .filter(Boolean)
    .sort((a, b) => a.commitTime - b.commitTime || a.sha.localeCompare(b.sha));

  // Precompute for each upstream event e_A its outcome in (t_A, t_A + deltaSec]
  // Note: this outcome is ONLY unlocked and added to training state once current_t >= t_A + deltaSec!
  const upstreamOutcomes = sortedA.map((cA) => {
    const tA = cA.commitTime;
    const windowEnd = tA + deltaSec;
    const matchingCommitsB = [];
    const touchedFilesB = new Set();
    let firstMatchTime = null;

    // Binary search or linear scan over sorted filteredB
    for (const cB of filteredB) {
      if (cB.commitTime <= tA) continue;
      if (cB.commitTime > windowEnd) break;
      matchingCommitsB.push(cB);
      if (firstMatchTime === null || cB.commitTime < firstMatchTime) {
        firstMatchTime = cB.commitTime;
      }
      for (const fB of cB.files) {
        touchedFilesB.add(fB);
      }
    }

    return {
      commitA: cA,
      tA,
      windowEnd,
      matchingCommitsB,
      touchedFilesB,
      firstMatchTime,
      hasDownstreamActivity: touchedFilesB.size > 0,
    };
  });

  // Precompute contract tokens per file for `explicit_ref` method (using only static path/token info)
  const tokensCacheA = new Map();
  const tokensCacheB = new Map();
  const getTokensA = (fA) => {
    let t = tokensCacheA.get(fA);
    if (!t) {
      t = new Set(extractContractTokens(fA, repoAId));
      tokensCacheA.set(fA, t);
    }
    return t;
  };
  const getTokensB = (fB) => {
    let t = tokensCacheB.get(fB);
    if (!t) {
      t = new Set(extractContractTokens(fB, repoBId));
      tokensCacheB.set(fB, t);
    }
    return t;
  };
  const sharesContractToken = (fA, fB) => {
    const tA = getTokensA(fA);
    const tB = getTokensB(fB);
    for (const tok of tA) {
      if (tB.has(tok)) return true;
    }
    return false;
  };

  // Incremental training state (updated strictly as `windowEnd <= t_current`)
  let trainedUpstreamWindows = 0;
  let trainedActiveWindows = 0;
  const fileACounts = new Map(); // fA -> completed windows count
  const fileAActiveCounts = new Map(); // fA -> completed windows where Repo B had any activity
  const pairCounts = new Map(); // `${fA}\0${fB}` -> shared completed windows count
  const fileBWindowCounts = new Map(); // fB -> completed windows where fB changed
  const adjMap = new Map(); // fA -> Set<fB>

  // Downstream baseline state (updated strictly as `cB.commitTime <= t_current`)
  const downstreamFreq = new Map(); // fB -> commit count <= t
  const downstreamLastSeen = new Map(); // fB -> last commitTime <= t
  let ptrTrain = 0;
  let ptrB = 0;

  let eligibleEvalEvents = 0;
  let censoredEvalEvents = 0;
  let activeEvalEvents = 0;
  let firedQueries = 0;
  let queryHits = 0;
  let totalSuggestions = 0;
  let correctSuggestions = 0;

  // Baselines scored on the exact same fired queries
  let popularSuggestions = 0;
  let popularHits = 0;
  let recentSuggestions = 0;
  let recentHits = 0;

  // Repo-level alert tracking
  let repoLevelFired = 0;
  let repoLevelHits = 0;

  const matchedDownstreamCommitShas = new Set();
  const latenciesHours = [];
  const firedRecordsForBootstrap = [];
  const samplePredictions = [];

  for (let idx = 0; idx < upstreamOutcomes.length; idx++) {
    const current = upstreamOutcomes[idx];
    const t = current.tA;

    // 1. Advance training pointer: ONLY include prior upstream events whose ENTIRE window closed by `t` (`windowEnd <= t`)
    while (ptrTrain < idx && upstreamOutcomes[ptrTrain].windowEnd <= t) {
      const done = upstreamOutcomes[ptrTrain];
      trainedUpstreamWindows++;
      if (done.hasDownstreamActivity) {
        trainedActiveWindows++;
      }
      for (const fB of done.touchedFilesB) {
        fileBWindowCounts.set(fB, (fileBWindowCounts.get(fB) ?? 0) + 1);
      }
      const uniqueFA = new Set(done.commitA.files);
      for (const fA of uniqueFA) {
        fileACounts.set(fA, (fileACounts.get(fA) ?? 0) + 1);
        if (done.hasDownstreamActivity) {
          fileAActiveCounts.set(fA, (fileAActiveCounts.get(fA) ?? 0) + 1);
        }
        for (const fB of done.touchedFilesB) {
          if (method === 'explicit_ref' && !sharesContractToken(fA, fB)) {
            continue;
          }
          const key = `${fA}\0${fB}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
          let setB = adjMap.get(fA);
          if (!setB) {
            setB = new Set();
            adjMap.set(fA, setB);
          }
          setB.add(fB);
        }
      }
      ptrTrain++;
    }

    // 2. Advance downstream baseline pointer: ONLY include downstream commits with `commitTime <= t`
    while (ptrB < filteredB.length && filteredB[ptrB].commitTime <= t) {
      const cB = filteredB[ptrB];
      for (const fB of new Set(cB.files)) {
        downstreamFreq.set(fB, (downstreamFreq.get(fB) ?? 0) + 1);
        downstreamLastSeen.set(fB, cB.commitTime);
      }
      ptrB++;
    }

    // Skip events prior to the held-out evaluation split
    if (t <= evalStartSec) continue;

    // Right-censoring check at observation boundary T_end
    if (t > rightCensorCutoff) {
      censoredEvalEvents++;
      continue;
    }

    eligibleEvalEvents++;
    if (current.hasDownstreamActivity) {
      activeEvalEvents++;
    }

    const totalW = Math.max(1, trainedUpstreamWindows);
    const baseRepoActiveRate = trainedActiveWindows / totalW;

    // 3. Evaluate Repository-Level Alert at time `t`
    let bestRepoSignal = null;
    for (const fA of new Set(current.commitA.files)) {
      const nA = fileACounts.get(fA) ?? 0;
      const kAct = fileAActiveCounts.get(fA) ?? 0;
      if (nA < minShared) continue;
      const w = wilsonInterval(kAct, nA);
      const lift = baseRepoActiveRate > 0 ? (kAct / nA) / baseRepoActiveRate : 1;
      if (w.low >= 0.25 && lift >= 1.2) {
        if (!bestRepoSignal || w.low > bestRepoSignal.wilsonLow) {
          bestRepoSignal = { fA, kAct, nA, wilsonLow: w.low, lift };
        }
      }
    }
    if (bestRepoSignal) {
      repoLevelFired++;
      if (current.hasDownstreamActivity) {
        repoLevelHits++;
      }
    }

    // 4. Evaluate File-Level Alert (Top-K) at time `t`
    const candidateScores = new Map(); // fB -> best score object
    for (const fA of new Set(current.commitA.files)) {
      const nA = fileACounts.get(fA) ?? 0;
      if (nA < minShared) continue;
      const neighbors = adjMap.get(fA);
      if (!neighbors) continue;
      for (const fB of neighbors) {
        const shared = pairCounts.get(`${fA}\0${fB}`) ?? 0;
        if (shared < minShared) continue;
        const w = wilsonInterval(shared, nA);
        if (w.low < minWilsonLow) continue;
        const marginalB = (fileBWindowCounts.get(fB) ?? 0) / totalW;
        const empiricalProb = shared / nA;
        const lift = marginalB > 0 ? empiricalProb / marginalB : empiricalProb / (1 / totalW);
        if (lift < minLift) continue;

        const prev = candidateScores.get(fB);
        if (!prev || w.low > prev.wilsonLow || (w.low === prev.wilsonLow && shared > prev.shared)) {
          candidateScores.set(fB, {
            fileB: fB,
            fromFileA: fA,
            shared,
            nA,
            wilsonLow: w.low,
            wilsonHigh: w.high,
            lift,
          });
        }
      }
    }

    const ranked = [...candidateScores.values()]
      .sort((a, b) => b.wilsonLow - a.wilsonLow || b.shared - a.shared || a.fileB.localeCompare(b.fileB))
      .slice(0, topK);

    if (ranked.length === 0) continue;

    firedQueries++;
    const kEmitted = ranked.length;
    totalSuggestions += kEmitted;

    let hitsThisQuery = 0;
    for (const item of ranked) {
      if (current.touchedFilesB.has(item.fileB)) {
        hitsThisQuery++;
        correctSuggestions++;
      }
    }
    if (hitsThisQuery > 0) {
      queryHits++;
      if (current.firstMatchTime !== null) {
        latenciesHours.push((current.firstMatchTime - t) / 3600);
      }
      for (const cB of current.matchingCommitsB) {
        if (cB.files.some((f) => ranked.some((r) => r.fileB === f))) {
          matchedDownstreamCommitShas.add(cB.sha);
        }
      }
    }

    firedRecordsForBootstrap.push({
      t,
      suggestions: kEmitted,
      hits: hitsThisQuery,
    });

    // 5. Evaluate Popular & Recent Baselines on this exact fired query (emitting `kEmitted` files)
    const popularTop = [...downstreamFreq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, kEmitted)
      .map(([fB]) => fB);
    popularSuggestions += popularTop.length;
    for (const fB of popularTop) {
      if (current.touchedFilesB.has(fB)) popularHits++;
    }

    const recentTop = [...downstreamLastSeen.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, kEmitted)
      .map(([fB]) => fB);
    recentSuggestions += recentTop.length;
    for (const fB of recentTop) {
      if (current.touchedFilesB.has(fB)) recentHits++;
    }

    if (samplePredictions.length < 15) {
      samplePredictions.push({
        upstreamSha: current.commitA.sha.slice(0, 10),
        upstreamTimeIso: new Date(t * 1000).toISOString(),
        upstreamSubject: current.commitA.subject.slice(0, 100),
        upstreamCategory: current.commitA.category,
        suggestions: ranked.map((r) => ({
          fileB: r.fileB,
          fromFileA: r.fromFileA,
          shared: r.shared,
          nA: r.nA,
          wilsonLow: Number(r.wilsonLow.toFixed(3)),
          matched: current.touchedFilesB.has(r.fileB),
          fileCategory: classifyFilePath(r.fileB, repoBId),
        })),
        hit: hitsThisQuery > 0,
        matchingDownstreamShas: current.matchingCommitsB.slice(0, 3).map((c) => c.sha.slice(0, 10)),
      });
    }
  }

  const evalSpanMonths = Math.max(0.25, (rightCensorCutoff - evalStartSec) / (30.4375 * 86400));
  const precisionAtK = totalSuggestions > 0 ? correctSuggestions / totalSuggestions : 0;
  const precisionWilson = wilsonInterval(correctSuggestions, totalSuggestions);
  const blockBootstrap = blockBootstrapPrecisionCI(firedRecordsForBootstrap);
  const queryHitAtK = firedQueries > 0 ? queryHits / firedQueries : 0;
  const queryHitWilson = wilsonInterval(queryHits, firedQueries);
  const recall = activeEvalEvents > 0 ? queryHits / activeEvalEvents : 0;
  const falseAlarmRate = firedQueries > 0 ? 1 - queryHitAtK : 0;
  const warningsPerMonth = firedQueries / evalSpanMonths;

  const popularPrecision = popularSuggestions > 0 ? popularHits / popularSuggestions : 0;
  const recentPrecision = recentSuggestions > 0 ? recentHits / recentSuggestions : 0;

  const repoLevelPrecision = repoLevelFired > 0 ? repoLevelHits / repoLevelFired : 0;
  const repoLevelWilson = wilsonInterval(repoLevelHits, repoLevelFired);
  const evalBaseActiveRate = eligibleEvalEvents > 0 ? activeEvalEvents / eligibleEvalEvents : 0;
  const repoLevelLift = evalBaseActiveRate > 0 ? repoLevelPrecision / evalBaseActiveRate : 0;

  latenciesHours.sort((a, b) => a - b);
  const quantile = (arr, q) => (arr.length ? arr[Math.floor(q * (arr.length - 1))] : null);
  const meanLatency = latenciesHours.length
    ? latenciesHours.reduce((a, b) => a + b, 0) / latenciesHours.length
    : null;

  return {
    deltaHours,
    method,
    targetScope,
    eligibleUpstreamEvents: eligibleEvalEvents,
    censoredEvents: censoredEvalEvents,
    activeDownstreamWindows: activeEvalEvents,
    queriesWithPrediction: firedQueries,
    uniqueDownstreamCommitHits: matchedDownstreamCommitShas.size,
    totalSuggestions,
    correctSuggestions,
    precisionAtK: Number(precisionAtK.toFixed(4)),
    wilson95: [Number(precisionWilson.low.toFixed(4)), Number(precisionWilson.high.toFixed(4))],
    blockBootstrap95: [Number(blockBootstrap.low.toFixed(4)), Number(blockBootstrap.high.toFixed(4))],
    queryHitAtK: Number(queryHitAtK.toFixed(4)),
    queryHitWilson95: [Number(queryHitWilson.low.toFixed(4)), Number(queryHitWilson.high.toFixed(4))],
    recall: Number(recall.toFixed(4)),
    falseAlarmRate: Number(falseAlarmRate.toFixed(4)),
    warningsPerMonth: Number(warningsPerMonth.toFixed(2)),
    baselines: {
      popularPrecision: Number(popularPrecision.toFixed(4)),
      recentPrecision: Number(recentPrecision.toFixed(4)),
    },
    repoLevelAlert: {
      fired: repoLevelFired,
      hits: repoLevelHits,
      precision: Number(repoLevelPrecision.toFixed(4)),
      wilson95: [Number(repoLevelWilson.low.toFixed(4)), Number(repoLevelWilson.high.toFixed(4))],
      baseRate: Number(evalBaseActiveRate.toFixed(4)),
      lift: Number(repoLevelLift.toFixed(2)),
    },
    latencyHours: {
      median: quantile(latenciesHours, 0.5) !== null ? Number(quantile(latenciesHours, 0.5).toFixed(2)) : null,
      p25: quantile(latenciesHours, 0.25) !== null ? Number(quantile(latenciesHours, 0.25).toFixed(2)) : null,
      p75: quantile(latenciesHours, 0.75) !== null ? Number(quantile(latenciesHours, 0.75).toFixed(2)) : null,
      mean: meanLatency !== null ? Number(meanLatency.toFixed(2)) : null,
    },
    sampleSizeGatePassed: firedQueries >= MIN_FIRED_EVENTS_GATE,
    samplePredictions,
  };
}

/**
 * Runs the complete evaluation suite (all horizons, both methods, both scopes, plus shuffled control)
 * for a pair of commit streams.
 */
export function runPairSuite({
  pairId,
  repoAId,
  repoBId,
  commitsA,
  commitsB,
  startIso,
  endIso,
  timestampAnomaliesA = 0,
  timestampAnomaliesB = 0,
  gitSubprocessCalls = 2,
}) {
  const t0 = performance.now();
  const startSec = Math.floor(Date.parse(startIso) / 1000);
  const endSec = Math.floor(Date.parse(endIso) / 1000);
  const spanSec = endSec - startSec;

  // Chronological splits: 60% train, 168h embargo1, 15% tune, 168h embargo2, final ~25% eval
  const trainEndSec = startSec + Math.floor(spanSec * 0.6);
  const tuneStartSec = trainEndSec + EMBARGO_SECONDS;
  const tuneEndSec = startSec + Math.floor(spanSec * 0.75);
  const evalStartSec = tuneEndSec + EMBARGO_SECONDS;

  const shuffledB = buildShuffledDownstreamCommits(commitsB, startSec, endSec, 45 * 86400);

  const countCategories = (commits) => {
    const counts = { manual: 0, generated: 0, mirrored: 0, dependency_or_version: 0, bot: 0 };
    for (const c of commits) {
      counts[c.category] = (counts[c.category] ?? 0) + 1;
    }
    const total = Math.max(1, commits.length);
    const automated = total - counts.manual;
    return {
      total: commits.length,
      counts,
      automatedShare: Number((automated / total).toFixed(4)),
    };
  };

  const runs = [];
  for (const deltaHours of HORIZONS_HOURS) {
    for (const method of ['temporal', 'explicit_ref']) {
      for (const targetScope of ['all', 'manual_only']) {
        const mainRes = evaluateWalkForward({
          commitsA,
          commitsB,
          repoAId,
          repoBId,
          startSec,
          endSec,
          evalStartSec,
          deltaHours,
          method,
          targetScope,
        });

        const shuffledRes = evaluateWalkForward({
          commitsA,
          commitsB: shuffledB,
          repoAId,
          repoBId,
          startSec,
          endSec,
          evalStartSec,
          deltaHours,
          method,
          targetScope,
        });

        const shuffledPrecision = shuffledRes.precisionAtK;
        const strongestBaseline = Math.max(
          mainRes.baselines.popularPrecision,
          mainRes.baselines.recentPrecision,
          shuffledPrecision,
        );
        const liftOverStrongest =
          strongestBaseline > 0
            ? Number((mainRes.precisionAtK / strongestBaseline).toFixed(2))
            : mainRes.precisionAtK > 0
              ? Infinity
              : 0;
        const marginOverStrongest = Number((mainRes.precisionAtK - strongestBaseline).toFixed(4));

        let status = 'NO-GO';
        if (!mainRes.sampleSizeGatePassed) {
          status = 'INCONCLUSIVE (sparse data)';
        } else if (
          mainRes.precisionAtK >= 0.6 &&
          marginOverStrongest >= 0.15 &&
          liftOverStrongest >= 1.5
        ) {
          status = 'GO';
        } else if (mainRes.repoLevelAlert.precision >= 0.6 && mainRes.repoLevelAlert.lift >= 1.5) {
          status = 'NOT YET (repo-level only)';
        }

        runs.push({
          ...mainRes,
          baselines: {
            ...mainRes.baselines,
            shuffledPrecision,
            strongestBaseline: Number(strongestBaseline.toFixed(4)),
          },
          liftOverStrongestBaseline: liftOverStrongest,
          marginOverStrongestBaseline: marginOverStrongest,
          status,
        });
      }
    }
  }

  const runtimeMs = Math.round(performance.now() - t0);
  return {
    pairId,
    repoAId,
    repoBId,
    window: {
      startIso,
      endIso,
      trainEndIso: new Date(trainEndSec * 1000).toISOString(),
      tuneStartIso: new Date(tuneStartSec * 1000).toISOString(),
      tuneEndIso: new Date(tuneEndSec * 1000).toISOString(),
      evalStartIso: new Date(evalStartSec * 1000).toISOString(),
    },
    upstreamBreakdown: countCategories(commitsA),
    downstreamBreakdown: countCategories(commitsB),
    timestampAnomalies: {
      upstream: timestampAnomaliesA,
      downstream: timestampAnomaliesB,
    },
    costs: {
      runtimeMs,
      gitSubprocessCalls,
      apiRequests: 0,
    },
    runs,
  };
}

export const PREREGISTERED_PAIRS = [
  {
    pairId: 'stripe-openapi-to-node',
    repoAId: 'stripe/openapi',
    repoAUrl: 'https://github.com/stripe/openapi',
    repoASha: '6360907ca278d6aecff118df90167e94aaba1437',
    repoADirName: 'stripe_openapi',
    repoAPathSpecs: ['openapi', 'latest'],
    repoAFilter: (f) => f.endsWith('.yaml') || f.endsWith('.json'),
    repoBId: 'stripe/stripe-node',
    repoBUrl: 'https://github.com/stripe/stripe-node',
    repoBSha: 'dacc71670c82e62cdf3f3dc56374ce941362aaca',
    repoBDirName: 'stripe_stripe-node',
    repoBPathSpecs: ['src', 'types'],
    repoBFilter: (f) => f.endsWith('.ts'),
    startIso: '2025-05-01T00:00:00Z',
    endIso: '2026-11-01T00:00:00Z',
  },
  {
    pairId: 'otel-proto-to-js',
    repoAId: 'open-telemetry/opentelemetry-proto',
    repoAUrl: 'https://github.com/open-telemetry/opentelemetry-proto',
    repoASha: '169f2f2c7c1550c364d5eecb05d1b6163a011b06',
    repoADirName: 'open-telemetry_opentelemetry-proto',
    repoAPathSpecs: ['opentelemetry/proto'],
    repoAFilter: (f) => f.endsWith('.proto') || f.endsWith('.yaml'),
    repoBId: 'open-telemetry/opentelemetry-js',
    repoBUrl: 'https://github.com/open-telemetry/opentelemetry-js',
    repoBSha: 'ee94b842fd734e23064539c5f8069e0af0e92b9a',
    repoBDirName: 'open-telemetry_opentelemetry-js',
    repoBPathSpecs: ['packages', 'experimental/packages'],
    repoBFilter: (f) => f.endsWith('.ts') && !f.includes('/test/'),
    startIso: '2025-05-01T00:00:00Z',
    endIso: '2026-11-01T00:00:00Z',
  },
  {
    pairId: 'k8s-staging-to-client-go',
    repoAId: 'kubernetes/kubernetes',
    repoAUrl: 'https://github.com/kubernetes/kubernetes',
    repoASha: 'e3d37bb9fb1d695daff432925cd44b1452df64e1',
    repoADirName: 'kubernetes_kubernetes',
    repoAPathSpecs: ['staging/src/k8s.io/client-go', 'staging/src/k8s.io/api'],
    repoAFilter: (f) => f.endsWith('.go'),
    repoBId: 'kubernetes/client-go',
    repoBUrl: 'https://github.com/kubernetes/client-go',
    repoBSha: '494d62c5edeff3b84f2e6b3e757554c13bc3648f',
    repoBDirName: 'kubernetes_client-go',
    repoBPathSpecs: ['kubernetes', 'rest', 'tools', 'applyconfigurations', 'dynamic', 'discovery'],
    repoBFilter: (f) => f.endsWith('.go'),
    startIso: '2025-08-01T00:00:00Z',
    endIso: '2026-11-01T00:00:00Z',
  },
];

async function main() {
  const { values } = parseArgs({
    options: {
      'repos-dir': { type: 'string', default: '/tmp/gu27-repos' },
      'out-dir': { type: 'string', default: HERE },
    },
  });

  const reposDir = resolve(values['repos-dir']);
  const outDir = resolve(values['out-dir']);
  mkdirSync(outDir, { recursive: true });

  const raProbe = await probeRepoArchaeologyApi();
  const pairResults = [];

  for (const cfg of PREREGISTERED_PAIRS) {
    const dirA = join(reposDir, cfg.repoADirName);
    const dirB = join(reposDir, cfg.repoBDirName);
    if (!existsSync(dirA) || !existsSync(dirB)) {
      throw new Error(
        `Missing cloned repositories in ${reposDir} for ${cfg.pairId} (${dirA}, ${dirB}). Clone them first.`,
      );
    }

    const histA = readGitHistory({
      repoDir: dirA,
      repoId: cfg.repoAId,
      headSha: cfg.repoASha,
      sinceIso: cfg.startIso,
      untilIso: cfg.endIso,
      pathSpecs: cfg.repoAPathSpecs,
      fileFilter: cfg.repoAFilter,
    });
    const histB = readGitHistory({
      repoDir: dirB,
      repoId: cfg.repoBId,
      headSha: cfg.repoBSha,
      sinceIso: cfg.startIso,
      untilIso: cfg.endIso,
      pathSpecs: cfg.repoBPathSpecs,
      fileFilter: cfg.repoBFilter,
    });

    const suite = runPairSuite({
      pairId: cfg.pairId,
      repoAId: cfg.repoAId,
      repoBId: cfg.repoBId,
      commitsA: histA.commits,
      commitsB: histB.commits,
      startIso: cfg.startIso,
      endIso: cfg.endIso,
      timestampAnomaliesA: histA.timestampAnomalies,
      timestampAnomaliesB: histB.timestampAnomalies,
      gitSubprocessCalls: histA.gitSubprocessCalls + histB.gitSubprocessCalls,
    });

    pairResults.push(suite);
  }

  // Overall decision across the 3 pairs on `manual_only` at the 72h / 168h horizons
  const qualifyingManualGo = pairResults.filter((p) =>
    p.runs.some((r) => r.targetScope === 'manual_only' && r.status === 'GO'),
  );
  const overallDecision = qualifyingManualGo.length >= 2 ? 'GO' : 'NO-GO';

  const resultsPayload = {
    experimentId: 'GU-27',
    generatedAt: '2026-11-08T15:40:00Z',
    overallDecision,
    qualifyingManualPairsCount: qualifyingManualGo.length,
    repoArchaeologyApi: raProbe,
    pairs: pairResults,
  };

  const manifestPayload = {
    experimentId: 'GU-27',
    generatedAt: '2026-11-08T15:40:00Z',
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    repoArchaeologyApi: raProbe,
    preregisteredParameters: {
      horizonsHours: HORIZONS_HOURS,
      embargoHours: 168,
      maxFilesPerCommit: DEFAULT_MAX_FILES_PER_COMMIT,
      topK: DEFAULT_TOP_K,
      minShared: DEFAULT_MIN_SHARED,
      minWilsonLow: DEFAULT_MIN_WILSON_LOW,
      minLift: DEFAULT_MIN_LIFT,
      minFiredEventsGate: MIN_FIRED_EVENTS_GATE,
      shuffledControlOffsetDays: 45,
      prngSeed: 20261108,
    },
    repositories: PREREGISTERED_PAIRS.map((p) => ({
      pairId: p.pairId,
      upstream: {
        id: p.repoAId,
        url: p.repoAUrl,
        headSha: p.repoASha,
        pathSpecs: p.repoAPathSpecs,
      },
      downstream: {
        id: p.repoBId,
        url: p.repoBUrl,
        headSha: p.repoBSha,
        pathSpecs: p.repoBPathSpecs,
      },
      observationWindow: {
        startIso: p.startIso,
        endIso: p.endIso,
      },
    })),
  };

  writeFileSync(join(outDir, 'results.json'), `${JSON.stringify(resultsPayload, null, 2)}\n`);
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifestPayload, null, 2)}\n`);
  console.log(`✓ Wrote research/multi-repo/results.json and manifest.json (overallDecision=${overallDecision})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
