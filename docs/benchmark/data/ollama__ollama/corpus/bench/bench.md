# Gutter Benchmark Report · ollama/ollama

Branch: `HEAD` · Head: [`e9fde36`](https://github.com/ollama/ollama/commit/e9fde36d75fea66579d84099956ce1430792737a) (`e9fde36d75fea66579d84099956ce1430792737a`) · Generated: `2026-11-10T16:41:55.606Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED. Follow-up proxy 0.00 [0.00–0.06], lift N/A. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 4527 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 750 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 40 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 2646 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 1091 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 3434 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 57 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 1091 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 2 |
| `beyondPrsLimit` | 3234 |
| `historyUnavailable` | 0 |
| `noQuestions` | 80 |
| `unscorableOnly` | 58 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 5 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 57
- **PRs with questions:** 120 / 200 (0.6, [0.5308367203926201, 0.6653942143319266])
- **Total questions:** 168 (per PR: 0.84)
- **Salience `quiet`:** 53 / 200 (0.265, [0.20868154147109114, 0.3301757619262242])
- **Salience `brief`:** 147 / 200 (0.735, [0.6698242380737758, 0.7913184585289089])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 57 |
| `censored` | 5 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 106 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 57 (0, [0, 0.06313883485297894]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 57 (0, [0, 0.06313883485297894]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 57 (0, [0, 0.06313883485297894]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 57 (0, [0, 0.06313883485297894]) | — |
| Missed co-change follow-up recall proxy | 0 / 0 (N/A) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 0 untouched historical co-change partner(s) across 0 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `popular-near` · **Headline lift:** N/A · **Bootstrap CI:** N/A

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 57 | 0 (0) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | N/A | N/A |
| `popular-near` | 57 | 0 (0) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | N/A | N/A |
| `recent` | 57 | 0 (0) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | N/A | N/A |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | `popular-near` | N/A | N/A |
| Same-author follow-up | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | `popular-near` | N/A | N/A |
| RA-signal follow-up | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | `popular-near` | N/A | N/A |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 62 | 57 | 0 / 57 (0, [0, 0.06313883485297894]) | 57 | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) |
| `wide-surface` | 106 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 167 | 48 | 0 / 48 (0, [6.424720965888271e-18, 0.0741001296661175]) |
| `botOrAgentOrigin` | 23 | 4 | 0 / 4 (0, [0, 0.4898908364545973]) |
| `generatedPaths` | 4 | 1 | 0 / 1 (0, [0, 0.7934506856227626]) |
| `dependencyOrVersionOnly` | 2 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 7 | 5 | 0 / 5 (0, [0, 0.43448246478317476]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 57
- **PRs with questions:** 120 / 200 (0.6, [0.5308367203926201, 0.6653942143319266])
- **Total questions:** 168 (per PR: 0.84)
- **Salience `quiet`:** 53 / 200 (0.265, [0.20868154147109114, 0.3301757619262242])
- **Salience `brief`:** 147 / 200 (0.735, [0.6698242380737758, 0.7913184585289089])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 57 |
| `censored` | 5 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 106 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 57 (0, [0, 0.06313883485297894]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 57 (0, [0, 0.06313883485297894]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 57 (0, [0, 0.06313883485297894]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 57 (0, [0, 0.06313883485297894]) | — |
| Missed co-change follow-up recall proxy | 0 / 0 (N/A) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 0 untouched historical co-change partner(s) across 0 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `popular-near` · **Headline lift:** N/A · **Bootstrap CI:** N/A

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 57 | 0 (0) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | N/A | N/A |
| `popular-near` | 57 | 0 (0) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | N/A | N/A |
| `recent` | 57 | 0 (0) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | N/A | N/A |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | `popular-near` | N/A | N/A |
| Same-author follow-up | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | `popular-near` | N/A | N/A |
| RA-signal follow-up | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | 0 / 57 (0, [0, 0.06313883485297894]) | `popular-near` | N/A | N/A |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

_None in this run._

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#14969** ([`98acec4`](https://github.com/ollama/ollama/commit/98acec40ae2b3ed361fc5117e5b2ae81a4bf5c18)) · create: add server\-side MLX imports and drop GGUF conversion \(\#14969\) · author(s): Daniel Hiltgen
  - Question (`untested-change`, intervalLow=N/A): `x/create/inventory.go` changed \(\+21/−6\); its test file `x/create/inventory_test.go` didn't change in this PR\.
  - Target: [`x/create/inventory_test.go`](https://github.com/ollama/ollama/blob/98acec40ae2b3ed361fc5117e5b2ae81a4bf5c18/x/create/inventory_test.go) · outcome: `notFollowedUp`
- **\#16471** ([`f348c7e`](https://github.com/ollama/ollama/commit/f348c7e3f55b77da4f6269f007d1b21aacee453a)) · Honor model generation defaults \(\#16471\) · author(s): Daniel Hiltgen
  - Question (`untested-change`, intervalLow=N/A): `fs/gguf/keyvalue.go` changed \(\+27/−0\); its test file `fs/gguf/keyvalue_test.go` didn't change in this PR\.
  - Target: [`fs/gguf/keyvalue_test.go`](https://github.com/ollama/ollama/blob/f348c7e3f55b77da4f6269f007d1b21aacee453a/fs/gguf/keyvalue_test.go) · outcome: `notFollowedUp`
- **\#17381** ([`6879311`](https://github.com/ollama/ollama/commit/68793119dffb39b43b2f966bedba359dcdead5e3)) · Clean up dead code \(\#17381\) · author(s): Daniel Hiltgen
  - Question (`untested-change`, intervalLow=N/A): `ml/device.go` changed \(\+0/−318\); its test file `ml/device_test.go` didn't change in this PR\.
  - Target: [`ml/device_test.go`](https://github.com/ollama/ollama/blob/68793119dffb39b43b2f966bedba359dcdead5e3/ml/device_test.go) · outcome: `notFollowedUp`
- **\#17714** ([`2c73164`](https://github.com/ollama/ollama/commit/2c73164246534c57acfdb37cc96b39eccf4ccc81)) · nemotron\_h: add MLX vision support \(\#17714\) · author(s): Daniel Hiltgen
  - Question (`untested-change`, intervalLow=N/A): `create/nemotron_h.go` changed \(\+8/−4\); its test file `create/nemotron_h_test.go` didn't change in this PR\.
  - Target: [`create/nemotron_h_test.go`](https://github.com/ollama/ollama/blob/2c73164246534c57acfdb37cc96b39eccf4ccc81/create/nemotron_h_test.go) · outcome: `notFollowedUp`
- **\#17858** ([`ea8d650`](https://github.com/ollama/ollama/commit/ea8d65004affdae6464af1c73a55eb34f5a67eb1)) · server: extract GGUF metadata and unify capabilities \(\#17858\) · author(s): Daniel Hiltgen
  - Question (`untested-change`, intervalLow=N/A): `fs/gguf/gguf.go` changed \(\+28/−10\); its test file `fs/gguf/gguf_test.go` didn't change in this PR\.
  - Target: [`fs/gguf/gguf_test.go`](https://github.com/ollama/ollama/blob/ea8d65004affdae6464af1c73a55eb34f5a67eb1/fs/gguf/gguf_test.go) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **416144.71 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 76154.39 | 76154.39 | 76154.39 |
| `sessionOpen` | 200 | 254901.23 | 518.96 | 1199.35 |
| `staticAnalysis` | 200 | 68267.96 | 347.28 | 557.48 |
| `brief` | 200 | 1783.21 | 8.55 | 10.51 |
| `scoring` | 200 | 3862.81 | 16.05 | 34.58 |
| `report` | 1 | 28.42 | 28.42 | 28.42 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
