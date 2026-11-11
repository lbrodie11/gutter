import type { Calibration, ChecklistKind, Salience } from '../contract.ts';
import type { GutterConfig } from '../config.ts';
import type { CompanionTrackRecord } from '../sources/archaeology.ts';
import { wilsonInterval } from '../stats/wilson.ts';
import type { BenchFunnel, DetectionConfidence, DetectionKind } from './discover.ts';

export type SalienceLevel = Salience['level'];

export const BENCH_SCHEMA_VERSION = 1 as const;
export const BENCH_SCORING_VERSION = 1 as const;
export const UNGATED_POLICY_LABEL = 'research: not product behavior' as const;
export const SAMPLE_SIZE_FLOOR = 30 as const;
export const DEFAULT_BOOTSTRAP_RESAMPLES = 1000 as const;
export const DEFAULT_BOOTSTRAP_SEED = 20261108 as const;

export type PolicyName = 'production' | 'ungated';
export type BaselineName = 'popular' | 'popular-near' | 'recent';

export type TargetOutcomeStatus =
  | 'followedUp'
  | 'notFollowedUp'
  | 'censored'
  | 'targetDeleted'
  | 'targetRenamed'
  | 'resolvedAtMerge'
  | 'unscorable';

export type RaFollowUpSignal = 'subject-cue' | 'shared-file' | 'immediate-same-author';

export interface ProportionMetric {
  numerator: number;
  denominator: number;
  /** Point estimate in [0, 1], or `null` (rendered as `N/A`) when `denominator === 0`. */
  rate: number | null;
  /** Wilson 95% confidence interval, or `null` when `denominator === 0`. */
  interval: { low: number; high: number } | null;
}

export function makeProportionMetric(numerator: number, denominator: number): ProportionMetric {
  if (denominator <= 0) {
    return {
      numerator: 0,
      denominator: 0,
      rate: null,
      interval: null,
    };
  }
  const safeNum = Math.max(0, Math.min(numerator, denominator));
  return {
    numerator: safeNum,
    denominator,
    rate: Number((safeNum / denominator).toFixed(4)),
    interval: wilsonInterval(safeNum, denominator),
  };
}

export interface TargetOutcomeRecord {
  targetFile: string;
  status: TargetOutcomeStatus;
  commitSha: string | null;
  delayHours: number | null;
  sameAuthor: boolean | null;
  authorName: string | null;
  targetRenamed: boolean;
  renamedTo: string | null;
  raFollowUpSignals: RaFollowUpSignal[];
  matchesRaFollowUp: boolean;
  sharedWithOtherPrs: boolean;
}

export interface QuestionOutcomeRecord {
  id: string;
  kind: ChecklistKind;
  question: string;
  authorNames: string[];
  intervalLow: number | null;
  intervalLowBucket: '0-0.3' | '0.3-0.5' | '0.5+' | 'none';
  status: TargetOutcomeStatus;
  targets: TargetOutcomeRecord[];
  sameAuthorHit: boolean;
  matchesRaFollowUpHit: boolean;
  /**
   * GU-28: Repo Archaeology's per-pair track record (>= 0.10.0) behind a `forgotten-companion`
   * question, as Gutter read it. Internal to the bench; never part of `gutter.json`.
   */
  trackRecord?: CompanionTrackRecord;
}

export interface BaselineProposalSet {
  baseline: BaselineName;
  kRequested: number;
  proposedCount: number;
  shortfall: number;
  targets: TargetOutcomeRecord[];
  anyFollowedUp: boolean;
}

export interface PrPolicyEvaluation {
  policy: PolicyName;
  policyLabel: string;
  salience: SalienceLevel;
  calibrationStatus: Calibration['status'];
  calibrationPrecision: number | null;
  calibrationCheckpointBaseSha: string;
  questions: QuestionOutcomeRecord[];
  baselines: Record<BaselineName, BaselineProposalSet>;
  missedFollowUpFiles: string[];
}

export const MAX_RECORDED_CHANGED_FILES = 40 as const;

export interface BenchChangedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface PrConfounders {
  botOrAgentOrigin: boolean;
  generatedPaths: boolean;
  dependencyOrVersionOnly: boolean;
  largeSweep50Plus: boolean;
}

export interface BenchPrRecord {
  id: string;
  prNumber: number | null;
  detection: DetectionKind;
  confidence: DetectionConfidence;
  base: string;
  head: string;
  mergeCommitSha: string;
  mergedAt: string;
  subject: string;
  changedFilesCount: number;
  /**
   * GU-04: the first `MAX_RECORDED_CHANGED_FILES` changed paths with +/- counts, for the
   * labeling tool's diff summary. Absent in GU-03-era files.
   */
  changedFiles?: BenchChangedFile[];
  timestampAnomaly: boolean;
  /**
   * GU-30, additive: the production brief's dependents coverage at this PR's head, so coverage honesty is
   * measured on every PR. Absent in pre-GU-30 files.
   */
  coverage?: 'full' | 'partial';
  /** GU-30, additive: `dependents.unresolved.byReason` (empty when the fallback scanner produced the layer). */
  unresolvedByReason?: Record<string, number>;
  /**
   * GU-32, additive: `dependents.unresolved.relevant.byReason`, the unresolved imports that could reach this PR's
   * files (empty when none could, or when the fallback scanner produced the layer). `coverage` above follows
   * these since GU-32; before, it followed `unresolvedByReason`.
   */
  relevantUnresolvedByReason?: Record<string, number>;
  /** GU-30, additive: sorted languages of changed files listed in `dependents.unchecked`. */
  uncheckedLanguages?: string[];
  history: 'available' | 'unavailable';
  mergeDiffers: boolean;
  mergeDifferingFiles: string[];
  confounders: PrConfounders;
  policies: {
    production: PrPolicyEvaluation;
    ungated: PrPolicyEvaluation;
  };
}

export interface BootstrapInterval {
  low: number;
  high: number;
  median: number;
  resamples: number;
  seed: number;
}

/** Outcomes every policy and baseline is scored on (GU-04 Stage 0). */
export type OutcomeName = 'followUp' | 'sameAuthor' | 'raSignal';
export const OUTCOME_NAMES: readonly OutcomeName[] = ['followUp', 'sameAuthor', 'raSignal'];

export interface OutcomeLift {
  /** Policy rate / baseline rate on this outcome, or `null` when either rate is missing or the baseline rate is 0. */
  lift: number | null;
  /** Paired PR-clustered bootstrap interval for `lift`. */
  bootstrapCi: LiftBootstrapInterval | null;
}

/**
 * Bootstrap interval for a lift. Resamples where the baseline has no hits but the policy does
 * have an infinite lift and are kept (dropping them would bias the interval down); when they
 * reach a reported quantile, that bound is `null` (unbounded). Resamples with no hits on either
 * side have no defined lift and are dropped.
 */
export interface LiftBootstrapInterval {
  low: number | null;
  high: number | null;
  median: number | null;
  resamples: number;
  seed: number;
  /** Resamples whose lift was infinite (baseline 0 hits, policy > 0). */
  unboundedResamples: number;
  /** Resamples with no hits on either side (lift undefined), excluded from the quantiles. */
  undefinedResamples: number;
}

export interface BaselineAggregateSummary {
  baseline: BaselineName;
  proposedTargets: number;
  shortfallPrs: number;
  shortfallTargets: number;
  fileLevelFollowUp: ProportionMetric;
  questionLevelHitRate: ProportionMetric;
  sameAuthorFollowUpRate: ProportionMetric;
  liftVsBaseline: number | null;
  bootstrapLiftCi: BootstrapInterval | null;
  /** GU-04: RA-signal follow-up rate over the same scored targets as `fileLevelFollowUp`. */
  raSignalFollowUpRate?: ProportionMetric;
  /** GU-04: PR-clustered bootstrap intervals for each outcome rate. */
  bootstrapRateCi?: Record<OutcomeName, BootstrapInterval | null>;
  /** GU-04: the policy's lift over this baseline on each outcome. */
  liftByOutcome?: Record<OutcomeName, OutcomeLift>;
}

export interface StrongestBaselineForOutcome extends OutcomeLift {
  /** Baseline with the highest rate on this outcome (ties: popular-near, recent, popular). */
  strongestBaseline: BaselineName | null;
}

export interface KindBreakdownRow {
  kind: ChecklistKind;
  questions: number;
  scoredQuestions: number;
  questionFollowUpRate: ProportionMetric;
  scoredTargets: number;
  fileFollowUpPrecision: ProportionMetric;
  sameAuthorFollowUpRate: ProportionMetric;
}

export interface IntervalBucketBreakdownRow {
  bucket: '0-0.3' | '0.3-0.5' | '0.5+';
  targets: number;
  scoredTargets: number;
  fileFollowUpPrecision: ProportionMetric;
  sameAuthorFollowUpRate: ProportionMetric;
}

export interface ConfounderBreakdownRow {
  slice: 'botOrAgentOrigin' | 'generatedPaths' | 'dependencyOrVersionOnly' | 'largeSweep50Plus' | 'cleanManual';
  prsEvaluated: number;
  scoredTargets: number;
  fileFollowUpPrecision: ProportionMetric;
}

export interface ExemplarQuestion {
  prId: string;
  prNumber: number | null;
  headSha: string;
  subject: string;
  authorNames: string[];
  kind: ChecklistKind;
  question: string;
  targetFile: string;
  intervalLow: number | null;
  status: 'followedUp' | 'notFollowedUp';
  followUpCommitSha: string | null;
  delayHours: number | null;
  sameAuthor: boolean | null;
}

export interface PolicyAggregateSummary {
  policy: PolicyName;
  policyLabel: string;
  sampleStatus: 'sufficient' | 'insufficient-sample (< 30 scored)';
  coverage: {
    prsEvaluated: number;
    prsScored: number;
    prsWithQuestions: ProportionMetric;
    questionsTotal: number;
    questionsPerPr: number | null;
    salienceDistribution: {
      quiet: ProportionMetric;
      brief: ProportionMetric;
      full: ProportionMetric;
    };
    fullSalienceShare: ProportionMetric;
  };
  outcomes: {
    followedUp: number;
    notFollowedUp: number;
    censored: number;
    targetDeleted: number;
    targetRenamed: number;
    resolvedAtMerge: number;
    unscorable: number;
    sharedFollowUpOutcomes: number;
  };
  accuracyProxy: {
    fileLevelFollowUpPrecision: ProportionMetric;
    questionLevelFollowUpRate: ProportionMetric;
    precisionAt1: ProportionMetric;
    precisionAt3: ProportionMetric;
    precisionAt3ShortQueries: number;
    precisionAt3Note: string;
    sameAuthorFollowUpRate: ProportionMetric;
    sameAuthorShareOfFollowedUp: ProportionMetric;
    raSignalFollowUpRate: ProportionMetric;
    bootstrapFilePrecisionCi: BootstrapInterval | null;
    /** GU-04: PR-clustered bootstrap intervals for the same-author and RA-signal rates. */
    bootstrapSameAuthorCi?: BootstrapInterval | null;
    bootstrapRaSignalCi?: BootstrapInterval | null;
  };
  missedFollowUps: {
    missedFilesTotal: number;
    prsWithMissedFollowUp: number;
    recallProxy: ProportionMetric;
  };
  baselines: Record<BaselineName, BaselineAggregateSummary>;
  headlineBaseline: {
    strongestBaseline: BaselineName | null;
    lift: number | null;
    bootstrapLiftCi: BootstrapInterval | null;
    /** GU-04: strongest baseline and lift, chosen separately for each outcome. */
    byOutcome?: Record<OutcomeName, StrongestBaselineForOutcome>;
  };
  breakdowns: {
    byKind: Record<ChecklistKind, KindBreakdownRow>;
    byIntervalLow: Record<'0-0.3' | '0.3-0.5' | '0.5+', IntervalBucketBreakdownRow>;
    byConfounder: Record<
      'botOrAgentOrigin' | 'generatedPaths' | 'dependencyOrVersionOnly' | 'largeSweep50Plus' | 'cleanManual',
      ConfounderBreakdownRow
    >;
  };
  exemplars: {
    bestQuestions: ExemplarQuestion[];
    worstQuestions: ExemplarQuestion[];
  };
}

export interface StageTimingSummary {
  count: number;
  totalMs: number;
  p50Ms: number;
  p95Ms: number;
}

export interface BenchTimings {
  totalWallMs: number;
  stages: {
    discovery: StageTimingSummary;
    sessionOpen: StageTimingSummary;
    staticAnalysis: StageTimingSummary;
    brief: StageTimingSummary;
    scoring: StageTimingSummary;
    report: StageTimingSummary;
  };
}

export interface BenchSettings {
  branch: string;
  prsLimit: number;
  since: string | null;
  windowDays: number;
  calibrationEvery: number;
  includeUnnumbered: boolean;
  gateFullShare: number;
  proxyMinLift: number;
  configOverrides: GutterConfig;
  raCacheEnabled: boolean;
}

export interface BenchGateSummary {
  fullSalienceShare: {
    value: number | null;
    threshold: number;
    passed: boolean | null;
    line: string;
  };
  gateAUsefulness: {
    status: 'UNVERIFIED';
    followUpProxyRate: number | null;
    followUpProxyInterval: { low: number; high: number } | null;
    strongestBaseline: BaselineName | null;
    liftVsStrongest: number | null;
    proxyMinLift: number;
    line: string;
  };
}

export interface RunIdentity {
  repo: string;
  branchHeadSha: string;
  settingsHash: string;
  gutterVersion: string;
  raVersion: string;
  scoringVersion: typeof BENCH_SCORING_VERSION;
  schemaVersion: typeof BENCH_SCHEMA_VERSION;
}

export interface BenchResultsModel {
  schemaVersion: typeof BENCH_SCHEMA_VERSION;
  scoringVersion: typeof BENCH_SCORING_VERSION;
  generatedAt: string;
  repo: {
    name: string;
    remoteUrl: string | null;
    branch: string;
    headSha: string;
    shallow: boolean;
  };
  tools: {
    gutter: string;
    repoArchaeology: string;
  };
  settings: BenchSettings;
  runIdentity: RunIdentity;
  funnel: BenchFunnel;
  gates: BenchGateSummary;
  aggregates: {
    production: PolicyAggregateSummary;
    ungated: PolicyAggregateSummary;
  };
  prs: BenchPrRecord[];
  /** Separate unnumbered commits when `--include-unnumbered` is used; never pooled with `prs`. */
  changeUnits: {
    prs: BenchPrRecord[];
    aggregates: {
      production: PolicyAggregateSummary;
      ungated: PolicyAggregateSummary;
    } | null;
  };
  timings: BenchTimings;
}
