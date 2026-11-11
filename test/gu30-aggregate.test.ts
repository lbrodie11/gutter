/**
 * GU-30 aggregator: tables, median, every verdict branch, "not exercised" never shown as met, and the
 * committed README matching results.json.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error: plain .mjs module without type declarations
import { aggregate, median, renderReadme, verdict, loadInputs } from '../bench/aggregate.mjs';

type Repo = { url: string; pinnedSha: string; branch: string; language: string; category: string; mergeStyle: string; expected: string; why: string };
const repo = (name: string, language = 'typescript', category = 'ts-library'): Repo => ({
  url: `https://github.com/fx/${name}`, pinnedSha: 'a'.repeat(40), branch: 'main', language, category, mergeStyle: 'squash', expected: 'good', why: 'fixture repository',
});

/** A bench.json with `n` PRs: `full` of them full, `brief` brief, the rest quiet; `ws` carry wide-surface. */
function bench(n: number, full: number, brief: number, ws = 0, partial = 0) {
  return {
    funnel: { evaluated: n },
    timings: { stages: { sessionOpen: { p50Ms: 400, p95Ms: 900 }, staticAnalysis: { p50Ms: 30, p95Ms: 60 }, brief: { p50Ms: 10, p95Ms: 20 } } },
    prs: Array.from({ length: n }, (_, i) => ({
      coverage: i < partial ? 'partial' : 'full',
      unresolvedByReason: i < partial ? { 'unknown-package': 1 } : {},
      uncheckedLanguages: [],
      policies: { production: { salience: i < full ? 'full' : i < full + brief ? 'brief' : 'quiet', questions: i < ws ? [{ kind: 'wide-surface' }] : [] } },
    })),
  };
}
const gate = (o: { broken?: [number, number]; untested?: [number, number]; history?: [number, number]; hits?: number } = {}) => ({
  replayParity: { salienceMismatches: 0, checklistKindMismatches: 0 },
  b: {
    brokenImport: { checked: o.broken?.[1] ?? 0, confirmed: o.broken?.[0] ?? 0 },
    untestedChange: { checked: o.untested?.[1] ?? 0, confirmed: o.untested?.[0] ?? 0 },
    testHistory: { checked: o.history?.[1] ?? 0, confirmed: o.history?.[0] ?? 0 },
  },
  c: { ownWordingHits: Array.from({ length: o.hits ?? 0 }, () => ({ pr: '#1', text: 'x' })) },
});
const seededSummary = (pos: number, det: number, rep: number, conf: number, neg = 30, fp = 0) => ({
  positives: pos, negatives: neg, reportedItems: rep, confirmedItems: conf, precision: rep ? conf / rep : null, detected: det, recall: pos ? det / pos : null,
  falsePositives: fp, falsePositiveRate: neg ? fp / neg : null, skippedUncheckedOrPartial: pos - det, skippedShare: pos ? (pos - det) / pos : null,
  missReasons: { unchecked: 0, partial: pos - det, missed: 0 }, errors: 0, meta: [],
});
const seededRecords = (pos: number, det: number) =>
  Array.from({ length: pos }, (_, i) => ({ positive: true, kind: i % 2 ? 'rename' : 'delete', detected: i < det, missReason: i < det ? undefined : 'partial', reported: i < det ? [{ confirmed: true }] : [] }));
const done = { completed: true, wallMs: 600000, steps: { bench: {} } };

function good(name: string, language = 'typescript', full = 10) {
  return { repo: repo(name, language), input: { status: done, bench: bench(100, full, 30, 20, 5), gate: gate({ untested: [3, 3], history: [2, 2] }), seededSummary: seededSummary(30, 30, 30, 30), seededRecords: seededRecords(30, 30) } };
}
const build = (entries: { repo: Repo; input: Record<string, unknown> }[]) =>
  aggregate({ corpus: { repos: entries.map((e) => e.repo) }, inputs: Object.fromEntries(entries.map((e) => [e.repo.url.replace('https://github.com/', '').replace('/', '__'), e.input])), run: null });

test('median: odd and even counts, ignoring non-numbers', () => {
  assert.equal(median([0.5, 0.1, 0.3]), 0.3);
  assert.equal(median([0.4, 0.1, 0.3, 0.2]), 0.25);
  assert.equal(median([null, undefined]), null);
});

test('three fixture repositories (passing, failing, timed out): tables, median over completed only, FAIL listed', () => {
  const pass = good('pass');
  const fail = { repo: repo('fail'), input: { status: done, bench: bench(100, 60, 20, 50), gate: gate({ untested: [1, 2] }), seededSummary: seededSummary(30, 10, 20, 12, 30, 4), seededRecords: seededRecords(30, 10) } };
  const timedOut = { repo: repo('slow', 'go', 'go'), input: { status: { completed: false, failure: 'failed: timeout (seeded): failed: timeout after 45 min in seeded', steps: {} }, bench: bench(200, 200, 0) } };
  const res = build([pass, fail, timedOut]);
  assert.equal(res.verdict.completed, 2);
  assert.equal(res.median.fullShare, (0.1 + 0.6) / 2, 'the timed-out repository is not in the median');
  assert.equal(res.verdict.result, 'INCONCLUSIVE', 'only 2 of 3 completed (needs 15)');
  const md = renderReadme(res);
  assert.match(md, /\| `fx\/slow` \| Go \| failed: timeout \(seeded\)/);
  assert.match(md, /\| `fx\/pass` \| TS\/JS \| completed \| 100 \| 0\.60 \(60\/100\) \| 0\.30 \(30\/100\) \| 0\.10 \(10\/100\) \| 0\.20 \| 0\.20 \(20\/100\) \| not exercised \| 3\/3 \| 2\/2 \| 0 \|/);
  assert.match(md, /\| `fx\/fail` \| 30 \| 10 \(0\.33\) \| 20 \(0\.67\) \| 12\/20 \(0\.60\) \| 4\/30 \(0\.13\) \|/);
  assert.match(md, /Repositories that did not complete\*\*\n\n- `fx\/slow`: failed: timeout/);
  assert.deepEqual(res.worst.fullShare, ['fx/fail', 'fx/pass']);
});

test('verdict: PASS when all three hold on ≥ 15 completed repositories with every group computable', () => {
  const entries = [...Array.from({ length: 13 }, (_, i) => good(`ts${i}`)), good('go1', 'go'), good('py1', 'python')];
  const res = build(entries);
  assert.equal(res.verdict.result, 'PASS', JSON.stringify(res.verdict, null, 1));
  assert.equal(res.verdict.b.basis, 'seeded mutations');
  assert.match(renderReadme(res), /## Verdict \(mechanical, CORPUS\.md §5\): \*\*PASS\*\*/);
});

test('verdict: FAIL lists the top three failure classes; each clause can fail it', () => {
  const base = () => [...Array.from({ length: 13 }, (_, i) => good(`ts${i}`)), good('go1', 'go'), good('py1', 'python')];
  // (b) recall: Go misses everything.
  const goMiss = base();
  goMiss[13] = { repo: repo('go1', 'go', 'go'), input: { ...goMiss[13]!.input, seededSummary: seededSummary(30, 0, 0, 0), seededRecords: seededRecords(30, 0) } };
  const pyMiss = goMiss.slice();
  pyMiss[14] = { repo: repo('py1', 'python', 'python'), input: { ...pyMiss[14]!.input, seededSummary: seededSummary(30, 0, 0, 0), seededRecords: seededRecords(30, 0) } };
  const r1 = build(pyMiss);
  assert.equal(r1.verdict.result, 'FAIL');
  assert.ok(r1.verdict.b.pooled.recall.rate < 0.9);
  // Four classes tie at 15; ties are ranked by name.
  assert.deepEqual(r1.verdict.failureClasses.slice(0, 3).map((c: { class: string; count: number }) => `${c.class} ${c.count}`), ['missed positive: Go, delete, partial 15', 'missed positive: Go, rename, partial 15', 'missed positive: Python, delete, partial 15']);
  assert.match(renderReadme(r1), /\*\*Top failure classes\*\*/);
  // (a) loud: the median repository is full on 40% of PRs.
  const loud = base().map((e) => good(e.repo.url.split('/').pop()!, e.repo.language, 40));
  assert.equal(build(loud).verdict.a.met, false);
  assert.equal(build(loud).verdict.result, 'FAIL');
  // (c) one banned-word hit anywhere.
  const words = base();
  words[0] = { ...words[0]!, input: { ...words[0]!.input, gate: gate({ untested: [3, 3], hits: 1 }) } };
  assert.equal(build(words).verdict.c.met, false);
  // (b) a repository below 0.85 precision.
  const prec = base();
  prec[1] = { ...prec[1]!, input: { ...prec[1]!.input, seededSummary: seededSummary(30, 30, 30, 24) } };
  assert.deepEqual(build(prec).verdict.b.reposBelowPrecision, ['fx/ts1']);
  assert.equal(build(prec).verdict.result, 'FAIL');
});

test('verdict: INCONCLUSIVE when (b) cannot be computed for any of the three language groups', () => {
  const entries = Array.from({ length: 16 }, (_, i) => ({ ...good(`ts${i}`), input: { ...good(`ts${i}`).input, seededSummary: seededSummary(5, 5, 5, 5), seededRecords: seededRecords(5, 5) } })).map((e, i) => (i < 1 ? e : e));
  // 16 TS repos × 5 positives = 80 TS positives: TS computable, Go and Python not → only 2 groups missing → not INCONCLUSIVE.
  assert.notEqual(build(entries).verdict.result, 'INCONCLUSIVE');
  const none = entries.map((e) => ({ ...e, input: { ...e.input, seededSummary: undefined, seededRecords: undefined } }));
  const v = build(none).verdict;
  assert.equal(v.result, 'INCONCLUSIVE');
  assert.match(v.missing.join(' '), /cannot be computed for TS\/JS, Go, Python/);
});

test('"not exercised" is never shown as met', () => {
  const entries = [...Array.from({ length: 13 }, (_, i) => good(`ts${i}`)), good('go1', 'go'), good('py1', 'python')].map((e) => ({ ...e, input: { ...e.input, gate: gate() } }));
  const res = build(entries);
  assert.equal(res.verdict.b.untestedChange.met, null);
  assert.equal(res.verdict.b.testHistory.met, null);
  assert.equal(res.verdict.b.met, false, 'facts that were never exercised cannot make (b) hold');
  const md = renderReadme(res);
  assert.match(md, /`untested-change` facts: not exercised; test-history facts: not exercised/);
  assert.doesNotMatch(md, /not exercised[^|\n]*\*\*met\*\*/);
  assert.equal(verdict(res.repos).result, 'FAIL');
});

test('report consistency: the committed README is rendered from the committed results.json', () => {
  if (!existsSync('docs/benchmark/results.json')) return;
  const res = JSON.parse(readFileSync('docs/benchmark/results.json', 'utf8'));
  // GU-31: once Rerun 1 exists, the page shows it next to GU-30 (test/gu31-bench.test.ts checks its raw data).
  const rerun = existsSync('docs/benchmark/results-rerun1.json') ? JSON.parse(readFileSync('docs/benchmark/results-rerun1.json', 'utf8')) : undefined;
  assert.equal(readFileSync('docs/benchmark/README.md', 'utf8').replace(/\r\n/g, '\n'), renderReadme(res, rerun) + '\n');
  // And results.json is what the aggregator computes from the committed raw data.
  const corpus = JSON.parse(readFileSync('bench/corpus.json', 'utf8'));
  const run = JSON.parse(readFileSync('docs/benchmark/data/corpus-run.json', 'utf8'));
  assert.deepEqual(aggregate({ corpus, inputs: loadInputs('docs/benchmark/data', corpus), run }), res);
});

test('backtests: the origin-weighted numbers come from comparisons[0].weighted, not the unweighted strategies', () => {
  const plainBt = { test: { commits: 500 }, strategies: [{ name: 'co-change', fired: 100, precision: 0.5, hitRate: 0.7 }, { name: 'popularity, same changes', hitRate: 0.1 }] };
  const origin = { ...plainBt, comparisons: [{ spec: 'bot=0,agent=0.5', weighted: { fired: 90, precision: 0.6, hitRate: 0.65, lift: 6.5 }, deltas: { precision: 0.1 } }] };
  const e = good('bt');
  const res = build([{ ...e, input: { ...e.input, backtest: plainBt, backtestOrigin: origin } }]);
  const bt = res.repos[0].backtests;
  assert.deepEqual(bt.plain, { testCommits: 500, fired: 100, precision: 0.5, hitRate: 0.7, lift: 0.7 / 0.1 });
  assert.deepEqual(bt.originWeighted, { spec: 'bot=0,agent=0.5', fired: 90, precision: 0.6, hitRate: 0.65, lift: 6.5, deltas: { precision: 0.1 } });
  assert.match(renderReadme(res), /\| 500 · 0\.50 · 0\.70 · ×7\.00 \| 0\.60 · 0\.65 · ×6\.50 \|/);
});
