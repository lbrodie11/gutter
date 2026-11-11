/**
 * GU-30 · corpus run: oracle, seeded-mutation generator, plumbing commits.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyTree, brokenEdges, commitMutation, generate, GoOracle, memTree, mulberry32, oracleFor, PyOracle, repoSeed, TsOracle, type Lang, type Tree } from '../bench/seeded.ts';
import { TempRepo } from './helpers.ts';

// ---- Fixtures -------------------------------------------------------------------------------

function tsFixture(): Tree {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*', 'packages/*'] }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] }, moduleResolution: 'bundler', module: 'esnext' } }),
    'src/x.ts': 'export const x = 1;\n',
    'src/types.ts': 'export interface T { a: number }\n',
    'src/alias-user.ts': "import { x } from '@/x';\nexport const y = x;\n",
    'src/type-user.ts': "import type { T } from './types';\nexport const t: T = { a: 1 };\n",
    'src/orphan.ts': 'export const orphan = 1;\n',
    'src/x.test.ts': "import { x } from './x';\n",
    'packages/ui/package.json': JSON.stringify({ name: '@acme/ui', version: '1.0.0', exports: { '.': './src/index.ts', './button': './src/button.ts' } }),
    'packages/ui/src/index.ts': "export * from './button';\n",
    'packages/ui/src/button.ts': 'export const Button = 1;\n',
    'apps/web/package.json': JSON.stringify({ name: 'web', dependencies: { '@acme/ui': 'workspace:*' } }),
    'apps/web/src/page.ts': "import { Button } from '@acme/ui/button';\nexport const p = Button;\n",
    'apps/web/src/root.ts': "import { Button } from '@acme/ui';\nexport const r = Button;\n",
  };
  for (let i = 0; i < 12; i++) {
    files[`src/lib/m${i}.ts`] = `export const m${i} = ${i};\n`;
    files[`src/lib/use${i}.ts`] = `import { m${i} } from './m${i}';\nexport const u${i} = m${i};\n`;
    files[`src/lib/m${i}.test.ts`] = `import { m${i} } from './m${i}';\n`;
  }
  return memTree(files);
}

function goFixture(): Tree {
  const files: Record<string, string> = {
    'go.mod': 'module example.com/app\n\ngo 1.22\n',
    'main.go': 'package main\n\nimport (\n\t"fmt"\n\t"example.com/app/pkg/util"\n)\n\nfunc main() { fmt.Println(util.X) }\n',
    'pkg/util/util.go': 'package util\n\nconst X = 1\n',
    'pkg/util/util_test.go': 'package util\n',
    'pkg/multi/a.go': 'package multi\n',
    'pkg/multi/b.go': 'package multi\n',
    'cmd/tool/main.go': 'package main\n\nimport m "example.com/app/pkg/multi"\n\nvar _ = m.A\n',
  };
  for (let i = 0; i < 10; i++) {
    files[`pkg/p${i}/p.go`] = `package p${i}\n\nconst V = ${i}\n`;
    files[`pkg/p${i}/p_test.go`] = `package p${i}\n`;
    files[`cmd/use${i}/main.go`] = `package main\n\nimport "example.com/app/pkg/p${i}"\n\nvar _ = p${i}.V\n`;
  }
  return memTree(files);
}

function pyFixture(): Tree {
  const files: Record<string, string> = {
    'pyproject.toml': '[project]\nname = "app"\n',
    'src/app/__init__.py': '',
    'src/app/core.py': 'X = 1\n',
    'src/app/cli.py': 'from app.core import X\nfrom . import helpers\nprint(X)\n',
    'src/app/helpers.py': 'H = 1\n',
    'src/app/unused.py': 'U = 1\n',
    'tests/test_core.py': 'from app.core import X\n',
  };
  for (let i = 0; i < 10; i++) {
    files[`src/app/m${i}.py`] = `V = ${i}\n`;
    files[`src/app/use${i}.py`] = `from .m${i} import V\n`;
    files[`tests/test_m${i}.py`] = `import app.m${i}\n`;
  }
  return memTree(files);
}

const del = (...paths: string[]) => new Map<string, string | null>(paths.map((p) => [p, null]));

// ---- Oracle ---------------------------------------------------------------------------------

test('oracle: an alias import (@/x) resolves to its file, and deleting the file breaks it', () => {
  const tree = tsFixture();
  const o = new TsOracle(tree);
  assert.equal(o.resolve('src/alias-user.ts', '@/x'), 'src/x.ts');
  const edges = o.edges(['src/alias-user.ts']);
  assert.deepEqual(brokenEdges('typescript', tree, edges, del('src/x.ts')).map((e) => e.importer), ['src/alias-user.ts']);
});

test('oracle: a workspace import and an exports subpath resolve to the package source', () => {
  const o = new TsOracle(tsFixture());
  assert.equal(o.resolve('apps/web/src/page.ts', '@acme/ui/button'), 'packages/ui/src/button.ts');
  assert.equal(o.resolve('apps/web/src/root.ts', '@acme/ui'), 'packages/ui/src/index.ts');
  assert.equal(o.resolve('apps/web/src/page.ts', 'react'), undefined, 'external packages are not repository files');
});

test('oracle: a type-only import counts as an importer', () => {
  const tree = tsFixture();
  const edges = new TsOracle(tree).edges(['src/type-user.ts']);
  assert.deepEqual(edges.map((e) => [e.specifier, e.target]), [['./types', 'src/types.ts']]);
  assert.equal(brokenEdges('typescript', tree, edges, del('src/types.ts')).length, 1);
});

test('oracle: a re-export left at the old path is a negative (nothing breaks)', () => {
  const tree = tsFixture();
  const edges = new TsOracle(tree).edges(['src/alias-user.ts']);
  const changes = new Map<string, string | null>([['src/x_seeded_moved.ts', 'export const x = 1;\n'], ['src/x.ts', "export * from './x_seeded_moved';\n"]]);
  assert.deepEqual(brokenEdges('typescript', tree, edges, changes), []);
});

test('oracle: a Go package import breaks only when the package has no non-test files left', () => {
  const tree = goFixture();
  const o = new GoOracle(tree);
  assert.equal(o.resolve('main.go', 'example.com/app/pkg/util'), 'pkg/util');
  assert.equal(o.resolve('main.go', 'fmt'), undefined);
  const edges = o.edges(o.tree.files.filter((f) => f.endsWith('.go')));
  assert.deepEqual(brokenEdges('go', tree, edges, del('pkg/util/util.go')).map((e) => e.importer), ['main.go'], 'tests alone do not keep a package importable');
  assert.deepEqual(brokenEdges('go', tree, edges, del('pkg/multi/a.go')), [], 'b.go still provides the package');
});

test('oracle: Python absolute, relative and from-package imports resolve to module files', () => {
  const tree = pyFixture();
  const o = new PyOracle(tree);
  assert.equal(o.resolve('src/app/cli.py', 'app.core'), 'src/app/core.py');
  assert.equal(o.resolve('src/app/use1.py', '.m1'), 'src/app/m1.py');
  assert.equal(o.resolve('src/app/cli.py', '.:helpers'), 'src/app/helpers.py');
  const edges = o.edges(tree.files.filter((f) => f.endsWith('.py')));
  assert.deepEqual(brokenEdges('python', tree, edges, del('src/app/core.py')).map((e) => e.importer).sort(), ['src/app/cli.py', 'tests/test_core.py']);
  assert.deepEqual(brokenEdges('python', tree, edges, del('src/app/unused.py')), []);
});

// ---- Generator ------------------------------------------------------------------------------

for (const [lang, fixture] of [['typescript', tsFixture], ['go', goFixture], ['python', pyFixture]] as const) {
  test(`generator (${lang}): deterministic for a seed; positives break an untouched importer, negatives break none`, () => {
    const run = () => generate(lang as Lang, 'a'.repeat(40), fixture(), mulberry32(repoSeed('fixture/repo')), { positives: 8, negatives: 8 });
    const a = run();
    const b = run();
    const shape = (r: typeof a) => r.mutations.map((m) => [m.kind, m.positive, [...m.changes.keys()], m.broken.map((e) => e.importer)]);
    assert.deepEqual(shape(a), shape(b), 'same seed, same mutations');
    assert.ok(a.mutations.some((m) => m.positive) && a.mutations.some((m) => !m.positive), JSON.stringify(a.meta));
    const tree = fixture();
    const { oracle, sources } = oracleFor(lang as Lang, tree);
    const edges = oracle.edges(sources);
    for (const m of a.mutations) {
      const broken = brokenEdges(lang as Lang, tree, edges, m.changes);
      if (m.positive) {
        assert.ok(broken.length >= 1, `${m.id}: a positive breaks at least one importer`);
        assert.ok(broken.every((e) => !m.changes.has(e.importer)), `${m.id}: its importers are untouched`);
      } else {
        assert.deepEqual(broken, [], `${m.id}: a negative breaks nothing at head`);
      }
    }
    // The different seed gives a different (still valid) selection.
    const c = generate(lang as Lang, 'a'.repeat(40), fixture(), mulberry32(repoSeed('other/repo')), { positives: 8, negatives: 8 });
    assert.ok(c.mutations.length > 0);
  });
}

test('generator: every negative kind that applies is produced (TS)', () => {
  const r = generate('typescript', 'a'.repeat(40), tsFixture(), mulberry32(1), { positives: 4, negatives: 8 });
  const kinds = new Set(r.mutations.filter((m) => !m.positive).map((m) => m.kind));
  for (const k of ['rename-updated', 'delete-unimported', 'move-reexport', 'test-only']) assert.ok(kinds.has(k as never), `${k} in ${[...kinds]}`);
});

// ---- Plumbing -------------------------------------------------------------------------------

const repos: TempRepo[] = [];
after(() => repos.forEach((r) => r.cleanup()));

test('plumbing: a mutation is one commit on the host, deterministic, written without a checkout', () => {
  const r = new TempRepo().write({ 'src/a.ts': 'export const a = 1;\n', 'src/b.ts': "import { a } from './a';\n" }).commit('init');
  repos.push(r);
  const host = r.git('rev-parse', 'HEAD').trim();
  const m = { id: 'x', kind: 'rename' as const, positive: true, host, removed: ['src/a.ts'], broken: [], changes: new Map<string, string | null>([['src/a.ts', null], ['src/a_seeded_moved.ts', 'export const a = 1;\n']]) };
  const c1 = commitMutation(r.dir, m);
  const c2 = commitMutation(r.dir, m);
  assert.equal(c1, c2, 'fixed author, committer and date');
  assert.equal(r.git('rev-parse', `${c1}^`).trim(), host);
  assert.deepEqual(r.git('diff', '--no-renames', '--name-status', host, c1).trim().split('\n').sort(), ['A\tsrc/a_seeded_moved.ts', 'D\tsrc/a.ts']);
  assert.equal(r.git('rev-parse', 'HEAD').trim(), host, 'HEAD and the working tree are untouched');
  void applyTree;
});

// ---- Bench records carry coverage (requirement 3) ---------------------------------------------

test('bench records: coverage, unresolvedByReason and uncheckedLanguages are present and match the brief', async () => {
  const { runBench } = await import('../src/bench/runner.ts');
  const { replayBriefWithMeta } = await import('../src/brief.ts');
  const { coverageFields } = await import('../src/bench/runner.ts');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const r = new TempRepo().write({
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/a.ts': 'export const a = 1;\n',
    'src/b.ts': "import { a } from './a';\nimport { z } from '@/nope';\n",
    'lib/x.rb': 'x = 1\n',
  }).commit('init');
  repos.push(r);
  r.write({ 'src/a.ts': 'export const a = 2;\n', 'lib/x.rb': 'x = 2\n' }).commit('feat: edit a and x (#1)');
  r.write({ 'src/b.ts': "import { a } from './a';\nexport const b = a;\n" }).commit('fix: b (#2)');
  const out = mkdtempSync(join(tmpdir(), 'gutter-gu30-bench-'));
  try {
    const model = await runBench({ cwd: r.dir, outDir: out, prs: 2, windowDays: 7, now: new Date(Date.now() + 30 * 86_400_000) });
    assert.equal(model.prs.length, 2);
    for (const pr of model.prs) {
      assert.ok(pr.coverage === 'full' || pr.coverage === 'partial');
      assert.ok(pr.unresolvedByReason && typeof pr.unresolvedByReason === 'object');
      assert.ok(Array.isArray(pr.uncheckedLanguages));
      const { brief } = await replayBriefWithMeta({ cwd: r.dir, base: pr.base, head: pr.head, noCalibration: true });
      assert.deepEqual(
        { coverage: pr.coverage, unresolvedByReason: pr.unresolvedByReason, relevantUnresolvedByReason: pr.relevantUnresolvedByReason, uncheckedLanguages: pr.uncheckedLanguages },
        coverageFields(brief),
        `${pr.id} matches its brief`,
      );
    }
    const first = model.prs.find((p) => p.prNumber === 1)!;
    assert.deepEqual(first.uncheckedLanguages, ['ruby'], 'the changed Ruby file has no analyzer');
    // GU-32: `@/nope` is unresolved repository-wide, but cannot reach src/a.ts or lib/x.rb, so coverage is full.
    assert.equal(first.coverage, 'full', 'an alias that matches no changed file leaves coverage full');
    assert.ok(Object.values(first.unresolvedByReason!).reduce((a, b) => a + b, 0) >= 1);
    assert.deepEqual(first.relevantUnresolvedByReason, {});
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('oracle (erratum 1): directory specifiers like "." and "./dir" resolve in both TypeScript oracles', async () => {
  const tree = memTree({
    'src/m/index.ts': 'export const m = 1;\n',
    'src/m/index.test.ts': "import { m } from '.';\n",
    'src/user.ts': "import { m } from './m';\n",
  });
  const o = new TsOracle(tree);
  assert.equal(o.resolve('src/m/index.test.ts', '.'), 'src/m/index.ts');
  assert.equal(o.resolve('src/user.ts', './m'), 'src/m/index.ts');
  const edges = o.edges(tree.files);
  assert.deepEqual(brokenEdges('typescript', tree, edges, del('src/m/index.ts')).map((e) => e.importer).sort(), ['src/m/index.test.ts', 'src/user.ts']);
  // gate-a-prime's TreeHost, on a real commit.
  const r = new TempRepo().write({ 'src/m/index.ts': 'export const m = 1;\n', 'src/m/index.test.ts': "import { m } from '.';\n" }).commit('init');
  repos.push(r);
  const { TreeHost, resolveSpecifiers } = await import('../bench/gate-a-prime.ts');
  const sha = r.git('rev-parse', 'HEAD').trim();
  const host = new TreeHost(r.dir, sha);
  const map = resolveSpecifiers("import { m } from '.';\n", 'src/m/index.test.ts', host, host.compilerOptions());
  assert.equal(map.get('.'), 'src/m/index.ts');
});

test('generator: negative kinds are taken round robin, starting at a different kind per host', () => {
  const counts = (offset: number) => {
    const r = generate('typescript', 'a'.repeat(40), tsFixture(), mulberry32(7), { positives: 2, negatives: 8 }, offset);
    const c: Record<string, number> = {};
    for (const m of r.mutations.filter((x) => !x.positive)) c[m.kind] = (c[m.kind] ?? 0) + 1;
    return { c, first: r.mutations.find((x) => !x.positive)!.kind, firstPositive: r.mutations.find((x) => x.positive)!.kind };
  };
  const a = counts(0);
  assert.deepEqual(a.c, { 'rename-updated': 2, 'delete-unimported': 2, 'move-reexport': 2, 'test-only': 2 });
  assert.equal(a.first, 'rename-updated');
  assert.equal(a.firstPositive, 'delete');
  const b = counts(1);
  assert.equal(b.first, 'delete-unimported');
  assert.equal(b.firstPositive, 'rename');
});
