# Gutter Benchmark Report · fatedier/frp

Branch: `HEAD` · Head: [`331abd5`](https://github.com/fatedier/frp/commit/331abd5aa144e3f105abba29a22af701acf1a298) (`331abd5aa144e3f105abba29a22af701acf1a298`) · Generated: `2026-11-10T16:41:10.477Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=25 < 30). Follow-up proxy 0.08 [0.02–0.25], lift ×0.25 vs popular. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 353 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 110 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 8 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 225 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 10 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 343 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 25 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 10 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 0 |
| `beyondPrsLimit` | 143 |
| `historyUnavailable` | 0 |
| `noQuestions` | 103 |
| `unscorableOnly` | 72 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 25
- **PRs with questions:** 97 / 200 (0.485, [0.41667385171877513, 0.5538915080725427])
- **Total questions:** 117 (per PR: 0.585)
- **Salience `quiet`:** 73 / 200 (0.365, [0.301405264649268, 0.433682973472594])
- **Salience `brief`:** 127 / 200 (0.635, [0.566317026527406, 0.698594735350732])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 2 |
| `notFollowedUp` | 23 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 92 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | [0, 0.2] (median 0.08, n=1000, seed=20261108) |
| Question-level follow-up rate | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | — |
| Same-author share of `followedUp` | 0 / 2 (0, [0, 0.6576197724933469]) | — |
| RA-signal follow-up rate | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | — |
| Missed co-change follow-up recall proxy | 0 / 613 (0, [4.30980066096243e-19, 0.006227627481522404]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 613 untouched historical co-change partner(s) across 121 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `popular` · **Headline lift:** ×0.25 · **Bootstrap CI:** [0, 1] (median 0.2222, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 25 | 0 (0) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | ×0.25 | [0, 1] (median 0.2222, n=1000, seed=20261108) |
| `popular-near` | 25 | 0 (0) | 7 / 25 (0.28, [0.14283853850956563, 0.47576605190361576]) | 7 / 25 (0.28, [0.14283853850956563, 0.47576605190361576]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | ×0.2857 | [0, 1] (median 0.25, n=1000, seed=20261108) |
| `recent` | 25 | 0 (0) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | ×0.3333 | [0, 1.5] (median 0.2929, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 7 / 25 (0.28, [0.14283853850956563, 0.47576605190361576]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | `popular` | ×0.25 | [0, 1] (median 0.2222, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | `popular` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | 4 / 25 (0.16, [0.0640345145667644, 0.3465362160717886]) | 5 / 25 (0.2, [0.08860584686802572, 0.3913095036954033]) | 4 / 25 (0.16, [0.0640345145667644, 0.3465362160717886]) | `popular-near` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 25 | 25 | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | 25 | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) |
| `wide-surface` | 92 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 164 | 22 | 2 / 22 (0.0909, [0.025295428990995277, 0.27814946841605814]) |
| `botOrAgentOrigin` | 1 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 35 | 3 | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) |
| `dependencyOrVersionOnly` | 10 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 3 | 2 | 0 / 2 (0, [0, 0.6576197724933469]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 25
- **PRs with questions:** 97 / 200 (0.485, [0.41667385171877513, 0.5538915080725427])
- **Total questions:** 117 (per PR: 0.585)
- **Salience `quiet`:** 73 / 200 (0.365, [0.301405264649268, 0.433682973472594])
- **Salience `brief`:** 127 / 200 (0.635, [0.566317026527406, 0.698594735350732])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 2 |
| `notFollowedUp` | 23 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 92 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | [0, 0.2] (median 0.08, n=1000, seed=20261108) |
| Question-level follow-up rate | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | — |
| Same-author share of `followedUp` | 0 / 2 (0, [0, 0.6576197724933469]) | — |
| RA-signal follow-up rate | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | — |
| Missed co-change follow-up recall proxy | 0 / 613 (0, [4.30980066096243e-19, 0.006227627481522404]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 613 untouched historical co-change partner(s) across 121 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `popular` · **Headline lift:** ×0.25 · **Bootstrap CI:** [0, 1] (median 0.2222, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 25 | 0 (0) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | ×0.25 | [0, 1] (median 0.2222, n=1000, seed=20261108) |
| `popular-near` | 25 | 0 (0) | 7 / 25 (0.28, [0.14283853850956563, 0.47576605190361576]) | 7 / 25 (0.28, [0.14283853850956563, 0.47576605190361576]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | ×0.2857 | [0, 1] (median 0.25, n=1000, seed=20261108) |
| `recent` | 25 | 0 (0) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | ×0.3333 | [0, 1.5] (median 0.2929, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 2 / 25 (0.08, [0.022220401284847566, 0.24966108950395313]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 7 / 25 (0.28, [0.14283853850956563, 0.47576605190361576]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | `popular` | ×0.25 | [0, 1] (median 0.2222, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | 8 / 25 (0.32, [0.1720519030690798, 0.5158973072689776]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | 6 / 25 (0.24, [0.11496313693401443, 0.4342968335542907]) | `popular` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 25 (0, [1.2029374011637166e-17, 0.1331922509390485]) | 4 / 25 (0.16, [0.0640345145667644, 0.3465362160717886]) | 5 / 25 (0.2, [0.08860584686802572, 0.3913095036954033]) | 4 / 25 (0.16, [0.0640345145667644, 0.3465362160717886]) | `popular-near` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#5547** ([`d563610`](https://github.com/fatedier/frp/commit/d5636108e659ea6ba177aa347ffec008bb10fe3e)) · \[fix\] race condition when trying to reconnect \(\#5547\) · author(s): Sebastian
  - Question (`untested-change`, intervalLow=N/A): `client/service.go` changed \(\+15/−4\); its test file `client/service_test.go` didn't change in this PR\.
  - Target: [`client/service_test.go`](https://github.com/fatedier/frp/blob/d5636108e659ea6ba177aa347ffec008bb10fe3e/client/service_test.go) · outcome: `followedUp` in [`4cd4747`](https://github.com/fatedier/frp/commit/4cd4747525bc4be523ead8a0bd061026378eef24) (1.1h, sameAuthor=false)
- **\#5204** ([`cb459b0`](https://github.com/fatedier/frp/commit/cb459b02b618850300b9c3d1aae9cb716d3487bf)) · fix: WebsocketListener nil panic and OIDC auth data race \(\#5204\) · author(s): fatedier
  - Question (`untested-change`, intervalLow=N/A): `pkg/auth/oidc.go` changed \(\+12/−8\); its test file `pkg/auth/oidc_test.go` didn't change in this PR\.
  - Target: [`pkg/auth/oidc_test.go`](https://github.com/fatedier/frp/blob/cb459b02b618850300b9c3d1aae9cb716d3487bf/pkg/auth/oidc_test.go) · outcome: `followedUp` in [`94a631f`](https://github.com/fatedier/frp/commit/94a631fe9c22491672b016413bb4d68067adeafb) (127.55h, sameAuthor=false)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#4990** ([`abf4942`](https://github.com/fatedier/frp/commit/abf4942e8a48dacf3689982d41c23a0bfc3470a9)) · auth: enhance OIDC client with TLS and proxy configuration options \(\#4990\) · author(s): fatedier
  - Question (`untested-change`, intervalLow=N/A): `pkg/auth/oidc.go` changed \(\+68/−3\); its test file `pkg/auth/oidc_test.go` didn't change in this PR\.
  - Target: [`pkg/auth/oidc_test.go`](https://github.com/fatedier/frp/blob/abf4942e8a48dacf3689982d41c23a0bfc3470a9/pkg/auth/oidc_test.go) · outcome: `notFollowedUp`
- **\#5048** ([`b27b846`](https://github.com/fatedier/frp/commit/b27b846971cd9f7b08023314437fdafc939f6664)) · config: add enabled field for individual proxy and visitor \(\#5048\) · author(s): fatedier
  - Question (`untested-change`, intervalLow=N/A): `pkg/config/load.go` changed \(\+11/−0\); its test file `pkg/config/load_test.go` didn't change in this PR\.
  - Target: [`pkg/config/load_test.go`](https://github.com/fatedier/frp/blob/b27b846971cd9f7b08023314437fdafc939f6664/pkg/config/load_test.go) · outcome: `notFollowedUp`
- **\#5050** ([`66973a0`](https://github.com/fatedier/frp/commit/66973a03dbe8e300f2607ad3ada8d515948bac93)) · Add \`exec\` value source type \(\#5050\) · author(s): Krzysztof Bogacki
  - Question (`untested-change`, intervalLow=N/A): `pkg/config/v1/value_source.go` changed \(\+66/−1\); its test file `pkg/config/v1/value_source_test.go` didn't change in this PR\.
  - Target: [`pkg/config/v1/value_source_test.go`](https://github.com/fatedier/frp/blob/66973a03dbe8e300f2607ad3ada8d515948bac93/pkg/config/v1/value_source_test.go) · outcome: `notFollowedUp`
- **\#5068** ([`15fd19a`](https://github.com/fatedier/frp/commit/15fd19a16db3348b495716a5a5b41f1646e38838)) · fix lint \(\#5068\) · author(s): fatedier
  - Question (`untested-change`, intervalLow=N/A): `pkg/config/v1/client.go` changed \(\+17/−1\); its test file `pkg/config/v1/client_test.go` didn't change in this PR\.
  - Target: [`pkg/config/v1/client_test.go`](https://github.com/fatedier/frp/blob/15fd19a16db3348b495716a5a5b41f1646e38838/pkg/config/v1/client_test.go) · outcome: `notFollowedUp`
- **\#5088** ([`0fe8f7a`](https://github.com/fatedier/frp/commit/0fe8f7a0b6bef8ea97172bfa21ff85c5e429ea40)) · refactor: reorganize security policy into dedicated packag \(\#5088\) · author(s): fatedier
  - Question (`untested-change`, intervalLow=N/A): `pkg/config/v1/client.go` changed \(\+0/−20\); its test file `pkg/config/v1/client_test.go` didn't change in this PR\.
  - Target: [`pkg/config/v1/client_test.go`](https://github.com/fatedier/frp/blob/0fe8f7a0b6bef8ea97172bfa21ff85c5e429ea40/pkg/config/v1/client_test.go) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **227156.47 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 54958.69 | 54958.69 | 54958.69 |
| `sessionOpen` | 200 | 98865.88 | 255.17 | 632.2 |
| `staticAnalysis` | 200 | 58223.74 | 299.36 | 454.39 |
| `brief` | 200 | 1800.17 | 8.82 | 10.63 |
| `scoring` | 200 | 2501.58 | 11.33 | 18.5 |
| `report` | 1 | 24.41 | 24.41 | 24.41 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
