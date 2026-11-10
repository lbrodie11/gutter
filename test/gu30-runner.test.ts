/**
 * GU-30 corpus runner: resume after a kill, timeouts, short repositories, recorded versions.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// @ts-expect-error: plain .mjs module without type declarations
import { benchCount, environment, runCommand, runCorpus, STEPS } from '../bench/run-corpus.mjs';

const dirs: string[] = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), 'gutter-corpus-run-'));
  dirs.push(d);
  return d;
};
const corpus = (n = 1) => ({
  schemaVersion: 1,
  selectionDate: '2026-11-10',
  repos: Array.from({ length: n }, (_, i) => ({
    url: `https://github.com/example/repo${i}`, pinnedSha: String(i).repeat(40).slice(0, 40).replace(/[^0-9a-f]/g, 'a'),
    branch: 'main', language: 'typescript', category: 'ts-library', mergeStyle: 'squash', expected: 'good', why: 'test fixture repository',
  })),
});
type Step = (ctx: { timeoutMs?: number }) => Promise<Record<string, unknown>>;
const okSteps = (calls: string[], over: Record<string, Step> = {}) =>
  Object.fromEntries(STEPS.map((s: string) => [s, over[s] ?? (async () => (calls.push(s), { ok: true }))]));
const status = (out: string, slug = 'example__repo0') => JSON.parse(readFileSync(join(out, slug, 'corpus', 'status.json'), 'utf8'));

test('runner: a killed run resumes where it stopped (done steps are not re-run)', async () => {
  const out = scratch();
  const child = join(out, 'child.mjs');
  // A separate process runs the corpus with a gate step that never returns; we kill it mid-run.
  writeFileSync(child, `import { runCorpus, STEPS } from ${JSON.stringify(pathToFileURL(resolve('bench/run-corpus.mjs')).href)};
const steps = Object.fromEntries(STEPS.map((s) => [s, s === 'gate' ? () => new Promise(() => setInterval(() => {}, 1000)) : async () => ({ ok: true })]));
await runCorpus({ corpus: ${JSON.stringify(corpus())}, out: ${JSON.stringify(out)}, cache: ${JSON.stringify(out)}, steps });
`);
  const proc = spawn(process.execPath, [child], { stdio: 'ignore' });
  const exited = new Promise((r) => proc.on('exit', r));
  for (let i = 0; i < 200 && !(existsSync(join(out, 'example__repo0', 'corpus', 'status.json')) && status(out).steps.gate?.status === 'running'); i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal(status(out).steps.gate.status, 'running');
  proc.kill('SIGKILL');
  await exited;
  assert.equal(status(out).steps.bench.status, 'done');

  const calls: string[] = [];
  const manifest = await runCorpus({ corpus: corpus(), out, cache: out, steps: okSteps(calls) });
  assert.deepEqual(calls, ['gate', 'seeded', 'backtest', 'backtestOrigin'], 'clone and bench were not re-run');
  assert.equal(manifest.repos[0].completed, true);
});

test('runner: a timeout produces a "failed: timeout" row; later timed steps are not run', async () => {
  const out = scratch();
  const calls: string[] = [];
  const steps = okSteps(calls, {
    // The real step kills its process at the timeout; here the command really runs and is killed.
    gate: async ({ timeoutMs }) => {
      const r = await runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { timeoutMs });
      return r.timedOut ? { ok: false, timedOut: true } : { ok: true };
    },
    bench: async () => (await new Promise((r) => setTimeout(r, 50)), calls.push('bench'), { ok: true }),
  });
  const t0 = Date.now();
  const manifest = await runCorpus({ corpus: corpus(), out, cache: out, steps, timeoutMs: 400 });
  assert.ok(Date.now() - t0 < 10_000, 'the hung command was killed');
  const row = manifest.repos[0];
  assert.equal(row.completed, false);
  assert.match(row.failure, /^failed: timeout \(gate\)/);
  assert.equal(status(out).steps.seeded.status, 'timeout', 'no budget left for the seeded step');
  assert.ok(!calls.includes('seeded'));
});

test('runner: a repository with fewer than 200 PRs is listed with its count', async () => {
  const out = scratch();
  const bench = join(out, 'bench.json');
  writeFileSync(bench, JSON.stringify({ funnel: { evaluated: 137 } }));
  assert.deepEqual(benchCount(bench), { evaluated: 137, note: 'only 137 PRs evaluated (needs 200)' });
  writeFileSync(bench, JSON.stringify({ funnel: { evaluated: 200 } }));
  assert.deepEqual(benchCount(bench), { evaluated: 200 });
  const manifest = await runCorpus({ corpus: corpus(), out, cache: out, steps: okSteps([], { bench: async () => ({ ok: true, evaluated: 137, note: 'only 137 PRs evaluated (needs 200)' }) }) });
  assert.equal(manifest.repos[0].evaluated, 137);
  assert.equal(manifest.repos[0].note, 'only 137 PRs evaluated (needs 200)');
});

test('runner: versions and the machine are recorded in the manifest and every status file', async () => {
  const out = scratch();
  const manifest = await runCorpus({ corpus: corpus(2), out, cache: out, steps: okSteps([]), jobs: 2 });
  const pkg = (p: string) => JSON.parse(readFileSync(p, 'utf8')).version;
  assert.equal(manifest.environment.gutter, pkg('package.json'));
  assert.equal(manifest.environment.repoArchaeology, pkg('node_modules/repo-archaeology/package.json'));
  assert.equal(manifest.environment.typescript, pkg('node_modules/typescript/package.json'));
  assert.equal(manifest.environment.node, process.version);
  assert.match(manifest.environment.git, /^\d+\.\d+/);
  assert.ok(manifest.environment.machine.cores >= 1);
  assert.deepEqual(status(out, 'example__repo1').environment, environment());
  assert.equal(manifest.repos.length, 2);
  assert.ok(existsSync(join(out, 'corpus-run.json')));
});

test('runner: an invalid corpus is refused before anything runs', async () => {
  const bad = corpus();
  delete (bad.repos[0] as Record<string, unknown>).pinnedSha;
  await assert.rejects(runCorpus({ corpus: bad, out: scratch(), cache: scratch(), steps: okSteps([]) }), /pinnedSha: missing/);
});
