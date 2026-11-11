/**
 * GU-32 · `coverage: partial` scoped to the PR's files (DECISIONS #21).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleBrief, buildBriefAsync, replayBriefWithMeta } from '../src/brief.ts';
import type { ChangeStructure, GutterBrief } from '../src/contract.ts';
import { barePackage, relevantTargets, scopeTargets, type ScopeTarget, type UnresolvedImport } from '../src/evidence/coverage-scope.ts';
import { dependentsFromImportGraph, entryReached } from '../src/evidence/import-graph.ts';
import { GitTreeReader } from '../src/source/reader.ts';
import type { RaImportGraph } from '../src/sources/archaeology-lib.ts';
import { lintPage, renderComic } from '../src/render/comic.ts';
import { renderMarkdown } from '../src/render/markdown.ts';
import { scenarios } from './fixtures/gu29/scenarios.ts';
import { TempRepo, lines, schemaProblems } from './helpers.ts';

const repos: TempRepo[] = [];
after(() => repos.forEach((r) => r.cleanup()));
const NOW = new Date('2026-11-11T12:00:00Z');

// ---- The rule, table-driven: each reason code × (changed file, removed file, nothing) -----------

const changed = (path: string, extra: Partial<ScopeTarget> = {}): ScopeTarget => ({ path, removed: false, ...extra });
const removed = (path: string, extra: Partial<ScopeTarget> = {}): ScopeTarget => ({ path, removed: true, ...extra });

interface Row {
  what: string;
  u: UnresolvedImport;
  /** Targets and whether `u` could reach each one. */
  cases: [ScopeTarget, boolean][];
}

const ROOT_PKG = { packageNames: ['root'], packageDir: '' };
const TS_ROWS: Row[] = [
  {
    what: 'relative target-missing: the normalized path names the file (any extension) or its directory',
    u: { from: 'src/a.ts', specifier: './b.js', reasonCode: 'target-missing' },
    cases: [[changed('src/b.ts'), true], [removed('src/b.ts'), true], [changed('src/b/index.ts'), false], [changed('src/c.ts'), false], [changed('lib/b.ts'), false]],
  },
  {
    what: 'relative directory specifier: files in that directory (its index, or a package entry)',
    u: { from: 'src/a.ts', specifier: './b', reasonCode: 'target-missing' },
    cases: [[changed('src/b/index.ts'), true], [removed('src/b.tsx'), true], [changed('src/bb/index.ts'), false]],
  },
  {
    what: 'relative invalid-target: a path out of the repository (node_modules) reaches nothing',
    u: { from: 'src/internal/types.ts', specifier: '../../../../node_modules/undici/index.d.ts', reasonCode: 'invalid-target' },
    cases: [[changed('src/internal/index.ts'), false], [removed('node_modules/undici/index.d.ts'), false]],
  },
  {
    what: 'relative directory import (`../..`) reaches files directly in that directory',
    u: { from: 'spec/integ/x.spec.js', specifier: '../..', reasonCode: 'target-missing' },
    cases: [[changed('index.js'), true], [removed('index.js'), true], [changed('src/index.ts'), false]],
  },
  {
    what: 'relative import of a directory with its own package.json: the package\'s entry-like files (main/exports)',
    u: { from: 'spec/integ/bridge.spec.js', specifier: '../..', reasonCode: 'target-missing' },
    cases: [
      [changed('src/index.ts', { packageNames: ['bridge'], packageDir: '' }), true],
      [removed('src/main.ts', { packageDir: '' }), true],
      [changed('src/utils/promise.ts', { packageNames: ['bridge'], packageDir: '' }), false],
      [changed('packages/x/src/index.ts', { packageNames: ['x', 'bridge'], packageDir: 'packages/x' }), false],
    ],
  },
  {
    what: 'alias-unmatched: the last segment names the stem',
    u: { from: 'src/a.ts', specifier: '@/utils/date', reasonCode: 'alias-unmatched' },
    cases: [[changed('src/utils/date.ts'), true], [removed('src/utils/date.ts'), true], [changed('src/utils/time.ts'), false]],
  },
  {
    what: 'alias-unmatched: the last segment names the directory',
    u: { from: 'src/a.ts', specifier: '~/widgets', reasonCode: 'alias-unmatched' },
    cases: [[changed('src/widgets/button.ts'), true], [removed('src/widgets/index.ts'), true], [changed('src/gadgets/button.ts'), false]],
  },
  {
    what: 'alias-unmatched: an `index` segment must also match the directory before it',
    u: { from: 'src/a.ts', specifier: '@/components/index', reasonCode: 'alias-unmatched' },
    cases: [[changed('src/components/index.ts'), true], [removed('src/components/index.tsx'), true], [changed('src/other/index.ts'), false]],
  },
  {
    what: 'unknown-package: relevant when a package.json at or above the file has that name',
    u: { from: 'apps/web/main.ts', specifier: '@ws/lib', reasonCode: 'unknown-package' },
    cases: [
      [changed('packages/lib/src/x.ts', { packageNames: ['@ws/lib', 'root'], packageDir: 'packages/lib' }), true],
      // Removed: its package.json may be gone too, so the package's directory name decides.
      [removed('packages/lib/src/x.ts', ROOT_PKG), true],
      [changed('packages/app/src/x.ts', { packageNames: ['@ws/app', 'root'], packageDir: 'packages/app' }), false],
    ],
  },
  {
    what: 'unknown-package: an external package is never relevant once the file\'s package name is known',
    u: { from: 'app/components/sd.tsx', specifier: 'react', reasonCode: 'unknown-package' },
    cases: [[changed('src/react/x.ts', { packageNames: ['app'], packageDir: '' }), false], [changed('src/react/x.ts'), true], [removed('src/other.ts'), false]],
  },
  {
    what: 'unknown-package with a subpath: the subpath\'s last segment, when no package name is known',
    u: { from: 'src/a.ts', specifier: 'katex/dist/katex.min.css', reasonCode: 'unknown-package' },
    cases: [[changed('src/katex.ts', ROOT_PKG), false], [removed('dist/katex.min.css'), true], [changed('src/other.ts'), false]],
  },
  {
    what: 'not-exported: the subpath\'s last segment names the file\'s directory',
    u: { from: 'docs/app.module.ts', specifier: '@allianz/ng-aquila/accordion', reasonCode: 'not-exported' },
    cases: [
      [changed('projects/ng-aquila/src/accordion/accordion.component.ts', { packageNames: ['@allianz/ng-aquila'] }), true],
      [removed('projects/ng-aquila/src/accordion/panel.ts'), true],
      [changed('projects/ng-aquila/src/button/button.component.ts', { packageNames: ['@allianz/ng-aquila'] }), false],
    ],
  },
  {
    what: 'target-missing bare package (exports into dist/): any file of that package',
    u: { from: 'clients/algo/src/algo.ts', specifier: '@binance/common', reasonCode: 'target-missing' },
    cases: [
      [changed('clients/common/src/configuration.ts', { packageNames: ['@binance/common'], packageDir: 'clients/common' }), true],
      [removed('clients/common/src/old.ts'), true],
      [changed('clients/algo/src/x.ts', { packageNames: ['@binance/algo'], packageDir: 'clients/algo' }), false],
    ],
  },
  {
    what: 'invalid-target `#` subpath import: by its last segment',
    u: { from: 'src/a.ts', specifier: '#internal/x', reasonCode: 'invalid-target' },
    cases: [[changed('src/internal/x.ts'), true], [removed('src/internal/x.ts'), true], [changed('src/internal/y.ts'), false]],
  },
  {
    what: 'ambiguous-package: any file of a package with that name',
    u: { from: 'src/a.ts', specifier: '@dup/pkg', reasonCode: 'ambiguous-package' },
    cases: [[changed('a/pkg/src/x.ts', { packageNames: ['@dup/pkg'] }), true], [removed('b/pkg/src/x.ts'), true], [changed('c/other/x.ts', { packageNames: ['@dup/other'] }), false]],
  },
  {
    what: 'unsupported-config, not a package (an unreadable tsconfig): every file in the importer\'s package',
    u: { from: 'apps/web/src/a.ts', specifier: '@/thing', reasonCode: 'unsupported-config' },
    cases: [
      [changed('apps/web/src/b.ts', { packageNames: ['web'], packageDir: 'apps/web' }), true],
      [removed('apps/web/src/c.ts', { packageDir: 'apps/web' }), true],
      [changed('apps/api/src/b.ts', { packageNames: ['api'], packageDir: 'apps/api' }), false],
    ],
  },
  {
    what: 'unsupported-config bare package (unreadable workspaces): the package by name or directory',
    u: { from: 'libs/commands/version/src/lib/git-add.ts', specifier: 'prettier', reasonCode: 'unsupported-config' },
    cases: [[changed('libs/core/src/x.ts', { packageNames: ['lerna-monorepo'] }), false], [removed('libs/prettier/src/x.ts'), true], [changed('libs/prettier/x.ts', { packageNames: ['lerna-monorepo'] }), true]],
  },
  {
    what: 'no reason code (an older Repo Archaeology): relevant to every file, as before',
    u: { from: 'src/a.ts', specifier: 'react' },
    cases: [[changed('src/x.ts', ROOT_PKG), true], [removed('src/y.ts'), true]],
  },
  {
    what: 'an unknown reason code: judged like the other non-package reasons (by segment)',
    u: { from: 'src/a.ts', specifier: '@/x', reasonCode: 'some-future-reason' },
    cases: [[changed('src/x.ts'), true], [removed('src/x.ts'), true], [changed('src/y.ts'), false]],
  },
  {
    what: 'a TS importer never reaches Go or Python files',
    u: { from: 'src/a.ts', specifier: './x', reasonCode: 'target-missing' },
    cases: [[changed('src/x.go'), false], [removed('src/x.py'), false]],
  },
];

const GO_MOD = { goModule: { dir: '', path: 'github.com/o/r' } };
const GO_ROWS: Row[] = [
  {
    what: 'target-missing: the import path\'s last segment names the package directory',
    u: { from: 'cmd/main.go', specifier: 'github.com/o/r/pkg/one', reasonCode: 'target-missing' },
    cases: [[changed('pkg/one/one.go', GO_MOD), true], [removed('pkg/one/one.go', GO_MOD), true], [changed('pkg/two/two.go', GO_MOD), false]],
  },
  {
    what: 'unsupported-config (no usable go.mod): by package directory',
    u: { from: 'tools/x/main.go', specifier: 'github.com/o/r/internal/x', reasonCode: 'unsupported-config' },
    cases: [[changed('internal/x/x.go'), true], [removed('internal/x/y.go'), true], [changed('internal/y/x.go'), false]],
  },
  {
    what: 'ambiguous-package: by package directory',
    u: { from: 'a.go', specifier: 'github.com/o/r/dup', reasonCode: 'ambiguous-package' },
    cases: [[changed('dup/a.go', GO_MOD), true], [removed('dup/b.go', GO_MOD), true], [changed('other/a.go', GO_MOD), false]],
  },
  {
    what: 'invalid-target: by package directory',
    u: { from: 'a.go', specifier: 'github.com/o/r/x/', reasonCode: 'invalid-target' },
    cases: [[changed('x/a.go', GO_MOD), true], [removed('x/a.go', GO_MOD), true], [changed('y/a.go', GO_MOD), false]],
  },
  {
    what: 'a module-root package: the module path\'s last segment (a /vN suffix dropped)',
    u: { from: 'sub/a.go', specifier: 'github.com/gin-gonic/gin/v2', reasonCode: 'target-missing' },
    cases: [
      [changed('gin.go', { goModule: { dir: '', path: 'github.com/gin-gonic/gin/v2' } }), true],
      [removed('context.go', { goModule: { dir: '', path: 'github.com/gin-gonic/gin/v2' } }), true],
      [changed('gin.go', { goModule: { dir: '', path: 'github.com/other/repo' } }), false],
      // A module root whose go.mod Gutter could not read: unknowable, so relevant.
      [changed('gin.go'), true],
      // A nested go.mod with no module line owns its directory; its path is unknowable, so relevant.
      [changed('svc/main.go', { goModule: { dir: 'svc', path: '' } }), true],
    ],
  },
  {
    what: 'a Go importer never reaches TS or Python files',
    u: { from: 'a.go', specifier: 'github.com/o/r/x', reasonCode: 'target-missing' },
    cases: [[changed('x/a.ts'), false], [removed('x/a.py'), false]],
  },
];

const PY_ROWS: Row[] = [
  {
    what: 'unknown-package (a script directory module): the module under any source root',
    u: { from: 'scripts/python/setup_plan.py', specifier: 'common', reasonCode: 'unknown-package' },
    cases: [[changed('scripts/python/common.py'), true], [removed('scripts/python/common.py'), true], [changed('scripts/python/other.py'), false]],
  },
  {
    what: 'target-missing relative: resolved from the importer\'s package',
    u: { from: 'yt_dlp/extractor/extractors.py', specifier: '.lazy_extractors', reasonCode: 'target-missing' },
    cases: [[changed('yt_dlp/extractor/lazy_extractors.py'), true], [removed('yt_dlp/extractor/lazy_extractors.py'), true], [changed('yt_dlp/extractor/common.py'), false]],
  },
  {
    what: 'relative with two dots: one package up',
    u: { from: 'devscripts/lazy_load_template.py', specifier: '..utils', reasonCode: 'target-missing' },
    cases: [[changed('utils.py'), true], [removed('utils/__init__.py'), true], [changed('yt_dlp/utils/_utils.py'), false]],
  },
  {
    what: 'absolute dotted module: the module, a package on its path, or a submodule',
    u: { from: 'tests/t.py', specifier: 'app.models.user', reasonCode: 'invalid-target' },
    cases: [[changed('src/app/models/user.py'), true], [removed('src/app/__init__.py'), true], [changed('src/app/views.py'), false]],
  },
  {
    what: 'unsupported-config / ambiguous-package / not-exported: the same module rule',
    u: { from: 'a.py', specifier: 'pkg.mod', reasonCode: 'ambiguous-package' },
    cases: [[changed('lib/pkg/mod.py'), true], [removed('pkg/mod/sub.py'), true], [changed('pkg/other.py'), false]],
  },
  {
    what: 'alias-unmatched never comes from Python; any code uses the module rule',
    u: { from: 'a.py', specifier: 'x', reasonCode: 'alias-unmatched' },
    cases: [[changed('x.pyi'), true], [removed('src/x/__init__.py'), true], [changed('y.py'), false]],
  },
  {
    what: 'a Python importer never reaches TS or Go files',
    u: { from: 'a.py', specifier: 'common', reasonCode: 'unknown-package' },
    cases: [[changed('common.ts'), false], [removed('common/x.go'), false]],
  },
];

for (const [lang, rows] of [['TS/JS', TS_ROWS], ['Go', GO_ROWS], ['Python', PY_ROWS]] as const) {
  test(`relevance rule, ${lang}: every row`, () => {
    for (const row of rows) {
      for (const [t, want] of row.cases) {
        const got = relevantTargets(row.u, [t]).length > 0;
        assert.equal(got, want, `${row.what}: ${row.u.from} → ${row.u.specifier} (${row.u.reasonCode ?? 'no code'}) vs ${t.removed ? 'removed' : 'changed'} ${t.path}`);
      }
    }
  });
}

test('relevance rule: every Repo Archaeology reason code is covered by a changed, a removed and an unrelated case', () => {
  const codes = ['alias-unmatched', 'unknown-package', 'target-missing', 'not-exported', 'invalid-target', 'unsupported-config', 'ambiguous-package'];
  for (const [lang, rows] of [['TS/JS', TS_ROWS], ['Go', GO_ROWS], ['Python', PY_ROWS]] as const) {
    const seen = new Map<string, Set<string>>();
    for (const r of rows) {
      const kinds = seen.get(r.u.reasonCode ?? '') ?? new Set<string>();
      for (const [t, want] of r.cases) kinds.add(want ? (t.removed ? 'removed' : 'changed') : 'nothing');
      seen.set(r.u.reasonCode ?? '', kinds);
    }
    // Repo Archaeology 0.10 emits no alias-unmatched, unknown-package or not-exported for Go, and no
    // alias-unmatched or not-exported for Python (`docs/json.md`); the rows cover the codes each language has.
    const expected = lang === 'TS/JS' ? codes : lang === 'Go' ? ['target-missing', 'unsupported-config', 'ambiguous-package', 'invalid-target'] : ['unknown-package', 'target-missing', 'invalid-target', 'ambiguous-package'];
    for (const code of expected) assert.deepEqual([...(seen.get(code) ?? [])].sort(), ['changed', 'nothing', 'removed'], `${lang} ${code}`);
  }
});

test('relevantTargets returns every target an import could reach, in order', () => {
  const u = { from: 'src/a.ts', specifier: '@/utils', reasonCode: 'alias-unmatched' };
  assert.deepEqual(relevantTargets(u, [changed('src/utils/a.ts'), changed('src/other.ts'), removed('src/utils.ts')]), ['src/utils/a.ts', 'src/utils.ts']);
});

test('barePackage: bare names and their subpath; aliases, paths and protocols are not packages', () => {
  assert.deepEqual(barePackage('@ws/lib/util/x'), { name: '@ws/lib', sub: 'util/x' });
  assert.deepEqual(barePackage('react'), { name: 'react', sub: '' });
  for (const spec of ['@/x', '~/x', '#internal/x', '$lib/x', './x', '../x', '/abs']) assert.equal(barePackage(spec), undefined, spec);
});

test('dependentsFromImportGraph: package context is read only when there is an unresolved import to judge', () => {
  let calls = 0;
  const targets = () => {
    calls++;
    return [changed('src/a.ts')];
  };
  const clean = graph({ files: ['src/a.ts'], unresolved: [] });
  assert.equal(dependentsFromImportGraph(struct(['src/a.ts']), clean, clean, undefined, undefined, targets).coverage, 'full');
  assert.equal(calls, 0);
  const dirty = graph({ files: ['src/a.ts', 'src/b.ts'], unresolved: [{ from: 'src/b.ts', specifier: '@/a', reason: 'unmatched', reasonCode: 'alias-unmatched' }, { from: 'src/b.ts', specifier: '@/z', reason: 'unmatched', reasonCode: 'alias-unmatched' }] });
  assert.equal(dependentsFromImportGraph(struct(['src/a.ts']), dirty, dirty, undefined, undefined, targets).coverage, 'partial');
  assert.equal(calls, 1, 'once, however many unresolved imports');
});

test('scopeTargets: a go.mod with no module line still owns its directory (module path unknown)', () => {
  const r = new TempRepo().write({ 'go.mod': 'module github.com/o/r\n', 'svc/go.mod': '// no module line\n', 'svc/main.go': 'package main\n' }).commit('init');
  repos.push(r);
  const reader = new GitTreeReader(r.dir, r.git('rev-parse', 'HEAD').trim());
  try {
    const [t] = scopeTargets({ files: [{ path: 'svc/main.go', status: 'modified', additions: 1, deletions: 0, binary: false, module: '', isTest: false, language: 'go' }], modules: [], totals: { files: 1, additions: 1, deletions: 0, modules: 0 } }, reader);
    assert.deepEqual(t!.goModule, { dir: 'svc', path: '' });
  } finally {
    reader.close();
  }
});

test('entryReached: a Go entry stands for its package directory', () => {
  assert.equal(entryReached('pkg/one/a.go', new Set(['pkg/one/b.go'])), true);
  assert.equal(entryReached('pkg/one/a.go', new Set(['pkg/two/b.go'])), false);
  assert.equal(entryReached('src/a.ts', new Set(['src/b.ts'])), false);
});

// ---- Package context read from the head tree ------------------------------------------------

test('scopeTargets: package.json names (nearest first), the nearest package directory and the go.mod module', () => {
  const r = new TempRepo()
    .write({
      'package.json': JSON.stringify({ name: 'root', private: true }),
      'packages/lib/package.json': JSON.stringify({ name: '@ws/lib' }),
      'packages/lib/src/x.ts': 'export const x = 1;\n',
      'packages/noname/package.json': JSON.stringify({ private: true }),
      'packages/noname/y.ts': 'export const y = 1;\n',
      'go.mod': 'module github.com/o/r\n\ngo 1.22\n',
      'pkg/one/one.go': 'package one\n',
      'svc/go.mod': 'module example.com/svc\n',
      'svc/main.go': 'package main\n',
    })
    .commit('init');
  repos.push(r);
  const sha = r.git('rev-parse', 'HEAD').trim();
  const reader = new GitTreeReader(r.dir, sha);
  try {
    const f = (path: string, status: 'modified' | 'deleted' = 'modified', oldPath?: string) => ({ path, status, additions: 1, deletions: 0, binary: false, module: '', isTest: false, language: null, ...(oldPath ? { oldPath } : {}) });
    const changes: ChangeStructure = {
      files: [f('packages/lib/src/x.ts'), f('packages/noname/y.ts'), f('pkg/one/one.go'), f('svc/main.go'), f('gone/z.ts', 'deleted'), f('packages/lib/src/new.ts', 'modified', 'packages/lib/src/old.ts')],
      modules: [],
      totals: { files: 6, additions: 6, deletions: 0, modules: 0 },
    };
    const byPath = Object.fromEntries(scopeTargets(changes, reader).map((t) => [t.path, t]));
    assert.deepEqual(byPath['packages/lib/src/x.ts'], { path: 'packages/lib/src/x.ts', removed: false, packageNames: ['@ws/lib', 'root'], packageDir: 'packages/lib' });
    assert.deepEqual(byPath['packages/noname/y.ts'], { path: 'packages/noname/y.ts', removed: false, packageNames: ['root'], packageDir: 'packages/noname' });
    assert.deepEqual(byPath['pkg/one/one.go']!.goModule, { dir: '', path: 'github.com/o/r' });
    assert.deepEqual(byPath['svc/main.go']!.goModule, { dir: 'svc', path: 'example.com/svc' });
    assert.equal(byPath['gone/z.ts']!.removed, true);
    assert.equal(byPath['packages/lib/src/old.ts']!.removed, true, 'a rename\'s old path is removed');
    assert.equal(byPath['packages/lib/src/new.ts']!.removed, false);
    // Without a reader: the paths only.
    assert.deepEqual(scopeTargets(changes).find((t) => t.path === 'packages/lib/src/x.ts'), { path: 'packages/lib/src/x.ts', removed: false });
  } finally {
    reader.close();
  }
});

// ---- The layer: relevant counts, coverage and per-entry coverage -----------------------------

function graph(partial: Partial<RaImportGraph>): RaImportGraph {
  return { schemaVersion: 1, tool: { name: 'repo-archaeology', version: '0.10.0' }, meta: {}, files: [], edges: [], unresolved: [], languages: ['typescript'], ...partial };
}
const struct = (paths: string[]): ChangeStructure => ({
  files: paths.map((path) => ({ path, status: 'modified', additions: 1, deletions: 0, binary: false, module: '', isTest: false, language: 'typescript' })),
  modules: [],
  totals: { files: paths.length, additions: paths.length, deletions: 0, modules: 0 },
});

test('dependentsFromImportGraph: repo-wide counts stay; relevant decides coverage; an entry it reaches is partial', () => {
  const g = graph({
    files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'fixtures/x.ts'],
    edges: [{ from: 'src/b.ts', to: 'src/a.ts', specifier: './a', kind: 'static', via: 'relative' }],
    unresolved: [
      { from: 'fixtures/x.ts', specifier: 'left-pad', reason: 'unmatched', reasonCode: 'unknown-package' },
      { from: 'fixtures/x.ts', specifier: './missing', reason: 'unmatched', reasonCode: 'target-missing' },
      { from: 'src/c.ts', specifier: '@/a', reason: 'unmatched', reasonCode: 'alias-unmatched' },
    ],
  });
  const unrelated = dependentsFromImportGraph(struct(['src/b.ts']), g, g, undefined, undefined, [changed('src/b.ts', ROOT_PKG)]);
  assert.equal(unrelated.coverage, 'full');
  assert.deepEqual(unrelated.unresolved, {
    count: 3,
    samples: ['fixtures/x.ts → ./missing', 'fixtures/x.ts → left-pad', 'src/c.ts → @/a'],
    byReason: { 'unknown-package': 1, 'target-missing': 1, 'alias-unmatched': 1 },
    relevant: { count: 0, samples: [], byReason: {} },
  });

  const reaching = dependentsFromImportGraph(struct(['src/a.ts']), g, g, undefined, undefined, [changed('src/a.ts', ROOT_PKG)]);
  assert.equal(reaching.coverage, 'partial');
  assert.equal(reaching.unresolved.count, 3, 'repo-wide count unchanged');
  assert.deepEqual(reaching.unresolved.relevant, { count: 1, samples: ['src/c.ts → @/a'], byReason: { 'alias-unmatched': 1 } });
  assert.deepEqual(reaching.entries, [{ id: 'deps:src/a.ts', file: 'src/a.ts', deleted: false, changedImporters: [], untouchedImporters: ['src/b.ts'], coverage: 'partial' }]);
});

// ---- Replays: an unrelated dangling import vs one that could reach the PR's file -------------

const DANGLING = {
  'package.json': JSON.stringify({ name: 'app', private: true }),
  'tsconfig.json': JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler' } }),
  'src/a.ts': 'export const a = 1;\n',
  'src/b.ts': "import { a } from './a';\nexport const b = a;\n",
  'src/lib/util.ts': 'export const util = 1;\n',
  'src/d.ts': "import { util } from './lib/util';\nexport const d = util;\n",
  // Dangling, and unrelated to src/a.ts: a missing fixture (`left-pad`, undeclared, is external to Repo Archaeology).
  'fixtures/old.ts': "import { gone } from './gone';\nimport pad from 'left-pad';\nexport const o = gone + pad;\n",
  // Unresolved (no `paths` configured), and could reach src/lib/util.ts.
  'src/c.ts': "import { util } from '@/lib/util';\nexport const c = util;\n",
};

async function replayDangling(mutate: (r: TempRepo) => void): Promise<GutterBrief> {
  const r = new TempRepo().write(DANGLING).commit('init');
  repos.push(r);
  const base = r.git('rev-parse', 'HEAD').trim();
  r.branch('feature');
  mutate(r);
  r.commit('change');
  const res = await replayBriefWithMeta({ cwd: r.dir, base, head: r.git('rev-parse', 'HEAD').trim(), now: NOW, noCalibration: true });
  return res.brief;
}

test('replay: a PR that does not touch what a dangling import could reach is full; the repo-wide count stays', async () => {
  const b = await replayDangling((r) => r.write({ 'src/a.ts': `export const a = 2;\n${lines(12)}` }));
  assert.equal(b.dependents.coverage, 'full');
  assert.equal(b.dependents.unresolved.count, 2);
  assert.deepEqual(b.dependents.unresolved.relevant, { count: 0, samples: [], byReason: {} });
  assert.equal(b.dependents.entries.find((e) => e.file === 'src/a.ts')?.coverage, 'full');
  assert.deepEqual(schemaProblems(b), []);
  // A one-file PR is a quiet comment either way; the page shows the repo-wide count as a quiet line.
  assert.equal(renderMarkdown(b).includes('partial'), false);
});

test('replay: a PR whose changed file an unresolved import could reach is partial, and so is that entry', async () => {
  const b = await replayDangling((r) => r.write({ 'src/lib/util.ts': `export const util = 2;\n${lines(12)}` }));
  assert.equal(b.dependents.coverage, 'partial');
  assert.equal(b.dependents.unresolved.count, 2);
  assert.deepEqual(b.dependents.unresolved.relevant, { count: 1, samples: ['src/c.ts → @/lib/util'], byReason: { 'alias-unmatched': 1 } });
  assert.deepEqual(b.dependents.entries.find((e) => e.file === 'src/lib/util.ts'), {
    id: 'deps:src/lib/util.ts',
    file: 'src/lib/util.ts',
    deleted: false,
    changedImporters: [],
    untouchedImporters: ['src/d.ts'],
    coverage: 'partial',
  });
  assert.deepEqual(schemaProblems(b), []);
});

test('scanner fallback: the same rule (an alias by its last segment; an unrelated alias leaves it full)', async () => {
  const run = async (mutate: (r: TempRepo) => void) => {
    const r = new TempRepo().write(DANGLING).commit('init');
    repos.push(r);
    const base = r.git('rev-parse', 'HEAD').trim();
    r.branch('feature');
    mutate(r);
    r.commit('change');
    return buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: false, noHistory: true });
  };
  const far = await run((r) => r.write({ 'src/a.ts': `export const a = 2;\n${lines(12)}` }));
  assert.equal(far.dependents.method, 'relative-scan');
  assert.equal(far.dependents.coverage, 'full');
  assert.deepEqual(far.dependents.unresolved, { count: 1, samples: ['src/c.ts → @/lib/util'], relevant: { count: 0, samples: [] } });
  const near = await run((r) => r.write({ 'src/lib/util.ts': `export const util = 2;\n${lines(12)}` }));
  assert.equal(near.dependents.coverage, 'partial');
  assert.deepEqual(near.dependents.unresolved.relevant, { count: 1, samples: ['src/c.ts → @/lib/util'] });
  assert.equal(near.dependents.entries.find((e) => e.file === 'src/lib/util.ts')?.coverage, 'partial');
});

test('scanner fallback: a workspace package import is relevant only when that package holds a changed file', async () => {
  const files = {
    'package.json': JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }),
    'packages/lib/package.json': JSON.stringify({ name: '@ws/lib' }),
    'packages/lib/index.ts': 'export const lib = 1;\n',
    'packages/app/package.json': JSON.stringify({ name: '@ws/app', dependencies: { '@ws/lib': 'workspace:*' } }),
    'packages/app/main.ts': "import { lib } from '@ws/lib';\nimport { h } from './h';\nexport const m = lib + h;\n",
    'packages/app/h.ts': 'export const h = 1;\n',
  };
  const run = async (path: string) => {
    const r = new TempRepo().write(files).commit('init');
    repos.push(r);
    const base = r.git('rev-parse', 'HEAD').trim();
    r.branch('feature').write({ [path]: `export const z = 2;\n${lines(12)}` }).commit('change');
    return buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: false, noHistory: true });
  };
  assert.equal((await run('packages/app/h.ts')).dependents.coverage, 'full');
  assert.equal((await run('packages/lib/index.ts')).dependents.coverage, 'partial');
});

// ---- Contract --------------------------------------------------------------------------------

test('contract: old gutter.json fixtures validate without the new fields; the new fields validate; bad values do not', async () => {
  const dir = 'test/fixtures/gu29/legacy';
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8')) as GutterBrief;
    assert.equal(doc.dependents.unresolved.relevant, undefined, `${f} predates GU-32`);
    assert.ok(doc.dependents.entries.every((e) => e.coverage === undefined), `${f} predates GU-32`);
    assert.deepEqual(schemaProblems(doc), [], f);
  }
  const b = await replayDangling((r) => r.write({ 'src/lib/util.ts': `export const util = 2;\n${lines(12)}` }));
  assert.deepEqual(schemaProblems(b), []);
  const badEntry = structuredClone(b) as unknown as { dependents: { entries: { coverage: string }[] } };
  badEntry.dependents.entries[0]!.coverage = 'some';
  assert.match(schemaProblems(badEntry).join('\n'), /coverage/);
  const badRelevant = structuredClone(b) as unknown as { dependents: { unresolved: { relevant: { count?: number; samples: string[] } } } };
  delete badRelevant.dependents.unresolved.relevant.count;
  badRelevant.dependents.unresolved.relevant.samples = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(schemaProblems(badRelevant), ['$.dependents.unresolved.relevant.count missing', '$.dependents.unresolved.relevant.samples length 6 exceeds maxItems 5']);
  const schema = JSON.parse(readFileSync('schema/gutter.schema.json', 'utf8'));
  assert.ok(!schema.properties.dependents.properties.unresolved.required.includes('relevant'));
  assert.ok(!schema.properties.dependents.properties.entries.items.required.includes('coverage'));
});

// ---- Renderer goldens: full, partial (relevant), repo-wide only, and a pre-GU-32 brief --------

const GOLDEN_DIR = 'test/fixtures/gu32';
const UPDATE = process.env.UPDATE_GOLDENS === '1';

function partialScenarioBrief(deps: Partial<GutterBrief['dependents']>, entryCoverage?: 'full' | 'partial'): GutterBrief {
  const s = scenarios().find((x) => x.name === 'partial')!;
  const dependents = { ...s.dependents, ...deps, entries: s.dependents.entries.map((e) => ({ ...e, ...(entryCoverage ? { coverage: entryCoverage } : {}) })) };
  return assembleBrief({ ...s, dependents });
}

/** Just the "What it touches" parts: the Markdown lines and the HTML panel. */
function touches(b: GutterBrief): string {
  const md = renderMarkdown(b);
  const start = md.indexOf('<details><summary><b>What it touches');
  const tests = md.indexOf('<details><summary><b>Tests');
  const mdPart = md.slice(start, tests).trimEnd();
  const page = renderComic(b);
  const panel = /<section class="panel area-touches[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';
  assert.ok(panel, 'the HTML page has a touches panel');
  assert.deepEqual(lintPage(page), []);
  return `${mdPart}\n\n----- html -----\n${panel.replace(/\n\s+/g, '\n')}\n`;
}

const GOLDENS: [string, () => GutterBrief][] = [
  ['full', () => partialScenarioBrief({ coverage: 'full', unresolved: { count: 0, samples: [], byReason: {}, relevant: { count: 0, samples: [], byReason: {} } } }, 'full')],
  [
    'partial',
    () => partialScenarioBrief({
      analyzers: ['ra-import-graph', 'relative'],
      coverage: 'partial',
      unresolved: { count: 7, samples: ['src/app.ts → @/core/router', 'src/b.ts → @/x', 'src/c.ts → @/y', 'src/d.ts → @/z', 'src/e.ts → @/w'], byReason: { 'alias-unmatched': 7 }, relevant: { count: 1, samples: ['src/app.ts → @/core/router'], byReason: { 'alias-unmatched': 1 } } },
    }, 'partial'),
  ],
  [
    'repo-wide-only',
    () => partialScenarioBrief({
      analyzers: ['ra-import-graph', 'relative'],
      coverage: 'full',
      unresolved: { count: 7, samples: ['src/b.ts → @/x', 'src/c.ts → @/y', 'src/d.ts → @/z', 'src/e.ts → @/w', 'src/f.ts → left-pad'], byReason: { 'alias-unmatched': 6, 'unknown-package': 1 }, relevant: { count: 0, samples: [], byReason: {} } },
    }, 'full'),
  ],
  // A pre-GU-32 brief: no `relevant`, no entry coverage; renders exactly as before.
  ['legacy-partial', () => partialScenarioBrief({})],
];

for (const [name, make] of GOLDENS) {
  test(`renderer golden: ${name}`, () => {
    const got = touches(make());
    const file = join(GOLDEN_DIR, `${name}.touches.txt`);
    if (UPDATE) {
      mkdirSync(GOLDEN_DIR, { recursive: true });
      writeFileSync(file, got);
    }
    assert.equal(got, readFileSync(file, 'utf8'), `${file} (UPDATE_GOLDENS=1 to rewrite deliberately)`);
  });
}

test('renderers: "partial" appears only under the new meaning\'s partial, or in a pre-GU-32 partial brief', () => {
  const [full, partial, repoWide, legacy] = GOLDENS.map(([, make]) => make());
  for (const b of [full!, repoWide!]) {
    assert.equal(/partial/i.test(renderMarkdown(b)), false);
    assert.equal(renderComic(b).includes('<span class="stamp">partial</span>'), false);
  }
  for (const b of [partial!, legacy!]) {
    assert.match(renderMarkdown(b), /\(partial\)/);
    assert.ok(renderComic(b).includes('<span class="stamp">partial</span>'));
  }
  assert.match(renderMarkdown(legacy!), /7 imports in this repository could not be resolved to a file|7 imports use aliases or packages Gutter can't resolve yet/);
});

test('coverage never creates or suppresses an item: salience and checklist ignore coverage and unresolved', () => {
  for (const s of scenarios()) {
    const mk = (coverage: 'full' | 'partial', relevant: number) =>
      assembleBrief({ ...s, dependents: { ...s.dependents, coverage, unresolved: { count: 9, samples: [], byReason: { 'alias-unmatched': 9 }, relevant: { count: relevant, samples: [], byReason: {} } }, entries: s.dependents.entries.map((e) => ({ ...e, coverage })) } });
    const full = mk('full', 0);
    const partial = mk('partial', 3);
    assert.equal(partial.salience.level, full.salience.level, s.name);
    assert.deepEqual(partial.checklist, full.checklist, s.name);
  }
});
