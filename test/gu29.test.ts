/**
 * GU-29 · Explain, don't predict.
 *
 * Fixture scenarios live in test/fixtures/gu29/scenarios.ts; their pre-GU-29 gutter.json output
 * (captured at 2dc9b82, before any GU-29 source change) lives in test/fixtures/gu29/legacy/.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { assembleBrief, buildBrief, replayBrief } from '../src/brief.ts';
import { buildChecklist, salienceOf } from '../src/evidence/checklist.ts';
import { parseGutterConfigObject } from '../src/config.ts';
import type { ChangeStructure, ChecklistItem, GutterBrief } from '../src/contract.ts';
import { renderComic, lintPage } from '../src/render/comic.ts';
import { renderMarkdown, COMMENT_MARKER } from '../src/render/markdown.ts';
import { summaryLine } from '../src/output.ts';
import { normalizeForLegacyCompare, scenarios, type Scenario } from './fixtures/gu29/scenarios.ts';
import { TempRepo, lines, raBacktestFixture, raDiffFixture } from './helpers.ts';

const LEGACY_DIR = new URL('./fixtures/gu29/legacy/', import.meta.url);
const byName = (name: string): Scenario => scenarios().find((s) => s.name === name)!;
const brief = (s: Scenario, config = s.config): GutterBrief => assembleBrief({ ...s, config });
const legacy = (s: Scenario, extra: Record<string, unknown> = {}): GutterBrief =>
  assembleBrief({ ...s, config: { ...s.config, legacyPredictions: true, ...extra } });
const kinds = (b: GutterBrief) => b.checklist.map((c) => c.kind);

/** Every default-mode surface a reader sees: page, comment (with a page link), CLI summary. */
function surfaces(b: GutterBrief): { html: string; markdown: string; comment: string; cli: string } {
  return {
    html: renderComic(b),
    markdown: renderMarkdown(b),
    comment: renderMarkdown(b, { pageUrl: 'https://github.com/example/widgets/actions/runs/1' }),
    cli: summaryLine(b),
  };
}

const BANNED = /forgot|likely forgotten|you may have missed|untested|not covered/i;

// ---- Research switch -------------------------------------------------------------------------

test('legacyPredictions: gutter.json is byte-identical to the pre-GU-29 output on every committed fixture', () => {
  const goldens = readdirSync(LEGACY_DIR).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(goldens, scenarios().map((s) => `${s.name}.json`).sort(), 'one golden per scenario');
  for (const s of scenarios()) {
    const expected = readFileSync(new URL(`${s.name}.json`, LEGACY_DIR), 'utf8');
    assert.equal(normalizeForLegacyCompare(legacy(s)), expected, `${s.name}: legacy output drifted`);
  }
});

test('legacyPredictions: an explicit salienceFullMinSignals overrides the legacy default of 1', () => {
  const s = byName('cochange-test-missed');
  assert.equal(legacy(s).salience.level, 'full', 'legacy: one companion question is full');
  assert.equal(legacy(s, { salienceFullMinSignals: 2 }).salience.level, 'brief');
  // ...and an explicit 1 wins over the new default of 2.
  assert.equal(brief(byName('huge'), { salienceFullMinSignals: 1 }).salience.level, 'full');
  assert.equal(salienceOf(changes(9, 1), [], { salienceFullMinSignals: 1 }).level, 'full');
});

test('legacyPredictions parses as a boolean and gutter bench --config accepts it', () => {
  assert.deepEqual(parseGutterConfigObject({ legacyPredictions: true }), { legacyPredictions: true });
  assert.deepEqual(parseGutterConfigObject({ legacyPredictions: 'yes' }), {});
  const variant = JSON.parse(readFileSync(new URL('../bench/variants/gu29-legacy.json', import.meta.url), 'utf8'));
  assert.deepEqual(parseGutterConfigObject(variant), variant, 'the committed legacy variant runs exactly as written');
});

// ---- Default checklist: facts only ----------------------------------------------------------

test('default: a co-change partner and a ghost wire yield no forgotten-companion or family-drift items', () => {
  for (const s of scenarios()) {
    const b = brief(s);
    assert.ok(!kinds(b).some((k) => k === 'forgotten-companion' || k === 'family-drift'), `${s.name}: ${kinds(b)}`);
  }
  const n = brief(byName('normal'));
  assert.ok(n.forgotten.items.some((f) => f.relationship === 'ghost'), 'the fixture does carry a ghost wire');
  assert.ok(n.forgotten.families.length > 0, 'and a parallel family');
  assert.deepEqual(kinds(n), ['untested-change'], 'the asked-set suppression is gone, so the test fact appears');
});

test('default: a co-change-only PR gets no checklist item from co-change and is never full', () => {
  const b = brief(byName('cochange-only'));
  assert.deepEqual(b.checklist, []);
  assert.notEqual(b.salience.level, 'full');
  assert.equal(b.salience.level, 'quiet');
  assert.equal(b.forgotten.items.length, 2, 'the history is still in gutter.json');
  assert.equal(b.forgotten.presentation, 'context');
});

test('default: untested-change is a statement with the same gate, cap and priority', () => {
  const b = brief(byName('history-unavailable'));
  const item = b.checklist.find((c) => c.kind === 'untested-change')!;
  assert.equal(item.question, "`src/orders/a.ts` changed (+22/−4); its test file `src/orders/a.test.ts` didn't change in this PR.");
  assert.equal(item.priority, 4);
  assert.ok(!/\?/.test(item.question), 'a statement, not a question');
  // Gate: below minChurnForTestQuestion nothing is said.
  assert.equal(brief(byName('history-unavailable'), { minChurnForTestQuestion: 27 }).checklist.length, 0);
  // Cap: one item even when several sources qualify.
  assert.equal(kinds(brief(byName('huge'))).filter((k) => k === 'untested-change').length, 1);
});

// ---- Salience -------------------------------------------------------------------------------

function changes(files: number, modules: number): ChangeStructure {
  return { files: [], modules: [], totals: { files, additions: files * 3, deletions: 0, modules } };
}
const broken = (n: number): ChecklistItem => ({ id: `check:broken:src/${n}.ts`, kind: 'broken-import', question: 'q', evidence: [`deps:src/${n}.ts`], priority: 1 });
const testFact: ChecklistItem = { id: 'check:test:src/a.ts', kind: 'untested-change', question: 'q', evidence: ['tests:src/a.ts'], priority: 4 };

test('salience by default: two broken imports or one plus breadth is full; anything less is not', () => {
  assert.equal(salienceOf(changes(2, 1), [broken(1), broken(2)]).level, 'full', 'two broken imports, no breadth');
  assert.equal(salienceOf(changes(8, 1), [broken(1)]).level, 'full', 'one broken import + >= 8 files');
  assert.equal(salienceOf(changes(2, 3), [broken(1)]).level, 'full', 'one broken import + >= 3 modules');
  assert.equal(salienceOf(changes(2, 1), [broken(1)]).level, 'brief', 'one broken import alone');
  assert.equal(salienceOf(changes(9, 3), []).level, 'brief', 'breadth alone');
  assert.equal(salienceOf(changes(9, 3), [testFact]).level, 'brief', 'breadth + a non-urgent fact');
  assert.equal(salienceOf(changes(2, 1), []).level, 'quiet', 'small PR with nothing');
  assert.equal(salienceOf(changes(2, 1), [testFact]).level, 'brief', 'any item makes it at least brief');
  // Same through the whole pipeline.
  assert.equal(brief(byName('broken-two')).salience.level, 'full');
  assert.equal(brief(byName('huge')).salience.level, 'full');
  assert.equal(brief(byName('quiet')).salience.level, 'quiet');
});

// ---- Test facts -----------------------------------------------------------------------------

test('tests: an unchanged related test is one Tests row, worded as a fact', () => {
  const b = brief(byName('history-unavailable'));
  const md = renderMarkdown(b);
  const rows = md.split('\n').filter((l) => l.includes('unchanged in this PR'));
  assert.equal(rows.length, 1, md);
  assert.match(rows[0]!, /`src\/orders\/a\.test\.ts`.* — unchanged in this PR · history not checked for .*`src\/orders\/a\.ts`/);
  for (const surface of Object.values(surfaces(b))) {
    assert.ok(!/fail|missing test|coverage|covered|must change|should change/i.test(surface.replace(/history not checked/g, '')), 'no wording that implies failure or missing coverage');
  }
});

test('tests: the same test found by naming and by co-change is one row citing both evidence ids', () => {
  const b = brief(byName('normal'));
  const t = b.tests.find((x) => x.source === 'src/orders/a.ts')!;
  assert.deepEqual(t.candidates, [{ path: 'src/orders/a.test.ts', changed: false }], 'not duplicated');
  assert.deepEqual(t.history, { together: 17, sourceCommits: 20, evidence: ['forgotten:0'] });
  assert.equal(t.id, 'tests:src/orders/a.ts');
  const md = renderMarkdown(b);
  const rows = md.split('\n').filter((l) => l.includes('src/orders/a.test.ts') && l.includes('unchanged in this PR'));
  assert.equal(rows.length, 1);
  assert.match(rows[0]!, / — unchanged in this PR · changed together with \[`src\/orders\/a\.ts`\]\([^)]+\) in 17 of 20 commits<br><sub>receipts: /);
  const page = renderComic(b);
  assert.match(page, /<li class="test-row" id="tests:src\/orders\/a\.ts">.*<span class="fact">unchanged in this PR · changed together with <code class="ref">src\/orders\/a\.ts<\/code> in 17 of 20 commits<\/span>/s);
});

test('tests: a co-change test partner the naming heuristics missed is added as a candidate', () => {
  const s = byName('cochange-test-missed');
  assert.deepEqual(s.tests[0]!.candidates, [], 'naming found nothing');
  const t = brief(s).tests[0]!;
  assert.deepEqual(t.candidates, [{ path: 'test/integration/parse-roundtrip.test.ts', changed: false }]);
  assert.equal(t.status, 'test-untouched');
  assert.deepEqual(t.history, { together: 11, sourceCommits: 14, evidence: ['forgotten:0'] });
});

test('tests: unavailable, insufficient and partial history render differently from "analyzed, none"', () => {
  const clause = (name: string) => {
    const b = brief(byName(name));
    const md = renderMarkdown(b);
    const row = md.split('\n').find((l) => l.includes('unchanged in this PR'))!;
    return row.replace(/^.* — unchanged in this PR · /, '').replace(/\[`[^`]*`\]\([^)]*\)/g, '<path>').replace(/\\(.)/g, '$1');
  };
  const unavailable = clause('history-unavailable');
  const insufficient = clause('insufficient-history');
  const analyzedNone = clause('partial');
  assert.equal(unavailable, 'history not checked for <path>');
  assert.equal(insufficient, 'history too short to compare with <path>');
  assert.equal(analyzedNone, 'history checked: no co-change pairing with <path>');
  // Partial: more pairs exist than are listed.
  const s = byName('partial');
  const partial = assembleBrief({ ...s, raDiff: { ...s.raDiff!, totalSuggestions: 9 } });
  const row = renderMarkdown(partial).split('\n').find((l) => l.includes('unchanged in this PR'))!;
  assert.match(row.replace(/\\(.)/g, '$1'), /history partial: only the strongest co-change pairs are listed, and none pairs it with/);
  assert.equal(new Set([unavailable, insufficient, analyzedNone]).size, 3);
});

test('property: test history and co-change never change the checklist or salience', () => {
  for (const s of scenarios()) {
    const withHistory = brief(s);
    const withoutHistory = assembleBrief({ ...s, raDiff: undefined, unavailable: 'off for this test' });
    const noHistoryFlag = assembleBrief({ ...s, noHistory: true });
    assert.deepEqual(withHistory.checklist, withoutHistory.checklist, `${s.name}: checklist`);
    assert.deepEqual(withHistory.salience, withoutHistory.salience, `${s.name}: salience`);
    assert.deepEqual(withHistory.checklist, noHistoryFlag.checklist, `${s.name}: checklist (noHistory)`);
    assert.deepEqual(withHistory.salience, noHistoryFlag.salience, `${s.name}: salience (noHistory)`);
    // Stripping `history` from the tests the checklist saw changes nothing either.
    const stripped = s.tests.map(({ history: _h, ...t }) => t);
    const rebuilt = buildChecklist({ ...withHistory, tests: stripped, config: s.config });
    assert.deepEqual(rebuilt, withHistory.checklist, `${s.name}: rebuilt checklist`);
  }
});

// ---- Rendering ------------------------------------------------------------------------------

const heroOf = (page: string) => [...page.matchAll(/<section class="panel area-(\w+) hero" data-cut="(C-\d\d)"/g)].map((m) => `${m[2]} ${m[1]}`);

test('comic: C-04 is "Usually changes with" and never the hero; the hero is C-06 with items, else C-03', () => {
  for (const s of scenarios()) {
    const b = brief(s);
    const page = renderComic(b);
    assert.deepEqual(lintPage(page), [], `${s.name}: FRAME/12 lint incl. cut order`);
    if (b.salience.level === 'quiet') continue;
    assert.match(page, /<span class="num">C-04<\/span> Usually changes with<\/h2>/);
    assert.deepEqual(heroOf(page), [b.checklist.length ? 'C-06 checks' : 'C-03 touches'], s.name);
    const cuts = [...page.matchAll(/\bdata-cut="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(cuts, ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06']);
  }
  // Hero falls back to C-03 when there is nothing to check.
  const s = byName('cochange-only');
  const page = renderComic(assembleBrief({ ...s, changes: { ...s.changes, totals: { ...s.changes.totals, files: 5 } } }));
  assert.deepEqual(heroOf(page), ['C-03 touches']);
});

test('comic: co-change rows read as history with receipts, never as a question', () => {
  const page = renderComic(brief(byName('normal')));
  const panel = page.slice(page.indexOf('data-cut="C-04"'), page.indexOf('data-cut="C-05"'));
  assert.match(panel, /<code class="ref">src\/orders\/a\.ts<\/code> and <code class="ref">db\/schema\.sql<\/code> changed together in <b>14 of 19<\/b> commits; <code class="ref">db\/schema\.sql<\/code> isn't in this PR\./);
  assert.match(panel, /<ol class="receipts"/);
  assert.ok(!/\?|likely|forgot/i.test(panel.replace(/<[^>]+>/g, '')), panel);
  assert.ok(panel.includes('id="history-0"'), 'co-change evidence anchors as history-n');
});

test('markdown: "Usually changes with" is a collapsed <details> on full and brief pages, absent on quiet', () => {
  for (const s of scenarios()) {
    const b = brief(s);
    const md = renderMarkdown(b);
    const summary = '<details><summary><b>Usually changes with</b> (history, not a prediction)';
    if (b.salience.level === 'quiet') {
      assert.ok(!md.includes('<details'), `${s.name}: quiet has no details`);
      assert.ok(md.startsWith(COMMENT_MARKER) && md.split('\n').length <= 5);
    } else {
      assert.ok(md.includes(summary), `${s.name}: ${b.salience.level} page lists history`);
      assert.ok(!md.includes('<details open'), 'collapsed');
    }
  }
  const md = renderMarkdown(brief(byName('normal')));
  assert.match(md, /- \[`src\/orders\/a\.ts`\]\([^)]+\) and \[`db\/schema\.sql`\]\([^)]+\) changed together in 14 of 19 commits; \[`db\/schema\.sql`\]\([^)]+\) isn't in this PR · last together 2026\\-10\\-01<br><sub>receipts: /);
});

test('banned words: no prediction wording on any default surface of any fixture', () => {
  for (const s of scenarios()) {
    for (const [surface, text] of Object.entries(surfaces(brief(s)))) {
      const hit = BANNED.exec(text);
      assert.equal(hit, null, `${s.name} ${surface}: "${hit?.[0]}" near …${hit ? text.slice(Math.max(0, hit.index - 60), hit.index + 40) : ''}…`);
    }
  }
});

// ---- Injection ------------------------------------------------------------------------------

/** Markdown outside code spans, where raw HTML or link syntax would take effect. */
const outsideCode = (md: string) => md.replace(/(`+)[\s\S]*?\1/g, '');

test('injection: hostile paths, subjects and titles are escaped in HTML, Markdown and the comment', () => {
  const b = brief(byName('hostile'));
  const { html, markdown, comment } = surfaces(b);
  assert.equal(html.replace(/<script>\(function\(\)\{[\s\S]*?<\/script>/, '').includes('<script'), false);
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('</details>'), false);
  assert.equal(html.includes('<iframe'), false);
  assert.equal(html.includes('<b>imp</b>'), false);
  assert.deepEqual(lintPage(html), []);
  for (const md of [markdown, comment]) {
    const live = outsideCode(md);
    assert.equal(live.includes('<script'), false);
    assert.equal(live.includes('<img'), false);
    assert.equal(live.includes('<iframe'), false);
    assert.equal((live.match(/<details>/g) ?? []).length, (live.match(/<\/details>/g) ?? []).length, 'every </details> is ours');
    assert.equal(/\]\(javascript:/i.test(live), false, 'no live javascript: link');
    assert.equal(live.includes('@here'), false);
  }
  assert.ok(markdown.includes('\\|'), 'pipes in PR text are escaped');
});

// ---- Contract -------------------------------------------------------------------------------

type Schema = { type?: string | string[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema; enum?: unknown[]; maxItems?: number; minItems?: number; $ref?: string };
const root = JSON.parse(readFileSync(new URL('../schema/gutter.schema.json', import.meta.url), 'utf8')) as Schema & { $defs: Record<string, Schema> };
const deref = (s: Schema): Schema => (s.$ref ? root.$defs[s.$ref.replace('#/$defs/', '')]! : s);
function check(schema: Schema, value: unknown, path: string, problems: string[]): void {
  const s = deref(schema);
  if (s.enum && !s.enum.includes(value)) problems.push(`${path} ${JSON.stringify(value)} not in ${JSON.stringify(s.enum)}`);
  if (Array.isArray(value)) {
    if (s.maxItems !== undefined && value.length > s.maxItems) problems.push(`${path} too long`);
    if (s.minItems !== undefined && value.length < s.minItems) problems.push(`${path} too short`);
    if (s.items) value.forEach((v, i) => check(s.items!, v, `${path}[${i}]`, problems));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const key of s.required ?? []) if (!(key in value)) problems.push(`${path}.${key} missing`);
  for (const [key, sub] of Object.entries(s.properties ?? {})) {
    if (key in value) check(sub, (value as Record<string, unknown>)[key], `${path}.${key}`, problems);
  }
}

test('contract: presentation and TestLink.history validate; pre-GU-29 fixtures still validate', () => {
  assert.deepEqual(deref(root.properties!.forgotten!).properties!.presentation!.enum, ['context']);
  assert.deepEqual(deref(root.properties!.tests!).items!.properties!.history!.required, ['together', 'sourceCommits', 'evidence']);
  for (const s of scenarios()) {
    for (const b of [brief(s), legacy(s)]) {
      const problems: string[] = [];
      check(root, b, '$', problems);
      assert.deepEqual(problems, [], s.name);
      assert.equal(b.schemaVersion, 1);
    }
    assert.equal('presentation' in legacy(s).forgotten, false, 'omitted under legacyPredictions');
    assert.ok(legacy(s).tests.every((t) => !('history' in t)), 'no history under legacyPredictions');
    const golden = JSON.parse(readFileSync(new URL(`${s.name}.json`, LEGACY_DIR), 'utf8'));
    const problems: string[] = [];
    check(root, golden, '$', problems);
    assert.deepEqual(problems, [], `pre-GU-29 ${s.name}`);
    assert.doesNotThrow(() => renderComic(golden) && renderMarkdown(golden), 'old briefs still render');
  }
  const example = JSON.parse(readFileSync(new URL('../docs/example/gutter.json', import.meta.url), 'utf8'));
  const problems: string[] = [];
  check(root, example, '$', problems);
  assert.deepEqual(problems, []);
});

// ---- Replay parity in default mode ----------------------------------------------------------

const repos: TempRepo[] = [];
after(() => repos.forEach((r) => r.cleanup()));

test('default mode: replayBrief() and buildBrief() agree on checklist, salience and test history', async () => {
  const r = new TempRepo()
    .write({ 'src/a.ts': 'export const a = 1;\n', 'src/a.test.ts': "import './a';\n", 'src/b.ts': "import './a';\n" })
    .commit('init')
    .branch('f');
  repos.push(r);
  r.write({ 'src/a.ts': `export const a = 2;\n${lines(20)}` }).commit('change a');
  const raDiff = raDiffFixture({
    suggestions: [{ ...raDiffFixture().suggestions[0]!, to: 'src/a.test.ts', relationship: 'test', why: 'a test and the code it covers' }],
  });
  const built = buildBrief({ cwd: r.dir, base: 'main', raDiff, raBacktest: raBacktestFixture(0.6) });
  const replayed = await replayBrief({ cwd: r.dir, base: 'main', raDiff, raBacktest: raBacktestFixture(0.6) });
  assert.deepEqual(replayed.checklist, built.checklist);
  assert.deepEqual(replayed.salience, built.salience);
  assert.deepEqual(replayed.tests, built.tests);
  assert.deepEqual(kinds(built), ['untested-change']);
  assert.deepEqual(built.tests[0]!.history, { together: 14, sourceCommits: 19, evidence: ['forgotten:0'] });
});

// ---- Review fixes (PR #16) ------------------------------------------------------------------

/** `normal` with its a.ts → a.test.ts pair (17/20) plus, optionally, a stronger pair with a test naming missed. */
function twoPartners(keepNamed: boolean): GutterBrief {
  const s = byName('normal');
  const named = s.raDiff!.suggestions[0]!;
  const other = {
    ...named,
    to: 'test/orders/a.int.test.ts',
    shared: 19,
    evidence: named.evidence.map((e, i) => ({ ...e, hash: String(i + 7).repeat(40), subject: `integration ${i}` })),
  };
  const suggestions = keepNamed ? [other, named, ...s.raDiff!.suggestions.slice(1)] : [other, ...s.raDiff!.suggestions.slice(1)];
  return assembleBrief({ ...s, raDiff: { ...s.raDiff!, suggestions, totalSuggestions: suggestions.length } });
}

test('review 1: a test row cites only its own pair; counts follow the naming-convention test', () => {
  const b = twoPartners(true);
  const t = b.tests.find((x) => x.source === 'src/orders/a.ts')!;
  assert.deepEqual(t.history, { together: 17, sourceCommits: 20, evidence: ['forgotten:1', 'forgotten:0'] }, 'the named pair first, though weaker');
  const md = renderMarkdown(b);
  const row = md.split('\n').find((l) => l.includes('unchanged in this PR'))!;
  assert.match(row, /^- \[`src\/orders\/a\.test\.ts`\].* in 17 of 20 commits<br>/);
  assert.ok(!row.includes('7777777') && !row.includes('8888888'), 'no receipt from the other test pair');
  assert.ok(row.includes('/commit/0000000000000000000000000000000000000001'), 'receipts come from the named pair');
});

test('review 2: the Tests row and the checklist name the same test; another history partner is a separate clause', () => {
  const b = twoPartners(false);
  const item = b.checklist.find((c) => c.kind === 'untested-change')!;
  assert.match(item.question, /its test file `src\/orders\/a\.test\.ts` didn't change/);
  const t = b.tests.find((x) => x.source === 'src/orders/a.ts')!;
  assert.deepEqual(t.candidates.map((c) => c.path), ['src/orders/a.test.ts', 'test/orders/a.int.test.ts']);
  for (const text of [renderMarkdown(b), renderComic(b)]) {
    const row = text.split(/\n|<li /).find((l) => l.includes('unchanged in this PR'))!;
    assert.ok(row.includes('src/orders/a.test.ts'), 'row names the checklist test');
    assert.match(row.replace(/\\(.)/g, '$1'), /history checked: no co-change pairing with .*src\/orders\/a\.ts.* · .*src\/orders\/a\.ts.* changed together with .*test\/orders\/a\.int\.test\.ts.* in 19 of 20 commits/);
  }
});

test('review 4: an untested-change item cites only the test file it names', () => {
  const b = twoPartners(false);
  const item = b.checklist.find((c) => c.kind === 'untested-change')!;
  const md = renderMarkdown(b);
  const line = md.split('\n').find((l) => l.includes(item.question.slice(1, 20)))!;
  assert.ok(line.includes('src/orders/a.test.ts') && !line.includes('a.int.test.ts'), line);
});

test('review 5: Markdown, CLI and Action count co-change pairs the same way; families are counted apart', () => {
  const b = brief(byName('normal'));
  assert.match(renderMarkdown(b), /\(history, not a prediction\) · 3 pairs · 1 parallel group<\/summary>/);
  assert.match(summaryLine(b), / 3 usually-changes-with pairs /);
});

test('review 6: legacy-only keys without legacyPredictions are reported, and bench --config refuses them', async () => {
  const { inertLegacyKeys } = await import('../src/config.ts');
  assert.deepEqual(inertLegacyKeys({ minIntervalLow: 0.5, companionRequireGhost: true, salienceFullMinSignals: 2 }), ['minIntervalLow', 'companionRequireGhost']);
  assert.deepEqual(inertLegacyKeys({ minIntervalLow: 0.5, legacyPredictions: true }), []);

  const r = new TempRepo().write({ 'src/a.ts': 'export const a = 1;\n', '.gutter.json': JSON.stringify({ minIntervalLow: 0.5 }) }).commit('init').branch('f');
  repos.push(r);
  r.write({ 'src/a.ts': 'export const a = 2;\n' }).commit('edit');
  const warnings: string[] = [];
  buildBrief({ cwd: r.dir, base: 'main', noHistory: true, warn: (m) => warnings.push(m) });
  assert.deepEqual(warnings, ['minIntervalLow only applies with "legacyPredictions": true (GU-29, DECISIONS #17); ignored.']);

  const { spawnSync } = await import('node:child_process');
  const cli = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', 'src/cli.ts', 'bench', ...args, '--cwd', r.dir, '--prs', '0'], { encoding: 'utf8' });
  const refused = cli('--config', 'bench/variants/stage0-v1-floor.json');
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /minIntervalLow only applies with "legacyPredictions": true .*pass --legacy-predictions/);
  const accepted = cli('--config', 'bench/variants/stage0-v1-floor.json', '--legacy-predictions');
  assert.doesNotMatch(accepted.stderr, /only applies with/);
});

test('review: the HTML Tests panel carries the same legend as the comment', () => {
  const page = renderComic(brief(byName('normal')));
  assert.ok(page.includes('Test rows are facts about this PR and past commits, not a request to change anything.'));
});

test('review (consumer lens): old and legacy briefs without TestLink.history still show the pair C-04 lists', () => {
  const golden = JSON.parse(readFileSync(new URL('normal.json', LEGACY_DIR), 'utf8')) as GutterBrief;
  assert.ok(golden.tests.every((t) => !('history' in t)), 'a pre-GU-29 brief');
  for (const text of [renderMarkdown(golden), renderComic(golden), renderMarkdown(legacy(byName('normal')))]) {
    const row = text.split(/\n|<li /).find((l) => l.includes('unchanged in this PR'))!;
    assert.match(row, /changed together with .*src\/orders\/a\.ts.* in 17 of 20 commits/);
    assert.doesNotMatch(row, /no co-change pairing/);
  }
});

test('review (consumer lens): pairs hidden by max-forgotten are never reported as "none"', () => {
  const b = assembleBrief({ ...byName('cochange-only'), changes: { ...byName('cochange-only').changes, totals: { ...byName('cochange-only').changes.totals, files: 5 } }, config: { maxForgotten: 0 } });
  assert.equal(b.forgotten.items.length, 0);
  assert.equal(b.forgotten.total, 2);
  const md = renderMarkdown(b);
  assert.match(md, /\(history, not a prediction\) · none listed<\/summary>/);
  assert.ok(md.replace(/\\(.)/g, '$1').includes('2 pairs found, none listed (display limit: max-forgotten).'));
  assert.ok(renderComic(b).includes('2 pairs found, none listed (display limit: max-forgotten).'));
  for (const t of [md, renderComic(b)]) assert.ok(!t.includes('No file outside this PR usually changes'));
});
