/** Resolve an evidence id to the receipts that back it. Shared by every renderer. */
export function receiptsFor(brief, id, max = 3) {
    const f = brief.forgotten.items.find((x) => x.id === id);
    if (f)
        return f.evidence.slice(0, max).map((e) => ({ kind: 'commit', ref: e.sha, label: e.subject }));
    const d = brief.dependents.entries.find((x) => x.id === id);
    if (d)
        return [...d.untouchedImporters, ...d.changedImporters].slice(0, max).map((p) => ({ kind: 'file', ref: p, label: p }));
    const t = brief.tests.find((x) => x.id === id);
    if (t)
        return t.candidates.slice(0, max).map((c) => ({ kind: 'file', ref: c.path, label: c.path }));
    const fam = brief.forgotten.families.find((x) => x.id === id);
    if (fam)
        return fam.untouchedMembers.slice(0, max).map((p) => ({ kind: 'file', ref: p, label: p }));
    return [];
}
