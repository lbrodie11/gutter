/**
 * GU-30 seeded mutations for `broken-import` (docs/benchmark/CORPUS.md §3). Real merged PRs almost never
 * contain a broken import (they passed CI), so Gate A′(b)'s truth check is measured on synthetic PRs with
 * known answers.
 *
 * - Hosts: 3 real merged-PR heads per repository, chosen with the seed. Each mutation is ONE commit on a
 *   host, written with git plumbing (temporary index, `hash-object` from a file, `commit-tree`; no
 *   checkout, fixed author/committer/date, so commit ids are deterministic).
 * - Oracle (independent of Repo Archaeology, resolves imports by MODULE, not by symbol references):
 *   TS/JS: TypeScript's `resolveModuleName` with the importer's nearest tsconfig, workspace packages linked
 *   virtually under `node_modules`; Go: module path → package directory; Python: dotted module names.
 * - Every positive leaves ≥ 1 untouched importer whose import resolved to the removed path at base and
 *   fails at head; every negative control leaves none. Both are verified by the oracle before use.
 *
 *   node --experimental-strip-types bench/seeded.ts --cwd <repo> --language <typescript|go|python> \
 *     --bench <bench.json> --out <dir> [--seed 20261110] [--positives 30] [--negatives 30]
 *
 * Dev-only tooling (imports the `typescript` devDependency). Nothing from the analyzed repository runs.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { replayBriefWithMeta } from '../src/brief.ts';
import type { GutterBrief } from '../src/contract.ts';
import { GitTreeReader } from '../src/source/reader.ts';

export const SEED = 20261110;
export const HOSTS = 3;
export const POSITIVES = 30;
export const NEGATIVES = 30;
export type Lang = 'typescript' | 'go' | 'python';
export type Kind = 'delete' | 'rename' | 'rename-updated' | 'delete-unimported' | 'move-reexport' | 'test-only';
export const POSITIVE_KINDS: readonly Kind[] = ['delete', 'rename'];
export const NEGATIVE_KINDS: readonly Kind[] = ['rename-updated', 'delete-unimported', 'move-reexport', 'test-only'];

// ---- PRNG -------------------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A per-repository seed: the preregistered seed mixed with the repository name (FNV-1a). */
export function repoSeed(name: string, seed = SEED): number {
  let h = 0x811c9dc5;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return (h ^ seed) >>> 0;
}

// ---- Trees ------------------------------------------------------------------------------------

/** A file tree to analyze: a commit through `GitTreeReader`, or an in-memory map (tests). */
export interface Tree {
  files: readonly string[];
  has(path: string): boolean;
  read(path: string): string | undefined;
}

export function gitTree(cwd: string, sha: string): Tree & { close(): void } {
  const r = new GitTreeReader(cwd, sha, 2 * 1024 * 1024);
  const files = r.listFiles();
  const set = new Set(files);
  const cache = new Map<string, string | undefined>();
  return {
    files,
    has: (p) => set.has(p),
    read: (p) => {
      if (!cache.has(p)) cache.set(p, set.has(p) ? r.readText(p, 2 * 1024 * 1024) : undefined);
      return cache.get(p);
    },
    close: () => r.close(),
  };
}

export function memTree(map: Record<string, string>): Tree {
  const files = Object.keys(map).sort();
  return { files, has: (p) => p in map, read: (p) => map[p] };
}

/** Apply a change set (path → new content, or null to delete) to a tree, in memory. */
export function applyTree(base: Tree, changes: ReadonlyMap<string, string | null>): Tree {
  const files = new Set(base.files);
  for (const [p, c] of changes) (c === null ? files.delete(p) : files.add(p));
  const list = [...files].sort();
  return {
    files: list,
    has: (p) => files.has(p),
    read: (p) => (changes.has(p) ? (changes.get(p) ?? undefined) : files.has(p) ? base.read(p) : undefined),
  };
}

const VENDORED = /(^|\/)(node_modules|vendor|dist|build|\.git|__pycache__|third_party|testdata)\//;
const TS_JS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST = /(^|\/)(__tests__|__test__|tests?|spec|specs|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.go$|(^|\/)test_[^/]+\.py$|_test\.py$|(^|\/)conftest\.py$/;
export const isTestFile = (p: string) => TEST.test(p);

// ---- Oracle: TS/JS ----------------------------------------------------------------------------

export interface Edge {
  importer: string;
  /** The specifier exactly as written. */
  specifier: string;
  /** Repository path the specifier resolves to (a file; for Go, the package directory). */
  target: string;
}

const ROOT = '/repo';
/** Repository-relative path of a virtual absolute path; TypeScript also probes directories with a trailing slash. */
const rel = (abs: string) => abs.replace(/^\/repo\/?/, '').replace(/\/+$/, '');

/** Workspace packages: `package.json` name → directory (outside node_modules), for virtual linking. */
function workspaceLinks(tree: Tree): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of tree.files) {
    if (!f.endsWith('package.json') || VENDORED.test(f) || f === 'package.json') continue;
    try {
      const name = (JSON.parse(tree.read(f) ?? '{}') as { name?: unknown }).name;
      if (typeof name === 'string' && name && !out.has(name)) out.set(name, posix.dirname(f));
    } catch {
      // ignore malformed manifests
    }
  }
  try {
    const name = (JSON.parse(tree.read('package.json') ?? '{}') as { name?: unknown }).name;
    if (typeof name === 'string' && name && !out.has(name)) out.set(name, '');
  } catch {
    // ignore
  }
  return out;
}

export class TsOracle {
  readonly tree: Tree;
  private links: Map<string, string>;
  private dirs: Set<string>;
  private configCache = new Map<string, ts.CompilerOptions>();
  private cache: ts.ModuleResolutionCache;

  constructor(tree: Tree) {
    this.tree = tree;
    this.links = workspaceLinks(tree);
    this.dirs = new Set(['']);
    for (const f of tree.files) {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'));
    }
    this.cache = ts.createModuleResolutionCache(ROOT, (s) => s);
  }

  /** Map a virtual `.../node_modules/<workspace pkg>/rest` path to the real package directory. */
  private real(path: string): string {
    const m = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)(\/.*)?$/.exec(path);
    if (m) {
      const dir = this.links.get(m[1]!);
      if (dir !== undefined) return posix.join(dir, (m[2] ?? '').replace(/^\//, ''));
    }
    return path;
  }

  host(): ts.ModuleResolutionHost {
    return {
      fileExists: (p) => this.tree.has(this.real(rel(p))),
      readFile: (p) => this.tree.read(this.real(rel(p))),
      directoryExists: (p) => {
        const r = rel(p);
        if (/(^|\/)node_modules(\/(@[^/]+)?)?$/.test(r)) return true;
        return this.dirs.has(this.real(r));
      },
      realpath: (p) => `${ROOT}/${this.real(rel(p))}`.replace(/\/$/, ''),
      getCurrentDirectory: () => ROOT,
      useCaseSensitiveFileNames: true,
    };
  }

  /** Compiler options of the nearest `tsconfig.json` / `jsconfig.json` above `file` (with `extends`). */
  optionsFor(file: string): ts.CompilerOptions {
    let dir = posix.dirname(file);
    for (;;) {
      for (const name of ['tsconfig.json', 'jsconfig.json']) {
        const p = dir === '.' ? name : `${dir}/${name}`;
        if (this.tree.has(p)) return this.parseConfig(p);
      }
      if (dir === '.' || dir === '') break;
      dir = posix.dirname(dir);
    }
    return { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true, resolveJsonModule: false };
  }

  private parseConfig(path: string): ts.CompilerOptions {
    const hit = this.configCache.get(path);
    if (hit) return hit;
    let opts: ts.CompilerOptions = {};
    const text = this.tree.read(path);
    const parsed = text === undefined ? undefined : ts.parseConfigFileTextToJson(path, text);
    if (parsed && !parsed.error) {
      const host: ts.ParseConfigHost = {
        useCaseSensitiveFileNames: true,
        readDirectory: () => [],
        fileExists: (p) => this.tree.has(this.real(rel(p))),
        readFile: (p) => this.tree.read(this.real(rel(p))),
      };
      const dir = posix.dirname(path);
      opts = ts.parseJsonConfigFileContent(parsed.config, host, dir === '.' ? ROOT : `${ROOT}/${dir}`, undefined, `${ROOT}/${path}`).options;
    }
    // TypeScript's default resolution (Node10) ignores `exports`; projects without a setting resolve like bundlers.
    if (opts.moduleResolution === undefined) opts = { ...opts, moduleResolution: ts.ModuleResolutionKind.Bundler, module: opts.module ?? ts.ModuleKind.ESNext };
    opts = { ...opts, allowJs: true };
    this.configCache.set(path, opts);
    return opts;
  }

  /** Resolve one specifier from `importer`; a repository file path, or undefined. */
  resolve(importer: string, specifier: string): string | undefined {
    const r = ts.resolveModuleName(specifier, `${ROOT}/${importer}`, this.optionsFor(importer), this.host(), this.cache);
    const f = r.resolvedModule?.resolvedFileName;
    if (!f) return undefined;
    // TypeScript marks anything reached through node_modules as external, including the virtual workspace
    // links; judge by the real path instead (a repository file outside vendored directories).
    const p = this.real(rel(f));
    return this.tree.has(p) && !VENDORED.test(p) ? p : undefined;
  }

  /** Import specifiers of a file: static, dynamic, `require`, `export … from`, type-only included. */
  static specifiers(text: string): string[] {
    return ts.preProcessFile(text, true, true).importedFiles.map((f) => f.fileName);
  }

  edges(files: readonly string[]): Edge[] {
    const out: Edge[] = [];
    for (const importer of files) {
      const text = this.tree.read(importer);
      if (text === undefined) continue;
      for (const specifier of new Set(TsOracle.specifiers(text))) {
        const target = this.resolve(importer, specifier);
        if (target && target !== importer) out.push({ importer, specifier, target });
      }
    }
    return out;
  }
}

export const tsSources = (tree: Tree) => tree.files.filter((f) => TS_JS.test(f) && !VENDORED.test(f) && !/\.d\.[cm]?ts$/.test(f));

// ---- Oracle: Go -------------------------------------------------------------------------------

export class GoOracle {
  readonly tree: Tree;
  private modules: { path: string; dir: string }[];
  constructor(tree: Tree) {
    this.tree = tree;
    this.modules = tree.files
      .filter((f) => /(^|\/)go\.mod$/.test(f) && !VENDORED.test(f))
      .flatMap((f) => {
        const m = /^module\s+(\S+)/m.exec(tree.read(f) ?? '');
        return m ? [{ path: m[1]!.replace(/"/g, ''), dir: posix.dirname(f) === '.' ? '' : posix.dirname(f) }] : [];
      })
      .sort((a, b) => b.path.length - a.path.length);
  }

  static imports(text: string): string[] {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const out: string[] = [];
    for (const m of clean.matchAll(/^import\s*\(([\s\S]*?)\)/gm)) for (const q of m[1]!.matchAll(/"([^"]+)"/g)) out.push(q[1]!);
    for (const m of clean.matchAll(/^import\s+(?:[\w.]+\s+)?"([^"]+)"/gm)) out.push(m[1]!);
    return out;
  }

  /** Package directory an import path points to inside this repository (exists or not). */
  packageDir(importPath: string): string | undefined {
    for (const m of this.modules) {
      if (importPath === m.path || importPath.startsWith(`${m.path}/`)) {
        const rest = importPath.slice(m.path.length).replace(/^\//, '');
        return posix.join(m.dir, rest).replace(/^\.$/, '');
      }
    }
    return undefined;
  }

  /** Non-test .go files directly in `dir`. */
  packageFiles(dir: string): string[] {
    return this.tree.files.filter((f) => f.endsWith('.go') && !f.endsWith('_test.go') && (posix.dirname(f) === dir || (dir === '' && !f.includes('/'))));
  }

  resolve(_importer: string, importPath: string): string | undefined {
    const dir = this.packageDir(importPath);
    return dir !== undefined && this.packageFiles(dir).length > 0 ? dir : undefined;
  }

  edges(files: readonly string[]): Edge[] {
    const out: Edge[] = [];
    for (const importer of files) {
      for (const specifier of new Set(GoOracle.imports(this.tree.read(importer) ?? ''))) {
        const target = this.resolve(importer, specifier);
        if (target !== undefined && target !== posix.dirname(importer)) out.push({ importer, specifier, target });
      }
    }
    return out;
  }
}

export const goSources = (tree: Tree) => tree.files.filter((f) => f.endsWith('.go') && !VENDORED.test(f));

// ---- Oracle: Python ---------------------------------------------------------------------------

export class PyOracle {
  readonly tree: Tree;
  private roots: string[];
  constructor(tree: Tree) {
    this.tree = tree;
    const roots = new Set<string>(['']);
    for (const f of tree.files) {
      const m = /^((?:[^/]+\/){0,3}?)(src|lib)\//.exec(f);
      if (m && f.endsWith('.py')) roots.add(`${m[1]}${m[2]}`);
    }
    this.roots = [...roots].sort((a, b) => b.length - a.length);
  }

  /** `from`-clauses and `import` names of a Python file: dotted names, with leading dots for relative ones. */
  static imports(text: string): { module: string; names: string[] }[] {
    const out: { module: string; names: string[] }[] = [];
    const clean = text.replace(/\\\r?\n/g, ' ').replace(/#[^\n]*/g, '');
    for (const m of clean.matchAll(/^[ \t]*from[ \t]+(\.*[\w.]*)[ \t]+import[ \t]+(\([^)]*\)|[^\n;]+)/gm)) {
      const names = m[2]!.replace(/[()]/g, '').split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!.trim()).filter((s) => s && s !== '*');
      out.push({ module: m[1]!, names });
    }
    for (const m of clean.matchAll(/^[ \t]*import[ \t]+([^\n;]+)/gm)) {
      for (const part of m[1]!.split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0]!.trim();
        if (/^[\w.]+$/.test(name)) out.push({ module: name, names: [] });
      }
    }
    return out;
  }

  /** A dotted module name → file, trying every source root (`a/b.py`, then `a/b/__init__.py`). */
  moduleFile(dotted: string): string | undefined {
    const path = dotted.split('.').join('/');
    for (const r of this.roots) {
      for (const cand of [`${path}.py`, `${path}/__init__.py`]) {
        const p = r ? `${r}/${cand}` : cand;
        if (this.tree.has(p)) return p;
      }
    }
    return undefined;
  }

  private packageOf(file: string): string | undefined {
    for (const r of this.roots) {
      if (r && !file.startsWith(`${r}/`)) continue;
      const inner = r ? file.slice(r.length + 1) : file;
      return posix.dirname(inner) === '.' ? '' : posix.dirname(inner).split('/').join('.');
    }
    return undefined;
  }

  /** Absolute dotted name for a (possibly relative) `from` module of `importer`. */
  absolute(importer: string, module: string): string | undefined {
    const dots = /^\.*/.exec(module)![0].length;
    if (dots === 0) return module;
    const pkg = this.packageOf(importer);
    if (pkg === undefined) return undefined;
    const parts = pkg ? pkg.split('.') : [];
    if (dots - 1 > parts.length) return undefined;
    const base = parts.slice(0, parts.length - (dots - 1));
    const tail = module.slice(dots);
    return [...base, ...(tail ? tail.split('.') : [])].join('.');
  }

  /** Every (specifier → module file) an importer depends on. Specifiers: `from X` / `import X` / `from X import m` (submodule). */
  importsOf(importer: string, text: string): Edge[] {
    const out: Edge[] = [];
    for (const imp of PyOracle.imports(text)) {
      const abs = this.absolute(importer, imp.module);
      if (abs === undefined) continue;
      if (abs) {
        const f = this.moduleFile(abs);
        if (f) out.push({ importer, specifier: imp.module, target: f });
        else if (imp.names.length === 0 || /^\./.test(imp.module) || this.moduleFile(abs.split('.')[0]!)) {
          // A dotted name of this repository that does not resolve: recorded so head checks can see it fail.
          out.push({ importer, specifier: imp.module, target: '' });
        }
      }
      for (const n of imp.names) {
        const sub = abs ? `${abs}.${n}` : n;
        const f = this.moduleFile(sub);
        if (f && f.endsWith(`${n}.py`)) out.push({ importer, specifier: `${imp.module}:${n}`, target: f });
      }
    }
    return out;
  }

  resolve(importer: string, specifier: string): string | undefined {
    const [module, name] = specifier.split(':');
    const abs = this.absolute(importer, module!);
    if (abs === undefined) return undefined;
    return this.moduleFile(name ? (abs ? `${abs}.${name}` : name) : abs);
  }

  edges(files: readonly string[]): Edge[] {
    return files.flatMap((f) => this.importsOf(f, this.tree.read(f) ?? '').filter((e) => e.target && e.target !== f));
  }
}

export const pySources = (tree: Tree) => tree.files.filter((f) => f.endsWith('.py') && !VENDORED.test(f));

// ---- One oracle interface -------------------------------------------------------------------

export interface Oracle {
  edges(files: readonly string[]): Edge[];
  resolve(importer: string, specifier: string): string | undefined;
}

export function oracleFor(lang: Lang, tree: Tree): { oracle: Oracle; sources: string[] } {
  if (lang === 'go') return { oracle: new GoOracle(tree), sources: goSources(tree) };
  if (lang === 'python') return { oracle: new PyOracle(tree), sources: pySources(tree) };
  return { oracle: new TsOracle(tree), sources: tsSources(tree) };
}

/** The removed paths of a change set mapped to the oracle's targets (Go: package directories). */
function removedTargets(lang: Lang, base: Tree, changes: ReadonlyMap<string, string | null>): Set<string> {
  const removed = [...changes].filter(([, c]) => c === null).map(([p]) => p);
  if (lang !== 'go') return new Set(removed);
  const go = new GoOracle(applyTree(base, changes));
  return new Set(removed.map((p) => posix.dirname(p)).map((d) => (d === '.' ? '' : d)).filter((d) => go.packageFiles(d).length === 0));
}

/** Internal specifiers of one file with their resolution in `oracle`'s tree (undefined: does not resolve). */
function specsOf(lang: Lang, oracle: Oracle, importer: string, text: string): { specifier: string; target: string | undefined }[] {
  if (lang === 'typescript') {
    return [...new Set(TsOracle.specifiers(text))].filter((s) => s.startsWith('.') || oracle.resolve(importer, s) !== undefined).map((s) => ({ specifier: s, target: oracle.resolve(importer, s) }));
  }
  if (lang === 'go') {
    const go = oracle as GoOracle;
    return [...new Set(GoOracle.imports(text))].filter((s) => go.packageDir(s) !== undefined).map((s) => ({ specifier: s, target: go.resolve(importer, s) }));
  }
  return (oracle as PyOracle).importsOf(importer, text).map((e) => ({ specifier: e.specifier, target: e.target || undefined }));
}

/**
 * Ground truth for a change set: base edges into a removed target whose importer still exists at head
 * and no longer resolves there. An importer rewritten by the change set (rename-updated) is broken when
 * its old specifier is still present and fails, or when a specifier it gained fails to resolve.
 */
export function brokenEdges(lang: Lang, base: Tree, baseEdges: readonly Edge[], changes: ReadonlyMap<string, string | null>): Edge[] {
  const head = applyTree(base, changes);
  const targets = removedTargets(lang, base, changes);
  if (!targets.size) return [];
  const baseOracle = oracleFor(lang, base).oracle;
  const headOracle = oracleFor(lang, head).oracle;
  const out: Edge[] = [];
  for (const e of baseEdges) {
    if (!targets.has(e.target) || !head.has(e.importer)) continue;
    if (!changes.has(e.importer)) {
      if (headOracle.resolve(e.importer, e.specifier) === undefined) out.push(e);
      continue;
    }
    const before = new Set(specsOf(lang, baseOracle, e.importer, base.read(e.importer) ?? '').map((x) => x.specifier));
    const after = specsOf(lang, headOracle, e.importer, head.read(e.importer) ?? '');
    const same = after.find((x) => x.specifier === e.specifier);
    if (same ? same.target === undefined : after.some((x) => !before.has(x.specifier) && x.target === undefined)) out.push(e);
  }
  return out;
}

// ---- Mutation generator -----------------------------------------------------------------------

export interface Mutation {
  id: string;
  kind: Kind;
  positive: boolean;
  host: string;
  /** path → new content, or null to delete. */
  changes: Map<string, string | null>;
  /** Removed paths (deleted or renamed away). */
  removed: string[];
  /** Ground truth: importers left broken (positives: ≥ 1; negatives: none). */
  broken: Edge[];
}

const stemOf = (p: string) => posix.basename(p).replace(/\.[^.]+$/, '');
const extOf = (p: string) => /\.[^./]+$/.exec(p)?.[0] ?? '';
const withStem = (p: string, suffix: string) => posix.join(posix.dirname(p), `${stemOf(p)}${suffix}${extOf(p)}`);

export interface GenerateResult {
  mutations: Mutation[];
  meta: { eligiblePositive: number; eligibleNegative: Record<string, number>; negativesTaken: Record<string, number>; rejected: Record<string, number>; shortfalls: Record<string, number> };
}

/**
 * Deterministic for (tree, seed): candidates are shuffled with the seed and taken in order; each candidate
 * is verified by the oracle (positives must break ≥ 1 untouched importer at head; negatives must break none).
 */
export function generate(lang: Lang, host: string, tree: Tree, rand: () => number, want: { positives: number; negatives: number }, offset = 0): GenerateResult {
  const { oracle, sources } = oracleFor(lang, tree);
  const edges = oracle.edges(sources);
  const rejected: Record<string, number> = {};
  const reject = (why: string) => (rejected[why] = (rejected[why] ?? 0) + 1);
  const importersOf = new Map<string, Edge[]>();
  for (const e of edges) importersOf.set(e.target, [...(importersOf.get(e.target) ?? []), e]);
  const mutations: Mutation[] = [];
  const make = (kind: Kind, positive: boolean, changes: Map<string, string | null>): Mutation | undefined => {
    const removed = [...changes].filter(([, c]) => c === null).map(([p]) => p);
    const broken = brokenEdges(lang, tree, edges, changes);
    if (positive ? broken.length === 0 : broken.length > 0) {
      reject(`${kind}: oracle ${positive ? 'found no broken importer' : 'found a broken importer'}`);
      return undefined;
    }
    return { id: `${host.slice(0, 7)}-${kind}-${mutations.length}`, kind, positive, host, changes, removed, broken };
  };
  const nonTest = (f: string) => !isTestFile(f);

  // Positives: delete or rename a source unit with ≥ 1 untouched importer outside the change.
  const unitsWithImporters = [...importersOf.keys()].filter((t) => (lang === 'go' ? true : nonTest(t)) && importersOf.get(t)!.some((e) => e.importer !== t)).sort();
  const go = lang === 'go' ? (oracle as GoOracle) : undefined;
  const filesOfUnit = (t: string) => (go ? go.packageFiles(t) : [t]);
  let pk = 0;
  const posCandidates = shuffle(unitsWithImporters, rand);
  for (const t of posCandidates) {
    if (mutations.filter((m) => m.positive).length >= want.positives) break;
    const kind = POSITIVE_KINDS[(pk + offset) % POSITIVE_KINDS.length]!;
    const changes = new Map<string, string | null>();
    for (const f of filesOfUnit(t)) {
      changes.set(f, null);
      if (kind === 'rename') {
        const to = go ? posix.join(`${posix.dirname(f)}_seededmoved`, posix.basename(f)) : withStem(f, '_seeded_moved');
        changes.set(to, tree.read(f) ?? '');
      }
    }
    const m = make(kind, true, changes);
    if (m) {
      mutations.push(m);
      pk++;
    }
  }

  // Negative controls, round robin over the kinds that apply; shortfalls are filled by the others.
  const pools: Record<string, string[]> = {
    'rename-updated': shuffle(unitsWithImporters.filter((t) => importersOf.get(t)!.every((e) => isRewritable(lang, e))), rand),
    'delete-unimported': shuffle(
      (go ? goSources(tree).filter((f) => !f.endsWith('_test.go') && go.packageFiles(posix.dirname(f) === '.' ? '' : posix.dirname(f)).length > 1) : sources.filter((f) => !importersOf.has(f))).filter(nonTest).sort(),
      rand,
    ),
    'move-reexport': lang === 'go' ? [] : shuffle(unitsWithImporters.filter((t) => !t.endsWith('__init__.py')), rand),
    'test-only': shuffle(sources.filter(isTestFile).sort(), rand),
  };
  const eligibleNegative = Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length]));
  // Round robin over the kinds, starting at a different kind per host (`offset`), so the corpus-wide split
  // is close to even; an exhausted kind is skipped and the others fill the shortfall (CORPUS.md §3).
  const taken: Record<string, number> = {};
  const cursor: Record<string, number> = {};
  const tryKind = (kind: Kind): boolean => {
    const pool = pools[kind]!;
    while ((cursor[kind] ?? 0) < pool.length) {
      const t = pool[cursor[kind] ?? 0]!;
      cursor[kind] = (cursor[kind] ?? 0) + 1;
      const changes = negativeChanges(lang, kind, t, tree, importersOf.get(t) ?? [], go);
      if (!changes) {
        reject(`${kind}: not applicable`);
        continue;
      }
      const m = make(kind, false, changes);
      if (m) {
        mutations.push(m);
        taken[kind] = (taken[kind] ?? 0) + 1;
        return true;
      }
    }
    return false;
  };
  const order = NEGATIVE_KINDS.map((_, i) => NEGATIVE_KINDS[(i + offset) % NEGATIVE_KINDS.length]!);
  const exhausted = new Set<Kind>();
  while (mutations.filter((m) => !m.positive).length < want.negatives && exhausted.size < order.length) {
    for (const kind of order) {
      if (mutations.filter((m) => !m.positive).length >= want.negatives) break;
      if (exhausted.has(kind)) continue;
      if (!tryKind(kind)) exhausted.add(kind);
    }
  }
  const shortfalls: Record<string, number> = {};
  const posShort = want.positives - mutations.filter((m) => m.positive).length;
  const negShort = want.negatives - mutations.filter((m) => !m.positive).length;
  if (posShort > 0) shortfalls.positives = posShort;
  if (negShort > 0) shortfalls.negatives = negShort;
  return { mutations, meta: { eligiblePositive: unitsWithImporters.length, eligibleNegative, negativesTaken: taken, rejected, shortfalls } };
}

/** Whether an import edge can be rewritten to follow a rename (relative TS/JS, Go import paths, Python `from`). */
function isRewritable(lang: Lang, e: Edge): boolean {
  if (lang === 'typescript') return e.specifier.startsWith('.') && !/(^|\/)index$/.test(e.specifier.replace(/\.[cm]?[jt]sx?$/, '')) && stemOf(e.target) !== 'index';
  if (lang === 'go') return true;
  return !e.specifier.includes(':') && !e.target.endsWith('__init__.py');
}

/** Rewrite one specifier in an importer's text, keeping its quote style. */
function rewriteSpecifier(text: string, from: string, to: string, lang: Lang): string | undefined {
  if (lang === 'python') {
    const re = new RegExp(`(^[ \\t]*(?:from|import)[ \\t]+)${from.replace(/\./g, '\\.')}(?=[ \\t\\n,])`, 'gm');
    return re.test(text) ? text.replace(re, `$1${to}`) : undefined;
  }
  let hit = false;
  const out = text.replace(new RegExp(`(['"])${from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\1`, 'g'), (_m, q: string) => {
    hit = true;
    return `${q}${to}${q}`;
  });
  return hit ? out : undefined;
}

function negativeChanges(lang: Lang, kind: Kind, t: string, tree: Tree, importers: Edge[], go?: GoOracle): Map<string, string | null> | undefined {
  const changes = new Map<string, string | null>();
  if (kind === 'test-only') {
    const text = tree.read(t);
    if (text === undefined) return undefined;
    changes.set(t, `${text}${text.endsWith('\n') ? '' : '\n'}${lang === 'python' ? '# seeded' : '// seeded'}\n`);
    return changes;
  }
  if (kind === 'delete-unimported') {
    changes.set(t, null);
    return changes;
  }
  if (kind === 'rename-updated') {
    if (lang === 'go') {
      const files = go!.packageFiles(t);
      if (!files.length) return undefined;
      const newDir = `${t}_seededmoved`;
      for (const f of files) {
        changes.set(f, null);
        changes.set(posix.join(newDir, posix.basename(f)), tree.read(f) ?? '');
      }
      for (const e of importers) {
        const cur = changes.get(e.importer) ?? tree.read(e.importer);
        if (cur == null) return undefined;
        const next = rewriteSpecifier(cur, e.specifier, `${e.specifier}_seededmoved`, lang);
        if (!next) return undefined;
        changes.set(e.importer, next);
      }
      return changes;
    }
    const to = withStem(t, '_seeded');
    changes.set(t, null);
    changes.set(to, tree.read(t) ?? '');
    for (const e of importers) {
      const cur = changes.get(e.importer) ?? tree.read(e.importer);
      if (cur == null) return undefined;
      const spec =
        lang === 'python'
          ? e.specifier.replace(new RegExp(`${stemOf(t)}$`), `${stemOf(t)}_seeded`)
          : e.specifier.replace(new RegExp(`${stemOf(t)}(\\.[cm]?[jt]sx?)?$`), (_m, ext: string | undefined) => `${stemOf(t)}_seeded${ext ?? ''}`);
      if (spec === e.specifier) return undefined;
      const next = rewriteSpecifier(cur, e.specifier, spec, lang);
      if (!next) return undefined;
      changes.set(e.importer, next);
    }
    return changes;
  }
  // move-reexport: move the file, keep the old path as a re-export of the new one.
  const to = withStem(t, '_seeded_moved');
  changes.set(to, tree.read(t) ?? '');
  if (lang === 'python') {
    const dot = posix.dirname(t) === '.' ? '' : '.';
    changes.set(t, `from ${dot}${stemOf(t)}_seeded_moved import *  # noqa: F401,F403\n`);
  } else {
    const usesJsExt = importers.some((e) => /\.[cm]?js$/.test(e.specifier));
    const spec = `./${stemOf(t)}_seeded_moved${usesJsExt ? extOf(t).replace(/ts(x?)$/, 'js$1') : ''}`;
    changes.set(t, `export * from '${spec}';\n`);
  }
  return changes;
}

// ---- Plumbing commits -------------------------------------------------------------------------

const FIXED_ENV = {
  GIT_AUTHOR_NAME: 'gutter-seeded', GIT_AUTHOR_EMAIL: 'seeded@gutter.invalid', GIT_AUTHOR_DATE: '2026-11-10T00:00:00Z',
  GIT_COMMITTER_NAME: 'gutter-seeded', GIT_COMMITTER_EMAIL: 'seeded@gutter.invalid', GIT_COMMITTER_DATE: '2026-11-10T00:00:00Z',
};

/** One commit on `host` with the mutation, via a temporary index (no checkout). Returns the commit id. */
export function commitMutation(cwd: string, m: Mutation): string {
  const scratch = mkdtempSync(join(tmpdir(), 'gutter-seeded-'));
  const env = { ...process.env, ...FIXED_ENV, GIT_INDEX_FILE: join(scratch, 'index') };
  const g = (args: string[]) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
  try {
    g(['read-tree', m.host]);
    for (const [path, content] of m.changes) {
      if (content === null) {
        g(['update-index', '--force-remove', '--', path]);
        continue;
      }
      // RA-18's lesson: write the blob from a file, never through stdin (that hung `git`).
      const tmp = join(scratch, 'blob');
      writeFileSync(tmp, content);
      const blob = g(['hash-object', '-w', '--no-filters', tmp]);
      g(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`]);
    }
    const tree = g(['write-tree']);
    return g(['commit-tree', tree, '-p', m.host, '-m', `seeded: ${m.kind} ${m.removed.join(' ') || [...m.changes.keys()][0]}`]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ---- Scoring ----------------------------------------------------------------------------------

export interface SeededRecord {
  id: string;
  kind: Kind;
  positive: boolean;
  host: string;
  commit: string;
  removed: string[];
  oracleBroken: { importer: string; specifier: string; target: string }[];
  /** broken-import items Gutter reported: the removed file and the importers it named. */
  reported: { file: string; importers: string[]; confirmed: boolean }[];
  /** Positive found (a reported item for one of its removed paths). */
  detected: boolean;
  /** Why a positive was not detected: `unchecked` / `partial` (skipped, never a hit) or `missed`. */
  missReason?: 'unchecked' | 'partial' | 'missed';
  coverage: 'full' | 'partial';
  analyzers: string[];
  ms: number;
  error?: string;
}

export function score(lang: Lang, m: Mutation, brief: GutterBrief): Pick<SeededRecord, 'reported' | 'detected' | 'missReason' | 'coverage' | 'analyzers'> {
  const brokenBy = new Map<string, Set<string>>();
  for (const e of m.broken) {
    const key = e.target;
    brokenBy.set(key, new Set([...(brokenBy.get(key) ?? []), e.importer]));
  }
  const targetOf = (file: string) => (lang === 'go' ? (posix.dirname(file) === '.' ? '' : posix.dirname(file)) : file);
  const reported = brief.checklist
    .filter((c) => c.kind === 'broken-import')
    .map((c) => brief.dependents.entries.find((d) => d.id === c.evidence[0]))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((d) => {
      const importers = [...d.untouchedImporters, ...d.changedImporters];
      const truth = brokenBy.get(targetOf(d.file)) ?? new Set<string>();
      return { file: d.file, importers, confirmed: importers.length > 0 && importers.every((i) => truth.has(i)) };
    });
  const detected = m.positive && reported.some((r) => m.removed.includes(r.file));
  const unchecked = m.removed.some((p) => brief.dependents.unchecked.includes(p));
  const missReason = m.positive && !detected ? (unchecked ? 'unchecked' : brief.dependents.coverage === 'partial' ? 'partial' : 'missed') : undefined;
  return { reported, detected, ...(missReason ? { missReason } : {}), coverage: brief.dependents.coverage, analyzers: brief.dependents.analyzers };
}

// ---- Run --------------------------------------------------------------------------------------

interface BenchPr { id: string; head: string }

export async function runSeeded(opts: { cwd: string; lang: Lang; repoName: string; benchPrs: BenchPr[]; out: string; seed?: number; positives?: number; negatives?: number; log?: (s: string) => void }) {
  const rand = mulberry32(repoSeed(opts.repoName, opts.seed ?? SEED));
  const hosts = shuffle([...new Set(opts.benchPrs.map((p) => p.head))].sort(), rand).slice(0, HOSTS);
  mkdirSync(opts.out, { recursive: true });
  const records: SeededRecord[] = [];
  const meta: Record<string, unknown>[] = [];
  const perHost = (n: number, i: number) => Math.floor(n / hosts.length) + (i < n % hosts.length ? 1 : 0);
  for (const [i, host] of hosts.entries()) {
    const tree = gitTree(opts.cwd, host);
    let gen: GenerateResult;
    try {
      gen = generate(opts.lang, host, tree, rand, { positives: perHost(opts.positives ?? POSITIVES, i), negatives: perHost(opts.negatives ?? NEGATIVES, i) }, i);
    } finally {
      tree.close();
    }
    meta.push({ host, ...gen.meta, generated: { positives: gen.mutations.filter((m) => m.positive).length, negatives: gen.mutations.filter((m) => !m.positive).length } });
    for (const m of gen.mutations) {
      const t0 = performance.now();
      const commit = commitMutation(opts.cwd, m);
      const base: Omit<SeededRecord, 'reported' | 'detected' | 'coverage' | 'analyzers' | 'ms'> = {
        id: m.id, kind: m.kind, positive: m.positive, host, commit, removed: m.removed,
        oracleBroken: m.broken.map(({ importer, specifier, target }) => ({ importer, specifier, target })),
      };
      try {
        const res = await replayBriefWithMeta({ cwd: opts.cwd, base: host, head: commit, noCalibration: true, title: `seeded ${m.kind}` });
        records.push({ ...base, commit, ...score(opts.lang, m, res.brief), ms: Math.round(performance.now() - t0) });
      } catch (err) {
        records.push({ ...base, reported: [], detected: false, ...(m.positive ? { missReason: 'missed' as const } : {}), coverage: 'partial', analyzers: [], ms: Math.round(performance.now() - t0), error: (err as Error).message.split('\n')[0] });
      }
      opts.log?.(`${m.id} ${m.positive ? (records.at(-1)!.detected ? 'detected' : `not detected (${records.at(-1)!.missReason})`) : records.at(-1)!.reported.length ? 'FALSE POSITIVE' : 'clean'}`);
    }
  }
  writeFileSync(join(opts.out, 'seeded.jsonl'), records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''));
  const summary = summarizeSeeded(records);
  writeFileSync(join(opts.out, 'seeded-summary.json'), JSON.stringify({ seed: opts.seed ?? SEED, repoSeed: repoSeed(opts.repoName, opts.seed ?? SEED), hosts, meta, ...summary }, null, 2) + '\n');
  return summary;
}

export function summarizeSeeded(records: readonly SeededRecord[]) {
  const pos = records.filter((r) => r.positive);
  const neg = records.filter((r) => !r.positive);
  const reportedItems = records.flatMap((r) => r.reported);
  const confirmed = reportedItems.filter((x) => x.confirmed).length;
  const detected = pos.filter((r) => r.detected).length;
  const fp = neg.filter((r) => r.reported.length > 0).length;
  const skipped = pos.filter((r) => r.missReason === 'unchecked' || r.missReason === 'partial').length;
  return {
    positives: pos.length,
    negatives: neg.length,
    reportedItems: reportedItems.length,
    confirmedItems: confirmed,
    precision: reportedItems.length ? confirmed / reportedItems.length : null,
    detected,
    recall: pos.length ? detected / pos.length : null,
    falsePositives: fp,
    falsePositiveRate: neg.length ? fp / neg.length : null,
    skippedUncheckedOrPartial: skipped,
    skippedShare: pos.length ? skipped / pos.length : null,
    errors: records.filter((r) => r.error).length,
    byKind: Object.fromEntries([...POSITIVE_KINDS, ...NEGATIVE_KINDS].map((k) => {
      const rs = records.filter((r) => r.kind === k);
      return [k, { n: rs.length, detected: rs.filter((r) => r.detected).length, withReport: rs.filter((r) => r.reported.length > 0).length }];
    })),
    missReasons: Object.fromEntries(['unchecked', 'partial', 'missed'].map((k) => [k, pos.filter((r) => r.missReason === k).length])),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      cwd: { type: 'string' }, language: { type: 'string' }, bench: { type: 'string' }, out: { type: 'string' },
      name: { type: 'string' }, seed: { type: 'string' }, positives: { type: 'string' }, negatives: { type: 'string' },
    },
  });
  if (!values.cwd || !values.language || !values.bench || !values.out) throw new Error('usage: seeded.ts --cwd <repo> --language <typescript|go|python> --bench <bench.json> --out <dir> [--name owner/repo]');
  const bench = JSON.parse(readFileSync(values.bench, 'utf8')) as { repo: { name: string }; prs: BenchPr[] };
  const summary = await runSeeded({
    cwd: values.cwd,
    lang: values.language as Lang,
    repoName: values.name ?? bench.repo.name,
    benchPrs: bench.prs,
    out: values.out,
    ...(values.seed ? { seed: Number(values.seed) } : {}),
    ...(values.positives ? { positives: Number(values.positives) } : {}),
    ...(values.negatives ? { negatives: Number(values.negatives) } : {}),
    log: (s) => process.stderr.write(`${s}\n`),
  });
  process.stderr.write(`seeded: precision ${summary.precision} recall ${summary.recall} FP rate ${summary.falsePositiveRate} (${summary.positives}+/${summary.negatives}-)\n`);
}

if (process.argv[1]?.endsWith('seeded.ts')) {
  main().catch((err: unknown) => {
    process.stderr.write(`seeded: ${(err as Error).message}\n`);
    process.exitCode = 1;
  });
}
