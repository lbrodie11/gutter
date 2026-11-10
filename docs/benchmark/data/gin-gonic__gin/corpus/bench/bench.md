# Gutter Benchmark Report · gin\-gonic/gin

Branch: `HEAD` · Head: [`0f09c3a`](https://github.com/gin-gonic/gin/commit/0f09c3a9b4626d9fe9979cf4d0521d6ae32ab646) (`0f09c3a9b4626d9fe9979cf4d0521d6ae32ab646`) · Generated: `2026-11-10T16:45:13.999Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=5 < 30). Follow-up proxy 0.40 [0.12–0.77], lift ×2.00 vs popular-near. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 1314 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 31 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 34 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 1085 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 164 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 1149 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 5 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 164 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 1 |
| `beyondPrsLimit` | 949 |
| `historyUnavailable` | 0 |
| `noQuestions` | 179 |
| `unscorableOnly` | 15 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 1 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 5
- **PRs with questions:** 21 / 200 (0.105, [0.06970748792681018, 0.15518031991123038])
- **Total questions:** 21 (per PR: 0.105)
- **Salience `quiet`:** 159 / 200 (0.795, [0.7337430194757748, 0.845138237961638])
- **Salience `brief`:** 41 / 200 (0.205, [0.15486176203836208, 0.26625698052422514])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 2 |
| `notFollowedUp` | 3 |
| `censored` | 1 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 15 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | [0, 0.8] (median 0.4, n=1000, seed=20261108) |
| Question-level follow-up rate | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 5 (0, [0, 0.43448246478317476]) | — |
| Same-author share of `followedUp` | 0 / 2 (0, [0, 0.6576197724933469]) | — |
| RA-signal follow-up rate | 0 / 5 (0, [0, 0.43448246478317476]) | — |
| Missed co-change follow-up recall proxy | 0 / 560 (0, [4.3072619587908796e-19, 0.006813012346996886]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 560 untouched historical co-change partner(s) across 122 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `popular-near` · **Headline lift:** ×2 · **Bootstrap CI:** [0, 4] (median 1, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 5 | 0 (0) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 0 / 5 (0, [0, 0.43448246478317476]) | ×2 | [0, 4] (median 1, n=1000, seed=20261108) |
| `popular-near` | 5 | 0 (0) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 0 / 5 (0, [0, 0.43448246478317476]) | ×2 | [0, 4] (median 1, n=1000, seed=20261108) |
| `recent` | 5 | 0 (0) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | ×2 | [0, 4] (median 1, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | `popular-near` | ×2 | [0, ∞] (median 2, n=1000, seed=20261108, 305 unbounded) |
| Same-author follow-up | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | `popular-near` | N/A | N/A |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 6 | 5 | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | 5 | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | 0 / 5 (0, [0, 0.43448246478317476]) |
| `wide-surface` | 15 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 136 | 5 | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) |
| `botOrAgentOrigin` | 47 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 51 | 0 | 0 / 0 (N/A) |
| `dependencyOrVersionOnly` | 42 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 0 | 0 | 0 / 0 (N/A) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 5
- **PRs with questions:** 21 / 200 (0.105, [0.06970748792681018, 0.15518031991123038])
- **Total questions:** 21 (per PR: 0.105)
- **Salience `quiet`:** 159 / 200 (0.795, [0.7337430194757748, 0.845138237961638])
- **Salience `brief`:** 41 / 200 (0.205, [0.15486176203836208, 0.26625698052422514])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 2 |
| `notFollowedUp` | 3 |
| `censored` | 1 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 15 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | [0, 0.8] (median 0.4, n=1000, seed=20261108) |
| Question-level follow-up rate | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 5 (0, [0, 0.43448246478317476]) | — |
| Same-author share of `followedUp` | 0 / 2 (0, [0, 0.6576197724933469]) | — |
| RA-signal follow-up rate | 0 / 5 (0, [0, 0.43448246478317476]) | — |
| Missed co-change follow-up recall proxy | 0 / 560 (0, [4.3072619587908796e-19, 0.006813012346996886]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 560 untouched historical co-change partner(s) across 122 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `popular-near` · **Headline lift:** ×2 · **Bootstrap CI:** [0, 4] (median 1, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 5 | 0 (0) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 0 / 5 (0, [0, 0.43448246478317476]) | ×2 | [0, 4] (median 1, n=1000, seed=20261108) |
| `popular-near` | 5 | 0 (0) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 0 / 5 (0, [0, 0.43448246478317476]) | ×2 | [0, 4] (median 1, n=1000, seed=20261108) |
| `recent` | 5 | 0 (0) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | ×2 | [0, 4] (median 1, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 2 / 5 (0.4, [0.11762077423264786, 0.769275718723987]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | `popular-near` | ×2 | [0, ∞] (median 2, n=1000, seed=20261108, 305 unbounded) |
| Same-author follow-up | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 1 / 5 (0.2, [0.03622410863243013, 0.6244653702374747]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | 0 / 5 (0, [0, 0.43448246478317476]) | `popular-near` | N/A | N/A |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#4437** ([`93ff771`](https://github.com/gin-gonic/gin/commit/93ff771e6dbf10e432864b30f3719ac5c84a4d4a)) · ci\(sec\): improve type safety and server organization in HTTP middleware \(\#4437\) · author(s): Bo\-Yi Wu
  - Question (`untested-change`, intervalLow=N/A): `gin.go` changed \(\+28/−10\); its test file `gin_test.go` didn't change in this PR\.
  - Target: [`gin_test.go`](https://github.com/gin-gonic/gin/blob/93ff771e6dbf10e432864b30f3719ac5c84a4d4a/gin_test.go) · outcome: `followedUp` in [`5fad976`](https://github.com/gin-gonic/gin/commit/5fad976b372e381312f8de69f0969f1284d229d3) (10.31h, sameAuthor=false)
- **\#4414** ([`440eb14`](https://github.com/gin-gonic/gin/commit/440eb14ab8ed503d4a31dfecc9946a90cd73b955)) · perf\(path\): replace regex with custom functions in redirectTrailingSlash \(\#4414\) · author(s): Name
  - Question (`untested-change`, intervalLow=N/A): `gin.go` changed \(\+13/−8\); its test file `gin_test.go` didn't change in this PR\.
  - Target: [`gin_test.go`](https://github.com/gin-gonic/gin/blob/440eb14ab8ed503d4a31dfecc9946a90cd73b955/gin_test.go) · outcome: `followedUp` in [`771dcc6`](https://github.com/gin-gonic/gin/commit/771dcc6476d7bc6abb9ec0235ecefa4d38fe6fb0) (18.39h, sameAuthor=false)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#4246** ([`2e22e50`](https://github.com/gin-gonic/gin/commit/2e22e5085960205fbb11c25776f6ea76b8053253)) · perf\(tree\): optimize path parsing using strings\.Count \(\#4246\) · author(s): Name
  - Question (`untested-change`, intervalLow=N/A): `tree.go` changed \(\+4/−14\); its test file `tree_test.go` didn't change in this PR\.
  - Target: [`tree_test.go`](https://github.com/gin-gonic/gin/blob/2e22e5085960205fbb11c25776f6ea76b8053253/tree_test.go) · outcome: `notFollowedUp`
- **\#4395** ([`c0048f6`](https://github.com/gin-gonic/gin/commit/c0048f645ee945c4db30593afdea10123e2c30a6)) · refactor\(context\): omit the return value names \(\#4395\) · author(s): wanghaolong613
  - Question (`untested-change`, intervalLow=N/A): `context.go` changed \(\+32/−32\); its test file `context_test.go` didn't change in this PR\.
  - Target: [`context_test.go`](https://github.com/gin-gonic/gin/blob/c0048f645ee945c4db30593afdea10123e2c30a6/context_test.go) · outcome: `notFollowedUp`
- **\#4428** ([`58135f0`](https://github.com/gin-gonic/gin/commit/58135f06cf206a9ff713eb14150ef04a05b031d4)) · docs\(context\): add example comments for ShouldBind\* methods \(\#4428\) · author(s): AtoriUzawa
  - Question (`untested-change`, intervalLow=N/A): `context.go` changed \(\+30/−0\); its test file `context_test.go` didn't change in this PR\.
  - Target: [`context_test.go`](https://github.com/gin-gonic/gin/blob/58135f06cf206a9ff713eb14150ef04a05b031d4/context_test.go) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **122598.23 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 3811.04 | 3811.04 | 3811.04 |
| `sessionOpen` | 200 | 35142.92 | 163.38 | 196.38 |
| `staticAnalysis` | 200 | 69321.93 | 321.49 | 694.63 |
| `brief` | 200 | 1717.78 | 8.29 | 10.32 |
| `scoring` | 200 | 2110.38 | 10.23 | 12.35 |
| `report` | 1 | 19.58 | 19.58 | 19.58 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
