# Decisions

Short records of the choices that shape Gutter, and why. Newest last. Change a decision by adding a new entry, not by editing an old one.

## 1. Comprehension, not review

Gutter does not find bugs, suggest fixes, or comment line-by-line. CodeRabbit, Greptile, Graphite and GitHub Copilot review compete there with large funding and platform position. The open space is upstream of judgment: helping a human build the right mental model of a change before reading the diff. Code-review research supports the premise (reviewers start by building context; alphabetical file order fragments it). Boundary: **we explain; others judge.** Any feature that drifts into verdicts needs a new decision here first.

## 2. Repo Archaeology is the statistics engine; Gutter consumes its v1 JSON

Gutter shells out to `repo-archaeology diff --json` and `backtest --json` and maps the result. It does not mine history itself. Benefits: one tested implementation of co-change, Wilson ranking, sweep filtering and rename following; Repo Archaeology stays independently useful; Gutter stays zero-dependency. Cost: an `npx` call per run, removable once Repo Archaeology exports a library API (see roadmap).

## 3. `gutter.json` is the product

Analysis writes one evidence document; renderers only read it. This keeps the comic page swappable (so it can be A/B tested against a plain layout with identical evidence), and lets future surfaces (IDE, agent skill, analytics) reuse it. Invariant enforced in code: every checklist item cites evidence ids that exist in the document.

## 4. Deterministic by default

No LLM in the pipeline. Every sentence is a template over counted facts. If narration is added later, it reads only `gutter.json`, and the evidence wins any conflict. This also keeps margins and the privacy story simple: no code leaves the runner.

## 5. Quiet is the default success state

Salience levels: `quiet` (one line, and no new comment in `auto` mode), `brief`, `full`. The checklist is capped at 4. Weak companions (Wilson lower bound < 30%) and companions backed mostly by bot commits appear in the evidence table but never become questions. AI-review studies show high rejection rates for noisy comments; trust is spent fast and earned slowly.

## 6. Calibration is shown on every brief, and it gates questions

Each run replays Repo Archaeology's backtest on held-out recent history and prints the result in plain words. When measured precision falls below 25%, co-change questions are suppressed for that repo, while the evidence still shows. "Lift" uses Repo Archaeology's own definition (hit rate vs. a popularity baseline on the same changes) so the two tools never print different multipliers for the same repo.

## 7. Two renderers: compact Markdown in the PR, comic page as an artifact

PR comments can't render custom HTML/CSS. The comment is compact Markdown with collapsible sections; the comic page ships as a workflow artifact (and locally as `gutter.html`). A later GitHub App can render the page to PNG for inline display. The comic is the distribution loop and the memorable artifact. The value sits in the evidence, so the compact mode must stand on its own.

## 8. Security posture

`pull_request` only, never `pull_request_target`. Fork PRs fall back to summary + artifact. All PR-derived text is escaped per output format; links come only from `http(s)` bases and hex SHAs; git runs via argument vectors. Gutter never fails a build. An analysis error becomes a warning annotation.

## 9. Zero runtime dependencies; Node ≥ 22

Published builds and release tags ship compiled ES2022 JavaScript in `dist/`, which runs on Node.js ≥ 22 (`engines.node: ">=22"`) without experimental flags or runtime dependencies — matching `repo-archaeology@^0.3.0`'s Node ≥ 22 requirement while Node 20 is EOL. Local development (`npm run dev`) and tests (`npm test`) run `.ts` sources directly via Node ≥ 22.6 type stripping (`--experimental-strip-types`), `node:test` for tests, and `parseArgs` for the CLI. Smaller attack surface for something that runs in other people's CI.

## 10. Free Action first; paid GitHub App later

The CLI and Action stay free and MIT. Monetization, if any, is a companion GitHub App with flat per-organization pricing (not per seat, so it doesn't line up against $20–$60/seat AI reviewers). GitHub Marketplace requires 100 installations before an App can list paid plans; that is the gate, not a goal. Paid features coordinate teams (accuracy dashboard, shared config, multi-repo, history caching); the core analysis stays free.

## 11. Version single source of truth

`package.json` and `src/version.ts` both carry the version string so the source tree can run directly without a code-generation pre-step. An automated test in `test/schema.test.ts` asserts `GUTTER_VERSION === package.json#version` on every test and release run, preventing drift.

## 12. Detached-HEAD release tags carry `dist/`

`dist/` stays in `.gitignore` on `main` so pull requests never carry build diffs. When a `vX.Y.Z` tag is pushed, `.github/workflows/release.yml` runs `npm ci`, typechecks, tests, builds `dist/`, force-adds `dist/` into a single detached-HEAD release commit, and moves both `vX.Y.Z` and the major `v0` tag to that commit. Consumers referencing `lbrodie11/gutter@v0` or `lbrodie11/gutter@v0.1.0` always get a prebuilt `dist/action/main.js` that runs on Node ≥ 22 without installing dependencies or stripping types at runtime.

## 13. Snapshot `SourceReader` and pure `assembleBrief` for zero-leakage replay (`GU-03`)

Historical PR replay (`gutter bench`, `replayBrief`) must never read the checked-out working tree, check out a commit, or fork Gutter's question-generation pipeline. All file and config reads in static analysis (`src/evidence/imports.ts`, `src/evidence/tests.ts`, `src/config.ts`) go through `SourceReader` (`src/source/reader.ts`), with `WorkingTreeReader` for normal CLI/Action runs and `GitTreeReader(sha)` (backed by `git ls-tree -r -z` and a single argument-vector `git cat-file --batch` worker) for snapshot replay. `buildBrief` and `replayBrief` share the pure `assembleBrief` pipeline, while `replayBrief` uses `repo-archaeology` ≥ 0.4.0's library API (`openRepository({ cwd, head, base })`) offline without any `npx` fallback. GU-09 and GU-14 reuse `SourceReader`, and GU-05 swaps import analysis for Repo Archaeology's resolver behind this same interface.

## 14. Two-policy observational benchmarking and unverified Gate A (`GU-03`)

`gutter bench` evaluates historical PRs under two separate policies (`production` with as-of `backtest()` calibration at or before `base`, and `ungated` labeled `"research: not product behavior"` everywhere) and compares against three matched as-of baselines (`popular`, `popular-near`, `recent`) computed strictly from `base` ancestry. Post-merge changes within `--window-days` are recorded as observational outcomes (`followedUp`, `notFollowedUp`, `censored`, `targetDeleted`, `targetRenamed`, `resolvedAtMerge`, `unscorable`), never as automatic proof of a true omission; Gate A (`Question usefulness`) always prints `UNVERIFIED` until human review labels exist in GU-04. All three benchmark artifacts (`bench.json`, `bench.md`, `bench.html`) are rendered from a single schema-validated model (`schema/bench.schema.json`) so report numbers can never drift from `bench.json`.
