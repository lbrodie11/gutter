import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseGutterConfigObject } from '../src/config.ts';
import type { ChangeStructure, ChecklistItem } from '../src/contract.ts';
import { salienceOf } from '../src/evidence/checklist.ts';
import { computePolicyAggregates } from '../src/bench/metrics.ts';
import { renderBenchMarkdown } from '../src/bench/report-md.ts';
import { renderBenchHtml } from '../src/bench/report-html.ts';
import { validateBenchResults } from '../src/bench/validate.ts';
import { lintPage } from '../src/render/comic.ts';
import { benchModel, pr, question, target } from './bench-fixtures.ts';

/**
 * Gutter: 4 scored targets, 2 followed up, 2 by the PR author, 1 RA-signal.
 * recent: 4 scored, 3 followed up (busy files), only 1 by the PR author, 0 RA-signal.
 * popular-near: 4 scored, 1 followed up, 1 same-author, 1 RA-signal.
 * popular: 4 scored, 2 followed up, 0 same-author.
 */
function stage0Prs() {
  return [
    pr({
      n: 1,
      questions: [question('forgotten-companion', target({ file: 'src/a.ts', followedUp: true, sameAuthor: true, raSignal: true }))],
      baselines: {
        recent: [target({ file: 'src/busy1.ts', followedUp: true, sameAuthor: true })],
        'popular-near': [target({ file: 'src/near1.ts', followedUp: true, sameAuthor: true, raSignal: true })],
        popular: [target({ file: 'src/pop1.ts', followedUp: true })],
      },
    }),
    pr({
      n: 2,
      questions: [question('forgotten-companion', target({ file: 'src/b.ts', followedUp: true, sameAuthor: true }))],
      baselines: {
        recent: [target({ file: 'src/busy2.ts', followedUp: true })],
        'popular-near': [target({ file: 'src/near2.ts', followedUp: false })],
        popular: [target({ file: 'src/pop2.ts', followedUp: true })],
      },
    }),
    pr({
      n: 3,
      questions: [question('forgotten-companion', target({ file: 'src/c.ts', followedUp: false }))],
      baselines: {
        recent: [target({ file: 'src/busy3.ts', followedUp: true })],
        'popular-near': [target({ file: 'src/near3.ts', followedUp: false })],
        popular: [target({ file: 'src/pop3.ts', followedUp: false })],
      },
    }),
    pr({
      n: 4,
      questions: [question('forgotten-companion', target({ file: 'src/d.ts', followedUp: false }))],
      baselines: {
        recent: [target({ file: 'src/busy4.ts', followedUp: false })],
        'popular-near': [target({ file: 'src/near4.ts', followedUp: false })],
        popular: [target({ file: 'src/pop4.ts', followedUp: false })],
      },
    }),
  ];
}

test('stage 0 metrics: every baseline reports same-author and RA-signal rates with Wilson and bootstrap intervals, and lift per outcome', () => {
  const agg = computePolicyAggregates(stage0Prs(), 'production');

  assert.equal(agg.accuracyProxy.fileLevelFollowUpPrecision.rate, 0.5);
  assert.equal(agg.accuracyProxy.sameAuthorFollowUpRate.rate, 0.5);
  assert.equal(agg.accuracyProxy.raSignalFollowUpRate.rate, 0.25);
  assert.ok(agg.accuracyProxy.bootstrapSameAuthorCi, 'policy same-author bootstrap');
  assert.ok(agg.accuracyProxy.bootstrapRaSignalCi, 'policy RA-signal bootstrap');

  const recent = agg.baselines.recent;
  assert.equal(recent.fileLevelFollowUp.rate, 0.75);
  assert.equal(recent.sameAuthorFollowUpRate.rate, 0.25);
  assert.equal(recent.raSignalFollowUpRate?.rate, 0);
  assert.equal(recent.raSignalFollowUpRate?.numerator, 0);
  assert.equal(recent.raSignalFollowUpRate?.denominator, 4);
  assert.ok(recent.raSignalFollowUpRate?.interval, 'Wilson interval on the baseline RA-signal rate');
  assert.ok(recent.bootstrapRateCi?.followUp);
  assert.ok(recent.bootstrapRateCi?.sameAuthor);
  assert.equal(recent.bootstrapRateCi?.raSignal?.high, 0, 'bootstrap over an all-zero outcome stays at 0');

  // Lift per outcome against recent: follow-up 0.5/0.75, same-author 0.5/0.25, RA-signal undefined (baseline 0).
  assert.equal(recent.liftByOutcome?.followUp.lift, 0.6667);
  assert.equal(recent.liftByOutcome?.sameAuthor.lift, 2);
  assert.equal(recent.liftByOutcome?.raSignal.lift, null);
  assert.equal(recent.liftVsBaseline, recent.liftByOutcome?.followUp.lift, 'legacy lift field is unchanged');

  // Strongest baseline is chosen per outcome.
  const byOutcome = agg.headlineBaseline.byOutcome!;
  assert.equal(byOutcome.followUp.strongestBaseline, 'recent');
  assert.equal(byOutcome.followUp.lift, 0.6667);
  assert.equal(agg.headlineBaseline.strongestBaseline, 'recent', 'headline follow-up baseline is unchanged');
  // same-author: recent 0.25 and popular-near 0.25 tie -> popular-near wins the tie.
  assert.equal(byOutcome.sameAuthor.strongestBaseline, 'popular-near');
  assert.equal(byOutcome.sameAuthor.lift, 2);
  assert.equal(byOutcome.raSignal.strongestBaseline, 'popular-near');
  assert.equal(byOutcome.raSignal.lift, 1);
  assert.ok(byOutcome.sameAuthor.bootstrapCi, 'paired PR-clustered bootstrap on same-author lift');
});

test('lift bootstrap: zero-hit baseline resamples count as unbounded instead of being dropped', () => {
  // Gutter: 2 author follow-ups in 10 PRs. recent: a single author follow-up in 10 PRs, so many
  // resamples contain no recent hit. Dropping them (GU-03's bootstrapPrLift) biases the upper bound down.
  const prs = Array.from({ length: 10 }, (_, i) =>
    pr({
      n: i + 1,
      questions: [question('forgotten-companion', target({ file: `src/g${i}.ts`, followedUp: i < 2, sameAuthor: true }))],
      baselines: {
        recent: [target({ file: `src/r${i}.ts`, followedUp: true, sameAuthor: i === 0 })],
        'popular-near': [target({ file: `src/n${i}.ts`, followedUp: false })],
        popular: [target({ file: `src/p${i}.ts`, followedUp: false })],
      },
    }),
  );
  const agg = computePolicyAggregates(prs, 'production');
  const sa = agg.headlineBaseline.byOutcome!.sameAuthor;
  assert.equal(sa.strongestBaseline, 'recent');
  assert.equal(sa.lift, 2);
  const ci = sa.bootstrapCi!;
  assert.ok(ci.unboundedResamples > 25, `expected many zero-hit resamples, got ${ci.unboundedResamples}`);
  assert.equal(ci.high, null, 'the 97.5% bound is unbounded once > 2.5% of resamples are infinite');
  assert.equal(ci.resamples, 1000);
  assert.equal(ci.unboundedResamples + ci.undefinedResamples <= 1000, true);
  assert.ok(ci.low !== null && ci.low >= 0);

  // The headline (any follow-up) fields keep GU-03's semantics and numbers.
  assert.equal(agg.headlineBaseline.strongestBaseline, 'recent');
  assert.equal(agg.headlineBaseline.bootstrapLiftCi, agg.baselines.recent.bootstrapLiftCi);

  const model = benchModel(prs);
  assert.deepEqual(validateBenchResults(model), [], 'null bounds validate');
  assert.match(renderBenchMarkdown(model), /\| Same-author follow-up \|.*\[[0-9.]+, ∞\] \(median [0-9.∞]+, n=1000, seed=20261108, \d+ unbounded\)/);
  assert.deepEqual(lintPage(renderBenchHtml(model)), []);
});

test('stage 0 metrics: bench.json with the new fields validates, and both reports render the lift-by-outcome table', () => {
  const model = benchModel(stage0Prs());
  assert.deepEqual(validateBenchResults(model), []);
  const md = renderBenchMarkdown(model);
  assert.match(md, /\*\*Lift by outcome \(`production`\)\.\*\*/);
  assert.match(md, /\| Same-author follow-up \| 2 \/ 4 \(0\.5,/);
  assert.match(md, /\| RA-signal follow-up \| .* \| `popular-near` \| ×1 \|/);
  const page = renderBenchHtml(model);
  assert.match(page, /Lift by outcome/);
  assert.deepEqual(lintPage(page), []);

  // GU-03-era files without the new fields still validate (all additions are optional).
  const legacy = structuredClone(model);
  for (const policy of ['production', 'ungated'] as const) {
    const agg = legacy.aggregates[policy];
    delete agg.headlineBaseline.byOutcome;
    delete agg.accuracyProxy.bootstrapSameAuthorCi;
    delete agg.accuracyProxy.bootstrapRaSignalCi;
    for (const b of Object.values(agg.baselines)) {
      delete b.raSignalFollowUpRate;
      delete b.bootstrapRateCi;
      delete b.liftByOutcome;
    }
  }
  for (const p of legacy.prs) delete p.changedFiles;
  assert.deepEqual(validateBenchResults(legacy), []);
  assert.doesNotMatch(renderBenchMarkdown(legacy), /Lift by outcome/);
});

function changes(files: number, modules: number): ChangeStructure {
  return {
    files: [],
    modules: [],
    totals: { files, additions: files * 3, deletions: 0, modules },
  };
}

const companion: ChecklistItem = {
  id: 'check:companion:src/a.ts',
  kind: 'forgotten-companion',
  question: 'q',
  evidence: ['ev:a'],
  priority: 2,
};
const companion2: ChecklistItem = { ...companion, id: 'check:companion:src/b.ts' };
const wide: ChecklistItem = { ...companion, id: 'check:surface:src/x.ts', kind: 'wide-surface', priority: 5 };

test('salience variants: defaults are unchanged; salienceFullMinSignals and salienceBreadthFull only ever lower salience', () => {
  // Stage 0 ran on the pre-GU-29 defaults, which `legacyPredictions` keeps:
  // one high-signal question, or breadth alone, is full.
  const legacy = { legacyPredictions: true };
  assert.equal(salienceOf(changes(1, 1), [companion], legacy).level, 'full');
  assert.equal(salienceOf(changes(9, 1), [], legacy).level, 'full');
  assert.equal(salienceOf(changes(2, 3), [], legacy).level, 'full');
  assert.equal(salienceOf(changes(2, 1), [wide], legacy).level, 'brief', 'wide-surface alone is never full');
  assert.equal(salienceOf(changes(2, 1), [], legacy).level, 'quiet');
  assert.deepEqual(salienceOf(changes(9, 3), [companion], legacy), salienceOf(changes(9, 3), [companion], { legacyPredictions: true, salienceFullMinSignals: 1 }));
  // GU-29 default is V2 (two signals); an explicit legacy-style value still wins.
  assert.deepEqual(salienceOf(changes(9, 3), [companion]), salienceOf(changes(9, 3), [companion], { salienceFullMinSignals: 2 }));
  assert.equal(salienceOf(changes(9, 1), []).level, 'brief', 'breadth alone is never full by default');

  // V2: two independent signals.
  const two = { salienceFullMinSignals: 2 };
  assert.equal(salienceOf(changes(1, 1), [companion], two).level, 'brief');
  assert.equal(salienceOf(changes(9, 3), [], two).level, 'brief', 'files and modules together are one breadth signal');
  assert.equal(salienceOf(changes(9, 1), [companion], two).level, 'full');
  assert.equal(salienceOf(changes(1, 1), [companion, companion2], two).level, 'full');

  // V3: breadth alone never full (a Stage 0 variant, so on the legacy defaults).
  const noBreadth = { legacyPredictions: true, salienceBreadthFull: false };
  assert.equal(salienceOf(changes(9, 3), [], noBreadth).level, 'brief');
  assert.equal(salienceOf(changes(9, 3), [companion], noBreadth).level, 'full');
  assert.deepEqual(salienceOf(changes(9, 3), [companion], noBreadth).reasons, ['1 high-signal question']);

  // Config parsing keeps valid values and drops invalid ones.
  assert.deepEqual(parseGutterConfigObject({ salienceFullMinSignals: 2.7, salienceBreadthFull: false }), {
    salienceFullMinSignals: 2,
    salienceBreadthFull: false,
  });
  assert.deepEqual(parseGutterConfigObject({ salienceFullMinSignals: 0, salienceBreadthFull: 'no' }), {});
});

test('CLI: gutter bench --config refuses unknown or invalid keys so a preregistered variant cannot silently run as the default', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gutter-variant-'));
  try {
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ minIntervalLow: 0.5, salienceFullMinSignalz: 2 }));
    const res = spawnSync(
      process.execPath,
      ['--experimental-strip-types', resolve('src/cli.ts'), 'bench', '--config', bad, '--cwd', dir],
      { encoding: 'utf8' },
    );
    assert.equal(res.status, 2);
    assert.match(res.stderr, /unknown or invalid key\(s\): salienceFullMinSignalz/);

    // Values the parser would silently change, and non-objects, are refused too.
    const cases: [unknown, RegExp][] = [
      [{ salienceFullMinSignals: 1.5 }, /would change: salienceFullMinSignals 1\.5 -> 1/],
      [{ maxChecklist: 3.9 }, /would change: maxChecklist 3\.9 -> 3/],
      [null, /must be a JSON object/],
      [[], /must be a JSON object/],
      [7, /must be a JSON object/],
    ];
    for (const [content, expected] of cases) {
      writeFileSync(bad, JSON.stringify(content));
      const r = spawnSync(
        process.execPath,
        ['--experimental-strip-types', resolve('src/cli.ts'), 'bench', '--config', bad, '--cwd', dir],
        { encoding: 'utf8' },
      );
      assert.equal(r.status, 2, `${JSON.stringify(content)} is refused`);
      assert.match(r.stderr, expected);
    }

    for (const file of ['stage0-v1-floor.json', 'stage0-v2-two-signals.json', 'stage0-v3-breadth-not-full.json']) {
      const raw = JSON.parse(readFileSync(join('bench/variants', file), 'utf8')) as Record<string, unknown>;
      assert.deepEqual(parseGutterConfigObject(raw), raw, `${file} parses exactly as written`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
