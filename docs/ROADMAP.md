# Roadmap

Proof before platform. Each milestone has an exit test. If a milestone's exit test fails, fix or stop before starting the next.

## M0 · Prove the signal (now → ~4 weeks)

The question, since GU-29 ([DECISIONS #17](DECISIONS.md#17-explain-dont-predict-gu-29)): **is Gutter quiet, true and non-predictive?** (It used to be "is panel 4 right often enough to be worth a reviewer's attention?"; on hono it was not, see [`STAGE0.md`](benchmark/STAGE0.md).)

- [ ] Run `repo-archaeology backtest` across 15–20 active OSS repos (mixed TS, Go, Python, monorepos) and publish the table: precision, hit rate, lift, test-window size.
- [x] Build `gutter bench` (`GU-03`) to replay a repo's merged PRs strictly as of each PR (`quiet` / `brief` / `full`, questions per PR, 7-day post-merge follow-up proxy vs. matched baselines).
- [ ] Replay Gutter over each repo's last 200 merged PRs across the multi-repo benchmark corpus (`GU-18`).
- [ ] Hand-review 50 flagged PRs (`GU-04`): was the question useful, irrelevant, or wrong? *(Optional since GU-29: the 60 Stage 0 labels can no longer reverse DECISIONS #17; they only inform whether "Usually changes with" stays visible by default.)*
- [x] Stop predicting omissions by default; keep the old behavior behind `legacyPredictions` (`GU-29`).
- [ ] Agent-commit weighting: measure whether bot- and agent-authored sweeping commits inflate co-change, and tune upstream in Repo Archaeology.

**Exit test (Gate A′, replaces Gate A):** checkable by an agent without human labels, on hono now and on the corpus when it exists ([`bench/gate-a-prime.ts`](../bench/gate-a-prime.ts)):

- **(a) Quiet enough:** `full` share ≤ 1/3 on the median repo.
- **(b) Facts are true:** an independent re-check confirms ≥ 95% of `broken-import` items. The re-check resolves each specifier with TypeScript's own `ts.resolveModuleName` and the repo's tsconfig at that PR's head; for non-TS files it re-checks file existence. Every `untested-change` and test-history fact matches git at that SHA (100%: these are deterministic).
- **(c) No predictions:** the banned-words test (`forgot`, `likely forgotten`, `you may have missed`, `untested`, `not covered`) passes on every fixture and every replayed bench page.

A criterion with no items on a repository is reported as *not exercised*, never as met. **hono (2026-11-10): PASS on what hono exercises**; `broken-import` is not exercised (0 items in 200 PRs). See [`STAGE0.md`, After GU-29](benchmark/STAGE0.md#after-gu-29--explain-dont-predict-2026-11-10).

*Former exit test (Gate A, retired by GU-29): warnings that become questions are right ≥ 70% of the time on the median repo, and fewer than 1 in 3 PRs get a `full` page.*

## M1 · Prove the format (~4 weeks)

- [ ] Five experienced reviewers each use Gutter on ≥ 10 real PRs.
- [ ] A/B: comic page vs. a plain structured layout rendering the **same** `gutter.json`. Measure comprehension accuracy, time to first useful review comment, and stated preference.
- [ ] Ask after a week: "Show me one PR where Gutter changed what you reviewed."

**Exit test:** reviewers save ≥ 2–3 minutes on non-trivial PRs without missing more, and ≥ 3 of 5 want it on by default. Also (GU-29): reviewers answer "what does this PR affect?" more accurately with the briefing than without it, and ≤ 10% of briefing items are marked misleading by reviewers. M1 is where human usefulness is judged; Gate A′ only checks that Gutter is quiet, true and non-predictive. If the comic page doesn't beat the plain layout, ship the plain layout as default and keep FRAME/12 as the brand.

## M2 · Public beta: GitHub Marketplace Action (~3 weeks)

- [x] Publish `repo-archaeology` ≥ 0.3.0 to npm (Gutter's Action depends on it).
- [x] Tag `v0` and `v0.1.0` (`v0.2.0`) on the repository.
- [x] Publish `gutter-brief` to npm and make the repository public.
- [ ] List the Action on GitHub Marketplace.
- [ ] Launch assets: 5 before/after pages on recognizable OSS PRs, a 30-second on-twos screen recording, Show HN.
- [ ] Feedback loop: 👍/👎 reactions on the sticky comment, read back into per-repo stats.

**Watch:** install → first brief ≥ 70%; 2-week retained repos ≥ 30%; uninstall reasons.

## M3 · GitHub App + team features

- [ ] App with least-privilege permissions; webhook-driven, so fork PRs get comments safely.
- [ ] Render the comic page to PNG for inline display in the comment.
- [ ] Per-repo accuracy dashboard; org defaults; history caching.
- [ ] Flat org pricing after 100 installs and visible retention.

## Later

- Language analyzers beyond TS/JS (Go, Python first), tsconfig `paths` and package `exports` resolution.
- Docs-drift context: docs that historically change with a module, shown as history (DECISIONS #17), not as a question.
- Agent pre-flight skill: an agent produces its own Gutter page before opening the PR, and Gutter checks its claims.
- Stacked-PR awareness; multi-repo coupling.

## Not planned

- **LLM narration or summaries:** Gutter stays deterministic (see [DECISIONS.md #4](DECISIONS.md)). Every line on every surface comes from `git diff`, static code analysis, or repository commit history.

## Upstream asks

**Repo Archaeology**
- [x] Library API (`openRepository` in `repo-archaeology` ≥ 0.4.0) to drop the `npx` hop during replay.
- [x] Agent attribution from `Co-authored-by:` trailers, and optional down-weighting of agent-authored sweeping commits (`origin` in `repo-archaeology` ≥ 0.4.0).
- Expose the Wilson interval upper bound alongside `score`.

**FRAME/12**
- A tokens-only CSS export, so Gutter can import tokens instead of copying them.
- Expose `check-frame12`'s rules as a module that can lint generated HTML strings, replacing Gutter's mirror in `lintPage()`.
