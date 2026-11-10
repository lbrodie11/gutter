# Gutter Benchmark Report · allianz/ng\-aquila

Branch: `HEAD` · Head: [`5b23a36`](https://github.com/allianz/ng-aquila/commit/5b23a36e0b47a1dd90a6ffe36e50e7b2cbf7a9a4) (`5b23a36e0b47a1dd90a6ffe36e50e7b2cbf7a9a4`) · Generated: `2026-11-10T16:03:39.754Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=20 < 30). Follow-up proxy 0.40 [0.22–0.61], lift ×0.53 vs recent. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 1896 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 1 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 0 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 1845 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 50 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 1845 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 20 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 50 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 1 |
| `beyondPrsLimit` | 1645 |
| `historyUnavailable` | 0 |
| `noQuestions` | 158 |
| `unscorableOnly` | 22 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 20
- **PRs with questions:** 42 / 200 (0.21, [0.15928412069979, 0.2716461685990246])
- **Total questions:** 54 (per PR: 0.27)
- **Salience `quiet`:** 73 / 200 (0.365, [0.301405264649268, 0.433682973472594])
- **Salience `brief`:** 127 / 200 (0.635, [0.566317026527406, 0.698594735350732])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 8 |
| `notFollowedUp` | 12 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 34 |
| Shared follow-up outcomes across PR windows | 6 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | [0.2, 0.6] (median 0.4, n=1000, seed=20261108) |
| Question-level follow-up rate | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 20 (0, [0, 0.16112515805281938]) | — |
| Same-author share of `followedUp` | 0 / 8 (0, [0, 0.32440756488388023]) | — |
| RA-signal follow-up rate | 0 / 20 (0, [0, 0.16112515805281938]) | — |
| Missed co-change follow-up recall proxy | 0 / 734 (0, [0, 0.005206347210190657]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 734 untouched historical co-change partner(s) across 131 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0.5333 · **Bootstrap CI:** [0.2663, 0.9167] (median 0.5333, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 20 | 0 (0) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | ×0.5714 | [0.2667, 1] (median 0.5714, n=1000, seed=20261108) |
| `popular-near` | 20 | 0 (0) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | ×0.5714 | [0.2667, 1] (median 0.5714, n=1000, seed=20261108) |
| `recent` | 20 | 0 (0) | 15 / 20 (0.75, [0.531299122381256, 0.8881382985923343]) | 15 / 20 (0.75, [0.531299122381256, 0.8881382985923343]) | 4 / 20 (0.2, [0.08065766257979808, 0.41601743225189364]) | ×0.5333 | [0.2663, 0.9167] (median 0.5333, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 15 / 20 (0.75, [0.531299122381256, 0.8881382985923343]) | `recent` | ×0.5333 | [0.2663, 0.9167] (median 0.5333, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 20 (0, [0, 0.16112515805281938]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 4 / 20 (0.2, [0.08065766257979808, 0.41601743225189364]) | `popular-near` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 20 (0, [0, 0.16112515805281938]) | 2 / 20 (0.1, [0.02786648121376822, 0.3010336452284873]) | 2 / 20 (0.1, [0.02786648121376822, 0.3010336452284873]) | 2 / 20 (0.1, [0.02786648121376822, 0.3010336452284873]) | `popular-near` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 20 | 20 | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 20 | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 0 / 20 (0, [0, 0.16112515805281938]) |
| `wide-surface` | 34 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 169 | 17 | 8 / 17 (0.4706, [0.26165106442409436, 0.6903676493999558]) |
| `botOrAgentOrigin` | 2 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 22 | 1 | 0 / 1 (0, [0, 0.7934506856227626]) |
| `dependencyOrVersionOnly` | 13 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 9 | 2 | 0 / 2 (0, [0, 0.6576197724933469]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 20
- **PRs with questions:** 42 / 200 (0.21, [0.15928412069979, 0.2716461685990246])
- **Total questions:** 54 (per PR: 0.27)
- **Salience `quiet`:** 73 / 200 (0.365, [0.301405264649268, 0.433682973472594])
- **Salience `brief`:** 127 / 200 (0.635, [0.566317026527406, 0.698594735350732])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 8 |
| `notFollowedUp` | 12 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 34 |
| Shared follow-up outcomes across PR windows | 6 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | [0.2, 0.6] (median 0.4, n=1000, seed=20261108) |
| Question-level follow-up rate | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 20 (0, [0, 0.16112515805281938]) | — |
| Same-author share of `followedUp` | 0 / 8 (0, [0, 0.32440756488388023]) | — |
| RA-signal follow-up rate | 0 / 20 (0, [0, 0.16112515805281938]) | — |
| Missed co-change follow-up recall proxy | 0 / 734 (0, [0, 0.005206347210190657]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 734 untouched historical co-change partner(s) across 131 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0.5333 · **Bootstrap CI:** [0.2663, 0.9167] (median 0.5333, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 20 | 0 (0) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | ×0.5714 | [0.2667, 1] (median 0.5714, n=1000, seed=20261108) |
| `popular-near` | 20 | 0 (0) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | ×0.5714 | [0.2667, 1] (median 0.5714, n=1000, seed=20261108) |
| `recent` | 20 | 0 (0) | 15 / 20 (0.75, [0.531299122381256, 0.8881382985923343]) | 15 / 20 (0.75, [0.531299122381256, 0.8881382985923343]) | 4 / 20 (0.2, [0.08065766257979808, 0.41601743225189364]) | ×0.5333 | [0.2663, 0.9167] (median 0.5333, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | 15 / 20 (0.75, [0.531299122381256, 0.8881382985923343]) | `recent` | ×0.5333 | [0.2663, 0.9167] (median 0.5333, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 20 (0, [0, 0.16112515805281938]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 8 / 20 (0.4, [0.2188065323728171, 0.6134184992377469]) | 4 / 20 (0.2, [0.08065766257979808, 0.41601743225189364]) | `popular-near` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 20 (0, [0, 0.16112515805281938]) | 2 / 20 (0.1, [0.02786648121376822, 0.3010336452284873]) | 2 / 20 (0.1, [0.02786648121376822, 0.3010336452284873]) | 2 / 20 (0.1, [0.02786648121376822, 0.3010336452284873]) | `popular-near` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#2049** ([`6f5c35f`](https://github.com/allianz/ng-aquila/commit/6f5c35fce75d37c9d5b68401f66badfd3de254a9)) · fix\(dropdown, modal\): parse animation durations as CSS times \(\#2049\) · author(s): Philipp Fahrenschon
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/dropdown/dropdown.ts` changed \(\+4/−8\); its test file `projects/ng-aquila/src/dropdown/dropdown.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/dropdown/dropdown.spec.ts`](https://github.com/allianz/ng-aquila/blob/6f5c35fce75d37c9d5b68401f66badfd3de254a9/projects/ng-aquila/src/dropdown/dropdown.spec.ts) · outcome: `followedUp` in [`46eba99`](https://github.com/allianz/ng-aquila/commit/46eba99bcaa14907567f82ac4a304ef784059bd7) (16.46h, sameAuthor=false)
- **\#2036** ([`5d420ec`](https://github.com/allianz/ng-aquila/commit/5d420ece3ec8585870f9a971efca1de1d1d1d74c)) · fix\(dropdown\): SSR \- skip tooltip\-truncation measurement during SSR \(\#2036\) · author(s): suprajak\-petchdee
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/dropdown/dropdown.ts` changed \(\+13/−15\); its test file `projects/ng-aquila/src/dropdown/dropdown.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/dropdown/dropdown.spec.ts`](https://github.com/allianz/ng-aquila/blob/5d420ece3ec8585870f9a971efca1de1d1d1d74c/projects/ng-aquila/src/dropdown/dropdown.spec.ts) · outcome: `followedUp` in [`46eba99`](https://github.com/allianz/ng-aquila/commit/46eba99bcaa14907567f82ac4a304ef784059bd7) (22.39h, sameAuthor=false)
- **\#1979** ([`7b0ce4f`](https://github.com/allianz/ng-aquila/commit/7b0ce4f3f6f9c3c4a1c3c4aa15db83ba3c6a29d5)) · refactor\(grid\): unify A1 grid onto the padding\-based gutter model \(\#1979\) · author(s): \[redacted\]
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/grid/layout.component.ts` changed \(\+1/−19\); its test file `projects/ng-aquila/src/grid/layout.component.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/grid/layout.component.spec.ts`](https://github.com/allianz/ng-aquila/blob/7b0ce4f3f6f9c3c4a1c3c4aa15db83ba3c6a29d5/projects/ng-aquila/src/grid/layout.component.spec.ts) · outcome: `followedUp` in [`5fd3c35`](https://github.com/allianz/ng-aquila/commit/5fd3c35c2b4e378b9ce4bfb19ce45ec4da05dac0) (44.73h, sameAuthor=false)
- **\#1978** ([`1f25736`](https://github.com/allianz/ng-aquila/commit/1f2573617b2317c0141f0137ae8afbdcdf6f1f6e)) · Revert "refactor\(grid\): unify A1 grid onto the padding\-based gutter model" \(\#1978\) · author(s): \[redacted\]
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/grid/layout.component.ts` changed \(\+19/−1\); its test file `projects/ng-aquila/src/grid/layout.component.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/grid/layout.component.spec.ts`](https://github.com/allianz/ng-aquila/blob/1f2573617b2317c0141f0137ae8afbdcdf6f1f6e/projects/ng-aquila/src/grid/layout.component.spec.ts) · outcome: `followedUp` in [`5fd3c35`](https://github.com/allianz/ng-aquila/commit/5fd3c35c2b4e378b9ce4bfb19ce45ec4da05dac0) (46.02h, sameAuthor=false)
- **\#1966** ([`128fd7e`](https://github.com/allianz/ng-aquila/commit/128fd7e425106984b875f9213e5e75e900643fac)) · refactor\(grid\): unify A1 grid onto the padding\-based gutter model \(\#1966\) · author(s): \[redacted\]
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/grid/layout.component.ts` changed \(\+1/−19\); its test file `projects/ng-aquila/src/grid/layout.component.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/grid/layout.component.spec.ts`](https://github.com/allianz/ng-aquila/blob/128fd7e425106984b875f9213e5e75e900643fac/projects/ng-aquila/src/grid/layout.component.spec.ts) · outcome: `followedUp` in [`5fd3c35`](https://github.com/allianz/ng-aquila/commit/5fd3c35c2b4e378b9ce4bfb19ce45ec4da05dac0) (52.84h, sameAuthor=false)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#1933** ([`4a528af`](https://github.com/allianz/ng-aquila/commit/4a528af844bad424b0e73d6481c6d7e197fdc893)) · fix\(forms\): mark form as touched when move out of group \(\#1933\) · author(s): suprajak\-petchdee
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/checkbox/checkbox.component.ts` changed \(\+8/−4\); its test file `projects/ng-aquila/src/checkbox/checkbox.component.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/checkbox/checkbox.component.spec.ts`](https://github.com/allianz/ng-aquila/blob/4a528af844bad424b0e73d6481c6d7e197fdc893/projects/ng-aquila/src/checkbox/checkbox.component.spec.ts) · outcome: `notFollowedUp`
- **\#1934** ([`276924c`](https://github.com/allianz/ng-aquila/commit/276924c5edced8db2e79cb13b5db5630350233eb)) · fix\(mask\): render initial value written before mask init \(\#1934\) · author(s): \[redacted\]
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/mask/mask.directive.ts` changed \(\+36/−3\); its test file `projects/ng-aquila/src/mask/mask.directive.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/mask/mask.directive.spec.ts`](https://github.com/allianz/ng-aquila/blob/276924c5edced8db2e79cb13b5db5630350233eb/projects/ng-aquila/src/mask/mask.directive.spec.ts) · outcome: `notFollowedUp`
- **\#1947** ([`4e29660`](https://github.com/allianz/ng-aquila/commit/4e296603eb2598a44e34d51a380ceaa5cd3bdd6c)) · fix\(iban\-mask\): keep initial model value in template\-driven forms \(\#1947\) · author(s): alexander\-schilpp
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/mask/mask.directive.ts` changed \(\+10/−0\); its test file `projects/ng-aquila/src/mask/mask.directive.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/mask/mask.directive.spec.ts`](https://github.com/allianz/ng-aquila/blob/4e296603eb2598a44e34d51a380ceaa5cd3bdd6c/projects/ng-aquila/src/mask/mask.directive.spec.ts) · outcome: `notFollowedUp`
- **\#1952** ([`7d0f3c2`](https://github.com/allianz/ng-aquila/commit/7d0f3c2863f0914aea43665b7526d10821b3af04)) · feat\(tabs\): implement closable tabs \(\#1952\) · author(s): chonlatas\-tasanapreechachai
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/tabs/tab.ts` changed \(\+12/−0\); its test file `projects/ng-aquila/src/tabs/tab.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/tabs/tab.spec.ts`](https://github.com/allianz/ng-aquila/blob/7d0f3c2863f0914aea43665b7526d10821b3af04/projects/ng-aquila/src/tabs/tab.spec.ts) · outcome: `notFollowedUp`
- **\#1959** ([`cfca94f`](https://github.com/allianz/ng-aquila/commit/cfca94f7f8e88813dd01a20efa8e50839a402fd3)) · chore\(deps\): bump prettier to 3\.9\.6 \(\#1959\) · author(s): alexander\-schilpp
  - Question (`untested-change`, intervalLow=N/A): `projects/ng-aquila/src/avatar/avatar.ts` changed \(\+1/−10\); its test file `projects/ng-aquila/src/avatar/avatar.spec.ts` didn't change in this PR\.
  - Target: [`projects/ng-aquila/src/avatar/avatar.spec.ts`](https://github.com/allianz/ng-aquila/blob/cfca94f7f8e88813dd01a20efa8e50839a402fd3/projects/ng-aquila/src/avatar/avatar.spec.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **461344.52 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 18191.06 | 18191.06 | 18191.06 |
| `sessionOpen` | 200 | 335406.03 | 990.84 | 1464.71 |
| `staticAnalysis` | 200 | 88718.12 | 377.76 | 882.62 |
| `brief` | 200 | 2127.26 | 8.93 | 16.96 |
| `scoring` | 200 | 5171.98 | 20.74 | 59.63 |
| `report` | 1 | 25.96 | 25.96 | 25.96 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
