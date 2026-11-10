import type {
  Calibration, ChangeStructure, ChecklistItem, DependentsLayer, ForgottenItem, ForgottenLayer, Salience, TestLink,
} from '../contract.ts';
import type { CompanionTrackRecord } from '../sources/archaeology.ts';
import type { GutterConfig } from '../config.ts';
import { pct } from '../stats/wilson.ts';

/**
 * Deterministic reviewer checklist. Rules of the house:
 *  - Explain, don't predict (GU-29, DECISIONS #17): by default only facts become items
 *    (`broken-import`, `untested-change`, `wide-surface`). Co-change history never creates
 *    or suppresses an item; it is shown as context instead.
 *  - Ask or state, never judge ("X no longer exists, but Y still imports it", not "X is broken").
 *  - Every item cites evidence ids that exist in the brief.
 *  - Few beats many: a muted bot helps nobody.
 *
 * `legacyPredictions: true` runs `buildLegacyChecklist`, the pre-GU-29 code path, unchanged.
 */
export const MAX_CHECKLIST = 4;
const MAX_COMPANION_QUESTIONS = 2;
const MIN_INTERVAL_LOW = 0.3;
const MIN_CALIBRATED_PRECISION = 0.25;
const MIN_CHURN_FOR_TEST_QUESTION = 10;
const WIDE_SURFACE_IMPORTERS = 5;

export interface ChecklistInput {
  changes: ChangeStructure;
  dependents: DependentsLayer;
  forgotten: ForgottenLayer;
  tests: TestLink[];
  calibration: Calibration;
  config?: GutterConfig;
  /** Internal: RA-06 track records keyed by suggested file, for `companionMinTrackRecordFired`. */
  trackRecords?: ReadonlyMap<string, CompanionTrackRecord>;
}

/**
 * Opt-in "proven pairs" gate for companion questions (GU-28 Stage 0b, option 2). With neither
 * `companionRequireGhost` nor `companionMinTrackRecordFired` set, every item passes, as before.
 */
export function passesProvenPairGate(
  item: Pick<ForgottenItem, 'relationship'>,
  trackRecord: CompanionTrackRecord | undefined,
  config: GutterConfig | undefined,
): boolean {
  if (config?.companionRequireGhost && item.relationship !== 'ghost') return false;
  const minFired = config?.companionMinTrackRecordFired;
  if (minFired !== undefined) {
    if (!trackRecord || trackRecord.fired === null || trackRecord.fired < minFired) return false;
  }
  return true;
}

/** Co-change questions are suppressed when this repo's measured precision is poor. */
export function coChangeTrusted(cal: Calibration, minCalibratedPrecision: number = MIN_CALIBRATED_PRECISION): boolean {
  return !(cal.status === 'measured' && (cal.precision ?? 0) < minCalibratedPrecision);
}

/** Paths are wrapped in backticks; a backtick inside a path is swapped so the delimiters stay unambiguous. */
const code = (s: string) => `\`${s.replace(/`/g, "'").replace(/[\r\n]+/g, ' ')}\``;
const more = (n: number) => (n > 0 ? ` (+${n} more)` : '');

export function buildChecklist(input: ChecklistInput): ChecklistItem[] {
  return input.config?.legacyPredictions ? buildLegacyChecklist(input) : buildFactsChecklist(input);
}

/**
 * Default checklist: facts only. Same gates, caps and priorities as the legacy path for the three
 * kinds it keeps; no `forgotten` input is read, so co-change can neither add nor suppress an item.
 */
export function buildFactsChecklist(input: Omit<ChecklistInput, 'forgotten' | 'calibration' | 'trackRecords'>): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const { changes, dependents, tests, config } = input;
  const maxChecklist = config?.maxChecklist ?? MAX_CHECKLIST;
  const minChurnForTestQuestion = config?.minChurnForTestQuestion ?? MIN_CHURN_FOR_TEST_QUESTION;
  const wideSurfaceImporters = config?.wideSurfaceImporters ?? WIDE_SURFACE_IMPORTERS;
  const churn = new Map(changes.files.map((f) => [f.path, f.additions + f.deletions]));

  items.push(...brokenImportItems(dependents));

  const unchangedTest = tests
    .filter((t) => t.status === 'test-untouched' && (churn.get(t.source) ?? 0) >= minChurnForTestQuestion)
    .sort((a, b) => (churn.get(b.source) ?? 0) - (churn.get(a.source) ?? 0))
    .slice(0, 1);
  for (const t of unchangedTest) {
    const f = changes.files.find((x) => x.path === t.source)!;
    items.push({
      id: `check:test:${t.source}`,
      kind: 'untested-change',
      question: `${code(t.source)} changed (+${f.additions}/−${f.deletions}); its test file ${code(t.candidates[0]!.path)} didn't change in this PR.`,
      evidence: [t.id],
      priority: 4,
    });
  }

  items.push(...wideSurfaceItems(dependents, wideSurfaceImporters));
  return items.sort((a, b) => a.priority - b.priority).slice(0, maxChecklist);
}

function brokenImportItems(dependents: DependentsLayer): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const d of dependents.entries) {
    if (!d.deleted) continue;
    const importers = [...d.untouchedImporters, ...d.changedImporters];
    if (!importers.length) continue;
    items.push({
      id: `check:broken:${d.file}`,
      kind: 'broken-import',
      question: `${code(d.file)} no longer exists at this path, but ${code(importers[0]!)}${more(importers.length - 1)} still imports it. Is something missing?`,
      evidence: [d.id],
      priority: 1,
    });
  }
  return items;
}

function wideSurfaceItems(dependents: DependentsLayer, wideSurfaceImporters: number): ChecklistItem[] {
  return dependents.entries
    .filter((d) => !d.deleted && d.untouchedImporters.length >= wideSurfaceImporters)
    .slice(0, 1)
    .map((d) => ({
      id: `check:surface:${d.file}`,
      kind: 'wide-surface' as const,
      question: `${code(d.file)} is imported by ${d.untouchedImporters.length} files this PR doesn't touch. Is its public shape unchanged?`,
      evidence: [d.id],
      priority: 5,
    }));
}

/** Pre-GU-29 checklist, kept byte-for-byte for `legacyPredictions` (research only). */
export function buildLegacyChecklist(input: ChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const { changes, dependents, forgotten, tests, calibration, config, trackRecords } = input;
  const maxChecklist = config?.maxChecklist ?? MAX_CHECKLIST;
  const maxCompanionQuestions = config?.maxCompanionQuestions ?? MAX_COMPANION_QUESTIONS;
  const minIntervalLow = config?.minIntervalLow ?? MIN_INTERVAL_LOW;
  const minCalibratedPrecision = config?.minCalibratedPrecision ?? MIN_CALIBRATED_PRECISION;
  const minChurnForTestQuestion = config?.minChurnForTestQuestion ?? MIN_CHURN_FOR_TEST_QUESTION;
  const wideSurfaceImporters = config?.wideSurfaceImporters ?? WIDE_SURFACE_IMPORTERS;
  const churn = new Map(changes.files.map((f) => [f.path, f.additions + f.deletions]));

  for (const d of dependents.entries) {
    if (!d.deleted) continue;
    const importers = [...d.untouchedImporters, ...d.changedImporters];
    if (!importers.length) continue;
    items.push({
      id: `check:broken:${d.file}`,
      kind: 'broken-import',
      question: `${code(d.file)} no longer exists at this path, but ${code(importers[0]!)}${more(importers.length - 1)} still imports it. Is something missing?`,
      evidence: [d.id],
      priority: 1,
    });
  }

  if (coChangeTrusted(calibration, minCalibratedPrecision)) {
    const seenFiles = new Set<string>();
    const strong = forgotten.items
      .filter((f) => f.interval.low >= minIntervalLow && f.automationShare < 0.5)
      .filter((f) => passesProvenPairGate(f, trackRecords?.get(f.file), config))
      .filter((f) => (seenFiles.has(f.file) ? false : (seenFiles.add(f.file), true)))
      .slice(0, maxCompanionQuestions);
    for (const f of strong) {
      items.push({
        id: `check:companion:${f.file}`,
        kind: 'forgotten-companion',
        question:
          `${code(f.file)} changed alongside ${code(f.changed)} in ${f.shared} of its ${f.changedTotal} commits ` +
          `(95% CI ${pct(f.interval.low)}–${pct(f.interval.high)}) but is untouched here. Does it need a matching change?`,
        evidence: [f.id],
        priority: 2,
      });
    }
  }

  // Files already asked about: later questions lead with something new instead of repeating them.
  const asked = new Set(items.filter((i) => i.kind === 'forgotten-companion').map((i) => i.id.replace('check:companion:', '')));

  for (const fam of forgotten.families) {
    if (!fam.changedMembers.length || !fam.untouchedMembers.length) continue;
    const ordered = [...fam.untouchedMembers.filter((m) => !asked.has(m)), ...fam.untouchedMembers.filter((m) => asked.has(m))];
    const safeLabel = fam.label.replace(/`/g, "'").replace(/[\r\n]+/g, ' ');
    items.push({
      id: `check:family:${fam.id}`,
      kind: 'family-drift',
      question:
        `This changes ${fam.changedMembers.length} of ${fam.members.length} parallel implementations (${safeLabel}). ` +
        `Should ${code(ordered[0]!)}${more(ordered.length - 1)} follow?`,
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
    const f = changes.files.find((x) => x.path === t.source)!;
    items.push({
      id: `check:test:${t.source}`,
      kind: 'untested-change',
      question: `${code(t.source)} changed (+${f.additions}/−${f.deletions}) but ${code(t.candidates[0]!.path)} didn't. Is the new behavior covered?`,
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

/**
 * How loud a brief is. `full` needs `salienceFullMinSignals` independent signals (default 2; 1 under
 * `legacyPredictions`): each priority <= 2 item counts once, breadth counts once. By default only
 * `broken-import` has priority <= 2, so a page is `full` with two broken imports, or one plus breadth;
 * breadth alone is `brief`. Any checklist item makes a page at least `brief`. Co-change context and
 * test history never contribute: they are not checklist items.
 */
export function salienceOf(changes: ChangeStructure, checklist: ChecklistItem[], config?: GutterConfig): Salience {
  const legacy = Boolean(config?.legacyPredictions);
  const minSignals = config?.salienceFullMinSignals ?? (legacy ? 1 : 2);
  const breadthCanBeFull = config?.salienceBreadthFull ?? true;
  const reasons: string[] = [];
  const urgent = checklist.filter((c) => c.priority <= 2).length;
  if (urgent) {
    reasons.push(legacy ? `${urgent} high-signal question${urgent > 1 ? 's' : ''}` : `${urgent} high-priority item${urgent > 1 ? 's' : ''}`);
  }
  const breadthReasons: string[] = [];
  if (changes.totals.files >= 8) breadthReasons.push(`${changes.totals.files} files changed`);
  if (changes.totals.modules >= 3) breadthReasons.push(`${changes.totals.modules} modules touched`);
  const breadthSignal = breadthCanBeFull && breadthReasons.length > 0 ? 1 : 0;
  if (breadthSignal) reasons.push(...breadthReasons);
  // With 1 signal and breadth counting (the legacy defaults) this is exactly the original rule.
  if (reasons.length && urgent + breadthSignal >= minSignals) return { level: 'full', reasons };
  if (checklist.length) {
    const noun = legacy ? 'question' : 'item';
    return { level: 'brief', reasons: [`${checklist.length} ${noun}${checklist.length > 1 ? 's' : ''} worth a look`] };
  }
  if (changes.totals.files > 3) return { level: 'brief', reasons: [`${changes.totals.files} files changed`] };
  return { level: 'quiet', reasons: ['small change with nothing to flag'] };
}
