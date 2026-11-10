# Gutter Benchmark Report · team\-telnyx/telnyx\-node

Branch: `HEAD` · Head: [`db3dd00`](https://github.com/team-telnyx/telnyx-node/commit/db3dd007839c35b3adb454606c23f216f98deb7c) (`db3dd007839c35b3adb454606c23f216f98deb7c`) · Generated: `2026-11-10T17:53:26.010Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=7 < 30). Follow-up proxy 0.00 [0.00–0.35], lift ×0.00 vs recent. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 443 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 0 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 1 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 384 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 58 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 381 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 7 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 58 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 4 |
| `beyondPrsLimit` | 181 |
| `historyUnavailable` | 0 |
| `noQuestions` | 117 |
| `unscorableOnly` | 76 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 7
- **PRs with questions:** 83 / 200 (0.415, [0.3489428544975757, 0.4842608509865596])
- **Total questions:** 90 (per PR: 0.45)
- **Salience `quiet`:** 46 / 200 (0.23, [0.17709343259068808, 0.2930830436530359])
- **Salience `brief`:** 154 / 200 (0.77, [0.7069169563469642, 0.8229065674093119])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 7 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 83 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | — |
| Missed co-change follow-up recall proxy | 0 / 26 (0, [0, 0.1287289218592153]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 26 untouched historical co-change partner(s) across 20 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0 · **Bootstrap CI:** [0, 0] (median 0, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 7 | 0 (0) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `popular-near` | 7 | 0 (0) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | N/A | N/A |
| `recent` | 4 | 3 (3) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 1 / 4 (0.25, [0.045587260809700575, 0.6993581574175981]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 7 | 7 | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 7 | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) |
| `wide-surface` | 83 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 44 | 0 | 0 / 0 (N/A) |
| `botOrAgentOrigin` | 129 | 3 | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) |
| `generatedPaths` | 150 | 7 | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) |
| `dependencyOrVersionOnly` | 2 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 15 | 4 | 0 / 4 (0, [0, 0.4898908364545973]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 7
- **PRs with questions:** 83 / 200 (0.415, [0.3489428544975757, 0.4842608509865596])
- **Total questions:** 90 (per PR: 0.45)
- **Salience `quiet`:** 46 / 200 (0.23, [0.17709343259068808, 0.2930830436530359])
- **Salience `brief`:** 154 / 200 (0.77, [0.7069169563469642, 0.8229065674093119])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 7 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 83 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | — |
| Missed co-change follow-up recall proxy | 0 / 26 (0, [0, 0.1287289218592153]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 26 untouched historical co-change partner(s) across 20 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0 · **Bootstrap CI:** [0, 0] (median 0, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 7 | 0 (0) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `popular-near` | 7 | 0 (0) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | N/A | N/A |
| `recent` | 4 | 3 (3) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 3 / 4 (0.75, [0.3006418425824019, 0.9544127391902995]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 1 / 4 (0.25, [0.045587260809700575, 0.6993581574175981]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

_None in this run._

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#313** ([`fe4bdb9`](https://github.com/team-telnyx/telnyx-node/commit/fe4bdb9e27a61dc9d16d779551dca47bd316ac5f)) · release: 5\.45\.0 \(\#313\) · author(s): stainless\-app\[bot\]
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/options.ts` changed \(\+10/−1\); its test file `packages/mcp-server/tests/options.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/options.test.ts`](https://github.com/team-telnyx/telnyx-node/blob/fe4bdb9e27a61dc9d16d779551dca47bd316ac5f/packages/mcp-server/tests/options.test.ts) · outcome: `notFollowedUp`
- **\#321** ([`0908ab9`](https://github.com/team-telnyx/telnyx-node/commit/0908ab94a7cc8b2ce1e21d586e33caf66b8b6315)) · release: 5\.51\.1 \(\#321\) · author(s): stainless\-app\[bot\]
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/options.ts` changed \(\+11/−0\); its test file `packages/mcp-server/tests/options.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/options.test.ts`](https://github.com/team-telnyx/telnyx-node/blob/0908ab94a7cc8b2ce1e21d586e33caf66b8b6315/packages/mcp-server/tests/options.test.ts) · outcome: `notFollowedUp`
- **\#367** ([`7c101bd`](https://github.com/team-telnyx/telnyx-node/commit/7c101bdb0e75513f640e8bf55199e056b55e7276)) · release: 6\.29\.3 \(\#367\) · author(s): stainless\-app\[bot\]
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/options.ts` changed \(\+24/−0\); its test file `packages/mcp-server/tests/options.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/options.test.ts`](https://github.com/team-telnyx/telnyx-node/blob/7c101bdb0e75513f640e8bf55199e056b55e7276/packages/mcp-server/tests/options.test.ts) · outcome: `notFollowedUp`
- **\#463** ([`dbc903d`](https://github.com/team-telnyx/telnyx-node/commit/dbc903d38ad8501d59d6d9ea471180e767599ae2)) · release: 7\.4\.0 \(\#463\) · author(s): ankitTelnyx
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/options.ts` changed \(\+10/−36\); its test file `packages/mcp-server/tests/options.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/options.test.ts`](https://github.com/team-telnyx/telnyx-node/blob/dbc903d38ad8501d59d6d9ea471180e767599ae2/packages/mcp-server/tests/options.test.ts) · outcome: `notFollowedUp`
- **\#506** ([`def54c1`](https://github.com/team-telnyx/telnyx-node/commit/def54c17ffaf86d18cf65acf8ae159a09bef0c2e)) · chore: sync code from next into release PR \(\#506\) · author(s): ankitTelnyx
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/code-tool-worker.ts` changed \(\+33/−0\); its test file `packages/mcp-server/tests/code-tool-worker.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/code-tool-worker.test.ts`](https://github.com/team-telnyx/telnyx-node/blob/def54c17ffaf86d18cf65acf8ae159a09bef0c2e/packages/mcp-server/tests/code-tool-worker.test.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **331070.58 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 9022.76 | 9022.76 | 9022.76 |
| `sessionOpen` | 200 | 226026.93 | 547.1 | 885.1 |
| `staticAnalysis` | 200 | 80845.42 | 366.28 | 673.05 |
| `brief` | 200 | 1862.02 | 9.16 | 10.42 |
| `scoring` | 200 | 2360.82 | 11.5 | 13.72 |
| `report` | 1 | 33.68 | 33.68 | 33.68 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
