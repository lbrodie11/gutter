/**
 * GU-32 · the measurement tooling (bench/gu32-coverage.ts, bench/gu32-run.mjs, bench/gu32-report.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { compareWithGu31, coverageReplay, summarizeCoverage, type CoverageReplay } from '../bench/gu32-coverage.ts';
// @ts-expect-error plain ESM bench script without type declarations
import { compareSeeded, SEEDED_INVARIANTS } from '../bench/gu32-run.mjs';
// @ts-expect-error plain ESM bench script without type declarations
import { gu32Results, median, renderCoverageMd } from '../bench/gu32-report.mjs';
import { assembleBrief } from '../src/brief.ts';
import { scenarios } from './fixtures/gu29/scenarios.ts';

const replay = (pr: string, before: 'full' | 'partial', after: 'full' | 'partial', extra: Partial<CoverageReplay> = {}): CoverageReplay => ({
  pr, salience: 'brief', kinds: ['untested-change'], before, after, unresolved: before === 'partial' ? 2 : 0, unresolvedByReason: before === 'partial' ? { 'unknown-package': 2 } : {},
  relevant: after === 'partial' ? 1 : 0, relevantByReason: after === 'partial' ? { 'unknown-package': 1 } : {}, entriesPartial: 0, entries: 1, ...extra,
});

test('coverageReplay: before is the repository-wide count, after is dependents.coverage', () => {
  const s = scenarios().find((x) => x.name === 'partial')!;
  const b = assembleBrief({ ...s, dependents: { ...s.dependents, coverage: 'full', unresolved: { count: 7, samples: [], byReason: { 'alias-unmatched': 7 }, relevant: { count: 0, samples: [], byReason: {} } } } });
  const r = coverageReplay('pr-1', b);
  assert.equal(r.before, 'partial');
  assert.equal(r.after, 'full');
  assert.deepEqual([r.unresolved, r.relevant], [7, 0]);
});

test('summarizeCoverage and compareWithGu31', () => {
  const mine = [replay('a', 'partial', 'full'), replay('b', 'partial', 'partial'), replay('c', 'full', 'full', { salience: 'quiet' })];
  const s = summarizeCoverage(mine);
  assert.deepEqual([s.prs, s.partialBefore, s.partialAfter, s.shareBefore, s.unresolvedTotal, s.relevantTotal], [3, 2, 1, 2 / 3, 4, 1]);
  assert.deepEqual(s.unresolvedByReason, { 'unknown-package': 4 });
  const gu31 = [
    { pr: 'a', salience: 'brief', kinds: ['untested-change'], coverage: 'partial' as const },
    { pr: 'b', salience: 'full', kinds: ['untested-change'], coverage: 'partial' as const },
    { pr: 'c', salience: 'quiet', kinds: [], coverage: 'partial' as const },
  ];
  assert.deepEqual(compareWithGu31(mine, gu31), { compared: 3, missing: [], salienceMismatches: ['b'], checklistKindMismatches: ['c'], beforeMismatches: ['c'] });
});

test('compareSeeded: scores must match; only partial → missed label moves are expected', () => {
  const rec = (id: string, missReason?: string, coverage = 'partial', detected = false) => ({ id, positive: true, detected, reported: [], coverage, ...(missReason ? { missReason } : {}) });
  const out = compareSeeded(
    [rec('1', 'missed', 'full'), rec('2', undefined, 'full', true), rec('3', 'unchecked'), rec('4', 'missed')],
    [rec('1', 'partial'), rec('2', undefined, 'partial', true), rec('3', 'partial'), rec('4', 'missed', 'partial', true), rec('5', 'missed')],
  );
  assert.equal(out.compared, 4);
  assert.deepEqual(out.scoreMismatches, ['4']);
  assert.deepEqual(out.missReasonMoves, { 'partial→missed': 1, 'partial→unchecked': 1 });
  assert.deepEqual(out.otherMissReasonChanges, ['3']);
  assert.deepEqual(out.coverageMoves, { 'partial→full': 2 });
  assert.ok(SEEDED_INVARIANTS.includes('precision') && SEEDED_INVARIANTS.includes('recall') && SEEDED_INVARIANTS.includes('falsePositives'));
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('COVERAGE.md and results-gu32.json are what the report computes from the committed data', { skip: !existsSync('docs/benchmark/COVERAGE.md') }, () => {
  const res = gu32Results();
  assert.deepEqual(JSON.parse(readFileSync('docs/benchmark/results-gu32.json', 'utf8')), JSON.parse(JSON.stringify(res)));
  assert.equal(readFileSync('docs/benchmark/COVERAGE.md', 'utf8').replace(/\r\n/g, '\n'), renderCoverageMd(res));
  assert.equal(res.summary.missing, 0, 'all 20 repositories measured');
  assert.equal(res.summary.gu31.salienceMismatches, 0, 'coverage never changes salience');
  assert.equal(res.summary.gu31.checklistKindMismatches, 0, 'coverage never creates or suppresses an item');
  // Seeded records that differ from Rerun 1 must be the base code's (main after Rerun 1), not GU-32's: rescored with
  // the base code, they match GU-32 exactly.
  for (const r of res.repos.filter((x: { seeded?: { scoreMismatches: number; summaryMismatches: string[] } | null }) => x.seeded && (x.seeded.scoreMismatches || x.seeded.summaryMismatches.length))) {
    assert.ok(r.seeded.baseline, `${r.repo}: differs from Rerun 1 and was not rescored with the base code`);
    assert.equal(r.seeded.baseline.scoreMismatches, 0, `${r.repo}: GU-32 changes seeded scoring`);
    assert.deepEqual(r.seeded.baseline.summaryMismatches, [], `${r.repo}: GU-32 changes a seeded summary number`);
  }
});
