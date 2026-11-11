import { posix } from 'node:path';
import type { ChangeStructure, DependentsEntry, DependentsLayer } from '../contract.ts';
import type { RaImportGraph } from '../sources/archaeology-lib.ts';
import { resolveRelative } from './imports.ts';

/**
 * GU-05: "What it touches" from Repo Archaeology's import graph (aliases, workspaces, `exports`, Go, Python).
 * The interim relative-import scanner in `imports.ts` remains the fallback when the library is unavailable.
 *
 * - Importers of each changed file come from reverse edges (`to` = the changed file), split into changed
 *   and untouched importers.
 * - Deleted and renamed-away paths are not in the head graph. GU-31 (`method: 'base-graph'`): with the import
 *   graph at the PR's base tree, every base edge into a removed path is checked against the head graph (see
 *   `brokenFromBaseGraph`), in any language Repo Archaeology resolves. Without a base graph
 *   (`method: 'relative-scan'`), importers are the repo-wide `unresolved` entries whose relative specifier
 *   points at that path (`target-missing`), as with the fallback scanner.
 * - `coverage` is `partial` when any other import in the repository is unresolved: such a file could be an
 *   importer Gutter cannot see. Imports reported as broken imports are not counted.
 */
const NON_CODE = new Set(['markdown', 'json', 'yaml', 'toml']);
const MAX_UNRESOLVED_SAMPLES = 5;
const MAX_SAMPLE_LEN = 200;
/** Edge kinds that count as importing a file: all of Repo Archaeology's (a type-only import is `static`). */
export const BROKEN_IMPORT_KINDS: ReadonlySet<string> = new Set(['static', 'dynamic', 'reexport', 'require']);

type Edge = RaImportGraph['edges'][number];

/** Paths a PR removes: deleted files and the old paths of renamed ones (sorted, unique). */
export function removedPaths(changes: ChangeStructure): string[] {
  const out = new Set<string>();
  for (const f of changes.files) {
    if (f.status === 'deleted') out.add(f.path);
    if (f.oldPath) out.add(f.oldPath);
  }
  return [...out].sort();
}
const pairKey = (from: string, specifier: string) => `${from}\0${specifier}`;

/** One importer left with a specifier that resolved to a removed path at base and no longer resolves at head. */
export interface BrokenCandidate {
  removed: string;
  importer: string;
  specifier: string;
  kind: string;
  via?: string;
  /** The importer changed in the PR (counted only when its specifier is still unresolved at head). */
  changed: boolean;
}

/**
 * Where an `__init__.py` sits on the module path a Python `specifier` names: `'leaf'` for the named package's own
 * initializer (`a/b/__init__.py` for `import a.b`, or the importer's package for `from . import x`), `'ancestor'`
 * for one strictly above it (`a/__init__.py` for `import a.b`), undefined otherwise (not an `__init__.py`, or a
 * package below the named module, such as `a/b/c/__init__.py`).
 */
export function initOnModulePath(importer: string, specifier: string, file: string): 'leaf' | 'ancestor' | undefined {
  return posix.basename(file) === '__init__.py' ? modulePathRole(importer, specifier, file) : undefined;
}

/**
 * The same for any Python file: its module path (`a/b` for `a/b.py` or `a/b/__init__.py`) is the one `specifier`
 * names (`'leaf'`), strictly above it (`'ancestor'`), or neither (a submodule below it, or unrelated).
 */
export function modulePathRole(importer: string, specifier: string, file: string): 'leaf' | 'ancestor' | undefined {
  if (!file.endsWith('.py')) return undefined;
  const dir = posix.basename(file) === '__init__.py' ? posix.dirname(file) : file.slice(0, -'.py'.length);
  const dots = /^\.*/.exec(specifier)![0].length;
  const parts = specifier.slice(dots).split('.').filter(Boolean);
  if (dots > 0) {
    // Relative: `.` is the importer's package, each extra dot one level up.
    let pkg = posix.dirname(importer);
    for (let i = 1; i < dots; i++) pkg = posix.dirname(pkg);
    const leaf = posix.join(pkg === '.' ? '' : pkg, ...parts);
    if (leaf === dir) return 'leaf';
    return dir === '.' || leaf.startsWith(`${dir}/`) ? 'ancestor' : undefined;
  }
  // Absolute: the source root is unknown, so match the module path as a suffix of the directory. The named module
  // itself is checked first: `a/a/__init__.py` for `import a.a` is the leaf, though its directory also ends in `a`.
  const full = parts.join('/');
  if (dir === full || dir.endsWith(`/${full}`)) return 'leaf';
  for (let k = 1; k < parts.length; k++) {
    const prefix = parts.slice(0, k).join('/');
    if (dir === prefix || dir.endsWith(`/${prefix}`)) return 'ancestor';
  }
  return undefined;
}

/**
 * True when `removed` is an `__init__.py` of a package strictly above the module `specifier` names (`a/__init__.py`
 * for `import a.b`): Python still imports `a.b` without it (a namespace package), so losing it alone breaks nothing.
 */
export function isAncestorInit(importer: string, specifier: string, removed: string): boolean {
  return initOnModulePath(importer, specifier, removed) === 'ancestor';
}

/**
 * GU-31, DECISIONS #20. For every base edge `e` into a removed path, `e.from` is left with a broken import when
 * it still exists at head (and was analyzed there), and its specifier no longer resolves to what `e.to` was:
 *  - nothing resolves: no head edge from `e.from` with `e.specifier` (TS/JS, Go and Python alike); an index
 *    fallback, a Go package with other member files or a module moved into a package all still resolve;
 *  - Python only: the specifier still resolves, but only to files it already reached at base (`from pkg import
 *    mod` falls back to `pkg/__init__.py` when `mod.py` is gone), unless `e.to` was an `__init__.py` above the
 *    named module.
 * An importer removed by the PR is not broken. An importer the PR changed counts only when the head graph still
 * lists its specifier as unresolved (it still imports it and nothing answers).
 */
export function brokenFromBaseGraph(changes: ChangeStructure, removed: ReadonlySet<string>, baseGraph: RaImportGraph, headGraph: RaImportGraph): BrokenCandidate[] {
  const changedPaths = new Set(changes.files.map((f) => f.path));
  const headAnalyzed = new Set(headGraph.files);
  const headTargets = new Map<string, Set<string>>();
  for (const e of headGraph.edges) {
    // Defensive: a file resolving to itself replaces nothing (Repo Archaeology 0.10 emits no self-edges).
    if (e.from === e.to) continue;
    const k = pairKey(e.from, e.specifier);
    let set = headTargets.get(k);
    if (!set) headTargets.set(k, (set = new Set()));
    set.add(e.to);
  }
  const headUnresolved = new Set(headGraph.unresolved.map((u) => pairKey(u.from, u.specifier)));
  // Files the head analysis said anything about: an importer with no head edge and no unresolved import, whose
  // other base imports still exist, was not really analyzed at head (source unavailable, a budget) and is skipped.
  const headSpoke = new Set([...headTargets.keys(), ...headUnresolved].map((k) => k.slice(0, k.indexOf('\0'))));
  const keepsOtherImports = new Set<string>();
  const baseTargets = new Map<string, Set<string>>();
  for (const e of baseGraph.edges) {
    const k = pairKey(e.from, e.specifier);
    let set = baseTargets.get(k);
    if (!set) baseTargets.set(k, (set = new Set()));
    set.add(e.to);
    if (!removed.has(e.to) && e.from !== e.to) keepsOtherImports.add(e.from);
  }

  const out: BrokenCandidate[] = [];
  const seen = new Set<string>();
  for (const e of baseGraph.edges) {
    if (!removed.has(e.to) || e.from === e.to || !BROKEN_IMPORT_KINDS.has(e.kind)) continue;
    if (removed.has(e.from) || !headAnalyzed.has(e.from)) continue;
    if (!headSpoke.has(e.from) && keepsOtherImports.has(e.from)) continue;
    const k = pairKey(e.from, e.specifier);
    const changed = changedPaths.has(e.from);
    if (changed && !headUnresolved.has(k)) continue;
    if (!lost(e, headTargets.get(k), baseTargets.get(k)!)) continue;
    const id = `${e.to}\0${k}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ removed: e.to, importer: e.from, specifier: e.specifier, kind: e.kind, ...(e.via ? { via: e.via } : {}), changed });
  }
  return out;
}

function lost(e: Edge, head: ReadonlySet<string> | undefined, base: ReadonlySet<string>): boolean {
  if (!head || head.size === 0) return true;
  if (e.via !== 'python-module') return false;
  // A new head target replaces the removed file, except an `__init__.py` on the specifier's own module path standing in
  // for a removed submodule: `from . import mod` falls back to the importer's own package `__init__.py` once `mod.py`
  // is gone (GU-31 review). When the removed file was the named module itself (`a/b.py` for `from a.b import x`), its
  // package form (`a/b/__init__.py`) does replace it.
  const removedIsLeaf = modulePathRole(e.from, e.specifier, e.to) === 'leaf';
  const replaces = (t: string) => {
    const role = initOnModulePath(e.from, e.specifier, t);
    return role === undefined || (role === 'leaf' && removedIsLeaf);
  };
  if ([...head].some((t) => !base.has(t) && replaces(t))) return false;
  return !isAncestorInit(e.from, e.specifier, e.to);
}

export function dependentsFromImportGraph(
  changes: ChangeStructure,
  graph: RaImportGraph,
  repoGraph: RaImportGraph = graph,
  baseGraph?: RaImportGraph,
): DependentsLayer {
  const changedPaths = new Set(changes.files.map((f) => f.path));
  const removed = new Set(removedPaths(changes));
  const headFiles = new Set([...graph.files, ...repoGraph.files, ...graph.edges.map((e) => e.to), ...repoGraph.edges.map((e) => e.to)]);

  const importersOf = new Map<string, Set<string>>();
  for (const f of changes.files) if (f.status !== 'deleted') importersOf.set(f.path, new Set());
  for (const p of removed) importersOf.set(p, new Set());

  const vias = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === e.to) continue;
    const set = importersOf.get(e.to);
    if (!set || removed.has(e.to)) continue;
    set.add(e.from);
    vias.add(e.via ?? 'unknown');
  }

  // Removed paths: base graph when present (GU-31), else relative `target-missing` specifiers (GU-05).
  const useBase = Boolean(baseGraph) && removed.size > 0;
  const brokenPairs = new Set<string>();
  if (useBase) {
    const candidates = brokenFromBaseGraph(changes, removed, baseGraph!, repoGraph);
    // A Go importer names a package, not a file: one entry per package (its first removed file), not one per file.
    const goEntry = new Map<string, string>();
    for (const c of [...candidates].sort((a, b) => a.removed.localeCompare(b.removed))) {
      if (c.via === 'go-package') {
        const dir = posix.dirname(c.removed);
        if (!goEntry.has(dir)) goEntry.set(dir, c.removed);
      }
    }
    for (const c of candidates) {
      const file = c.via === 'go-package' ? goEntry.get(posix.dirname(c.removed))! : c.removed;
      importersOf.get(file)?.add(c.importer);
      brokenPairs.add(pairKey(c.importer, c.specifier));
      vias.add(c.via ?? 'unknown');
    }
    // A file the PR adds or changes has no (comparable) base edge. When its import is unresolved at head and points at
    // a removed path (relative: by path; otherwise: some base importer resolved the same specifier to that path), it
    // is a broken import too, as the relative scan has always reported it (GU-31 review).
    const removedBySpecifier = new Map<string, string>();
    for (const e of baseGraph!.edges) {
      if (removed.has(e.to) && !e.specifier.startsWith('.') && !removedBySpecifier.has(e.specifier)) {
        removedBySpecifier.set(e.specifier, e.via === 'go-package' ? (goEntry.get(posix.dirname(e.to)) ?? e.to) : e.to);
      }
    }
    for (const u of repoGraph.unresolved) {
      if (!changedPaths.has(u.from) || removed.has(u.from) || brokenPairs.has(pairKey(u.from, u.specifier))) continue;
      const target = u.specifier.startsWith('.') ? resolveRelative(u.from, u.specifier, headFiles, removed) : removedBySpecifier.get(u.specifier);
      if (!target || !removed.has(target) || target === u.from) continue;
      importersOf.get(target)?.add(u.from);
      brokenPairs.add(pairKey(u.from, u.specifier));
    }
  }

  let unresolvedCount = 0;
  const byReason: Record<string, number> = {};
  const samples = new Set<string>();
  for (const u of repoGraph.unresolved) {
    // Imports reported as broken are not counted; nor, as before GU-31, is a relative specifier that points at a
    // removed path (only the relative scan names its importer, so `coverage` keeps one meaning in both modes).
    if (useBase && brokenPairs.has(pairKey(u.from, u.specifier))) continue;
    const target = u.specifier.startsWith('.') ? resolveRelative(u.from, u.specifier, headFiles, removed) : undefined;
    if (target && removed.has(target)) {
      if (!useBase && u.from !== target) importersOf.get(target)?.add(u.from);
      continue;
    }
    unresolvedCount++;
    const reason = u.reasonCode ?? 'unknown';
    byReason[reason] = (byReason[reason] ?? 0) + 1;
    const sample = `${u.from} → ${u.specifier}`;
    samples.add(sample.length > MAX_SAMPLE_LEN ? `${sample.slice(0, MAX_SAMPLE_LEN - 1)}…` : sample);
  }

  const entries: DependentsEntry[] = [];
  for (const [file, importers] of importersOf) {
    const list = [...importers].sort();
    if (!list.length) continue;
    entries.push({
      id: `deps:${file}`,
      file,
      deleted: removed.has(file),
      changedImporters: list.filter((p) => changedPaths.has(p)),
      untouchedImporters: list.filter((p) => !changedPaths.has(p)),
    });
  }
  entries.sort((a, b) => Number(b.deleted) - Number(a.deleted) || b.untouchedImporters.length - a.untouchedImporters.length);

  const languages = new Set([...graph.languages, ...repoGraph.languages]);
  const unchecked = changes.files
    .filter((f) => f.language !== null && !NON_CODE.has(f.language) && !languages.has(f.language))
    .map((f) => f.path);

  const imports = repoGraph.meta.imports as { filesScanned?: unknown } | undefined;
  return {
    analyzers: ['ra-import-graph', ...[...vias].sort()],
    entries,
    unchecked,
    coverage: unresolvedCount > 0 ? 'partial' : 'full',
    unresolved: {
      count: unresolvedCount,
      samples: [...samples].sort().slice(0, MAX_UNRESOLVED_SAMPLES),
      byReason,
    },
    scannedFiles: typeof imports?.filesScanned === 'number' ? imports.filesScanned : repoGraph.files.length,
    ...(removed.size > 0 ? { method: useBase ? 'base-graph' : 'relative-scan' } : {}),
  };
}
