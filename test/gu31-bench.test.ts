/**
 * GU-31 bench tooling: the Rerun 1 runner mode, replay-based loudness and runtime, side-by-side rendering.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error: plain .mjs module without type declarations
import { RERUN_STEPS, runCorpus } from '../bench/run-corpus.mjs';
// @ts-expect-error: plain .mjs module without type declarations
import { aggregate, loadInputs, percentile, renderReadme, replayRuntime } from '../bench/aggregate.mjs';
import { replayRecord } from '../bench/gate-a-prime.ts';
import type { GutterBrief } from '../src/contract.ts';

const dirs: string[] = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), 'gutter-rerun-'));
  dirs.push(d);
  return d;
};
const corpus = {
  schemaVersion: 1,
  selectionDate: '2026-11-10',
  repos: [{ url: 'https://github.com/example/repo0', pinnedSha: 'a'.repeat(40), branch: 'main', language: 'go', category: 'go', mergeStyle: 'squash', expected: 'good', why: 'test fixture repository' }],
};

test('runner --rerun: only clone, gate and seeded run, against GU-30 bench.json, with the seed, into rerun1/', async () => {
  const out = scratch();
  const benchJson = join(out, 'example__repo0', 'corpus', 'bench', 'bench.json');
  mkdirSync(join(out, 'example__repo0', 'corpus', 'bench'), { recursive: true });
  writeFileSync(benchJson, '{}');
  const calls: { name: string; ctx: Record<string, unknown> }[] = [];
  const steps = Object.fromEntries(RERUN_STEPS.map((s: string) => [s, async (ctx: Record<string, unknown>) => (calls.push({ name: s, ctx }), { ok: true })]));
  const manifest = await runCorpus({ corpus, out, cache: out, steps, rerun: 'rerun1', seed: 20261111 });
  assert.deepEqual(calls.map((c) => c.name), ['clone', 'gate', 'seeded']);
  for (const c of calls.slice(1)) {
    assert.equal(c.ctx.benchJson, benchJson);
    assert.equal(c.ctx.seed, 20261111);
    assert.equal(c.ctx.data, join(out, 'example__repo0', 'rerun1'));
  }
  assert.equal(manifest.stage, 'rerun1');
  assert.equal(manifest.seed, 20261111);
  assert.equal(manifest.repos[0].completed, true);
  assert.ok(existsSync(join(out, 'rerun1-run.json')));
  assert.ok(!existsSync(join(out, 'corpus-run.json')), 'the GU-30 manifest is not touched');
  const status = JSON.parse(readFileSync(join(out, 'example__repo0', 'rerun1', 'status.json'), 'utf8'));
  assert.equal(status.seed, 20261111);
  assert.deepEqual(Object.keys(status.steps), ['clone', 'gate', 'seeded']);
  // A different seed must not resume another seed's data.
  await assert.rejects(runCorpus({ corpus, out, cache: out, steps, rerun: 'rerun1', seed: 1 }), /seed 20261111/);
  await assert.rejects(runCorpus({ corpus, out, cache: out, steps, rerun: 'rerun1' }), /needs --rerun rerun<N> and --seed/);
});

const brief = (over: { removes?: boolean; method?: 'base-graph' | 'relative-scan'; salience?: 'quiet' | 'brief' | 'full'; kinds?: string[] } = {}) =>
  ({
    salience: { level: over.salience ?? 'quiet', reasons: [] },
    checklist: (over.kinds ?? []).map((kind) => ({ kind })),
    changes: { files: [{ path: 'a.ts', status: over.removes ? 'deleted' : 'modified', language: 'typescript' }] },
    dependents: { coverage: 'partial', unresolved: { count: 1, samples: [], byReason: { 'unknown-package': 1 } }, unchecked: [], ...(over.method ? { method: over.method } : {}) },
  }) as unknown as GutterBrief;

test('gate replays: one record per PR with salience, kinds, coverage, removal, method and timings', () => {
  const r = replayRecord('#1', brief({ removes: true, method: 'base-graph', salience: 'brief', kinds: ['broken-import'] }), 1234.4, 400.6);
  assert.deepEqual(r, { pr: '#1', salience: 'brief', kinds: ['broken-import'], coverage: 'partial', unresolvedByReason: { 'unknown-package': 1 }, relevantUnresolvedByReason: {}, uncheckedLanguages: [], method: 'base-graph', removes: true, ms: 1234, baseGraphMs: 401 });
  assert.equal(replayRecord('#2', brief(), 10, 0).removes, false);
  assert.equal(replayRecord('#3', brief({ removes: true }), 10, 4, 7.6).msWithoutBaseGraph, 8);
});

test('replayRuntime: p95 growth from the base graph (a second replay without it), only over PRs that remove files', () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 0.5), 3);
  assert.equal(percentile([], 0.95), null);
  const replays = [
    ...Array.from({ length: 10 }, (_, i) => ({ removes: false, ms: 100 + i, baseGraphMs: 0 })),
    { removes: true, ms: 300, baseGraphMs: 100, msWithoutBaseGraph: 200 },
    { removes: true, ms: 600, baseGraphMs: 200, msWithoutBaseGraph: 400 },
    { removes: true, ms: 250, baseGraphMs: 0, msWithoutBaseGraph: 250 },
  ];
  const rt = replayRuntime(replays);
  assert.equal(rt.plain.prs, 10);
  assert.equal(rt.plain.baseGraphsBuilt, 0);
  assert.equal(rt.removes.prs, 3);
  assert.deepEqual(rt.removes.total, { p50Ms: 300, p95Ms: 600 });
  assert.deepEqual(rt.removes.withoutBaseGraph, { p50Ms: 250, p95Ms: 400 });
  assert.deepEqual(rt.removes.baseGraph, { built: 2, p50Ms: 100, p95Ms: 200 });
  assert.equal(rt.removes.p95Growth, 0.5);
});

/** A minimal rerun input: gate with replays, a seeded summary, no bench. */
function rerunInput(fullPrs: number, recall: [number, number]) {
  const replays = Array.from({ length: 10 }, (_, i) => ({ pr: `#${i}`, salience: i < fullPrs ? 'full' : 'quiet', kinds: [], coverage: 'full', unresolvedByReason: {}, uncheckedLanguages: [], removes: i === 0, ms: 100, baseGraphMs: i === 0 ? 50 : 0, ...(i === 0 ? { msWithoutBaseGraph: 50 } : {}) }));
  const [det, pos] = recall;
  return {
    status: { completed: true, wallMs: 60000, steps: {} },
    gate: { replayParity: {}, b: { brokenImport: { checked: 0, confirmed: 0 }, untestedChange: { checked: 1, confirmed: 1 }, testHistory: { checked: 0, confirmed: 0 } }, c: { ownWordingHits: [] }, replays },
    seededSummary: { positives: pos, negatives: 30, reportedItems: det, confirmedItems: det, precision: 1, detected: det, recall: det / pos, falsePositives: 0, falsePositiveRate: 0, skippedUncheckedOrPartial: 0, skippedShare: 0, missReasons: { unchecked: 0, partial: 0, missed: pos - det }, meta: [] },
    seededRecords: Array.from({ length: pos }, (_, i) => ({ positive: true, kind: 'delete', detected: i < det, ...(i < det ? {} : { missReason: 'missed' }), reported: i < det ? [{ confirmed: true }] : [] })),
  };
}

test('aggregate (rerun): loudness and runtime come from the replays; README shows GU-30 and Rerun 1 side by side', () => {
  const c = { repos: [corpus.repos[0]] };
  const gu30 = aggregate({ corpus: c, inputs: { example__repo0: { ...rerunInput(0, [0, 30]), gate: { ...rerunInput(0, [0, 30]).gate, replays: undefined }, bench: { prs: [], timings: {} } } }, run: null });
  const rr = aggregate({ corpus: c, inputs: { example__repo0: rerunInput(2, [27, 30]) }, run: { seed: 20261111, environment: null }, stage: 'rerun1' });
  assert.equal(rr.stage, 'rerun1');
  assert.equal(rr.seed, 20261111);
  const row = rr.repos[0];
  assert.equal(row.loudness.full.rate, 0.2);
  assert.equal(row.runtime.removes.prs, 1);
  assert.equal(row.seeded.recall, 0.9);
  const md = renderReadme(gu30, rr);
  assert.match(md, /## Rerun 1 verdict \(mechanical, CORPUS\.md §6, the §5 rule\): \*\*INCONCLUSIVE\*\*/);
  assert.match(md, /\| \(b\) Seeded pooled recall \| 0\.00 \[0\.00–0\.11\] \(0\/30\) \| 0\.90 \[0\.74–0\.97\] \(27\/30\) \|/);
  assert.match(md, /\| `example\/repo0` \| Go \| 0\/30 \(0\.00\) \| 27\/30 \(0\.90\) \|/);
  assert.match(md, /\| missed positive: Go, delete, missed \| 30 \| 3 \|/);
  assert.match(md, /\| `example\/repo0` \| 1 \| 100 \/ 100 \| 50 \/ 50 \| 100% \| 50 \/ 50 \(1\) \| 100 \/ 100 \|/);
  assert.match(md, /The sections below are GU-30's run \(CORPUS\.md §1–§5\), unchanged\./);
  assert.doesNotMatch(renderReadme(gu30), /Rerun 1/, 'without rerun results the page is GU-30 alone');
});

test('report consistency (Rerun 1): results-rerun1.json is what the aggregator computes from the rerun1 raw data', () => {
  if (!existsSync('docs/benchmark/results-rerun1.json')) return;
  const res = JSON.parse(readFileSync('docs/benchmark/results-rerun1.json', 'utf8'));
  const corpusDoc = JSON.parse(readFileSync('bench/corpus.json', 'utf8'));
  const run = JSON.parse(readFileSync('docs/benchmark/data/rerun1-run.json', 'utf8'));
  assert.deepEqual(aggregate({ corpus: corpusDoc, inputs: loadInputs('docs/benchmark/data', corpusDoc, 'rerun1'), run, stage: 'rerun1' }), res);
});

test('replay-delta: per-PR differences by field, unmatched PRs, and the removing-PR runtime on both sides', async () => {
  // @ts-expect-error: plain .mjs module without type declarations
  const { replayDelta } = await import('../bench/replay-delta.mjs');
  const r = (pr: string, over: Record<string, unknown> = {}) => ({ pr, salience: 'quiet', kinds: [], coverage: 'full', removes: false, ms: 10, baseGraphMs: 0, ...over });
  const before = [r('#1'), r('#2', { kinds: ['wide-surface'], salience: 'brief' }), r('#3', { removes: true, ms: 30, baseGraphMs: 10, msWithoutBaseGraph: 20 })];
  const after = [r('#1'), r('#2', { kinds: ['broken-import', 'wide-surface'], salience: 'brief' }), r('#3', { removes: true, ms: 22, baseGraphMs: 2, msWithoutBaseGraph: 20 }), r('#4')];
  const d = replayDelta(before, after);
  assert.equal(d.prs, 4);
  assert.deepEqual(d.unmatched, ['#4']);
  assert.equal(d.changed, 1);
  assert.deepEqual(d.byField, { salience: 0, kinds: 1, coverage: 0, method: 0 });
  assert.deepEqual(d.details[0], { pr: '#2', fields: ['kinds'], before: { kinds: ['wide-surface'] }, after: { kinds: ['broken-import', 'wide-surface'] } });
  assert.equal(d.runtime.before.total.p95Ms, 30);
  assert.equal(d.runtime.after.total.p95Ms, 22);
});
