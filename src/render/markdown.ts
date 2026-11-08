import type { GutterBrief } from '../contract.ts';
import { assertEvidenceResolves } from '../brief.ts';
import { pct } from '../stats/wilson.ts';
import { commitUrl, fileUrl, mdCell, mdCode, mdText, safeBase, short } from './escape.ts';
import { receiptsFor } from './receipts.ts';

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

  // Likely forgotten
  const fg = brief.forgotten;
  if (fg.items.length) {
    out.push(`<details${salience.level === 'full' ? ' open' : ''}><summary><b>Likely forgotten</b> · ${plural(fg.items.length, 'file')} that usually change with this PR</summary>`);
    out.push('');
    out.push('| Untouched file | Usually changes with | Together | 95% CI | Last together | Receipts |');
    out.push('|---|---|---|---|---|---|');
    for (const f of fg.items) {
      const receipts = f.evidence.slice(0, 3).map((e) => commitLink(e.sha)).join(' ');
      const auto = f.automationShare >= 0.5 ? ' ⚙︎ mostly bot commits' : '';
      out.push(
        `| ${mdCell(fileLink(f.file))} | ${mdCell(fileLink(f.changed))} | ${f.shared}/${f.changedTotal}${auto} | ` +
          `${pct(f.interval.low)}–${pct(f.interval.high)} | ${f.lastTogether ?? '—'} | ${mdCell(receipts)} |`,
      );
    }
    if (fg.total > fg.items.length) out.push(`\n<sub>${fg.total - fg.items.length} weaker matches not shown.</sub>`);
    out.push('', '</details>', '');
  } else {
    out.push(`<sub>Likely forgotten: ${mdText(fg.note ?? 'nothing usually changes with these files that was left out.')}</sub>`, '');
  }

  // What it touches
  const deps = brief.dependents.entries.filter((d) => d.untouchedImporters.length || d.deleted);
  const isPartial = brief.dependents.coverage === 'partial';
  const uCount = brief.dependents.unresolved.count;
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

  // Tests
  const t = brief.tests;
  if (t.length) {
    const changedT = t.filter((x) => x.status === 'test-changed').length;
    const untouched = t.filter((x) => x.status === 'test-untouched');
    const none = t.filter((x) => x.status === 'no-test-found').length;
    out.push(`<details><summary><b>Tests</b> · ${changedT} updated · ${untouched.length} untouched · ${none} with no test found</summary>`, '');
    for (const x of untouched.slice(0, 6)) out.push(`- ${fileLink(x.source)} → ${fileLink(x.candidates[0]!.path)} not changed`);
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
