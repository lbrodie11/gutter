import type { GutterBrief } from '../contract.ts';

/** A receipt is something a reviewer can click to check a claim: a commit or a file. */
export interface Receipt { kind: 'commit' | 'file'; ref: string; label: string }

/** Resolve an evidence id to the receipts that back it. Shared by every renderer. */
export function receiptsFor(brief: GutterBrief, id: string, max = 3): Receipt[] {
  const f = brief.forgotten.items.find((x) => x.id === id);
  if (f) return f.evidence.slice(0, max).map((e) => ({ kind: 'commit', ref: e.sha, label: e.subject }));
  const d = brief.dependents.entries.find((x) => x.id === id);
  if (d) return [...d.untouchedImporters, ...d.changedImporters].slice(0, max).map((p) => ({ kind: 'file', ref: p, label: p }));
  const t = brief.tests.find((x) => x.id === id);
  // The test file a checklist item names (`candidates[0]`), not co-change partners appended after it.
  if (t) return t.candidates.slice(0, Math.min(1, max)).map((c) => ({ kind: 'file', ref: c.path, label: c.path }));
  const fam = brief.forgotten.families.find((x) => x.id === id);
  if (fam) return fam.untouchedMembers.slice(0, max).map((p) => ({ kind: 'file', ref: p, label: p }));
  return [];
}
