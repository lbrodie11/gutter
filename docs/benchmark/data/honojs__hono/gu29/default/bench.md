# Gutter Benchmark Report · honojs/hono

Branch: `HEAD` · Head: [`eb754bd`](https://github.com/honojs/hono/commit/eb754bd5ef22c63f1634a4c374a86be086f85710) (`eb754bd5ef22c63f1634a4c374a86be086f85710`) · Generated: `2026-11-10T09:18:57.521Z` · Gutter `0.3.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=10 < 30). Follow-up proxy 0.00 [0.00–0.28], lift ×0.00 vs recent. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 2292 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 31 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 0 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 1587 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 674 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 1618 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 10 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 674 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 0 |
| `beyondPrsLimit` | 1418 |
| `historyUnavailable` | 0 |
| `noQuestions` | 140 |
| `unscorableOnly` | 50 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 10
- **PRs with questions:** 60 / 200 (0.3, [0.24074744682371402, 0.3667906837271926])
- **Total questions:** 66 (per PR: 0.33)
- **Salience `quiet`:** 121 / 200 (0.605, [0.5358834915928536, 0.6701589898679203])
- **Salience `brief`:** 79 / 200 (0.395, [0.32984101013207967, 0.46411650840714636])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 10 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 56 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 10 (0, [0, 0.2775327998628892]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 10 (0, [0, 0.2775327998628892]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 10 (0, [0, 0.2775327998628892]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 10 (0, [0, 0.2775327998628892]) | — |
| Missed co-change follow-up recall proxy | 0 / 498 (0, [4.303611608069208e-19, 0.007654725916271222]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 498 untouched historical co-change partner(s) across 115 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0 · **Bootstrap CI:** [0, 0] (median 0, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 10 | 0 (0) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 3 / 10 (0.3, [0.10779126740630099, 0.6032218525388546]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `popular-near` | 10 | 0 (0) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `recent` | 10 | 0 (0) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 4 / 10 (0.4, [0.16818032970623617, 0.6873262302663417]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 10 (0, [0, 0.2775327998628892]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 10 (0, [0, 0.2775327998628892]) | 3 / 10 (0.3, [0.10779126740630099, 0.6032218525388546]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 4 / 10 (0.4, [0.16818032970623617, 0.6873262302663417]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 10 (0, [0, 0.2775327998628892]) | 2 / 10 (0.2, [0.05668215145437522, 0.5098375284633582]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 3 / 10 (0.3, [0.10779126740630099, 0.6032218525388546]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 10 | 10 | 0 / 10 (0, [0, 0.2775327998628892]) | 10 | 0 / 10 (0, [0, 0.2775327998628892]) | 0 / 10 (0, [0, 0.2775327998628892]) |
| `wide-surface` | 56 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 171 | 7 | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) |
| `botOrAgentOrigin` | 0 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 26 | 3 | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) |
| `dependencyOrVersionOnly` | 10 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 2 | 1 | 0 / 1 (0, [0, 0.7934506856227626]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 10
- **PRs with questions:** 60 / 200 (0.3, [0.24074744682371402, 0.3667906837271926])
- **Total questions:** 66 (per PR: 0.33)
- **Salience `quiet`:** 121 / 200 (0.605, [0.5358834915928536, 0.6701589898679203])
- **Salience `brief`:** 79 / 200 (0.395, [0.32984101013207967, 0.46411650840714636])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 0 |
| `notFollowedUp` | 10 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 56 |
| Shared follow-up outcomes across PR windows | 0 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 0 / 10 (0, [0, 0.2775327998628892]) | [0, 0] (median 0, n=1000, seed=20261108) |
| Question-level follow-up rate | 0 / 10 (0, [0, 0.2775327998628892]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 0 / 10 (0, [0, 0.2775327998628892]) | — |
| Same-author share of `followedUp` | 0 / 0 (N/A) | — |
| RA-signal follow-up rate | 0 / 10 (0, [0, 0.2775327998628892]) | — |
| Missed co-change follow-up recall proxy | 0 / 498 (0, [4.303611608069208e-19, 0.007654725916271222]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 498 untouched historical co-change partner(s) across 115 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0 · **Bootstrap CI:** [0, 0] (median 0, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 10 | 0 (0) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 3 / 10 (0.3, [0.10779126740630099, 0.6032218525388546]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `popular-near` | 10 | 0 (0) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| `recent` | 10 | 0 (0) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 4 / 10 (0.4, [0.16818032970623617, 0.6873262302663417]) | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0 / 10 (0, [0, 0.2775327998628892]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 8 / 10 (0.8, [0.4901624715366418, 0.9433178485456247]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| Same-author follow-up | 0 / 10 (0, [0, 0.2775327998628892]) | 3 / 10 (0.3, [0.10779126740630099, 0.6032218525388546]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 4 / 10 (0.4, [0.16818032970623617, 0.6873262302663417]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |
| RA-signal follow-up | 0 / 10 (0, [0, 0.2775327998628892]) | 2 / 10 (0.2, [0.05668215145437522, 0.5098375284633582]) | 1 / 10 (0.1, [0.01787621309507289, 0.4041500267952385]) | 3 / 10 (0.3, [0.10779126740630099, 0.6032218525388546]) | `recent` | ×0 | [0, 0] (median 0, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

_None in this run._

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#5071** ([`82b321b`](https://github.com/honojs/hono/commit/82b321b5b0e7a57cdaab45f2f90671ec0737795b)) · fix: avoid circular dependency between body\.ts and request\.ts \(\#5071\) · author(s): Taku Amano
  - Question (`untested-change`, intervalLow=N/A): `src/utils/body.ts` changed \(\+6/−4\); its test file `src/utils/body.test.ts` didn't change in this PR\.
  - Target: [`src/utils/body.test.ts`](https://github.com/honojs/hono/blob/82b321b5b0e7a57cdaab45f2f90671ec0737795b/src/utils/body.test.ts) · outcome: `notFollowedUp`
- **\#5154** ([`8f07028`](https://github.com/honojs/hono/commit/8f0702827002f0ada02434d908853458c17f862d)) · Merge pull request \#5154 from honojs/next · author(s): Arham Amin, Taku Amano, natsuki ueda, Hiroki Akahoshi, asahi, James Ross, haki, Yusuke Wada, Igor Savin
  - Question (`untested-change`, intervalLow=N/A): `src/jsx/base.ts` changed \(\+41/−18\); its test file `src/jsx/base.test.tsx` didn't change in this PR\.
  - Target: [`src/jsx/base.test.tsx`](https://github.com/honojs/hono/blob/8f0702827002f0ada02434d908853458c17f862d/src/jsx/base.test.tsx) · outcome: `notFollowedUp`
- **\#5236** ([`63bbcf5`](https://github.com/honojs/hono/commit/63bbcf508c74d9fe7a3e20f4dfe7ffacc566dcce)) · fix\(trie\-router\): match suffix wildcard routes \(\#5236\) · author(s): Taku Amano
  - Question (`untested-change`, intervalLow=N/A): `src/router/trie-router/router.ts` changed \(\+3/−13\); its test file `src/router/trie-router/router.test.ts` didn't change in this PR\.
  - Target: [`src/router/trie-router/router.test.ts`](https://github.com/honojs/hono/blob/63bbcf508c74d9fe7a3e20f4dfe7ffacc566dcce/src/router/trie-router/router.test.ts) · outcome: `notFollowedUp`
- **\#5252** ([`a194628`](https://github.com/honojs/hono/commit/a19462879716e7b600daed8eb3a1b2af4bd68feb)) · fix\(pattern\-router/linear\-router\): prevent prefix overmatch on wildcard routes \(\#5252\) · author(s): Yusuke Wada
  - Question (`untested-change`, intervalLow=N/A): `src/router/pattern-router/router.ts` changed \(\+3/−9\); its test file `src/router/pattern-router/router.test.ts` didn't change in this PR\.
  - Target: [`src/router/pattern-router/router.test.ts`](https://github.com/honojs/hono/blob/a19462879716e7b600daed8eb3a1b2af4bd68feb/src/router/pattern-router/router.test.ts) · outcome: `notFollowedUp`
- **\#5266** ([`a10592f`](https://github.com/honojs/hono/commit/a10592f3e1864cbe277619633db953450a6b1e4b)) · fix\(reg\-exp\-router\): associate wildcard middleware with matching routes \(\#5266\) · author(s): Taku Amano
  - Question (`untested-change`, intervalLow=N/A): `src/router/reg-exp-router/router.ts` changed \(\+60/−98\); its test file `src/router/reg-exp-router/router.test.ts` didn't change in this PR\.
  - Target: [`src/router/reg-exp-router/router.test.ts`](https://github.com/honojs/hono/blob/a10592f3e1864cbe277619633db953450a6b1e4b/src/router/reg-exp-router/router.test.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **175625.18 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 3377.8 | 3377.8 | 3377.8 |
| `sessionOpen` | 200 | 48058.64 | 228.47 | 406.32 |
| `staticAnalysis` | 200 | 49562.99 | 219.36 | 442.56 |
| `brief` | 200 | 3603.57 | 14.27 | 34.57 |
| `scoring` | 200 | 4788.72 | 20.02 | 45.63 |
| `report` | 1 | 25.25 | 25.25 | 25.25 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
