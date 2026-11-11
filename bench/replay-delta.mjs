#!/usr/bin/env node
// Per-PR delta between two gate-a-prime.json runs of the same PRs (DECISIONS #16: every analyzer upgrade is reported
// as a per-PR delta against the previous run). Compares what each replay said (salience, checklist kinds, coverage,
// dependents.method) and summarizes replay cost for PRs that remove files.
//
//   node bench/replay-delta.mjs <before gate-a-prime.json> <after gate-a-prime.json> [--json]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayRuntime } from './aggregate.mjs';

const FIELDS = ['salience', 'kinds', 'coverage', 'method'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Per-PR differences between two replay lists (matched by PR id). */
export function replayDelta(before, after) {
  const byId = new Map(before.map((r) => [r.pr, r]));
  const changed = [];
  const missing = [];
  for (const a of after) {
    const b = byId.get(a.pr);
    if (!b) {
      missing.push(a.pr);
      continue;
    }
    const fields = FIELDS.filter((f) => !same(b[f], a[f]));
    if (fields.length) changed.push({ pr: a.pr, fields, before: Object.fromEntries(fields.map((f) => [f, b[f] ?? null])), after: Object.fromEntries(fields.map((f) => [f, a[f] ?? null])) });
  }
  const count = (f) => changed.filter((c) => c.fields.includes(f)).length;
  return {
    prs: after.length,
    unmatched: missing,
    changed: changed.length,
    byField: Object.fromEntries(FIELDS.map((f) => [f, count(f)])),
    details: changed,
    runtime: { before: replayRuntime(before).removes, after: replayRuntime(after).removes },
  };
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (args.length !== 2) throw new Error('usage: replay-delta.mjs <before gate-a-prime.json> <after gate-a-prime.json> [--json]');
  const [before, after] = args.map((p) => JSON.parse(readFileSync(p, 'utf8')).replays);
  if (!before || !after) throw new Error('both files need `replays` (gate-a-prime.ts since GU-31)');
  const d = replayDelta(before, after);
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(d, null, 2) + '\n');
  else {
    process.stdout.write(`${d.prs} PRs; ${d.changed} changed (${Object.entries(d.byField).map(([k, v]) => `${k} ${v}`).join(', ')}); unmatched ${d.unmatched.length}\n`);
    for (const c of d.details) process.stdout.write(`  ${c.pr}: ${c.fields.map((f) => `${f} ${JSON.stringify(c.before[f])} → ${JSON.stringify(c.after[f])}`).join('; ')}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
