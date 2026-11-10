import { commitUrl, fileUrl, html, short } from '../render/escape.ts';
import { FRAME12_TOKENS, TOKENS_ID } from '../render/frame12-tokens.ts';
import {
  UNGATED_POLICY_LABEL,
  type BaselineName,
  type BenchResultsModel,
  type BootstrapInterval,
  type ExemplarQuestion,
  type LiftBootstrapInterval,
  OUTCOME_NAMES,
  type OutcomeName,
  type PolicyAggregateSummary,
  type ProportionMetric,
} from './model.ts';
import { baselineOutcomeRate, policyOutcomeRate } from './metrics.ts';
import { sanitizeAuthorName, sanitizePath, sanitizeText } from './sanitize.ts';
import { assertValidBenchResults } from './validate.ts';

export const MAX_BENCH_HTML_BYTES = 128 * 1024;

function fmtProportionHtml(m: ProportionMetric): string {
  if (m.denominator === 0 || m.rate === null || m.interval === null) {
    return `${m.numerator} / ${m.denominator} <span class="small">(N/A)</span>`;
  }
  return `<b>${m.rate}</b> <span class="small">(${m.numerator}/${m.denominator} · [${m.interval.low}, ${m.interval.high}])</span>`;
}

function fmtLiftBootstrapHtml(b: LiftBootstrapInterval | null): string {
  if (!b) return '<span class="small">N/A</span>';
  const v = (x: number | null) => (x === null ? '∞' : String(x));
  const unbounded = b.unboundedResamples > 0 ? `, ${b.unboundedResamples} unbounded` : '';
  return `[${v(b.low)}, ${v(b.high)}] <span class="small">(median ${v(b.median)}, n=${b.resamples}, seed=${b.seed}${unbounded})</span>`;
}

function fmtBootstrapHtml(b: BootstrapInterval | null): string {
  if (!b) return '<span class="small">N/A</span>';
  return `[${b.low}, ${b.high}] <span class="small">(median ${b.median}, n=${b.resamples}, seed=${b.seed})</span>`;
}

function fmtLiftHtml(lift: number | null): string {
  return lift === null ? '<span class="small">N/A</span>' : `<b>×${lift}</b>`;
}

function safeHtmlQuestion(raw: string): string {
  const clean = sanitizeText(raw, 320);
  return clean
    .split(/(`[^`]*`)/)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1
        ? `<code class="path">${html(sanitizePath(part.slice(1, -1), 160))}</code>`
        : html(part),
    )
    .join('');
}

function renderExemplarHtml(items: readonly ExemplarQuestion[], repoUrl: string | null): string {
  if (items.length === 0) {
    return '<p class="quiet-line">None in this run.</p>';
  }
  const rows = items.slice(0, 5).map((ex) => {
    const headShort = short(ex.headSha);
    const headLinkUrl = commitUrl(repoUrl ?? undefined, ex.headSha);
    const headRef = headLinkUrl
      ? `<a class="sha" href="${html(headLinkUrl)}">${html(headShort)}</a>`
      : `<span class="sha">${html(headShort)}</span>`;

    const targetPath = sanitizePath(ex.targetFile, 160);
    const targetUrl = fileUrl(repoUrl ?? undefined, ex.headSha, targetPath);
    const targetCode = `<code class="path dashed">${html(targetPath)}</code>`;
    const targetRef = targetUrl ? `<a href="${html(targetUrl)}">${targetCode}</a>` : targetCode;

    const authors = ex.authorNames.length
      ? ex.authorNames.map((a) => html(sanitizeAuthorName(a))).join(', ')
      : 'unknown';

    let fuHtml = `<span class="stamp">${html(ex.status)}</span>`;
    if (ex.followUpCommitSha) {
      const fuShort = short(ex.followUpCommitSha);
      const fuUrl = commitUrl(repoUrl ?? undefined, ex.followUpCommitSha);
      const fuRef = fuUrl
        ? `<a class="sha" href="${html(fuUrl)}">${html(fuShort)}</a>`
        : `<span class="sha">${html(fuShort)}</span>`;
      fuHtml += ` <span class="small">in ${fuRef} (${ex.delayHours ?? 0}h · sameAuthor=${String(ex.sameAuthor)})</span>`;
    }

    return `<li class="wire-row">
      <p class="evidence-line"><b>${html(sanitizeText(ex.prId, 40))}</b> · ${headRef} · ${html(sanitizeText(ex.subject, 140))} · <span class="small">author(s): ${authors}</span></p>
      <p>${safeHtmlQuestion(ex.question)} <span class="small">(${html(ex.kind)} · intervalLow=${ex.intervalLow === null ? 'N/A' : ex.intervalLow})</span></p>
      <p class="small">Target: ${targetRef} · ${fuHtml}</p>
    </li>`;
  });
  return `<ul class="wires">${rows.join('\n')}</ul>`;
}

function renderPolicyMetricsTableHtml(summary: PolicyAggregateSummary): string {
  const acc = summary.accuracyProxy;
  const missed = summary.missedFollowUps;
  return `<table class="bench-table">
    <thead>
      <tr><th>Metric</th><th>Rate (Numerator / Denominator · Wilson CI)</th><th>PR-Clustered Bootstrap CI</th></tr>
    </thead>
    <tbody>
      <tr><td>File-level follow-up precision</td><td>${fmtProportionHtml(acc.fileLevelFollowUpPrecision)}</td><td>${fmtBootstrapHtml(acc.bootstrapFilePrecisionCi)}</td></tr>
      <tr><td>Question-level follow-up rate</td><td>${fmtProportionHtml(acc.questionLevelFollowUpRate)}</td><td>—</td></tr>
      <tr><td><code class="path">forgotten-companion</code> Precision@1</td><td>${fmtProportionHtml(acc.precisionAt1)}</td><td>—</td></tr>
      <tr><td><code class="path">forgotten-companion</code> Precision@3</td><td>${fmtProportionHtml(acc.precisionAt3)}</td><td>—</td></tr>
      <tr><td>Same-author follow-up rate</td><td>${fmtProportionHtml(acc.sameAuthorFollowUpRate)}</td><td>—</td></tr>
      <tr><td>Same-author share of <code class="path">followedUp</code></td><td>${fmtProportionHtml(acc.sameAuthorShareOfFollowedUp)}</td><td>—</td></tr>
      <tr><td>RA-signal follow-up rate</td><td>${fmtProportionHtml(acc.raSignalFollowUpRate)}</td><td>—</td></tr>
      <tr><td>Missed co-change follow-up recall proxy</td><td>${fmtProportionHtml(missed.recallProxy)}</td><td>—</td></tr>
    </tbody>
  </table>
  <p class="small">${html(acc.precisionAt3Note)} Missed co-change files: ${missed.missedFilesTotal} across ${missed.prsWithMissedFollowUp} PR(s).</p>`;
}

function renderBaselinesTableHtml(summary: PolicyAggregateSummary): string {
  const order: BaselineName[] = ['popular', 'popular-near', 'recent'];
  const rows = order
    .map((name) => {
      const b = summary.baselines[name];
      return `<tr>
        <td><code class="path">${html(b.baseline)}</code></td>
        <td>${b.proposedTargets}</td>
        <td>${b.shortfallPrs} (${b.shortfallTargets})</td>
        <td>${fmtProportionHtml(b.fileLevelFollowUp)}</td>
        <td>${fmtProportionHtml(b.questionLevelHitRate)}</td>
        <td>${fmtProportionHtml(b.sameAuthorFollowUpRate)}</td>
        <td>${fmtLiftHtml(b.liftVsBaseline)}</td>
        <td>${fmtBootstrapHtml(b.bootstrapLiftCi)}</td>
      </tr>`;
    })
    .join('\n');

  const hl = summary.headlineBaseline;
  return `<p class="stat">Strongest baseline: <b>${html(hl.strongestBaseline ?? 'N/A')}</b> · Headline lift: ${fmtLiftHtml(hl.lift)} · Bootstrap CI: ${fmtBootstrapHtml(hl.bootstrapLiftCi)}</p>
  <table class="bench-table">
    <thead>
      <tr><th>Baseline</th><th>Proposed</th><th>Shortfall PRs (Slots)</th><th>File-Level Follow-Up</th><th>Question Hit Rate</th><th>Same-Author Rate</th><th>Lift</th><th>Bootstrap Lift CI</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>${renderOutcomeLiftHtml(summary)}`;
}

/** GU-04 Stage 0: lift per outcome, each against that outcome's strongest baseline. */
function renderOutcomeLiftHtml(summary: PolicyAggregateSummary): string {
  const byOutcome = summary.headlineBaseline.byOutcome;
  if (!byOutcome) return '';
  const acc = summary.accuracyProxy;
  const labels: Record<OutcomeName, string> = {
    followUp: 'Any follow-up',
    sameAuthor: 'Same-author follow-up',
    raSignal: 'RA-signal follow-up',
  };
  const rows = OUTCOME_NAMES.map((outcome) => {
    const hl = byOutcome[outcome];
    const cells = (['popular', 'popular-near', 'recent'] as const)
      .map((name) => {
        const m = baselineOutcomeRate(summary.baselines[name], outcome);
        return `<td>${m ? fmtProportionHtml(m) : 'N/A'}</td>`;
      })
      .join('');
    return `<tr><td>${labels[outcome]}</td><td>${fmtProportionHtml(policyOutcomeRate(acc, outcome))}</td>${cells}<td><code class="path">${html(hl.strongestBaseline ?? 'N/A')}</code></td><td>${fmtLiftHtml(hl.lift)}</td><td>${fmtLiftBootstrapHtml(hl.bootstrapCi)}</td></tr>`;
  }).join('\n');
  return `
  <p class="small">Lift by outcome: each outcome is compared against its own strongest baseline.</p>
  <table class="bench-table">
    <thead>
      <tr><th>Outcome</th><th>Gutter</th><th>popular</th><th>popular-near</th><th>recent</th><th>Strongest</th><th>Lift</th><th>Bootstrap Lift CI</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * Render `bench.html` in FRAME/12's panel grammar (`C-01`..`C-06`) strictly
 * from the schema-validated `BenchResultsModel`.
 */
export function renderBenchHtml(model: BenchResultsModel, maxBytes: number = MAX_BENCH_HTML_BYTES): string {
  assertValidBenchResults(model);

  const repoName = html(sanitizeText(model.repo.name, 100));
  const branchName = html(sanitizeText(model.repo.branch, 100));
  const headShort = html(short(model.repo.headSha));
  const issue = `${repoName} · ${branchName} · ${headShort} · ${html(model.generatedAt)} · schemaVersion ${model.schemaVersion}`;

  const panel = (n: number, title: string, body: string, opts: { area: string; hero?: boolean }) => {
    const cutId = `C-${String(n).padStart(2, '0')}`;
    return `<section class="panel area-${opts.area}${opts.hero ? ' hero' : ''}" data-cut="${cutId}" aria-labelledby="p${n}">
  <h2 id="p${n}" class="cap${opts.hero ? ' marker' : ''}"><span class="num">${cutId}</span> ${html(title)}</h2>
  ${body}
</section>`;
  };

  const panels: string[] = [];
  const f = model.funnel;

  // C-01 · Gate Check & Discovery Funnel
  const c01Body = `
  <div class="balloon">
    <p class="said">${html(model.gates.fullSalienceShare.line)}</p>
    <p class="aside">${html(model.gates.gateAUsefulness.line)} <span class="stamp">${html(model.gates.gateAUsefulness.status)}</span></p>
  </div>
  <dl class="metrics">
    <div><dt>discovered</dt><dd>${f.discovered}</dd></div>
    <div><dt>eligible</dt><dd>${f.eligible}</dd></div>
    <div><dt>evaluated / scored</dt><dd>${f.evaluated} / ${f.scored}</dd></div>
  </dl>
  <table class="bench-table">
    <thead><tr><th>Classification / Exclusion</th><th>Count</th></tr></thead>
    <tbody>
      <tr><td><code class="path">merge-commit</code> (<code class="path">high</code> / <code class="path">medium</code>)</td><td>${f.classified.mergeCommitHigh} / ${f.classified.mergeCommitMedium}</td></tr>
      <tr><td><code class="path">squash-subject</code> (<code class="path">medium</code>)</td><td>${f.classified.squashMedium}</td></tr>
      <tr><td>Skipped: <code class="path">octopus</code> / <code class="path">not-a-pr</code> (root: ${f.exclusions.rootCommit})</td><td>${f.classified.octopus} / ${f.classified.notAPr}</td></tr>
      <tr><td>Unnumbered <code class="path">change-unit</code> (<code class="path">low</code>)</td><td>${f.classified.changeUnitLow}</td></tr>
      <tr><td>Excluded before eval (<code class="path">beforeSince</code> / <code class="path">missingMergeBase</code> / <code class="path">emptyDiff</code> / <code class="path">beyondPrsLimit</code> / <code class="path">historyUnavailable</code>)</td><td>${f.exclusions.beforeSince} / ${f.exclusions.missingMergeBase} / ${f.exclusions.emptyDiff} / ${f.exclusions.beyondPrsLimit} / ${f.exclusions.historyUnavailable}</td></tr>
      <tr><td>Excluded from scoring (<code class="path">noQuestions</code> / <code class="path">unscorableOnly</code> / <code class="path">resolvedAtMergeOnly</code> / <code class="path">censored</code>)</td><td>${f.exclusions.noQuestions} / ${f.exclusions.unscorableOnly} / ${f.exclusions.resolvedAtMergeOnly} / ${f.exclusions.censored}</td></tr>
    </tbody>
  </table>`;
  panels.push(panel(1, 'Gate Check & Funnel', c01Body, { area: 'funnel' }));

  // C-02 · Production Policy Summary
  const prod = model.aggregates.production;
  const prodCov = prod.coverage;
  const prodOut = prod.outcomes;
  const c02Body = `
  <p class="stat">Policy: <code class="path">${html(prod.policy)}</code> (${html(prod.policyLabel)}) · Sample: <span class="stamp">${html(prod.sampleStatus)}</span></p>
  <p class="stat">PRs with questions: ${fmtProportionHtml(prodCov.prsWithQuestions)} · Questions total: <b>${prodCov.questionsTotal}</b> (per PR: <b>${prodCov.questionsPerPr === null ? 'N/A' : prodCov.questionsPerPr}</b>)</p>
  <p class="stat">Salience — <code class="path">quiet</code>: ${fmtProportionHtml(prodCov.salienceDistribution.quiet)} · <code class="path">brief</code>: ${fmtProportionHtml(prodCov.salienceDistribution.brief)} · <code class="path">full</code>: ${fmtProportionHtml(prodCov.fullSalienceShare)}</p>
  <p class="small">Outcomes: followedUp=${prodOut.followedUp} · notFollowedUp=${prodOut.notFollowedUp} · censored=${prodOut.censored} · targetDeleted=${prodOut.targetDeleted} · targetRenamed=${prodOut.targetRenamed} · resolvedAtMerge=${prodOut.resolvedAtMerge} · unscorable=${prodOut.unscorable} · shared=${prodOut.sharedFollowUpOutcomes}</p>
  ${renderPolicyMetricsTableHtml(prod)}`;
  panels.push(panel(2, 'Production Policy', c02Body, { area: 'production' }));

  // C-03 · Matched As-Of Baselines (hero)
  const c03Body = renderBaselinesTableHtml(prod);
  panels.push(panel(3, 'Matched Baselines', c03Body, { area: 'baselines', hero: true }));

  // C-04 · Breakdowns & Confounders
  const kinds = ['broken-import', 'forgotten-companion', 'family-drift', 'untested-change', 'wide-surface'] as const;
  const kindRows = kinds
    .map((k) => {
      const r = prod.breakdowns.byKind[k];
      return `<tr><td><code class="path">${html(r.kind)}</code></td><td>${r.questions}</td><td>${r.scoredQuestions}</td><td>${fmtProportionHtml(r.questionFollowUpRate)}</td><td>${r.scoredTargets}</td><td>${fmtProportionHtml(r.fileFollowUpPrecision)}</td><td>${fmtProportionHtml(r.sameAuthorFollowUpRate)}</td></tr>`;
    })
    .join('\n');
  const buckets = ['0-0.3', '0.3-0.5', '0.5+'] as const;
  const bucketRows = buckets
    .map((b) => {
      const r = prod.breakdowns.byIntervalLow[b];
      return `<tr><td><code class="path">${html(r.bucket)}</code></td><td>${r.targets}</td><td>${r.scoredTargets}</td><td>${fmtProportionHtml(r.fileFollowUpPrecision)}</td><td>${fmtProportionHtml(r.sameAuthorFollowUpRate)}</td></tr>`;
    })
    .join('\n');
  const slices = ['cleanManual', 'botOrAgentOrigin', 'generatedPaths', 'dependencyOrVersionOnly', 'largeSweep50Plus'] as const;
  const sliceRows = slices
    .map((s) => {
      const r = prod.breakdowns.byConfounder[s];
      return `<tr><td><code class="path">${html(r.slice)}</code></td><td>${r.prsEvaluated}</td><td>${r.scoredTargets}</td><td>${fmtProportionHtml(r.fileFollowUpPrecision)}</td></tr>`;
    })
    .join('\n');
  const c04Body = `
  <table class="bench-table">
    <thead><tr><th>Kind</th><th>Questions</th><th>Scored Qs</th><th>Question Follow-Up</th><th>Scored Targets</th><th>File Follow-Up</th><th>Same-Author</th></tr></thead>
    <tbody>${kindRows}</tbody>
  </table>
  <table class="bench-table">
    <thead><tr><th>interval.low Bucket</th><th>Targets</th><th>Scored Targets</th><th>File Follow-Up</th><th>Same-Author</th></tr></thead>
    <tbody>${bucketRows}</tbody>
  </table>
  <table class="bench-table">
    <thead><tr><th>Confounder Slice</th><th>PRs Evaluated</th><th>Scored Targets</th><th>File Follow-Up</th></tr></thead>
    <tbody>${sliceRows}</tbody>
  </table>`;
  panels.push(panel(4, 'Breakdowns & Confounders', c04Body, { area: 'breakdowns' }));

  // C-05 · Ungated Policy (research: not product behavior)
  const ung = model.aggregates.ungated;
  const c05Body = `
  <div class="balloon thought">
    <p class="said"><span class="stamp">${html(UNGATED_POLICY_LABEL)}</span> Policy <code class="path">${html(ung.policy)}</code> bypasses backtest calibration to measure raw signal.</p>
  </div>
  <p class="stat">PRs evaluated: <b>${ung.coverage.prsEvaluated}</b> · PRs scored: <b>${ung.coverage.prsScored}</b> · Questions total: <b>${ung.coverage.questionsTotal}</b> (per PR: <b>${ung.coverage.questionsPerPr === null ? 'N/A' : ung.coverage.questionsPerPr}</b>)</p>
  ${renderPolicyMetricsTableHtml(ung)}
  ${renderBaselinesTableHtml(ung)}`;
  panels.push(panel(5, 'Ungated Research Policy', c05Body, { area: 'ungated' }));

  // C-06 · Exemplars, Timings & Methodology
  const stageNames = ['discovery', 'sessionOpen', 'staticAnalysis', 'brief', 'scoring', 'report'] as const;
  const stageRows = stageNames
    .map((st) => {
      const r = model.timings.stages[st];
      return `<tr><td><code class="path">${html(st)}</code></td><td>${r.count}</td><td>${r.totalMs}</td><td>${r.p50Ms}</td><td>${r.p95Ms}</td></tr>`;
    })
    .join('\n');
  const buildC06Body = (exemplarLimit: number | null): string => {
    const bestSlice = exemplarLimit === null ? [] : prod.exemplars.bestQuestions.slice(0, exemplarLimit);
    const worstSlice = exemplarLimit === null ? [] : prod.exemplars.worstQuestions.slice(0, exemplarLimit);
    const exemplarSection =
      exemplarLimit === null
        ? `<p class="small"><em>[Exemplars omitted to stay within HTML size cap.]</em></p>`
        : `<p class="stat"><b>Best Questions (followedUp)</b></p>
  ${renderExemplarHtml(bestSlice, model.repo.remoteUrl)}
  <p class="stat"><b>Worst Questions (notFollowedUp)</b></p>
  ${renderExemplarHtml(worstSlice, model.repo.remoteUrl)}`;
    return `
  ${exemplarSection}
  <p class="stat"><b>Runtime per Stage</b> (Total wall: ${model.timings.totalWallMs} ms · windowDays: ${model.settings.windowDays} · prsLimit: ${model.settings.prsLimit} · calibrationEvery: ${model.settings.calibrationEvery})</p>
  <table class="bench-table">
    <thead><tr><th>Stage</th><th>Count</th><th>Total (ms)</th><th>p50 (ms)</th><th>p95 (ms)</th></tr></thead>
    <tbody>${stageRows}</tbody>
  </table>
  <p class="small">Methodology limits: first-parent commits approximate PRs; follow-ups are observational outcomes within ${model.settings.windowDays} day(s), not ground-truth defects; Gate A remains UNVERIFIED pending human review labels in GU-04.</p>`;
  };

  const assembleHtml = (c06Html: string): string => {
    const allPanels = [...panels, panel(6, 'Exemplars, Timings & Limits', c06Html, { area: 'exemplars' })];
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Gutter Bench · ${repoName}</title>
<style id="${TOKENS_ID}">${FRAME12_TOKENS}</style>
<style>${BENCH_PAGE_CSS}</style>
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
    <p class="wordmark">GUTTER<span class="slash">/</span><span class="kicker">replay benchmark</span></p>
    <p class="issue">${issue}</p>
  </header>
  <div class="page">
${allPanels.join('\n')}
  </div>
  <footer class="colophon">
    <p class="small">Deterministic replay benchmark: no future leakage, no AI. Gutter ${html(model.tools.gutter)} + Repo Archaeology ${html(model.tools.repoArchaeology)} · scoringVersion ${model.scoringVersion}.</p>
  </footer>
</article>
</main>
<script>${ON_TWOS_JS}</script>
</body>
</html>
`;
  };

  let out = assembleHtml(buildC06Body(5));
  for (let limit = 4; limit >= 0 && Buffer.byteLength(out, 'utf8') > maxBytes; limit--) {
    out = assembleHtml(buildC06Body(limit));
  }
  if (Buffer.byteLength(out, 'utf8') > maxBytes) {
    out = assembleHtml(buildC06Body(null));
  }
  return out;
}

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

const BENCH_PAGE_CSS = `
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
.page{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--f-gutter-scene)}
.panel{grid-column:span 12;position:relative;background:var(--f-panel);border:var(--f-stroke) solid var(--f-rule);padding:0 16px 16px;min-width:0}
.cap{display:inline-flex;align-items:center;margin:0 0 14px -16px;padding:5px 12px 5px 0;background:var(--f-ink);color:var(--f-sheet);font-family:var(--font-f-display);font-size:14px;font-weight:400;letter-spacing:.04em;text-transform:uppercase}
.cap .num{display:inline-block;min-width:28px;text-align:center;border-right:1px solid currentColor;padding:0 8px;margin-right:8px}
.cap.marker{background:var(--f-marker);color:var(--f-marker-ink)}
.hero{border-width:calc(var(--f-stroke) * 1.6)}
.balloon{position:relative;border:var(--f-stroke) solid var(--f-rule);border-radius:22px;padding:12px 16px;margin:4px 0 18px;background:var(--f-panel)}
.balloon.thought{border-style:dashed}
.said{margin:0;font-family:var(--font-f-display);font-size:18px;line-height:1.25;overflow-wrap:anywhere}
.aside{margin:8px 0 0;color:var(--f-ink-2);font-size:14px;overflow-wrap:anywhere}
.sha{font-family:var(--font-f-mono);font-size:12px}
.stat{margin:8px 0;font-family:var(--font-f-mono);font-size:13px}
.path{font-family:var(--font-f-mono);font-size:12px;padding:1px 5px;border:1px solid var(--f-rule);background:var(--f-panel);overflow-wrap:anywhere}
.path.dashed{border-style:dashed}
.stamp{font-family:var(--font-f-display);font-size:10px;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--f-rule);padding:0 5px;transform:rotate(-2deg);display:inline-block}
.small{font-size:12px;color:var(--f-ink-2);margin:4px 0 0}
.quiet-line{margin:0;color:var(--f-ink-2)}
.wires{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:var(--f-gutter-pair)}
.wire-row+.wire-row{border-top:1px solid var(--f-grid);padding-top:10px}
.evidence-line{margin:4px 0;font-family:var(--font-f-mono);font-size:13px}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--f-gutter-pair);margin:0 0 12px}
.metrics div{border:1.5px solid var(--f-rule);padding:6px 8px}
.metrics dt{font-family:var(--font-f-mono);font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--f-ink-2)}
.metrics dd{margin:0;font-family:var(--font-f-display);font-size:24px;line-height:1.1}
.bench-table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-family:var(--font-f-mono);font-size:12px}
.bench-table th,.bench-table td{border:1px solid var(--f-grid);padding:6px 8px;text-align:left;vertical-align:top}
.bench-table th{background:var(--f-sheet);font-family:var(--font-f-display);font-weight:400;letter-spacing:.04em;text-transform:uppercase}
.colophon{margin-top:var(--f-gutter-scene);border-top:var(--f-stroke) solid var(--f-rule);padding-top:var(--f-gutter-pair);display:grid;gap:var(--f-gutter-pair)}
@media (max-width:520px){.sheet{padding:var(--f-gutter-pair)}.wordmark{font-size:26px}}
@media print{.desk{padding:0}.sheet{box-shadow:none}}
`;
