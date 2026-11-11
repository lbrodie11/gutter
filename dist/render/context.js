import { attachTestHistory } from "../evidence/tests.js";
/** One row per source whose related test file exists but is unchanged in this PR. */
export function unchangedTestRows(brief) {
    const fg = brief.forgotten;
    const noPairing = fg.status === 'unavailable'
        ? 'unavailable'
        : fg.status === 'insufficient-history'
            ? 'insufficient'
            : fg.total > fg.items.length
                ? 'partial'
                : 'analyzed-none';
    return brief.tests
        .filter((t) => t.status === 'test-untouched' && t.candidates.length > 0)
        .map((t) => {
        // Same file the checklist names: the first unchanged candidate (naming-convention candidates come first).
        const test = t.candidates.find((c) => !c.changed)?.path ?? t.candidates[0].path;
        // Briefs without `history` (pre-0.3.0 gutter.json, or `legacyPredictions`) still carry the pairs in
        // `forgotten.items`; derive the same history so the row never contradicts the co-change panel.
        const history = t.history ?? attachTestHistory([t], fg)[0].history;
        const primaryId = history?.evidence[0];
        const primary = primaryId === undefined ? undefined : fg.items.find((f) => f.id === primaryId);
        if (!history || !primary)
            return { id: t.id, source: t.source, test, state: noPairing, receipts: [] };
        const pair = { together: history.together, sourceCommits: history.sourceCommits, receipts: primary.evidence };
        if (primary.file === test)
            return { id: t.id, source: t.source, test, state: 'paired', ...pair };
        return { id: t.id, source: t.source, test, state: noPairing, receipts: [], other: { test: primary.file, ...pair } };
    });
}
/** The history half of a test row, after "unchanged in this PR · ". `source` is inserted by the caller. */
export function historyClause(row) {
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
export function noPairsLine(fg) {
    if (fg.total > 0)
        return `${fg.total} pair${fg.total === 1 ? '' : 's'} found, none listed (display limit: max-forgotten).`;
    return fg.note ?? 'No file outside this PR usually changes with these files.';
}
export const CONTEXT_TITLE = 'Usually changes with';
export const CONTEXT_SUBTITLE = 'history, not a prediction';
export const TESTS_LEGEND = 'Test rows are facts about this PR and past commits, not a request to change anything.';
