#!/usr/bin/env node
// GU-32 measurement runner (DECISIONS #21). For every corpus repository: replay its GU-30 real PRs with the
// current code (bench/gu32-coverage.ts, compared with GU-31's Rerun 1 replays), rerun Rerun 1's seeded
// mutations with the same seed (bench/seeded.ts --seed 20261111) and compare them record by record with Rerun 1.
// A measurement, not a gate: nothing here is preregistered, because no verdict depends on it.
//
//   node bench/gu32-run.mjs [--jobs 2] [--only owner__repo,...] [--rerun1-root <dir>] [--baseline <checkout>] [--fresh]
//
// Clones come from $GUTTER_BENCH_CACHE (default ~/.cache/gutter-bench), as for the corpus run. Output goes to
// docs/benchmark/data/<owner>__<repo>/gu32/ (coverage.json, seeded/, seeded-compare.json); a repository whose
// files exist is skipped unless --fresh. `--rerun1-root` is where Rerun 1's data lives (default: this checkout's
// docs/benchmark/data). `--baseline` is a checkout of the code GU-32 is based on (main without GU-32): for a repository
// whose seeded records differ from Rerun 1, the same mutations are rescored with that code (gu32/seeded-baseline/), so
// a difference can be told apart from changes main made after Rerun 1.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { repoName, repoSlug } from './corpus.mjs';
import { runCommand } from './run-corpus.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GU32_SEED = 20261111;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

/**
 * Seeded records compared with Rerun 1's, by mutation id: everything that scores a mutation must match
 * (reported items, their confirmation, detection); only `missReason` may move, and only from `partial` to
 * `missed` (a miss is no longer labeled partial when nothing unresolved could reach the removed file).
 */
export function compareSeeded(mine, rerun1) {
  const theirs = new Map(rerun1.map((r) => [r.id, r]));
  const out = { compared: 0, missing: [], scoreMismatches: [], missReasonMoves: {}, otherMissReasonChanges: [], coverageMoves: {} };
  const scoreOf = (r) => JSON.stringify({ positive: r.positive, detected: r.detected, reported: r.reported, error: r.error ?? null });
  for (const r of mine) {
    const t = theirs.get(r.id);
    if (!t) {
      out.missing.push(r.id);
      continue;
    }
    out.compared++;
    if (scoreOf(r) !== scoreOf(t)) out.scoreMismatches.push(r.id);
    const from = t.missReason ?? 'none';
    const to = r.missReason ?? 'none';
    if (from !== to) {
      const key = `${from}→${to}`;
      out.missReasonMoves[key] = (out.missReasonMoves[key] ?? 0) + 1;
      if (!(from === 'partial' && to === 'missed')) out.otherMissReasonChanges.push(r.id);
    }
    if (t.coverage !== r.coverage) {
      const key = `${t.coverage}→${r.coverage}`;
      out.coverageMoves[key] = (out.coverageMoves[key] ?? 0) + 1;
    }
  }
  return out;
}

/** The headline seeded numbers that must not move. */
export const SEEDED_INVARIANTS = ['positives', 'negatives', 'reportedItems', 'confirmedItems', 'precision', 'detected', 'recall', 'falsePositives', 'falsePositiveRate', 'errors'];

async function main() {
  const { values } = parseArgs({ options: { jobs: { type: 'string', default: '2' }, only: { type: 'string' }, 'rerun1-root': { type: 'string' }, baseline: { type: 'string' }, fresh: { type: 'boolean', default: false } } });
  const baseline = values.baseline ? resolve(values.baseline) : undefined;
  const corpus = readJson(join(ROOT, 'bench', 'corpus.json'));
  const cache = process.env.GUTTER_BENCH_CACHE ?? join(homedir(), '.cache', 'gutter-bench');
  const dataRoot = join(ROOT, 'docs', 'benchmark', 'data');
  const rerun1Root = resolve(values['rerun1-root'] ?? dataRoot);
  const only = values.only ? new Set(values.only.split(',')) : undefined;
  const repos = corpus.repos.filter((r) => !only || only.has(repoSlug(r.url)));
  const node = process.execPath;
  const ts = (script, args) => runCommand(node, ['--experimental-strip-types', join(ROOT, script), ...args], {});

  const one = async (repo) => {
    const slug = repoSlug(repo.url);
    const dir = join(cache, slug);
    const out = join(dataRoot, slug, 'gu32');
    if (values.fresh) rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const benchJson = join(dataRoot, slug, 'corpus', 'bench', 'bench.json');
    const r1 = join(rerun1Root, slug, 'rerun1');
    const t0 = Date.now();
    if (!existsSync(join(out, 'coverage.json'))) {
      const r = await ts('bench/gu32-coverage.ts', [dir, benchJson, '--gu31', join(r1, 'gate-a-prime.json'), '--out', join(out, 'coverage.json')]);
      if (r.code !== 0) throw new Error(`${slug}: gu32-coverage exited ${r.code}: ${r.stderrTail}`);
    }
    if (!existsSync(join(out, 'seeded', 'seeded-summary.json'))) {
      const r = await ts('bench/seeded.ts', ['--cwd', dir, '--language', repo.language, '--bench', benchJson, '--out', join(out, 'seeded'), '--name', repoName(repo.url), '--seed', String(GU32_SEED)]);
      if (r.code !== 0) throw new Error(`${slug}: seeded exited ${r.code}: ${r.stderrTail}`);
    }
    const mine = readJson(join(out, 'seeded', 'seeded-summary.json'));
    const theirs = readJson(join(r1, 'seeded', 'seeded-summary.json'));
    const records = compareSeeded(readJsonl(join(out, 'seeded', 'seeded.jsonl')), readJsonl(join(r1, 'seeded', 'seeded.jsonl')));
    const summaryMismatches = SEEDED_INVARIANTS.filter((k) => JSON.stringify(mine[k]) !== JSON.stringify(theirs[k]));
    let base;
    if (baseline && (records.scoreMismatches.length || summaryMismatches.length)) {
      const bdir = join(out, 'seeded-baseline');
      if (!existsSync(join(bdir, 'seeded-summary.json'))) {
        const r = await runCommand(node, ['--experimental-strip-types', join(baseline, 'bench', 'seeded.ts'), '--cwd', dir, '--language', repo.language, '--bench', benchJson, '--out', bdir, '--name', repoName(repo.url), '--seed', String(GU32_SEED)], {});
        if (r.code !== 0) throw new Error(`${slug}: baseline seeded exited ${r.code}: ${r.stderrTail}`);
      }
      const b = readJson(join(bdir, 'seeded-summary.json'));
      const vs = compareSeeded(readJsonl(join(out, 'seeded', 'seeded.jsonl')), readJsonl(join(bdir, 'seeded.jsonl')));
      base = {
        commit: execFileSync('git', ['-C', baseline, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        summaryMismatches: SEEDED_INVARIANTS.filter((k) => JSON.stringify(mine[k]) !== JSON.stringify(b[k])),
        records: { compared: vs.compared, missing: vs.missing, scoreMismatches: vs.scoreMismatches },
      };
    }
    writeFileSync(join(out, 'seeded-compare.json'), JSON.stringify({ schemaVersion: 1, kind: 'gutter-gu32-seeded-compare', repo: repoName(repo.url), seed: GU32_SEED, summaryMismatches, records, ...(base ? { baseline: base } : {}) }, null, 2) + '\n');
    process.stderr.write(`${slug}: done in ${Math.round((Date.now() - t0) / 1000)} s; seeded summary mismatches ${summaryMismatches.length}, record score mismatches ${records.scoreMismatches.length}\n`);
  };

  const queue = [...repos];
  const failures = [];
  await Promise.all(Array.from({ length: Math.max(1, Number(values.jobs)) }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      try {
        await one(r);
      } catch (err) {
        failures.push(err.message);
        process.stderr.write(`${err.message}\n`);
      }
    }
  }));
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`gu32-run: ${err.message}\n`);
    process.exitCode = 1;
  });
}
