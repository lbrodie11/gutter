# Gutter Benchmark Report · hypit\-ai/hypit

Branch: `HEAD` · Head: [`0762c6b`](https://github.com/hypit-ai/hypit/commit/0762c6be56c0af43fff3cdbdb285e21414dd249b) (`0762c6be56c0af43fff3cdbdb285e21414dd249b`) · Generated: `2026-11-10T17:40:44.445Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED. Follow-up proxy 0.51 [0.36–0.66], lift ×0.51 vs recent. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 927 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 111 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 21 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 71 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 724 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 203 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 38 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 724 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 0 |
| `beyondPrsLimit` | 3 |
| `historyUnavailable` | 0 |
| `noQuestions` | 141 |
| `unscorableOnly` | 21 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 38
- **PRs with questions:** 59 / 200 (0.295, [0.2361394385684915, 0.36158714524618774])
- **Total questions:** 75 (per PR: 0.375)
- **Salience `quiet`:** 69 / 200 (0.345, [0.2825979437674894, 0.4132441074094632])
- **Salience `brief`:** 131 / 200 (0.655, [0.5867558925905368, 0.7174020562325105])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 20 |
| `notFollowedUp` | 19 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 37 |
| Shared follow-up outcomes across PR windows | 4 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 20 / 39 (0.5128, [0.3619936288445797, 0.6613482467013799]) | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |
| Question-level follow-up rate | 19 / 38 (0.5, [0.34849928364395105, 0.6515007163560489]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 14 / 39 (0.359, [0.22742085458992867, 0.5158185144045146]) | — |
| Same-author share of `followedUp` | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | — |
| RA-signal follow-up rate | 13 / 39 (0.3333, [0.20632956189598373, 0.49022605600654007]) | — |
| Missed co-change follow-up recall proxy | 0 / 2478 (0, [0, 0.0015478260333838913]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 2478 untouched historical co-change partner(s) across 161 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0.5128 · **Bootstrap CI:** [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 39 | 0 (0) | 39 / 39 (1, [0.9103331462924287, 1]) | 38 / 38 (1, [0.9081901317744159, 0.9999999999999998]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | ×0.5128 | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |
| `popular-near` | 39 | 0 (0) | 29 / 35 (0.8286, [0.6731771770095504, 0.9189735994629842]) | 28 / 34 (0.8235, [0.6648626260015724, 0.9165103095462768]) | 19 / 35 (0.5429, [0.38189725068483754, 0.6953398071159278]) | ×0.6189 | [0.4372, 0.8077] (median 0.6154, n=1000, seed=20261108) |
| `recent` | 39 | 0 (0) | 39 / 39 (1, [0.9103331462924287, 1]) | 38 / 38 (1, [0.9081901317744159, 0.9999999999999998]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | ×0.5128 | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 20 / 39 (0.5128, [0.3619936288445797, 0.6613482467013799]) | 39 / 39 (1, [0.9103331462924287, 1]) | 29 / 35 (0.8286, [0.6731771770095504, 0.9189735994629842]) | 39 / 39 (1, [0.9103331462924287, 1]) | `recent` | ×0.5128 | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |
| Same-author follow-up | 14 / 39 (0.359, [0.22742085458992867, 0.5158185144045146]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | 19 / 35 (0.5429, [0.38189725068483754, 0.6953398071159278]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | `popular-near` | ×0.6613 | [0.3887, 1.0527] (median 0.6563, n=1000, seed=20261108) |
| RA-signal follow-up | 13 / 39 (0.3333, [0.20632956189598373, 0.49022605600654007]) | 3 / 39 (0.0769, [0.026507395303779747, 0.20321071167954996]) | 17 / 35 (0.4857, [0.3299423600250973, 0.6443119540413141]) | 3 / 39 (0.0769, [0.026507395303779747, 0.20321071167954996]) | `popular-near` | ×0.6862 | [0.3999, 1.125] (median 0.6854, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 38 | 38 | 19 / 38 (0.5, [0.34849928364395105, 0.6515007163560489]) | 39 | 20 / 39 (0.5128, [0.3619936288445797, 0.6613482467013799]) | 14 / 39 (0.359, [0.22742085458992867, 0.5158185144045146]) |
| `wide-surface` | 37 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 131 | 19 | 12 / 19 (0.6316, [0.41039533164803066, 0.8085048725486492]) |
| `botOrAgentOrigin` | 30 | 11 | 4 / 11 (0.3636, [0.15166471095367573, 0.6461988254921511]) |
| `generatedPaths` | 40 | 14 | 6 / 14 (0.4286, [0.2138079890447412, 0.6740935542034925]) |
| `dependencyOrVersionOnly` | 8 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 13 | 7 | 4 / 7 (0.5714, [0.2504583645276572, 0.8417801447485304]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 38
- **PRs with questions:** 59 / 200 (0.295, [0.2361394385684915, 0.36158714524618774])
- **Total questions:** 75 (per PR: 0.375)
- **Salience `quiet`:** 69 / 200 (0.345, [0.2825979437674894, 0.4132441074094632])
- **Salience `brief`:** 131 / 200 (0.655, [0.5867558925905368, 0.7174020562325105])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 20 |
| `notFollowedUp` | 19 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 37 |
| Shared follow-up outcomes across PR windows | 4 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 20 / 39 (0.5128, [0.3619936288445797, 0.6613482467013799]) | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |
| Question-level follow-up rate | 19 / 38 (0.5, [0.34849928364395105, 0.6515007163560489]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 14 / 39 (0.359, [0.22742085458992867, 0.5158185144045146]) | — |
| Same-author share of `followedUp` | 14 / 20 (0.7, [0.4810271816464765, 0.8545227551323956]) | — |
| RA-signal follow-up rate | 13 / 39 (0.3333, [0.20632956189598373, 0.49022605600654007]) | — |
| Missed co-change follow-up recall proxy | 0 / 2478 (0, [0, 0.0015478260333838913]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 2478 untouched historical co-change partner(s) across 161 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0.5128 · **Bootstrap CI:** [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 39 | 0 (0) | 39 / 39 (1, [0.9103331462924287, 1]) | 38 / 38 (1, [0.9081901317744159, 0.9999999999999998]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | ×0.5128 | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |
| `popular-near` | 39 | 0 (0) | 29 / 35 (0.8286, [0.6731771770095504, 0.9189735994629842]) | 28 / 34 (0.8235, [0.6648626260015724, 0.9165103095462768]) | 19 / 35 (0.5429, [0.38189725068483754, 0.6953398071159278]) | ×0.6189 | [0.4372, 0.8077] (median 0.6154, n=1000, seed=20261108) |
| `recent` | 39 | 0 (0) | 39 / 39 (1, [0.9103331462924287, 1]) | 38 / 38 (1, [0.9081901317744159, 0.9999999999999998]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | ×0.5128 | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 20 / 39 (0.5128, [0.3619936288445797, 0.6613482467013799]) | 39 / 39 (1, [0.9103331462924287, 1]) | 29 / 35 (0.8286, [0.6731771770095504, 0.9189735994629842]) | 39 / 39 (1, [0.9103331462924287, 1]) | `recent` | ×0.5128 | [0.359, 0.6667] (median 0.5128, n=1000, seed=20261108) |
| Same-author follow-up | 14 / 39 (0.359, [0.22742085458992867, 0.5158185144045146]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | 19 / 35 (0.5429, [0.38189725068483754, 0.6953398071159278]) | 21 / 39 (0.5385, [0.38569448270515755, 0.6843311439327215]) | `popular-near` | ×0.6613 | [0.3887, 1.0527] (median 0.6563, n=1000, seed=20261108) |
| RA-signal follow-up | 13 / 39 (0.3333, [0.20632956189598373, 0.49022605600654007]) | 3 / 39 (0.0769, [0.026507395303779747, 0.20321071167954996]) | 17 / 35 (0.4857, [0.3299423600250973, 0.6443119540413141]) | 3 / 39 (0.0769, [0.026507395303779747, 0.20321071167954996]) | `popular-near` | ×0.6862 | [0.3999, 1.125] (median 0.6854, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#176** ([`1843562`](https://github.com/hypit-ai/hypit/commit/18435623c3527bd81af8932cfd6aa935631ae52f)) · Merge pull request \#176 from hypit\-ai/fix/hypihub\-upload\-diagnostics · author(s): rpone
  - Question (`untested-change`, intervalLow=N/A): `packages/provider-hypihub/src/gemini.ts` changed \(\+19/−1\); its test file `packages/provider-hypihub/test/gemini.test.ts` didn't change in this PR\.
  - Target: [`packages/provider-hypihub/test/gemini.test.ts`](https://github.com/hypit-ai/hypit/blob/18435623c3527bd81af8932cfd6aa935631ae52f/packages/provider-hypihub/test/gemini.test.ts) · outcome: `followedUp` in [`b6fca9e`](https://github.com/hypit-ai/hypit/commit/b6fca9e4a3dde59b06d865ec68d164711a3feb2f) (0.1h, sameAuthor=true)
- **\#28** ([`9ed1e7c`](https://github.com/hypit-ai/hypit/commit/9ed1e7c12480f2623e3192a9146e8aea49574616)) · Merge pull request \#28 from hypit\-ai/fix/tiles\-only\-for\-the\-agent\-observer · author(s): rpone
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+11/−6\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/9ed1e7c12480f2623e3192a9146e8aea49574616/packages/reference-video-tools/test/tools.test.ts) · outcome: `followedUp` in [`85cd504`](https://github.com/hypit-ai/hypit/commit/85cd5044ca893193b88f54abfaff3d84b5636aa2) (1.13h, sameAuthor=true)
- **\#106** ([`d3b020c`](https://github.com/hypit-ai/hypit/commit/d3b020ceed8213da3cd1f235c382f2bfb33a20e3)) · Merge pull request \#106 from hypit\-ai/docs/hypit\-package\-naming · author(s): rpone
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+7/−4\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/d3b020ceed8213da3cd1f235c382f2bfb33a20e3/packages/reference-video-tools/test/tools.test.ts) · outcome: `followedUp` in [`a984a6d`](https://github.com/hypit-ai/hypit/commit/a984a6dfc1f0262f4229334058c9e7b508103622) (1.86h, sameAuthor=true)
- **\#103** ([`60ad4f6`](https://github.com/hypit-ai/hypit/commit/60ad4f65cf9fcb6abed349cd0374765c2702817f)) · Merge pull request \#103 from hypit\-ai/feat/dynamic\-brief\-revision\-route · author(s): rpone
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+53/−0\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/60ad4f65cf9fcb6abed349cd0374765c2702817f/packages/reference-video-tools/test/tools.test.ts) · outcome: `followedUp` in [`a984a6d`](https://github.com/hypit-ai/hypit/commit/a984a6dfc1f0262f4229334058c9e7b508103622) (3.09h, sameAuthor=true)
- **\#101** ([`c681636`](https://github.com/hypit-ai/hypit/commit/c681636ba764c5273ea2e05d116ab6a2be08128a)) · Merge pull request \#101 from hypit\-ai/feat/route\-gates\-cue\-package · author(s): rpone
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+186/−17\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/c681636ba764c5273ea2e05d116ab6a2be08128a/packages/reference-video-tools/test/tools.test.ts) · outcome: `followedUp` in [`a984a6d`](https://github.com/hypit-ai/hypit/commit/a984a6dfc1f0262f4229334058c9e7b508103622) (4.01h, sameAuthor=true)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#114** ([`130faa5`](https://github.com/hypit-ai/hypit/commit/130faa5902bfdbbb6636bc5de605720838eb94bf)) · feat\(hypit\): add resumable variant expansion \(\#114\) · author(s): rponeawa
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+323/−12\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/130faa5902bfdbbb6636bc5de605720838eb94bf/packages/reference-video-tools/test/tools.test.ts) · outcome: `notFollowedUp`
- **\#117** ([`1cb05da`](https://github.com/hypit-ai/hypit/commit/1cb05da23991f0c7083c962a35e6e478f7eb14e6)) · Merge pull request \#117 from hypit\-ai/codex/hypit\-state\-namespacing · author(s): rpone
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+44/−32\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/1cb05da23991f0c7083c962a35e6e478f7eb14e6/packages/reference-video-tools/test/tools.test.ts) · outcome: `notFollowedUp`
- **\#118** ([`3cb50cc`](https://github.com/hypit-ai/hypit/commit/3cb50cc2a611ab231db34af6fbf6a305b420c6c1)) · Merge pull request \#118 from hypit\-ai/codex/hypit\-variant\-revision · author(s): rpone
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+8/−4\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/3cb50cc2a611ab231db34af6fbf6a305b420c6c1/packages/reference-video-tools/test/tools.test.ts) · outcome: `notFollowedUp`
- **\#120** ([`015ef78`](https://github.com/hypit-ai/hypit/commit/015ef781ad75aae2e4f115f3bf0f00da1e0c2d5b)) · feat\(hypit\): persist shared component fit \(\#120\) · author(s): rponeawa
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/tools.ts` changed \(\+16/−2\); its test file `packages/reference-video-tools/test/tools.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/tools.test.ts`](https://github.com/hypit-ai/hypit/blob/015ef781ad75aae2e4f115f3bf0f00da1e0c2d5b/packages/reference-video-tools/test/tools.test.ts) · outcome: `notFollowedUp`
- **\#121** ([`0f01805`](https://github.com/hypit-ai/hypit/commit/0f01805cac17dadb8168e492416f4b2d5e4d4f48)) · refactor\(hypit\): sample visual declaration changes only \(\#121\) · author(s): rponeawa
  - Question (`untested-change`, intervalLow=N/A): `packages/reference-video-tools/src/plan.ts` changed \(\+15/−214\); its test file `packages/reference-video-tools/test/plan.test.ts` didn't change in this PR\.
  - Target: [`packages/reference-video-tools/test/plan.test.ts`](https://github.com/hypit-ai/hypit/blob/0f01805cac17dadb8168e492416f4b2d5e4d4f48/packages/reference-video-tools/test/plan.test.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **656937.08 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 4219.68 | 4219.68 | 4219.68 |
| `sessionOpen` | 200 | 914362.98 | 889.38 | 16541.34 |
| `staticAnalysis` | 200 | 66929.29 | 330 | 465.26 |
| `brief` | 200 | 1834.12 | 9.25 | 10.86 |
| `scoring` | 200 | 6559.17 | 15.85 | 48.68 |
| `report` | 1 | 26.45 | 26.45 | 26.45 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
