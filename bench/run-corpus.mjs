#!/usr/bin/env node
// GU-30 corpus runner (docs/benchmark/CORPUS.md §2). Plain Node >= 22; spawns Gutter's TypeScript tools
// with --experimental-strip-types. Nothing from the analyzed repositories is installed, built or run.
//
//   node bench/run-corpus.mjs [--jobs 2] [--timeout-min 45] [--only owner__repo,...] [--fresh]
//
// Per repository (CORPUS.md §2): blobless clone checked out at the pin; gutter bench (200 PRs, 7 days,
// default config); bench/gate-a-prime.ts; bench/seeded.ts; two repo-archaeology backtests (reported only).
// Each step's status is persisted in <out>/<owner>__<repo>/corpus/status.json, so a killed run resumes
// where it stopped. Steps 1–3 share the per-repository timeout; a timeout is recorded as "failed: timeout".
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, homedir, platform, release, arch, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { repoName, repoSlug, validateCorpus } from './corpus.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const STEPS = ['clone', 'bench', 'gate', 'seeded', 'backtest', 'backtestOrigin'];
/** Steps whose time counts against the per-repository timeout and decide "completed" (CORPUS.md §5). */
export const TIMED_STEPS = ['bench', 'gate', 'seeded'];
const BACKTEST_TIMEOUT_MS = 15 * 60 * 1000;
/** Prerequisites: the seeded run needs bench.json's PR heads; everything needs the clone. */
export const NEEDS = { bench: ['clone'], gate: ['bench'], seeded: ['bench'], backtest: ['clone'], backtestOrigin: ['clone'] };

const writeJson = (p, v) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
};
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined);

/** Run a command with a timeout; kills the whole process group on timeout. Resolves { code, timedOut, stderrTail, stdout? }. */
export function runCommand(cmd, args, { cwd, timeoutMs, stdoutFile, env } = {}) {
  return new Promise((res) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', stdoutFile ? 'pipe' : 'ignore', 'pipe'] });
    const out = [];
    let err = '';
    child.stdout?.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => (err = (err + d.toString()).slice(-4000)));
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
        }, timeoutMs)
      : undefined;
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (stdoutFile && !timedOut && code === 0) {
        mkdirSync(dirname(stdoutFile), { recursive: true });
        writeFileSync(stdoutFile, Buffer.concat(out));
      }
      res({ code, timedOut, stderrTail: err.trim().split('\n').slice(-3).join(' | ') });
    });
  });
}

/** Evaluated PRs in a bench.json, and a note when there are fewer than the 200 the corpus asks for. */
export function benchCount(benchJsonPath, want = 200) {
  const evaluated = readJson(benchJsonPath)?.funnel?.evaluated;
  return { evaluated, ...(typeof evaluated === 'number' && evaluated < want ? { note: `only ${evaluated} PRs evaluated (needs ${want})` } : {}) };
}

/** The real steps. Each returns { ok, timedOut?, reason?, note? }. */
export function realSteps({ node = process.execPath } = {}) {
  const ts = (script, args, opts) => runCommand(node, ['--experimental-strip-types', join(ROOT, script), ...args], opts);
  const raCli = join(ROOT, 'node_modules', 'repo-archaeology', 'dist', 'cli.js');
  return {
    async clone({ repo, dir }) {
      if (!existsSync(join(dir, '.git'))) {
        mkdirSync(dirname(dir), { recursive: true });
        const r = await runCommand('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', repo.url + '.git', dir]);
        if (r.code !== 0) return { ok: false, reason: `clone failed: ${r.stderrTail}` };
      }
      try {
        execFileSync('git', ['-C', dir, 'cat-file', '-e', `${repo.pinnedSha}^{commit}`], { stdio: 'ignore' });
      } catch {
        const f = await runCommand('git', ['-C', dir, 'fetch', '--quiet', '--filter=blob:none', 'origin', repo.pinnedSha]);
        if (f.code !== 0) return { ok: false, reason: `pinned SHA not fetchable: ${f.stderrTail}` };
      }
      const c = await runCommand('git', ['-C', dir, 'checkout', '--quiet', '--force', '--detach', repo.pinnedSha]);
      return c.code === 0 ? { ok: true } : { ok: false, reason: `checkout failed: ${c.stderrTail}` };
    },
    async bench({ dir, data, timeoutMs }) {
      const r = await ts('src/cli.ts', ['bench', '--cwd', dir, '--prs', '200', '--window-days', '7', '--resume', '--out', join(data, 'bench')], { timeoutMs });
      if (r.timedOut) return { ok: false, timedOut: true };
      if (r.code !== 0) return { ok: false, reason: `gutter bench exited ${r.code}: ${r.stderrTail}` };
      rmSync(join(data, 'bench', 'bench.html'), { force: true });
      rmSync(join(data, 'bench', 'bench.partial.jsonl'), { force: true });
      return { ok: true, ...benchCount(join(data, 'bench', 'bench.json')) };
    },
    async gate({ dir, data, timeoutMs }) {
      const r = await ts('bench/gate-a-prime.ts', [dir, join(data, 'bench', 'bench.json'), '--out', join(data, 'gate-a-prime.json')], { timeoutMs });
      if (r.timedOut) return { ok: false, timedOut: true };
      return r.code === 0 ? { ok: true } : { ok: false, reason: `gate-a-prime exited ${r.code}: ${r.stderrTail}` };
    },
    async seeded({ repo, dir, data, timeoutMs }) {
      const r = await ts('bench/seeded.ts', ['--cwd', dir, '--language', repo.language, '--bench', join(data, 'bench', 'bench.json'), '--out', join(data, 'seeded'), '--name', repoName(repo.url)], { timeoutMs });
      if (r.timedOut) return { ok: false, timedOut: true };
      return r.code === 0 ? { ok: true } : { ok: false, reason: `seeded exited ${r.code}: ${r.stderrTail}` };
    },
    async backtest({ dir, data }) {
      const r = await runCommand(node, [raCli, 'backtest', '--json'], { cwd: dir, timeoutMs: BACKTEST_TIMEOUT_MS, stdoutFile: join(data, 'backtest.json') });
      if (r.timedOut) return { ok: false, timedOut: true };
      return r.code === 0 ? { ok: true } : { ok: false, reason: `backtest exited ${r.code}: ${r.stderrTail}` };
    },
    async backtestOrigin({ dir, data }) {
      const r = await runCommand(node, [raCli, 'backtest', '--compare-origin-weights', 'bot=0,agent=0.5', '--json'], { cwd: dir, timeoutMs: BACKTEST_TIMEOUT_MS, stdoutFile: join(data, 'backtest-origin.json') });
      if (r.timedOut) return { ok: false, timedOut: true };
      return r.code === 0 ? { ok: true } : { ok: false, reason: `backtest exited ${r.code}: ${r.stderrTail}` };
    },
  };
}

const cmdVersion = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
  } catch {
    return 'unavailable';
  }
};

/** Versions and machine, recorded with every run (CORPUS.md §2). */
export function environment() {
  const pkg = (p) => readJson(join(ROOT, p))?.version ?? 'unavailable';
  const c = cpus();
  return {
    gutter: pkg('package.json'),
    repoArchaeology: pkg('node_modules/repo-archaeology/package.json'),
    typescript: pkg('node_modules/typescript/package.json'),
    node: process.version,
    git: cmdVersion('git', ['--version']).replace(/^git version /, ''),
    machine: { platform: platform(), release: release(), arch: arch(), cpu: c[0]?.model ?? 'unknown', cores: c.length, memoryGb: Math.round(totalmem() / 2 ** 30) },
  };
}

/**
 * Run (or resume) the corpus. `steps` maps step names to async functions (tests inject fakes).
 * Returns the run manifest written to <out>/corpus-run.json.
 */
export async function runCorpus({ corpus, out, cache, jobs = 2, timeoutMs = 45 * 60 * 1000, steps = realSteps(), only, fresh = false, now = () => new Date(), log = () => {} }) {
  const problems = validateCorpus(corpus);
  if (problems.length) throw new Error(`invalid corpus: ${problems.join('; ')}`);
  const repos = corpus.repos.filter((r) => !only || only.includes(repoSlug(r.url)));
  const env = environment();
  const rows = new Array(repos.length);
  let next = 0;

  async function runRepo(repo) {
    const slug = repoSlug(repo.url);
    const data = join(out, slug, 'corpus');
    const statusPath = join(data, 'status.json');
    if (fresh) rmSync(data, { recursive: true, force: true });
    const status = readJson(statusPath) ?? { repo: repoName(repo.url), pinnedSha: repo.pinnedSha, steps: {}, timedMs: 0 };
    if (status.pinnedSha !== repo.pinnedSha) throw new Error(`${slug}: status.json is for ${status.pinnedSha}, corpus pins ${repo.pinnedSha}; rerun with --fresh`);
    const dir = join(cache, slug);
    const save = () => writeJson(statusPath, status);
    const wallStart = Date.now();
    for (const name of STEPS) {
      const prev = status.steps[name];
      if (prev?.status === 'done') continue;
      const timed = TIMED_STEPS.includes(name);
      // A step whose prerequisite did not finish is skipped (and retried on the next resume).
      const blocker = (NEEDS[name] ?? []).find((s) => status.steps[s]?.status !== 'done');
      if (blocker) {
        status.steps[name] = { status: 'skipped', reason: `${blocker} did not finish` };
        save();
        continue;
      }
      const remaining = timed ? timeoutMs - (status.timedMs ?? 0) : undefined;
      if (timed && remaining <= 0) {
        status.steps[name] = { status: 'timeout', reason: 'per-repository timeout reached before this step' };
        save();
        continue;
      }
      const t0 = Date.now();
      status.steps[name] = { status: 'running', startedAt: now().toISOString() };
      save();
      let r;
      try {
        r = await steps[name]({ repo, dir, data, timeoutMs: remaining });
      } catch (err) {
        r = { ok: false, reason: `${name} threw: ${err.message.split('\n')[0]}` };
      }
      const ms = Date.now() - t0;
      if (timed) status.timedMs = (status.timedMs ?? 0) + ms;
      status.steps[name] = r.ok
        ? { status: 'done', ms, ...(r.note ? { note: r.note } : {}), ...(r.evaluated !== undefined ? { evaluated: r.evaluated } : {}) }
        : r.timedOut
          ? { status: 'timeout', ms, reason: `failed: timeout after ${Math.round(((status.timedMs ?? ms) / 60000) * 10) / 10} min in ${name}` }
          : { status: 'failed', ms, reason: r.reason ?? 'unknown failure' };
      save();
      log(`${slug}: ${name} ${status.steps[name].status}${status.steps[name].reason ? ` (${status.steps[name].reason})` : ''}`);
    }
    status.wallMs = (status.wallMs ?? 0) + (Date.now() - wallStart);
    status.completed = TIMED_STEPS.every((s) => status.steps[s]?.status === 'done');
    status.failure = status.completed
      ? undefined
      : (() => {
          const bad = STEPS.map((s) => [s, status.steps[s]]).find(([, v]) => v && (v.status === 'timeout' || v.status === 'failed'));
          return bad ? `${bad[1].status === 'timeout' ? 'failed: timeout' : 'failed'} (${bad[0]}): ${bad[1].reason}` : 'incomplete';
        })();
    status.environment = env;
    save();
    return { repo: repoName(repo.url), slug, completed: status.completed, failure: status.failure ?? null, evaluated: status.steps.bench?.evaluated ?? null, note: status.steps.bench?.note ?? null, wallMs: status.wallMs, timedMs: status.timedMs };
  }

  async function worker() {
    while (next < repos.length) {
      const i = next++;
      rows[i] = await runRepo(repos[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, repos.length)) }, worker));
  const manifest = { schemaVersion: 1, kind: 'gutter-corpus-run', finishedAt: now().toISOString(), timeoutMin: timeoutMs / 60000, jobs, environment: env, repos: rows };
  writeJson(join(out, 'corpus-run.json'), manifest);
  return manifest;
}

async function main() {
  const { values } = parseArgs({
    options: {
      jobs: { type: 'string', default: '2' },
      'timeout-min': { type: 'string', default: '45' },
      only: { type: 'string' },
      fresh: { type: 'boolean', default: false },
      out: { type: 'string', default: join(ROOT, 'docs', 'benchmark', 'data') },
      corpus: { type: 'string', default: join(ROOT, 'bench', 'corpus.json') },
    },
  });
  const cache = process.env.GUTTER_BENCH_CACHE ?? join(homedir(), '.cache', 'gutter-bench');
  const manifest = await runCorpus({
    corpus: JSON.parse(readFileSync(values.corpus, 'utf8')),
    out: values.out,
    cache,
    jobs: Number(values.jobs),
    timeoutMs: Number(values['timeout-min']) * 60 * 1000,
    only: values.only?.split(','),
    fresh: values.fresh,
    log: (s) => process.stderr.write(`${s}\n`),
  });
  const done = manifest.repos.filter((r) => r.completed).length;
  process.stderr.write(`corpus: ${done}/${manifest.repos.length} completed\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
