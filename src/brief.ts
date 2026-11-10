import type { ChangeStructure, DependentsLayer, GutterBrief, TestLink } from './contract.ts';
import { SCHEMA_VERSION } from './contract.ts';
import type { GutterConfig, SafeRaRepoConfig } from './config.ts';
import { readSnapshotAuxConfigs } from './config.ts';
import { browseUrlFromRemote, git, hasTimestampAnomaly, isShallowRepo, repoRoot, resolveSha } from './git.ts';
import { headCommits, readChanges } from './evidence/changes.ts';
import { buildDependents } from './evidence/imports.ts';
import { linkTests } from './evidence/tests.ts';
import { buildChecklist, salienceOf } from './evidence/checklist.ts';
import type { SourceReader } from './source/reader.ts';
import { GitTreeReader, WorkingTreeReader } from './source/reader.ts';
import type { RaBacktest, RaDiff, RaRunner } from './sources/archaeology.ts';
import { runBacktest, runDiff, toCalibration, toForgotten } from './sources/archaeology.ts';
import { loadRaLibrary } from './sources/archaeology-lib.ts';
import { GUTTER_VERSION } from './version.ts';

export interface BriefOptions {
  cwd: string;
  base: string;
  head?: string;
  title?: string;
  intent?: string;
  repoUrl?: string;
  prNumber?: number;
  /** Pre-computed Repo Archaeology output (as the Action does). */
  raDiff?: RaDiff;
  raBacktest?: RaBacktest;
  runner?: RaRunner;
  /** Skip co-change history entirely. */
  noHistory?: boolean;
  noCalibration?: boolean;
  maxForgotten?: number;
  config?: GutterConfig;
  /** Optional git ref/SHA from which to read `.gutter.json` (used by GitHub Action to read from `base`). */
  configRef?: string;
  reader?: SourceReader;
  now?: Date;
}

export interface ReplayBriefOptions {
  cwd: string;
  base: string;
  head?: string;
  title?: string;
  intent?: string;
  repoUrl?: string;
  prNumber?: number;
  raDiff?: RaDiff;
  raBacktest?: RaBacktest | null;
  /** Path to local repo-archaeology library (never falls back to npx). */
  raLib?: string;
  /** Optional Repo Archaeology settings overrides (for example `{ cache: false }`). */
  raSettings?: Record<string, unknown>;
  noHistory?: boolean;
  noCalibration?: boolean;
  maxForgotten?: number;
  config?: GutterConfig;
  now?: Date;
}

export interface ReplayMeta {
  history: 'available' | 'unavailable';
  timestampAnomaly: boolean;
  raDiff?: RaDiff;
  raBacktest?: RaBacktest | null;
  raVersion?: string;
  raSettings?: SafeRaRepoConfig;
  stageTimingsMs: {
    sessionOpen: number;
    staticAnalysis: number;
    brief: number;
  };
}

export interface ReplayResult {
  brief: GutterBrief;
  ungatedBrief: GutterBrief;
  meta: ReplayMeta;
}

export interface AssembleBriefInput {
  base: string;
  head: string;
  baseSha: string;
  headSha: string;
  title?: string;
  intent?: string;
  repoUrl?: string;
  prNumber?: number;
  changes: ChangeStructure;
  commits: { sha: string; subject: string }[];
  dependents: DependentsLayer;
  tests: TestLink[];
  raDiff?: RaDiff;
  raBacktest?: RaBacktest;
  unavailable?: string;
  noHistory?: boolean;
  noCalibration?: boolean;
  maxForgotten?: number;
  config?: GutterConfig;
  /** Optional git ref/SHA from which to read `.gutter.json` (used by GitHub Action to read from `base`). */
  configRef?: string;
  reader?: SourceReader;
  now?: Date;
}

const INTENT_MAX = 600;

/**
 * Pure brief assembly shared by synchronous `buildBrief()` (CLI/Action) and
 * async `replayBrief()` (`gutter bench`).
 */
export function assembleBrief(input: AssembleBriefInput): GutterBrief {
  const mergedConfig: GutterConfig = {
    ...input.config,
    ...(input.maxForgotten !== undefined ? { maxForgotten: input.maxForgotten } : {}),
    ...(input.noHistory !== undefined ? { noHistory: input.noHistory } : {}),
    ...(input.noCalibration !== undefined ? { noCalibration: input.noCalibration } : {}),
  };
  const noHistory = Boolean(mergedConfig.noHistory);
  const noCalibration = Boolean(mergedConfig.noCalibration);
  const maxForgotten = mergedConfig.maxForgotten ?? 3;

  const engines: { name: string; version: string }[] = [{ name: 'gutter', version: GUTTER_VERSION }];
  if (!noHistory && input.raDiff) {
    engines.push({ name: 'repo-archaeology', version: input.raDiff.tool.version });
  }

  let unavailable = input.unavailable;
  if (noHistory && !unavailable) {
    unavailable = 'Co-change history was turned off for this run.';
  }

  const forgotten = toForgotten(noHistory ? undefined : input.raDiff, { maxItems: maxForgotten, maxEvidence: 5 }, unavailable);
  const calibration = toCalibration(noHistory ? undefined : input.raBacktest, noCalibration);
  const checklist = buildChecklist({
    changes: input.changes,
    dependents: input.dependents,
    forgotten,
    tests: input.tests,
    calibration,
    config: mergedConfig,
  });
  const salience = salienceOf(input.changes, checklist, mergedConfig);

  const title = (input.title ?? input.commits[0]?.subject ?? `${input.base}…${input.head}`).trim();
  const intent = input.intent?.trim().slice(0, INTENT_MAX);

  return {
    schemaVersion: SCHEMA_VERSION,
    tool: { name: 'gutter', version: GUTTER_VERSION },
    change: {
      base: input.base,
      head: input.head,
      baseSha: input.baseSha,
      headSha: input.headSha,
      title,
      ...(intent ? { intent } : {}),
      commits: input.commits,
      ...(input.repoUrl ? { repoUrl: input.repoUrl } : {}),
      ...(input.prNumber ? { prNumber: input.prNumber } : {}),
    },
    salience,
    changes: input.changes,
    dependents: input.dependents,
    forgotten,
    tests: input.tests,
    checklist,
    calibration,
    provenance: {
      generatedAt: (input.now ?? new Date()).toISOString(),
      engines,
      deterministic: true,
    },
  };
}

export function buildBrief(opts: BriefOptions): GutterBrief {
  const root = repoRoot(opts.cwd);
  const head = opts.head ?? 'HEAD';
  const baseSha = resolveSha(root, opts.base);
  if (!baseSha) throw new Error(`base ref "${opts.base}" not found (did the checkout fetch enough history? use fetch-depth: 0)`);
  const headSha = resolveSha(root, head);
  if (!headSha) throw new Error(`head ref "${head}" not found`);

  const ownReader = !opts.reader;
  const reader = opts.reader ?? new WorkingTreeReader(root);
  try {
    const checkedOut = resolveSha(root, 'HEAD');
    let gutterConfig: GutterConfig;
    if (opts.configRef) {
      const cfgSha = resolveSha(root, opts.configRef) ?? baseSha;
      const cfgReader = new GitTreeReader(root, cfgSha);
      try {
        gutterConfig = readSnapshotAuxConfigs(cfgReader).gutterConfig;
      } finally {
        cfgReader.close();
      }
    } else if (!opts.reader && checkedOut && headSha !== checkedOut) {
      const cfgReader = new GitTreeReader(root, headSha);
      try {
        gutterConfig = readSnapshotAuxConfigs(cfgReader).gutterConfig;
      } finally {
        cfgReader.close();
      }
    } else {
      gutterConfig = readSnapshotAuxConfigs(reader).gutterConfig;
    }
    const mergedConfig: GutterConfig = {
      ...gutterConfig,
      ...opts.config,
      ...(opts.maxForgotten !== undefined ? { maxForgotten: opts.maxForgotten } : {}),
      ...(opts.noHistory !== undefined ? { noHistory: opts.noHistory } : {}),
      ...(opts.noCalibration !== undefined ? { noCalibration: opts.noCalibration } : {}),
    };

    const changes = readChanges(root, opts.base, head);
    const commits = headCommits(root, opts.base, head);
    const dependents = buildDependents(root, changes, reader);
    const tests = linkTests(root, changes, reader);

    // Co-change history: Repo Archaeology CLI analyzes the checked-out HEAD, so only
    // run it ourselves when `head` is what is checked out.
    let raDiff = opts.raDiff;
    let raBacktest = opts.raBacktest;
    let unavailable: string | undefined;
    const noHistory = Boolean(mergedConfig.noHistory);
    const noCalibration = Boolean(mergedConfig.noCalibration);

    if (!noHistory && !raDiff) {
      const checkedOut = resolveSha(root, 'HEAD');
      if (checkedOut !== headSha) {
        unavailable = `Co-change history needs ${head} checked out; it was skipped.`;
      } else {
        try {
          raDiff = runDiff(root, opts.base, opts.runner ?? {});
          if (!noCalibration && !raBacktest) {
            try {
              raBacktest = runBacktest(root, opts.runner ?? {});
            } catch {
              raBacktest = undefined;
            }
          }
        } catch (err) {
          unavailable = `Repo Archaeology could not run: ${(err as Error).message.split('\n')[0]}`;
        }
      }
    }

    const remote = git(root, ['remote', 'get-url', 'origin'], { allowFail: true });
    const repoUrl = opts.repoUrl ?? browseUrlFromRemote(remote);

    return assembleBrief({
      base: opts.base,
      head,
      baseSha,
      headSha,
      title: opts.title,
      intent: opts.intent,
      repoUrl,
      prNumber: opts.prNumber,
      changes,
      commits,
      dependents,
      tests,
      raDiff,
      raBacktest,
      unavailable,
      noHistory,
      noCalibration,
      maxForgotten: mergedConfig.maxForgotten,
      config: mergedConfig,
      reader,
      now: opts.now,
    });
  } finally {
    if (ownReader) reader.close();
  }
}

/**
 * Replay a PR strictly as of `head` (with history trained on `base`),
 * using `GitTreeReader(headSha)` and Repo Archaeology's library API (`openRepository`).
 * Never checks out commits or falls back to `npx`.
 */
export async function replayBriefWithMeta(opts: ReplayBriefOptions): Promise<ReplayResult> {
  const root = repoRoot(opts.cwd);
  const head = opts.head ?? 'HEAD';
  const headSha = resolveSha(root, head);
  if (!headSha) throw new Error(`head ref "${head}" not found`);
  const baseSha = resolveSha(root, opts.base);
  const shallow = isShallowRepo(root);

  if (!baseSha) {
    if (shallow) {
      // Truncated/shallow clone where base commit is missing: return an unavailable brief.
      const reader = new GitTreeReader(root, headSha);
      try {
        const emptyChanges: ChangeStructure = {
          files: [],
          modules: [],
          totals: { files: 0, additions: 0, deletions: 0, modules: 0 },
        };
        const emptyDeps: DependentsLayer = {
          analyzers: ['ts-js-relative-imports'],
          entries: [],
          unchecked: [],
          coverage: 'full',
          unresolved: { count: 0, samples: [] },
          scannedFiles: 0,
        };
        const unavailable = 'Co-change history is unavailable in a shallow or truncated clone.';
        const brief = assembleBrief({
          base: opts.base,
          head,
          baseSha: headSha,
          headSha,
          title: opts.title,
          intent: opts.intent,
          repoUrl: opts.repoUrl,
          prNumber: opts.prNumber,
          changes: emptyChanges,
          commits: [],
          dependents: emptyDeps,
          tests: [],
          unavailable,
          noCalibration: Boolean(opts.noCalibration),
          reader,
          now: opts.now,
        });
        const ungatedBrief = assembleBrief({
          base: opts.base,
          head,
          baseSha: headSha,
          headSha,
          title: opts.title,
          intent: opts.intent,
          repoUrl: opts.repoUrl,
          prNumber: opts.prNumber,
          changes: emptyChanges,
          commits: [],
          dependents: emptyDeps,
          tests: [],
          unavailable,
          noCalibration: true,
          reader,
          now: opts.now,
        });
        return {
          brief,
          ungatedBrief,
          meta: {
            history: 'unavailable',
            timestampAnomaly: hasTimestampAnomaly(root, headSha),
            stageTimingsMs: { sessionOpen: 0, staticAnalysis: 0, brief: 0 },
          },
        };
      } finally {
        reader.close();
      }
    }
    throw new Error(`base ref "${opts.base}" not found`);
  }

  const reader = new GitTreeReader(root, headSha);
  try {
    const tStaticStart = performance.now();
    const { gutterConfig, raSettings: headRaSettings, raConfigValid } = readSnapshotAuxConfigs(reader);
    const mergedConfig: GutterConfig = {
      ...gutterConfig,
      ...opts.config,
      ...(opts.maxForgotten !== undefined ? { maxForgotten: opts.maxForgotten } : {}),
      ...(opts.noHistory !== undefined ? { noHistory: opts.noHistory } : {}),
      ...(opts.noCalibration !== undefined ? { noCalibration: opts.noCalibration } : {}),
    };

    const changes = readChanges(root, opts.base, headSha);
    const commits = headCommits(root, opts.base, headSha);
    const dependents = buildDependents(root, changes, reader);
    const tests = linkTests(root, changes, reader);
    const staticAnalysisMs = performance.now() - tStaticStart;

    let raDiff = opts.raDiff;
    let raBacktest: RaBacktest | undefined = opts.raBacktest ?? undefined;
    let unavailable: string | undefined;
    let historyStatus: 'available' | 'unavailable' = shallow ? 'unavailable' : 'available';
    let raVersion: string | undefined;
    let sessionOpenMs = 0;

    const noHistory = Boolean(mergedConfig.noHistory);
    const noCalibration = Boolean(mergedConfig.noCalibration);

    if (shallow && !opts.raDiff) {
      unavailable = 'Co-change history is unavailable in a shallow or truncated clone.';
      historyStatus = 'unavailable';
    } else if (!noHistory && !raDiff) {
      const raLib = await loadRaLibrary(opts.raLib);
      raVersion = raLib.version;
      const tSessionStart = performance.now();
      let repo;
      try {
        repo = await raLib.openRepository({
          cwd: root,
          head: headSha,
          base: opts.base,
          settings: opts.raSettings ?? {},
          useConfigFile: raConfigValid,
        });
      } catch {
        repo = await raLib.openRepository({
          cwd: root,
          head: headSha,
          base: opts.base,
          settings: opts.raSettings ?? {},
          useConfigFile: false,
        });
      }
      sessionOpenMs = performance.now() - tSessionStart;
      try {
        raDiff = await repo.diff({ base: opts.base, limit: 25 });
        if (raDiff.meta?.shallow) {
          historyStatus = 'unavailable';
          unavailable = 'Co-change history is unavailable in a shallow or truncated clone.';
          raDiff = undefined;
          raBacktest = undefined;
        } else if (opts.raBacktest === undefined && !noCalibration) {
          try {
            raBacktest = await repo.backtest();
          } catch {
            raBacktest = undefined;
          }
        }
      } finally {
        await repo.close();
      }
    }

    const tBriefStart = performance.now();
    const remote = git(root, ['remote', 'get-url', 'origin'], { allowFail: true });
    const repoUrl = opts.repoUrl ?? browseUrlFromRemote(remote);

    const brief = assembleBrief({
      base: opts.base,
      head,
      baseSha,
      headSha,
      title: opts.title,
      intent: opts.intent,
      repoUrl,
      prNumber: opts.prNumber,
      changes,
      commits,
      dependents,
      tests,
      raDiff,
      raBacktest,
      unavailable,
      noHistory,
      noCalibration,
      maxForgotten: mergedConfig.maxForgotten,
      config: mergedConfig,
      reader,
      now: opts.now,
    });

    const ungatedBrief = assembleBrief({
      base: opts.base,
      head,
      baseSha,
      headSha,
      title: opts.title,
      intent: opts.intent,
      repoUrl,
      prNumber: opts.prNumber,
      changes,
      commits,
      dependents,
      tests,
      raDiff,
      raBacktest: undefined,
      unavailable,
      noHistory,
      noCalibration: true,
      maxForgotten: mergedConfig.maxForgotten,
      config: { ...mergedConfig, noCalibration: true },
      reader,
      now: opts.now,
    });
    const briefMs = performance.now() - tBriefStart;

    return {
      brief,
      ungatedBrief,
      meta: {
        history: historyStatus,
        timestampAnomaly: hasTimestampAnomaly(root, headSha, baseSha),
        raDiff,
        raBacktest: raBacktest ?? null,
        raVersion,
        ...(headRaSettings ? { raSettings: headRaSettings } : {}),
        stageTimingsMs: {
          sessionOpen: sessionOpenMs,
          staticAnalysis: staticAnalysisMs,
          brief: briefMs,
        },
      },
    };
  } finally {
    reader.close();
  }
}

export async function replayBrief(opts: ReplayBriefOptions): Promise<GutterBrief> {
  const res = await replayBriefWithMeta(opts);
  return res.brief;
}

/** Normalize legacy schemaVersion: 1 briefs (`unresolvedAliases`) into `{ coverage, unresolved }`. */
export function normalizeBrief(brief: GutterBrief): GutterBrief {
  const deps = brief.dependents as GutterBrief['dependents'] & { unresolvedAliases?: number };
  const legacyCount = typeof deps.unresolvedAliases === 'number' ? deps.unresolvedAliases : 0;
  if (!deps.unresolved || typeof deps.unresolved.count !== 'number') {
    deps.unresolved = {
      count: legacyCount,
      samples: Array.isArray(deps.unresolved?.samples) ? deps.unresolved.samples : [],
    };
  } else if (!Array.isArray(deps.unresolved.samples)) {
    deps.unresolved.samples = [];
  }
  if (deps.coverage !== 'full' && deps.coverage !== 'partial') {
    deps.coverage = deps.unresolved.count > 0 ? 'partial' : 'full';
  }
  return brief;
}

/** Every checklist item must point at evidence that exists. Renderers call this. */
export function assertEvidenceResolves(brief: GutterBrief): void {
  normalizeBrief(brief);
  const ids = new Set<string>([
    ...brief.dependents.entries.map((e) => e.id),
    ...brief.forgotten.items.map((e) => e.id),
    ...brief.forgotten.families.map((e) => e.id),
    ...brief.tests.map((e) => e.id),
  ]);
  for (const c of brief.checklist) {
    for (const ref of c.evidence) {
      if (!ids.has(ref)) throw new Error(`checklist item ${c.id} cites missing evidence ${ref}`);
    }
  }
}
