/**
 * GU-32 measurement (DECISIONS #21): `coverage: partial` before and after scoping it to the PR's files, on one
 * corpus repository's real PRs (the GU-30 `bench.json`). A measurement, not a gate: no verdict depends on it.
 *
 *   node --experimental-strip-types bench/gu32-coverage.ts <repo dir> <corpus/bench/bench.json> \
 *     [--gu31 <rerun1/gate-a-prime.json>] [--out coverage.json]
 *
 * Each PR is replayed once on the product path (`replayBriefWithMeta`, base graph on, no cache, no calibration),
 * exactly as Rerun 1's gate replay does. "Before" is the pre-GU-32 meaning, which the same brief still carries:
 * `partial` when `unresolved.count > 0` (that count is unchanged). "After" is `dependents.coverage`. With
 * `--gu31`, every replay is compared with GU-31's replay of the same PR (Rerun 1): salience and checklist kinds
 * must match (coverage never creates or suppresses an item), and "before" must equal GU-31's `coverage`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { parseArgs } from 'node:util';
import { replayBriefWithMeta } from '../src/brief.ts';
import type { GutterBrief } from '../src/contract.ts';

export interface CoverageReplay {
  pr: string;
  salience: string;
  kinds: string[];
  /** Pre-GU-32 meaning: any unresolved import in the repository. */
  before: 'full' | 'partial';
  /** GU-32: an unresolved import could reach the PR's files. */
  after: 'full' | 'partial';
  unresolved: number;
  unresolvedByReason: Record<string, number>;
  relevant: number;
  relevantByReason: Record<string, number>;
  /** Entries marked `coverage: 'partial'`, of all entries. */
  entriesPartial: number;
  entries: number;
}

export function coverageReplay(pr: string, b: GutterBrief): CoverageReplay {
  const u = b.dependents.unresolved;
  return {
    pr,
    salience: b.salience.level,
    kinds: b.checklist.map((c) => c.kind),
    before: u.count > 0 ? 'partial' : 'full',
    after: b.dependents.coverage,
    unresolved: u.count,
    unresolvedByReason: { ...(u.byReason ?? {}) },
    relevant: u.relevant?.count ?? 0,
    relevantByReason: { ...(u.relevant?.byReason ?? {}) },
    entriesPartial: b.dependents.entries.filter((e) => e.coverage === 'partial').length,
    entries: b.dependents.entries.length,
  };
}

interface Gu31Replay { pr: string; salience: string; kinds: string[]; coverage: 'full' | 'partial' }

/** Compare with GU-31's replays of the same PRs: what must not move, and what did. */
export function compareWithGu31(mine: readonly CoverageReplay[], gu31: readonly Gu31Replay[]) {
  const theirs = new Map(gu31.map((r) => [r.pr, r]));
  const out = { compared: 0, missing: [] as string[], salienceMismatches: [] as string[], checklistKindMismatches: [] as string[], beforeMismatches: [] as string[] };
  for (const r of mine) {
    const t = theirs.get(r.pr);
    if (!t) {
      out.missing.push(r.pr);
      continue;
    }
    out.compared++;
    if (t.salience !== r.salience) out.salienceMismatches.push(r.pr);
    if (t.kinds.join() !== r.kinds.join()) out.checklistKindMismatches.push(r.pr);
    if (t.coverage !== r.before) out.beforeMismatches.push(r.pr);
  }
  return out;
}

const add = (into: Record<string, number>, from: Record<string, number>) => {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
  return into;
};

export function summarizeCoverage(replays: readonly CoverageReplay[]) {
  const n = replays.length;
  const before = replays.filter((r) => r.before === 'partial').length;
  const after = replays.filter((r) => r.after === 'partial').length;
  return {
    prs: n,
    partialBefore: before,
    partialAfter: after,
    shareBefore: n ? before / n : null,
    shareAfter: n ? after / n : null,
    /** Summed over PRs (each PR's head counts its own repository-wide unresolved imports). */
    unresolvedByReason: replays.reduce((acc, r) => add(acc, r.unresolvedByReason), {} as Record<string, number>),
    relevantByReason: replays.reduce((acc, r) => add(acc, r.relevantByReason), {} as Record<string, number>),
    unresolvedTotal: replays.reduce((s, r) => s + r.unresolved, 0),
    relevantTotal: replays.reduce((s, r) => s + r.relevant, 0),
    entriesPartial: replays.reduce((s, r) => s + r.entriesPartial, 0),
    entries: replays.reduce((s, r) => s + r.entries, 0),
  };
}

/** Gutter's commit (with `+dirty` for uncommitted changes) and the Repo Archaeology version that replayed the PRs. */
export function measuredWith(): { gutterCommit: string; repoArchaeology: string } {
  const root = new URL('..', import.meta.url).pathname;
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const dirty = git('status', '--porcelain', '--', 'src', 'bench', 'package.json').length > 0;
  const ra = (createRequire(import.meta.url)('repo-archaeology/package.json') as { version: string }).version;
  return { gutterCommit: `${git('rev-parse', 'HEAD')}${dirty ? '+dirty' : ''}`, repoArchaeology: ra };
}

interface BenchPr { id: string; base: string; head: string; subject: string; prNumber: number | null }

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' }, gu31: { type: 'string' } } });
  const [repo, benchPath] = positionals;
  if (!repo || !benchPath) throw new Error('usage: gu32-coverage.ts <repo dir> <bench.json> [--gu31 gate-a-prime.json] [--out coverage.json]');
  const bench = JSON.parse(readFileSync(benchPath, 'utf8')) as { repo: { name: string; headSha: string }; tools: Record<string, string>; prs: BenchPr[] };
  const replays: CoverageReplay[] = [];
  for (const pr of bench.prs) {
    const res = await replayBriefWithMeta({ cwd: repo, base: pr.base, head: pr.head, title: pr.subject, ...(pr.prNumber ? { prNumber: pr.prNumber } : {}), noCalibration: true });
    replays.push(coverageReplay(pr.id, res.brief));
  }
  const gu31 = values.gu31 ? (JSON.parse(readFileSync(values.gu31, 'utf8')) as { replays: Gu31Replay[] }).replays : undefined;
  const result = {
    schemaVersion: 1,
    kind: 'gutter-gu32-coverage',
    repo: bench.repo.name,
    headSha: bench.repo.headSha,
    /** The code that replayed the PRs (bench.json's `tools` are those of the GU-30 run that selected them). */
    measured: measuredWith(),
    tools: bench.tools,
    summary: summarizeCoverage(replays),
    ...(gu31 ? { gu31: compareWithGu31(replays, gu31) } : {}),
    replays,
  };
  const json = JSON.stringify(result, null, 2) + '\n';
  if (values.out) writeFileSync(values.out, json);
  else process.stdout.write(json);
  const s = result.summary;
  process.stderr.write(`gu32 ${bench.repo.name}: partial ${s.partialBefore}/${s.prs} → ${s.partialAfter}/${s.prs}; relevant ${s.relevantTotal} of ${s.unresolvedTotal} unresolved${gu31 ? `; vs GU-31: salience ${result.gu31!.salienceMismatches.length}, kinds ${result.gu31!.checklistKindMismatches.length}, before ${result.gu31!.beforeMismatches.length} mismatches` : ''}\n`);
}

if (posix.basename(process.argv[1] ?? '') === 'gu32-coverage.ts') {
  main().catch((err: unknown) => {
    process.stderr.write(`gu32-coverage: ${(err as Error).message}\n`);
    process.exitCode = 1;
  });
}
