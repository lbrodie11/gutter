# Changelog

## 0.1.0 · unreleased

- `gutter brief`: diff structure, TS/JS static dependents (including broken imports from deletes and renames, plus `dependents.coverage: 'full' | 'partial'` and `dependents.unresolved: { count, samples }` for alias and workspace-package specifiers), test links, Repo Archaeology co-change with Wilson intervals and bot-evidence flags, per-repo calibration, deterministic reviewer checklist, salience.
- `gutter.json` v1 contract and JSON Schema (forward-compatible consumer guidance; legacy `dependents.unresolvedAliases` payloads are normalized into `dependents.unresolved`).
- Renderers: compact Markdown PR comment, FRAME/12 comic page with `C-01`…`C-06` panel cuts and 6-rule design-grammar lint (`color-literal`, `gradient`, `font-literal`, `marker-misuse`, `illegal-gutter`, `cut-order`).
- GitHub Action: sticky comment, job summary, artifact upload, fork-safe.
