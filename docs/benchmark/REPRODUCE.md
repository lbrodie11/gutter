# Reproducing the Gate A′ corpus run (GU-30)

Everything here needs only **Node.js ≥ 22.6** and **git**. Nothing from the analyzed repositories is installed, built or run: Gutter reads their history and files from git, and its oracles (TypeScript's own module resolver, Go module paths, Python module names) read the same blobs.

The rules are preregistered in [`CORPUS.md`](CORPUS.md); the corpus is [`bench/corpus.json`](../../bench/corpus.json); results are in [`README.md`](README.md) and [`results.json`](results.json).

## 1. Set up Gutter

```bash
git clone https://github.com/lbrodie11/gutter.git
cd gutter
npm ci        # installs the pinned repo-archaeology (0.10.0) and TypeScript used by the oracles
```

Clones go to `$GUTTER_BENCH_CACHE` (default `~/.cache/gutter-bench`), blobless, checked out at each repository's pinned SHA.

## 2. Rerun one repository (under 45 minutes)

```bash
node bench/run-corpus.mjs --only honojs__hono --jobs 1
```

This runs, for that repository only, the steps in `CORPUS.md` §2: clone at the pin; `gutter bench --prs 200 --window-days 7`; `bench/gate-a-prime.ts`; the seeded mutations (`bench/seeded.ts`, seed 20261110); and the two Repo Archaeology backtests. Output goes to `docs/benchmark/data/honojs__hono/corpus/`, with per-step status in `status.json`. `--only` takes any `owner__repo` from the corpus, or several, comma-separated.

A killed run resumes where it stopped: run the same command again. `--fresh` discards that repository's earlier output first. `--timeout-min <n>` changes the per-repository budget (default 45; it was 45 for the published run).

The individual steps, if you want to run them by hand:

```bash
H=~/.cache/gutter-bench/honojs__hono; D=docs/benchmark/data/honojs__hono/corpus
node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --out $D/bench
node --experimental-strip-types bench/gate-a-prime.ts $H $D/bench/bench.json --out $D/gate-a-prime.json
node --experimental-strip-types bench/seeded.ts --cwd $H --language typescript --bench $D/bench/bench.json --out $D/seeded --name honojs/hono
(cd $H && node "$OLDPWD/node_modules/repo-archaeology/dist/cli.js" backtest --json) > $D/backtest.json
```

## 3. Rerun the whole corpus

```bash
node bench/run-corpus.mjs --jobs 2
node bench/aggregate.mjs --write     # regenerates docs/benchmark/README.md and results.json
```

The published run took several hours on the machine named in `README.md` ("Environment"). The largest repositories dominate; a repository that exceeds its 45 minutes is listed as `failed: timeout`, never dropped.

### Rerun 1 (GU-31, `CORPUS.md` §6)

Rerun 1 keeps each repository's GU-30 `bench.json` (`corpus/bench/`) and reruns only the gate replay (Gate A′ (a) and (c), and the real-PR facts, measured with the current code) and the seeded check with the new seed:

```bash
node bench/run-corpus.mjs --rerun rerun1 --seed 20261111 --jobs 2
node bench/aggregate.mjs --write     # also writes results-rerun1.json; README.md shows both runs
```

It writes `docs/benchmark/data/<owner>__<repo>/rerun1/` and `docs/benchmark/data/rerun1-run.json`. `test/gu31-bench.test.ts` checks that `results-rerun1.json` is what the aggregator computes from that data.

## 4. What should match

- **Exactly:** the corpus and pins; the seeded mutations and their commit ids (fixed seed, fixed author, committer and date); every oracle verdict; `gutter bench`'s PR selection, salience and checklist on the same pins and Repo Archaeology version. `test/gu30-aggregate.test.ts` checks that `README.md` is rendered from `results.json` and that `results.json` is what the aggregator computes from the committed raw data.
- **Not exactly:** wall times and replay times (machine-dependent), and anything that reads the network (the clone itself).

## 5. Rerun the selection (optional)

The corpus was chosen on 2026-11-10 from saved search results, so it can be re-derived without GitHub:

```bash
node --experimental-strip-types bench/corpus-select.ts   # re-selects from bench/corpus-candidates.json
```

`--search` refreshes the candidates from GitHub (`gh` CLI), which will not reproduce the 2026-11-10 lists.
