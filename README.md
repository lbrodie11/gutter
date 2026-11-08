# Gutter

**Every pull request gets a one-page briefing: what changed, what it touches, and what it probably forgot — with receipts.**

In comics, the *gutter* is the space between panels where the reader works out what happened. Code review now lives there. Agents start a growing share of pull requests, those PRs touch more files, and reviewers trust them less. Gutter doesn't review your code. It helps the human reviewer build the right mental model of a change in about a minute, then shows exactly where each claim came from.

![Gutter briefing for a real Hono change](docs/images/hono-example.png)

<sub>A real run on [honojs/hono](https://github.com/honojs/hono): a PR adds a `cacheControl` option to the shared serve-static middleware and the Bun adapter. Gutter notices the middleware's test file changed with it in 17 of its last 20 commits, the Deno adapter in 9 of 11, and that this is 1 of 3 parallel adapters. Every number links to the commits behind it. Full output: [`docs/example/`](docs/example/).</sub>

## What's on the page

| Panel | Question it answers | Where the evidence comes from |
|---|---|---|
| 1 · Intent | What is this change trying to do? | PR title/body, commit subjects |
| 2 · What changed | How big is it, and where? | `git diff` grouped into modules, churn as screentone |
| 3 · What it touches | Who depends on what changed? | Static import scan (TS/JS today; other languages are reported as *unchecked*, never as "no dependents") |
| 4 · Likely forgotten | What usually changes with these files but didn't? | [Repo Archaeology](https://github.com/lbrodie11/repo-archaeology) co-change history, with 95% Wilson intervals and the commits behind each claim |
| 5 · Tests | Did the tests move with the code? | Conventional test-file links |
| 6 · Check these | Where should I spend my attention? | Up to 4 deterministic questions, each citing evidence from panels 3–5 |

The footer says how much to trust panel 4 *on this repository*. Gutter replays its own warnings against recent history (Repo Archaeology's backtest) and prints the result: *"when it flagged files, at least one really did change 73% of the time (6.8× better than guessing busy files)."* If measured precision is poor, Gutter still shows the evidence but stops asking questions about it.

## Principles

1. **Explain, don't judge.** Gutter asks questions ("Does it need a matching change?"), never verdicts. It never fails a build.
2. **Evidence before narration.** Everything renders from one deterministic document, [`gutter.json`](schema/gutter.schema.json). Every checklist item must cite evidence ids that exist in it; the renderers refuse otherwise. No AI writes any of it.
3. **Honest uncertainty.** Counts with denominators, confidence intervals, per-repo backtests, "unchecked" instead of silence, and a flag when evidence comes mostly from bot commits.
4. **Nothing to say is success.** Small, unremarkable PRs get one quiet line or no comment at all. A bot that comments loudly on everything gets muted.
5. **Local-first.** Analysis runs on your machine or your Actions runner. Nothing is uploaded anywhere.

## Quick start

### GitHub Action

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
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: lbrodie11/gutter@v0
```

You get one sticky PR comment that updates on every push, a job summary, and the comic page as a downloadable artifact (`gutter-brief`).

| Input | Default | |
|---|---|---|
| `post` | `auto` | `auto` skips quiet PRs (but updates an existing comment), `always`, or `never` (summary + artifact only) |
| `history` | `true` | Use co-change history |
| `calibrate` | `true` | Backtest warning accuracy on this repo (fast: ~0.3 s on Hono's 1,900 commits) |
| `max-forgotten` | `3` | Likely-forgotten files to show |
| `archaeology-version` | `^0.3.0` | Repo Archaeology version to run |
| `upload-page` | `true` | Upload the comic page as an artifact |

Outputs: `status`, `salience` (`quiet` / `brief` / `full`), `question-count`, `forgotten-count`, `json-path`, `html-path`.

### CLI

```bash
npx gutter-brief brief --base main
# → .gutter/gutter.json   the evidence (the contract)
#   .gutter/brief.md      the PR comment
#   .gutter/gutter.html   the comic page (offline, self-contained)

npx gutter-brief brief --base main --print md        # also print the comment
npx gutter-brief render .gutter/gutter.json --format html > page.html
```

Useful flags: `--title` / `--intent` (PR text), `--pr <n>`, `--ra-bin <path>` (use a local Repo Archaeology build), `--ra-diff` / `--ra-backtest` (use saved JSON), `--no-history`, `--no-calibration`. Run `gutter --help` for the full list.

## How it works

```
git diff ─────────────┐
git ls-files + imports ┤
test-file conventions ─┼─▶ evidence engine ─▶ gutter.json ─┬─▶ compact Markdown (PR comment)
repo-archaeology diff ─┤                      (contract)    ├─▶ comic page (FRAME/12 grammar)
repo-archaeology       ┘                                     └─▶ next: IDE, agent skill, analytics
  backtest
```

- **Repo Archaeology owns the statistics**: directional co-change, Wilson ranking, sweep filtering, rename following, backtests. Gutter consumes its versioned v1 JSON contract and never re-implements it.
- **Gutter owns comprehension**: what to show, what to ask, when to stay quiet, and how to lay it out.
- **[FRAME/12](https://github.com/lbrodie11/frame12) owns the look**: tokens, panel grammar, screentone, and motion on twos (each panel steps in on 12fps poses; skipped under `prefers-reduced-motion`). Every generated page passes a design-grammar lint mirroring `check-frame12`.

## Security

- Runs on `pull_request`, **never `pull_request_target`**. PR contents are parsed as text; nothing from the PR is executed.
- Fork PRs get a read-only token, so Gutter writes the job summary and artifact instead of a comment.
- Titles, bodies, file names, commit subjects and author names are treated as hostile: HTML-escaped on the page, Markdown-escaped with defused `@mentions` in comments, and links are only ever built from `http(s)` bases and hex SHAs.
- Git is always called with argument vectors, never shell strings.
- `gutter.json` never contains absolute local paths.

## Status

`0.1.0`, experimental. TypeScript/JavaScript static analysis; co-change history works for any language. See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next and [docs/DECISIONS.md](docs/DECISIONS.md) for why it's built this way.

## Development

```bash
npm install
npm test          # node:test, no test framework
npm run typecheck
npm run build
```

Zero runtime dependencies. Node ≥ 22.6 (TypeScript runs directly via type stripping in dev and in the Action's fallback path).

## License

MIT © Laqwan Brodie
