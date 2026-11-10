import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { BenchPrRecord } from '../src/bench/model.ts';
import { benchModel, pr, question, target } from './bench-fixtures.ts';

const report = (args: string[]) => spawnSync(process.execPath, [resolve('bench/stage0-report.mjs'), ...args], { encoding: 'utf8' });

/** n PRs; each has `companions` companion targets (Gutter same-author hit rate `gutterSame`) and a recent baseline. */
function prs(n: number, companions: number, gutterSame: boolean, recentSame: boolean): BenchPrRecord[] {
  return Array.from({ length: n }, (_, i) =>
    pr({
      n: i + 1,
      questions: Array.from({ length: companions }, (_, j) =>
        question('forgotten-companion', target({ file: `src/c${i}-${j}.ts`, followedUp: gutterSame || i % 2 === 0, sameAuthor: gutterSame, raSignal: gutterSame })),
      ),
      baselines: {
        recent: [target({ file: `src/r${i}.ts`, followedUp: true, sameAuthor: recentSame && i % 2 === 0 })],
        'popular-near': [target({ file: `src/n${i}.ts`, followedUp: false })],
        popular: [target({ file: `src/p${i}.ts`, followedUp: false })],
      },
    }),
  );
}

function writeRuns(root: string, def: BenchPrRecord[], v4: BenchPrRecord[]) {
  for (const [id, list] of [['default', def], ['v4-proven-pairs', v4]] as const) {
    mkdirSync(join(root, id), { recursive: true });
    writeFileSync(join(root, id, 'bench.json'), JSON.stringify(benchModel(list)));
  }
}

test('stage0b report: INSUFFICIENT under 30 companion targets, PASS and FAIL above it; every rendered number comes from results.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gutter-stage0b-'));
  try {
    const def = prs(40, 1, false, true);

    // INSUFFICIENT: V4 keeps 20 companion targets, even though its lift would pass.
    writeRuns(join(dir, 'few'), def, prs(20, 1, true, true));
    const few = report(['--stage0b', '--runs', join(dir, 'few'), '--write-results', join(dir, 'few.json')]);
    assert.equal(few.status, 0, few.stderr);
    assert.match(few.stderr, /stage0b: INSUFFICIENT/);
    assert.match(few.stdout, /Option 2 verdict: INSUFFICIENT: too few scored companion targets under V4 to judge option 2 on hono \(20 < 30\)/);
    assert.match(few.stdout, /Not decisive: the sample condition failed/);

    // PASS: 40 targets, Gutter's author follow-ups beat recent's.
    writeRuns(join(dir, 'pass'), def, prs(40, 1, true, true));
    const pass = report(['--stage0b', '--runs', join(dir, 'pass'), '--write-results', join(dir, 'pass.json')]);
    assert.match(pass.stderr, /stage0b: PASS/);

    // FAIL: 40 targets, recent wins on both stricter outcomes.
    writeRuns(join(dir, 'fail'), def, prs(40, 1, false, true));
    const fail = report(['--stage0b', '--runs', join(dir, 'fail'), '--write-results', join(dir, 'fail.json')]);
    assert.match(fail.stderr, /stage0b: FAIL/);

    // Every number in the V4 section is read from results.json.
    const results = JSON.parse(readFileSync(join(dir, 'pass.json'), 'utf8'));
    assert.equal(results.kind, 'gutter-stage0b-results');
    const v4 = results.runs.find((r: { id: string }) => r.id === 'v4-proven-pairs');
    const d = results.runs.find((r: { id: string }) => r.id === 'default');
    const out = pass.stdout;
    const f2 = (x: number) => x.toFixed(2);
    assert.ok(out.includes(`| Scored companion targets (needs ≥ 30) | ${d.companionScoredTargets} | ${v4.companionScoredTargets} |`));
    assert.ok(out.includes(`| Companion questions | ${d.companionQuestions} | ${v4.companionQuestions} |`));
    assert.ok(
      out.includes(
        `| PRs with a companion question (coverage) | ${f2(d.companionCoverage.rate)} (${d.companionCoverage.numerator}/${d.companionCoverage.denominator}) | ${f2(v4.companionCoverage.rate)} (${v4.companionCoverage.numerator}/${v4.companionCoverage.denominator}) |`,
      ),
    );
    assert.ok(out.includes(`same-author ×${f2(v4.byOutcome.sameAuthor.lift)} vs \`${v4.byOutcome.sameAuthor.strongestBaseline}\``));
    assert.ok(out.includes(`(${v4.fullSalienceShare.numerator}/${v4.fullSalienceShare.denominator})`));
    // Nothing numeric in the generated block is invented: the default and V4 run values and fixed thresholds only.
    const allowed = new Set(JSON.stringify(results).match(/\d+(?:\.\d+)?/g)!.flatMap((n) => [n, Number(n).toFixed(2)]));
    for (const n of ['0', '1', '2', '3', '30', '1.00', '1.0', '0.00']) allowed.add(n);
    const numbers = out.replace(/`[^`]*`/g, '').replace(/<!--[^>]*-->/g, '').match(/\d+(?:\.\d+)?/g)!;
    const unknown = numbers.filter((n) => !allowed.has(n));
    assert.deepEqual(unknown, [], 'every number in the generated block comes from results.json or a fixed rule constant');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stage0b report: the committed results.json regenerates the STAGE0.md block byte for byte, and the verdict is INSUFFICIENT', () => {
  const res = report([
    '--stage0b',
    '--results', 'docs/benchmark/data/honojs__hono/stage0b/results.json',
    '--stage0-results', 'docs/benchmark/data/honojs__hono/stage0/results.json',
  ]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /stage0b: INSUFFICIENT/);
  const doc = readFileSync('docs/benchmark/STAGE0.md', 'utf8').replace(/\r\n/g, '\n');
  const start = doc.indexOf('<!-- stage0b:results:start');
  const endMark = '<!-- stage0b:results:end -->';
  const end = doc.indexOf(endMark) + endMark.length;
  assert.equal(doc.slice(start, end), res.stdout.trimEnd());

  const results = JSON.parse(readFileSync('docs/benchmark/data/honojs__hono/stage0b/results.json', 'utf8'));
  for (const r of results.runs) assert.equal(r.raVersion, '0.10.0', `${r.id} ran on repo-archaeology 0.10.0`);
  assert.equal(results.analyzerDelta.fromRa, '0.4.0');
  assert.equal(results.analyzerDelta.toRa, '0.10.0');
});

/** First commit (oldest) whose diff adds `needle` to `file`, or touches `path` when needle is null. */
function firstCommit(args: string[]): string | undefined {
  const out = execFileSync('git', ['log', '--reverse', '--format=%H', ...args], { encoding: 'utf8' }).trim();
  return out.split('\n')[0] || undefined;
}

const shallow = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true';
  } catch {
    return true;
  }
})();

test(
  'preregistration order: each Stage 0 / 0b preregistration commit is a strict ancestor of the first commit with its data',
  { skip: shallow && process.env.CI !== 'true' ? 'shallow clone: no history to check' : false },
  () => {
    assert.equal(shallow, false, 'CI must check out full history (fetch-depth: 0) for this test');
    const stages = [
      { name: 'Stage 0 (GU-04)', heading: '# GU-04 Stage 0 · hono go/no-go (preregistration)', data: 'docs/benchmark/data/honojs__hono/stage0' },
      { name: 'Stage 0b (GU-28)', heading: '## Stage 0b · option 2 (preregistered', data: 'docs/benchmark/data/honojs__hono/stage0b' },
    ];
    for (const s of stages) {
      const prereg = firstCommit(['-S', s.heading, '--', 'docs/benchmark/STAGE0.md']);
      const data = firstCommit(['--', s.data]);
      assert.ok(prereg, `${s.name}: preregistration commit found`);
      assert.ok(data, `${s.name}: first data commit found`);
      assert.notEqual(prereg, data, `${s.name}: preregistration and data must be separate commits`);
      const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', prereg!, data!]);
      assert.equal(ancestor.status, 0, `${s.name}: ${prereg!.slice(0, 7)} must precede ${data!.slice(0, 7)}`);
    }
  },
);
