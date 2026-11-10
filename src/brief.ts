import type { ChangeStructure, DependentsLayer, EngineInfo, GutterBrief, TestLink } from './contract.ts';
import { SCHEMA_VERSION } from './contract.ts';
import type { GutterConfig, SafeRaRepoConfig } from './config.ts';
import { inertLegacyKeys, inertLegacyWarning, readSnapshotAuxConfigs } from './config.ts';
import { browseUrlFromRemote, git, hasTimestampAnomaly, isShallowRepo, repoRoot, resolveSha } from './git.ts';
import { headCommits, readChanges } from './evidence/changes.ts';
import { buildDependents } from './evidence/imports.ts';
import { dependentsFromImportGraph } from './evidence/import-graph.ts';
import { attachTestHistory, linkTests } from './evidence/tests.ts';
import { buildChecklist, salienceOf } from './evidence/checklist.ts';
import type { SourceReader } from './source/reader.ts';
import { GitTreeReader, WorkingTreeReader } from './source/reader.ts';
import type { RaBacktest, RaDiff, RaRunner } from './sources/archaeology.ts';
import { detectRaFeatures, runBacktest, runDiff, toCalibration, toForgotten, trackRecordsByTarget } from './sources/archaeology.ts';
import type { LoadedRaLibrary, RaProgress } from './sources/archaeology-lib.ts';
import { analyzeWithLibrary, loadRaLibrary } from './sources/archaeology-lib.ts';
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
  /** Receives configuration warnings (for example legacy-only keys set without `legacyPredictions`). */
  warn?: (message: string) => void;
  /** Library path only: Repo Archaeology's structured progress (history load, model build). */
  onProgress?: (e: RaProgress) => void;
  /** Library path only: called with the number of Repo Archaeology history loads (always 1). */
  onSession?: (sessions: number) => void;
}

export type RaMode = 'library' | 'subprocess' | 'npx';

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
  /** GU-05: how Repo Archaeology ran, and which optional fields it produced (provenance). */
  raMode?: RaMode;
  raFeatures?: string[];
  /** GU-05: appended to `forgotten.note` (for example when Repo Archaeology ran through npx). */
  historyNote?: string;
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

  const engines: EngineInfo[] = [{ name: 'gutter', version: GUTTER_VERSION }];
  if (!noHistory && input.raDiff) {
    engines.push({
      name: 'repo-archaeology',
      version: input.raDiff.tool.version,
      ...(input.raMode ? { mode: input.raMode } : {}),
      ...(input.raFeatures ? { features: input.raFeatures } : {}),
    });
  }

  let unavailable = input.unavailable;
  if (noHistory && !unavailable) {
    unavailable = 'Co-change history was turned off for this run.';
  }

  const legacy = Boolean(mergedConfig.legacyPredictions);
  const forgottenLayer = toForgotten(noHistory ? undefined : input.raDiff, { maxItems: maxForgotten, maxEvidence: 5 }, unavailable);
  // GU-29: co-change history is context. `presentation` sits right after `status` so the legacy
  // object (no `presentation`) serializes exactly as before.
  if (input.historyNote) forgottenLayer.note = forgottenLayer.note ? `${forgottenLayer.note} ${input.historyNote}` : input.historyNote;
  const { status: historyStatus, ...historyRest } = forgottenLayer;
  const forgotten = legacy ? forgottenLayer : { status: historyStatus, presentation: 'context' as const, ...historyRest };
  const calibration = toCalibration(noHistory ? undefined : input.raBacktest, noCalibration);
  const checklist = buildChecklist({
    changes: input.changes,
    dependents: input.dependents,
    forgotten,
    tests: input.tests,
    calibration,
    config: mergedConfig,
    trackRecords: noHistory ? undefined : trackRecordsByTarget(input.raDiff),
  });
  const salience = salienceOf(input.changes, checklist, mergedConfig);
  // Built after the checklist and salience, from their output only: test history cannot change either.
  const tests = legacy ? input.tests : attachTestHistory(input.tests, forgotten);

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
    tests,
    checklist,
    calibration,
    provenance: {
      generatedAt: (input.now ?? new Date()).toISOString(),
      engines,
      deterministic: true,
    },
  };
}

interface PreparedBrief {
  root: string;
  head: string;
  baseSha: string;
  headSha: string;
  reader: SourceReader;
  ownReader: boolean;
  mergedConfig: GutterConfig;
  changes: ChangeStructure;
  commits: { sha: string; subject: string }[];
  tests: TestLink[];
  repoUrl?: string;
}

/** Everything a live brief needs before co-change history and dependents (shared by sync and async paths). */
function prepareBrief(opts: BriefOptions): PreparedBrief {
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
    const inert = inertLegacyKeys(mergedConfig);
    if (inert.length) opts.warn?.(inertLegacyWarning(inert));

    const changes = readChanges(root, opts.base, head);
    const commits = headCommits(root, opts.base, head);
    const tests = linkTests(root, changes, reader);
    const remote = git(root, ['remote', 'get-url', 'origin'], { allowFail: true });
    const repoUrl = opts.repoUrl ?? browseUrlFromRemote(remote);
    return { root, head, baseSha, headSha, reader, ownReader, mergedConfig, changes, commits, tests, ...(repoUrl ? { repoUrl } : {}) };
  } catch (err) {
    if (ownReader) reader.close();
    throw err;
  }
}

interface HistoryResult {
  raDiff?: RaDiff;
  raBacktest?: RaBacktest;
  unavailable?: string;
  mode?: RaMode;
  note?: string;
}

/** Shown when Repo Archaeology ran through npx, the last resort before "unavailable" (GU-05). */
export const NPX_NOTE =
  'Repo Archaeology ran through npx because the library is not installed; install repo-archaeology for a single-session analysis and import-graph dependents.';

/**
 * Fallback history (GU-05 steps 2-4): `GUTTER_RA_BIN` / `--ra-bin` subprocess, then `npx`, then unavailable.
 * The CLI analyzes the checked-out HEAD, so it only runs when `head` is what is checked out.
 */
function subprocessHistory(opts: BriefOptions, p: PreparedBrief): HistoryResult {
  const noHistory = Boolean(p.mergedConfig.noHistory);
  const noCalibration = Boolean(p.mergedConfig.noCalibration);
  const out: HistoryResult = { ...(opts.raDiff ? { raDiff: opts.raDiff } : {}), ...(opts.raBacktest ? { raBacktest: opts.raBacktest } : {}) };
  if (noHistory || opts.raDiff) return out;
  if (resolveSha(p.root, 'HEAD') !== p.headSha) {
    out.unavailable = `Co-change history needs ${p.head} checked out; it was skipped.`;
    return out;
  }
  const runner = opts.runner ?? {};
  const mode: RaMode = runner.bin ?? process.env.GUTTER_RA_BIN ? 'subprocess' : 'npx';
  try {
    out.raDiff = runDiff(p.root, opts.base, runner);
    out.mode = mode;
    if (mode === 'npx') {
      out.note = NPX_NOTE;
      opts.warn?.(NPX_NOTE);
    }
    if (!noCalibration && !out.raBacktest) {
      try {
        out.raBacktest = runBacktest(p.root, runner);
      } catch {
        out.raBacktest = undefined;
      }
    }
  } catch (err) {
    out.unavailable = `Repo Archaeology could not run: ${(err as Error).message.split('\n')[0]}`;
  }
  return out;
}

function assemblePrepared(opts: BriefOptions, p: PreparedBrief, dependents: DependentsLayer, h: HistoryResult, features: string[] = []): GutterBrief {
  return assembleBrief({
    base: opts.base,
    head: p.head,
    baseSha: p.baseSha,
    headSha: p.headSha,
    title: opts.title,
    intent: opts.intent,
    repoUrl: p.repoUrl,
    prNumber: opts.prNumber,
    changes: p.changes,
    commits: p.commits,
    dependents,
    tests: p.tests,
    raDiff: h.raDiff,
    raBacktest: h.raBacktest,
    unavailable: h.unavailable,
    noHistory: Boolean(p.mergedConfig.noHistory),
    noCalibration: Boolean(p.mergedConfig.noCalibration),
    maxForgotten: p.mergedConfig.maxForgotten,
    config: p.mergedConfig,
    reader: p.reader,
    now: opts.now,
    ...(h.mode ? { raMode: h.mode, raFeatures: [...new Set([...features, ...detectRaFeatures(h.raDiff, h.raBacktest)])].sort() } : {}),
    ...(h.note ? { historyNote: h.note } : {}),
  });
}

/**
 * Synchronous brief without the Repo Archaeology library: the interim relative-import scanner for
 * dependents, and co-change history through a subprocess (`--ra-bin` / `GUTTER_RA_BIN`) or `npx`.
 * The CLI and the Action use `buildBriefAsync`, which tries the library first.
 */
export function buildBrief(opts: BriefOptions): GutterBrief {
  const p = prepareBrief(opts);
  try {
    const dependents = buildDependents(p.root, p.changes, p.reader);
    return assemblePrepared(opts, p, dependents, subprocessHistory(opts, p));
  } finally {
    if (p.ownReader) p.reader.close();
  }
}

/**
 * The product path (CLI and Action), GU-05. Order of preference for Repo Archaeology:
 *  1. the library (`opts.raLib` path, `GUTTER_RA_LIB`, or the installed package): ONE session for diff,
 *     backtest and the import graph; dependents come from the import graph; head need not be checked out;
 *  2. `GUTTER_RA_BIN` / `--ra-bin` subprocess; 3. `npx` (with a note); 4. unavailable.
 * In 2-4, dependents come from the interim relative-import scanner. `noHistory` skips Repo Archaeology
 * entirely (an offline static run with the scanner).
 */
export async function buildBriefAsync(opts: BriefOptions & { raLib?: string | false }): Promise<GutterBrief> {
  const p = prepareBrief(opts);
  try {
    const noHistory = Boolean(p.mergedConfig.noHistory);
    let lib: LoadedRaLibrary | undefined;
    if (!noHistory && opts.raLib !== false) {
      try {
        lib = await loadRaLibrary(opts.raLib === undefined ? undefined : opts.raLib);
      } catch {
        lib = undefined;
      }
    }
    if (lib) {
      const headFiles = new Set(
        git(p.root, ['ls-tree', '-r', '-z', '--name-only', p.headSha]).split('\0').filter(Boolean),
      );
      try {
        const a = await analyzeWithLibrary(lib, {
          cwd: p.root,
          head: p.headSha,
          base: opts.base,
          changedFiles: p.changes.files.map((f) => f.path),
          headFiles,
          noCalibration: Boolean(p.mergedConfig.noCalibration) || Boolean(opts.raBacktest),
          skipDiff: Boolean(opts.raDiff),
          ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
        });
        opts.onSession?.(a.sessions);
        const dependents = a.graph ? dependentsFromImportGraph(p.changes, a.graph, a.repoGraph) : buildDependents(p.root, p.changes, p.reader);
        const raDiff = opts.raDiff ?? a.raDiff;
        const shallow = Boolean(raDiff?.meta?.shallow);
        const h: HistoryResult = {
          ...(raDiff && !shallow ? { raDiff } : {}),
          ...((opts.raBacktest ?? a.raBacktest) && !shallow ? { raBacktest: opts.raBacktest ?? a.raBacktest } : {}),
          ...(shallow ? { unavailable: 'Co-change history is unavailable in a shallow or truncated clone.' } : {}),
          mode: 'library',
        };
        return assemblePrepared(opts, p, dependents, h, a.graph ? ['importGraph'] : []);
      } catch (err) {
        opts.warn?.(`Repo Archaeology library failed (${(err as Error).message.split('\n')[0]}); falling back to the subprocess.`);
      }
    }
    const dependents = buildDependents(p.root, p.changes, p.reader);
    return assemblePrepared(opts, p, dependents, subprocessHistory(opts, p));
  } finally {
    if (p.ownReader) p.reader.close();
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
    // Dependents come from Repo Archaeology's import graph at this head when the session runs (GU-05);
    // the interim scanner is the fallback (no history, shallow clone, or an older library).
    let dependents: DependentsLayer | undefined;
    const tests = linkTests(root, changes, reader);
    const staticAnalysisMs = performance.now() - tStaticStart;

    let raDiff = opts.raDiff;
    let raBacktest: RaBacktest | undefined = opts.raBacktest ?? undefined;
    let unavailable: string | undefined;
    let historyStatus: 'available' | 'unavailable' = shallow ? 'unavailable' : 'available';
    let raVersion: string | undefined;
    let sessionOpenMs = 0;
    const raFeatures: string[] = [];

    const noHistory = Boolean(mergedConfig.noHistory);
    const noCalibration = Boolean(mergedConfig.noCalibration);

    if (shallow && !opts.raDiff) {
      unavailable = 'Co-change history is unavailable in a shallow or truncated clone.';
      historyStatus = 'unavailable';
    } else if (!noHistory) {
      // Bench replay requires the library (`RaLibUnavailableError` otherwise), unless a diff was supplied.
      let raLib: LoadedRaLibrary | undefined;
      if (raDiff) {
        try {
          raLib = await loadRaLibrary(opts.raLib);
        } catch {
          raLib = undefined;
        }
      } else {
        raLib = await loadRaLibrary(opts.raLib);
      }
      if (raLib) {
        raVersion = raLib.version;
        const tSessionStart = performance.now();
        // ONE session at this PR's head: diff, backtest and the import graph (nothing later is read).
        const a = await analyzeWithLibrary(raLib, {
          cwd: root,
          head: headSha,
          base: opts.base,
          changedFiles: changes.files.map((f) => f.path),
          headFiles: new Set(reader.listFiles()),
          settings: opts.raSettings ?? {},
          useConfigFile: raConfigValid,
          skipDiff: Boolean(raDiff),
          noCalibration: noCalibration || opts.raBacktest !== undefined,
        });
        sessionOpenMs = performance.now() - tSessionStart;
        if (a.graph) {
          dependents = dependentsFromImportGraph(changes, a.graph, a.repoGraph);
          raFeatures.push('importGraph');
        }
        if (!raDiff) {
          raDiff = a.raDiff;
          if (raDiff?.meta?.shallow) {
            historyStatus = 'unavailable';
            unavailable = 'Co-change history is unavailable in a shallow or truncated clone.';
            raDiff = undefined;
            raBacktest = undefined;
          } else if (opts.raBacktest === undefined && !noCalibration) {
            raBacktest = a.raBacktest;
          }
        }
      }
    }
    dependents ??= buildDependents(root, changes, reader);
    const raMode: RaMode | undefined = raVersion && raDiff ? 'library' : undefined;
    const provenance = raMode ? { raMode, raFeatures: [...new Set([...raFeatures, ...detectRaFeatures(raDiff, raBacktest)])].sort() } : {};

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
      ...provenance,
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
      ...provenance,
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
  // GU-29: a test-history fact must cite co-change items that exist too.
  for (const t of brief.tests) {
    for (const ref of t.history?.evidence ?? []) {
      if (!ids.has(ref)) throw new Error(`test link ${t.id} cites missing history evidence ${ref}`);
    }
  }
}
