import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RaBacktest, RaDiff } from './archaeology.ts';

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
  close(): Promise<void>;
}

export interface RaLibraryModule {
  openRepository(opts: {
    cwd: string;
    head?: string;
    base?: string;
    settings?: Record<string, unknown>;
    useConfigFile?: boolean;
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
