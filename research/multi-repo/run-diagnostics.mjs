#!/usr/bin/env node
/**
 * GU-27 · Supplementary Diagnostics Collector (`research/multi-repo/run-diagnostics.mjs`)
 *
 * Preserves the original `results.json` from commit `1014af3` intact while computing
 * the missing diagnostic fields requested in peer review:
 * 1. Exact `shuffledRetrained` fired query counts, total suggestions, and hits (explaining
 *    why `shuffledPrecision` in `results.json` was computed on a small, non-matched set of fired events).
 * 2. Matched-event `shuffledMatched` precision (scoring the main model's exact fired queries and
 *    emitted suggestions against the +45d shifted downstream stream, plus matched `popular`/`recent` lifts).
 * 3. `kubernetes/client-go` mirror metadata diagnostics (`Kubernetes Publisher` committer prevalence,
 *    commits dropped by the 50-file cap, and `t_B <= t_A` author-vs-merge timestamp inversion).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildShuffledDownstreamCommits,
  classifyFilePath,
  DEFAULT_MAX_FILES_PER_COMMIT,
  EMBARGO_SECONDS,
  evaluateWalkForward,
  HORIZONS_HOURS,
  PREREGISTERED_PAIRS,
  readGitHistory,
} from './run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function computeMatchedShuffledWindowMetrics({
  commitsA,
  commitsB,
  shuffledB,
  repoAId,
  repoBId,
  startSec,
  endSec,
  evalStartSec,
  deltaHours,
  method,
  targetScope,
}) {
  // Filter shuffledB using the exact same targetScope rule as evaluateWalkForward
  const filteredShuffledB = shuffledB
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

  // Run evaluateWalkForward with an optional shifted outcome stream or score the fired predictions
  // To get all fired predictions (not just the first 15 in samplePredictions), we pass `maxSamples: Infinity`
  const fullMain = evaluateWalkForward({
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
    maxSamplePredictions: 10000,
  });

  const deltaSec = deltaHours * 3600;
  let matchedSuggestions = 0;
  let matchedHits = 0;

  for (const pred of fullMain.samplePredictions) {
    const tA = Math.floor(Date.parse(pred.upstreamTimeIso) / 1000);
    const windowEnd = tA + deltaSec;
    const touchedShuffled = new Set();
    for (const cB of filteredShuffledB) {
      if (cB.commitTime <= tA) continue;
      if (cB.commitTime > windowEnd) break;
      for (const fB of cB.files) touchedShuffled.add(fB);
    }
    for (const s of pred.suggestions) {
      matchedSuggestions++;
      if (touchedShuffled.has(s.fileB)) {
        matchedHits++;
      }
    }
  }

  const precisionAtK = matchedSuggestions > 0 ? Number((matchedHits / matchedSuggestions).toFixed(4)) : 0;
  return {
    queriesWithPrediction: fullMain.queriesWithPrediction,
    totalSuggestions: matchedSuggestions,
    correctSuggestions: matchedHits,
    precisionAtK,
  };
}

function analyzeK8sMirror(reposDir) {
  const k8sCfg = PREREGISTERED_PAIRS.find((p) => p.pairId === 'k8s-staging-to-client-go');
  const dirA = join(reposDir, k8sCfg.repoADirName);
  const dirB = join(reposDir, k8sCfg.repoBDirName);

  const rawA = execFileSync(
    'git',
    [
      '-C',
      dirA,
      'log',
      k8sCfg.repoASha,
      '--no-merges',
      `--since=${k8sCfg.startIso}`,
      `--until=${k8sCfg.endIso}`,
      '--format=%x1e%H%x1f%at%x1f%ct%x1f%an%x1f%cn%x1f%ce%x1f%s',
      '--name-only',
      '--',
      ...k8sCfg.repoAPathSpecs,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  const rawB = execFileSync(
    'git',
    [
      '-C',
      dirB,
      'log',
      k8sCfg.repoBSha,
      '--no-merges',
      `--since=${k8sCfg.startIso}`,
      `--until=${k8sCfg.endIso}`,
      '--format=%x1e%H%x1f%at%x1f%ct%x1f%an%x1f%cn%x1f%ce%x1f%s',
      '--name-only',
      '--',
      ...k8sCfg.repoBPathSpecs,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  const parseRaw = (raw, fileFilter) => {
    const recs = raw.split('\x1e').filter((s) => s.trim().length > 0);
    const parsed = [];
    for (const r of recs) {
      const lines = r.split(/\r?\n/);
      const [sha, atStr, ctStr, an, cn, ce, subj] = (lines[0] ?? '').split('\x1f');
      if (!sha) continue;
      const allFiles = lines
        .slice(1)
        .map((l) => l.trim())
        .filter(Boolean);
      const filteredFiles = allFiles.filter(fileFilter);
      parsed.push({
        sha,
        authorTime: Number.parseInt(atStr, 10),
        commitTime: Number.parseInt(ctStr, 10),
        authorName: an ?? '',
        committerName: cn ?? '',
        committerEmail: ce ?? '',
        subject: subj ?? '',
        totalFilesInCommit: allFiles.length,
        scopedFilesCount: filteredFiles.length,
      });
    }
    return parsed;
  };

  const allA = parseRaw(rawA, k8sCfg.repoAFilter);
  const allB = parseRaw(rawB, k8sCfg.repoBFilter);

  const bOver50 = allB.filter((c) => c.totalFilesInCommit > DEFAULT_MAX_FILES_PER_COMMIT);
  const bKept = allB.filter(
    (c) => c.totalFilesInCommit <= DEFAULT_MAX_FILES_PER_COMMIT && c.scopedFilesCount > 0,
  );
  const bPublisherAll = allB.filter((c) => c.committerName === 'Kubernetes Publisher');
  const bPublisherKept = bKept.filter((c) => c.committerName === 'Kubernetes Publisher');
  const bAuthorEqualsCommitTime = bKept.filter((c) => c.authorTime === c.commitTime);

  // Match commits between Repo A and Repo B by exact subject + authorTime to measure t_B - t_A
  const mapABySubjAuthor = new Map();
  for (const cA of allA) {
    mapABySubjAuthor.set(`${cA.authorTime}\0${cA.subject}`, cA);
  }

  let matchedMirrorPairs = 0;
  let pairsWhereTbLessOrEqualTa = 0;
  let pairsWhereTbStrictlyGreaterTa = 0;
  const lagSecondsSamples = [];

  for (const cB of allB) {
    const cA = mapABySubjAuthor.get(`${cB.authorTime}\0${cB.subject}`);
    if (cA) {
      matchedMirrorPairs++;
      const diffSec = cB.commitTime - cA.commitTime;
      lagSecondsSamples.push(diffSec);
      if (cB.commitTime <= cA.commitTime) {
        pairsWhereTbLessOrEqualTa++;
      } else {
        pairsWhereTbStrictlyGreaterTa++;
      }
    }
  }

  lagSecondsSamples.sort((a, b) => a - b);
  const maxFilesInB = allB.reduce((m, c) => Math.max(m, c.totalFilesInCommit), 0);

  return {
    downstreamTotalNonMergeCommits: allB.length,
    downstreamDroppedOver50Files: bOver50.length,
    downstreamMaxFilesInSingleCommit: maxFilesInB,
    downstreamKeptCommits: bKept.length,
    downstreamCommitterKubernetesPublisherAll: bPublisherAll.length,
    downstreamCommitterKubernetesPublisherKept: bPublisherKept.length,
    downstreamAuthorTimeEqualsCommitTimeKept: bAuthorEqualsCommitTime.length,
    matchedSubjectAndAuthorTimePairs: matchedMirrorPairs,
    pairsWithTbLessOrEqualTa: pairsWhereTbLessOrEqualTa,
    pairsWithTbStrictlyGreaterTa: pairsWhereTbStrictlyGreaterTa,
    medianTbMinusTaHours:
      lagSecondsSamples.length > 0
        ? Number((lagSecondsSamples[Math.floor(lagSecondsSamples.length / 2)] / 3600).toFixed(2))
        : null,
  };
}

function main() {
  const reposDir = resolve('/tmp/gu27-repos');
  const resultsPath = join(HERE, 'results.json');
  const results = JSON.parse(readFileSync(resultsPath, 'utf8'));

  const pairDiagnostics = {};

  for (const cfg of PREREGISTERED_PAIRS) {
    const dirA = join(reposDir, cfg.repoADirName);
    const dirB = join(reposDir, cfg.repoBDirName);
    if (!existsSync(dirA) || !existsSync(dirB)) {
      throw new Error(`Missing ${dirA} or ${dirB}`);
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

    // Preserve the exact commit categories from commit 1014af3 when reproducing results.json's shuffled runs
    for (const c of histB.commits) {
      if (
        c.category === 'mirrored' &&
        `${c.authorName} ${c.committerName}`.toLowerCase().includes('kubernetes publisher')
      ) {
        const allGen = c.files.length > 0 && c.files.every((f) => classifyFilePath(f, cfg.repoBId) === 'generated');
        const allDep =
          c.files.length > 0 && c.files.every((f) => classifyFilePath(f, cfg.repoBId) === 'dependency_or_version');
        c.category = allGen ? 'generated' : allDep ? 'dependency_or_version' : 'manual';
      }
    }

    const startSec = Math.floor(Date.parse(cfg.startIso) / 1000);
    const endSec = Math.floor(Date.parse(cfg.endIso) / 1000);
    const spanSec = endSec - startSec;
    const tuneEndSec = startSec + Math.floor(spanSec * 0.75);
    const evalStartSec = tuneEndSec + EMBARGO_SECONDS;

    const shuffledB = buildShuffledDownstreamCommits(histB.commits, startSec, endSec, 45 * 86400);
    const pairEntry = results.pairs.find((p) => p.pairId === cfg.pairId);
    const runDiagList = [];

    for (const deltaHours of HORIZONS_HOURS) {
      for (const method of ['temporal', 'explicit_ref']) {
        for (const targetScope of ['all', 'manual_only']) {
          const mainRun = pairEntry.runs.find(
            (r) =>
              r.deltaHours === deltaHours &&
              r.method === method &&
              r.targetScope === targetScope,
          );
          const shuffledRes = evaluateWalkForward({
            commitsA: histA.commits,
            commitsB: shuffledB,
            repoAId: cfg.repoAId,
            repoBId: cfg.repoBId,
            startSec,
            endSec,
            evalStartSec,
            deltaHours,
            method,
            targetScope,
          });
          const matchedShuffledWindow = computeMatchedShuffledWindowMetrics({
            commitsA: histA.commits,
            commitsB: histB.commits,
            shuffledB,
            repoAId: cfg.repoAId,
            repoBId: cfg.repoBId,
            startSec,
            endSec,
            evalStartSec,
            deltaHours,
            method,
            targetScope,
          });

          const strongestMatched = Math.max(
            mainRun.baselines.popularPrecision,
            mainRun.baselines.recentPrecision,
          );
          const liftOverMatched =
            strongestMatched > 0
              ? Number((mainRun.precisionAtK / strongestMatched).toFixed(2))
              : mainRun.precisionAtK > 0
                ? null
                : 0;
          const marginOverMatched = Number((mainRun.precisionAtK - strongestMatched).toFixed(4));

          runDiagList.push({
            deltaHours,
            method,
            targetScope,
            matchedBaselines: {
              popularPrecision: mainRun.baselines.popularPrecision,
              recentPrecision: mainRun.baselines.recentPrecision,
              shuffledMatchedWindowPrecision: matchedShuffledWindow.precisionAtK,
              shuffledMatchedWindowHits: matchedShuffledWindow.correctSuggestions,
              shuffledMatchedWindowSuggestions: matchedShuffledWindow.totalSuggestions,
              strongestMatchedBaseline: Number(strongestMatched.toFixed(4)),
              liftOverMatchedBaseline: liftOverMatched,
              marginOverMatchedBaseline: marginOverMatched,
            },
            shuffledRetrainedPlacebo: {
              queriesWithPrediction: shuffledRes.queriesWithPrediction,
              totalSuggestions: shuffledRes.totalSuggestions,
              correctSuggestions: shuffledRes.correctSuggestions,
              precisionAtK: shuffledRes.precisionAtK,
              sampleSizeGatePassed: shuffledRes.sampleSizeGatePassed,
            },
          });
        }
      }
    }

    pairDiagnostics[cfg.pairId] = {
      runs: runDiagList,
    };
  }

  const k8sMirrorAnalysis = analyzeK8sMirror(reposDir);

  const payload = {
    experimentId: 'GU-27',
    description:
      'Supplementary diagnostics for results.json: matched-baseline lifts, non-matched shuffled placebo fired/hit counts, and kubernetes/client-go mirror metadata analysis.',
    kubernetesMirrorDiagnostics: k8sMirrorAnalysis,
    pairs: pairDiagnostics,
  };

  writeFileSync(join(HERE, 'diagnostics.json'), `${JSON.stringify(payload, null, 2)}\n`);
  console.log('✓ Wrote research/multi-repo/diagnostics.json');
}

main();
