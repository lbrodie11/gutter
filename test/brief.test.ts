import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrief, assertEvidenceResolves } from '../src/brief.ts';
import { buildDependents, classifyNonRelativeSpecifier, extractSpecifiers } from '../src/evidence/imports.ts';
import type { GutterBrief } from '../src/contract.ts';
import { TempRepo, lines, raBacktestFixture, raDiffFixture } from './helpers.ts';

const GUTTER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let repo: TempRepo;
let brief: GutterBrief;
/** Same inputs under the GU-29 research switch: the pre-GU-29 companion questions live here now. */
let legacyBrief: GutterBrief;

before(() => {
  repo = new TempRepo()
    .write({
      'src/a.ts': `export const a = 1;\n${lines(3)}`,
      'src/b.ts': `import { a } from './a.js';\nexport const b = a + 1;\n`,
      'src/a.test.ts': `import { a } from './a';\n`,
      'src/old.ts': `export const old = 1;\n`,
      'src/c.ts': `import { old } from './old';\nexport const c = old;\n`,
      'src/r.ts': `export const r = 1;\n`,
      'src/d.ts': `export { r } from './r';\n`,
      'db/schema.sql': `create table orders();\n`,
    })
    .commit('initial')
    .branch('feature')
    .write({ 'src/a.ts': `export const a = 2;\n${lines(15, 'changed')}` })
    .rm('src/old.ts')
    .mv('src/r.ts', 'src/renamed.ts')
    .commit('feature: rework a, drop old, rename r');

  brief = buildBrief({
    cwd: repo.dir, base: 'main', repoUrl: 'https://github.com/acme/shop', prNumber: 7,
    raDiff: raDiffFixture(), raBacktest: raBacktestFixture(0.6),
    now: new Date('2026-11-06T00:00:00Z'),
  });
  legacyBrief = buildBrief({
    cwd: repo.dir, base: 'main', repoUrl: 'https://github.com/acme/shop', prNumber: 7,
    raDiff: raDiffFixture(), raBacktest: raBacktestFixture(0.6),
    now: new Date('2026-11-06T00:00:00Z'), config: { legacyPredictions: true },
  });
});

after(() => repo.cleanup());

test('reads the change structure, including deletes and renames', () => {
  const byPath = Object.fromEntries(brief.changes.files.map((f) => [f.path, f]));
  assert.equal(byPath['src/a.ts']?.status, 'modified');
  assert.equal(byPath['src/old.ts']?.status, 'deleted');
  assert.equal(byPath['src/renamed.ts']?.status, 'renamed');
  assert.equal(byPath['src/renamed.ts']?.oldPath, 'src/r.ts');
  assert.equal(brief.change.prNumber, 7);
  assert.equal(brief.change.title, 'feature: rework a, drop old, rename r');
});

test('finds untouched importers, resolving the .js → .ts ESM convention, with full coverage when only relative imports exist', () => {
  const a = brief.dependents.entries.find((e) => e.file === 'src/a.ts');
  assert.ok(a);
  assert.deepEqual(a.untouchedImporters, ['src/a.test.ts', 'src/b.ts']);
  assert.equal(brief.dependents.coverage, 'full');
  assert.deepEqual(brief.dependents.unresolved, { count: 0, samples: [], relevant: { count: 0, samples: [] } });
});

test('flags imports of deleted and renamed-away paths as broken', () => {
  const broken = brief.checklist.filter((c) => c.kind === 'broken-import').map((c) => c.id).sort();
  assert.deepEqual(broken, ['check:broken:src/old.ts', 'check:broken:src/r.ts']);
});

test('links source files to their tests', () => {
  const t = brief.tests.find((x) => x.source === 'src/a.ts');
  assert.equal(t?.status, 'test-untouched');
  assert.equal(t?.candidates[0]?.path, 'src/a.test.ts');
});

test('maps co-change with Wilson intervals and flags bot-backed evidence', () => {
  const [schema, legacy] = brief.forgotten.items;
  assert.equal(schema?.file, 'db/schema.sql');
  assert.ok(schema!.interval.low > 0.48 && schema!.interval.low < 0.54, `low=${schema!.interval.low}`);
  assert.equal(schema?.automationShare, 0);
  assert.equal(legacy?.automationShare, 1);
});

test('asks about strong companions only, never weak or bot-backed ones', () => {
  // GU-29: companion questions exist only under `legacyPredictions`; the default checklist has none.
  assert.equal(brief.checklist.filter((c) => c.kind === 'forgotten-companion').length, 0);
  const companions = legacyBrief.checklist.filter((c) => c.kind === 'forgotten-companion');
  assert.equal(companions.length, 1);
  assert.match(companions[0]!.question, /`db\/schema\.sql` changed alongside `src\/a\.ts` in 14 of its 19 commits/);
});

test('checklist is capped, prioritized, and every item cites real evidence', () => {
  for (const b of [brief, legacyBrief]) {
    assert.ok(b.checklist.length <= 4);
    const priorities = b.checklist.map((c) => c.priority);
    assert.deepEqual(priorities, [...priorities].sort((x, y) => x - y));
    assert.doesNotThrow(() => assertEvidenceResolves(b));
    assert.equal(b.salience.level, 'full');
  }
});

test('measured calibration is reported with Repo Archaeology’s lift definition', () => {
  assert.equal(brief.calibration.status, 'measured');
  assert.equal(brief.calibration.precision, 0.6);
  assert.ok(Math.abs(brief.calibration.lift! - 0.75 / 0.1) < 1e-9);
});

test('poor measured precision suppresses co-change questions', () => {
  // Legacy path only: by default co-change never becomes a question, whatever the calibration.
  const b = buildBrief({ cwd: repo.dir, base: 'main', raDiff: raDiffFixture(), raBacktest: raBacktestFixture(0.1), config: { legacyPredictions: true } });
  assert.equal(b.checklist.filter((c) => c.kind === 'forgotten-companion').length, 0);
  assert.equal(b.forgotten.items.length, 2, 'evidence is still shown, just not asked about');
});

test('without history, co-change is reported as unavailable, not as "nothing found"', () => {
  const b = buildBrief({ cwd: repo.dir, base: 'main', noHistory: true });
  assert.equal(b.forgotten.status, 'unavailable');
  assert.equal(b.calibration.status, 'unavailable');
});

test('rejects a Repo Archaeology payload from an incompatible schema version', () => {
  const bad = { ...raDiffFixture(), schemaVersion: 2 } as unknown as ReturnType<typeof raDiffFixture>;
  assert.throws(() => buildBrief({ cwd: repo.dir, base: 'main', raDiff: bad }), /schemaVersion 1/);
});

test('the brief never contains absolute local paths', () => {
  assert.equal(JSON.stringify(brief).includes(repo.dir), false);
});

test('classifies non-relative specifiers into external (Node builtins + declared package.json deps) vs unresolved', () => {
  const declared = new Set(['react', '@octokit/rest']);
  assert.equal(classifyNonRelativeSpecifier('node:fs', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('fs/promises', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('stream/web', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('bun:test', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('npm:find-my-way', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('virtual:pwa-register', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('$app/environment', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('react', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('react/jsx-runtime', declared), 'external');
  assert.equal(classifyNonRelativeSpecifier('@octokit/rest/endpoints', declared), 'external');

  // Non-builtin subpaths (`stream/utils`) must not be mistaken for Node built-ins (`isBuiltin('stream/utils') === false`).
  assert.equal(classifyNonRelativeSpecifier('stream/utils', declared), 'unresolved');
  assert.equal(classifyNonRelativeSpecifier('stream/utils', new Set(['stream']), ['stream/']), 'unresolved');
  assert.equal(classifyNonRelativeSpecifier('@/a', declared, ['@/']), 'unresolved');
  assert.equal(classifyNonRelativeSpecifier('~/utils', declared), 'unresolved');
  assert.equal(classifyNonRelativeSpecifier('#internal/db', declared), 'unresolved');
  assert.equal(classifyNonRelativeSpecifier('@acme/workspace-pkg', declared), 'unresolved');

  const r = new TempRepo()
    .write({
      'package.json': JSON.stringify({
        name: 'fixture-app',
        dependencies: { react: '^19.0.0', '@acme/shared': 'workspace:*' },
      }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }),
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': "import 'node:fs';\nimport 'react';\nimport 'react/jsx-runtime';\nimport '@/a';\n",
    })
    .commit('init')
    .branch('alias-change')
    .write({ 'src/a.ts': `export const a = 2;\n${lines(15)}` })
    .commit('edit a');
  try {
    const b = buildBrief({ cwd: r.dir, base: 'main', noHistory: true });
    assert.equal(b.dependents.entries.length, 0);
    assert.equal(b.dependents.coverage, 'partial');
    assert.equal(b.dependents.unresolved.count, 1);
    assert.deepEqual(b.dependents.unresolved.samples, ['src/b.ts → @/a']);
  } finally {
    r.cleanup();
  }
});

test('builtin-prefixed tsconfig alias (stream/*) is detected as unresolved rather than a Node builtin', () => {
  const r = new TempRepo()
    .write({
      'package.json': JSON.stringify({ name: 'stream-alias-app' }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { 'stream/*': ['src/stream/*'] } } }),
      'src/stream/utils.ts': 'export const u = 1;\n',
      'src/b.ts': "import { u } from 'stream/utils';\nexport const b = u;\n",
    })
    .commit('init')
    .branch('stream-alias')
    .write({ 'src/stream/utils.ts': `export const u = 2;\n${lines(15)}` })
    .commit('update stream utils');
  try {
    const b = buildBrief({ cwd: r.dir, base: 'main', noHistory: true });
    assert.equal(b.dependents.entries.length, 0);
    assert.equal(b.dependents.coverage, 'partial');
    assert.equal(b.dependents.unresolved.count, 1);
    assert.deepEqual(b.dependents.unresolved.samples, ['src/b.ts → stream/utils']);
  } finally {
    r.cleanup();
  }
});

test('extractSpecifiers handles inline dynamic imports, require chains, Next.js route paths, and ignores strings/comments', () => {
  const sample = [
    "// import 'commented-out'",
    "/* import 'block-commented' */",
    "const workspaces = ['packages/*', 'apps/*'];",
    "type Kind = 'broken-import' | 'forgotten-companion';",
    "const msg = `${plural(n, 'import')} ${n === 1 ? 'uses' : 'use'} aliases`;",
    "const obj = { kind: 'broken-import', question: `from 'not-an-import'` };",
    "const inline = \"import 'node:fs'; import '@/fake'\";",
    "import { readFileSync } from 'node:fs';",
    "import { x } from '../[id]/utils';",
    "import Layout from './(marketing)/layout';",
    "import './my file';",
    "const route = { path: 'admin', component: () => import('./Admin') };",
    "jest.mock('./api', () => require('./api.mock'));",
    "const a = require('./a'), b = require('./b');",
  ].join('\n');
  assert.deepEqual(extractSpecifiers(sample), [
    'node:fs',
    '../[id]/utils',
    './(marketing)/layout',
    './my file',
    './Admin',
    './api.mock',
    './a',
    './b',
  ]);

  // Dogfood check: scanning all tracked .ts files in Gutter itself finds zero unresolved imports
  const selfDeps = buildDependents(GUTTER_ROOT, {
    files: [
      {
        path: 'src/contract.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        binary: false,
        module: 'src',
        isTest: false,
        language: 'typescript',
      },
    ],
    modules: [{ name: 'src', files: 1, additions: 1, deletions: 0 }],
    totals: { files: 1, additions: 1, deletions: 0, modules: 1 },
  });
  assert.ok(selfDeps.scannedFiles >= 20, `expected >=20 scanned files, got ${selfDeps.scannedFiles}`);
  assert.equal(selfDeps.coverage, 'full');
  assert.equal(selfDeps.unresolved.count, 0);
  assert.deepEqual(selfDeps.unresolved.samples, []);
});
