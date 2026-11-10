# Gutter Benchmark Report · lerna/lerna

Branch: `HEAD` · Head: [`d622611`](https://github.com/lerna/lerna/commit/d6226111673016062ba099b2876334069407ef41) (`d6226111673016062ba099b2876334069407ef41`) · Generated: `2026-11-10T16:26:12.510Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=9 < 30). Follow-up proxy 0.00 [0.00–0.30], lift ×0.00 vs recent. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 2723 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 48 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 5 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 1074 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 1596 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 1126 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 9 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 1596 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 1 |
| `beyondPrsLimit` | 926 |
| `historyUnavailable` | 0 |
| `noQuestions` | 177 |
| `unscorableOnly` | 14 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 9
- **PRs with questions:** 23 / 200 (0.115, [0.07786373232561955, 0.16664716898487572])
- **Total questions:** 27 (per PR: 0.135)
- **Salience `quiet`:** 150 / 200 (0.75, [0.6856590168795417, 0.804918319931825])
- **Salience `brief`:** 50 / 200 (0.25, [0.195081680068175, 0.31434098312045833])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 9 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 18 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 9 (0, [0, 0.2991450484195441]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 9 (0, [0, 0.2991450484195441]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 9 (0, [0, 0.2991450484195441]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 9 (0, [0, 0.2991450484195441]) | — |
| Missed co-change follow-up recall proxy | 0 / 638 (0, [0, 0.005985058721124591]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 638 untouched historical co-change partner(s) across 124 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0 · **Bootstrap CI:** [0, 0] (median 0, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 9 | 0 (0) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 4 / 9 (0.4444, [0.18877852109766458, 0.7333487065045069]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `popular-near` | 9 | 0 (0) | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 2 / 9 (0.2222, [0.06322510711784671, 0.5474110308930111]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `recent` | 9 | 0 (0) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 1 / 9 (0.1111, [0.019890887638544918, 0.434999705576656]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 9 (0, [0, 0.2991450484195441]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 9 (0, [0, 0.2991450484195441]) | 4 / 9 (0.4444, [0.18877852109766458, 0.7333487065045069]) | 2 / 9 (0.2222, [0.06322510711784671, 0.5474110308930111]) | 1 / 9 (0.1111, [0.019890887638544918, 0.434999705576656]) | `popular` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 9 (0, [0, 0.2991450484195441]) | 4 / 9 (0.4444, [0.18877852109766458, 0.7333487065045069]) | 2 / 9 (0.2222, [0.06322510711784671, 0.5474110308930111]) | 1 / 9 (0.1111, [0.019890887638544918, 0.434999705576656]) | `popular` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 9 | 9 | 0 / 9 (0, [0, 0.2991450484195441]) | 9 | 0 / 9 (0, [0, 0.2991450484195441]) | 0 / 9 (0, [0, 0.2991450484195441]) |
| `wide-surface` | 18 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 29 | 1 | 0 / 1 (0, [0, 0.7934506856227626]) |
| `botOrAgentOrigin` | 123 | 2 | 0 / 2 (0, [0, 0.6576197724933469]) |
| `generatedPaths` | 152 | 8 | 0 / 8 (0, [0, 0.32440756488388023]) |
| `dependencyOrVersionOnly` | 115 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 6 | 3 | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 9
- **PRs with questions:** 23 / 200 (0.115, [0.07786373232561955, 0.16664716898487572])
- **Total questions:** 27 (per PR: 0.135)
- **Salience `quiet`:** 150 / 200 (0.75, [0.6856590168795417, 0.804918319931825])
- **Salience `brief`:** 50 / 200 (0.25, [0.195081680068175, 0.31434098312045833])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 9 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 18 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 9 (0, [0, 0.2991450484195441]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 9 (0, [0, 0.2991450484195441]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 9 (0, [0, 0.2991450484195441]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 9 (0, [0, 0.2991450484195441]) | — |
| Missed co-change follow-up recall proxy | 0 / 638 (0, [0, 0.005985058721124591]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 638 untouched historical co-change partner(s) across 124 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0 · **Bootstrap CI:** [0, 0] (median 0, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 9 | 0 (0) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 4 / 9 (0.4444, [0.18877852109766458, 0.7333487065045069]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `popular-near` | 9 | 0 (0) | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 2 / 9 (0.2222, [0.06322510711784671, 0.5474110308930111]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `recent` | 9 | 0 (0) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 1 / 9 (0.1111, [0.019890887638544918, 0.434999705576656]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 9 (0, [0, 0.2991450484195441]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 6 / 9 (0.6667, [0.35420213558039626, 0.8794161816130891]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 9 (0, [0, 0.2991450484195441]) | 4 / 9 (0.4444, [0.18877852109766458, 0.7333487065045069]) | 2 / 9 (0.2222, [0.06322510711784671, 0.5474110308930111]) | 1 / 9 (0.1111, [0.019890887638544918, 0.434999705576656]) | `popular` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 9 (0, [0, 0.2991450484195441]) | 4 / 9 (0.4444, [0.18877852109766458, 0.7333487065045069]) | 2 / 9 (0.2222, [0.06322510711784671, 0.5474110308930111]) | 1 / 9 (0.1111, [0.019890887638544918, 0.434999705576656]) | `popular` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

_None in this run._

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#4309** ([`5ad1cf8`](https://github.com/lerna/lerna/commit/5ad1cf84e19ac0c8be279e25074519dc32f348e0)) · chore\(deps\): replace make\-dir, rimraf, resolve\-from with native Node\.js APIs \(\#4309\) · author(s): AI\-JamesHenry
  - Question (`untested-change`, intervalLow=N/A): `libs/core/src/lib/temp-write.ts` changed \(\+4/−8\); its test file `libs/core/src/lib/temp-write.spec.ts` didn't change in this PR\.
  - Target: [`libs/core/src/lib/temp-write.spec.ts`](https://github.com/lerna/lerna/blob/5ad1cf84e19ac0c8be279e25074519dc32f348e0/libs/core/src/lib/temp-write.spec.ts) · outcome: `notFollowedUp`
- **\#4323** ([`e9386c6`](https://github.com/lerna/lerna/commit/e9386c60937077aca723a67e768d79caea739d62)) · refactor\(child\-process\): replace through with native stream\.Transform \(\#4323\) · author(s): AI\-JamesHenry
  - Question (`untested-change`, intervalLow=N/A): `libs/child-process/src/forked-strong-log-transformer.ts` changed \(\+75/−64\); its test file `libs/child-process/src/forked-strong-log-transformer.spec.ts` didn't change in this PR\.
  - Target: [`libs/child-process/src/forked-strong-log-transformer.spec.ts`](https://github.com/lerna/lerna/blob/e9386c60937077aca723a67e768d79caea739d62/libs/child-process/src/forked-strong-log-transformer.spec.ts) · outcome: `notFollowedUp`
- **\#4389** ([`1f7e109`](https://github.com/lerna/lerna/commit/1f7e1095893f644e560e51b1e094cc8ae4b5720f)) · chore\(repo\): migrate from jest to vitest \(\#4389\) · author(s): James Henry
  - Question (`untested-change`, intervalLow=N/A): `libs/commands/version/src/lib/git-add.ts` changed \(\+5/−5\); its test file `libs/commands/version/src/lib/git-add.spec.ts` didn't change in this PR\.
  - Target: [`libs/commands/version/src/lib/git-add.spec.ts`](https://github.com/lerna/lerna/blob/1f7e1095893f644e560e51b1e094cc8ae4b5720f/libs/commands/version/src/lib/git-add.spec.ts) · outcome: `notFollowedUp`
- **\#4390** ([`a148ba2`](https://github.com/lerna/lerna/commit/a148ba23882e4e3d201b0198eefc37d6f18196d9)) · feat\!: support node ^22\.13\.0 \|\| ^24\.0\.0 \|\| ^26\.0\.0, ship lerna as ESM\-only \(\#4390\) · author(s): AI\-JamesHenry
  - Question (`untested-change`, intervalLow=N/A): `libs/core/src/lib/oidc.ts` changed \(\+8/−12\); its test file `libs/core/src/lib/oidc.spec.ts` didn't change in this PR\.
  - Target: [`libs/core/src/lib/oidc.spec.ts`](https://github.com/lerna/lerna/blob/a148ba23882e4e3d201b0198eefc37d6f18196d9/libs/core/src/lib/oidc.spec.ts) · outcome: `notFollowedUp`
- **\#4402** ([`8f9c750`](https://github.com/lerna/lerna/commit/8f9c7509ac7a8902db25feee95c46dc2e313959a)) · feat\(publish\)\!: use \.sha\-\{SHA\} prerelease identifiers for \-\-canary \(\#4402\) · author(s): James Henry
  - Question (`untested-change`, intervalLow=N/A): `libs/e2e-utils/src/lib/snapshot-serializer-utils.ts` changed \(\+7/−3\); its test file `libs/e2e-utils/src/lib/snapshot-serializer-utils.spec.ts` didn't change in this PR\.
  - Target: [`libs/e2e-utils/src/lib/snapshot-serializer-utils.spec.ts`](https://github.com/lerna/lerna/blob/8f9c7509ac7a8902db25feee95c46dc2e313959a/libs/e2e-utils/src/lib/snapshot-serializer-utils.spec.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **355485.35 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 28093.04 | 28093.04 | 28093.04 |
| `sessionOpen` | 200 | 213278.06 | 595.85 | 800.79 |
| `staticAnalysis` | 200 | 98594.43 | 499.9 | 741.83 |
| `brief` | 200 | 1760.86 | 8.54 | 10.5 |
| `scoring` | 200 | 3103.8 | 14.89 | 20.2 |
| `report` | 1 | 22.17 | 22.17 | 22.17 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
