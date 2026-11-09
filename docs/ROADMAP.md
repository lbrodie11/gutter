# Roadmap

Proof before platform. Each milestone has an exit test. If a milestone's exit test fails, fix or stop before starting the next.

## M0 · Prove the signal (now → ~4 weeks)

The question: **is panel 4 right often enough to be worth a reviewer's attention?**

- [ ] Run `repo-archaeology backtest` across 15–20 active OSS repos (mixed TS, Go, Python, monorepos) and publish the table: precision, hit rate, lift, test-window size.
- [x] Build `gutter bench` (`GU-03`) to replay a repo's merged PRs strictly as of each PR (`quiet` / `brief` / `full`, questions per PR, 7-day post-merge follow-up proxy vs. matched baselines).
- [ ] Replay Gutter over each repo's last 200 merged PRs across the multi-repo benchmark corpus (`GU-18`).
- [ ] Hand-review 50 flagged PRs (`GU-04`): was the question useful, irrelevant, or wrong?
- [ ] Agent-commit weighting: measure whether bot- and agent-authored sweeping commits inflate co-change, and tune upstream in Repo Archaeology.

**Exit test:** warnings that become questions are right ≥ 70% of the time on the median repo, and fewer than 1 in 3 PRs get a `full` page.

## M1 · Prove the format (~4 weeks)

- [ ] Five experienced reviewers each use Gutter on ≥ 10 real PRs.
- [ ] A/B: comic page vs. a plain structured layout rendering the **same** `gutter.json`. Measure comprehension accuracy, time to first useful review comment, and stated preference.
- [ ] Ask after a week: "Show me one PR where Gutter changed what you reviewed."

**Exit test:** reviewers save ≥ 2–3 minutes on non-trivial PRs without missing more, and ≥ 3 of 5 want it on by default. If the comic page doesn't beat the plain layout, ship the plain layout as default and keep FRAME/12 as the brand.

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
- Docs-drift panel: docs that historically change with a module but didn't.
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
