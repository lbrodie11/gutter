import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBrief } from '../src/brief.ts';
import { GUTTER_VERSION } from '../src/version.ts';
import { TempRepo, check, lines, raBacktestFixture, raDiffFixture, root } from './helpers.ts';

test('GUTTER_VERSION in src/version.ts matches package.json version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  assert.equal(GUTTER_VERSION, pkg.version);
});

const r = new TempRepo()
  .write({ 'src/a.ts': 'export const a = 1;\n', 'src/b.ts': "import './a';\n", 'src/a.test.ts': "import './a';\n" })
  .commit('init').branch('f')
  .write({ 'src/a.ts': `export const a = 2;\n${lines(20)}` }).commit('change');
after(() => r.cleanup());

test('a real brief satisfies every required field, enum, and maxItems constraint in schema/gutter.schema.json', () => {
  const brief = buildBrief({ cwd: r.dir, base: 'main', raDiff: raDiffFixture({ families: [{ id: 'x', label: 'l', why: 'w', members: [{ path: 'src/a.ts' }, { path: 'src/z.ts' }, { path: 'src/y.ts' }], changedMembers: ['src/a.ts'] }] }), raBacktest: raBacktestFixture(0.5) });
  const problems: string[] = [];
  check(root, brief, '$', problems);
  assert.deepEqual(problems, []);
  assert.equal(brief.dependents.coverage, 'full');
  assert.deepEqual(brief.dependents.unresolved, { count: 0, samples: [], relevant: { count: 0, samples: [] } });
  assert.ok(brief.forgotten.families.length && brief.forgotten.items.length && brief.tests.length && brief.dependents.entries.length, 'fixture should exercise every layer');

  // Also check schema conformance when coverage is partial with >5 unresolved imports (capped to 5 samples).
  // GU-32: the alias imports name the files this PR changes, so they are relevant (and capped) too.
  const imp = (s: string) => `imp${'ort'} '${s}';\n`;
  const mods = [1, 2, 3, 4, 5, 6, 7];
  const partialRepo = new TempRepo()
    .write({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': mods.map((i) => imp(`@/mod${i}`)).join(''),
      ...Object.fromEntries(mods.map((i) => [`src/mod${i}.ts`, 'export const m = 1;\n'])),
    })
    .commit('init')
    .branch('p')
    .write({ 'src/a.ts': `export const a = 2;\n${lines(15)}`, ...Object.fromEntries(mods.map((i) => [`src/mod${i}.ts`, 'export const m = 2;\n'])) })
    .commit('edit a');
  try {
    const partialBrief = buildBrief({ cwd: partialRepo.dir, base: 'main', noHistory: true });
    const partialProblems: string[] = [];
    check(root, partialBrief, '$', partialProblems);
    assert.deepEqual(partialProblems, []);
    assert.equal(partialBrief.dependents.coverage, 'partial');
    assert.equal(partialBrief.dependents.unresolved.count, 7);
    assert.equal(partialBrief.dependents.unresolved.samples.length, 5);
    assert.equal(partialBrief.dependents.unresolved.relevant?.count, 7);
    assert.equal(partialBrief.dependents.unresolved.relevant?.samples.length, 5);
  } finally {
    partialRepo.cleanup();
  }
});
