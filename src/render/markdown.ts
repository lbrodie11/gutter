import type { GutterBrief } from '../contract.ts';
import { assertEvidenceResolves } from '../brief.ts';
import { commitUrl, fileUrl, mdCell, mdCode, mdText, safeBase, short } from './escape.ts';
import { receiptsFor } from './receipts.ts';
import { CONTEXT_SUBTITLE, CONTEXT_TITLE, TESTS_LEGEND, historyClause, unchangedTestRows } from './context.ts';

/** Hidden marker so the Action updates one sticky comment instead of stacking new ones. */
export const COMMENT_MARKER = '<!-- gutter:brief -->';

export interface MarkdownOptions {
  /** Link to the full comic page (e.g. the workflow run's artifact). */
  pageUrl?: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function renderMarkdown(brief: GutterBrief, opts: MarkdownOptions = {}): string {
  assertEvidenceResolves(brief);
  const { change, changes, salience } = brief;
  const repo = change.repoUrl;
  const head = change.headSha;
  const fileLink = (p: string) => {
    const url = fileUrl(repo, head, p);
    return url ? `[${mdCode(p)}](${url})` : mdCode(p);
  };
  const commitLink = (sha: string) => {
    const url = commitUrl(repo, sha);
    return url ? `[${short(sha)}](${url})` : mdCode(short(sha));
  };

  const scope =
    `${plural(changes.totals.files, 'file')} across ${plural(changes.totals.modules, 'module')} ` +
    `(+${changes.totals.additions}/−${changes.totals.deletions})`;

  const footer = footerLine(brief, opts);

  if (salience.level === 'quiet') {
    const only = changes.modules.length === 1 ? changes.modules[0]!.name : undefined;
    const where = only === '(root)' ? ' at the repo root' : only ? ` in ${mdCode(only)}` : '';
    return `${COMMENT_MARKER}\n**Gutter** · nothing to flag: ${scope.replace(/ across .*? \(/, `${where} (`)}.\n\n${footer}\n`;
  }

  const out: string[] = [COMMENT_MARKER, '### Gutter · change briefing', ''];
  out.push(`**${mdText(change.title)}**: ${scope}`);
  out.push('');

  if (brief.checklist.length) {
    out.push('**Worth a look**');
    out.push('');
    brief.checklist.forEach((c, i) => {
      const receipts = c.evidence
        .flatMap((id) => receiptsFor(brief, id, 2))
        .map((r) => (r.kind === 'commit' ? commitLink(r.ref) : fileLink(r.ref)));
      // Questions are built from repo paths: escape everything except the code spans we generated.
      out.push(`${i + 1}. ${safeQuestion(c.question)}${receipts.length ? `<br><sub>receipts: ${receipts.join(' · ')}</sub>` : ''}`);
    });
    out.push('');
  } else {
    out.push('_Nothing here needs a second look beyond the diff itself._');
    out.push('');
  }

  // Usually changes with: co-change history as context, collapsed, never a question (GU-29).
  const fg = brief.forgotten;
  const families = fg.families.filter((f) => f.changedMembers.length && f.untouchedMembers.length);
  const pairs = fg.items.length + families.length;
  const state = pairs
    ? plural(pairs, 'pair')
    : fg.status === 'unavailable'
      ? 'history not checked'
      : fg.status === 'insufficient-history'
        ? 'too little history'
        : 'none outside this PR';
  out.push(`<details><summary><b>${CONTEXT_TITLE}</b> (${CONTEXT_SUBTITLE}) · ${state}</summary>`, '');
  for (const f of fg.items) {
    const receipts = f.evidence.slice(0, 3).map((e) => commitLink(e.sha)).join(' ');
    const auto = f.automationShare >= 0.5 ? ' · ⚙︎ mostly bot commits' : '';
    const last = f.lastTogether ? ` · last together ${mdText(f.lastTogether)}` : '';
    out.push(
      `- ${fileLink(f.changed)} and ${fileLink(f.file)} changed together in ${f.shared} of ${f.changedTotal} commits; ` +
        `${fileLink(f.file)} isn't in this PR${last}${auto}${receipts ? `<br><sub>receipts: ${receipts}</sub>` : ''}`,
    );
  }
  for (const fam of families) {
    const shown = fam.untouchedMembers.slice(0, 4).map(fileLink).join(', ');
    const extra = fam.untouchedMembers.length > 4 ? ` +${fam.untouchedMembers.length - 4} more` : '';
    out.push(`- Parallel implementations (${mdText(fam.label)}): this PR changes ${fam.changedMembers.length} of ${fam.members.length}; not in this PR: ${shown}${extra}`);
  }
  if (!pairs) out.push(mdText(fg.note ?? 'No file outside this PR usually changes with these files.'));
  if (fg.total > fg.items.length) out.push('', `<sub>${fg.total - fg.items.length} weaker pairs not shown.</sub>`);
  out.push('', '</details>', '');

  // What it touches
  const deps = brief.dependents.entries.filter((d) => d.untouchedImporters.length || d.deleted);
  const uCount = brief.dependents.unresolved?.count ?? 0;
  const isPartial = brief.dependents.coverage === 'partial' || uCount > 0;
  const partialSentence = `${plural(uCount, 'import')} ${uCount === 1 ? 'uses' : 'use'} aliases or packages Gutter can't resolve yet, so some importers may be missing.`;
  if (deps.length) {
    out.push(`<details><summary><b>What it touches</b> · ${plural(deps.length, 'changed file')} with importers outside this PR${isPartial ? ' (partial)' : ''}</summary>`, '');
    for (const d of deps.slice(0, 8)) {
      const shown = d.untouchedImporters.length ? d.untouchedImporters : d.changedImporters;
      const list = shown.slice(0, 4).map(fileLink).join(', ');
      const extra = shown.length > 4 ? ` +${shown.length - 4} more` : '';
      out.push(`- ${fileLink(d.file)}${d.deleted ? ' (removed)' : ''} ← ${list}${extra}`);
    }
    out.push('', '</details>', '');
  }
  if (isPartial) {
    const prefix = deps.length === 0 ? 'No importers found through relative imports. ' : '';
    out.push(`<sub>${prefix}${partialSentence}</sub>`, '');
  }
  if (brief.dependents.unchecked.length) {
    out.push(`<sub>Imports not analyzed for ${plural(brief.dependents.unchecked.length, 'file')} (language not supported yet).</sub>`, '');
  }

  // Tests: facts about this PR and the history, never a claim that a test must change.
  const t = brief.tests;
  if (t.length) {
    const changedT = t.filter((x) => x.status === 'test-changed').length;
    const rows = unchangedTestRows(brief);
    const none = t.filter((x) => x.status === 'no-test-found').length;
    out.push(`<details><summary><b>Tests</b> · ${changedT} updated · ${rows.length} unchanged · ${none} with no test found</summary>`, '');
    for (const row of rows.slice(0, 6)) {
      const clause = historyClause(row);
      const receipts = row.receipts.slice(0, 3).map((e) => commitLink(e.sha)).join(' ');
      out.push(`- ${fileLink(row.test)} — unchanged in this PR · ${mdText(clause.before)}${fileLink(row.source)}${mdText(clause.after)}${receipts ? `<br><sub>receipts: ${receipts}</sub>` : ''}`);
    }
    if (rows.length) out.push('', `<sub>${mdText(TESTS_LEGEND)}</sub>`);
    out.push('', '</details>', '');
  }

  // What changed
  out.push(`<details><summary><b>What changed</b> · by module</summary>`, '');
  out.push('| Module | Files | +/− |', '|---|---|---|');
  for (const m of changes.modules.slice(0, 12)) out.push(`| ${mdCell(mdCode(m.name))} | ${m.files} | +${m.additions}/−${m.deletions} |`);
  out.push('', '</details>', '');

  out.push(footer);
  return out.join('\n') + '\n';
}

/** Questions embed paths inside backticks we generated; escape only the text between them. */
function safeQuestion(q: string): string {
  return q
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith('`') && part.endsWith('`') && part.length > 1 ? mdCode(part.slice(1, -1)) : mdText(part)))
    .join('');
}

function footerLine(brief: GutterBrief, opts: MarkdownOptions): string {
  const bits: string[] = [];
  bits.push(mdText(brief.calibration.note));
  const safePageUrl = safeBase(opts.pageUrl);
  if (safePageUrl) bits.push(`[Full page](${safePageUrl})`);
  bits.push('No AI wrote this: every line comes from git history and the code');
  bits.push(brief.provenance.engines.map((e) => `${e.name} ${e.version}`).join(' + '));
  return `<sub>${bits.join(' · ')}</sub>`;
}
