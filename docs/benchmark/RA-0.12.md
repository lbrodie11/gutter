# Repo Archaeology 0.10.0 → 0.12.0: per-PR delta and the base graph's cost

GU-31 moved the bench's analyzer pin from `repo-archaeology` 0.10.0 to 0.12.0 and adopted RA-20 (`importGraph({ files, at })` and Python/Go edge `role`s; DECISIONS #20). DECISIONS #16 asks that every analyzer upgrade be reported as a per-PR delta against the previous run, so analyzer changes are never mistaken for a variant's effect. This page is that report. It is a measurement, not a gate: no verdict depends on it, and Rerun 1's verdict (on 0.10.0, `README.md`) is unchanged.

**What ran.** `bench/gate-a-prime.ts` replayed the same 200 real merged PRs per repository as GU-30 and Rerun 1 (`corpus/bench/bench.json`), on hono (`eb754bd`) and on `allianz/ng-aquila` (`5b23a36`, the largest corpus repository), two repositories at a time, as in Rerun 1. Three runs, compared PR by PR with [`bench/replay-delta.mjs`](../../bench/replay-delta.mjs) (salience, checklist kinds, `coverage`, `dependents.method`):

| Run | Code | Analyzer | Data |
|---|---|---|---|
| Rerun 1 | GU-31 at `95d1e9a` (second base session) | 0.10.0 | `data/<repo>/rerun1/gate-a-prime.json` |
| Analyzer only | same code as Rerun 1's logic, second base session | 0.12.0 | `data/<repo>/ra012-analyzer/gate-a-prime.json` |
| RA-20 adopted | `importGraph({ files, at })` on the head session, Python `role`s | 0.12.0 | `data/<repo>/ra012/gate-a-prime.json` |

## Per-PR delta

| Repository | Rerun 1 → analyzer only | Analyzer only → RA-20 adopted |
|---|---|---|
| `honojs/hono` | 0 of 200 PRs changed | 0 of 200 PRs changed |
| `allianz/ng-aquila` | 0 of 200 PRs changed | 0 of 200 PRs changed |

No salience, checklist kind, coverage or method changed on any of the 400 PRs, in either step. Gate A′ on both repositories is as in Rerun 1: no `full` page; `untested-change` and test-history facts all confirmed (hono 10/10 and 43/43, ng-aquila 20/20 and 24/24); no banned words. Real merged PRs almost never remove an imported file, so the Python `role` rule is not exercised here. A smoke run of the seeded harness on two Python repositories with a throwaway seed (not data) found no regression; the next preregistered run (GU-33) measures it.

## Cost of the base graph (PRs that remove a file)

Per-PR replay wall time, ms, nearest-rank percentiles, product path (no cache). "Without" is the same PR replayed again with the base graph off, right after, so warm caches favor it and the growth is an upper bound. "Base graph" is its own wall time: a second session before RA-20, the `at` call on the head session after.

| Repository (PRs removing a file) | Run | Replay p50 / p95, with | Without | p95 growth | Base graph p50 / p95 |
|---|---|---|---|---:|---|
| `honojs/hono` (10) | Rerun 1 (0.10.0, second session) | 930 / 1801 | 597 / 696 | 159% | 666 / 1121 |
| | Analyzer only (0.12.0, second session) | 1178 / 2124 | 715 / 1261 | 68% | 786 / 1589 |
| | RA-20 adopted (0.12.0, `at`) | 1102 / 2125 | 999 / 1436 | 48% | 83 / 250 |
| `allianz/ng-aquila` (19) | Rerun 1 (0.10.0, second session) | 1763 / 3201 | 1130 / 1663 | 92% | 1277 / 2565 |
| | Analyzer only (0.12.0, second session) | 2065 / 5063 | 1328 / 4352 | 16% | 1499 / 4180 |
| | RA-20 adopted (0.12.0, `at`) | 1408 / 3927 | 1217 / 3676 | 7% | 140 / 487 |

The base graph itself is 8–9× cheaper at p50 and 4–5× at p95, in line with Repo Archaeology's own measurement (RA-20: 19% of a second session at p95 on ng-aquila, 31% on hono). The growth it adds to a removing PR's replay is now within GU-31's +50% p95 budget on both repositories (hono only just). Absolute replay times are noisier than in Rerun 1: the later runs shared the machine with other load (PRs that remove nothing slowed down too: hono p50 611 → 986 ms), which is why the comparison that matters is with vs without inside each run.

## Reproduce

```bash
npm ci   # repo-archaeology 0.12.0 (pinned)
for s in honojs__hono allianz__ng-aquila; do
  node --experimental-strip-types bench/gate-a-prime.ts ~/.cache/gutter-bench/$s \
    docs/benchmark/data/$s/corpus/bench/bench.json --out /tmp/$s-gate.json
  node bench/replay-delta.mjs docs/benchmark/data/$s/ra012/gate-a-prime.json /tmp/$s-gate.json
done
```

For the "analyzer only" run, check out `bca4429` (the last commit before RA-20 was adopted) and install 0.12.0 (`npm i --no-save repo-archaeology@0.12.0`).
