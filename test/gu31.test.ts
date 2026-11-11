/**
 * GU-31 · Broken imports in every language Repo Archaeology resolves (base vs head import graphs).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { buildBriefAsync, replayBriefWithMeta } from '../src/brief.ts';
import type { ChangeStructure, GutterBrief } from '../src/contract.ts';
import { brokenFromBaseGraph, dependentsFromImportGraph, isAncestorInit } from '../src/evidence/import-graph.ts';
import { buildDependents } from '../src/evidence/imports.ts';
import { GitTreeReader } from '../src/source/reader.ts';
import { analyzeWithLibrary, loadRaLibrary, type LoadedRaLibrary, type RaImportGraph } from '../src/sources/archaeology-lib.ts';
import { gitTree, importSpecifiers } from '../bench/seeded.ts';
import { TempRepo, schemaProblems } from './helpers.ts';

const repos: TempRepo[] = [];
const dirs: string[] = [];
after(() => {
  repos.forEach((r) => r.cleanup());
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
});
const NOW = new Date('2026-11-11T12:00:00Z');

/** A two-commit repository: `files` at base, then `mutate` on a branch. Returns base and head SHAs. */
function pr(files: Record<string, string>, mutate: (r: TempRepo) => void): { r: TempRepo; base: string; head: string } {
  const r = new TempRepo().write(files).commit('init');
  repos.push(r);
  const base = r.git('rev-parse', 'HEAD').trim();
  r.branch('feature');
  mutate(r);
  r.commit('change');
  return { r, base, head: r.git('rev-parse', 'HEAD').trim() };
}

/** The broken-import items of a replayed brief: removed file → importers it names. */
function broken(b: GutterBrief): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of b.checklist.filter((x) => x.kind === 'broken-import')) {
    const d = b.dependents.entries.find((e) => e.id === c.evidence[0])!;
    out[d.file] = [...d.untouchedImporters, ...d.changedImporters].sort();
  }
  return out;
}

async function replay(files: Record<string, string>, mutate: (r: TempRepo) => void, extra: { maxChecklist?: number } = {}) {
  const { r, base, head } = pr(files, mutate);
  const res = await replayBriefWithMeta({ cwd: r.dir, base, head, now: NOW, noCalibration: true, ...(extra.maxChecklist ? { config: { maxChecklist: extra.maxChecklist } } : {}) });
  return res;
}

// ---- TS/JS: every resolution kind -------------------------------------------------------------

const TS_BASE = {
  'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] }, module: 'esnext', moduleResolution: 'bundler' } }),
  'package.json': JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }),
  'packages/lib/package.json': JSON.stringify({ name: '@ws/lib', version: '1.0.0', exports: { '.': './src/index.ts', './util': './src/util.ts' } }),
  'packages/lib/src/index.ts': 'export const lib = 1;\n',
  'packages/lib/src/util.ts': 'export const util = 1;\n',
  'packages/app/package.json': JSON.stringify({ name: '@ws/app', version: '1.0.0', dependencies: { '@ws/lib': 'workspace:*' } }),
  'packages/app/src/main.ts': "import { lib } from '@ws/lib';\nimport { util } from '@ws/lib/util';\nexport const m = lib + util;\n",
  'src/alias.ts': 'export const alias = 1;\n',
  'src/types.ts': 'export type T = number;\n',
  'src/lazy.ts': 'export const lazy = 1;\n',
  'src/user.ts': "import { alias } from '@/alias';\nimport type { T } from './types';\nexport const load = async (): Promise<T> => (await import('./lazy')).lazy + alias;\n",
};

test('TS: a `paths` alias import of a deleted file is a broken import (base-graph)', async () => {
  const res = await replay(TS_BASE, (r) => r.rm('src/alias.ts'));
  assert.deepEqual(broken(res.brief), { 'src/alias.ts': ['src/user.ts'] });
  assert.equal(res.brief.dependents.method, 'base-graph');
  assert.ok(res.brief.dependents.analyzers.includes('paths'));
});

test('TS: a workspace package entry and an `exports` subpath, each deleted', async () => {
  const a = await replay(TS_BASE, (r) => r.rm('packages/lib/src/index.ts'));
  assert.deepEqual(broken(a.brief), { 'packages/lib/src/index.ts': ['packages/app/src/main.ts'] });
  const b = await replay(TS_BASE, (r) => r.rm('packages/lib/src/util.ts'));
  assert.deepEqual(broken(b.brief), { 'packages/lib/src/util.ts': ['packages/app/src/main.ts'] });
});

test('TS: type-only and dynamic imports count (kinds static, dynamic, reexport, require)', async () => {
  const a = await replay(TS_BASE, (r) => r.rm('src/types.ts'));
  assert.deepEqual(broken(a.brief), { 'src/types.ts': ['src/user.ts'] });
  const b = await replay(TS_BASE, (r) => r.rm('src/lazy.ts'));
  assert.deepEqual(broken(b.brief), { 'src/lazy.ts': ['src/user.ts'] });
});

test('TS: a renamed-away alias target is a broken import under its old path', async () => {
  const res = await replay(TS_BASE, (r) => r.mv('src/alias.ts', 'src/alias2.ts'));
  assert.deepEqual(broken(res.brief), { 'src/alias.ts': ['src/user.ts'] });
});

// ---- Go -------------------------------------------------------------------------------------

const GO_BASE = {
  'go.mod': 'module example.com/m\n\ngo 1.22\n',
  'pkg/one/one.go': 'package one\n\nfunc One() {}\n',
  'pkg/multi/a.go': 'package multi\n\nfunc A() {}\n',
  'pkg/multi/b.go': 'package multi\n\nfunc B() {}\n',
  'pkg/two/x.go': 'package two\n\nfunc X() {}\n',
  'pkg/two/y.go': 'package two\n\nfunc Y() {}\n',
  'cmd/main.go': 'package main\n\nimport (\n\t"example.com/m/pkg/multi"\n\t"example.com/m/pkg/one"\n\t"example.com/m/pkg/two"\n)\n\nfunc main() { one.One(); multi.A(); two.X() }\n',
};

test('Go: a removed package directory is a broken import', async () => {
  const res = await replay(GO_BASE, (r) => r.rm('pkg/one/one.go'));
  assert.deepEqual(broken(res.brief), { 'pkg/one/one.go': ['cmd/main.go'] });
  assert.equal(res.brief.dependents.method, 'base-graph');
});

test('Go: removing one file of a multi-file package is NOT broken (the package still resolves)', async () => {
  const res = await replay(GO_BASE, (r) => r.rm('pkg/multi/a.go'));
  assert.deepEqual(broken(res.brief), {});
});

test('Go: a renamed package gives ONE item (its first removed file), not one per file', async () => {
  const res = await replay(GO_BASE, (r) => r.mv('pkg/two', 'pkg/two_moved'));
  assert.deepEqual(broken(res.brief), { 'pkg/two/x.go': ['cmd/main.go'] });
});

// ---- Python ---------------------------------------------------------------------------------

const PY_BASE = {
  'pyproject.toml': '[project]\nname = "app"\n',
  'app/__init__.py': 'from .core import X\n',
  'app/core.py': 'X = 1\n',
  'app/util.py': 'Y = 2\n',
  'app/sub/__init__.py': 'Z0 = 0\n',
  'app/sub/deep.py': 'Z = 3\n',
  'use.py': 'from app import util\nfrom app.util import Y\nimport app.core\n',
  'use_sub.py': 'from app.sub import deep\n',
  'use_deep.py': 'import app.sub.deep\n',
};

test('Python: a deleted module is a broken import (`from pkg import mod` and `from pkg.mod import x`)', async () => {
  const res = await replay(PY_BASE, (r) => r.rm('app/util.py'));
  assert.deepEqual(broken(res.brief), { 'app/util.py': ['use.py'] });
  assert.ok(res.brief.dependents.analyzers.includes('python-module'));
});

test('Python: a removed package __init__ breaks `from app.sub import x`, not `import app.sub.deep`', async () => {
  const res = await replay(PY_BASE, (r) => r.rm('app/sub/__init__.py'));
  assert.deepEqual(broken(res.brief), { 'app/sub/__init__.py': ['use_sub.py'] });
});

test('Python: a renamed module is a broken import for every untouched importer', async () => {
  const res = await replay(PY_BASE, (r) => r.mv('app/core.py', 'app/core2.py'));
  assert.deepEqual(broken(res.brief), { 'app/core.py': ['app/__init__.py', 'use.py'] });
});

test('Python: a module moved into a package of the same name still resolves (no item)', async () => {
  const res = await replay(PY_BASE, (r) => {
    r.rm('app/util.py');
    r.write({ 'app/util/__init__.py': 'Y = 2\n' });
  });
  assert.deepEqual(broken(res.brief), {});
});

test('isAncestorInit: only an __init__.py strictly above the named module', () => {
  assert.equal(isAncestorInit('use.py', 'app.sub.deep', 'app/sub/__init__.py'), true);
  assert.equal(isAncestorInit('use.py', 'app.sub', 'app/sub/__init__.py'), false);
  assert.equal(isAncestorInit('use.py', 'app.sub', 'src/app/__init__.py'), true);
  assert.equal(isAncestorInit('use.py', 'app', 'app/__init__.py'), false);
  assert.equal(isAncestorInit('app/x/m.py', '..sub.deep', 'app/sub/__init__.py'), true);
  assert.equal(isAncestorInit('app/x/m.py', '..sub', 'app/sub/__init__.py'), false);
  assert.equal(isAncestorInit('use.py', 'app.util', 'app/util.py'), false);
});

// ---- Negative controls ----------------------------------------------------------------------

test('negative: an importer updated in the same PR gives no item', async () => {
  const res = await replay(TS_BASE, (r) => {
    r.mv('src/alias.ts', 'src/alias2.ts');
    r.write({ 'src/user.ts': "import { alias } from '@/alias2';\nimport type { T } from './types';\nexport const load = async (): Promise<T> => (await import('./lazy')).lazy + alias;\n" });
  });
  assert.deepEqual(broken(res.brief), {});
});

test('negative: an importer deleted too gives no item', async () => {
  const res = await replay(TS_BASE, (r) => {
    r.rm('src/alias.ts');
    r.rm('src/user.ts');
  });
  assert.deepEqual(broken(res.brief), {});
});

test('negative: a re-export left at the old path gives no item', async () => {
  const res = await replay(TS_BASE, (r) => {
    r.write({ 'src/alias_moved.ts': 'export const alias = 1;\n', 'src/alias.ts': "export * from './alias_moved';\n" });
  });
  assert.deepEqual(broken(res.brief), {});
});

test('negative: a specifier that resolves elsewhere at head (index fallback) gives no item', async () => {
  const res = await replay(
    { 'src/foo.ts': 'export const foo = 1;\n', 'src/foo/index.ts': 'export const foo = 2;\n', 'src/use.ts': "import { foo } from './foo';\nexport const u = foo;\n" },
    (r) => r.rm('src/foo.ts'),
  );
  assert.deepEqual(broken(res.brief), {});
  assert.equal(res.brief.dependents.method, 'base-graph');
});

test('a changed importer that still imports the removed path (unresolved at head) is reported as changed', async () => {
  const res = await replay(TS_BASE, (r) => {
    r.rm('src/types.ts');
    r.write({ 'src/user.ts': "import { alias } from '@/alias';\nimport type { T } from './types';\nexport const load = async (): Promise<T> => (await import('./lazy')).lazy + alias + 1;\n" });
  });
  assert.deepEqual(broken(res.brief), { 'src/types.ts': ['src/user.ts'] });
  const d = res.brief.dependents.entries.find((e) => e.file === 'src/types.ts')!;
  assert.deepEqual(d.changedImporters, ['src/user.ts']);
  assert.deepEqual(d.untouchedImporters, []);
});

test('coverage: imports reported as broken are not counted as unresolved', async () => {
  const res = await replay(TS_BASE, (r) => r.rm('src/alias.ts'));
  assert.equal(res.brief.dependents.coverage, 'full');
  assert.equal(res.brief.dependents.unresolved.count, 0);
});

// ---- Base graph is built only when needed ---------------------------------------------------

function spyLibrary(): { file: string; log: () => string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'gutter-ra-spy31-'));
  dirs.push(dir);
  const real = resolve('node_modules/repo-archaeology/dist/api/index.js');
  const file = join(dir, 'spy.mjs');
  writeFileSync(file, `import * as real from ${JSON.stringify(new URL(`file://${real}`).href)};
export const version = '0.10.0';
export async function openRepository(opts) {
  const log = (globalThis.__gutterRaSpy31 ??= []);
  log.push('open:' + (opts.settings && opts.settings.maxCommits === 1 ? 'base' : 'head') + ':' + String(opts.useConfigFile));
  const repo = await real.openRepository(opts);
  const wrap = (name) => async (...args) => { log.push(name + (name === 'importGraph' ? ':' + JSON.stringify(args[0]?.files ?? null) : '')); return repo[name](...args); };
  return { root: repo.root, headSha: repo.headSha, diff: wrap('diff'), backtest: wrap('backtest'), importGraph: wrap('importGraph'), close: wrap('close') };
}
`);
  (globalThis as { __gutterRaSpy31?: string[] }).__gutterRaSpy31 = [];
  return { file, log: () => (globalThis as { __gutterRaSpy31?: string[] }).__gutterRaSpy31! };
}

test('no deletion or rename: no base graph is built (one session, no maxCommits:1 session)', async () => {
  const { r, base } = pr(TS_BASE, (x) => x.write({ 'src/alias.ts': 'export const alias = 2;\n' }));
  const spy = spyLibrary();
  let sessions = 0;
  const b = await buildBriefAsync({ cwd: r.dir, base, now: NOW, noCalibration: true, raLib: spy.file, onSession: (n) => (sessions = n) });
  assert.equal(sessions, 1);
  assert.equal(spy.log().filter((x) => x.startsWith('open:')).length, 1);
  assert.ok(!spy.log().some((x) => x.startsWith('open:base')));
  assert.equal(b.dependents.method, undefined);
});

test('a deletion: the base graph is a second, history-light session at the merge base, scoped to the removed files', async () => {
  const { r, base } = pr(TS_BASE, (x) => x.rm('src/alias.ts'));
  const spy = spyLibrary();
  let sessions = 0;
  const b = await buildBriefAsync({ cwd: r.dir, base, now: NOW, noCalibration: true, raLib: spy.file, onSession: (n) => (sessions = n) });
  assert.equal(sessions, 2);
  const log = spy.log();
  assert.deepEqual(log.filter((x) => x.startsWith('open:')), ['open:head:undefined', 'open:base:false']);
  assert.ok(log.includes('importGraph:["src/alias.ts"]'));
  assert.deepEqual(broken(b), { 'src/alias.ts': ['src/user.ts'] });
});

test('bench cache: two PRs on the same base tree share one base graph', async () => {
  const { r, base } = pr(TS_BASE, (x) => x.rm('src/alias.ts'));
  const head1 = r.git('rev-parse', 'HEAD').trim();
  r.git('checkout', '-q', base);
  r.branch('other');
  r.rm('src/types.ts').commit('rm types');
  const head2 = r.git('rev-parse', 'HEAD').trim();
  const cache = new Map();
  const a = await replayBriefWithMeta({ cwd: r.dir, base, head: head1, now: NOW, noCalibration: true, baseGraphCache: cache });
  const b = await replayBriefWithMeta({ cwd: r.dir, base, head: head2, now: NOW, noCalibration: true, baseGraphCache: cache });
  assert.equal(cache.size, 1);
  assert.ok((a.meta.stageTimingsMs.baseGraph ?? 0) > 0);
  assert.equal(b.meta.stageTimingsMs.baseGraph, 0);
  assert.deepEqual(broken(a.brief), { 'src/alias.ts': ['src/user.ts'] });
  assert.deepEqual(broken(b.brief), { 'src/types.ts': ['src/user.ts'] });
});

test('a failing base session falls back to the relative scan of the head graph (method relative-scan)', async () => {
  const { r, base, head } = pr({ 'src/a.ts': 'export const a = 1;\n', 'src/b.ts': "import { a } from './a';\nexport const b = a;\n" }, (x) => x.rm('src/a.ts'));
  const real = await loadRaLibrary();
  const flaky: LoadedRaLibrary = {
    version: real.version,
    openRepository: async (o) => {
      if ((o.settings as { maxCommits?: number } | undefined)?.maxCommits === 1) throw new Error('base session unavailable');
      return real.openRepository(o);
    },
  };
  const a = await analyzeWithLibrary(flaky, { cwd: r.dir, head, base, changedFiles: ['src/a.ts'], headFiles: new Set(['src/b.ts']), noHistory: true, removedFiles: ['src/a.ts'], baseTree: base });
  assert.equal(a.baseGraph, undefined);
  assert.equal(a.sessions, 2);
  const changes: ChangeStructure = { files: [{ path: 'src/a.ts', status: 'deleted', additions: 0, deletions: 1, binary: false, module: 'src', isTest: false, language: 'typescript' }], modules: [], totals: { files: 1, additions: 0, deletions: 1, modules: 1 } };
  const d = dependentsFromImportGraph(changes, a.graph!, a.repoGraph, a.baseGraph);
  assert.equal(d.method, 'relative-scan');
  assert.deepEqual(d.entries.map((e) => [e.file, e.untouchedImporters]), [['src/a.ts', ['src/b.ts']]]);
});

// ---- Fallback: the relative scanner, unchanged ---------------------------------------------

test('fallback golden: without the library the relative scanner is unchanged and says method relative-scan', async () => {
  const { r, base } = pr(
    {
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': "import { a } from './a';\nexport const b = a;\n",
      'src/c.ts': "import { a } from '@/a';\nexport const c = a;\n",
      'pkg/x.go': 'package pkg\n',
    },
    (x) => {
      x.rm('src/a.ts');
      x.write({ 'pkg/x.go': 'package pkg\n\nfunc X() {}\n' });
    },
  );
  const b = await buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: false, noHistory: true });
  assert.deepEqual(b.dependents, {
    analyzers: ['ts-js-relative-imports'],
    entries: [{ id: 'deps:src/a.ts', file: 'src/a.ts', deleted: true, changedImporters: [], untouchedImporters: ['src/b.ts'] }],
    unchecked: ['pkg/x.go'],
    coverage: 'partial',
    unresolved: { count: 1, samples: ['src/c.ts → @/a'] },
    scannedFiles: 2,
    method: 'relative-scan',
  });
  assert.deepEqual(broken(b), { 'src/a.ts': ['src/b.ts'] });
});

test('fallback: the scanner returns method relative-scan even when nothing is removed', () => {
  const r = new TempRepo().write({ 'a.ts': 'export const a = 1;\n' }).commit('init');
  repos.push(r);
  const d = buildDependents(r.dir, { files: [], modules: [], totals: { files: 0, additions: 0, deletions: 0, modules: 0 } });
  assert.equal(d.method, 'relative-scan');
});

// ---- GU-30's seven precision cases ----------------------------------------------------------

test('GU-30 case (binance, lerna, matrix): `export * as ns from` IS an import; Gutter is right, the oracle missed it', async () => {
  // Classification: oracle wrong. ts.preProcessFile drops namespace re-exports; the GU-31 oracle walks the AST.
  const src = "export * as NS from './a';\nexport * from './b';\n";
  assert.ok(!ts.preProcessFile(src, true, true).importedFiles.some((f) => f.fileName === './a'), 'preProcessFile misses it (GU-30 oracle)');
  assert.ok(importSpecifiers(src).includes('./a'), 'the GU-31 oracle sees it');
  const res = await replay({ 'src/a.ts': 'export const a = 1;\n', 'src/index.ts': "export * as A from './a';\n" }, (r) => r.rm('src/a.ts'));
  assert.deepEqual(broken(res.brief), { 'src/a.ts': ['src/index.ts'] });
});

test('GU-30 case (codegraph rename-updated "false positive"): a deep `await import()` IS an import; Gutter is right', async () => {
  // Classification: oracle wrong. The control did not rewrite this importer, so the rename really broke it.
  const filler = Array.from({ length: 40 }, (_, i) => `export function f${i}(x: number): number { return x + ${i}; }`).join('\n');
  const src = `import * as fs from 'fs';\n${filler}\nexport async function late() {\n  const { claude } = await import('../targets/claude');\n  return claude;\n}\n`;
  assert.ok(importSpecifiers(src, 'src/upgrade/index.ts').includes('../targets/claude'));
  const res = await replay(
    { 'src/targets/claude.ts': 'export const claude = 1;\n', 'src/upgrade/index.ts': src },
    (r) => r.mv('src/targets/claude.ts', 'src/targets/claude_seeded.ts'),
  );
  assert.deepEqual(broken(res.brief), { 'src/targets/claude.ts': ['src/upgrade/index.ts'] });
});

test('GU-30 case (codegraph delete-5): an importer with a NUL byte IS an importer; the oracle now reads it', async () => {
  // Classification: oracle wrong. GitTreeReader treats a NUL byte as binary; the seeded oracle reads the raw blob.
  const { r, base, head } = pr(
    { 'ui/screens-model.ts': 'export const s = 1;\n', 'ui/steps-model.ts': "import { s } from './screens-model';\nexport const k = (a: string, b: string) => `${a}\u0000${b}` + s;\n" },
    (x) => x.rm('ui/screens-model.ts'),
  );
  const reader = new GitTreeReader(r.dir, base);
  assert.equal(reader.readText('ui/steps-model.ts'), undefined, 'GU-30 oracle read nothing');
  reader.close();
  const t = gitTree(r.dir, base);
  assert.ok(t.read('ui/steps-model.ts')?.includes("from './screens-model'"));
  t.close();
  const res = await replayBriefWithMeta({ cwd: r.dir, base, head, now: NOW, noCalibration: true });
  assert.deepEqual(broken(res.brief), { 'ui/screens-model.ts': ['ui/steps-model.ts'] });
});

test('GU-30 case (telnyx rename-5): the moved copy importing its own old path is not a base importer, so no longer reported', async () => {
  // Classification: ambiguous. The moved file really is broken, but the oracle's ground truth covers base importers
  // only; under base-graph the item names exactly the base importers (the oracle's set).
  const res = await replay(
    { 'src/comments.ts': "import * as API from './comments';\nexport type C = API.X;\nexport interface X { a: 1 }\n", 'src/index.ts': "export * from './comments';\n" },
    (r) => r.mv('src/comments.ts', 'src/comments_seeded_moved.ts'),
  );
  assert.deepEqual(broken(res.brief), { 'src/comments.ts': ['src/index.ts'] });
});

// ---- Unit: brokenFromBaseGraph on synthetic graphs ------------------------------------------

const graph = (edges: RaImportGraph['edges'], files: string[], unresolved: RaImportGraph['unresolved'] = []): RaImportGraph => ({
  schemaVersion: 1, tool: { name: 'repo-archaeology', version: '0.10.0' }, meta: {}, files, edges, unresolved, languages: ['typescript', 'go', 'python'],
});
const chg = (files: { path: string; status: string; oldPath?: string }[]): ChangeStructure => ({
  files: files.map((f) => ({ ...f, status: f.status as 'deleted', additions: 0, deletions: 0, binary: false, module: '', isTest: false, language: null })),
  modules: [], totals: { files: files.length, additions: 0, deletions: 0, modules: 0 },
});

test('brokenFromBaseGraph: importers missing from the head analysis are never judged', () => {
  const base = graph([{ from: 'ignored.ts', to: 'a.ts', specifier: './a', kind: 'static', via: 'relative' }], ['ignored.ts', 'a.ts']);
  const head = graph([], ['b.ts']);
  assert.deepEqual(brokenFromBaseGraph(chg([{ path: 'a.ts', status: 'deleted' }]), new Set(['a.ts']), base, head), []);
});

test('brokenFromBaseGraph: unknown edge kinds are ignored; unknown `via` uses the "still resolves" rule', () => {
  const base = graph([
    { from: 'u.x', to: 'a.x', specifier: 'a', kind: 'macro', via: 'future' },
    { from: 'v.x', to: 'a.x', specifier: 'a', kind: 'static', via: 'future' },
    { from: 'w.x', to: 'a.x', specifier: 'a', kind: 'static', via: 'future' },
    { from: 'w.x', to: 'b.x', specifier: 'a', kind: 'static', via: 'future' },
  ], ['u.x', 'v.x', 'w.x', 'a.x', 'b.x']);
  const head = graph([{ from: 'w.x', to: 'b.x', specifier: 'a', kind: 'static', via: 'future' }], ['u.x', 'v.x', 'w.x', 'b.x']);
  assert.deepEqual(brokenFromBaseGraph(chg([{ path: 'a.x', status: 'deleted' }]), new Set(['a.x']), base, head).map((c) => c.importer), ['v.x']);
});

// ---- Contract ------------------------------------------------------------------------------

test('contract: old gutter.json fixtures validate; dependents.method is optional and validates', async () => {
  const dir = 'test/fixtures/gu29/legacy';
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { dependents?: { method?: unknown } };
    assert.equal(doc.dependents?.method, undefined, `${f} predates method`);
    assert.deepEqual(schemaProblems(doc), [], f);
  }
  const res = await replay(GO_BASE, (r) => r.rm('pkg/one/one.go'));
  assert.equal(res.brief.schemaVersion, 1);
  assert.deepEqual(schemaProblems(res.brief), []);
  const bad = structuredClone(res.brief) as unknown as { dependents: { method: string } };
  bad.dependents.method = 'guess';
  assert.match(schemaProblems(bad).join('\n'), /dependents\.method/);
  const schema = JSON.parse(readFileSync('schema/gutter.schema.json', 'utf8'));
  assert.ok(!schema.properties.dependents.required.includes('method'));
});
