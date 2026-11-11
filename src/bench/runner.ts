import type { GutterBrief } from '../contract.ts';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { GutterConfig } from '../config.ts';
import { replayBriefWithMeta } from '../brief.ts';
import type { BaseGraphCache } from '../sources/archaeology-lib.ts';
import { browseUrlFromRemote, git, repoRoot } from '../git.ts';
import { GitTreeReader } from '../source/reader.ts';
import { trackRecordsByTarget, type CompanionTrackRecord, type RaBacktest } from '../sources/archaeology.ts';
import { loadRaLibrary } from '../sources/archaeology-lib.ts';
import { GUTTER_VERSION } from '../version.ts';
import {
  ancestryDistanceInHistoryGraph,
  computeAndScoreBaselines,
  computeAsOfHistoryStats,
  computeMissedFollowUpFiles,
  isAncestorInHistoryGraph,
  isBotOrAgentStrings,
  isDependencyOrVersionPath,
  isGeneratedOrLockfilePath,
  loadHistoryGraph,
} from './baselines.ts';
import type { DiscoveredChangeUnit } from './discover.ts';
import { analyzeMergeResolution, discoverChangeUnits } from './discover.ts';
import { buildGateSummary, computePolicyAggregates, isScoredStatus, summarizeStageTiming } from './metrics.ts';
import type {
  BenchPrRecord,
  BenchResultsModel,
  BenchSettings,
  PrConfounders,
  PrPolicyEvaluation,
  QuestionOutcomeRecord,
  RunIdentity,
} from './model.ts';
import {
  BENCH_SCHEMA_VERSION,
  BENCH_SCORING_VERSION,
  MAX_RECORDED_CHANGED_FILES,
  UNGATED_POLICY_LABEL,
} from './model.ts';
import { loadFirstParentStream, scoreBriefQuestions } from './outcomes.ts';
import { renderBenchHtml } from './report-html.ts';
import { renderBenchMarkdown } from './report-md.ts';
import { sanitizePath, sanitizeText } from './sanitize.ts';
import { assertValidBenchResults } from './validate.ts';
import { lintPage } from '../render/comic.ts';

export interface RunBenchOptions {
  cwd: string;
  outDir?: string;
  branch?: string;
  prs?: number;
  since?: string;
  windowDays?: number;
  calibrationEvery?: number;
  includeUnnumbered?: boolean;
  gateFullShare?: number;
  proxyMinLift?: number;
  config?: GutterConfig;
  raLib?: string;
  raCache?: boolean;
  resume?: boolean;
  now?: Date;
  /** Test hook: simulate a crash after writing N PR records to `bench.partial.jsonl`. */
  failAfterPrs?: number;
  /** Optional progress callback invoked after each PR is replayed. */
  onProgress?: (done: number, total: number, prId: string) => void;
}

interface PartialHeaderLine {
  type: 'header';
  runIdentity: RunIdentity;
}

interface CalibrationCheckpointState {
  unitIndex: number;
  baseSha: string;
  backtest: RaBacktest | null;
}

interface PartialRecordLine {
  type: 'pr';
  bucket: 'pr' | 'change-unit';
  record: BenchPrRecord;
  calibrationCheckpoint?: CalibrationCheckpointState;
  timingsMs: {
    sessionOpen: number;
    staticAnalysis: number;
    brief: number;
    scoring: number;
  };
}

export function writeFileAtomic(targetPath: string, content: string): void {
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmpPath, content, 'utf8');
  renameSync(tmpPath, targetPath);
}

export function sanitizeRepoName(root: string, remoteUrl: string | null): string {
  if (remoteUrl) {
    const m = /^https?:\/\/[^/]+\/(.+?)\/?$/.exec(remoteUrl);
    if (m?.[1]) return m[1];
  }
  return basename(root) || 'repository';
}

export function computeSettingsHash(settings: BenchSettings): string {
  const canonical = JSON.stringify({
    branch: settings.branch,
    prsLimit: settings.prsLimit,
    since: settings.since,
    windowDays: settings.windowDays,
    calibrationEvery: settings.calibrationEvery,
    includeUnnumbered: settings.includeUnnumbered,
    configOverrides: settings.configOverrides,
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function classifyPrConfounders(
  unit: DiscoveredChangeUnit,
  changedFilePaths: readonly string[],
  commitSubjects: readonly string[],
): PrConfounders {
  const botOrAgentOrigin = isBotOrAgentStrings(unit.authors.concat(unit.authorNames), [
    unit.subject,
    ...commitSubjects,
  ]);
  const generatedPaths = changedFilePaths.some((p) => isGeneratedOrLockfilePath(p));
  const dependencyOrVersionOnly =
    changedFilePaths.length > 0 && changedFilePaths.every((p) => isDependencyOrVersionPath(p));
  const largeSweep50Plus = changedFilePaths.length >= 50;

  return {
    botOrAgentOrigin,
    generatedPaths,
    dependencyOrVersionOnly,
    largeSweep50Plus,
  };
}

function scorableTargetFilesOf(questions: readonly QuestionOutcomeRecord[]): string[] {
  const out = new Set<string>();
  for (const q of questions) {
    if (q.kind === 'wide-surface') continue;
    for (const t of q.targets) {
      if (isScoredStatus(t.status)) {
        out.add(t.targetFile);
      }
    }
  }
  return [...out];
}

/** GU-30: the production brief's dependents coverage, for the bench record (additive). */
export function coverageFields(brief: GutterBrief): Pick<BenchPrRecord, 'coverage' | 'unresolvedByReason' | 'uncheckedLanguages'> {
  const lang = new Map(brief.changes.files.map((f) => [f.path, f.language ?? 'unknown']));
  return {
    coverage: brief.dependents.coverage,
    unresolvedByReason: { ...(brief.dependents.unresolved.byReason ?? {}) },
    uncheckedLanguages: [...new Set(brief.dependents.unchecked.map((p) => lang.get(p) ?? 'unknown'))].sort(),
  };
}

/** GU-28: copy RA-06 track records onto `forgotten-companion` question records (bench-internal). */
export function attachTrackRecords(
  questions: QuestionOutcomeRecord[],
  trackRecords: ReadonlyMap<string, CompanionTrackRecord>,
): QuestionOutcomeRecord[] {
  for (const q of questions) {
    if (q.kind !== 'forgotten-companion') continue;
    const file = q.targets[0]?.targetFile;
    const tr = file !== undefined ? trackRecords.get(file) : undefined;
    if (tr) q.trackRecord = { ...tr };
  }
  return questions;
}

function allSuggestedTargetFilesOf(questions: readonly QuestionOutcomeRecord[]): Set<string> {
  const out = new Set<string>();
  for (const q of questions) {
    for (const t of q.targets) {
      out.add(t.targetFile);
    }
  }
  return out;
}

function loadAndVerifyPartialJsonl(
  partialPath: string,
  expectedIdentity: RunIdentity,
): {
  prRecords: Map<string, PartialRecordLine>;
  changeUnitRecords: Map<string, PartialRecordLine>;
} {
  const raw = readFileSync(partialPath, 'utf8');
  const rawLines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) {
    throw new Error(`Cannot --resume from empty ${basename(partialPath)}`);
  }

  let header: PartialHeaderLine | undefined;
  try {
    header = JSON.parse(rawLines[0]!) as PartialHeaderLine;
  } catch {
    throw new Error(`Cannot --resume: corrupt header line in ${basename(partialPath)}`);
  }

  if (!header || header.type !== 'header' || !header.runIdentity) {
    throw new Error(`Cannot --resume: missing runIdentity header in ${basename(partialPath)}`);
  }

  const actual = header.runIdentity;
  const mismatches: string[] = [];
  if (actual.repo !== expectedIdentity.repo) mismatches.push(`repo (${actual.repo} !== ${expectedIdentity.repo})`);
  if (actual.branchHeadSha !== expectedIdentity.branchHeadSha) {
    mismatches.push(`branchHeadSha (${actual.branchHeadSha} !== ${expectedIdentity.branchHeadSha})`);
  }
  if (actual.settingsHash !== expectedIdentity.settingsHash) {
    mismatches.push(`settingsHash (${actual.settingsHash} !== ${expectedIdentity.settingsHash})`);
  }
  if (actual.gutterVersion !== expectedIdentity.gutterVersion) {
    mismatches.push(`gutterVersion (${actual.gutterVersion} !== ${expectedIdentity.gutterVersion})`);
  }
  if (actual.raVersion !== expectedIdentity.raVersion) {
    mismatches.push(`raVersion (${actual.raVersion} !== ${expectedIdentity.raVersion})`);
  }
  if (actual.scoringVersion !== expectedIdentity.scoringVersion) {
    mismatches.push(`scoringVersion (${actual.scoringVersion} !== ${expectedIdentity.scoringVersion})`);
  }
  if (actual.schemaVersion !== expectedIdentity.schemaVersion) {
    mismatches.push(`schemaVersion (${actual.schemaVersion} !== ${expectedIdentity.schemaVersion})`);
  }

  if (mismatches.length > 0) {
    throw new Error(`Refusing to --resume: run identity mismatch on ${mismatches.join(', ')}`);
  }

  const prRecords = new Map<string, PartialRecordLine>();
  const changeUnitRecords = new Map<string, PartialRecordLine>();

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    let parsed: PartialRecordLine;
    try {
      parsed = JSON.parse(line) as PartialRecordLine;
    } catch {
      if (i === rawLines.length - 1) {
        // Recover from a truncated last line by discarding it so it is re-evaluated.
        break;
      }
      throw new Error(`Corrupt intermediate JSONL record at line ${i + 1} of ${basename(partialPath)}`);
    }
    if (parsed && parsed.type === 'pr' && parsed.record?.id) {
      if (parsed.bucket === 'change-unit') {
        changeUnitRecords.set(parsed.record.id, parsed);
      } else {
        prRecords.set(parsed.record.id, parsed);
      }
    }
  }

  // Rewrite cleaned partial file without any truncated last line or duplicates.
  const cleanedLines: string[] = [JSON.stringify(header)];
  for (const entry of prRecords.values()) cleanedLines.push(JSON.stringify(entry));
  for (const entry of changeUnitRecords.values()) cleanedLines.push(JSON.stringify(entry));
  writeFileAtomic(partialPath, cleanedLines.join('\n') + '\n');

  return { prRecords, changeUnitRecords };
}

export async function runBench(opts: RunBenchOptions): Promise<BenchResultsModel> {
  const tWallStart = performance.now();
  const root = repoRoot(opts.cwd);

  // Offline dependency verification first (exits/throws code 2 before any work if missing or < 0.4.0).
  const raLib = await loadRaLibrary(opts.raLib);

  const settings: BenchSettings = {
    branch: opts.branch ?? 'HEAD',
    prsLimit: opts.prs ?? 200,
    since: opts.since ?? null,
    windowDays: opts.windowDays ?? 7,
    calibrationEvery: Math.max(1, Math.floor(opts.calibrationEvery ?? 1)),
    includeUnnumbered: Boolean(opts.includeUnnumbered),
    gateFullShare: opts.gateFullShare ?? Number((1 / 3).toFixed(4)),
    proxyMinLift: opts.proxyMinLift ?? 1.5,
    configOverrides: opts.config ?? {},
    raCacheEnabled: opts.raCache !== false,
  };

  const tDiscoverStart = performance.now();
  const discovery = discoverChangeUnits({
    cwd: root,
    branch: settings.branch,
    prs: settings.prsLimit,
    since: settings.since ?? undefined,
    includeUnnumbered: settings.includeUnnumbered,
  });
  const discoveryMs = performance.now() - tDiscoverStart;

  const rawRemote = git(root, ['remote', 'get-url', 'origin'], { allowFail: true });
  const remoteUrl = browseUrlFromRemote(rawRemote) ?? null;
  const repoName = sanitizeRepoName(root, remoteUrl);

  const runIdentity: RunIdentity = {
    repo: remoteUrl ?? repoName,
    branchHeadSha: discovery.branchHeadSha,
    settingsHash: computeSettingsHash(settings),
    gutterVersion: GUTTER_VERSION,
    raVersion: raLib.version,
    scoringVersion: BENCH_SCORING_VERSION,
    schemaVersion: BENCH_SCHEMA_VERSION,
  };

  const outDir = opts.outDir;
  const partialPath = outDir ? join(outDir, 'bench.partial.jsonl') : undefined;
  let resumedPrs = new Map<string, PartialRecordLine>();
  let resumedChangeUnits = new Map<string, PartialRecordLine>();

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
  }

  if (opts.resume && partialPath && existsSync(partialPath)) {
    const loaded = loadAndVerifyPartialJsonl(partialPath, runIdentity);
    resumedPrs = loaded.prRecords;
    resumedChangeUnits = loaded.changeUnitRecords;
  } else if (partialPath) {
    const header: PartialHeaderLine = { type: 'header', runIdentity };
    writeFileAtomic(partialPath, JSON.stringify(header) + '\n');
  }

  // Preload first-parent stream and history graph once for fast, ancestry-exact scoring & baselines.
  const tPrepStart = performance.now();
  const firstParentStream = discovery.shallow
    ? []
    : loadFirstParentStream(root, discovery.branchHeadSha);
  const historyGraph = discovery.shallow
    ? { commitsBySha: new Map() }
    : loadHistoryGraph(root, discovery.branchHeadSha);
  const prepMs = performance.now() - tPrepStart;

  const streamIndexBySha = new Map<string, number>();
  for (let i = 0; i < firstParentStream.length; i++) {
    streamIndexBySha.set(firstParentStream[i]!.sha, i);
  }

  const sessionOpenSamples: number[] = [];
  const staticAnalysisSamples: number[] = [];
  const briefSamples: number[] = [];
  const scoringSamples: number[] = [];

  async function evaluateUnitList(
    unitsNewestFirst: readonly DiscoveredChangeUnit[],
    bucket: 'pr' | 'change-unit',
    resumedMap: Map<string, PartialRecordLine>,
  ): Promise<BenchPrRecord[]> {
    // Evaluate oldest to newest so `--calibration-every <n>` checkpoints are always at or before PR i's base!
    const chronologicalUnits = [...unitsNewestFirst].reverse();
    const resultsById = new Map<string, BenchPrRecord>();

    const checkpoints: CalibrationCheckpointState[] = [];
    let newlyWrittenCount = 0;

    // GU-31: PRs on the same base tree share one base import graph (bounded; see BASE_GRAPH_CACHE_MAX).
    const baseGraphCache: BaseGraphCache = new Map();
    for (let idx = 0; idx < chronologicalUnits.length; idx++) {
      const unit = chronologicalUnits[idx]!;
      const resumed = resumedMap.get(unit.id);
      if (resumed) {
        if (resumed.calibrationCheckpoint) {
          checkpoints.push(resumed.calibrationCheckpoint);
        }
        resultsById.set(unit.id, resumed.record);
        sessionOpenSamples.push(resumed.timingsMs.sessionOpen);
        staticAnalysisSamples.push(resumed.timingsMs.staticAnalysis);
        briefSamples.push(resumed.timingsMs.brief);
        scoringSamples.push(resumed.timingsMs.scoring);
        opts.onProgress?.(idx + 1, chronologicalUnits.length, unit.id);
        continue;
      }

      let chosenCheckpoint: CalibrationCheckpointState | undefined;
      if (settings.calibrationEvery > 1 && idx % settings.calibrationEvery !== 0) {
        const candidates: { cp: CalibrationCheckpointState; dist: number; commitSec: number }[] = [];
        for (const cp of checkpoints) {
          if (idx - cp.unitIndex >= settings.calibrationEvery) continue;
          const dist = ancestryDistanceInHistoryGraph(root, historyGraph, cp.baseSha, unit.base);
          if (dist !== null) {
            const commitSec = historyGraph.commitsBySha.get(cp.baseSha)?.committerTimeSec ?? 0;
            candidates.push({ cp, dist, commitSec });
          }
        }
        if (candidates.length > 0) {
          // Prefer checkpoints whose baseSha is not a strict ancestor of any other eligible checkpoint's baseSha
          // (i.e. the most recent applicable training base in git ancestry order), breaking ties by shortest
          // parent-hop distance from unit.base, newer commit timestamp, and most recent unitIndex.
          const nonDominated = candidates.filter(
            (cand) =>
              !candidates.some(
                (other) =>
                  other.cp.baseSha !== cand.cp.baseSha &&
                  isAncestorInHistoryGraph(root, historyGraph, cand.cp.baseSha, other.cp.baseSha),
              ),
          );
          const pool = nonDominated.length > 0 ? nonDominated : candidates;
          pool.sort((a, b) => {
            if (a.dist !== b.dist) return a.dist - b.dist;
            if (a.commitSec !== b.commitSec) return b.commitSec - a.commitSec;
            return b.cp.unitIndex - a.cp.unitIndex;
          });
          chosenCheckpoint = pool[0]!.cp;
        }
      }
      const useCachedCalibration = chosenCheckpoint !== undefined;

      const replayRes = await replayBriefWithMeta({
        cwd: root,
        base: unit.base,
        head: unit.head,
        title: unit.subject,
        repoUrl: remoteUrl ?? undefined,
        prNumber: unit.prNumber ?? undefined,
        raLib: opts.raLib,
        raSettings: settings.raCacheEnabled ? undefined : { cache: { enabled: false } },
        raBacktest: chosenCheckpoint ? chosenCheckpoint.backtest : undefined,
        config: settings.configOverrides,
        now: opts.now,
        baseGraphCache,
      });

      const calibrationCheckpointBaseSha = chosenCheckpoint ? chosenCheckpoint.baseSha : unit.base;
      let createdCheckpoint: CalibrationCheckpointState | undefined;
      if (!useCachedCalibration) {
        createdCheckpoint = {
          unitIndex: idx,
          baseSha: unit.base,
          backtest: replayRes.meta.raBacktest ?? null,
        };
        checkpoints.push(createdCheckpoint);
      }

      const tScoreStart = performance.now();
      const { brief, ungatedBrief, meta } = replayRes;
      const prChangedFiles = new Set(brief.changes.files.map((f) => f.path));

      const reader = new GitTreeReader(root, unit.head);
      let headFiles: readonly string[] = [];
      try {
        headFiles = reader.listFiles();
      } finally {
        reader.close();
      }

      const mergeResolution = analyzeMergeResolution(root, unit, [brief, ungatedBrief]);
      const mergeIdx = streamIndexBySha.get(unit.mergeCommitSha);
      const startIndexAfterMerge = mergeIdx !== undefined ? mergeIdx + 1 : firstParentStream.length;

      const scoreCtx = {
        unit,
        prChangedFiles,
        resolvedAtMergeTargets: mergeResolution.resolvedAtMergeTargets,
        chronologicalStream: firstParentStream,
        startIndexAfterMerge,
        newestCommitSec: discovery.newestCommitSec,
        windowDays: settings.windowDays,
      };

      const trackRecords = trackRecordsByTarget(meta.raDiff);
      const prodQuestions = attachTrackRecords(scoreBriefQuestions(brief, scoreCtx), trackRecords);
      const ungatedQuestions = attachTrackRecords(scoreBriefQuestions(ungatedBrief, scoreCtx), trackRecords);

      const historyStats =
        meta.history === 'available'
          ? computeAsOfHistoryStats(historyGraph, unit.base, prChangedFiles, meta.raSettings)
          : {
              baseTimeSec: unit.mergedAtSec,
              changeCountByFile: new Map<string, number>(),
              lastChangedSecByFile: new Map<string, number>(),
              recent30dCountByFile: new Map<string, number>(),
              coChangeCountsForTouched: new Map<string, number>(),
            };

      const prodScorableTargets = scorableTargetFilesOf(prodQuestions);
      const ungatedScorableTargets = scorableTargetFilesOf(ungatedQuestions);

      const prodBaselines = computeAndScoreBaselines({
        k: prodScorableTargets.length,
        headFiles,
        prChangedFiles,
        stats: historyStats,
        scoreCtx,
        raSettings: meta.raSettings,
      });
      const ungatedBaselines = computeAndScoreBaselines({
        k: ungatedScorableTargets.length,
        headFiles,
        prChangedFiles,
        stats: historyStats,
        scoreCtx,
        raSettings: meta.raSettings,
      });

      const prodMissed =
        meta.history === 'available'
          ? computeMissedFollowUpFiles({
              headFiles,
              prChangedFiles,
              askedTargetFiles: allSuggestedTargetFilesOf(prodQuestions),
              stats: historyStats,
              scoreCtx,
              raSettings: meta.raSettings,
            })
          : [];
      const ungatedMissed =
        meta.history === 'available'
          ? computeMissedFollowUpFiles({
              headFiles,
              prChangedFiles,
              askedTargetFiles: allSuggestedTargetFilesOf(ungatedQuestions),
              stats: historyStats,
              scoreCtx,
              raSettings: meta.raSettings,
            })
          : [];

      const productionEval: PrPolicyEvaluation = {
        policy: 'production',
        policyLabel: 'production (calibrated)',
        salience: brief.salience.level,
        calibrationStatus: brief.calibration.status,
        calibrationPrecision: brief.calibration.precision ?? null,
        calibrationCheckpointBaseSha,
        questions: prodQuestions,
        baselines: prodBaselines,
        missedFollowUpFiles: prodMissed,
      };

      const ungatedEval: PrPolicyEvaluation = {
        policy: 'ungated',
        policyLabel: UNGATED_POLICY_LABEL,
        salience: ungatedBrief.salience.level,
        calibrationStatus: ungatedBrief.calibration.status,
        calibrationPrecision: null,
        calibrationCheckpointBaseSha,
        questions: ungatedQuestions,
        baselines: ungatedBaselines,
        missedFollowUpFiles: ungatedMissed,
      };

      const confounders = classifyPrConfounders(
        unit,
        brief.changes.files.map((f) => f.path),
        brief.change.commits.map((c) => c.subject),
      );

      const record: BenchPrRecord = {
        id: unit.id,
        prNumber: unit.prNumber,
        detection: unit.detection,
        confidence: unit.confidence,
        base: unit.base,
        head: unit.head,
        mergeCommitSha: unit.mergeCommitSha,
        mergedAt: unit.mergedAt,
        subject: sanitizeText(unit.subject),
        changedFilesCount: brief.changes.totals.files,
        changedFiles: brief.changes.files.slice(0, MAX_RECORDED_CHANGED_FILES).map((f) => ({
          path: sanitizePath(f.path),
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
        })),
        timestampAnomaly: unit.timestampAnomaly || meta.timestampAnomaly,
        ...coverageFields(brief),
        history: meta.history,
        mergeDiffers: mergeResolution.mergeDiffers,
        mergeDifferingFiles: mergeResolution.mergeDifferingFiles.map((f) => sanitizePath(f)),
        confounders,
        policies: {
          production: productionEval,
          ungated: ungatedEval,
        },
      };

      const scoringMs = performance.now() - tScoreStart;
      const timingsMs = {
        sessionOpen: Number(meta.stageTimingsMs.sessionOpen.toFixed(2)),
        staticAnalysis: Number(meta.stageTimingsMs.staticAnalysis.toFixed(2)),
        brief: Number(meta.stageTimingsMs.brief.toFixed(2)),
        scoring: Number(scoringMs.toFixed(2)),
      };

      sessionOpenSamples.push(timingsMs.sessionOpen);
      staticAnalysisSamples.push(timingsMs.staticAnalysis);
      briefSamples.push(timingsMs.brief);
      scoringSamples.push(timingsMs.scoring);

      if (partialPath) {
        const lineObj: PartialRecordLine = {
          type: 'pr',
          bucket,
          record,
          ...(createdCheckpoint ? { calibrationCheckpoint: createdCheckpoint } : {}),
          timingsMs,
        };
        appendFileSync(partialPath, JSON.stringify(lineObj) + '\n', 'utf8');
      }

      resultsById.set(unit.id, record);
      newlyWrittenCount++;
      opts.onProgress?.(idx + 1, chronologicalUnits.length, unit.id);

      if (opts.failAfterPrs !== undefined && newlyWrittenCount >= opts.failAfterPrs) {
        throw new Error(`Simulated crash after ${newlyWrittenCount} PRs`);
      }
    }

    return unitsNewestFirst.map((u) => resultsById.get(u.id)!);
  }

  const prs = await evaluateUnitList(discovery.eligiblePrs, 'pr', resumedPrs);
  const changeUnitPrs = settings.includeUnnumbered
    ? await evaluateUnitList(discovery.eligibleChangeUnits, 'change-unit', resumedChangeUnits)
    : [];

  // Populate funnel evaluated, scored, and post-evaluation exclusion reasons.
  const funnel = discovery.funnel;
  for (const pr of prs) {
    if (pr.history === 'unavailable') {
      funnel.exclusions.historyUnavailable++;
      continue;
    }
    funnel.evaluated++;
    const prodQs = pr.policies.production.questions;
    if (prodQs.some((q) => isScoredStatus(q.status))) {
      funnel.scored++;
    } else if (prodQs.length === 0) {
      funnel.exclusions.noQuestions++;
    } else if (prodQs.every((q) => q.status === 'unscorable')) {
      funnel.exclusions.unscorableOnly++;
    } else if (prodQs.every((q) => q.status === 'resolvedAtMerge' || q.status === 'unscorable')) {
      funnel.exclusions.resolvedAtMergeOnly++;
    } else if (prodQs.some((q) => q.status === 'censored')) {
      funnel.exclusions.censored++;
    }
  }

  if (settings.includeUnnumbered) {
    for (const cu of changeUnitPrs) {
      if (cu.history === 'unavailable') continue;
      funnel.changeUnitsEvaluated++;
      if (cu.policies.production.questions.some((q) => isScoredStatus(q.status))) {
        funnel.changeUnitsScored++;
      }
    }
  }

  const productionAgg = computePolicyAggregates(prs, 'production');
  const ungatedAgg = computePolicyAggregates(prs, 'ungated');
  const changeUnitsAgg =
    settings.includeUnnumbered && changeUnitPrs.length > 0
      ? {
          production: computePolicyAggregates(changeUnitPrs, 'production'),
          ungated: computePolicyAggregates(changeUnitPrs, 'ungated'),
        }
      : null;

  const gates = buildGateSummary(productionAgg, settings.gateFullShare, settings.proxyMinLift);
  const tReportStart = performance.now();

  const model: BenchResultsModel = {
    schemaVersion: BENCH_SCHEMA_VERSION,
    scoringVersion: BENCH_SCORING_VERSION,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    repo: {
      name: sanitizeText(repoName, 100),
      remoteUrl,
      branch: sanitizeText(discovery.branch, 100),
      headSha: discovery.branchHeadSha,
      shallow: discovery.shallow,
    },
    tools: {
      gutter: GUTTER_VERSION,
      repoArchaeology: raLib.version,
    },
    settings,
    runIdentity,
    funnel,
    gates,
    aggregates: {
      production: productionAgg,
      ungated: ungatedAgg,
    },
    prs,
    changeUnits: {
      prs: changeUnitPrs,
      aggregates: changeUnitsAgg,
    },
    timings: {
      totalWallMs: 0,
      stages: {
        discovery: summarizeStageTiming([Number((discoveryMs + prepMs).toFixed(2))]),
        sessionOpen: summarizeStageTiming(sessionOpenSamples),
        staticAnalysis: summarizeStageTiming(staticAnalysisSamples),
        brief: summarizeStageTiming(briefSamples),
        scoring: summarizeStageTiming(scoringSamples),
        report: summarizeStageTiming([0]),
      },
    },
  };

  // Validate against schema/bench.schema.json before writing anything (Req 11).
  assertValidBenchResults(model);
  // Pre-render once to time report generation, then update timings on the model and re-validate.
  renderBenchMarkdown(model);
  renderBenchHtml(model);
  const reportMs = Number((performance.now() - tReportStart).toFixed(2));
  model.timings.stages.report = summarizeStageTiming([reportMs]);
  model.timings.totalWallMs = Number((performance.now() - tWallStart).toFixed(2));

  assertValidBenchResults(model);

  if (opts.outDir) {
    writeBenchOutputs(model, opts.outDir);
  }

  return model;
}

export interface BenchOutputPaths {
  json: string;
  markdown: string;
  html: string;
}

/**
 * Validate `model` against `schema/bench.schema.json`, generate `bench.md` and
 * `bench.html` strictly from the validated model, verify FRAME/12 grammar via
 * `lintPage()`, and write all three files atomically.
 */
export function writeBenchOutputs(model: BenchResultsModel, outDir: string): BenchOutputPaths {
  assertValidBenchResults(model);
  const jsonContent = JSON.stringify(model, null, 2) + '\n';
  const mdContent = renderBenchMarkdown(model);
  const htmlContent = renderBenchHtml(model);

  const grammarProblems = lintPage(htmlContent);
  if (grammarProblems.length > 0) {
    throw new Error(`bench.html failed FRAME/12 grammar lint:\n  ${grammarProblems.join('\n  ')}`);
  }

  mkdirSync(outDir, { recursive: true });
  const paths: BenchOutputPaths = {
    json: join(outDir, 'bench.json'),
    markdown: join(outDir, 'bench.md'),
    html: join(outDir, 'bench.html'),
  };

  writeFileAtomic(paths.json, jsonContent);
  writeFileAtomic(paths.markdown, mdContent);
  writeFileAtomic(paths.html, htmlContent);

  return paths;
}
