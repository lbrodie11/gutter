import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, assertEvidenceResolves } from '../src/brief.ts';
import type { GutterBrief } from '../src/contract.ts';
import { TempRepo, lines, raBacktestFixture, raDiffFixture } from './helpers.ts';

let repo: TempRepo;
let brief: GutterBrief;

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

test('finds untouched importers, resolving the .js → .ts ESM convention', () => {
  const a = brief.dependents.entries.find((e) => e.file === 'src/a.ts');
  assert.ok(a);
  assert.deepEqual(a.untouchedImporters, ['src/a.test.ts', 'src/b.ts']);
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
  const companions = brief.checklist.filter((c) => c.kind === 'forgotten-companion');
  assert.equal(companions.length, 1);
  assert.match(companions[0]!.question, /`db\/schema\.sql` changed alongside `src\/a\.ts` in 14 of its 19 commits/);
});

test('checklist is capped, prioritized, and every item cites real evidence', () => {
  assert.ok(brief.checklist.length <= 4);
  const priorities = brief.checklist.map((c) => c.priority);
  assert.deepEqual(priorities, [...priorities].sort((x, y) => x - y));
  assert.doesNotThrow(() => assertEvidenceResolves(brief));
  assert.equal(brief.salience.level, 'full');
});

test('measured calibration is reported with Repo Archaeology’s lift definition', () => {
  assert.equal(brief.calibration.status, 'measured');
  assert.equal(brief.calibration.precision, 0.6);
  assert.ok(Math.abs(brief.calibration.lift! - 0.75 / 0.1) < 1e-9);
});

test('poor measured precision suppresses co-change questions', () => {
  const b = buildBrief({ cwd: repo.dir, base: 'main', raDiff: raDiffFixture(), raBacktest: raBacktestFixture(0.1) });
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

test('counts unresolved path-alias imports so panel 3 never silently claims no dependents', () => {
  const r = new TempRepo()
    .write({
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@app/*': ['./src/*'] } } }),
      'src/components/x.ts': 'export const x = 1;\n',
      'src/page.ts': "import { x } from '@/components/x';\nimport { y } from '@app/components/x';\nimport { z } from '~/lib/z';\nimport { w } from '#internal/w';\nimport 'react';\n",
    })
    .commit('init')
    .branch('alias-change')
    .write({ 'src/components/x.ts': `export const x = 2;\n${lines(15)}` })
    .commit('edit x');
  try {
    const b = buildBrief({ cwd: r.dir, base: 'main', noHistory: true });
    assert.equal(b.dependents.entries.length, 0);
    assert.equal(b.dependents.unresolvedAliases, 4);
  } finally {
    r.cleanup();
  }
});
