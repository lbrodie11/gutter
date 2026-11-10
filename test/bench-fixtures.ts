/**
 * Pure (no git) synthetic `bench.json` builders for metric, labeling, and aggregation tests.
 * Every model built here passes `assertValidBenchResults`.
 */
import type { ChecklistKind } from '../src/contract.ts';
import { buildGateSummary, computePolicyAggregates, summarizeStageTiming } from '../src/bench/metrics.ts';
import type {
  BaselineName,
  BaselineProposalSet,
  BenchPrRecord,
  BenchResultsModel,
  PrPolicyEvaluation,
  QuestionOutcomeRecord,
  TargetOutcomeRecord,
} from '../src/bench/model.ts';
import { BENCH_SCHEMA_VERSION, BENCH_SCORING_VERSION, UNGATED_POLICY_LABEL } from '../src/bench/model.ts';

export interface TargetSpec {
  file: string;
  followedUp: boolean;
  sameAuthor?: boolean;
  raSignal?: boolean;
  status?: TargetOutcomeRecord['status'];
}

export function target(spec: TargetSpec): TargetOutcomeRecord {
  const status = spec.status ?? (spec.followedUp ? 'followedUp' : 'notFollowedUp');
  const hit = status === 'followedUp';
  return {
    targetFile: spec.file,
    status,
    commitSha: hit ? 'f'.repeat(40) : null,
    delayHours: hit ? 12 : null,
    sameAuthor: hit ? Boolean(spec.sameAuthor) : null,
    authorName: hit ? 'Follow Upper' : null,
    targetRenamed: false,
    renamedTo: null,
    raFollowUpSignals: spec.raSignal ? ['subject-cue'] : [],
    matchesRaFollowUp: Boolean(spec.raSignal),
    sharedWithOtherPrs: false,
  };
}

export function question(kind: ChecklistKind, t: TargetOutcomeRecord, intervalLow: number | null = 0.42): QuestionOutcomeRecord {
  return {
    id: `check:${kind === 'forgotten-companion' ? 'companion' : kind}:${t.targetFile}`,
    kind,
    question: `\`${t.targetFile}\` changed alongside \`src/changed.ts\` in 7 of its 10 commits (95% CI 40%–89%) but is untouched here. Does it need a matching change?`,
    authorNames: ['Pat Author'],
    intervalLow,
    intervalLowBucket: intervalLow === null ? 'none' : intervalLow >= 0.5 ? '0.5+' : intervalLow >= 0.3 ? '0.3-0.5' : '0-0.3',
    status: t.status,
    targets: [t],
    sameAuthorHit: t.status === 'followedUp' && t.sameAuthor === true,
    matchesRaFollowUpHit: t.status === 'followedUp' && t.matchesRaFollowUp,
  };
}

export function baselineSet(name: BaselineName, targets: TargetOutcomeRecord[], k = targets.length): BaselineProposalSet {
  return {
    baseline: name,
    kRequested: k,
    proposedCount: targets.length,
    shortfall: Math.max(0, k - targets.length),
    targets,
    anyFollowedUp: targets.some((t) => t.status === 'followedUp'),
  };
}

export interface PrSpec {
  n: number;
  salience?: PrPolicyEvaluation['salience'];
  questions?: QuestionOutcomeRecord[];
  baselines?: Partial<Record<BaselineName, TargetOutcomeRecord[]>>;
  subject?: string;
}

export function pr(spec: PrSpec): BenchPrRecord {
  const sha = (spec.n.toString(16).padStart(6, '0') + 'a'.repeat(40)).slice(0, 40);
  const questions = spec.questions ?? [];
  const baselines = {
    popular: baselineSet('popular', spec.baselines?.popular ?? []),
    'popular-near': baselineSet('popular-near', spec.baselines?.['popular-near'] ?? []),
    recent: baselineSet('recent', spec.baselines?.recent ?? []),
  };
  const evalFor = (policy: 'production' | 'ungated'): PrPolicyEvaluation => ({
    policy,
    policyLabel: policy === 'production' ? 'production (calibrated)' : UNGATED_POLICY_LABEL,
    salience: spec.salience ?? (questions.length ? 'brief' : 'quiet'),
    calibrationStatus: 'measured',
    calibrationPrecision: policy === 'production' ? 0.4 : null,
    calibrationCheckpointBaseSha: sha,
    questions: structuredClone(questions),
    baselines: structuredClone(baselines),
    missedFollowUpFiles: [],
  });
  return {
    id: `pr-${spec.n}`,
    prNumber: spec.n,
    detection: 'squash-subject',
    confidence: 'medium',
    base: sha,
    head: sha,
    mergeCommitSha: sha,
    mergedAt: new Date(Date.UTC(2026, 0, 1) + spec.n * 3_600_000).toISOString(),
    subject: spec.subject ?? `feat: change number ${spec.n} (#${spec.n})`,
    changedFilesCount: 2,
    changedFiles: [
      { path: 'src/changed.ts', status: 'modified', additions: 10, deletions: 2 },
      { path: 'src/other.ts', status: 'added', additions: 30, deletions: 0 },
    ],
    timestampAnomaly: false,
    history: 'available',
    mergeDiffers: false,
    mergeDifferingFiles: [],
    confounders: { botOrAgentOrigin: false, generatedPaths: false, dependencyOrVersionOnly: false, largeSweep50Plus: false },
    policies: { production: evalFor('production'), ungated: evalFor('ungated') },
  };
}

export function benchModel(prs: BenchPrRecord[], repo = 'https://github.com/example/widget'): BenchResultsModel {
  const production = computePolicyAggregates(prs, 'production');
  const ungated = computePolicyAggregates(prs, 'ungated');
  const zeroTiming = summarizeStageTiming([1]);
  const headSha = 'b'.repeat(40);
  return {
    schemaVersion: BENCH_SCHEMA_VERSION,
    scoringVersion: BENCH_SCORING_VERSION,
    generatedAt: '2026-11-10T00:00:00.000Z',
    repo: { name: repo.replace('https://github.com/', ''), remoteUrl: repo, branch: 'main', headSha, shallow: false },
    tools: { gutter: '0.0.0-test', repoArchaeology: '0.4.0' },
    settings: {
      branch: 'HEAD',
      prsLimit: 200,
      since: null,
      windowDays: 7,
      calibrationEvery: 1,
      includeUnnumbered: false,
      gateFullShare: 0.3333,
      proxyMinLift: 1.5,
      configOverrides: {},
      raCacheEnabled: true,
    },
    runIdentity: {
      repo,
      branchHeadSha: headSha,
      settingsHash: '0123456789abcdef',
      gutterVersion: '0.0.0-test',
      raVersion: '0.4.0',
      scoringVersion: BENCH_SCORING_VERSION,
      schemaVersion: BENCH_SCHEMA_VERSION,
    },
    funnel: {
      discovered: prs.length,
      classified: { mergeCommitHigh: 0, mergeCommitMedium: 0, squashMedium: prs.length, octopus: 0, notAPr: 0, changeUnitLow: 0 },
      eligible: prs.length,
      evaluated: prs.length,
      scored: prs.length,
      changeUnitsDiscovered: 0,
      changeUnitsEligible: 0,
      changeUnitsEvaluated: 0,
      changeUnitsScored: 0,
      exclusions: {
        octopus: 0, notAPr: 0, rootCommit: 0, beforeSince: 0, missingMergeBase: 0, emptyDiff: 0,
        beyondPrsLimit: 0, historyUnavailable: 0, noQuestions: 0, unscorableOnly: 0, resolvedAtMergeOnly: 0, censored: 0,
      },
    },
    gates: buildGateSummary(production, 1 / 3, 1.5),
    aggregates: { production, ungated },
    prs,
    changeUnits: { prs: [], aggregates: null },
    timings: {
      totalWallMs: 1,
      stages: {
        discovery: zeroTiming, sessionOpen: zeroTiming, staticAnalysis: zeroTiming,
        brief: zeroTiming, scoring: zeroTiming, report: zeroTiming,
      },
    },
  };
}

/** n PRs; each has one companion target, plus one recent and one popular-near proposal. */
export function labelFixturePrs(n: number): BenchPrRecord[] {
  const prs: BenchPrRecord[] = [];
  for (let i = 1; i <= n; i++) {
    prs.push(
      pr({
        n: i,
        questions: [question('forgotten-companion', target({ file: `src/companion-${i}.ts`, followedUp: i % 3 === 0, sameAuthor: true }))],
        baselines: {
          recent: [target({ file: `src/busy-${i}.ts`, followedUp: i % 2 === 0 })],
          'popular-near': [target({ file: `src/near-${i}.ts`, followedUp: false })],
          popular: [target({ file: `src/pop-${i}.ts`, followedUp: true })],
        },
      }),
    );
  }
  return prs;
}

