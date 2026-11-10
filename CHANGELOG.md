# Changelog

## Unreleased

- `GU-04` Stage 0 (hono go/no-go), preregistered in `docs/benchmark/STAGE0.md` before any run or label. Rule outcome: **STOP** (the lift condition fails before labeling); the corpus is not built and a human decides among the documented options.
- `gutter bench`: every baseline now also reports `raSignalFollowUpRate`, PR-clustered bootstrap intervals for each outcome (`bootstrapRateCi`), and `liftByOutcome`; `headlineBaseline.byOutcome` names the strongest baseline per outcome; the policy reports `bootstrapSameAuthorCi` / `bootstrapRaSignalCi`; PR records carry a capped `changedFiles` list. All additive and optional in `schema/bench.schema.json` (`schemaVersion` stays 1, existing numbers unchanged). `bench.md` and `bench.html` gain a lift-by-outcome table.
- `gutter label --compare <bench.json>`: blinded comparison labeling page (self-contained HTML, offline, `localStorage` progress, `labels.json` export with `source`). The per-question labeling mode is not built yet; it lands with the corpus if Stage 0 continues.
- `gutter bench --config <variant.json>` validates the variant through the `.gutter.json` parser and exits 2 on unknown or invalid keys (previously they were ignored silently).
- New opt-in `.gutter.json` keys `salienceFullMinSignals` and `salienceBreadthFull`; defaults reproduce the existing salience rule exactly.
- `bench/stage0-report.mjs` regenerates the Stage 0 results and decision from `results.json` and exported labels.
- Dev dependency `playwright` (exact `1.64.1`) for the labeling page's browser test; CI installs Chromium on the Ubuntu jobs only.

## 0.2.1 · 2026-11-09

- `gutter <command> --help` / `-h` (`brief`, `bench`, `render`) now prints usage and exits 0 instead of failing with `Unknown option '--help'`.
- README notes that the sample PR comment is a pinned example generated with gutter 0.1.0 + repo-archaeology 0.3.0.

## 0.2.0 · 2026-11-09

- `gutter bench` (`GU-03`): historical pull-request replay benchmark (`src/bench/*`), replaying merged PRs strictly as-of each PR via `replayBrief()` and `GitTreeReader(sha)` (`git ls-tree -r -z` + persistent `git cat-file --batch`) with zero future leakage and offline `repo-archaeology` ≥ 0.4.0 library sessions (`openRepository`).
- Two-policy observational scoring (`production` vs. `ungated` labeled `"research: not product behavior"`), first-parent rename/deletion/censoring outcome tracking, matched as-of baselines (`popular`, `popular-near`, `recent`), Wilson 95% intervals, seeded 1,000-resample PR-clustered bootstrap CIs, incremental `bench.partial.jsonl` checkpointing with `--resume`, and preregistered methodology in `docs/benchmark/METHOD.md`.
- Validated benchmark results contract (`schema/bench.schema.json`, `schemaVersion: 1`) and single-source `bench.md` and FRAME/12 `bench.html` report generators (`src/bench/validate.ts`, `src/bench/report-md.ts`, `src/bench/report-html.ts`).
- `.gutter.json` repository configuration support (`maxForgotten`, `maxChecklist`, `maxCompanionQuestions`, `minIntervalLow`, `minCalibratedPrecision`, `minChurnForTestQuestion`, `wideSurfaceImporters`, `noHistory`, `noCalibration`) with `CLI flags / Action inputs > .gutter.json > defaults` precedence; the GitHub Action reads `.gutter.json` from the `base` commit tree (`configRef: base`) so untrusted PR heads cannot silence Gutter on themselves.
- Updated default `repo-archaeology` version range in the CLI and GitHub Action (`archaeology-version`) from `^0.3.0` to `^0.4.0`, and aligned `.repo-archaeology.json` snapshot validation with the full `repo-archaeology` `0.4.0` contract (`halfLifeDays`, `origin`, `owners`, `skipCommits` regex, `style`, `cache`).
- Cross-repository coupling research (`GU-27`, `research/multi-repo/`): preregistered go/no-go experiment and generated report (`research/multi-repo/REPORT.md`) evaluating commit-timing co-change across repository pairs (`NO-GO` on commit-timing correlation; static contract/schema diffs deferred).

## 0.1.0 · 2026-11-08

- `gutter brief`: diff structure, TS/JS static dependents (including broken imports from deletes and renames, plus `dependents.coverage: 'full' | 'partial'` and `dependents.unresolved: { count, samples }` for alias and workspace-package specifiers), test links, Repo Archaeology co-change with Wilson intervals and bot-evidence flags, per-repo calibration, deterministic reviewer checklist, salience.
- `gutter.json` v1 contract and JSON Schema (forward-compatible consumer guidance; legacy `dependents.unresolvedAliases` payloads are normalized into `dependents.unresolved`).
- Renderers: compact Markdown PR comment, FRAME/12 comic page with `C-01`…`C-06` panel cuts and 6-rule design-grammar lint (`color-literal`, `gradient`, `font-literal`, `marker-misuse`, `illegal-gutter`, `cut-order`).
- GitHub Action: sticky comment, job summary, artifact upload, fork-safe.
