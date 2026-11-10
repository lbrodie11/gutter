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

# 2. The four runs (repo-archaeology >= 0.4.0 comes from devDependencies)
npm ci
H=~/.cache/gutter-bench/honojs__hono; OUT=/tmp/gutter-stage0
node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --out $OUT/default
for v in v1-floor v2-two-signals v3-breadth-not-full; do
  node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --config bench/variants/stage0-$v.json --out $OUT/$v
done

# 3. Results and the blinded labeling page
node bench/stage0-report.mjs --runs $OUT --write-results /tmp/results.json
node --experimental-strip-types src/cli.ts label --compare $OUT/default/bench.json --seed 1 --out /tmp/label-compare.html
```

`results.json` should match the committed one apart from `totalWallMs`, and the label page should be byte-identical (sample `55dc4b4e4b5e`).

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

## Stage 1 · corpus (not built)

`corpus.json`, `run-corpus.mjs`, `aggregate.mjs`, the per-question labeling mode, and the Gate A report are built only if Stage 0's preregistered rule says continue and a human confirms. As of 2026-11-10 the rule outcome is **STOP**; see STAGE0.md section 5 for the options awaiting a decision.
