# Gutter Benchmark Report · DayuanJiang/next\-ai\-draw\-io

Branch: `HEAD` · Head: [`c9dc5f5`](https://github.com/DayuanJiang/next-ai-draw-io/commit/c9dc5f5cc62e7e5a327a62b39027d80033e1548c) (`c9dc5f5cc62e7e5a327a62b39027d80033e1548c`) · Generated: `2026-11-10T16:18:29.439Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.00 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=3 < 30). Follow-up proxy 0.67 [0.21–0.94], lift ×0.67 vs popular-near. Human labels: GU-04.
```

## Change-Unit Discovery & Eligibility Funnel

| Stage / Bucket | Count | Notes |
|---|---:|---|
| First-parent commits discovered | 672 | `git rev-list --first-parent` on `HEAD` |
| Classified: `merge-commit` (`high`) | 62 | 2 parents, `Merge pull request #n` |
| Classified: `merge-commit` (`medium`) | 1 | 2 parents, unnumbered merge |
| Classified: `squash-subject` (`medium`) | 482 | 1 parent, subject ends with `(#n)` |
| Classified: `octopus` (skipped) | 0 | > 2 parents |
| Classified: `not-a-pr` (skipped) | 127 | Direct pushes / rebase commits without `(#n)` |
| Classified: `change-unit` (`low`) | 0 | Separate unnumbered pool (`--include-unnumbered`) |
| Eligible PRs | 536 | Passed classification, `--since`, merge-base, non-empty diff |
| Evaluated PRs | 200 | Newest `--prs 200` with available history |
| Scored PRs (`production`) | 3 | ≥ 1 scorable question with observed 7-day window |

### Funnel Exclusions

| Exclusion Reason | Count |
|---|---:|
| `octopus` | 0 |
| `notAPr` | 127 |
| `rootCommit` | 1 |
| `beforeSince` | 0 |
| `missingMergeBase` | 0 |
| `emptyDiff` | 9 |
| `beyondPrsLimit` | 336 |
| `historyUnavailable` | 0 |
| `noQuestions` | 149 |
| `unscorableOnly` | 48 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 3
- **PRs with questions:** 51 / 200 (0.255, [0.19960495172031348, 0.3196292582045472])
- **Total questions:** 54 (per PR: 0.27)
- **Salience `quiet`:** 102 / 200 (0.51, [0.4411858767845865, 0.5784372166878683])
- **Salience `brief`:** 98 / 200 (0.49, [0.4215627833121318, 0.5588141232154136])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 2 |
| `notFollowedUp` | 1 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 51 |
| Shared follow-up outcomes across PR windows | 2 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| Question-level follow-up rate | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | — |
| Same-author share of `followedUp` | 2 / 2 (1, [0.3423802275066531, 1]) | — |
| RA-signal follow-up rate | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | — |
| Missed co-change follow-up recall proxy | 0 / 1303 (0, [0, 0.0029394987393196828]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 1303 untouched historical co-change partner(s) across 116 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `popular-near` · **Headline lift:** ×0.6667 · **Bootstrap CI:** [0, 1] (median 0.6667, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 3 | 0 (0) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| `popular-near` | 3 | 0 (0) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| `recent` | 3 | 0 (0) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | `popular-near` | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| Same-author follow-up | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | `popular-near` | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| RA-signal follow-up | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 3 / 3 (1, [0.4385029682449545, 1]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | `popular-near` | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `untested-change` | 3 | 3 | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 3 | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) |
| `wide-surface` | 51 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 132 | 1 | 1 / 1 (1, [0.20654931437723742, 1]) |
| `botOrAgentOrigin` | 28 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 56 | 2 | 1 / 2 (0.5, [0.09453120573423071, 0.9054687942657693]) |
| `dependencyOrVersionOnly` | 32 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 8 | 1 | 1 / 1 (1, [0.20654931437723742, 1]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 3
- **PRs with questions:** 51 / 200 (0.255, [0.19960495172031348, 0.3196292582045472])
- **Total questions:** 54 (per PR: 0.27)
- **Salience `quiet`:** 102 / 200 (0.51, [0.4411858767845865, 0.5784372166878683])
- **Salience `brief`:** 98 / 200 (0.49, [0.4215627833121318, 0.5588141232154136])
- **Salience `full` (full-salience share):** 0 / 200 (0, [1.7020320458977177e-18, 0.018845326377266575])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 2 |
| `notFollowedUp` | 1 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 51 |
| Shared follow-up outcomes across PR windows | 2 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| Question-level follow-up rate | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | — |
| Same-author share of `followedUp` | 2 / 2 (1, [0.3423802275066531, 1]) | — |
| RA-signal follow-up rate | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | — |
| Missed co-change follow-up recall proxy | 0 / 1303 (0, [0, 0.0029394987393196828]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 1303 untouched historical co-change partner(s) across 116 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `popular-near` · **Headline lift:** ×0.6667 · **Bootstrap CI:** [0, 1] (median 0.6667, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 3 | 0 (0) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| `popular-near` | 3 | 0 (0) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| `recent` | 3 | 0 (0) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | `popular-near` | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| Same-author follow-up | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 3 / 3 (1, [0.4385029682449545, 1]) | 3 / 3 (1, [0.4385029682449545, 1]) | `popular-near` | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |
| RA-signal follow-up | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | 3 / 3 (1, [0.4385029682449545, 1]) | 2 / 3 (0.6667, [0.20765960080204768, 0.9385080552796037]) | `popular-near` | ×0.6667 | [0, 1] (median 0.6667, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#984** ([`4c7b2cc`](https://github.com/DayuanJiang/next-ai-draw-io/commit/4c7b2cc0c5a5ac98ff6c9f3829689f68a2a8c561)) · feat\(mcp\-server\): the preview is the web app's canvas: same\-origin draw\.io, version cards, get\_selection \(\#984\) · author(s): Dayuan Jiang
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/new-diagram.ts` changed \(\+23/−2\); its test file `packages/mcp-server/tests/new-diagram.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/new-diagram.test.ts`](https://github.com/DayuanJiang/next-ai-draw-io/blob/4c7b2cc0c5a5ac98ff6c9f3829689f68a2a8c561/packages/mcp-server/tests/new-diagram.test.ts) · outcome: `followedUp` in [`60105dd`](https://github.com/DayuanJiang/next-ai-draw-io/commit/60105ddb51c5e02824cb15be39d5184ed552438d) (15.15h, sameAuthor=true)
- **\#969** ([`cd5352c`](https://github.com/DayuanJiang/next-ai-draw-io/commit/cd5352ca881c7e156a2186a2cfd70542afdace31)) · feat\(diagram\): named styles and compact cells for shorter model output \(\#969\) · author(s): Dayuan Jiang
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/xml-validation.ts` changed \(\+78/−13\); its test file `packages/mcp-server/tests/xml-validation.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/xml-validation.test.ts`](https://github.com/DayuanJiang/next-ai-draw-io/blob/cd5352ca881c7e156a2186a2cfd70542afdace31/packages/mcp-server/tests/xml-validation.test.ts) · outcome: `followedUp` in [`60105dd`](https://github.com/DayuanJiang/next-ai-draw-io/commit/60105ddb51c5e02824cb15be39d5184ed552438d) (38.63h, sameAuthor=true)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#997** ([`645d366`](https://github.com/DayuanJiang/next-ai-draw-io/commit/645d366c29f17b5a3f29dfe3bbccd09cc0681eb3)) · feat\(mcp\-server\): fixes from the user simulation, release 0\.4\.2 \(\#997\) · author(s): Dayuan Jiang
  - Question (`untested-change`, intervalLow=N/A): `packages/mcp-server/src/diagram-operations.ts` changed \(\+33/−1\); its test file `packages/mcp-server/tests/diagram-operations.test.ts` didn't change in this PR\.
  - Target: [`packages/mcp-server/tests/diagram-operations.test.ts`](https://github.com/DayuanJiang/next-ai-draw-io/blob/645d366c29f17b5a3f29dfe3bbccd09cc0681eb3/packages/mcp-server/tests/diagram-operations.test.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **205991.66 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 6294.51 | 6294.51 | 6294.51 |
| `sessionOpen` | 200 | 107392.86 | 282.44 | 527.63 |
| `staticAnalysis` | 200 | 77637.77 | 382.69 | 630.37 |
| `brief` | 200 | 1817.06 | 8.5 | 10.1 |
| `scoring` | 200 | 2195.86 | 10.27 | 14.24 |
| `report` | 1 | 24.84 | 24.84 | 24.84 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
