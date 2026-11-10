import type { CommitRef, GutterBrief } from '../contract.ts';
import { attachTestHistory } from '../evidence/tests.ts';

/**
 * GU-29 wording shared by every renderer: co-change history and test pairing as facts.
 * Nothing here asks whether something was missed, and nothing says a file must change.
 * Returned strings are plain text; renderers escape them for their own format.
 */

/** Where the co-change history stands for a test row without a pairing. */
export type HistoryState = 'paired' | 'analyzed-none' | 'partial' | 'insufficient' | 'unavailable';

/** A co-change pair between a source file and a test file, with the commits behind it. */
export interface TestPair {
  test: string;
  together: number;
  sourceCommits: number;
  receipts: CommitRef[];
}

export interface TestRow {
  id: string;
  source: string;
  /** The unchanged test file this row is about: the naming-convention test when there is one. */
  test: string;
  /** History for `test` itself (`paired`), or why there is none. */
  state: HistoryState;
  together?: number;
  sourceCommits?: number;
  /** Receipts for this row's pair only. */
  receipts: CommitRef[];
  /** When history pairs the source with a different test file than `test`. */
  other?: TestPair;
}

/** One row per source whose related test file exists but is unchanged in this PR. */
export function unchangedTestRows(brief: GutterBrief): TestRow[] {
  const fg = brief.forgotten;
  const noPairing: HistoryState =
    fg.status === 'unavailable'
      ? 'unavailable'
      : fg.status === 'insufficient-history'
        ? 'insufficient'
        : fg.total > fg.items.length
          ? 'partial'
          : 'analyzed-none';
  return brief.tests
    .filter((t) => t.status === 'test-untouched' && t.candidates.length > 0)
    .map((t): TestRow => {
      // Same file the checklist names: the first unchanged candidate (naming-convention candidates come first).
      const test = t.candidates.find((c) => !c.changed)?.path ?? t.candidates[0]!.path;
      // Briefs without `history` (pre-0.3.0 gutter.json, or `legacyPredictions`) still carry the pairs in
      // `forgotten.items`; derive the same history so the row never contradicts the co-change panel.
      const history = t.history ?? attachTestHistory([t], fg)[0]!.history;
      const primaryId = history?.evidence[0];
      const primary = primaryId === undefined ? undefined : fg.items.find((f) => f.id === primaryId);
      if (!history || !primary) return { id: t.id, source: t.source, test, state: noPairing, receipts: [] };
      const pair = { together: history.together, sourceCommits: history.sourceCommits, receipts: primary.evidence };
      if (primary.file === test) return { id: t.id, source: t.source, test, state: 'paired', ...pair };
      return { id: t.id, source: t.source, test, state: noPairing, receipts: [], other: { test: primary.file, ...pair } };
    });
}

/** The history half of a test row, after "unchanged in this PR · ". `source` is inserted by the caller. */
export function historyClause(row: TestRow): { before: string; after: string } {
  switch (row.state) {
    case 'paired':
      return { before: 'changed together with ', after: ` in ${row.together} of ${row.sourceCommits} commits` };
    case 'analyzed-none':
      return { before: 'history checked: no co-change pairing with ', after: '' };
    case 'partial':
      return { before: 'history partial: only the strongest co-change pairs are listed, and none pairs it with ', after: '' };
    case 'insufficient':
      return { before: 'history too short to compare with ', after: '' };
    case 'unavailable':
      return { before: 'history not checked for ', after: '' };
  }
}

/** What to say when no co-change pair is listed: hidden by the display limit, Repo Archaeology's note, or none. */
export function noPairsLine(fg: GutterBrief['forgotten']): string {
  if (fg.total > 0) return `${fg.total} pair${fg.total === 1 ? '' : 's'} found, none listed (display limit: max-forgotten).`;
  return fg.note ?? 'No file outside this PR usually changes with these files.';
}

export const CONTEXT_TITLE = 'Usually changes with';
export const CONTEXT_SUBTITLE = 'history, not a prediction';
export const TESTS_LEGEND = 'Test rows are facts about this PR and past commits, not a request to change anything.';
