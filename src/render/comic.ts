import type { GutterBrief } from '../contract.ts';
import { assertEvidenceResolves } from '../brief.ts';
import { pct } from '../stats/wilson.ts';
import { commitUrl, fileUrl, html, short } from './escape.ts';
import { FRAME12_TOKENS, TOKENS_ID } from './frame12-tokens.ts';
import { receiptsFor } from './receipts.ts';
import { CONTEXT_SUBTITLE, CONTEXT_TITLE, TESTS_LEGEND, historyClause, noPairsLine, unchangedTestRows } from './context.ts';

/** DOM anchor for an evidence id. Co-change ids (`forgotten:n` in gutter.json) anchor as `history-n`. */
const domId = (id: string) => id.replace(/^forgotten:/, 'history-');

/**
 * The comic page: one self-contained, offline HTML file in FRAME/12's panel
 * grammar. Same evidence as the Markdown comment, laid out for a 60-second read.
 *
 * Reading order = review order:
 *   C-01 Intent → C-02 What changed → C-03 What it touches → C-04 Usually changes with → C-05 Tests → C-06 Check these
 *
 * GU-29: C-04 is context (history, not a prediction) and is never the hero. The hero is C-06 when the
 * checklist has items, otherwise C-03.
 */

export function renderComic(brief: GutterBrief): string {
  assertEvidenceResolves(brief);
  const { change, changes, salience } = brief;
  const fileLink = (p: string, cls = '') => {
    const url = fileUrl(change.repoUrl, change.headSha, p);
    const inner = `<code class="path${cls ? ` ${cls}` : ''}">${html(p)}</code>`;
    return url ? `<a href="${html(url)}">${inner}</a>` : inner;
  };
  /** A path inside a sentence: plain inline code, so prose stays prose (the boxed links sit beside it). */
  const ref = (p: string) => `<code class="ref">${html(p)}</code>`;
  const commitLink = (sha: string) => {
    const url = commitUrl(change.repoUrl, sha);
    return url ? `<a class="sha" href="${html(url)}">${html(short(sha))}</a>` : `<span class="sha">${html(short(sha))}</span>`;
  };

  const heroChecks = brief.checklist.length > 0;
  const issue = [
    change.prNumber ? `PR #${change.prNumber}` : null,
    `${html(change.base)} → ${html(change.head)}`,
    change.headSha ? html(short(change.headSha)) : null,
    html(brief.provenance.generatedAt.slice(0, 10)),
  ].filter(Boolean).join(' · ');

  const panels: string[] = [];
  let cut = 0;
  const panel = (n: number, title: string, body: string, opts: { area: string; hero?: boolean }) => {
    const cutId = `C-${String(++cut).padStart(2, '0')}`;
    return `<section class="panel area-${opts.area}${opts.hero ? ' hero' : ''}" data-cut="${cutId}" aria-labelledby="p${n}">
  <h2 id="p${n}" class="cap${opts.hero ? ' marker' : ''}"><span class="num">${cutId}</span> ${html(title)}</h2>
  ${body}
</section>`;
  };

  // C-01 · Intent
  const commits = change.commits.slice(0, 5).map((c) => `<li>${commitLink(c.sha)} ${html(c.subject)}</li>`).join('');
  panels.push(panel(1, 'Intent', `
  <div class="balloon"><p class="said">${html(change.title)}</p>${change.intent ? `<p class="aside">${html(change.intent)}</p>` : ''}</div>
  ${commits ? `<ol class="commits" aria-label="Commits in this change">${commits}</ol>` : ''}`, { area: 'intent' }));

  // C-02 · What changed
  const maxChurn = Math.max(1, ...changes.modules.map((m) => m.additions + m.deletions));
  const rows = changes.modules.slice(0, 8).map((m) => {
    const churn = m.additions + m.deletions;
    const w = Math.max(4, Math.round((churn / maxChurn) * 100));
    const tone = churn / maxChurn > 0.66 ? 'tone-3' : churn / maxChurn > 0.33 ? 'tone-2' : 'tone-1';
    return `<li><span class="mod">${html(m.name)}</span>
      <svg class="bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="${w}" height="10" fill="url(#${tone})"/><rect x="0.6" y="0.6" width="${Math.max(0, w - 1.2)}" height="8.8" class="bar-ink"/></svg>
      <span class="num-sm">${m.files}f · +${m.additions}/−${m.deletions}</span></li>`;
  }).join('');
  panels.push(panel(2, 'What changed', `
  <p class="stat"><b>${changes.totals.files}</b> files · <b>${changes.totals.modules}</b> modules · <b>+${changes.totals.additions}</b>/<b>−${changes.totals.deletions}</b></p>
  <ul class="modules" aria-label="Churn by module, darker tone means more lines changed">${rows}</ul>
  ${changes.modules.length > 8 ? `<p class="small">${changes.modules.length - 8} more modules not shown.</p>` : ''}`, { area: 'changed' }));

  // C-03 · What it touches
  const deps = brief.dependents.entries.filter((d) => d.untouchedImporters.length || d.deleted).slice(0, 6);
  const uCount = brief.dependents.unresolved?.count ?? 0;
  const isPartial = brief.dependents.coverage === 'partial' || uCount > 0;
  const hasAnalyzedTargets = changes.files.some((f) => f.language === 'typescript' || f.language === 'javascript');
  const partialSentence = `${uCount} import${uCount === 1 ? ' uses' : 's use'} aliases or packages Gutter can't resolve yet, so some importers may be missing.`;
  const depBody = deps.length
    ? `<ul class="deps">${deps.map((d) => {
        const shown = d.untouchedImporters.length ? d.untouchedImporters : d.changedImporters;
        const label = d.untouchedImporters.length
          ? `imported by ${d.untouchedImporters.length} untouched file${d.untouchedImporters.length === 1 ? '' : 's'}`
          : `still imported by ${shown.length} changed file${shown.length === 1 ? '' : 's'}`;
        return `<li id="${html(domId(d.id))}">${fileLink(d.file)}${d.deleted ? ' <span class="stamp">removed</span>' : ''}
        <span class="small">${label}</span>
        <span class="importers">${shown.slice(0, 3).map((p) => fileLink(p)).join(' ')}${shown.length > 3 ? ` <span class="small">+${shown.length - 3}</span>` : ''}</span></li>`;
      }).join('')}</ul>`
    : isPartial
      ? `<p class="quiet-line"><span class="stamp">partial</span> No importers found through relative imports. ${html(partialSentence)}</p>`
      : !hasAnalyzedTargets && brief.dependents.unchecked.length > 0
        ? ''
        : `<p class="quiet-line">No file outside this change imports what it changed.</p>`;
  const partialNote = deps.length && isPartial
    ? `<p class="small"><span class="stamp">partial</span> ${html(partialSentence)}</p>`
    : '';
  const unchecked = brief.dependents.unchecked.length
    ? `<p class="small">Imports not analyzed for ${brief.dependents.unchecked.length} file${brief.dependents.unchecked.length === 1 ? '' : 's'} (language not supported yet).</p>`
    : '';
  panels.push(panel(3, 'What it touches', depBody + partialNote + unchecked, { area: 'touches', hero: !heroChecks }));

  // C-04 · Usually changes with (history as context; never the hero)
  const fg = brief.forgotten;
  const wires = fg.items.map((f) => {
    const receipts = f.evidence.slice(0, 3).map((e) => `<li>${commitLink(e.sha)} <span class="small">${html(e.date)}</span> ${html(e.subject)}${e.automated ? ' <span class="stamp">bot</span>' : ''}</li>`).join('');
    return `<li class="wire-row" id="${html(domId(f.id))}">
      <div class="wire">
        ${fileLink(f.changed, 'solid')}
        <svg class="ghost" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="6" x2="100" y2="6"/></svg>
        ${fileLink(f.file, 'dashed')}
      </div>
      <p class="evidence-line">${ref(f.changed)} and ${ref(f.file)} changed together in <b>${f.shared} of ${f.changedTotal}</b> commits; ${ref(f.file)} isn't in this PR.</p>
      <p class="small">${f.lastTogether ? `Last together ${html(f.lastTogether)}. ` : ''}${html(f.why)}${f.automationShare >= 0.5 ? ' · <span class="stamp">mostly bot commits</span>' : ''}</p>
      ${receipts ? `<ol class="receipts" aria-label="Commits where these files changed together">${receipts}</ol>` : ''}
    </li>`;
  }).join('');
  const families = fg.families.filter((f) => f.changedMembers.length && f.untouchedMembers.length).map((f) =>
    `<div class="family" id="${html(domId(f.id))}"><p><b>Parallel implementations</b> · ${html(f.label)}</p>
     <p class="small">Changed in this PR: ${f.changedMembers.map((p) => fileLink(p)).join(' ')}</p>
     <p class="small">Not in this PR: ${f.untouchedMembers.slice(0, 5).map((p) => fileLink(p, 'dashed')).join(' ')}</p></div>`).join('');
  const fgBody = wires || families
    ? `<p class="small">${html(CONTEXT_SUBTITLE[0]!.toUpperCase() + CONTEXT_SUBTITLE.slice(1))}: files that changed together in past commits.</p>${wires ? `<ul class="wires">${wires}</ul>` : ''}${families}${fg.total > fg.items.length ? `<p class="small">${fg.total - fg.items.length} weaker pairs not shown.</p>` : ''}`
    : `<div class="balloon thought"><p class="said">${html(noPairsLine(fg))}</p></div>`;
  panels.push(panel(4, CONTEXT_TITLE, fgBody, { area: 'history' }));

  // C-05 · Tests (facts; history rows say what happened before, not what must happen now)
  const t = brief.tests;
  const nChanged = t.filter((x) => x.status === 'test-changed').length;
  const testRows = unchangedTestRows(brief);
  const nNone = t.filter((x) => x.status === 'no-test-found').length;
  const testRowsHtml = testRows.slice(0, 4).map((row) => {
    const clause = historyClause(row);
    const other = row.other
      ? ` · ${ref(row.source)} changed together with ${ref(row.other.test)} in ${row.other.together} of ${row.other.sourceCommits} commits`
      : '';
    const receipts = (row.other?.receipts ?? row.receipts).slice(0, 3).map((e) => commitLink(e.sha)).join(' ');
    return `<li class="test-row" id="${html(domId(row.id))}">${fileLink(row.test, 'dashed')}<span class="fact">unchanged in this PR · ${html(clause.before)}${ref(row.source)}${html(clause.after)}${other}</span>${receipts ? `<span class="importers">${receipts}</span>` : ''}</li>`;
  }).join('');
  panels.push(panel(5, 'Tests', `
  <dl class="metrics">
    <div><dt>updated</dt><dd>${nChanged}</dd></div>
    <div><dt>unchanged</dt><dd>${testRows.length}</dd></div>
    <div><dt>none found</dt><dd>${nNone}</dd></div>
  </dl>
  ${testRowsHtml ? `<ul class="deps">${testRowsHtml}</ul><p class="small">${html(TESTS_LEGEND)}</p>` : ''}`, { area: 'tests' }));

  // C-06 · Check these — only link to evidence that is actually on the page
  const rendered = new Set([...panels.join('').matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  const anchorOf = (id: string) => html(domId(id));
  const checks = brief.checklist.map((c) => {
    const receipts = c.evidence.flatMap((id) => receiptsFor(brief, id, 2)).map((r) => (r.kind === 'commit' ? commitLink(r.ref) : fileLink(r.ref))).join(' ');
    const anchors = c.evidence.filter((id) => rendered.has(anchorOf(id))).map((id) => `<a class="jump" href="#${anchorOf(id)}">see evidence</a>`).join(' ');
    return `<li><p>${questionHtml(c.question)}</p><p class="small">${receipts} ${anchors}</p></li>`;
  }).join('');
  panels.push(panel(6, 'Check these', checks
    ? `<ol class="checks">${checks}</ol>`
    : `<div class="balloon thought"><p class="said">Nothing here needs a second look beyond the diff itself.</p></div>`, { area: 'checks', hero: heroChecks }));

  const cal = brief.calibration;
  const gauge = cal.precision !== undefined
    ? `<svg class="gauge" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="Measured precision ${pct(cal.precision)}"><rect x="0" y="0" width="${Math.round(cal.precision * 100)}" height="8" fill="url(#tone-2)"/><rect x="0.6" y="0.6" width="98.8" height="6.8" class="bar-ink"/></svg>`
    : '';

  const quiet = salience.level === 'quiet';
  const bodyPanels = quiet ? [panels[0]!, panels[1]!] : panels;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Gutter · ${html(change.title)}</title>
<style id="${TOKENS_ID}">${FRAME12_TOKENS}</style>
<style>${PAGE_CSS}</style>
</head>
<body>
<svg width="0" height="0" class="defs" aria-hidden="true" focusable="false"><defs>
  <pattern id="tone-1" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2" cy="2" r="0.6" class="dot"/></pattern>
  <pattern id="tone-2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2" cy="2" r="1.0" class="dot"/></pattern>
  <pattern id="tone-3" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2" cy="2" r="1.45" class="dot"/></pattern>
</defs></svg>
<main class="desk">
<article class="sheet">
  <header class="masthead">
    <p class="wordmark">GUTTER<span class="slash">/</span><span class="kicker">change briefing</span></p>
    <p class="issue">${issue}</p>
  </header>
  ${quiet ? `<p class="quiet-banner">Nothing to flag. ${html(salience.reasons.join(', '))}.</p>` : ''}
  <div class="page${quiet ? ' quiet' : ''}">
${bodyPanels.join('\n')}
  </div>
  <footer class="colophon">
    <div class="cal"><p><b>How much to trust the history panel here:</b> ${html(cal.note)}</p>${gauge}</div>
    <p class="small">No AI wrote this page: every line comes from git history and the code. ${brief.provenance.engines.map((e) => `${html(e.name)} ${html(e.version)}`).join(' + ')}.</p>
  </footer>
</article>
</main>
<script>${ON_TWOS_JS}</script>
</body>
</html>
`;
}

function questionHtml(q: string): string {
  return q
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith('`') && part.endsWith('`') && part.length > 1 ? `<code class="path">${html(part.slice(1, -1))}</code>` : html(part)))
    .join('');
}

/**
 * Motion on twos: each panel "cut" steps through 5 poses held 83.33ms apart
 * (12fps), spaced on a cubic ease-out chart so it lands with a wide first jump
 * and tight settling holds. Content is fully visible without JS, and skipped
 * entirely under prefers-reduced-motion.
 */
const ON_TWOS_JS = `(function(){
  try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { return; }
  var cuts = Array.prototype.slice.call(document.querySelectorAll('[data-cut]'));
  var POSE = 1000 / 12, POSES = 5, LAG = 2, start = null;
  cuts.forEach(function (el) { el.style.opacity = '0'; el.style.transform = 'translateY(12px)'; });
  function frame(ts) {
    if (start === null) start = ts;
    var pose = Math.floor((ts - start) / POSE), done = true;
    cuts.forEach(function (el, i) {
      var p = Math.min(Math.max((pose - i * LAG) / POSES, 0), 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.style.opacity = String(e);
      el.style.transform = p < 1 ? 'translateY(' + (12 * (1 - e)).toFixed(1) + 'px)' : '';
      if (p < 1) done = false;
    });
    if (!done) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();`;

const PAGE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{background:var(--f-desk)}
body{margin:0;background:var(--f-desk);color:var(--f-ink);font-family:var(--font-f-body);font-size:15px;line-height:1.5}
.defs{position:absolute}
.dot{fill:var(--f-tone)}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:2px}
a:focus-visible,.panel:focus-visible{outline:var(--f-stroke) solid var(--f-marker);outline-offset:2px}
.desk{padding:var(--f-gutter-change) 16px}
.sheet{max-width:1120px;margin:0 auto;background:var(--f-sheet);padding:var(--f-gutter-scene);box-shadow:var(--f-shadow-sheet)}
.masthead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--f-gutter-pair);border-bottom:calc(var(--f-stroke) * 2) solid var(--f-rule);padding-bottom:var(--f-gutter-pair);margin-bottom:var(--f-gutter-scene)}
.wordmark{margin:0;font-family:var(--font-f-display);font-size:34px;letter-spacing:.02em;line-height:1}
.slash{color:var(--f-ink-2);margin:0 6px}
.kicker{font-family:var(--font-f-mono);font-size:13px;letter-spacing:.08em;text-transform:uppercase;vertical-align:middle}
.issue{margin:0;font-family:var(--font-f-mono);font-size:12px;color:var(--f-ink-2)}
.quiet-banner{border:var(--f-stroke) solid var(--f-rule);padding:8px 12px;margin:0 0 var(--f-gutter-scene);font-family:var(--font-f-mono);font-size:13px}
.page{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--f-gutter-scene)}
.panel{grid-column:span 12;position:relative;background:var(--f-panel);border:var(--f-stroke) solid var(--f-rule);padding:0 16px 16px;min-width:0}
.page.quiet .panel{grid-column:span 12}
@media (min-width:860px){
.page:not(.quiet){grid-template-areas:"intent intent intent intent intent intent intent changed changed changed changed changed" "touches touches touches touches touches history history history history history history history" "tests tests tests tests tests history history history history history history history" "checks checks checks checks checks checks checks checks checks checks checks checks"}
.area-intent{grid-area:intent}.area-changed{grid-area:changed}.area-touches{grid-area:touches}.area-history{grid-area:history}.area-tests{grid-area:tests}.area-checks{grid-area:checks}
.page.quiet .area-intent{grid-column:span 7}.page.quiet .area-changed{grid-column:span 5}
}
.cap{display:inline-flex;align-items:center;margin:0 0 14px -16px;padding:5px 12px 5px 0;background:var(--f-ink);color:var(--f-sheet);font-family:var(--font-f-display);font-size:14px;font-weight:400;letter-spacing:.04em;text-transform:uppercase}
.cap .num{display:inline-block;min-width:28px;text-align:center;border-right:1px solid currentColor;padding:0 8px;margin-right:8px}
.cap.marker{background:var(--f-marker);color:var(--f-marker-ink)}
.hero{border-width:calc(var(--f-stroke) * 1.6)}
.balloon{position:relative;border:var(--f-stroke) solid var(--f-rule);border-radius:22px;padding:12px 16px;margin:4px 0 18px;background:var(--f-panel)}
.balloon::after{content:"";position:absolute;left:28px;bottom:-12px;width:18px;height:18px;background:var(--f-panel);border-right:var(--f-stroke) solid var(--f-rule);border-bottom:var(--f-stroke) solid var(--f-rule);transform:skewX(32deg) rotate(45deg)}
.balloon.thought{border-style:dashed}
.balloon.thought::after{display:none}
.said{margin:0;font-family:var(--font-f-display);font-size:19px;line-height:1.25;overflow-wrap:anywhere}
.aside{margin:8px 0 0;color:var(--f-ink-2);font-size:14px;white-space:pre-line;overflow-wrap:anywhere}
.commits,.receipts{margin:0;padding-left:20px;font-size:13px}
.commits li,.receipts li{overflow-wrap:anywhere}
.sha{font-family:var(--font-f-mono);font-size:12px}
.stat{margin:0 0 10px;font-family:var(--font-f-mono);font-size:13px}
.modules{list-style:none;margin:0;padding:0;display:grid;gap:var(--f-gutter-pair)}
.modules li{display:grid;grid-template-columns:minmax(0,9em) minmax(0,1fr) auto;align-items:center;gap:var(--f-gutter-pair)}
.mod{font-family:var(--font-f-mono);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{width:100%;height:14px;display:block}
.bar-ink{fill:none;stroke:var(--f-rule);stroke-width:1.2;vector-effect:non-scaling-stroke}
.num-sm{font-family:var(--font-f-mono);font-size:11px;color:var(--f-ink-2);white-space:nowrap}
.path{font-family:var(--font-f-mono);font-size:12px;padding:1px 5px;-webkit-box-decoration-break:clone;box-decoration-break:clone;line-height:1.9;border:1px solid var(--f-rule);background:var(--f-panel);overflow-wrap:anywhere}
.path.dashed{border-style:dashed}
.path.solid{border-width:2px}
.deps{list-style:none;margin:0;padding:0;display:grid;gap:var(--f-gutter-pair)}
.deps li{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--f-gutter-pair)}
.importers{display:inline-flex;flex-wrap:wrap;gap:var(--f-gutter-pair)}
.ref{font-family:var(--font-f-mono);font-size:12px;overflow-wrap:anywhere}
.deps .test-row{flex-direction:column;align-items:flex-start;gap:0}
.fact{font-size:13px;color:var(--f-ink-2);margin:4px 0}
.stamp{font-family:var(--font-f-display);font-size:10px;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--f-rule);padding:0 5px;transform:rotate(-3deg);display:inline-block}
.small{font-size:12px;color:var(--f-ink-2);margin:4px 0 0}
.quiet-line{margin:0;color:var(--f-ink-2)}
.wires{list-style:none;margin:0;padding:0;display:grid;gap:var(--f-gutter-scene)}
.wire-row+.wire-row{border-top:1px solid var(--f-grid);padding-top:14px}
.wire{display:grid;grid-template-columns:auto minmax(28px,1fr) auto;align-items:center;gap:var(--f-gutter-pair)}
.wire > a,.wire > code{min-width:0}
.ghost{width:100%;height:12px}
.ghost line{stroke:var(--f-ink);stroke-width:2.5;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}
.evidence-line{margin:8px 0 2px;font-family:var(--font-f-mono);font-size:13px}
.why{margin-bottom:6px}
.family{margin-top:14px;padding-top:10px;border-top:1px solid var(--f-grid)}
.family p{margin:0 0 4px}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--f-gutter-pair);margin:0 0 12px}
.metrics div{border:1.5px solid var(--f-rule);padding:6px 8px}
.metrics dt{font-family:var(--font-f-mono);font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--f-ink-2)}
.metrics dd{margin:0;font-family:var(--font-f-display);font-size:28px;line-height:1.1}
.checks{margin:0;padding-left:22px;display:grid;gap:var(--f-gutter-pair)}
@media (min-width:860px){.checks{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--f-gutter-change)}}
.checks p{margin:0}
.jump{font-size:12px}
.colophon{margin-top:var(--f-gutter-scene);border-top:var(--f-stroke) solid var(--f-rule);padding-top:var(--f-gutter-pair);display:grid;gap:var(--f-gutter-pair)}
.cal p{margin:0 0 6px;font-size:13px}
.gauge{width:min(320px,100%);height:10px;display:block}
@media (max-width:520px){.sheet{padding:var(--f-gutter-pair)}.wordmark{font-size:26px}.wire{grid-template-columns:1fr}.ghost{transform:rotate(90deg);height:12px;width:28px;justify-self:start}}
@media print{.desk{padding:0}.sheet{box-shadow:none}}
`;

const LEGAL_GUTTER_VALUES = new Set([
  '0',
  '0px',
  '12px',
  '20px',
  '32px',
  'var(--f-gutter-pair)',
  'var(--f-gutter-scene)',
  'var(--f-gutter-change)',
]);

function isLegalGutterValue(raw: string): boolean {
  const cleaned = raw.trim().replace(/!important$/i, '').trim();
  if (!cleaned) return true;
  if (LEGAL_GUTTER_VALUES.has(cleaned)) return true;
  const parts = cleaned.match(/var\([^)]+\)|\S+/g) ?? [];
  return parts.length >= 1 && parts.length <= 2 && parts.every((p) => LEGAL_GUTTER_VALUES.has(p));
}

/**
 * Design-grammar lint for generated pages, checking 6 FRAME/12 rules:
 *  1. color-literal  — no hex/rgb/hsl color literals outside the token block
 *  2. gradient       — no CSS gradients (use SVG screentone patterns)
 *  3. font-literal   — font-family must reference var(--font-f-*)
 *  4. marker-misuse  — --f-marker background must pair with --f-marker-ink text
 *  5. illegal-gutter — gap/row-gap/column-gap/grid-gap must use 0, 12px/pair, 20px/scene, or 32px/change
 *  6. cut-order      — data-cut attributes and .num captions must be C-01…C-0N in document order
 */
export function lintPage(page: string): string[] {
  const problems: string[] = [];
  const outsideTokens = page.replace(new RegExp(`<style id="${TOKENS_ID}">[\\s\\S]*?</style>`), '');
  const styles = [...outsideTokens.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('\n');
  const inlineStyles = [...outsideTokens.matchAll(/\bstyle="([^"]*)"/gi)].map((m) => m[1] ?? '').join('\n');
  const allStyles = `${styles}\n${inlineStyles}`;

  for (const m of allStyles.matchAll(/#[0-9a-f]{3,8}\b/gi)) problems.push(`color-literal: ${m[0]}`);
  for (const m of allStyles.matchAll(/\b(rgba?|hsla?|oklch|oklab)\(/gi)) problems.push(`color-literal: ${m[0]}`);
  if (/gradient\(/i.test(allStyles)) problems.push('gradient: gradients are forbidden; use screentone patterns');
  for (const m of allStyles.matchAll(/font-family:\s*([^;}]+)/g)) {
    if (!/^var\(--font-f-/.test(m[1]!.trim())) problems.push(`font-literal: ${m[1]!.trim()}`);
  }
  for (const m of styles.matchAll(/\{[^}]*background:\s*var\(--f-marker\)[^}]*\}/g)) {
    if (!/color:\s*var\(--f-marker-ink\)/.test(m[0])) problems.push('marker-misuse: marker background without --f-marker-ink text');
  }
  for (const m of allStyles.matchAll(/\b(?:gap|row-gap|column-gap|grid-gap)\s*:\s*([^;}"'\n]+)/gi)) {
    const val = m[1]!.trim();
    if (!isLegalGutterValue(val)) {
      problems.push(`illegal-gutter: ${m[0].trim()}`);
    }
  }

  const cuts = [...outsideTokens.matchAll(/\bdata-cut="([^"]*)"/g)].map((m) => m[1] ?? '');
  const nums = [...outsideTokens.matchAll(/<span class="num">([^<]*)<\/span>/g)].map((m) => m[1] ?? '');
  if (cuts.length === 0) {
    problems.push('cut-order: no data-cut panels found');
  } else {
    const len = Math.max(cuts.length, nums.length);
    for (let i = 0; i < len; i++) {
      const expected = `C-${String(i + 1).padStart(2, '0')}`;
      if (cuts[i] !== expected) {
        problems.push(`cut-order: expected data-cut="${expected}" at panel ${i + 1}, got "${cuts[i] ?? ''}"`);
      }
      if (nums[i] !== expected) {
        problems.push(`cut-order: expected .num caption "${expected}" at panel ${i + 1}, got "${nums[i] ?? ''}"`);
      }
    }
  }

  return problems;
}
