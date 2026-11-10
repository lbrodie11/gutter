/**
 * GU-29 benchmark artifacts: both hono runs are committed, the report generator reproduces
 * results.json and the STAGE0.md block, and the Gate A′ checker re-checks facts independently.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildBrief } from '../src/brief.ts';
import type { GutterBrief } from '../src/contract.ts';
import { TreeHost, bannedHits, checkFacts, neutralize } from '../bench/gate-a-prime.ts';
// @ts-expect-error: plain .mjs report script without type declarations
import { buildResults, evaluateGate, renderGu29, MARK_GU29_START, MARK_GU29_END } from '../bench/gu29-report.mjs';
import { TempRepo, lines } from './helpers.ts';

const D = new URL('../docs/benchmark/data/honojs__hono/', import.meta.url);
const load = (rel: string) => JSON.parse(readFileSync(new URL(rel, D), 'utf8'));

test('bench: both hono runs are committed, on the pinned SHA and analyzer, with the right config', () => {
  for (const [run, overrides] of [['default', {}], ['legacy', { legacyPredictions: true }]] as const) {
    assert.ok(existsSync(new URL(`gu29/${run}/bench.json`, D)) && existsSync(new URL(`gu29/${run}/bench.md`, D)), run);
    const m = load(`gu29/${run}/bench.json`);
    assert.equal(m.repo.headSha, 'eb754bd5ef22c63f1634a4c374a86be086f85710');
    assert.equal(m.tools.repoArchaeology, '0.10.0');
    assert.equal(m.settings.windowDays, 7);
    assert.equal(m.prs.length, 200);
    assert.deepEqual(m.settings.configOverrides ?? {}, overrides);
  }
});

test('bench: the report generator reproduces results.json and the STAGE0.md block exactly', () => {
  const results = buildResults({
    defaultModel: load('gu29/default/bench.json'),
    legacyModel: load('gu29/legacy/bench.json'),
    beforeModel: load('stage0b/default/bench.json'),
    gate: load('gu29/gate-a-prime.json'),
  });
  const committed = load('gu29/results.json');
  assert.deepEqual(results, committed);
  const doc = readFileSync(new URL('../docs/benchmark/STAGE0.md', import.meta.url), 'utf8');
  const block = doc.slice(doc.indexOf(MARK_GU29_START), doc.indexOf(MARK_GU29_END) + MARK_GU29_END.length);
  assert.equal(block, renderGu29(committed));
  // The numbers the PR reports.
  assert.equal(committed.reproduction.prsDiffering, 0);
  assert.equal(committed.reproduction.aggregatesIdentical, true);
  assert.equal(committed.default.salience.full.numerator, 0);
  assert.equal(committed.default.byKind['forgotten-companion'], 0);
  assert.equal(evaluateGate(committed.gate).verdict, 'PASS (partly unexercised)');
  assert.match(doc.trimEnd(), /Decision: see \[DECISIONS #17\]\([^)]+\)\.\*\*$/);
});

test('bench: Gate A′ never calls a criterion met when it had no items', () => {
  const g = load('gu29/results.json').gate;
  const none = { ...g, b: { ...g.b, untestedChange: { ...g.b.untestedChange, checked: 0, confirmed: 0, met: null } } };
  assert.match(evaluateGate(none).verdict, /unexercised/);
  const failed = { ...g, a: { ...g.a, met: false } };
  assert.equal(evaluateGate(failed).verdict, 'FAIL');
});

// ---- The Gate A′ checker on a repository built for it ---------------------------------------

const repos: TempRepo[] = [];
after(() => repos.forEach((r) => r.cleanup()));

function fixtureRepo(): { r: TempRepo; brief: GutterBrief; base: string; head: string } {
  const r = new TempRepo()
    .write({
      'tsconfig.json': JSON.stringify({ compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' } }),
      'src/old.ts': 'export const old = 1;\n',
      'src/c.ts': "import { old } from './old.js';\nexport const c = old;\n",
      'src/a.ts': 'export const a = 1;\n',
      'src/a.test.ts': "import { a } from './a.js';\n",
    })
    .commit('init')
    .branch('f');
  repos.push(r);
  r.rm('src/old.ts');
  r.write({ 'src/a.ts': `export const a = 2;\n${lines(14)}` }).commit('drop old, grow a');
  const base = r.git('rev-parse', 'main').trim();
  const head = r.git('rev-parse', 'HEAD').trim();
  const brief = buildBrief({ cwd: r.dir, base: 'main', noHistory: true });
  return { r, brief, base, head };
}

test('gate checker: TypeScript confirms a real broken import and the unchanged-test fact', () => {
  const { r, brief, base, head } = fixtureRepo();
  assert.deepEqual(brief.checklist.map((c) => c.kind), ['broken-import', 'untested-change']);
  const facts = checkFacts(r.dir, 'pr', brief, base, head, { base: new TreeHost(r.dir, base), head: new TreeHost(r.dir, head) });
  assert.deepEqual(
    facts.map((f) => [f.kind, f.confirmed]),
    [['broken-import', true], ['untested-change', true]],
    JSON.stringify(facts),
  );
  assert.deepEqual(bannedHits(neutralize(brief)), []);
});

test('gate checker: a fabricated fact is rejected', () => {
  const { r, brief, base, head } = fixtureRepo();
  const trees = { base: new TreeHost(r.dir, base), head: new TreeHost(r.dir, head) };
  const forged = structuredClone(brief);
  const entry = forged.dependents.entries.find((d) => d.deleted)!;
  entry.untouchedImporters = ['src/a.test.ts']; // imports ./a.js, not the removed file
  entry.changedImporters = [];
  const item = forged.checklist.find((c) => c.kind === 'untested-change')!;
  item.question = item.question.replace(/\(\+\d+/, '(+999');
  const facts = checkFacts(r.dir, 'pr', forged, base, head, trees);
  assert.deepEqual(facts.map((f) => [f.kind, f.confirmed]), [['broken-import', false], ['untested-change', false]]);
});
