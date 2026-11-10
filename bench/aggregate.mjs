#!/usr/bin/env node
// GU-30 aggregator: per-repository and corpus metrics, the preregistered Gate A′ verdict (CORPUS.md §5,
// applied mechanically), "Where Gutter did badly", and docs/benchmark/README.md + results.json.
//
//   node bench/aggregate.mjs [--data docs/benchmark/data] [--write]
//
// Zero dependencies; deterministic: README.md is rendered from results.json alone, so every number on the
// page comes from that file (test/gu30-aggregate.test.ts regenerates and compares).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { repoName, repoSlug, validateCorpus } from './corpus.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const KINDS = ['wide-surface', 'untested-change', 'broken-import', 'forgotten-companion', 'family-drift'];
export const GROUPS = ['TS/JS', 'Go', 'Python'];
export const groupOf = (lang) => (lang === 'go' ? 'Go' : lang === 'python' ? 'Python' : 'TS/JS');
const MIN_COMPLETED = 15;
const MIN_GROUP_POSITIVES = 10;

/** 95% Wilson score interval (same as src/stats/wilson.ts). */
export function wilson(k, n, z = 1.959963984540054) {
  if (!n) return null;
  const p = k / n;
  const z2 = z * z;
  const d = 1 + z2 / n;
  const c = p + z2 / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { low: Math.max(0, (c - m) / d), high: Math.min(1, (c + m) / d) };
}
const prop = (k, n) => ({ numerator: k, denominator: n, rate: n ? k / n : null, interval: wilson(k, n) });

/** Median of numbers (mean of the two middle values for an even count); null when empty. */
export function median(xs) {
  const a = xs.filter((x) => typeof x === 'number').sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// ---- Per repository -------------------------------------------------------------------------

function loudness(bench) {
  const prs = bench?.prs ?? [];
  const n = prs.length;
  const level = (l) => prs.filter((p) => p.policies.production.salience === l).length;
  const items = prs.reduce((s, p) => s + p.policies.production.questions.length, 0);
  const byKind = Object.fromEntries(KINDS.map((k) => [k, prop(prs.filter((p) => p.policies.production.questions.some((q) => q.kind === k)).length, n)]));
  return { evaluated: n, quiet: prop(level('quiet'), n), brief: prop(level('brief'), n), full: prop(level('full'), n), itemsPerPr: n ? items / n : null, items, byKind };
}

function coverage(bench) {
  const prs = (bench?.prs ?? []).filter((p) => p.coverage);
  const unresolvedByReason = {};
  const uncheckedLanguages = {};
  for (const p of prs) {
    for (const [k, v] of Object.entries(p.unresolvedByReason ?? {})) unresolvedByReason[k] = (unresolvedByReason[k] ?? 0) + v;
    for (const l of p.uncheckedLanguages ?? []) uncheckedLanguages[l] = (uncheckedLanguages[l] ?? 0) + 1;
  }
  return { partial: prop(prs.filter((p) => p.coverage === 'partial').length, prs.length), unresolvedByReason, uncheckedLanguages };
}

function runtime(bench) {
  const st = bench?.timings?.stages ?? {};
  const sum = (k) => ['sessionOpen', 'staticAnalysis', 'brief'].reduce((s, x) => (st[x] ? s + st[x][k] : s), 0);
  return st.sessionOpen ? { replayP50Ms: Math.round(sum('p50Ms')), replayP95Ms: Math.round(sum('p95Ms')), sessionP50Ms: Math.round(st.sessionOpen.p50Ms), sessionP95Ms: Math.round(st.sessionOpen.p95Ms) } : null;
}

function truth(gate) {
  if (!gate) return null;
  const f = (x) => ({ checked: x.checked, confirmed: x.confirmed, rate: x.checked ? x.confirmed / x.checked : null });
  return { brokenImport: f(gate.b.brokenImport), untestedChange: f(gate.b.untestedChange), testHistory: f(gate.b.testHistory), wordingHits: gate.c.ownWordingHits.length, replayParity: gate.replayParity };
}

function seeded(summary, records, language) {
  if (!summary) return null;
  const classes = {};
  const add = (k) => (classes[k] = (classes[k] ?? 0) + 1);
  const g = groupOf(language);
  for (const r of records ?? []) {
    if (r.positive && !r.detected) add(`missed positive: ${g}, ${r.kind}, ${r.missReason ?? 'missed'}`);
    if (!r.positive && r.reported.length) add(`false positive: ${g}, ${r.kind}`);
    for (const it of r.reported) if (!it.confirmed) add(`unconfirmed item: ${g}`);
  }
  return {
    positives: summary.positives,
    negatives: summary.negatives,
    reported: summary.reportedItems,
    confirmed: summary.confirmedItems,
    precision: summary.precision,
    detected: summary.detected,
    recall: summary.recall,
    falsePositives: summary.falsePositives,
    falsePositiveRate: summary.falsePositiveRate,
    skipped: summary.skippedUncheckedOrPartial,
    skippedShare: summary.skippedShare,
    missReasons: summary.missReasons,
    errors: summary.errors ?? 0,
    shortfalls: (summary.meta ?? []).reduce((acc, m) => {
      for (const [k, v] of Object.entries(m.shortfalls ?? {})) acc[k] = (acc[k] ?? 0) + v;
      return acc;
    }, {}),
    classes,
  };
}

function backtests(bt, btOrigin) {
  const co = (doc) => doc?.strategies?.find((s) => s.name === 'co-change');
  const pop = (doc) => doc?.strategies?.find((s) => s.name === 'popularity, same changes');
  const one = (doc) => {
    const c = co(doc);
    if (!c) return null;
    const p = pop(doc);
    return { testCommits: doc.test?.commits ?? null, fired: c.fired, precision: c.precision, hitRate: c.hitRate, lift: p && p.hitRate > 0 ? c.hitRate / p.hitRate : null };
  };
  return { plain: one(bt), originWeighted: btOrigin ? { ...one(btOrigin), comparison: btOrigin.originComparison ?? btOrigin.compareOriginWeights ?? null } : null };
}

/** One repository's row from its loaded files (any of them may be missing). */
export function repoRow({ repo, status, bench, gate, seededSummary, seededRecords, backtest, backtestOrigin }) {
  const completed = Boolean(status?.completed);
  return {
    repo: repoName(repo.url),
    slug: repoSlug(repo.url),
    language: repo.language,
    group: groupOf(repo.language),
    category: repo.category,
    expected: repo.expected,
    pinnedSha: repo.pinnedSha,
    completed,
    failure: completed ? null : (status?.failure ?? 'not run'),
    note: status?.steps?.bench?.note ?? null,
    wallMin: status?.wallMs ? Math.round(status.wallMs / 6000) / 10 : null,
    loudness: bench ? loudness(bench) : null,
    coverage: bench ? coverage(bench) : null,
    runtime: runtime(bench),
    truth: truth(gate),
    seeded: seeded(seededSummary, seededRecords, repo.language),
    backtests: backtests(backtest, backtestOrigin),
  };
}

// ---- Corpus, verdict ------------------------------------------------------------------------

/** The preregistered rule (CORPUS.md §5): INCONCLUSIVE → PASS → FAIL. */
export function verdict(rows) {
  const done = rows.filter((r) => r.completed);
  const missing = [];
  const groups = Object.fromEntries(GROUPS.map((g) => {
    const pos = done.filter((r) => r.group === g).reduce((s, r) => s + (r.seeded?.positives ?? 0), 0);
    return [g, { positives: pos, computable: pos >= MIN_GROUP_POSITIVES }];
  }));
  const notComputable = GROUPS.filter((g) => !groups[g].computable);
  if (done.length < MIN_COMPLETED) missing.push(`${done.length} of ${rows.length} repositories completed (needs ${MIN_COMPLETED})`);
  if (notComputable.length >= 3) missing.push(`(b) cannot be computed for ${notComputable.join(', ')} (fewer than ${MIN_GROUP_POSITIVES} seeded positives each)`);

  const medianFull = median(done.map((r) => r.loudness?.full.rate));
  const a = { medianFullShare: medianFull, met: medianFull !== null && medianFull <= 1 / 3 };

  const realItems = done.reduce((s, r) => s + (r.truth?.brokenImport.checked ?? 0), 0);
  const realConfirmed = done.reduce((s, r) => s + (r.truth?.brokenImport.confirmed ?? 0), 0);
  const reported = done.reduce((s, r) => s + (r.seeded?.reported ?? 0), 0);
  const confirmed = done.reduce((s, r) => s + (r.seeded?.confirmed ?? 0), 0);
  const positives = done.reduce((s, r) => s + (r.seeded?.positives ?? 0), 0);
  const detected = done.reduce((s, r) => s + (r.seeded?.detected ?? 0), 0);
  const negatives = done.reduce((s, r) => s + (r.seeded?.negatives ?? 0), 0);
  const fps = done.reduce((s, r) => s + (r.seeded?.falsePositives ?? 0), 0);
  const pooled = { precision: prop(confirmed, reported), recall: prop(detected, positives), falsePositiveRate: prop(fps, negatives) };
  const lowRepos = done.filter((r) => r.seeded?.precision !== null && r.seeded?.precision !== undefined && r.seeded.precision < 0.85).map((r) => r.repo);
  const facts = (k) => {
    const exercised = done.filter((r) => (r.truth?.[k].checked ?? 0) > 0);
    const wrong = exercised.filter((r) => r.truth[k].confirmed < r.truth[k].checked).map((r) => r.repo);
    return { exercised: exercised.length, notExercised: done.length - exercised.length, wrong, met: exercised.length === 0 ? null : wrong.length === 0 };
  };
  const untested = facts('untestedChange');
  const history = facts('testHistory');
  const useReal = realItems >= 20;
  const seededMet = pooled.precision.rate !== null && pooled.precision.rate >= 0.95 && pooled.recall.rate !== null && pooled.recall.rate >= 0.9 && lowRepos.length === 0;
  const brokenMet = useReal ? realConfirmed / realItems >= 0.95 : seededMet;
  // "100% correct in every repo": a clause with no facts anywhere is not exercised, never met.
  const factsMet = untested.met !== false && history.met !== false && (untested.met === true || history.met === true);
  const b = {
    basis: useReal ? 'real PRs' : 'seeded mutations',
    realItems,
    realConfirmed,
    pooled,
    reposBelowPrecision: lowRepos,
    untestedChange: untested,
    testHistory: history,
    met: brokenMet && factsMet,
    groups,
  };
  const wordingHits = done.reduce((s, r) => s + (r.truth?.wordingHits ?? 0), 0);
  const c = { hits: wordingHits, met: wordingHits === 0 };

  let result;
  if (missing.length) result = 'INCONCLUSIVE';
  else if (a.met && b.met && c.met) result = 'PASS';
  else result = 'FAIL';

  // Failure classes (CORPUS.md §5), ranked by count, ties by name.
  const classes = {};
  const add = (k, n = 1) => (classes[k] = (classes[k] ?? 0) + n);
  for (const r of done) {
    for (const [k, n] of Object.entries(r.seeded?.classes ?? {})) add(k, n);
    if ((r.loudness?.full.rate ?? 0) > 1 / 3) add(`loud: ${r.category}`);
    if (r.truth?.wordingHits) add('wording', r.truth.wordingHits);
    if (r.truth) for (const k of ['untestedChange', 'testHistory']) if (r.truth[k].confirmed < r.truth[k].checked) add(`fact: ${k}`, r.truth[k].checked - r.truth[k].confirmed);
    if (r.truth && r.truth.brokenImport.confirmed < r.truth.brokenImport.checked) add(`unconfirmed real item: ${r.group}`, r.truth.brokenImport.checked - r.truth.brokenImport.confirmed);
  }
  const failureClasses = Object.entries(classes).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([cls, count]) => ({ class: cls, count }));
  return { result, missing, completed: done.length, total: rows.length, a, b, c, failureClasses };
}

const worst = (rows, value, dir, n = 5) =>
  rows
    .filter((r) => r.completed && typeof value(r) === 'number')
    .sort((x, y) => (dir === 'high' ? value(y) - value(x) : value(x) - value(y)) || x.repo.localeCompare(y.repo))
    .slice(0, n)
    .map((r) => r.repo);

export function aggregate({ corpus, inputs, run }) {
  const rows = corpus.repos.map((repo) => repoRow({ repo, ...(inputs[repoSlug(repo.url)] ?? {}) }));
  const v = verdict(rows);
  const done = rows.filter((r) => r.completed);
  const byGroup = Object.fromEntries(GROUPS.map((g) => {
    const rs = done.filter((r) => r.group === g);
    const sum = (f) => rs.reduce((s, r) => s + (f(r) ?? 0), 0);
    const reasons = {};
    for (const r of rs) for (const [k, n] of Object.entries(r.coverage?.unresolvedByReason ?? {})) reasons[k] = (reasons[k] ?? 0) + n;
    return [g, {
      repos: rs.length,
      partial: prop(sum((r) => r.coverage?.partial.numerator), sum((r) => r.coverage?.partial.denominator)),
      unresolvedByReason: reasons,
      seededRecall: prop(sum((r) => r.seeded?.detected), sum((r) => r.seeded?.positives)),
      seededPrecision: prop(sum((r) => r.seeded?.confirmed), sum((r) => r.seeded?.reported)),
    }];
  }));
  return {
    schemaVersion: 1,
    kind: 'gutter-corpus-results',
    environment: run?.environment ?? null,
    timeoutMin: run?.timeoutMin ?? null,
    verdict: v,
    median: {
      fullShare: median(done.map((r) => r.loudness?.full.rate)),
      briefShare: median(done.map((r) => r.loudness?.brief.rate)),
      quietShare: median(done.map((r) => r.loudness?.quiet.rate)),
      itemsPerPr: median(done.map((r) => r.loudness?.itemsPerPr)),
      wideSurfaceShare: median(done.map((r) => r.loudness?.byKind['wide-surface'].rate)),
      partialShare: median(done.map((r) => r.coverage?.partial.rate)),
      seededRecall: median(done.map((r) => r.seeded?.recall)),
      replayP50Ms: median(done.map((r) => r.runtime?.replayP50Ms)),
      replayP95Ms: median(done.map((r) => r.runtime?.replayP95Ms)),
    },
    byGroup,
    worst: {
      fullShare: worst(rows, (r) => r.loudness?.full.rate, 'high'),
      wideSurfaceShare: worst(rows, (r) => r.loudness?.byKind['wide-surface'].rate, 'high'),
      seededRecall: worst(rows, (r) => r.seeded?.recall, 'low'),
      seededPrecision: worst(rows, (r) => r.seeded?.precision, 'low'),
      falsePositiveRate: worst(rows, (r) => r.seeded?.falsePositiveRate, 'high'),
      partialShare: worst(rows, (r) => r.coverage?.partial.rate, 'high'),
      replayP95Ms: worst(rows, (r) => r.runtime?.replayP95Ms, 'high'),
    },
    repos: rows,
  };
}

// ---- Rendering ------------------------------------------------------------------------------

const f2 = (x) => (x === null || x === undefined ? 'n/a' : x.toFixed(2));
const p = (m) => (!m || !m.denominator ? 'n/a' : `${f2(m.rate)} (${m.numerator}/${m.denominator})`);
const pi = (m) => (!m || !m.denominator ? 'n/a' : `${f2(m.rate)} [${f2(m.interval.low)}–${f2(m.interval.high)}] (${m.numerator}/${m.denominator})`);
const frac = (x) => (!x || !x.checked ? 'not exercised' : `${x.confirmed}/${x.checked}`);
const met = (m) => (m === null ? 'not exercised' : m ? '**met**' : '**not met**');
const obj = (o) => (o && Object.keys(o).length ? Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k} ${v}`).join(', ') : '—');

function reasonFor(criterion, r) {
  switch (criterion) {
    case 'fullShare':
      return `full on ${p(r.loudness?.full)} of PRs; broken-import on ${p(r.loudness?.byKind['broken-import'])}`;
    case 'wideSurfaceShare':
      return `wide-surface on ${p(r.loudness?.byKind['wide-surface'])} of PRs`;
    case 'seededRecall':
      return `${r.seeded?.detected}/${r.seeded?.positives} detected; not detected by reason: ${obj(r.seeded?.missReasons && Object.fromEntries(Object.entries(r.seeded.missReasons).filter(([, v]) => v)))}`;
    case 'seededPrecision':
      return `${r.seeded?.confirmed}/${r.seeded?.reported} reported items confirmed`;
    case 'falsePositiveRate':
      return `${r.seeded?.falsePositives}/${r.seeded?.negatives} negative controls reported`;
    case 'partialShare':
      return `partial on ${p(r.coverage?.partial)} of PRs; unresolved by reason: ${obj(r.coverage?.unresolvedByReason)}`;
    case 'replayP95Ms':
      return `replay p95 ≈ ${r.runtime?.replayP95Ms} ms (session p95 ${r.runtime?.sessionP95Ms} ms)`;
    default:
      return '';
  }
}

export function renderReadme(res) {
  const v = res.verdict;
  const L = [];
  L.push('# Gutter benchmark: Gate A′ on a 20-repository corpus', '');
  L.push('<!-- generated by bench/aggregate.mjs from docs/benchmark/results.json; do not edit by hand -->', '');
  L.push(`Preregistered in [\`CORPUS.md\`](CORPUS.md) (§1–§5 fixed before any run). Gate A′ is M0's exit test ([\`ROADMAP.md\`](../ROADMAP.md)): is Gutter quiet, true and non-predictive on the median repository? How to rerun: [\`REPRODUCE.md\`](REPRODUCE.md). Raw data: \`docs/benchmark/data/<owner>__<repo>/corpus/\`.`, '');
  L.push(`## Verdict (mechanical, CORPUS.md §5): **${v.result}**`, '');
  if (v.missing.length) L.push(...v.missing.map((m) => `- Missing: ${m}.`), '');
  L.push(`- Completed repositories: ${v.completed} of ${v.total}.`);
  L.push(`- (a) Median repository's full share: ${f2(v.a.medianFullShare)} (needs ≤ 0.33): ${met(v.a.met)}.`);
  L.push(`- (b) Basis: ${v.b.basis} (real-PR \`broken-import\` items: ${v.b.realItems}, of which ${v.b.realConfirmed} confirmed; the seeded check applies below 20). Seeded pooled precision ${pi(v.b.pooled.precision)} (needs ≥ 0.95), recall ${pi(v.b.pooled.recall)} (needs ≥ 0.90), false-positive rate ${pi(v.b.pooled.falsePositiveRate)}; repositories below 0.85 precision: ${v.b.reposBelowPrecision.length ? v.b.reposBelowPrecision.map((x) => `\`${x}\``).join(', ') : 'none'}. \`untested-change\` facts: ${v.b.untestedChange.met === null ? 'not exercised' : v.b.untestedChange.met ? `100% in all ${v.b.untestedChange.exercised} repositories that had any` : `wrong in ${v.b.untestedChange.wrong.join(', ')}`}; test-history facts: ${v.b.testHistory.met === null ? 'not exercised' : v.b.testHistory.met ? `100% in all ${v.b.testHistory.exercised} repositories that had any` : `wrong in ${v.b.testHistory.wrong.join(', ')}`}. (b): ${met(v.b.met)}.`);
  L.push(`- (c) Banned-word hits in Gutter's own text: ${v.c.hits}: ${met(v.c.met)}.`);
  L.push(`- (b) per language group: ${GROUPS.map((g) => `${g} ${v.b.groups[g].positives} seeded positives (${v.b.groups[g].computable ? 'computable' : 'not computable'})`).join('; ')}.`, '');
  if (v.result === 'FAIL') {
    L.push('**Top failure classes** (by count):', '');
    L.push('| # | Failure class | Count |', '|---:|---|---:|');
    v.failureClasses.slice(0, 3).forEach((x, i) => L.push(`| ${i + 1} | ${x.class} | ${x.count} |`));
    L.push('');
  }
  L.push('## Corpus summary', '');
  L.push('| Measure | Median repository |', '|---|---|');
  const m = res.median;
  L.push(`| Quiet / brief / full share | ${f2(m.quietShare)} / ${f2(m.briefShare)} / ${f2(m.fullShare)} |`);
  L.push(`| Checklist items per PR | ${f2(m.itemsPerPr)} |`);
  L.push(`| PRs with \`wide-surface\` | ${f2(m.wideSurfaceShare)} |`);
  L.push(`| PRs with \`coverage: partial\` | ${f2(m.partialShare)} |`);
  L.push(`| Seeded recall | ${f2(m.seededRecall)} |`);
  L.push(`| Replay time per PR, p50 / p95 (ms, sum of stage percentiles) | ${m.replayP50Ms ?? 'n/a'} / ${m.replayP95Ms ?? 'n/a'} |`, '');
  L.push('**By language group** (completed repositories):', '');
  L.push('| Group | Repos | PRs with `coverage: partial` | Unresolved imports by reason | Seeded recall | Seeded precision |', '|---|---:|---|---|---|---|');
  for (const g of GROUPS) {
    const b = res.byGroup[g];
    L.push(`| ${g} | ${b.repos} | ${pi(b.partial)} | ${obj(b.unresolvedByReason)} | ${pi(b.seededRecall)} | ${pi(b.seededPrecision)} |`);
  }
  L.push('', '## Per repository', '');
  L.push('### Loudness and truth', '');
  L.push('| Repository | Group | Status | PRs | Quiet | Brief | Full | Items/PR | `wide-surface` PRs | Real `broken-import` | `untested-change` | Test history | Wording hits |', '|---|---|---|---:|---|---|---|---:|---|---|---|---|---:|');
  for (const r of res.repos) {
    const lo = r.loudness;
    L.push(`| \`${r.repo}\` | ${r.group} | ${r.completed ? 'completed' : r.failure}${r.note ? ` (${r.note})` : ''} | ${lo?.evaluated ?? '—'} | ${p(lo?.quiet)} | ${p(lo?.brief)} | ${p(lo?.full)} | ${f2(lo?.itemsPerPr)} | ${p(lo?.byKind['wide-surface'])} | ${frac(r.truth?.brokenImport)} | ${frac(r.truth?.untestedChange)} | ${frac(r.truth?.testHistory)} | ${r.truth ? r.truth.wordingHits : '—'} |`);
  }
  L.push('', '### Seeded `broken-import` mutations', '');
  L.push('| Repository | Positives | Detected (recall) | Skipped (`unchecked`/`partial`) | Reported items confirmed (precision) | Negative controls with a report (FP rate) | Shortfalls |', '|---|---:|---|---|---|---|---|');
  for (const r of res.repos) {
    const s = r.seeded;
    if (!s) {
      L.push(`| \`${r.repo}\` | — | — | — | — | — | ${r.completed ? '—' : r.failure} |`);
      continue;
    }
    L.push(`| \`${r.repo}\` | ${s.positives} | ${s.detected} (${f2(s.recall)}) | ${s.skipped} (${f2(s.skippedShare)}) | ${s.confirmed}/${s.reported} (${f2(s.precision)}) | ${s.falsePositives}/${s.negatives} (${f2(s.falsePositiveRate)}) | ${obj(s.shortfalls)} |`);
  }
  L.push('', '### Coverage, runtime, backtests (reported, never decisive)', '');
  L.push('| Repository | `coverage: partial` PRs | Unresolved by reason | Unchecked languages (PRs) | Replay p50 / p95 ms | Wall (min) | Backtest hit rate · lift | Origin-weighted (bot 0, agent 0.5) hit rate · lift |', '|---|---|---|---|---|---:|---|---|');
  for (const r of res.repos) {
    const bt = r.backtests?.plain;
    const bo = r.backtests?.originWeighted;
    L.push(`| \`${r.repo}\` | ${p(r.coverage?.partial)} | ${obj(r.coverage?.unresolvedByReason)} | ${obj(r.coverage?.uncheckedLanguages)} | ${r.runtime ? `${r.runtime.replayP50Ms} / ${r.runtime.replayP95Ms}` : '—'} | ${r.wallMin ?? '—'} | ${bt ? `${f2(bt.hitRate)} · ×${f2(bt.lift)}` : '—'} | ${bo && bo.hitRate !== undefined ? `${f2(bo.hitRate)} · ×${f2(bo.lift)}` : '—'} |`);
  }
  L.push('', '## Where Gutter did badly', '');
  L.push('Worst five completed repositories on each criterion, with the reason the data gives.', '');
  const titles = {
    fullShare: 'Highest full share',
    wideSurfaceShare: 'Most `wide-surface` (the main brief driver)',
    seededRecall: 'Lowest seeded recall',
    seededPrecision: 'Lowest seeded precision (repositories with ≥ 1 reported item)',
    falsePositiveRate: 'Highest seeded false-positive rate',
    partialShare: 'Most `coverage: partial` PRs',
    replayP95Ms: 'Slowest replay (p95)',
  };
  for (const [k, title] of Object.entries(titles)) {
    L.push(`**${title}**`, '');
    const names = res.worst[k];
    if (!names.length) {
      L.push('- No completed repository has a value.', '');
      continue;
    }
    for (const name of names) L.push(`- \`${name}\`: ${reasonFor(k, res.repos.find((r) => r.repo === name))}.`);
    L.push('');
  }
  const failed = res.repos.filter((r) => !r.completed);
  L.push('**Repositories that did not complete**', '');
  L.push(...(failed.length ? failed.map((r) => `- \`${r.repo}\`: ${r.failure}.`) : ['- None.']), '');
  if (res.environment) {
    const e = res.environment;
    L.push('## Environment', '');
    L.push(`gutter ${e.gutter}, repo-archaeology ${e.repoArchaeology}, TypeScript ${e.typescript}, Node ${e.node}, git ${e.git}; ${e.machine.cpu}, ${e.machine.cores} cores, ${e.machine.memoryGb} GB, ${e.machine.platform} ${e.machine.arch}. Per-repository timeout ${res.timeoutMin} min.`, '');
  }
  return L.join('\n');
}

// ---- Files ----------------------------------------------------------------------------------

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined);
const readJsonl = (path) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : undefined);

export function loadInputs(dataDir, corpus) {
  const inputs = {};
  for (const repo of corpus.repos) {
    const slug = repoSlug(repo.url);
    const d = join(dataDir, slug, 'corpus');
    inputs[slug] = {
      status: readJson(join(d, 'status.json')),
      bench: readJson(join(d, 'bench', 'bench.json')),
      gate: readJson(join(d, 'gate-a-prime.json')),
      seededSummary: readJson(join(d, 'seeded', 'seeded-summary.json')),
      seededRecords: readJsonl(join(d, 'seeded', 'seeded.jsonl')),
      backtest: readJson(join(d, 'backtest.json')),
      backtestOrigin: readJson(join(d, 'backtest-origin.json')),
    };
  }
  return inputs;
}

function main() {
  const { values } = parseArgs({ options: { data: { type: 'string', default: join(ROOT, 'docs', 'benchmark', 'data') }, write: { type: 'boolean', default: false } } });
  const corpus = JSON.parse(readFileSync(join(ROOT, 'bench', 'corpus.json'), 'utf8'));
  const problems = validateCorpus(corpus);
  if (problems.length) throw new Error(problems.join('; '));
  const res = aggregate({ corpus, inputs: loadInputs(values.data, corpus), run: readJson(join(values.data, 'corpus-run.json')) });
  const readme = renderReadme(res);
  if (values.write) {
    writeFileSync(join(ROOT, 'docs', 'benchmark', 'results.json'), JSON.stringify(res, null, 2) + '\n');
    writeFileSync(join(ROOT, 'docs', 'benchmark', 'README.md'), readme + '\n');
  } else process.stdout.write(readme + '\n');
  process.stderr.write(`gate A′: ${res.verdict.result} (${res.verdict.completed}/${res.verdict.total} completed)\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
