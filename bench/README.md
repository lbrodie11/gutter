# `bench/`: multi-repo benchmark tooling (`GU-04`)

GU-04 builds the evidence for Roadmap Gate A in two steps.

## Stage 0 · hono go/no-go (this directory today)

A cheap screen on one repository before investing in a corpus. Rules are preregistered in [`docs/benchmark/STAGE0.md`](../docs/benchmark/STAGE0.md); data lives in [`docs/benchmark/data/honojs__hono/stage0/`](../docs/benchmark/data/honojs__hono/stage0/).

| File | What it is |
|---|---|
| [`variants/stage0-v1-floor.json`](variants/stage0-v1-floor.json) | `minIntervalLow: 0.5` |
| [`variants/stage0-v2-two-signals.json`](variants/stage0-v2-two-signals.json) | `salienceFullMinSignals: 2` |
| [`variants/stage0-v3-breadth-not-full.json`](variants/stage0-v3-breadth-not-full.json) | `salienceBreadthFull: false` |
| [`stage0-report.mjs`](stage0-report.mjs) | Summarizes the four runs into `results.json` and regenerates the STAGE0 results block and decision, folding in any exported `labels.json` |

### Reproduce Stage 0 (about 10 minutes with a warm cache, Node ≥ 22.6 and git)

```bash
# 1. hono at the pinned commit, blobless, outside this repo
git clone --filter=blob:none --no-checkout https://github.com/honojs/hono.git ~/.cache/gutter-bench/honojs__hono
git -C ~/.cache/gutter-bench/honojs__hono checkout eb754bd5ef22c63f1634a4c374a86be086f85710

# 2. The four runs, on the pre-GU-29 behavior (--legacy-predictions; see "GU-29" below).
#    repo-archaeology comes from devDependencies (pinned 0.10.0 since GU-28; Stage 0 itself ran on 0.4.0,
#    and STAGE0.md 0b.R1 shows the upgrade changed no headline number).
npm ci
H=~/.cache/gutter-bench/honojs__hono; OUT=/tmp/gutter-stage0
node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --legacy-predictions --out $OUT/default
for v in v1-floor v2-two-signals v3-breadth-not-full; do
  node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --legacy-predictions --config bench/variants/stage0-$v.json --out $OUT/$v
done

# 3. Results and the blinded labeling page
node bench/stage0-report.mjs --runs $OUT --write-results /tmp/results.json
node --experimental-strip-types src/cli.ts label --compare $OUT/default/bench.json --seed 1 --out /tmp/label-compare.html
```

`results.json` should match the committed one apart from run metadata: `totalWallMs`, `raVersion`, and `settingsHash` / `configOverrides` (which now record `legacyPredictions`). This was checked for the default run on 2026-11-10; every rate, lift and interval matched. The label page should be byte-identical (sample `55dc4b4e4b5e`).

### Label (HUMAN STEP)

Open [`label-compare.html`](../docs/benchmark/data/honojs__hono/stage0/label-compare.html) in any browser (it works offline), enter a name, label all 60 items, and click **Export labels.json**. Save it as `docs/benchmark/data/honojs__hono/stage0/labels.json` (a second labeler: `labels-<name>.json`), then:

```bash
node bench/stage0-report.mjs --results docs/benchmark/data/honojs__hono/stage0/results.json \
  --labels docs/benchmark/data/honojs__hono/stage0/labels.json --update docs/benchmark/STAGE0.md
```

`labels.json` shape:

```json
{
  "schemaVersion": 1, "kind": "gutter-labels", "mode": "compare",
  "sampleId": "55dc4b4e4b5e", "seed": 1, "total": 60, "exportedAt": "…",
  "bench": { "repo": "honojs/hono", "remoteUrl": "…", "headSha": "…", "settingsHash": "…", "windowDays": 7 },
  "labels": [
    { "questionId": "<prId>::<check id or baseline:<name>>::<file>", "itemId": "c01", "source": "gutter",
      "label": "useful", "note": "", "labeler": "…", "labeledAt": "…",
      "firstLabel": "useful", "changedAfterReveal": false }
  ]
}
```

## Stage 0b · option 2, proven pairs (`GU-28`)

Tests STAGE0.md section 5's option 2 with Repo Archaeology 0.10.0's per-pair `trackRecord`. Rules: STAGE0.md "Stage 0b"; data: [`docs/benchmark/data/honojs__hono/stage0b/`](../docs/benchmark/data/honojs__hono/stage0b/).

| File | What it is |
|---|---|
| [`variants/stage0b-v4-proven-pairs.json`](variants/stage0b-v4-proven-pairs.json) | `ghost` + `trackRecord.fired ≥ 3` + `interval.low ≥ 0.3` |
| [`stage0b-funnel.ts`](stage0b-funnel.ts) | Post-hoc: relationship × track record for each default companion question |

```bash
# Same hono checkout as Stage 0; npm ci installs repo-archaeology 0.10.0 (pinned)
H=~/.cache/gutter-bench/honojs__hono; OUT=/tmp/gutter-stage0b
node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --legacy-predictions --out $OUT/default
node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --legacy-predictions --config bench/variants/stage0b-v4-proven-pairs.json --out $OUT/v4-proven-pairs
node bench/stage0-report.mjs --stage0b --runs $OUT --compare-bench docs/benchmark/data/honojs__hono/stage0/default/bench.json --write-results /tmp/stage0b-results.json --stage0-results docs/benchmark/data/honojs__hono/stage0/results.json
node --experimental-strip-types bench/stage0b-funnel.ts $H $OUT/default/bench.json
```

Merge Stage 0b's PR with a merge commit, not a squash: `test/stage0b-report.test.ts` checks that the preregistration commit precedes the data commit.

## GU-29 · explain, don't predict (after Stage 0b)

GU-29 stops Gutter's default output from predicting omissions ([DECISIONS #17](../docs/DECISIONS.md#17-explain-dont-predict-gu-29)). Stage 0 and 0b now reproduce only under the research switch: pass `--legacy-predictions` (or `--config bench/variants/gu29-legacy.json`, `{ "legacyPredictions": true }`); the legacy run reproduces Stage 0b's default run record for record. `--config` refuses a variant whose keys only tune the retired companion questions (`minIntervalLow`, `maxCompanionQuestions`, `minCalibratedPrecision`, `companionRequireGhost`, `companionMinTrackRecordFired`) unless the switch is on, so a Stage 0 variant can't silently run as a no-op. Results: STAGE0.md "After GU-29"; data: [`docs/benchmark/data/honojs__hono/gu29/`](../docs/benchmark/data/honojs__hono/gu29/).

| File | What it is |
|---|---|
| [`variants/gu29-legacy.json`](variants/gu29-legacy.json) | `legacyPredictions: true`: pre-GU-29 behavior, for benchmarks only |
| [`gate-a-prime.ts`](gate-a-prime.ts) | Gate A′ (ROADMAP M0 exit test): replays every PR of a default-mode `bench.json` and re-checks each fact against git (TypeScript's `ts.resolveModuleName` for broken imports; `git diff`/`git log --follow` for unchanged tests and test history), plus the banned-words check on every rendered page. Needs the `typescript` devDependency, so it lives here, not in `src/` |
| [`gu29-report.mjs`](gu29-report.mjs) | Builds `results.json` and regenerates the "After GU-29" block in STAGE0.md |

The exact commands are in STAGE0.md, "After GU-29".

## GU-05 · Repo Archaeology's session and import resolver

`gutter bench` replay now builds "What it touches" from Repo Archaeology's import graph at each PR's head, in the same session as `diff` and `backtest`, so the bench measures what users get. Results: STAGE0.md "After GU-05"; data: [`docs/benchmark/data/honojs__hono/gu05/`](../docs/benchmark/data/honojs__hono/gu05/); report: [`gu05-report.mjs`](gu05-report.mjs), which also classifies every PR record where `--legacy-predictions` differs from Stage 0b.

## GU-30 · Gate A′ on a 20-repository corpus

Preregistered in [`docs/benchmark/CORPUS.md`](../docs/benchmark/CORPUS.md); results in [`docs/benchmark/README.md`](../docs/benchmark/README.md); how to rerun: [`docs/benchmark/REPRODUCE.md`](../docs/benchmark/REPRODUCE.md).

| File | What it is |
|---|---|
| [`corpus.json`](corpus.json), [`corpus.schema.json`](corpus.schema.json), [`corpus.mjs`](corpus.mjs) | The 20 pinned repositories and their validator |
| [`corpus-select.ts`](corpus-select.ts), [`corpus-candidates.json`](corpus-candidates.json), [`corpus-selection.json`](corpus-selection.json) | The selection rule, the saved GitHub search results it ran on, and every candidate's take/skip reason |
| [`run-corpus.mjs`](run-corpus.mjs) | Per repository: clone at the pin, `gutter bench`, `gate-a-prime.ts`, the seeded run, two backtests; resumable, 45-minute timeout, versions recorded |
| [`seeded.ts`](seeded.ts) | Seeded `broken-import` mutations and the module-resolution oracle (TS/JS, Go, Python) |
| [`aggregate.mjs`](aggregate.mjs) | Per-repository and corpus metrics, the mechanical verdict, "Where Gutter did badly"; writes `docs/benchmark/README.md` and `results.json` |

## Stage 1 · corpus (superseded by GU-30)

GU-04's planned corpus, per-question labeling mode and Gate A report were never built: Stage 0's rule said STOP, GU-29 retired Gate A (DECISIONS #17), and GU-30 built the corpus for Gate A′ instead (above). DECISIONS #17's reopen rule (a predictive rule must beat the strongest baseline on ≥ 3 corpus repos) can now use these repositories.
