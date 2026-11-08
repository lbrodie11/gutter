import { existsSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, posix } from 'node:path';
import { git } from '../git.ts';
import type { ChangeStructure, DependentsEntry, DependentsLayer } from '../contract.ts';

/**
 * Static dependents for TS/JS via relative-import scanning.
 *
 * Deliberately small and honest: it resolves relative specifiers only (no
 * tsconfig paths / package exports yet). Non-relative specifiers that are not
 * Node built-ins or declared external packages in the nearest `package.json`
 * mark `dependents.coverage` as `'partial'` with sample `<file> → <specifier>`
 * receipts. Changed files in languages without an analyzer are listed as
 * `unchecked`, never as "no dependents".
 */

const SCRIPT_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const RESOLVE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const SPECIFIER = /(?:import|export)(?:\s+|\s*(?=[{*]))[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const ALIAS_SPECIFIER = /^(?:@\/|~~?\/|#|\$lib\/)/;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 25_000;
const MAX_UNRESOLVED_SAMPLES = 5;

const BUILTINS = new Set<string>(
  builtinModules.flatMap((m) => (m.startsWith('node:') ? [m, m.slice(5)] : [m, `node:${m}`])),
);

export function extractSpecifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(SPECIFIER)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (spec) out.push(spec);
  }
  return out;
}

/** True when `spec` looks like an internal path alias / subpath import rather than an npm package or relative path. */
export function isAliasSpecifier(spec: string, customPrefixes: readonly string[] = []): boolean {
  if (spec.startsWith('.')) return false;
  if (ALIAS_SPECIFIER.test(spec)) return true;
  return customPrefixes.some((p) => (p.endsWith('/') ? spec.startsWith(p) : spec === p || spec.startsWith(`${p}/`)));
}

/** Read custom path-alias prefixes from tsconfig/jsconfig `compilerOptions.paths`, if present. */
export function readTsconfigAliasPrefixes(root: string): string[] {
  const prefixes = new Set<string>();
  for (const name of ['tsconfig.json', 'tsconfig.base.json', 'jsconfig.json']) {
    const abs = join(root, name);
    if (!existsSync(abs)) continue;
    try {
      const st = statSync(abs);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      const raw = readFileSync(abs, 'utf8');
      const pathsBlock = /"paths"\s*:\s*\{([\s\S]*?)\}/.exec(raw)?.[1];
      if (!pathsBlock) continue;
      for (const m of pathsBlock.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
        const key = m[1]?.replace(/\*+$/, '').trim();
        if (key && !key.startsWith('.')) prefixes.add(key);
      }
    } catch {
      // Malformed or unreadable config: fall back to standard alias conventions.
    }
  }
  return [...prefixes];
}

/** Extract the npm package name (`react` or `@scope/pkg`) from a bare specifier, or undefined if not a valid package specifier. */
export function extractPackageName(spec: string): string | undefined {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('#') || spec.startsWith('~')) {
    return undefined;
  }
  if (spec.startsWith('@')) {
    const m = /^(@[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)(?:\/.*)?$/.exec(spec);
    return m?.[1];
  }
  const m = /^([a-zA-Z0-9._-]+)(?:\/.*)?$/.exec(spec);
  return m?.[1];
}

/** Classify a non-relative specifier as `'external'` (Node builtin or declared package) or `'unresolved'`. */
export function classifyNonRelativeSpecifier(
  spec: string,
  declaredPackages: ReadonlySet<string>,
  aliasPrefixes: readonly string[] = [],
): 'external' | 'unresolved' {
  if (spec.startsWith('node:') || BUILTINS.has(spec)) return 'external';
  const pkg = extractPackageName(spec);
  if (pkg && BUILTINS.has(pkg)) return 'external';
  if (isAliasSpecifier(spec, aliasPrefixes)) return 'unresolved';
  if (pkg && declaredPackages.has(pkg)) return 'external';
  return 'unresolved';
}

function readPackageJsonDeps(pkgJsonPath: string, localPackageNames: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  try {
    const st = statSync(pkgJsonPath);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) return out;
    const parsed = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const section = parsed[field];
      if (section && typeof section === 'object' && !Array.isArray(section)) {
        for (const [name, range] of Object.entries(section as Record<string, unknown>)) {
          // Workspace packages (whether via workspace:/link:/file: or local package.json names) cannot be resolved statically yet.
          if (localPackageNames.has(name)) continue;
          if (typeof range === 'string' && /^(?:workspace|link|file):/.test(range.trim())) continue;
          out.add(name);
        }
      }
    }
  } catch {
    // Ignore unreadable or malformed package.json
  }
  return out;
}

/** Collect `"name"` fields from all tracked `package.json` files in the repo so workspace/self imports classify as `'unresolved'`. */
function readRepoLocalPackageNames(root: string, trackedAll: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const rel of trackedAll) {
    if (rel !== 'package.json' && !rel.endsWith('/package.json')) continue;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    try {
      const st = statSync(abs);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      const parsed = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        names.add(parsed.name.trim());
      }
    } catch {
      // Ignore malformed package.json
    }
  }
  return names;
}

/** Find declared external packages from the nearest `package.json` walking up from `relFile` to `root`. */
function createNearestPackagesLookup(root: string, localPackageNames: ReadonlySet<string>): (relFile: string) => ReadonlySet<string> {
  const dirCache = new Map<string, ReadonlySet<string>>();
  const pkgFileCache = new Map<string, ReadonlySet<string>>();

  const lookupDir = (relDir: string): ReadonlySet<string> => {
    const cached = dirCache.get(relDir);
    if (cached) return cached;

    const candidate = relDir === '.' || relDir === '' ? join(root, 'package.json') : join(root, relDir, 'package.json');
    if (existsSync(candidate)) {
      let pkgDeps = pkgFileCache.get(candidate);
      if (!pkgDeps) {
        pkgDeps = readPackageJsonDeps(candidate, localPackageNames);
        pkgFileCache.set(candidate, pkgDeps);
      }
      dirCache.set(relDir, pkgDeps);
      return pkgDeps;
    }

    if (relDir === '.' || relDir === '') {
      const empty = new Set<string>();
      dirCache.set(relDir, empty);
      return empty;
    }

    const parent = posix.dirname(relDir);
    const parentResult = lookupDir(parent === relDir ? '.' : parent);
    dirCache.set(relDir, parentResult);
    return parentResult;
  };

  return (relFile: string) => lookupDir(posix.dirname(relFile));
}

/** Resolve a relative specifier from `fromFile` against a set of known repo files. */
export function resolveRelative(fromFile: string, spec: string, known: Set<string>, deleted: Set<string>): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const has = (p: string) => known.has(p) || deleted.has(p);
  if (SCRIPT_EXT.test(base) && has(base)) return base;
  // TS ESM convention: "./a.js" in source refers to "./a.ts"
  const stripped = base.replace(/\.(js|jsx|mjs|cjs)$/, '');
  for (const ext of RESOLVE_EXTS) if (has(stripped + ext)) return stripped + ext;
  for (const ext of RESOLVE_EXTS) {
    const idx = posix.join(base, `index${ext}`);
    if (has(idx)) return idx;
  }
  return undefined;
}

export function buildDependents(root: string, changes: ChangeStructure): DependentsLayer {
  const trackedAll = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  const tracked = trackedAll.filter((p) => SCRIPT_EXT.test(p));
  const known = new Set(tracked);
  const changedPaths = new Set(changes.files.map((f) => f.path));
  const deleted = new Set(changes.files.filter((f) => f.status === 'deleted').map((f) => f.path));
  const targets = changes.files.filter((f) => SCRIPT_EXT.test(f.path));
  const aliasPrefixes = readTsconfigAliasPrefixes(root);
  const localPackageNames = readRepoLocalPackageNames(root, trackedAll);
  const nearestPackages = createNearestPackagesLookup(root, localPackageNames);

  const importersOf = new Map<string, Set<string>>();
  for (const t of targets) importersOf.set(t.path, new Set());
  // A renamed file's old path no longer exists: anything still importing it is broken.
  for (const f of changes.files) if (f.oldPath && SCRIPT_EXT.test(f.oldPath)) {
    deleted.add(f.oldPath);
    importersOf.set(f.oldPath, new Set());
  }

  let scanned = 0;
  let unresolvedCount = 0;
  const unresolvedSamples = new Set<string>();

  if (importersOf.size > 0) {
    for (const file of tracked.slice(0, MAX_FILES)) {
      const abs = join(root, file);
      if (!existsSync(abs)) continue;
      const st = statSync(abs);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      scanned++;
      const src = readFileSync(abs, 'utf8');
      const declaredPackages = nearestPackages(file);
      for (const spec of extractSpecifiers(src)) {
        if (spec.startsWith('.')) {
          const hit = resolveRelative(file, spec, known, deleted);
          if (hit && hit !== file) {
            importersOf.get(hit)?.add(file);
          }
          continue;
        }
        if (classifyNonRelativeSpecifier(spec, declaredPackages, aliasPrefixes) === 'unresolved') {
          unresolvedCount++;
          unresolvedSamples.add(`${file} → ${spec}`);
        }
      }
    }
  }

  const entries: DependentsEntry[] = [];
  for (const [file, importers] of importersOf) {
    const list = [...importers].sort();
    const isDeleted = deleted.has(file);
    const entry: DependentsEntry = {
      id: `deps:${file}`,
      file,
      deleted: isDeleted,
      changedImporters: list.filter((p) => changedPaths.has(p)),
      untouchedImporters: list.filter((p) => !changedPaths.has(p)),
    };
    if (entry.changedImporters.length + entry.untouchedImporters.length > 0) entries.push(entry);
  }
  entries.sort((a, b) => Number(b.deleted) - Number(a.deleted) || b.untouchedImporters.length - a.untouchedImporters.length);

  const unchecked = changes.files
    .filter((f) => !SCRIPT_EXT.test(f.path) && f.language !== null && !['markdown', 'json', 'yaml', 'toml'].includes(f.language))
    .map((f) => f.path);

  const samples = [...unresolvedSamples].sort().slice(0, MAX_UNRESOLVED_SAMPLES);

  return {
    analyzers: ['ts-js-relative-imports'],
    entries,
    unchecked,
    coverage: unresolvedCount > 0 ? 'partial' : 'full',
    unresolved: {
      count: unresolvedCount,
      samples,
    },
    scannedFiles: scanned,
  };
}
