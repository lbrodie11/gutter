# Changelog

## Unreleased

- `gutter bench` (`GU-03`): historical pull-request replay benchmark (`src/bench/*`), replaying merged PRs strictly as-of each PR via `replayBrief()` and `GitTreeReader(sha)` (`git ls-tree -r -z` + persistent `git cat-file --batch`) with zero future leakage and offline `repo-archaeology` ≥ 0.4.0 library sessions (`openRepository`).
- Two-policy observational scoring (`production` vs. `ungated` labeled `"research: not product behavior"`), first-parent rename/deletion/censoring outcome tracking, matched as-of baselines (`popular`, `popular-near`, `recent`), Wilson 95% intervals, seeded 1,000-resample PR-clustered bootstrap CIs, incremental `bench.partial.jsonl` checkpointing with `--resume`, and preregistered methodology in `docs/benchmark/METHOD.md`.
- Validated benchmark results contract (`schema/bench.schema.json`, `schemaVersion: 1`) and single-source `bench.md` and FRAME/12 `bench.html` report generators (`src/bench/validate.ts`, `src/bench/report-md.ts`, `src/bench/report-html.ts`).

## 0.1.0 · 2026-11-08

- `gutter brief`: diff structure, TS/JS static dependents (including broken imports from deletes and renames, plus `dependents.coverage: 'full' | 'partial'` and `dependents.unresolved: { count, samples }` for alias and workspace-package specifiers), test links, Repo Archaeology co-change with Wilson intervals and bot-evidence flags, per-repo calibration, deterministic reviewer checklist, salience.
- `gutter.json` v1 contract and JSON Schema (forward-compatible consumer guidance; legacy `dependents.unresolvedAliases` payloads are normalized into `dependents.unresolved`).
- Renderers: compact Markdown PR comment, FRAME/12 comic page with `C-01`…`C-06` panel cuts and 6-rule design-grammar lint (`color-literal`, `gradient`, `font-literal`, `marker-misuse`, `illegal-gutter`, `cut-order`).
- GitHub Action: sticky comment, job summary, artifact upload, fork-safe.
