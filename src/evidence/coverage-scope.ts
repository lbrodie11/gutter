import { posix } from 'node:path';
import type { ChangeStructure } from '../contract.ts';
import type { SourceReader } from '../source/reader.ts';
import { MAX_FILE_BYTES } from '../source/reader.ts';
import { extractPackageName } from './imports.ts';

/**
 * GU-32, DECISIONS #21: which unresolved imports could reach this PR's files.
 *
 * `dependents.coverage` used to be `partial` whenever any import anywhere in the repository was unresolved
 * (GU-05). Most of those can never point at the PR's files: a third-party package that is not installed, a
 * built `dist/` entry of another workspace package, a relative path into `node_modules`. An unresolved import
 * `{ from, specifier, reasonCode }` is *relevant* when it could resolve to one of the PR's changed or removed
 * files (a "target"). The rule, by the importer's language (its extension):
 *
 * TS/JS (and anything that is neither Go nor Python), against targets that are not Go or Python files:
 *  - relative (`./x`, `../x`): the path, normalized from the importer's directory, names the target (with or
 *    without an extension) or the target's directory; or it names a directory with its own `package.json` and the
 *    target is an entry-like file in that package (`index`, `main`, `mod`), since `main`/`exports` may point there.
 *  - `unknown-package` (a bare name Repo Archaeology found in no workspace and no dependency list): relevant when
 *    a `package.json` at or above the target is named that package. When no name is known for the target, or
 *    the target was removed (its `package.json` may be gone too), also when the unscoped name is one of the
 *    target's directories, or a subpath's last segment matches the target (below).
 *  - every other reason (`alias-unmatched`, `target-missing`, `not-exported`, `invalid-target`,
 *    `ambiguous-package`, `unsupported-config`) and any code Gutter does not know: relevant when the specifier's
 *    last path segment matches the target's stem or its directory's name (an `index` segment must also match
 *    the directory before it); or when a bare package with no subpath is the target's package (named, or by
 *    directory); `unsupported-config` with a non-package specifier (an unreadable `tsconfig`) is also relevant
 *    for every target in the importer's package, where resolution is unknowable.
 * Go (`.go` importers, `.go` targets): the import path's last segment (a `/vN` suffix dropped) matches the last
 *  segment of the target package's import path (its directory's name; at a module root, the module path's).
 *  At a module root whose module path Gutter could not read, every import is relevant.
 * Python (`.py`/`.pyi` importers and targets): a relative specifier resolves from the importer's package, and
 *  is relevant when that module and the target's are on one path (one a prefix of the other). An absolute
 *  specifier is relevant when it is on one path with the target's module under any source root (any suffix of
 *  the target's path), because the source roots are not known.
 * An import with no `reasonCode` (an older Repo Archaeology) is relevant to every target: when in doubt, relevant.
 */
export interface ScopeTarget {
  /** A changed path, or a removed one (deleted, or a rename's old path). */
  path: string;
  removed: boolean;
  /** `name` of each `package.json` at or above the target's directory, nearest first (read at head). */
  packageNames?: string[];
  /** Directory of the nearest `package.json` at or above the target ('' for the root, also when none exists). */
  packageDir?: string;
  /** Nearest `go.mod` at or above the target: its directory and module path ('' when it has no module line). */
  goModule?: { dir: string; path: string };
}

export interface UnresolvedImport {
  from: string;
  specifier: string;
  reasonCode?: string;
}

type Lang = 'ts' | 'go' | 'python';
const langOf = (p: string): Lang => (/\.go$/.test(p) ? 'go' : /\.pyi?$/.test(p) ? 'python' : 'ts');

/** Targets an unresolved import could reach (paths, in `targets` order); empty when it is not relevant. */
export function relevantTargets(u: UnresolvedImport, targets: readonly ScopeTarget[]): string[] {
  const lang = langOf(u.from);
  const out: string[] = [];
  for (const t of targets) {
    if (langOf(t.path) !== lang) continue;
    if (u.reasonCode === undefined || reaches(lang, u, t)) out.push(t.path);
  }
  return out;
}

function reaches(lang: Lang, u: UnresolvedImport, t: ScopeTarget): boolean {
  if (lang === 'go') return goReaches(u.specifier, t);
  if (lang === 'python') return pythonReaches(u.from, u.specifier, t);
  return tsReaches(u, t);
}

// ---- TS/JS -----------------------------------------------------------------------------------

const stripOneExt = (s: string) => {
  const m = /^(.+)\.[A-Za-z0-9]+$/.exec(s);
  return m ? m[1]! : s;
};
/** `a/b.ts` → stem `b`; `.d.ts` declarations drop the `.d` too. */
const stemOf = (p: string) => {
  const s = stripOneExt(posix.basename(p));
  return s.endsWith('.d') ? s.slice(0, -2) : s;
};
const dirName = (p: string) => {
  const d = posix.dirname(p);
  return d === '.' ? '' : d;
};
/** Drops a bundler query (`./x.svg?raw`) and trailing slashes. */
/** Stems a package entry (`main`, `exports['.']`) usually has. */
const ENTRY_STEMS: ReadonlySet<string> = new Set(['index', 'main', 'mod']);
const cleanSpecifier = (s: string) => s.replace(/\?.*$/, '').replace(/\/+$/, '');

/** `@scope/name` or `name` and the rest, for a bare package specifier; undefined for aliases and paths. */
export function barePackage(spec: string): { name: string; sub: string } | undefined {
  const name = extractPackageName(spec);
  return name === undefined ? undefined : { name, sub: spec.slice(name.length + 1) };
}

/** The specifier's last path segment names the target, or the target's directory. */
function segmentMatches(spec: string, t: ScopeTarget): boolean {
  const segs = spec.split('/').filter(Boolean);
  const last = segs[segs.length - 1];
  if (!last) return false;
  const keys = new Set([last, stripOneExt(last)]);
  const dir = dirName(t.path);
  const dirBase = posix.basename(dir);
  if (keys.has('index')) {
    const prev = segs[segs.length - 2];
    return stemOf(t.path) === 'index' && (prev === undefined || prev === dirBase);
  }
  return keys.has(stemOf(t.path)) || keys.has(posix.basename(t.path)) || (dirBase !== '' && keys.has(dirBase));
}

const dirSegments = (p: string) => dirName(p).split('/').filter(Boolean);
const unscoped = (name: string) => name.slice(name.indexOf('/') + 1);

function tsReaches(u: UnresolvedImport, t: ScopeTarget): boolean {
  const spec = cleanSpecifier(u.specifier);
  if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
    const base = posix.normalize(posix.join(dirName(u.from), spec));
    const norm = base === '.' ? '' : base;
    if (dirName(t.path) === norm) return true;
    // A directory with its own package.json resolves through `main`/`exports` to an entry file anywhere in it.
    if (t.packageDir === norm && (norm === '' || t.path.startsWith(`${norm}/`)) && ENTRY_STEMS.has(stemOf(t.path))) return true;
    const leaf = posix.basename(norm);
    return dirName(t.path) === dirName(norm) && [leaf, stripOneExt(leaf)].some((k) => k === posix.basename(t.path) || k === stemOf(t.path) || k === stripOneExt(posix.basename(t.path)));
  }
  const pkg = barePackage(spec);
  const named = t.packageNames ?? [];
  const nameKnown = named.length > 0 && !t.removed;
  const inPackage = pkg !== undefined && named.includes(pkg.name);
  const byDirectory = pkg !== undefined && dirSegments(t.path).includes(unscoped(pkg.name));
  if (u.reasonCode === 'unknown-package') {
    if (!pkg) return segmentMatches(spec, t);
    if (inPackage) return true;
    if (nameKnown) return false;
    return byDirectory || (pkg.sub !== '' && segmentMatches(pkg.sub, t));
  }
  if (segmentMatches(spec, t)) return true;
  if (pkg && pkg.sub === '' && (inPackage || byDirectory)) return true;
  if (u.reasonCode === 'unsupported-config' && !pkg) {
    const scope = t.packageDir ?? '';
    return scope === '' || u.from.startsWith(`${scope}/`);
  }
  return false;
}

// ---- Go --------------------------------------------------------------------------------------

const lastGoSegment = (importPath: string): string => {
  const segs = importPath.split('/').filter(Boolean);
  if (segs.length > 1 && /^v\d+$/.test(segs[segs.length - 1]!)) segs.pop();
  return segs[segs.length - 1] ?? '';
};

function goReaches(spec: string, t: ScopeTarget): boolean {
  const dir = dirName(t.path);
  const mod = t.goModule;
  // At a module root the import path is the module path; a go.mod with no module line makes it unknowable.
  if (mod && dir === mod.dir) return !mod.path || lastGoSegment(spec) === lastGoSegment(mod.path);
  if (dir === '' && !mod) return true;
  return lastGoSegment(spec) === posix.basename(dir);
}

// ---- Python ----------------------------------------------------------------------------------

/** `a/b/c.py` → [a, b, c]; `a/b/__init__.py` → [a, b]. */
function moduleParts(p: string): string[] {
  const parts = p.replace(/\.pyi?$/, '').split('/').filter(Boolean);
  if (parts[parts.length - 1] === '__init__') parts.pop();
  return parts;
}
/** One is a prefix of the other (a module, a package on its path, or a submodule of it). */
const onOnePath = (a: readonly string[], b: readonly string[]) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
};

function pythonReaches(from: string, spec: string, t: ScopeTarget): boolean {
  const target = moduleParts(t.path);
  const dots = /^\.*/.exec(spec)![0].length;
  const named = spec.slice(dots).split('.').filter(Boolean);
  if (dots > 0) {
    let pkg = dirName(from);
    for (let i = 1; i < dots; i++) pkg = dirName(pkg);
    return onOnePath([...pkg.split('/').filter(Boolean), ...named], target);
  }
  if (named.length === 0) return false;
  for (let k = 0; k < target.length; k++) if (onOnePath(named, target.slice(k))) return true;
  return false;
}

// ---- Targets and their package context -------------------------------------------------------

/**
 * The PR's changed and removed paths, with the `package.json` names and `go.mod` module each sits under, read
 * from `reader` (the head tree). Without a reader, targets carry no package context (the rule then falls back
 * to directory names, which is more often relevant, never less).
 */
export function scopeTargets(changes: ChangeStructure, reader?: SourceReader): ScopeTarget[] {
  const out = new Map<string, ScopeTarget>();
  for (const f of changes.files) {
    out.set(f.path, { path: f.path, removed: f.status === 'deleted' });
    if (f.oldPath && !out.has(f.oldPath)) out.set(f.oldPath, { path: f.oldPath, removed: true });
  }
  if (!reader) return [...out.values()];
  const pkgCache = new Map<string, string | null | undefined>();
  const goCache = new Map<string, string | undefined>();
  const read = (p: string) => {
    try {
      return reader.readText(p, MAX_FILE_BYTES);
    } catch {
      return undefined;
    }
  };
  /** `null` when the directory has a package.json with no usable name; undefined when it has none. */
  const pkgName = (dir: string) => {
    if (!pkgCache.has(dir)) {
      const text = read(dir ? `${dir}/package.json` : 'package.json');
      let name: string | null | undefined;
      if (text !== undefined) {
        try {
          const parsed = JSON.parse(text) as { name?: unknown };
          name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null;
        } catch {
          name = null;
        }
      }
      pkgCache.set(dir, name);
    }
    return pkgCache.get(dir);
  };
  const goModulePath = (dir: string) => {
    if (!goCache.has(dir)) {
      const text = read(dir ? `${dir}/go.mod` : 'go.mod');
      goCache.set(dir, text === undefined ? undefined : (/^\s*module\s+"?([^\s"]+)"?/m.exec(text)?.[1] ?? ''));
    }
    return goCache.get(dir);
  };
  for (const t of out.values()) {
    const names: string[] = [];
    let packageDir: string | undefined;
    let goModule: ScopeTarget['goModule'];
    for (let dir = dirName(t.path); ; dir = dirName(dir)) {
      const name = pkgName(dir);
      if (name !== undefined) {
        packageDir ??= dir;
        if (name) names.push(name);
      }
      if (/\.go$/.test(t.path) && !goModule) {
        // The nearest go.mod owns the file, even one with no (readable) module line: its path is then ''.
        const mod = goModulePath(dir);
        if (mod !== undefined) goModule = { dir, path: mod };
      }
      if (dir === '') break;
    }
    if (names.length) t.packageNames = names;
    t.packageDir = packageDir ?? '';
    if (goModule) t.goModule = goModule;
  }
  return [...out.values()];
}
