# Changelog

## Unreleased

## 0.3.0 · 2026-11-10

- **`GU-29` Explain, don't predict ([DECISIONS #17](docs/DECISIONS.md#17-explain-dont-predict-gu-29)).** Gutter's default output no longer predicts omissions. The checklist holds only facts (`broken-import`, `untested-change`, `wide-surface`); co-change history can neither add nor suppress an item. Decided by the agent on the maintainer's explicit delegation, after Stage 0 (STOP) and Stage 0b (INSUFFICIENT) on hono.
  - `untested-change` is a statement: "`src/x.ts` changed (+12/−3); its test file `src/x.test.ts` didn't change in this PR." Same gate, cap and priority; it is no longer hidden when a companion question asked about the same test.
  - New optional `TestLink.history` (`{ together, sourceCommits, evidence }`) puts test-pair history in the Tests panel ("unchanged in this PR · changed together with `src/x.ts` in 17 of 20 commits"), with distinct wording for history that is unavailable, too short, partial, or checked with no pairing. A co-change test partner the naming conventions missed becomes a candidate. It never changes the checklist or salience.
  - New optional `forgotten.presentation: "context"`. The comic's C-04 is now "Usually changes with" and never the hero (C-06 is, when it has items; otherwise C-03); the Markdown comment shows it as a collapsed `<details>` "Usually changes with (history, not a prediction)" on `full` and `brief` pages.
  - `salienceFullMinSignals` now defaults to `2`: a page is `full` with two broken imports, or one plus breadth; breadth alone is `brief`.
  - User-facing wording: no "forgot", "likely forgotten", "untested" or "not covered" in renderers, CLI output, the README or `action.yml` descriptions (a test enforces it on every fixture). The `forgotten` field, `ChecklistKind` values, the `max-forgotten` input and `forgotten-count` output keep their names.
  - Research switch `legacyPredictions: true` (`.gutter.json` / `--config`) reproduces pre-GU-29 `gutter.json` byte for byte (eleven fixture goldens) and Stage 0b's hono run record for record. `companionRequireGhost` and `companionMinTrackRecordFired` apply only under it.
  - hono re-measured (`docs/benchmark/data/honojs__hono/gu29/`): full share 0.40 → 0.00, quiet 0.41 → 0.60, checklist items per PR 0.81 → 0.33; `untested-change` on 10 PRs (was 7).
  - ROADMAP: Gate A′ replaces Gate A as M0's exit test (quiet enough, facts true, no predictions; checkable without labels); M1 adds accuracy on "what does this PR affect?" and ≤ 10% misleading items. hono: Gate A′ passes on what hono exercises; `broken-import` is unexercised (0 items).
  - `bench/gate-a-prime.ts` (Gate A′ checker, uses the `typescript` devDependency) and `bench/gu29-report.mjs`. The hono example grows from +10 to +14 lines so it is a `brief` page that shows the new rows.
  - Test rows: history counts describe the pair with the naming-convention test when it is a co-change partner (else the strongest pair, cited first in `history.evidence`), each row cites only its own pair's commits, and a different history partner is shown as its own clause, so the Tests row and the checklist always name the same file. A co-change partner the naming conventions missed is added to `candidates`, so `tests[].status` can read `test-untouched` where naming alone found no test (the checklist still comes from the naming-only links). An `untested-change` item's receipt is the test file it names. The HTML Tests panel carries the same legend as the comment.
  - The comment's "Usually changes with" summary counts pairs and parallel groups separately (`3 pairs · 1 parallel group`), matching the CLI summary and the Action's `forgotten-count`.
  - `maxCompanionQuestions`, `minIntervalLow`, `minCalibratedPrecision`, `companionRequireGhost` and `companionMinTrackRecordFired` only apply under `legacyPredictions`: the CLI and the Action warn when one is set without it, and `gutter bench --config` refuses such a variant. New `gutter bench --legacy-predictions` reruns Stage 0 / 0b; `bench/README.md`'s reproduce commands use it.
  - Gate A′'s wording check ignores repository paths and branch names (a file named `forgot-password.ts` is not Gutter's wording).
  - Rendering a brief without `TestLink.history` (a pre-0.3.0 `gutter.json`, or `legacyPredictions`) derives the test pairing from `forgotten.items`, so the Tests row never says "no co-change pairing" while the co-change panel lists one.
  - When `max-forgotten` hides every pair, the page and comment say "N pairs found, none listed" instead of claiming no file usually changes with these ones (this was also wrong before GU-29).

- `GU-28` Stage 0b (option 2, proven pairs), preregistered in `docs/benchmark/STAGE0.md` before the upgrade and any run. Verdict on hono: **INSUFFICIENT**. The V4 variant leaves no companion question, because only 2 of 90 are `ghost` pairs; with RA 0.10.0 the default run's headline numbers are unchanged from 0.4.0.
- `repo-archaeology` devDependency pinned to exactly `0.10.0` for the benchmark; the peer range stays `>=0.4.0`. Audit of 0.5.0–0.10.0: the only adapter change needed is accepting `skipReverts` (0.6.0) in `.repo-archaeology.json`, which Gutter's validator previously rejected, dropping the whole file during replay.
- Gutter reads Repo Archaeology's per-pair `trackRecord` (RA-06, ≥ 0.10.0) from `diff` JSON and validates its three shapes (`fired`, `never_fired`, `limited_history`). Bench question records carry it (additive, optional in `schema/bench.schema.json`); `gutter.json` does not.
- New opt-in `.gutter.json` keys `companionRequireGhost` and `companionMinTrackRecordFired` gate companion questions on the pair's relationship and track record. Defaults are unchanged (both off).
- `bench/stage0-report.mjs --stage0b` and `bench/stage0b-funnel.ts`; CI checks out full history so a test can verify each preregistration commit precedes its data.
- `GU-04` Stage 0 (hono go/no-go), preregistered in `docs/benchmark/STAGE0.md` before any run or label. Rule outcome: **STOP** (the lift condition fails before labeling); the corpus is not built and a human decides among the documented options.
- `gutter bench`: every baseline now also reports `raSignalFollowUpRate`, PR-clustered bootstrap intervals for each outcome (`bootstrapRateCi`), and `liftByOutcome`; `headlineBaseline.byOutcome` names the strongest baseline per outcome; the policy reports `bootstrapSameAuthorCi` / `bootstrapRaSignalCi`; PR records carry a capped `changedFiles` list. All additive and optional in `schema/bench.schema.json` (`schemaVersion` stays 1, existing numbers unchanged). `bench.md` and `bench.html` gain a lift-by-outcome table.
- `gutter label --compare <bench.json>`: blinded comparison labeling page (self-contained HTML, offline, `localStorage` progress, `labels.json` export with `source`). The per-question labeling mode is not built yet; it lands with the corpus if Stage 0 continues.
- `gutter bench --config <variant.json>` validates the variant through the `.gutter.json` parser and exits 2 on unknown or invalid keys, on values the parser would change (such as `1.5` rounded to `1`), and on files that are not a JSON object (previously all of these ran silently).
- New opt-in `.gutter.json` keys `salienceFullMinSignals` and `salienceBreadthFull`; defaults reproduce the existing salience rule exactly.
- `bench/stage0-report.mjs` regenerates the Stage 0 results and decision from `results.json` and exported labels. It counts only each item's blind first label, collapses duplicate exports to one vote per labeler and item, and treats unnamed files as separate labelers.
- Per-outcome lift intervals (`liftByOutcome`, `headlineBaseline.byOutcome`) keep bootstrap resamples where the baseline has zero hits as unbounded lift instead of dropping them, report open bounds as `null` (shown as ∞), and record `unboundedResamples` / `undefinedResamples`. GU-03's `bootstrapLiftCi` is unchanged.
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
