import { pct } from "../stats/wilson.js";
/**
 * Deterministic reviewer questions. Rules of the house:
 *  - Ask, never judge ("Does X need…?" not "X is broken").
 *  - Every item cites evidence ids that exist in the brief.
 *  - Few beats many: a muted bot helps nobody.
 */
export const MAX_CHECKLIST = 4;
const MAX_COMPANION_QUESTIONS = 2;
const MIN_INTERVAL_LOW = 0.3;
const MIN_CALIBRATED_PRECISION = 0.25;
const MIN_CHURN_FOR_TEST_QUESTION = 10;
const WIDE_SURFACE_IMPORTERS = 5;
/** Co-change questions are suppressed when this repo's measured precision is poor. */
export function coChangeTrusted(cal, minCalibratedPrecision = MIN_CALIBRATED_PRECISION) {
    return !(cal.status === 'measured' && (cal.precision ?? 0) < minCalibratedPrecision);
}
/** Paths are wrapped in backticks; a backtick inside a path is swapped so the delimiters stay unambiguous. */
const code = (s) => `\`${s.replace(/`/g, "'").replace(/[\r\n]+/g, ' ')}\``;
const more = (n) => (n > 0 ? ` (+${n} more)` : '');
export function buildChecklist(input) {
    const items = [];
    const { changes, dependents, forgotten, tests, calibration, config } = input;
    const maxChecklist = config?.maxChecklist ?? MAX_CHECKLIST;
    const maxCompanionQuestions = config?.maxCompanionQuestions ?? MAX_COMPANION_QUESTIONS;
    const minIntervalLow = config?.minIntervalLow ?? MIN_INTERVAL_LOW;
    const minCalibratedPrecision = config?.minCalibratedPrecision ?? MIN_CALIBRATED_PRECISION;
    const minChurnForTestQuestion = config?.minChurnForTestQuestion ?? MIN_CHURN_FOR_TEST_QUESTION;
    const wideSurfaceImporters = config?.wideSurfaceImporters ?? WIDE_SURFACE_IMPORTERS;
    const churn = new Map(changes.files.map((f) => [f.path, f.additions + f.deletions]));
    for (const d of dependents.entries) {
        if (!d.deleted)
            continue;
        const importers = [...d.untouchedImporters, ...d.changedImporters];
        if (!importers.length)
            continue;
        items.push({
            id: `check:broken:${d.file}`,
            kind: 'broken-import',
            question: `${code(d.file)} no longer exists at this path, but ${code(importers[0])}${more(importers.length - 1)} still imports it. Is something missing?`,
            evidence: [d.id],
            priority: 1,
        });
    }
    if (coChangeTrusted(calibration, minCalibratedPrecision)) {
        const seenFiles = new Set();
        const strong = forgotten.items
            .filter((f) => f.interval.low >= minIntervalLow && f.automationShare < 0.5)
            .filter((f) => (seenFiles.has(f.file) ? false : (seenFiles.add(f.file), true)))
            .slice(0, maxCompanionQuestions);
        for (const f of strong) {
            items.push({
                id: `check:companion:${f.file}`,
                kind: 'forgotten-companion',
                question: `${code(f.file)} changed alongside ${code(f.changed)} in ${f.shared} of its ${f.changedTotal} commits ` +
                    `(95% CI ${pct(f.interval.low)}–${pct(f.interval.high)}) but is untouched here. Does it need a matching change?`,
                evidence: [f.id],
                priority: 2,
            });
        }
    }
    // Files already asked about: later questions lead with something new instead of repeating them.
    const asked = new Set(items.filter((i) => i.kind === 'forgotten-companion').map((i) => i.id.replace('check:companion:', '')));
    for (const fam of forgotten.families) {
        if (!fam.changedMembers.length || !fam.untouchedMembers.length)
            continue;
        const ordered = [...fam.untouchedMembers.filter((m) => !asked.has(m)), ...fam.untouchedMembers.filter((m) => asked.has(m))];
        const safeLabel = fam.label.replace(/`/g, "'").replace(/[\r\n]+/g, ' ');
        items.push({
            id: `check:family:${fam.id}`,
            kind: 'family-drift',
            question: `This changes ${fam.changedMembers.length} of ${fam.members.length} parallel implementations (${safeLabel}). ` +
                `Should ${code(ordered[0])}${more(ordered.length - 1)} follow?`,
            evidence: [fam.id],
            priority: 3,
        });
    }
    const untested = tests
        .filter((t) => t.status === 'test-untouched' && (churn.get(t.source) ?? 0) >= minChurnForTestQuestion)
        .filter((t) => !t.candidates.some((c) => asked.has(c.path)))
        .sort((a, b) => (churn.get(b.source) ?? 0) - (churn.get(a.source) ?? 0))
        .slice(0, 1);
    for (const t of untested) {
        const f = changes.files.find((x) => x.path === t.source);
        items.push({
            id: `check:test:${t.source}`,
            kind: 'untested-change',
            question: `${code(t.source)} changed (+${f.additions}/−${f.deletions}) but ${code(t.candidates[0].path)} didn't. Is the new behavior covered?`,
            evidence: [t.id],
            priority: 4,
        });
    }
    const wide = dependents.entries
        .filter((d) => !d.deleted && d.untouchedImporters.length >= wideSurfaceImporters)
        .slice(0, 1);
    for (const d of wide) {
        items.push({
            id: `check:surface:${d.file}`,
            kind: 'wide-surface',
            question: `${code(d.file)} is imported by ${d.untouchedImporters.length} files this PR doesn't touch. Is its public shape unchanged?`,
            evidence: [d.id],
            priority: 5,
        });
    }
    return items.sort((a, b) => a.priority - b.priority).slice(0, maxChecklist);
}
export function salienceOf(changes, checklist) {
    const reasons = [];
    const urgent = checklist.filter((c) => c.priority <= 2).length;
    if (urgent)
        reasons.push(`${urgent} high-signal question${urgent > 1 ? 's' : ''}`);
    if (changes.totals.files >= 8)
        reasons.push(`${changes.totals.files} files changed`);
    if (changes.totals.modules >= 3)
        reasons.push(`${changes.totals.modules} modules touched`);
    if (reasons.length)
        return { level: 'full', reasons };
    if (checklist.length)
        return { level: 'brief', reasons: [`${checklist.length} question${checklist.length > 1 ? 's' : ''} worth a look`] };
    if (changes.totals.files > 3)
        return { level: 'brief', reasons: [`${changes.totals.files} files changed`] };
    return { level: 'quiet', reasons: ['small change with nothing to flag'] };
}
