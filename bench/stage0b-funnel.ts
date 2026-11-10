/**
 * GU-28 Stage 0b, post-hoc (not preregistered): for every forgotten-companion question in a
 * default bench.json, replay that PR and tally the pair's relationship x track record x interval floor.
 * Explains why V4 (ghost + trackRecord.fired >= 3 + interval.low >= 0.3) keeps or drops questions.
 *
 *   node --experimental-strip-types bench/stage0b-funnel.ts <repo dir> <default bench.json>
 *
 * Needs the same repository checkout and repo-archaeology version as the bench run.
 */
import { readFileSync } from 'node:fs';
import { replayBriefWithMeta } from '../src/brief.ts';
import { normalizeTrackRecord } from '../src/sources/archaeology.ts';
const H = process.argv[2]!;
const m = JSON.parse(readFileSync(process.argv[3]!, 'utf8'));
const tally: Record<string, number> = {};
for (const p of m.prs) {
  const comps = p.policies.production.questions.filter((q: { kind: string }) => q.kind === 'forgotten-companion');
  if (!comps.length) continue;
  const res = await replayBriefWithMeta({ cwd: H, base: p.base, head: p.head, title: p.subject, noCalibration: true });
  for (const q of comps) {
    const file = q.targets[0].targetFile;
    const item = res.brief.forgotten.items.find((f) => f.file === file);
    const s = res.meta.raDiff?.suggestions.find((x) => x.to === file);
    const tr = normalizeTrackRecord(s?.trackRecord);
    const fired = !tr ? 'none' : tr.reason ?? (tr.fired! >= 3 ? 'fired>=3' : 'fired1-2');
    const k = `${item?.relationship ?? '?'} | ${fired} | low>=0.3:${(item?.interval.low ?? 0) >= 0.3}`;
    tally[k] = (tally[k] ?? 0) + 1;
  }
}
console.log(JSON.stringify(tally, null, 1));
