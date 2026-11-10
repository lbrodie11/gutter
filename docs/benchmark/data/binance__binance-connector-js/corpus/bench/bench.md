# Gutter Benchmark Report · binance/binance\-connector\-js

Branch: `HEAD` · Head: [`62a2ec1`](https://github.com/binance/binance-connector-js/commit/62a2ec1a164f8e2238b81f5163b5d08f073d56f5) (`62a2ec1a164f8e2238b81f5163b5d08f073d56f5`) · Generated: `2026-11-10T16:10:18.088Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=0 < 30). Follow-up proxy N/A, lift N/A. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 1526 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 42 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 0 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 263 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 1221 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 304 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 0 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 1221 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 1 |
| `beyondPrsLimit` | 104 |
| `historyUnavailable` | 0 |
| `noQuestions` | 157 |
| `unscorableOnly` | 43 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 0
- **PRs with questions:** 43 / 200 (0.215, [0.1637187625450758, 0.27702307348996613])
- **Total questions:** 43 (per PR: 0.215)
- **Salience `quiet`:** 85 / 200 (0.425, [0.3585361254351385, 0.49429067352145145])
- **Salience `brief`:** 115 / 200 (0.575, [0.5057093264785485, 0.6414638745648615])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 0 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 43 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 0 (N/A) | N/A |
| Question-level follow-up rate | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 0 (N/A) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 0 (N/A) | — |
| Missed co-change follow-up recall proxy | 0 / 9 (0, [0, 0.2991450484195441]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 9 untouched historical co-change partner(s) across 8 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** N/A · **Headline lift:** N/A · **Bootstrap CI:** N/A

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 0 | 0 (0) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A |
| `popular-near` | 0 | 0 (0) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A |
| `recent` | 0 | 0 (0) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A | N/A |
| Same-author follow-up | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A | N/A |
| RA-signal follow-up | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A | N/A |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `wide-surface` | 43 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 10 | 0 | 0 / 0 (N/A) |
| `botOrAgentOrigin` | 0 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 188 | 0 | 0 / 0 (N/A) |
| `dependencyOrVersionOnly` | 77 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 9 | 0 | 0 / 0 (N/A) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 0
- **PRs with questions:** 43 / 200 (0.215, [0.1637187625450758, 0.27702307348996613])
- **Total questions:** 43 (per PR: 0.215)
- **Salience `quiet`:** 85 / 200 (0.425, [0.3585361254351385, 0.49429067352145145])
- **Salience `brief`:** 115 / 200 (0.575, [0.5057093264785485, 0.6414638745648615])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 0 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 43 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 0 (N/A) | N/A |
| Question-level follow-up rate | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 0 (N/A) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 0 (N/A) | — |
| Missed co-change follow-up recall proxy | 0 / 9 (0, [0, 0.2991450484195441]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 9 untouched historical co-change partner(s) across 8 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** N/A · **Headline lift:** N/A · **Bootstrap CI:** N/A

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 0 | 0 (0) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A |
| `popular-near` | 0 | 0 (0) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A |
| `recent` | 0 | 0 (0) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A | N/A |
| Same-author follow-up | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A | N/A |
| RA-signal follow-up | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | 0 / 0 (N/A) | N/A | N/A | N/A |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

_None in this run._

### Five Worst Questions (`notFollowedUp` despite high confidence)

_None in this run._

## Runtime per Stage

Total wall time: **1108364.02 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 18296.96 | 18296.96 | 18296.96 |
| `sessionOpen` | 200 | 965711.74 | 952.94 | 1201.43 |
| `staticAnalysis` | 200 | 107013.51 | 408.53 | 1060.53 |
| `brief` | 200 | 2003.48 | 9.32 | 11.86 |
| `scoring` | 200 | 3526.74 | 16.83 | 20.41 |
| `report` | 1 | 21.7 | 21.7 | 21.7 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
