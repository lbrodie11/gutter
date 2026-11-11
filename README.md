# <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/icon-dark.svg"><img src="docs/brand/icon.svg" width="32" height="32" align="top" alt="Gutter mark"></picture> Gutter

**Understand a pull request before you review it.**

Gutter is a GitHub Action and CLI (`gutter-brief`, binary `gutter`) that posts a compact, evidence-backed change briefing on every pull request — what changed, what depends on it, what the tests show, and what the history says — with clickable commit receipts. You decide what matters.

`Experimental · v0.5.0` · `Local-first` · `Deterministic (no AI / LLM)` · `MIT License`

```yaml
# .github/workflows/gutter.yml
name: Gutter
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
permissions:
  contents: read
  pull-requests: write
jobs:
  brief:
    if: ${{ !github.event.pull_request.draft }}
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 22
      - uses: lbrodie11/gutter@v0
```

---

### See what the diff doesn't tell you

Gutter combines `git diff` structure, test-file conventions, and [Repo Archaeology](https://github.com/lbrodie11/repo-archaeology)'s import graph and co-change history into a compact, evidence-backed briefing for human reviewers.

**Gutter doesn't replace your judgment.** It never writes AI verdicts, suggests code rewrites, guesses at omissions, or blocks a merge. Instead, it gives you verifiable repository evidence — with clickable commit receipts and a per-repo backtest of how reliable the history is — so you can decide where to spend your attention.

![Focused view of Gutter's "Usually changes with" panel on Hono](docs/images/hono-hero-crop.png)

<sub>Above: panel C-04, "Usually changes with", on an illustrative [honojs/hono](https://github.com/honojs/hono) change. Touching `src/middleware/serve-static/index.ts` and `src/adapter/bun/serve-static.ts` shows that the middleware's test changed with it in `17 of 20` commits and the Deno adapter changed with the Bun adapter in `9 of 11`, with the exact commits behind each pair. It is history, not a prediction: Gutter doesn't say either file must change.</sub>

### What Gutter does and doesn't claim

- **It shows** what a PR touches (files, modules, importers outside the PR, imports of removed files), its tests (which related test files changed, which didn't, and how often they changed together before), and its history (files that usually change with these ones), with a receipt for every line.
- **Imports of removed files** are checked in every language Repo Archaeology resolves: TS/JS (relative imports, tsconfig `paths`, workspace packages, `exports` subpaths; type-only and dynamic imports included), Go packages and Python modules. Gutter compares the import graph at the PR's base with the one at its head: a file whose import of a removed path no longer resolves (untouched, or added or changed by the PR) is a `broken-import` item (`dependents.method: base-graph`). Without the Repo Archaeology library it falls back to relative TS/JS imports only (`relative-scan`). See [DECISIONS #20](docs/DECISIONS.md#20-broken-imports-come-from-base-and-head-import-graphs-in-every-language-repo-archaeology-resolves-gu-31).
- **It doesn't** predict omissions or run your tests. It never claims a file was left out by mistake or that a change lacks test coverage: it can't know either.
- **Here's the evidence.** Gutter used to ask "does this file need a matching change?" On hono, the files it asked about changed afterwards *less* often than a "recently busy files" guess (lift ×0.36 on any follow-up, ×0.42 on same-author follow-up). So since GU-29 the default output reports facts and shows co-change as context. The data, both readings and the rule for bringing a better prediction back are in [`docs/benchmark/STAGE0.md`](docs/benchmark/STAGE0.md) and [DECISIONS #17](docs/DECISIONS.md#17-explain-dont-predict-gu-29).

---

## Example: a Hono change, briefed

> **About this example:** Below is an illustrative branch on [honojs/hono](https://github.com/honojs/hono) (based on commit [`eb754bd`](https://github.com/honojs/hono/commit/eb754bd5ef22c63f1634a4c374a86be086f85710)) analyzed against Hono's real commit history (`1,861` commits, repo-archaeology 0.10.0). The proposed `cacheControl` edit is a local simulation, not an existing Hono pull request; all co-change counts and supporting commit receipts are genuine.
>
> **Reproduce locally:**
> ```bash
> # Re-render the Markdown comment or HTML page from the saved contract:
> node dist/cli.js render docs/example/gutter.json --format md
> node dist/cli.js render docs/example/gutter.json --format html > /tmp/gutter.html
>
> # Or re-run the full analysis from scratch against a clone of honojs/hono:
> bash docs/example/reproduce.sh
> ```

### 1 · What Gutter reports

Suppose a pull request adds a `cacheControl` option to Hono's shared static-file middleware ([`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.ts), +12) and updates the Bun adapter ([`src/adapter/bun/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/serve-static.ts), +2), touching 2 files (+14/−0). The page is `brief`. Before you read a line of the diff, Gutter states:

| Where | What Gutter says | Evidence |
|---|---|---|
| **Check these** | `src/middleware/serve-static/index.ts` changed (+12/−0); its test file `src/middleware/serve-static/index.test.ts` didn't change in this PR. | `git diff`, test-file naming |
| **Check these** | `src/middleware/serve-static/index.ts` is imported by 6 files this PR doesn't touch. Is its public shape unchanged? | Repo Archaeology's import graph: 3 relative importers in `src/`, plus the 3 `adapters/*/src/serve-static.ts` files that import it through the package's `exports` |
| **Tests** | [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts) — unchanged in this PR · changed together with `src/middleware/serve-static/index.ts` in **17 of 20** commits | [`d54720d`](https://github.com/honojs/hono/commit/d54720da80134a180f5fe2dd98a7676cfc8f08b4) · [`588ec13`](https://github.com/honojs/hono/commit/588ec13fa68ea44fed1b5e1b503341db2bf09d70) · [`8b05c77`](https://github.com/honojs/hono/commit/8b05c774ef1555c70f5ba5e2991b7e77cc3635cc) |
| **Usually changes with** | `src/adapter/bun/serve-static.ts` and [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts) changed together in **9 of 11** commits; the Deno adapter isn't in this PR | [`26f8c33`](https://github.com/honojs/hono/commit/26f8c33f23e6151873d165107f2dbcadf1204d15) · [`1196f14`](https://github.com/honojs/hono/commit/1196f14b94e589e2ac44fa7f1c8785d70c1cf83e) · [`246a06a`](https://github.com/honojs/hono/commit/246a06aa1d35aa206dcf11186b3aa90badb2de72) |
| **Usually changes with** | This PR changes 1 of 3 parallel implementations (`serve-static.ts` across `src/adapter/*`); Cloudflare Workers and Deno aren't in this PR | [`cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts) · [`deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts) |

None of these is a verdict. The test row is a historical fact; whether this change needs a test change is the reviewer's call.

### 2 · What lands in the pull request (sticky Markdown comment)

GitHub pull request comments cannot render custom CSS, so Gutter posts **one compact, updating Markdown comment** (and stays completely silent on small, unremarkable PRs in `auto` mode). Full source: [`docs/example/brief.md`](docs/example/brief.md) (generated with gutter 0.5.0 + repo-archaeology 0.10.0 as a library; see [`docs/example/README.md`](docs/example/README.md) to reproduce it).

> ### Gutter · change briefing
>
> **feat(serve-static): add cacheControl option**: 2 files across 2 modules (+14/−0)
>
> **Worth a look**
>
> 1. `src/middleware/serve-static/index.ts` changed (+12/−0); its test file `src/middleware/serve-static/index.test.ts` didn't change in this PR.<br><sub>receipts: [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts)</sub>
> 2. `src/middleware/serve-static/index.ts` is imported by 6 files this PR doesn't touch. Is its public shape unchanged?<br><sub>receipts: [`adapters/bun/src/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/adapters/bun/src/serve-static.ts) · [`adapters/cloudflare-workers/src/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/adapters/cloudflare-workers/src/serve-static.ts)</sub>
>
> *(Plus collapsed `<details>` sections: **Usually changes with** (history, not a prediction), **What it touches**, **Tests**, and **What changed**.)*
>
> <sub>Replayed on the last 375 commits: when it flagged files, at least one really did change 73% of the time (8.4× better than guessing busy files), and 57% of all flagged files did. · No AI wrote this: every line comes from git history and the code · gutter 0.5.0 + repo-archaeology 0.10.0</sub>

### 3 · The full six-panel page (`gutter.html` artifact)

Alongside the Markdown comment, Gutter writes a self-contained, offline HTML page ([`docs/example/gutter.html`](docs/example/gutter.html)) rendered in [FRAME/12](https://github.com/lbrodie11/frame12)'s comic panel grammar — uploaded as a workflow artifact in CI or opened locally from `.gutter/gutter.html`:

![Gutter six-panel briefing page for the Hono example](docs/images/hono-example.png)

| Panel | Question it answers | Evidence source |
|---|---|---|
| **C-01 · Intent** | What is this change trying to do? | PR title/body, commit subjects |
| **C-02 · What changed** | How big is it, and where? | `git diff` grouped into modules, churn as screentone |
| **C-03 · What it touches** | Who depends on what changed? | [Repo Archaeology](https://github.com/lbrodie11/repo-archaeology)'s import graph (relative imports, tsconfig `paths`, workspaces, package `exports`/`imports`, Go packages, Python modules); any unresolved import in the repository marks `dependents.coverage` as **`partial`** (with sample receipts), and languages the resolver doesn't cover are reported as **`unchecked`** — never silently as "no dependents". Without the library, a relative-import scanner for TS/JS is the fallback |
| **C-04 · Usually changes with** | Which files historically change with these files? (History, not a prediction; never the page's hero) | [Repo Archaeology](https://github.com/lbrodie11/repo-archaeology) directional co-change history with commit receipts |
| **C-05 · Tests** | Which related test files changed, which didn't, and how often did they change together before? | Co-located, `__tests__/`, and mirrored `test/` / `tests/` naming conventions, plus co-change pairs between a file and its test |
| **C-06 · Check these** | Where should I focus first? | Up to 4 deterministic facts (broken imports, unchanged test files, wide import surfaces), each required to cite evidence IDs from panels C-03 to C-05. It is the hero panel when it has items; otherwise C-03 is |

Every generated HTML page is verified against 6 [FRAME/12](https://github.com/lbrodie11/frame12) design-grammar rules in `lintPage()` (`color-literal`, `gradient`, `font-literal`, `marker-misuse`, `illegal-gutter` restricting CSS `gap`/`row-gap`/`column-gap`/`grid-gap` to `0`/`12px`/`20px`/`32px` or `--f-gutter-*` tokens, and `cut-order` enforcing sequential `C-01`…`C-0N` panel labels).

---

## How much to trust the history (73% hit rate vs. 57% precision)

Historical co-change is context, not proof of anything. Two files that usually change together sometimes should, and sometimes a change intentionally applies to only one adapter or module. That is why Gutter shows the history and leaves the call to you.

To show how reliable the history is on *your specific repository*, Gutter runs Repo Archaeology's walk-forward backtest on recent history and prints the result under the page:

- **Evaluated window (`375` held-out test commits on Hono):** Each held-out commit is replayed using only history prior to that commit.
- **Query hit rate (`73%` across `514` fired file-level queries, `8.4×` lift over guessing busy files):** Among the `514` file-level queries where historical suggestions were returned, `73%` had at least one suggestion that genuinely changed in the same commit.
- **Per-suggestion precision (`57%`):** Across all individual file suggestions emitted across those queries, `57%` matched files that changed in the same commit.

Pairs backed mostly by bot commits (`dependabot`, `renovate`, etc.) are marked as such. Co-change never becomes a checklist item and never makes a page louder. (Under the `legacyPredictions` research switch, measured precision below `25%` still suppresses the old companion questions, and weak or bot-backed pairs never become questions, exactly as before GU-29.)

---

## Benchmark (`gutter bench`)

Before trusting historical co-change or static questions on a repository, `gutter bench` replays the newest $N$ merged pull requests strictly **as of each PR** using the same question-generation code (`assembleBrief`) as production Gutter, scores what happened next on the first-parent branch, compares against matched baselines, and writes [`bench.json`](schema/bench.schema.json), `bench.md`, and a FRAME/12 `bench.html` page from one schema-validated results model.

```bash
# Replay the newest 200 eligible PRs on the current branch (offline; requires the repo-archaeology library >= 0.4.0, 0.10.0 recommended)
node dist/cli.js bench --prs 200 --window-days 7 --out .gutter/bench
```

### What `gutter bench` measures — and what it does not

1. **Commits ≠ pull requests (offline discovery funnel):**
   `gutter bench` walks `git rev-list --first-parent <branch>` offline without requiring GitHub API tokens. Each commit is classified into `merge-commit` (`high` confidence when `Merge pull request #n`, `medium` when unnumbered), `squash-subject` (`medium` confidence when ending in `(#n)`), or skipped as `octopus` / `not-a-pr` (direct pushes and GitHub rebase merges, which leave no merge parent or `(#n)` suffix). Passing `--include-unnumbered` evaluates 1-parent unnumbered commits as `change-unit` (`low` confidence) in a separate pool that is never pooled with PR results.
2. **Follow-ups are observations (`followedUp`), not ground-truth defects:**
   A target file changing on the first-parent branch within `--window-days` (default `7`) after `mergedAt` is recorded as `followedUp` (along with delay, `sameAuthor` after `.mailmap`, and Repo Archaeology follow-up signals). Planned multi-PR splits and unrelated work can touch the same file, while a genuine omission left unfixed for 7 days is recorded as `notFollowedUp`. Consequently, the bench's **Gate A (`Question usefulness`) line always prints `UNVERIFIED`** — never `PASS` from automated follow-up rates. (Gate A was retired as M0's exit test by GU-29; see item 10.)
3. **Right-censoring and rename/deletion tracking:**
   First-parent outcomes follow renames (`targetRenamed`) and record deletions as their own outcome (`targetDeleted`, never a hit). If a PR's observation window extends past the newest commit on the branch without an earlier hit, the target is marked `censored` and excluded from precision denominators.
4. **Two explicit policies (`production` vs. `ungated`):**
   - **`production`:** What Gutter would actually have posted, gated by Repo Archaeology's `backtest()` calibration computed strictly as-of each PR's history (or the newest checkpoint at or before `base` under `--calibration-every <n>`).
   - **`ungated` (`research: not product behavior`):** Calibration bypassed to measure the raw signal. Always reported separately and never presented as Gutter's product precision.
5. **Matched as-of baselines (`popular`, `popular-near`, `recent`):**
   For every scored PR with $k$ scorable targets, each baseline proposes up to $k$ files existing at `head`, untouched by the PR, passing the same generated/vendored/bot filters as Gutter, and ranked strictly from commit ancestry of `base`:
   - `popular`: most frequently changed files overall.
   - `popular-near`: most frequently changed files sharing a top-level directory or module with a file touched by the PR.
   - `recent`: most frequently changed files in the 30 days prior to `base`.
   Headline lift is reported against the **strongest** baseline on the repository, with 95% Wilson intervals and a seeded 1,000-resample PR-clustered bootstrap.
6. **Why same-commit backtest lift (`8.4×`) and 7-day post-merge follow-up proxy (`×0.36` vs. `recent`) differ:**
   - **Same-commit backtest (`repo-archaeology backtest`):** Holds out files *within a single commit* and asks whether historical co-change predicts the other files modified in that same commit (`73%` hit rate, `8.4×` lift over popularity on Hono with repo-archaeology 0.10.0). This measures whether the files genuinely form a coupled pair when a change is complete.
   - **Post-merge follow-up proxy (`gutter bench`):** Replays merged PRs where a companion or test was left *untouched* in the PR and observes whether that file is edited in a *separate* commit within the next 7 days (`0.23` follow-up proxy on Hono). Over a 7-day post-merge window on an active repository, central/recently-busy files (`recent`, `popular`) naturally accumulate unrelated feature edits at a high rate (`0.65` on Hono), whereas specific companion/test targets change later only when a follow-up test or fix commit lands.
   - Because 7-day post-merge edits conflate genuine omissions with background churn on busy files, `gutter bench` always marks Gate A as `UNVERIFIED` and leaves usefulness to human review (GU-04 labels, then M1).

7. **Stricter outcomes for every baseline (`GU-04` Stage 0):**
   Every baseline is also scored on same-author follow-up and on Repo Archaeology's follow-up signal, with Wilson and PR-clustered bootstrap intervals, and `bench.md` shows lift on each outcome against that outcome's strongest baseline. On Hono, `recent` still leads on all three (same-author `0.29` vs. Gutter `0.12`, lift `×0.42`), so the gap is not only busy-file churn. See [`docs/benchmark/STAGE0.md`](docs/benchmark/STAGE0.md).
8. **Blinded comparison labeling (`gutter label --compare`):**
   `gutter label --compare bench.json` writes one self-contained HTML page (no server, works offline) that mixes Gutter companion questions with `recent` and `popular-near` proposals, renders them identically as "Should this PR also have changed `<file>`?", and reveals the source, evidence, and automatic outcome only after each label. Progress is kept in the browser; **Export labels.json** downloads the labels with their `source`.
9. **Salience variants (`--config <variant.json>`):** a variant is any `.gutter.json`-shaped file; unknown or invalid keys are refused so a preregistered variant cannot silently run as the default. The Stage 0 variants live in [`bench/variants/`](bench/variants/). Stage 0 and 0b ran on the pre-GU-29 defaults; to reproduce them now, add `"legacyPredictions": true` ([`bench/variants/gu29-legacy.json`](bench/variants/gu29-legacy.json) reproduces Stage 0b's default run record for record).
10. **Gate A′ (`GU-29`):** M0's exit test is now checkable without labels: `full` share ≤ 1/3, facts re-checked against git (broken imports with TypeScript's own resolver, unchanged-test and test-history facts at each PR's SHAs), and no prediction wording on any page. [`bench/gate-a-prime.ts`](bench/gate-a-prime.ts) runs it; hono's result is in [`STAGE0.md`](docs/benchmark/STAGE0.md#after-gu-29--explain-dont-predict-2026-11-10). The `Gate A` line that `gutter bench` still prints is the retired usefulness gate, kept for the research reports.

Full preregistered methodology and scoring rules: [`docs/benchmark/METHOD.md`](docs/benchmark/METHOD.md). Stage 0 go/no-go on Hono: [`docs/benchmark/STAGE0.md`](docs/benchmark/STAGE0.md).

---

## Quick start

### Option 1 · GitHub Action (`lbrodie11/gutter@v0`)

> **SHA-pinning note:** `dist/` is gitignored on `main` and attached to release tag commits by `release.yml`. If you pin actions to a 40-character commit SHA instead of `@v0` / `@v0.5.0`, always pin to the **release tag's commit SHA** (`git rev-parse v0.5.0^{commit}`), never an unbuilt `main` branch commit SHA.

| Input | Default | Behavior |
|---|---|---|
| `post` | `auto` | `auto` skips quiet PRs (but updates an existing sticky comment), `always`, or `never` (job summary + artifact only) |
| `history` | `true` | Run Repo Archaeology: co-change history and the import graph in one library session. The Action installs it into an isolated, cached prefix under `RUNNER_TEMP` (never into your repository) and falls back to `npx` with a notice if that install fails. `false` runs offline with a relative-import scanner |
| `calibrate` | `true` | Backtest how reliable co-change history is on this repo, shown under the page (~0.3s on 1,900 commits) |
| `max-forgotten` | `3` | Maximum "usually changes with" pairs to display (`0` hides them; the input keeps its v1 name) |
| `archaeology-version` | `^0.10.0` | npm version range of `repo-archaeology` to install (also the cache key) |
| `upload-page` | `true` | Upload `gutter.html` and `gutter.json` as the `gutter-brief` workflow artifact |

Action outputs: `status` (`analyzed` / `skipped` / `error`), `salience` (`quiet` / `brief` / `full`), `question-count` (checklist items), `forgotten-count` ("usually changes with" pairs shown; the output keeps its v1 name), `json-path`, `html-path`.

### Option 2 · CLI (`gutter-brief` on npm, binary `gutter`)

```bash
npx gutter-brief brief --base main
npx gutter-brief brief --base main --print md        # also print the Markdown comment to stdout
npx gutter-brief render .gutter/gutter.json --format html > page.html
```

Useful flags: `--title` / `--intent` (PR text), `--pr <n>`, `--ra-lib <path>` (a local Repo Archaeology library), `--ra-bin <path>` (a Repo Archaeology binary, used when no library loads), `--ra-diff` / `--ra-backtest` (use saved JSON), `--no-history`, `--no-calibration`. Run `gutter --help` for the full list.

**Optional `.gutter.json` repository configuration:** Repositories may place a `.gutter.json` file at the repository root to customize thresholds (`maxForgotten`, `maxChecklist`, `minChurnForTestQuestion`, `wideSurfaceImporters`, `salienceFullMinSignals`, `salienceBreadthFull`, `noHistory`, `noCalibration`). Precedence is `CLI flags / Action inputs > .gutter.json > defaults`. In the GitHub Action, `.gutter.json` and `.repo-archaeology.json` are read from the `base` commit tree so an untrusted pull request cannot silence Gutter on itself.

**How loud a page is (salience).** Each checklist item with priority ≤ 2 counts as one signal, and breadth (≥ 8 files or ≥ 3 modules) counts as one more when `salienceBreadthFull` is `true` (the default). A page is `full` when it has at least `salienceFullMinSignals` signals (default `2`). By default only `broken-import` has priority ≤ 2, so a page is `full` when it has **two or more broken imports, or one broken import plus breadth**. Breadth alone is never `full`. Any checklist item makes a page at least `brief`, and so does a change to more than three files; otherwise it is `quiet`. Co-change history and test history never count.

**Research switch (not recommended).** `legacyPredictions: true` reproduces pre-GU-29 behavior for benchmarks: companion (`forgotten-companion`) and `family-drift` questions with their old wording, `salienceFullMinSignals` defaulting to `1` (an explicit value still wins), and no `forgotten.presentation` or `TestLink.history` in `gutter.json`. The keys `maxCompanionQuestions`, `minIntervalLow`, `minCalibratedPrecision`, `companionRequireGhost` and `companionMinTrackRecordFired` only matter under it; the CLI and the Action print a warning when one is set without it. See [DECISIONS #17](docs/DECISIONS.md#17-explain-dont-predict-gu-29).

### Option 3 · Run locally from source

Built `dist/` runs on **Node.js ≥ 22** (and `git`).

```bash
# 1. Clone and build Gutter
git clone https://github.com/lbrodie11/gutter.git /tmp/gutter
cd /tmp/gutter
npm ci
npm run build

# 2. Switch to the repository you want to analyze (on a feature branch)
cd /path/to/your-project
node /tmp/gutter/dist/cli.js brief --base main
# → .gutter/gutter.json   the evidence contract
#   .gutter/brief.md      the compact PR comment
#   .gutter/gutter.html   the self-contained six-panel page
```

---

## Why the name "Gutter"?

In comics, the *gutter* is the space between panels where the reader connects two moments and works out what happened. Code review now lives there: coding agents and large refactors touch more files at once, while alphabetical file diffs fragment the story. Gutter lays out the space between the commits so a human reviewer can see the whole shape of a change before reading line by line.

## Principles

1. **Explain, don't judge, don't predict.** Gutter states facts ("its test file didn't change in this PR") and shows history as context ("changed together in 17 of 20 commits"). It never issues verdicts, never guesses at omissions, and never fails a build.
2. **Evidence before narration.** Every surface renders from one deterministic document, [`gutter.json`](schema/gutter.schema.json) (`schemaVersion: 1`). Every checklist item must cite evidence IDs that exist in that document; the renderers throw if any reference is missing. The contract evolves additively within `schemaVersion: 1`: **consumers must ignore unknown fields and tolerate unknown enum values** (for example, new `checklist.kind` or `dependents.coverage` values).
3. **Honest uncertainty.** Counts with denominators, 95% Wilson intervals, per-repo backtests, `partial` / `unchecked` notices instead of silent false negatives, and a badge when evidence comes mostly from bot commits.
4. **Nothing to say is success.** Small, unremarkable PRs get one quiet line or no comment at all.

## Architecture, Privacy & Dependencies

```
git diff ───────────────────┐
test-file conventions ──────┤
repo-archaeology session ───┼─▶ evidence engine ─▶ gutter.json ─┬─▶ compact Markdown (PR comment)
  (one history load:        │                      (contract)    └─▶ comic page (FRAME/12 HTML artifact)
   diff · backtest ·        │
   importGraph)             ┘
```

- **Privacy & data handling:** Analysis runs entirely on your local machine or your GitHub Actions runner. Gutter never transmits source code, diffs, or git history to any Gutter-operated service. When run in GitHub Actions, the Markdown comment (`post: auto|always`) and optional `gutter-brief` artifact (`upload-page: true`) are stored by GitHub in your repository's pull request and workflow run.
- **Dependencies:** `gutter-brief` has **zero direct runtime npm dependencies** (`package.json` `dependencies` is empty); [`repo-archaeology`](https://www.npmjs.com/package/repo-archaeology) is an optional peer (`>=0.4.0`). Gutter prefers it as a library: one `openRepository` session per brief loads history once and serves `diff`, `backtest` and the import graph (`--ra-lib` / `GUTTER_RA_LIB`, or the installed package). Without the library it falls back to a binary (`--ra-bin` / `GUTTER_RA_BIN`), then to `npx --yes repo-archaeology@^0.10.0` (noted on the page), then to "history unavailable", with a relative-import scanner for dependents. Pass `--no-history` (or `history: 'false'` in the Action) for a completely offline static run.
- **Security:** Designed for `pull_request`, **never `pull_request_target`**. All PR-derived text is escaped per output format; links are built only from `http(s)` base URLs and hex SHAs; git is invoked strictly with argument vectors. See [SECURITY.md](SECURITY.md) for the full threat model.

## Development

```bash
npm ci
npm test          # node:test (runs .ts sources directly on Node.js >= 22.6)
npm run typecheck
npm run build     # compiles dist/ (built CLI and Action run on Node.js >= 22 without experimental flags)
```

- **Runtime requirement (built `dist/`):** Node.js ≥ 22 (`engines.node: ">=22"`), zero runtime dependencies.
- **Development & test requirement:** Node.js ≥ 22.6 (TypeScript sources in `src/` and `test/` run directly via `--experimental-strip-types`).

## Documentation & Community

- [Architecture & Product Decisions (`docs/DECISIONS.md`)](docs/DECISIONS.md)
- [Benchmark Methodology & Preregistration (`docs/benchmark/METHOD.md`)](docs/benchmark/METHOD.md)
- [Cross-Repository Coupling Research (`research/multi-repo/REPORT.md`)](research/multi-repo/REPORT.md)
- [Release Checklist & Marketplace Guide (`docs/RELEASING.md`)](docs/RELEASING.md)
- [Validation Roadmap (`docs/ROADMAP.md`)](docs/ROADMAP.md)
- [JSON Schemas (`schema/gutter.schema.json`, `schema/bench.schema.json`)](schema/gutter.schema.json)
- [Contributing Guide (`CONTRIBUTING.md`)](CONTRIBUTING.md)
- [Security Policy (`SECURITY.md`)](SECURITY.md)

## License

[MIT](LICENSE) © Laqwan Brodie
