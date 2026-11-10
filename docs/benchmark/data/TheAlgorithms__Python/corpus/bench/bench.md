# Gutter Benchmark Report · TheAlgorithms/Python

Branch: `HEAD` · Head: [`574d100`](https://github.com/TheAlgorithms/Python/commit/574d100b7181956e9c8384552fd078165e4cc326) (`574d100b7181956e9c8384552fd078165e4cc326`) · Generated: `2026-11-10T16:49:55.405Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=0 < 30). Follow-up proxy N/A, lift N/A. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 3696 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 247 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 21 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 3327 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 101 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 3581 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 0 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 101 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 14 |
| `beyondPrsLimit` | 3381 |
| `historyUnavailable` | 0 |
| `noQuestions` | 200 |
| `unscorableOnly` | 0 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 0
- **PRs with questions:** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])
- **Total questions:** 0 (per PR: 0)
- **Salience `quiet`:** 193 / 200 (0.965, [0.9295293884777093, 0.9829444579914328])
- **Salience `brief`:** 7 / 200 (0.035, [0.017055542008567195, 0.07047061152229074])
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
| `unscorable` | 0 |
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
| Missed co-change follow-up recall proxy | 0 / 358 (0, [0, 0.010616414252844672]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 358 untouched historical co-change partner(s) across 70 PR(s) changed within the observation window without a Gutter question._

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
| `wide-surface` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 176 | 0 | 0 / 0 (N/A) |
| `botOrAgentOrigin` | 20 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 4 | 0 | 0 / 0 (N/A) |
| `dependencyOrVersionOnly` | 1 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 0 | 0 | 0 / 0 (N/A) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 0
- **PRs with questions:** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])
- **Total questions:** 0 (per PR: 0)
- **Salience `quiet`:** 193 / 200 (0.965, [0.9295293884777093, 0.9829444579914328])
- **Salience `brief`:** 7 / 200 (0.035, [0.017055542008567195, 0.07047061152229074])
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
| `unscorable` | 0 |
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
| Missed co-change follow-up recall proxy | 0 / 358 (0, [0, 0.010616414252844672]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 358 untouched historical co-change partner(s) across 70 PR(s) changed within the observation window without a Gutter question._

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

Total wall time: **285570.63 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 34959.96 | 34959.96 | 34959.96 |
| `sessionOpen` | 200 | 174084.09 | 561.85 | 661.18 |
| `staticAnalysis` | 200 | 61261.86 | 327.39 | 800.84 |
| `brief` | 200 | 1772.94 | 8.57 | 10.09 |
| `scoring` | 200 | 2890.7 | 13.72 | 17.75 |
| `report` | 1 | 17.72 | 17.72 | 17.72 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
