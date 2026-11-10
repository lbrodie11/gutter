/**
 * `gutter label --compare`: blinded comparison labeling (GU-04 Stage 0).
 *
 * Samples Gutter `forgotten-companion` targets and matched baseline proposals from one
 * `bench.json`, renders every item identically ("Should this PR also have changed <file>?"
 * with the PR title and diff summary only), and reveals source, evidence, and the automatic
 * follow-up outcome only after the labeler picks useful / irrelevant / wrong.
 *
 * The page is one self-contained HTML file: no server, no network, progress in localStorage.
 * All PR-derived text is escaped server-side; the client never builds HTML from bench data.
 */
import { createHash } from 'node:crypto';
import { commitUrl, fileUrl, html, safeBase, short } from '../render/escape.ts';
import { FRAME12_TOKENS, TOKENS_ID } from '../render/frame12-tokens.ts';
import type { BaselineName, BenchPrRecord, BenchResultsModel, TargetOutcomeRecord } from './model.ts';
import { isScoredStatus, mulberry32 } from './metrics.ts';
import { sanitizePath, sanitizeText } from './sanitize.ts';

export type LabelValue = 'useful' | 'irrelevant' | 'wrong';
export type CompareSource = 'gutter' | Extract<BaselineName, 'recent' | 'popular-near'>;

export const LABELS_SCHEMA_VERSION = 1 as const;

export interface CompareOptions {
  seed?: number;
  gutter?: number;
  recent?: number;
  popularNear?: number;
}

export interface CompareItem {
  /** Opaque, source-blind id shown on the page (`c01`…). */
  itemId: string;
  /** Stable id that resolves back into `bench.json`: `<prId>::<check id | baseline:<name>>::<file>`. */
  questionId: string;
  source: CompareSource;
  pr: BenchPrRecord;
  file: string;
  /** Gutter's question text, or null for a baseline proposal. */
  question: string | null;
  intervalLow: number | null;
  outcome: TargetOutcomeRecord;
}

export interface CompareSample {
  mode: 'compare';
  sampleId: string;
  seed: number;
  requested: Record<CompareSource, number>;
  /** Items actually drawn per source (less than requested only when the pool is too small). */
  drawn: Record<CompareSource, number>;
  /** Eligible pool sizes per source, after exclusions. */
  pool: Record<CompareSource, number>;
  /** Baseline proposals dropped because the same (PR, file) is a Gutter companion target. */
  overlapExcluded: number;
  items: CompareItem[];
  bench: {
    repo: string;
    remoteUrl: string | null;
    headSha: string;
    settingsHash: string;
    windowDays: number;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

type Candidate = Omit<CompareItem, 'itemId'>;

const pairKey = (prId: string, file: string) => `${prId}\u0000${file}`;

/**
 * Take up to `n` candidates: first at most one per PR (spreads the sample across PRs),
 * then fill from the rest. Skips any (PR, file) already taken by another source.
 */
function draw(pool: readonly Candidate[], n: number, rng: () => number, taken: Set<string>): Candidate[] {
  const order = shuffle(pool, rng);
  const picked: Candidate[] = [];
  const usedPrs = new Set<string>();
  for (const pass of [0, 1]) {
    for (const c of order) {
      if (picked.length >= n) break;
      const key = pairKey(c.pr.id, c.file);
      if (taken.has(key)) continue;
      if (pass === 0 && usedPrs.has(c.pr.id)) continue;
      picked.push(c);
      usedPrs.add(c.pr.id);
      taken.add(key);
    }
  }
  return picked;
}

export function sampleCompare(model: BenchResultsModel, opts: CompareOptions = {}): CompareSample {
  const seed = Math.trunc(opts.seed ?? 1);
  const requested: Record<CompareSource, number> = {
    gutter: opts.gutter ?? 30,
    recent: opts.recent ?? 15,
    'popular-near': opts.popularNear ?? 15,
  };

  const prs = model.prs.filter((p) => p.history === 'available');
  const gutterPool: Candidate[] = [];
  const companionKeys = new Set<string>();
  for (const pr of prs) {
    const seen = new Set<string>();
    for (const q of pr.policies.production.questions) {
      if (q.kind !== 'forgotten-companion') continue;
      for (const t of q.targets) {
        companionKeys.add(pairKey(pr.id, t.targetFile));
        if (!isScoredStatus(t.status) || seen.has(t.targetFile)) continue;
        seen.add(t.targetFile);
        gutterPool.push({
          questionId: `${pr.id}::${q.id}::${t.targetFile}`,
          source: 'gutter',
          pr,
          file: t.targetFile,
          question: q.question,
          intervalLow: q.intervalLow,
          outcome: t,
        });
      }
    }
  }

  let overlapExcluded = 0;
  const baselinePool = (name: 'recent' | 'popular-near'): Candidate[] => {
    const out: Candidate[] = [];
    for (const pr of prs) {
      for (const t of pr.policies.production.baselines[name].targets) {
        if (!isScoredStatus(t.status)) continue;
        if (companionKeys.has(pairKey(pr.id, t.targetFile))) {
          overlapExcluded++;
          continue;
        }
        out.push({
          questionId: `${pr.id}::baseline:${name}::${t.targetFile}`,
          source: name,
          pr,
          file: t.targetFile,
          question: null,
          intervalLow: null,
          outcome: t,
        });
      }
    }
    return out;
  };
  const recentPool = baselinePool('recent');
  const nearPool = baselinePool('popular-near');

  // Each source gets its own seeded stream so changing one quota never reshuffles another.
  const taken = new Set<string>();
  const gutterItems = draw(gutterPool, requested.gutter, mulberry32(seed * 3 + 1), taken);
  const recentItems = draw(recentPool, requested.recent, mulberry32(seed * 3 + 2), taken);
  const nearItems = draw(nearPool, requested['popular-near'], mulberry32(seed * 3 + 3), taken);

  const ordered = shuffle([...gutterItems, ...recentItems, ...nearItems], mulberry32(seed * 3 + 4));
  const width = Math.max(2, String(ordered.length).length);
  const items: CompareItem[] = ordered.map((c, i) => ({ ...c, itemId: `c${String(i + 1).padStart(width, '0')}` }));

  const sampleId = createHash('sha256')
    .update(
      JSON.stringify([
        'compare',
        seed,
        model.runIdentity.branchHeadSha,
        model.runIdentity.settingsHash,
        items.map((i) => i.questionId),
      ]),
    )
    .digest('hex')
    .slice(0, 12);

  return {
    mode: 'compare',
    sampleId,
    seed,
    requested,
    drawn: { gutter: gutterItems.length, recent: recentItems.length, 'popular-near': nearItems.length },
    pool: { gutter: gutterPool.length, recent: recentPool.length, 'popular-near': nearPool.length },
    overlapExcluded,
    items,
    bench: {
      repo: model.repo.name,
      remoteUrl: model.repo.remoteUrl,
      headSha: model.repo.headSha,
      settingsHash: model.runIdentity.settingsHash,
      windowDays: model.settings.windowDays,
    },
  };
}

// ---------------------------------------------------------------------------
// Rendering

function codePath(path: string, href?: string): string {
  const inner = `<code class="path">${html(sanitizePath(path, 200))}</code>`;
  return href ? `<a href="${html(href)}" rel="noopener noreferrer">${inner}</a>` : inner;
}

/** Gutter question text with its backtick-quoted paths rendered as code. */
function questionHtml(raw: string): string {
  return sanitizeText(raw, 400)
    .split(/(`[^`]*`)/)
    .map((part) =>
      part.length > 1 && part.startsWith('`') && part.endsWith('`')
        ? `<code class="path">${html(sanitizePath(part.slice(1, -1), 200))}</code>`
        : html(part),
    )
    .join('');
}

function prUrl(remoteUrl: string | null, prNumber: number | null): string | undefined {
  const base = safeBase(remoteUrl ?? undefined);
  return base && prNumber !== null && Number.isInteger(prNumber) && prNumber > 0 ? `${base}/pull/${prNumber}` : undefined;
}

const BASELINE_RULES: Record<'recent' | 'popular-near', string> = {
  recent:
    'Proposed by the <b>recent</b> baseline: among files this PR did not touch, one of the files changed most often in the 30 days before the PR’s base. It proposes as many files as Gutter asked about on this PR.',
  'popular-near':
    'Proposed by the <b>popular-near</b> baseline: among files this PR did not touch that share a top-level directory with a file it did touch, one of the most frequently changed in all history before the PR’s base. It proposes as many files as Gutter asked about on this PR.',
};

function revealHtml(item: CompareItem, remoteUrl: string | null, windowDays: number): string {
  const sourceName = item.source === 'gutter' ? 'Gutter' : `Baseline: ${item.source}`;
  const evidence =
    item.source === 'gutter'
      ? `<p class="evidence">Gutter asked: ${questionHtml(item.question ?? '')}</p>` +
        (item.intervalLow !== null ? `<p class="small">Wilson 95% lower bound: ${item.intervalLow.toFixed(2)}</p>` : '')
      : `<p class="evidence">${BASELINE_RULES[item.source]}</p>`;
  const o = item.outcome;
  let outcome: string;
  if (o.status === 'followedUp' && o.commitSha) {
    const href = commitUrl(remoteUrl ?? undefined, o.commitSha);
    const sha = html(short(o.commitSha));
    const shaHtml = href ? `<a class="sha" href="${html(href)}" rel="noopener noreferrer">${sha}</a>` : `<span class="sha">${sha}</span>`;
    const delay = o.delayHours !== null ? `${o.delayHours.toFixed(1)} h after merge` : 'within the window';
    outcome =
      `Automatic outcome: <b>changed</b> in ${shaHtml}, ${html(delay)}` +
      ` · same author: ${o.sameAuthor ? 'yes' : 'no'} · RA follow-up signal: ${o.matchesRaFollowUp ? 'yes' : 'no'}`;
  } else {
    outcome = `Automatic outcome: <b>not changed</b> within ${windowDays} day(s) after merge.`;
  }
  return `<p class="source"><span class="stamp">${html(sourceName)}</span></p>${evidence}<p class="stat">${outcome}</p>`;
}

function diffSummaryHtml(pr: BenchPrRecord, remoteUrl: string | null): string {
  const files = pr.changedFiles ?? [];
  if (files.length === 0) {
    return `<p class="small">${pr.changedFilesCount} file(s) changed (file list not recorded in this bench.json).</p>`;
  }
  const rows = files
    .map(
      (f) =>
        `<li>${codePath(f.path, fileUrl(remoteUrl ?? undefined, pr.head, f.path))} <span class="delta">+${f.additions}/−${f.deletions}</span></li>`,
    )
    .join('');
  const more = pr.changedFilesCount > files.length ? `<p class="small">…and ${pr.changedFilesCount - files.length} more file(s).</p>` : '';
  return `<ul class="diff">${rows}</ul>${more}`;
}

function encodeReveal(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function renderCompareLabelHtml(sample: CompareSample): string {
  const { remoteUrl, windowDays } = sample.bench;
  const repo = html(sanitizeText(sample.bench.repo, 100));
  const total = sample.items.length;

  const cards = sample.items
    .map((item, i) => {
      const cut = `C-${String(i + 2).padStart(2, '0')}`;
      const pr = item.pr;
      const title = html(sanitizeText(pr.subject, 200));
      const prHref = prUrl(remoteUrl, pr.prNumber);
      const prLabel = pr.prNumber !== null ? `#${pr.prNumber}` : html(short(pr.mergeCommitSha));
      const prLink = prHref ? `<a href="${html(prHref)}" rel="noopener noreferrer">${prLabel}</a>` : prLabel;
      const reveal = encodeReveal({
        questionId: item.questionId,
        source: item.source,
        html: revealHtml(item, remoteUrl, windowDays),
      });
      return `<section class="panel item" data-cut="${cut}" data-item="${item.itemId}" data-reveal="${reveal}" aria-labelledby="h-${item.itemId}">
  <h2 id="h-${item.itemId}" class="cap"><span class="num">${cut}</span> Item ${item.itemId}</h2>
  <p class="said">Should this PR also have changed ${codePath(item.file, fileUrl(remoteUrl ?? undefined, pr.head, item.file))}?</p>
  <p class="pr">${prLink} · ${title}</p>
  ${diffSummaryHtml(pr, remoteUrl)}
  <div class="choices" role="group" aria-label="Label for item ${item.itemId}">
    <button type="button" data-label="useful">Useful</button>
    <button type="button" data-label="irrelevant">Irrelevant</button>
    <button type="button" data-label="wrong">Wrong</button>
  </div>
  <label class="note">Note <textarea data-note rows="2" maxlength="1000"></textarea></label>
  <div class="reveal" data-revealed hidden></div>
</section>`;
    })
    .join('\n');

  const config = {
    schemaVersion: LABELS_SCHEMA_VERSION,
    mode: sample.mode,
    sampleId: sample.sampleId,
    seed: sample.seed,
    bench: sample.bench,
    total,
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Gutter Labels · ${repo}</title>
<style id="${TOKENS_ID}">${FRAME12_TOKENS}</style>
<style>${LABEL_CSS}</style>
</head>
<body>
<main class="desk">
<article class="sheet">
  <header class="masthead">
    <p class="wordmark">GUTTER<span class="slash">/</span><span class="kicker">blinded labeling</span></p>
    <p class="issue">${repo} · ${html(short(sample.bench.headSha))} · sample ${html(sample.sampleId)} · seed ${sample.seed}</p>
  </header>
  <div class="page">
<section class="panel" data-cut="C-01" aria-labelledby="h-intro">
  <h2 id="h-intro" class="cap marker"><span class="num">C-01</span> How to label</h2>
  <p>Each item asks whether a merged PR should also have changed one more file. Some items come from Gutter and some from simple baselines; they look the same on purpose. Judge from the PR title and the changed files only.</p>
  <ul class="rules">
    <li><b>Useful</b>: a reviewer would have wanted to be asked this.</li>
    <li><b>Irrelevant</b>: plausible file, but the question would not help review this PR.</li>
    <li><b>Wrong</b>: the file clearly has nothing to do with this change.</li>
  </ul>
  <p class="small">After you choose, the item reveals where it came from, its evidence, and whether the file actually changed within ${windowDays} day(s). Please don't open developer tools: the answers are in this file, encoded but not encrypted. Progress is saved in this browser; export when done.</p>
  <label class="labeler">Your name or handle <input type="text" data-labeler maxlength="80" autocomplete="off"></label>
  <p class="stat" data-progress aria-live="polite">0 / ${total} labeled</p>
  <button type="button" data-export>Export labels.json</button>
  <p class="small" data-storage-warning hidden>This browser blocked local storage, so progress will not survive a reload. Export before closing.</p>
</section>
${cards}
  </div>
  <footer class="colophon">
    <p class="small">Generated by gutter label --compare. Deterministic sample: no AI, no network.</p>
  </footer>
</article>
</main>
<script type="application/json" id="label-config">${jsonForScript(config)}</script>
<script>${LABEL_JS}</script>
</body>
</html>
`;
}

/** JSON safe to embed inside a <script> element. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATORS, (c) => (c.charCodeAt(0) === 0x2028 ? '\\u2028' : '\\u2029'));
}

/** U+2028 / U+2029, built from code points so the source file stays plain ASCII. */
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

const LABEL_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{background:var(--f-desk)}
body{margin:0;background:var(--f-desk);color:var(--f-ink);font-family:var(--font-f-body);font-size:15px;line-height:1.5}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:2px}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:var(--f-stroke) solid var(--f-marker);outline-offset:2px}
.desk{padding:var(--f-gutter-change) 16px}
.sheet{max-width:880px;margin:0 auto;background:var(--f-sheet);padding:var(--f-gutter-scene);box-shadow:var(--f-shadow-sheet)}
.masthead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--f-gutter-pair);border-bottom:calc(var(--f-stroke) * 2) solid var(--f-rule);padding-bottom:var(--f-gutter-pair);margin-bottom:var(--f-gutter-scene)}
.wordmark{margin:0;font-family:var(--font-f-display);font-size:30px;letter-spacing:.02em;line-height:1}
.slash{color:var(--f-ink-2);margin:0 6px}
.kicker{font-family:var(--font-f-mono);font-size:13px;letter-spacing:.08em;text-transform:uppercase;vertical-align:middle}
.issue{margin:0;font-family:var(--font-f-mono);font-size:12px;color:var(--f-ink-2)}
.page{display:grid;gap:var(--f-gutter-scene)}
.panel{position:relative;background:var(--f-panel);border:var(--f-stroke) solid var(--f-rule);padding:0 16px 16px;min-width:0}
.panel.done{border-style:dashed}
.cap{display:inline-flex;align-items:center;margin:0 0 14px -16px;padding:5px 12px 5px 0;background:var(--f-ink);color:var(--f-sheet);font-family:var(--font-f-display);font-size:14px;font-weight:400;letter-spacing:.04em;text-transform:uppercase}
.cap .num{display:inline-block;min-width:28px;text-align:center;border-right:1px solid currentColor;padding:0 8px;margin-right:8px}
.cap.marker{background:var(--f-marker);color:var(--f-marker-ink)}
.said{margin:0 0 8px;font-family:var(--font-f-display);font-size:18px;line-height:1.3;overflow-wrap:anywhere}
.pr{margin:0 0 8px;overflow-wrap:anywhere}
.path{font-family:var(--font-f-mono);font-size:12px;padding:1px 5px;border:1px solid var(--f-rule);background:var(--f-panel);overflow-wrap:anywhere}
.diff{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:var(--f-gutter-pair);max-height:220px;overflow:auto}
.delta,.sha,.stat{font-family:var(--font-f-mono);font-size:12px}
.stat{margin:8px 0}
.small{font-size:12px;color:var(--f-ink-2);margin:4px 0 0}
.rules{margin:0 0 8px;padding-left:20px}
.choices{display:flex;flex-wrap:wrap;gap:var(--f-gutter-pair);margin:8px 0}
button{font:inherit;font-family:var(--font-f-display);font-size:13px;letter-spacing:.04em;text-transform:uppercase;padding:6px 14px;border:var(--f-stroke) solid var(--f-rule);background:var(--f-panel);color:var(--f-ink);cursor:pointer}
button[aria-pressed="true"]{background:var(--f-marker);color:var(--f-marker-ink)}
input,textarea{font:inherit;font-size:14px;width:100%;padding:6px 8px;border:1.5px solid var(--f-rule);background:var(--f-sheet);color:var(--f-ink)}
.note,.labeler{display:block;font-family:var(--font-f-mono);font-size:12px;margin:8px 0}
.reveal{border-top:1.5px dashed var(--f-rule);margin-top:12px;padding-top:8px}
.evidence{margin:4px 0;overflow-wrap:anywhere}
.stamp{font-family:var(--font-f-display);font-size:11px;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--f-rule);padding:0 6px;display:inline-block}
.colophon{margin-top:var(--f-gutter-scene)}
@media (max-width:560px){.sheet{padding:var(--f-gutter-pair)}.wordmark{font-size:24px}}
`;

/**
 * Client script. It only ever inserts the server-escaped reveal HTML, sets textContent,
 * and reads/writes localStorage inside try/catch.
 */
const LABEL_JS = `(function(){
  var config = JSON.parse(document.getElementById('label-config').textContent);
  var KEY = 'gutter-label:' + config.sampleId;
  var state = { labeler: '', items: {} };
  var storageOk = true;
  try { var raw = window.localStorage.getItem(KEY); if (raw) { var parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object' && parsed.items) state = parsed; } }
  catch (e) { storageOk = false; }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { if (storageOk) { storageOk = false; showStorageWarning(); } }
  }
  function showStorageWarning() { var w = document.querySelector('[data-storage-warning]'); if (w) w.hidden = false; }
  if (!storageOk) showStorageWarning();
  function decode(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-item]'));
  var progress = document.querySelector('[data-progress]');
  function updateProgress() {
    var n = cards.filter(function (c) { var s = state.items[c.getAttribute('data-item')]; return s && s.label; }).length;
    progress.textContent = n + ' / ' + config.total + ' labeled';
  }
  function reveal(card) {
    var box = card.querySelector('[data-revealed]');
    if (!box.hidden) return;
    var payload = decode(card.getAttribute('data-reveal'));
    box.innerHTML = payload.html;
    box.hidden = false;
    card.classList.add('done');
  }
  function paint(card) {
    var s = state.items[card.getAttribute('data-item')];
    Array.prototype.forEach.call(card.querySelectorAll('[data-label]'), function (b) {
      b.setAttribute('aria-pressed', s && s.label === b.getAttribute('data-label') ? 'true' : 'false');
    });
    if (s && s.label) reveal(card);
  }
  cards.forEach(function (card) {
    var id = card.getAttribute('data-item');
    var note = card.querySelector('[data-note]');
    if (state.items[id] && state.items[id].note) note.value = state.items[id].note;
    Array.prototype.forEach.call(card.querySelectorAll('[data-label]'), function (b) {
      b.addEventListener('click', function () {
        var prev = state.items[id] || { note: '' };
        var wasRevealed = Boolean(prev.label);
        state.items[id] = {
          label: b.getAttribute('data-label'),
          note: note.value,
          labeledAt: new Date().toISOString(),
          firstLabel: prev.firstLabel || b.getAttribute('data-label'),
          changedAfterReveal: Boolean(prev.changedAfterReveal) || (wasRevealed && prev.label !== b.getAttribute('data-label'))
        };
        save(); paint(card); updateProgress();
      });
    });
    note.addEventListener('input', function () {
      var s = state.items[id] || {};
      s.note = note.value; state.items[id] = s; save();
    });
    paint(card);
  });
  var labelerInput = document.querySelector('[data-labeler]');
  labelerInput.value = state.labeler || '';
  labelerInput.addEventListener('input', function () { state.labeler = labelerInput.value; save(); });
  updateProgress();
  document.querySelector('[data-export]').addEventListener('click', function () {
    var labels = [];
    cards.forEach(function (card) {
      var id = card.getAttribute('data-item');
      var s = state.items[id];
      if (!s || !s.label) return;
      var p = decode(card.getAttribute('data-reveal'));
      labels.push({
        questionId: p.questionId, itemId: id, source: p.source, label: s.label, note: s.note || '',
        labeler: state.labeler || '', labeledAt: s.labeledAt, firstLabel: s.firstLabel || s.label,
        changedAfterReveal: Boolean(s.changedAfterReveal)
      });
    });
    var doc = {
      schemaVersion: config.schemaVersion, kind: 'gutter-labels', mode: config.mode,
      sampleId: config.sampleId, seed: config.seed, bench: config.bench, total: config.total,
      exportedAt: new Date().toISOString(), labels: labels
    };
    var blob = new Blob([JSON.stringify(doc, null, 2) + '\\n'], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'labels.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
})();`;
