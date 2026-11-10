import type { CommitRef, GutterBrief, TestLink } from '../contract.ts';

/**
 * GU-29 wording shared by every renderer: co-change history and test pairing as facts.
 * Nothing here asks whether something was missed, and nothing says a file must change.
 * Returned strings are plain text; renderers escape them for their own format.
 */

/** Where the co-change history stands for a test row without a pairing. */
export type HistoryState = 'paired' | 'analyzed-none' | 'partial' | 'insufficient' | 'unavailable';

export interface TestRow {
  id: string;
  source: string;
  test: string;
  state: HistoryState;
  together?: number;
  sourceCommits?: number;
  receipts: CommitRef[];
}

/** One row per source whose related test file exists but is unchanged in this PR. */
export function unchangedTestRows(brief: GutterBrief): TestRow[] {
  const fg = brief.forgotten;
  return brief.tests
    .filter((t) => t.status === 'test-untouched' && t.candidates.length > 0)
    .map((t) => testRow(t, brief));

  function testRow(t: TestLink, b: GutterBrief): TestRow {
    if (t.history) {
      const items = t.history.evidence
        .map((id) => b.forgotten.items.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f));
      const paired = items.find((f) => f.shared === t.history!.together && f.changedTotal === t.history!.sourceCommits) ?? items[0];
      return {
        id: t.id,
        source: t.source,
        test: paired?.file ?? t.candidates.find((c) => !c.changed)?.path ?? t.candidates[0]!.path,
        state: 'paired',
        together: t.history.together,
        sourceCommits: t.history.sourceCommits,
        receipts: items.flatMap((f) => f.evidence),
      };
    }
    const state: HistoryState =
      fg.status === 'unavailable'
        ? 'unavailable'
        : fg.status === 'insufficient-history'
          ? 'insufficient'
          : fg.total > fg.items.length
            ? 'partial'
            : 'analyzed-none';
    return { id: t.id, source: t.source, test: t.candidates.find((c) => !c.changed)?.path ?? t.candidates[0]!.path, state, receipts: [] };
  }
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

export const CONTEXT_TITLE = 'Usually changes with';
export const CONTEXT_SUBTITLE = 'history, not a prediction';
export const TESTS_LEGEND = 'Test rows are facts about this PR and past commits, not a request to change anything.';
