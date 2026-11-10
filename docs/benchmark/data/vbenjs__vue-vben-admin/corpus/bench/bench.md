# Gutter Benchmark Report · vbenjs/vue\-vben\-admin

Branch: `HEAD` · Head: [`71dc5ac`](https://github.com/vbenjs/vue-vben-admin/commit/71dc5ac59dcd832e45df861a283746a3cd143125) (`71dc5ac59dcd832e45df861a283746a3cd143125`) · Generated: `2026-11-10T16:32:23.190Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=3 < 30). Follow-up proxy 0.33 [0.06–0.79], lift ×1.00 vs popular-near. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 1512 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 7 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 73 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 901 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 531 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 977 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 3 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 531 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 4 |
| `beyondPrsLimit` | 777 |
| `historyUnavailable` | 0 |
| `noQuestions` | 173 |
| `unscorableOnly` | 22 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 2 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 3
- **PRs with questions:** 27 / 200 (0.135, [0.09446570454787906, 0.18929138370752552])
- **Total questions:** 29 (per PR: 0.145)
- **Salience `quiet`:** 122 / 200 (0.61, [0.5409374595716976, 0.6749165686253038])
- **Salience `brief`:** 78 / 200 (0.39, [0.3250834313746962, 0.4590625404283025])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 1 |
| `notFollowedUp` | 2 |
| `censored` | 2 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 24 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | [0, 1] (median 0.3333, n=1000, seed=20261108) |
| Question-level follow-up rate | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | — |
| Same-author share of `followedUp` | 0 / 1 (0, [0, 0.7934506856227626]) | — |
| RA-signal follow-up rate | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | — |
| Missed co-change follow-up recall proxy | 0 / 481 (0, [8.604895237036916e-19, 0.007923123633110731]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 481 untouched historical co-change partner(s) across 86 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `popular-near` · **Headline lift:** ×1 · **Bootstrap CI:** [1, 1] (median 1, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 3 | 0 (0) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |
| `popular-near` | 3 | 0 (0) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |
| `recent` | 3 | 0 (0) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | `popular-near` | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | `popular-near` | N/A | N/A |
| RA-signal follow-up | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | `popular-near` | N/A | N/A |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 5 | 3 | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 3 | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) |
| `wide-surface` | 24 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 175 | 3 | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) |
| `botOrAgentOrigin` | 6 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 22 | 0 | 0 / 0 (N/A) |
| `dependencyOrVersionOnly` | 0 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 6 | 0 | 0 / 0 (N/A) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 3
- **PRs with questions:** 27 / 200 (0.135, [0.09446570454787906, 0.18929138370752552])
- **Total questions:** 29 (per PR: 0.145)
- **Salience `quiet`:** 122 / 200 (0.61, [0.5409374595716976, 0.6749165686253038])
- **Salience `brief`:** 78 / 200 (0.39, [0.3250834313746962, 0.4590625404283025])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 1 |
| `notFollowedUp` | 2 |
| `censored` | 2 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 24 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | [0, 1] (median 0.3333, n=1000, seed=20261108) |
| Question-level follow-up rate | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | — |
| Same-author share of `followedUp` | 0 / 1 (0, [0, 0.7934506856227626]) | — |
| RA-signal follow-up rate | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | — |
| Missed co-change follow-up recall proxy | 0 / 481 (0, [8.604895237036916e-19, 0.007923123633110731]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 481 untouched historical co-change partner(s) across 86 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `popular-near` · **Headline lift:** ×1 · **Bootstrap CI:** [1, 1] (median 1, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 3 | 0 (0) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |
| `popular-near` | 3 | 0 (0) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |
| `recent` | 3 | 0 (0) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | 1 / 3 (0.3333, [0.061491944720396215, 0.7923403991979523]) | `popular-near` | ×1 | [1, 1] (median 1, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | `popular-near` | N/A | N/A |
| RA-signal follow-up | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) | `popular-near` | N/A | N/A |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#8486** ([`ddc2bdd`](https://github.com/vbenjs/vue-vben-admin/commit/ddc2bdd14550afa1093d2787fb183a9610749f47)) · fix\(@​vben/layouts\): keep the side menu on pages outside the menu tree \(\#8486\) · author(s): MindOfqc
  - Question (`untested-change`, intervalLow=N/A): `packages/effects/layouts/src/basic/menu/use-extra-menu.ts` changed \(\+16/−0\); its test file `packages/effects/layouts/src/basic/menu/__tests__/use-extra-menu.test.ts` didn't change in this PR\.
  - Target: [`packages/effects/layouts/src/basic/menu/__tests__/use-extra-menu.test.ts`](https://github.com/vbenjs/vue-vben-admin/blob/ddc2bdd14550afa1093d2787fb183a9610749f47/packages/effects/layouts/src/basic/menu/__tests__/use-extra-menu.test.ts) · outcome: `followedUp` in [`0b86378`](https://github.com/vbenjs/vue-vben-admin/commit/0b863783ef9dfba3945c4c1f5085e81c051a6b43) (55.02h, sameAuthor=false)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **merge@​1490a93** ([`18e2bbf`](https://github.com/vbenjs/vue-vben-admin/commit/18e2bbf969dcc65b821ccb76a828b717e61e8814)) · Merge branch 'fork/bnuephjx/refactor/router\-redirect' · author(s): Evan
  - Question (`untested-change`, intervalLow=N/A): `packages/@core/base/shared/src/utils/tree.ts` changed \(\+9/−3\); its test file `packages/@core/base/shared/src/utils/__tests__/tree.test.ts` didn't change in this PR\.
  - Target: [`packages/@core/base/shared/src/utils/__tests__/tree.test.ts`](https://github.com/vbenjs/vue-vben-admin/blob/18e2bbf969dcc65b821ccb76a828b717e61e8814/packages/%40core/base/shared/src/utils/__tests__/tree.test.ts) · outcome: `notFollowedUp`
- **merge@​398b445** ([`14d03a1`](https://github.com/vbenjs/vue-vben-admin/commit/14d03a1c2d2d22247cbfbd309c971f6bf294d66a)) · Merge branch 'vbenjs:main' into main · author(s): luoqiz, zhb410181
  - Question (`untested-change`, intervalLow=N/A): `packages/stores/src/modules/user.ts` changed \(\+2/−24\); its test file `packages/stores/src/modules/user.test.ts` didn't change in this PR\.
  - Target: [`packages/stores/src/modules/user.test.ts`](https://github.com/vbenjs/vue-vben-admin/blob/14d03a1c2d2d22247cbfbd309c971f6bf294d66a/packages/stores/src/modules/user.test.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **335520.74 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 38948.73 | 38948.73 | 38948.73 |
| `sessionOpen` | 200 | 214950.98 | 484.53 | 1280.55 |
| `staticAnalysis` | 200 | 66005.73 | 338.99 | 565.77 |
| `brief` | 200 | 1839.29 | 8.61 | 10.63 |
| `scoring` | 200 | 3230.79 | 14.41 | 33 |
| `report` | 1 | 22.25 | 22.25 | 22.25 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
