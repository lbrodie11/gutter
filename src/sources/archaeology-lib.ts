import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RaBacktest, RaDiff } from './archaeology.ts';

/** First release with `openRepository` (RA-03) and the import resolver behind `importGraph` (RA-09). */
export const MIN_RA_LIB_VERSION = '0.4.0';

export class RaLibUnavailableError extends Error {
  readonly exitCode = 2;
  constructor(detail?: string) {
    const suffix = detail ? ` (${detail})` : '';
    super(`error: gutter bench requires local library repo-archaeology >= ${MIN_RA_LIB_VERSION}${suffix}; install repo-archaeology@^0.4.0 or pass --ra-lib <path>`);
    this.name = 'RaLibUnavailableError';
  }
}

export interface RaRepositorySession {
  readonly root: string;
  readonly headSha: string;
  readonly mergeBaseSha?: string;
  diff(opts?: {
    limit?: number;
    base?: string;
    applyBranchVerdicts?: boolean;
    owners?: boolean;
  }): Promise<RaDiff>;
  backtest(opts?: {
    testFraction?: number;
    k?: number;
    before?: string | number;
    ghosts?: boolean;
    followUps?: boolean;
    followUpWindowHours?: number;
  }): Promise<RaBacktest>;
  /** RA-09 (>= 0.4.0): internal import graph; `files` limits `from` to them plus their reverse importers. */
  importGraph?(opts?: { files?: string[] }): Promise<RaImportGraph>;
  close(): Promise<void>;
}

/** `schema/import-graph.schema.json` (v1). `via`, `reasonCode` and `languages` may grow: tolerate unknown values. */
export interface RaImportGraph {
  schemaVersion: 1;
  tool: { name: string; version: string };
  meta: { imports?: { unresolvedByReason?: Record<string, number> } & Record<string, unknown>; warnings?: string[] } & Record<string, unknown>;
  files: string[];
  edges: { from: string; to: string; specifier: string; kind: string; via?: string; heuristic?: boolean }[];
  unresolved: { from: string; specifier: string; reason: string; reasonCode?: string }[];
  languages: string[];
}

export interface RaProgress { phase: string; done?: number; total?: number }

export interface RaLibraryModule {
  openRepository(opts: {
    cwd: string;
    head?: string;
    base?: string;
    settings?: Record<string, unknown>;
    useConfigFile?: boolean;
    onProgress?: (e: RaProgress) => void;
  }): Promise<RaRepositorySession>;
  version?: string;
}

export interface LoadedRaLibrary {
  openRepository: RaLibraryModule['openRepository'];
  version: string;
}

export function isVersionAtLeast(actual: string, minimum: string): boolean {
  const parse = (v: string): [number, number, number] | null => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const a = parse(actual);
  const b = parse(minimum);
  if (!a || !b) return false;
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] >= b[2];
}

function findNearestPackageVersion(startPath: string): string | undefined {
  let dir = statSync(startPath, { throwIfNoEntry: false })?.isDirectory() ? startPath : dirname(startPath);
  for (let i = 0; i < 5; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string };
        if (pkg.name === 'repo-archaeology' && typeof pkg.version === 'string') {
          return pkg.version;
        }
      } catch {
        // continue walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Load `repo-archaeology` >= 0.4.0 strictly from a local library (`import()` or `--ra-lib <path>`).
 * Never spawns `npx` or performs any network access.
 */
export async function loadRaLibrary(raLibPath?: string): Promise<LoadedRaLibrary> {
  const spec = raLibPath ?? process.env.GUTTER_RA_LIB;
  let mod: Record<string, unknown>;
  let detectedVersion: string | undefined;

  if (spec) {
    const abs = resolve(spec);
    if (!existsSync(abs)) {
      throw new RaLibUnavailableError(`--ra-lib path not found: ${spec}`);
    }
    let entryPath = abs;
    const st = statSync(abs);
    if (st.isDirectory()) {
      const pkgPath = join(abs, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string; main?: string; exports?: unknown };
          if (typeof pkg.version === 'string') detectedVersion = pkg.version;
        } catch {
          // ignore
        }
      }
      const distApi = join(abs, 'dist', 'api', 'index.js');
      const distIndex = join(abs, 'dist', 'index.js');
      if (existsSync(distApi)) entryPath = distApi;
      else if (existsSync(distIndex)) entryPath = distIndex;
      else throw new RaLibUnavailableError(`no entry point found in directory ${spec}`);
    } else {
      detectedVersion = findNearestPackageVersion(abs);
    }
    try {
      mod = (await import(pathToFileURL(entryPath).href)) as Record<string, unknown>;
    } catch (err) {
      throw new RaLibUnavailableError(`failed to import ${spec}: ${(err as Error).message.split('\n')[0]}`);
    }
  } else {
    try {
      const req = createRequire(import.meta.url);
      const resolvedEntry = req.resolve('repo-archaeology');
      detectedVersion = findNearestPackageVersion(resolvedEntry);
      mod = (await import(pathToFileURL(resolvedEntry).href)) as Record<string, unknown>;
    } catch {
      throw new RaLibUnavailableError('package repo-archaeology is not installed locally');
    }
  }

  if (typeof mod.version === 'string') {
    detectedVersion = mod.version;
  }
  if (typeof mod.openRepository !== 'function') {
    throw new RaLibUnavailableError(
      detectedVersion
        ? `found repo-archaeology@${detectedVersion} without openRepository()`
        : 'module does not export openRepository()',
    );
  }
  const finalVersion = detectedVersion ?? MIN_RA_LIB_VERSION;
  if (!isVersionAtLeast(finalVersion, MIN_RA_LIB_VERSION)) {
    throw new RaLibUnavailableError(`found repo-archaeology@${finalVersion}`);
  }

  return {
    openRepository: mod.openRepository as RaLibraryModule['openRepository'],
    version: finalVersion,
  };
}

export interface LibraryAnalysis {
  raDiff?: RaDiff;
  raBacktest?: RaBacktest;
  /** `importGraph({ files })`: the changed files present at head plus every file importing them. */
  graph?: RaImportGraph;
  /** `importGraph()` unfiltered, read from the same session's index: repo-wide `unresolved` (coverage, dangling imports). */
  repoGraph?: RaImportGraph;
  /**
   * GU-31: the import graph at the PR's base tree, only when the PR removes files (deleted or renamed away):
   * `importGraph({ files: removed })` from a second, history-light session opened at `baseTree`. Undefined
   * when nothing was removed, or when the base session failed (dependents then use the relative fallback).
   */
  baseGraph?: RaImportGraph;
  /** GU-31: wall time of the base graph (session open + `importGraph`), 0 when none was built or it came from the cache. */
  baseGraphMs: number;
  /** History loads in this analysis: 1 for the head session, plus 1 when the base graph opened its own session. */
  sessions: number;
}

/** GU-31, bench only: base graphs per base tree within one run (seeded mutations share their host). */
export type BaseGraphCache = Map<string, Promise<RaImportGraph | undefined>>;
/** Base graphs a bench run keeps at once (insertion order; the oldest is dropped). */
export const BASE_GRAPH_CACHE_MAX = 8;
const baseGraphKey = (cwd: string, baseTree: string, settings: Record<string, unknown> | undefined) =>
  `${cwd}\0${baseTree}\0${JSON.stringify(settings ?? {})}`;

/**
 * GU-31: the import graph at `baseTree` for the importers of `removed`. A second `openRepository` session at
 * the base tree with the head session's explicit settings, `useConfigFile: false` (the PR's config file never
 * applies), `maxCommits: 1` and the history cache off: the import graph reads the tree, not history, so loading
 * one commit is the cheapest session the API allows. Repo Archaeology indexes the whole tree either way; `files` only scopes
 * the result to the removed files and their reverse importers. With `cache`, the unscoped graph is kept per
 * base tree and settings, so several PRs on one base share it.
 */
export async function baseImportGraph(
  lib: LoadedRaLibrary,
  opts: { cwd: string; baseTree: string; removed: readonly string[]; settings?: Record<string, unknown>; cache?: BaseGraphCache },
): Promise<RaImportGraph | undefined> {
  const build = async (files: string[] | undefined): Promise<RaImportGraph | undefined> => {
    const repo = await lib.openRepository({
      cwd: opts.cwd,
      head: opts.baseTree,
      // One commit and no history cache: the base session reads the tree only and never writes under .git.
      settings: { ...(opts.settings ?? {}), maxCommits: 1, cache: { ...((opts.settings?.cache as Record<string, unknown> | undefined) ?? {}), enabled: false } },
      useConfigFile: false,
    });
    try {
      if (typeof repo.importGraph !== 'function') return undefined;
      return await repo.importGraph(files ? { files } : undefined);
    } finally {
      await repo.close();
    }
  };
  if (!opts.cache) return build([...opts.removed]);
  const key = baseGraphKey(opts.cwd, opts.baseTree, opts.settings);
  let hit = opts.cache.get(key);
  if (!hit) {
    hit = build(undefined).catch(() => undefined);
    opts.cache.set(key, hit);
    // Bounded: real PRs rarely share a base, so only the most recent trees are worth their memory.
    while (opts.cache.size > BASE_GRAPH_CACHE_MAX) opts.cache.delete(opts.cache.keys().next().value!);
  }
  return hit;
}

/**
 * GU-05: everything Gutter needs from Repo Archaeology in ONE session (one history load): `diff`, `backtest`
 * (unless `noCalibration`), and the import graph for the changed files. `close()` always runs.
 * The session is opened at `head`, so nothing after that commit is read (bench replay relies on this).
 */
export async function analyzeWithLibrary(
  lib: LoadedRaLibrary,
  opts: {
    cwd: string;
    head: string;
    base: string;
    /** Changed paths; those missing at head (deleted, renamed away) are not passed to `importGraph`. */
    changedFiles: readonly string[];
    headFiles: ReadonlySet<string>;
    noHistory?: boolean;
    noCalibration?: boolean;
    settings?: Record<string, unknown>;
    useConfigFile?: boolean;
    onProgress?: (e: RaProgress) => void;
    /** Skip `diff` when the caller already has one (CLI `--ra-diff`); the graph still comes from this session. */
    skipDiff?: boolean;
    skipBacktest?: boolean;
    /** GU-31: paths present at `baseTree` and missing at head (deleted, renamed away). Non-empty builds the base graph. */
    removedFiles?: readonly string[];
    /** GU-31: the tree the PR's diff starts from (`git merge-base base head`). Required for the base graph. */
    baseTree?: string;
    /** GU-31, bench only: reuse base graphs across PRs on the same base tree. */
    baseGraphCache?: BaseGraphCache;
  },
): Promise<LibraryAnalysis> {
  const open = (useConfigFile: boolean | undefined) =>
    lib.openRepository({
      cwd: opts.cwd,
      head: opts.head,
      base: opts.base,
      ...(opts.settings ? { settings: opts.settings } : {}),
      ...(useConfigFile !== undefined ? { useConfigFile } : {}),
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
    });
  let repo: RaRepositorySession;
  try {
    repo = await open(opts.useConfigFile);
  } catch (err) {
    // An invalid .repo-archaeology.json must not cost the whole analysis: retry once without it.
    if (opts.useConfigFile === false) throw err;
    repo = await open(false);
  }
  const out: LibraryAnalysis = { sessions: 1, baseGraphMs: 0 };
  try {
    if (!opts.noHistory && !opts.skipDiff) {
      // `base` as the CLI's `diff --base` and the pre-GU-05 replay passed it, so results stay identical.
      out.raDiff = await repo.diff({ base: opts.base, limit: 25 });
    }
    if (!opts.noHistory && !opts.noCalibration && !opts.skipBacktest && !out.raDiff?.meta?.shallow) {
      try {
        out.raBacktest = await repo.backtest();
      } catch {
        out.raBacktest = undefined;
      }
    }
    if (typeof repo.importGraph === 'function') {
      const files = opts.changedFiles.filter((f) => opts.headFiles.has(f));
      try {
        out.graph = await repo.importGraph({ files });
        out.repoGraph = await repo.importGraph();
      } catch {
        out.graph = undefined;
        out.repoGraph = undefined;
      }
    }
    // GU-31: only a PR that removes a path needs to know who imported it at base.
    const removed = opts.removedFiles ?? [];
    if (out.graph && removed.length > 0 && opts.baseTree) {
      const t0 = performance.now();
      const cached = opts.baseGraphCache?.has(baseGraphKey(opts.cwd, opts.baseTree, opts.settings)) ?? false;
      try {
        out.baseGraph = await baseImportGraph(lib, {
          cwd: opts.cwd,
          baseTree: opts.baseTree,
          removed,
          ...(opts.settings ? { settings: opts.settings } : {}),
          ...(opts.baseGraphCache ? { cache: opts.baseGraphCache } : {}),
        });
      } catch {
        out.baseGraph = undefined;
      }
      if (!cached) {
        out.baseGraphMs = performance.now() - t0;
        out.sessions++;
      }
    }
    return out;
  } finally {
    await repo.close();
  }
}
