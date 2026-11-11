#!/usr/bin/env node
// GU-32 report (DECISIONS #21): docs/benchmark/COVERAGE.md and docs/benchmark/results-gu32.json, from
// docs/benchmark/data/<owner>__<repo>/gu32/{coverage.json,seeded-compare.json} (written by bench/gu32-run.mjs).
//
//   node bench/gu32-report.mjs            # print the Markdown
//   node bench/gu32-report.mjs --write    # write COVERAGE.md and results-gu32.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoName, repoSlug } from './corpus.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Per-repository rows and the corpus-level summary, from the committed data. */
export function gu32Results(dataRoot = join(ROOT, 'docs', 'benchmark', 'data'), corpus = readJson(join(ROOT, 'bench', 'corpus.json'))) {
  const repos = [];
  for (const r of corpus.repos) {
    const dir = join(dataRoot, repoSlug(r.url), 'gu32');
    if (!existsSync(join(dir, 'coverage.json'))) {
      repos.push({ repo: repoName(r.url), language: r.language, missing: true });
      continue;
    }
    const cov = readJson(join(dir, 'coverage.json'));
    const sc = existsSync(join(dir, 'seeded-compare.json')) ? readJson(join(dir, 'seeded-compare.json')) : undefined;
    repos.push({
      repo: repoName(r.url),
      language: r.language,
      measured: cov.measured ?? null,
      prs: cov.summary.prs,
      partialBefore: cov.summary.partialBefore,
      partialAfter: cov.summary.partialAfter,
      shareBefore: cov.summary.shareBefore,
      shareAfter: cov.summary.shareAfter,
      unresolvedTotal: cov.summary.unresolvedTotal,
      relevantTotal: cov.summary.relevantTotal,
      unresolvedByReason: cov.summary.unresolvedByReason,
      relevantByReason: cov.summary.relevantByReason,
      entriesPartial: cov.summary.entriesPartial,
      entries: cov.summary.entries,
      gu31: cov.gu31
        ? {
            compared: cov.gu31.compared,
            missing: cov.gu31.missing.length,
            salienceMismatches: cov.gu31.salienceMismatches.length,
            checklistKindMismatches: cov.gu31.checklistKindMismatches.length,
            beforeMismatches: cov.gu31.beforeMismatches.length,
          }
        : null,
      seeded: sc
        ? {
            compared: sc.records.compared,
            missing: sc.records.missing.length,
            summaryMismatches: sc.summaryMismatches,
            scoreMismatches: sc.records.scoreMismatches.length,
            missReasonMoves: sc.records.missReasonMoves,
            otherMissReasonChanges: sc.records.otherMissReasonChanges.length,
            baseline: sc.baseline ? { commit: sc.baseline.commit, compared: sc.baseline.records.compared, scoreMismatches: sc.baseline.records.scoreMismatches.length, summaryMismatches: sc.baseline.summaryMismatches } : null,
          }
        : null,
    });
  }
  const done = repos.filter((r) => !r.missing);
  const sum = (f) => done.reduce((s, r) => s + f(r), 0);
  const addAll = (key) => done.reduce((acc, r) => {
    for (const [k, v] of Object.entries(r[key])) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});
  const moves = done.reduce((acc, r) => {
    for (const [k, v] of Object.entries(r.seeded?.missReasonMoves ?? {})) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});
  const measured = [...new Set(done.map((r) => JSON.stringify(r.measured)))].map((m) => JSON.parse(m));
  return {
    schemaVersion: 1,
    kind: 'gutter-gu32-results',
    repos,
    summary: {
      /** Every distinct (Gutter commit, Repo Archaeology version) the repositories were measured with. */
      measured,
      repos: done.length,
      missing: repos.length - done.length,
      prs: sum((r) => r.prs),
      medianShareBefore: median(done.map((r) => r.shareBefore)),
      medianShareAfter: median(done.map((r) => r.shareAfter)),
      reposAllPartialBefore: done.filter((r) => r.prs > 0 && r.partialBefore === r.prs).length,
      reposAllPartialAfter: done.filter((r) => r.prs > 0 && r.partialAfter === r.prs).length,
      unresolvedTotal: sum((r) => r.unresolvedTotal),
      relevantTotal: sum((r) => r.relevantTotal),
      unresolvedByReason: addAll('unresolvedByReason'),
      relevantByReason: addAll('relevantByReason'),
      gu31: {
        compared: sum((r) => r.gu31?.compared ?? 0),
        missing: sum((r) => r.gu31?.missing ?? 0),
        salienceMismatches: sum((r) => r.gu31?.salienceMismatches ?? 0),
        checklistKindMismatches: sum((r) => r.gu31?.checklistKindMismatches ?? 0),
        beforeMismatches: sum((r) => r.gu31?.beforeMismatches ?? 0),
      },
      seeded: {
        compared: sum((r) => r.seeded?.compared ?? 0),
        missing: sum((r) => r.seeded?.missing ?? 0),
        reposWithSummaryMismatches: done.filter((r) => r.seeded?.summaryMismatches.length).map((r) => r.repo),
        scoreMismatches: sum((r) => r.seeded?.scoreMismatches ?? 0),
        missReasonMoves: moves,
        otherMissReasonChanges: sum((r) => r.seeded?.otherMissReasonChanges ?? 0),
        /** Repositories that differ from Rerun 1, rescored with the base code (main without GU-32). */
        baseline: done.filter((r) => r.seeded?.baseline).map((r) => ({ repo: r.repo, ...r.seeded.baseline })),
      },
    },
  };
}

const pct = (x) => (x === null || x === undefined ? '—' : x.toFixed(2));
const reasons = (o) => {
  const e = Object.entries(o ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return e.length ? e.map(([k, v]) => `${k} ${v}`).join(', ') : '—';
};

export function renderCoverageMd(res) {
  const s = res.summary;
  const L = [];
  L.push('# `coverage: partial`, scoped to the PR\'s files (GU-32)', '');
  L.push('<!-- Generated by `node bench/gu32-report.mjs --write` from `docs/benchmark/data/*/gu32/`. Do not edit by hand. -->', '');
  L.push('A measurement, not a gate: no verdict depends on it, so nothing here was preregistered. The rule is in [DECISIONS #21](../DECISIONS.md#21-coverage-partial-means-an-import-that-could-reach-this-prs-files-is-unresolved-gu-32); how to rerun it is at the end.', '');
  const m = s.measured.filter(Boolean);
  const measuredText = m.length ? m.map((x) => `Gutter \`${x.gutterCommit.slice(0, 7)}${x.gutterCommit.endsWith('+dirty') ? '+dirty' : ''}\` with Repo Archaeology ${x.repoArchaeology}`).join('; ') : 'an unrecorded Gutter commit';
  L.push(`Every real PR of GU-30's corpus (the same \`corpus/bench/bench.json\`, the same pins) was replayed once on the product path with the GU-32 code (${measuredText}). *Before* is the pre-GU-32 meaning, which the same brief still carries (\`unresolved.count > 0\`: any import in the repository is unresolved); *after* is \`dependents.coverage\` (an import that could reach the PR\'s changed or removed files is unresolved). Unresolved counts are summed over PRs: each PR\'s head counts its repository\'s unresolved imports.`, '');
  L.push('## Summary', '');
  L.push('| | Before | After |', '|---|---|---|');
  L.push(`| Median share of PRs \`partial\` (${s.repos} repositories) | ${pct(s.medianShareBefore)} | ${pct(s.medianShareAfter)} |`);
  L.push(`| Repositories where every PR is \`partial\` | ${s.reposAllPartialBefore} | ${s.reposAllPartialAfter} |`);
  L.push(`| Unresolved imports counted (summed over ${s.prs} PRs) | ${s.unresolvedTotal} (repository-wide) | ${s.relevantTotal} (could reach the PR's files) |`);
  L.push('');
  L.push(`By reason, repository-wide: ${reasons(s.unresolvedByReason)}.`, '');
  L.push(`By reason, could reach the PR's files: ${reasons(s.relevantByReason)}.`, '');
  L.push('## Salience, checklist and seeded results', '');
  L.push(`- **Salience and checklist** (coverage never creates or suppresses an item): compared with GU-31's replays of the same ${s.gu31.compared} PRs (Rerun 1, \`rerun1/gate-a-prime.json\`), **${s.gu31.salienceMismatches}** salience and **${s.gu31.checklistKindMismatches}** checklist-kind mismatches${s.gu31.missing ? `; ${s.gu31.missing} PRs had no GU-31 replay` : ''}. "Before" equals GU-31's \`coverage\` on ${s.gu31.compared - s.gu31.beforeMismatches} of ${s.gu31.compared} PRs.`);
  const moves = Object.entries(s.seeded.missReasonMoves);
  L.push(`- **Seeded mutations** (Rerun 1's, same seed \`20261111\`, regenerated and rescored): ${s.seeded.compared} records compared${s.seeded.missing ? ` (${s.seeded.missing} missing)` : ''}; **${s.seeded.scoreMismatches}** differ in what was reported, confirmed or detected; repositories whose detection, precision or false positives changed: **${s.seeded.reposWithSummaryMismatches.length ? s.seeded.reposWithSummaryMismatches.join(', ') : 'none'}**. \`missReason\` labels moved: ${moves.length ? moves.map(([k, v]) => `${k.replace('→', ' → ')} ${v}`).join(', ') : 'none'}${s.seeded.otherMissReasonChanges ? ` (${s.seeded.otherMissReasonChanges} other than \`partial\` → \`missed\`)` : ''}.`);
  for (const b of s.seeded.baseline) {
    L.push(`  - \`${b.repo}\` differs from Rerun 1, so its mutations were rescored with the code GU-32 is based on (\`${b.commit.slice(0, 7)}\`, without GU-32): **${b.scoreMismatches}** of ${b.compared} records and **${b.summaryMismatches.length ? b.summaryMismatches.join(', ') : 'no'}** summary numbers differ from GU-32. The difference with Rerun 1 is the base code's, not GU-32's.`);
  }
  L.push('');
  L.push('## Per repository', '');
  L.push('| Repository | Lang | PRs | `partial` before | `partial` after | Unresolved, repository-wide (by reason) | Could reach the PR\'s files (by reason) | Entries `partial` | vs GU-31: salience · kinds | Seeded: score diffs · `missReason` moves |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of res.repos) {
    if (r.missing) {
      L.push(`| \`${r.repo}\` | ${r.language} | — | — | — | not run | — | — | — | — |`);
      continue;
    }
    const mv = Object.entries(r.seeded?.missReasonMoves ?? {});
    L.push(`| \`${r.repo}\` | ${r.language} | ${r.prs} | ${pct(r.shareBefore)} (${r.partialBefore}) | ${pct(r.shareAfter)} (${r.partialAfter}) | ${r.unresolvedTotal}: ${reasons(r.unresolvedByReason)} | ${r.relevantTotal}: ${reasons(r.relevantByReason)} | ${r.entriesPartial} of ${r.entries} | ${r.gu31 ? `${r.gu31.salienceMismatches} · ${r.gu31.checklistKindMismatches}` : '—'} | ${r.seeded ? `${r.seeded.scoreMismatches} · ${mv.length ? mv.map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}` : '—'} |`);
  }
  L.push('');
  L.push('## Reproduce', '');
  L.push('With the corpus clones in `$GUTTER_BENCH_CACHE` (see [`REPRODUCE.md`](REPRODUCE.md)) and Rerun 1\'s data in `docs/benchmark/data/*/rerun1/`:', '');
  L.push('```bash', 'node bench/gu32-run.mjs --jobs 2   # replays + seeded (seed 20261111) + comparisons; resumable', 'node bench/gu32-report.mjs --write', '```', '');
  return L.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = gu32Results();
  const md = renderCoverageMd(res);
  if (process.argv.includes('--write')) {
    writeFileSync(join(ROOT, 'docs', 'benchmark', 'results-gu32.json'), JSON.stringify(res, null, 2) + '\n');
    writeFileSync(join(ROOT, 'docs', 'benchmark', 'COVERAGE.md'), md);
  } else process.stdout.write(md);
}
