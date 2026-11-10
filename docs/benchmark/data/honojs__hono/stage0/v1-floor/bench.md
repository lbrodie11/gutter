# Gutter Benchmark Report · honojs/hono

Branch: `HEAD` · Head: [`eb754bd`](https://github.com/honojs/hono/commit/eb754bd5ef22c63f1634a4c374a86be086f85710) (`eb754bd5ef22c63f1634a4c374a86be086f85710`) · Generated: `2026-11-10T07:04:21.195Z` · Gutter `0.2.1` + Repo Archaeology `0.4.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.20 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED. Follow-up proxy 0.22 [0.13–0.35], lift ×0.34 vs recent. Human labels: GU-04.
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
| Scored PRs (`production`) | 34 | ≥ 1 scorable question with observed 7-day window |

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
| `noQuestions` | 123 |
| `unscorableOnly` | 42 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 1 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 34
- **PRs with questions:** 77 / 200 (0.385, [0.3203330972692322, 0.45400132779753916])
- **Total questions:** 103 (per PR: 0.515)
- **Salience `quiet`:** 108 / 200 (0.54, [0.47082289188953336, 0.6076694820002854])
- **Salience `brief`:** 52 / 200 (0.26, [0.20413830063574684, 0.3249074560253411])
- **Salience `full` (full-salience share):** 40 / 200 (0.2, [0.15045200926098115, 0.26085518656537876])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 12 |
| `notFollowedUp` | 42 |
| `censored` | 1 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 55 |
| Shared follow-up outcomes across PR windows | 4 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 12 / 54 (0.2222, [0.13195416567633134, 0.3493867165963889]) | [0.1199, 0.3333] (median 0.2188, n=1000, seed=20261108) |
| Question-level follow-up rate | 10 / 47 (0.2128, [0.11989707998095002, 0.349040267091984]) | — |
| `forgotten-companion` Precision@1 | 6 / 23 (0.2609, [0.12548616044986347, 0.4647000483742537]) | — |
| `forgotten-companion` Precision@3 | 7 / 28 (0.25, [0.12676494919293316, 0.4335567031899896]) | — |
| Same-author follow-up rate | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | — |
| Same-author share of `followedUp` | 6 / 12 (0.5, [0.2537815976337061, 0.7462184023662939]) | — |
| RA-signal follow-up rate | 5 / 54 (0.0926, [0.04020113475702944, 0.19909882590962688]) | — |
| Missed co-change follow-up recall proxy | 7 / 493 (0.0142, [0.006894542719487446, 0.029015219849527464]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 486 untouched historical co-change partner(s) across 114 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0.3428 · **Bootstrap CI:** [0.1765, 0.5294] (median 0.3415, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 54 | 0 (0) | 31 / 54 (0.5741, [0.4416273382599006, 0.6966817598007073]) | 29 / 34 (0.8529, [0.6987194350454783, 0.9355055855521754]) | 13 / 54 (0.2407, [0.14644291495284428, 0.36947524183502795]) | ×0.387 | [0.1818, 0.6552] (median 0.3824, n=1000, seed=20261108) |
| `popular-near` | 54 | 0 (0) | 11 / 54 (0.2037, [0.11774054087421391, 0.3290230668833543]) | 10 / 34 (0.2941, [0.1683463067042242, 0.46168909794714436]) | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | ×1.0908 | [0.4737, 2.8571] (median 1.0833, n=1000, seed=20261108) |
| `recent` | 54 | 0 (0) | 35 / 54 (0.6481, [0.5148483072023631, 0.7617698889188528]) | 29 / 34 (0.8529, [0.6987194350454783, 0.9355055855521754]) | 17 / 54 (0.3148, [0.20679280660052918, 0.44743444824795103]) | ×0.3428 | [0.1765, 0.5294] (median 0.3415, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 12 / 54 (0.2222, [0.13195416567633134, 0.3493867165963889]) | 31 / 54 (0.5741, [0.4416273382599006, 0.6966817598007073]) | 11 / 54 (0.2037, [0.11774054087421391, 0.3290230668833543]) | 35 / 54 (0.6481, [0.5148483072023631, 0.7617698889188528]) | `recent` | ×0.3428 | [0.1765, 0.5294] (median 0.3415, n=1000, seed=20261108) |
| Same-author follow-up | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | 13 / 54 (0.2407, [0.14644291495284428, 0.36947524183502795]) | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | 17 / 54 (0.3148, [0.20679280660052918, 0.44743444824795103]) | `recent` | ×0.3529 | [0.0909, 0.6875] (median 0.35, n=1000, seed=20261108) |
| RA-signal follow-up | 5 / 54 (0.0926, [0.04020113475702944, 0.19909882590962688]) | 7 / 54 (0.1296, [0.06423720747326259, 0.2442173022236977]) | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | 11 / 54 (0.2037, [0.11774054087421391, 0.3290230668833543]) | `recent` | ×0.4546 | [0.0909, 1] (median 0.4444, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 29 | 28 | 7 / 28 (0.25, [0.12676494919293316, 0.4335567031899896]) | 28 | 7 / 28 (0.25, [0.12676494919293316, 0.4335567031899896]) | 3 / 28 (0.1071, [0.03711836682929999, 0.27195851548672156]) |
| `family-drift` | 9 | 9 | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 17 | 5 / 17 (0.2941, [0.1327998961029523, 0.5313311006653985]) | 3 / 17 (0.1765, [0.06191126637620998, 0.4102945856883412]) |
| `untested-change` | 10 | 10 | 0 / 10 (0, [0, 0.2775327998628892]) | 10 | 0 / 10 (0, [0, 0.2775327998628892]) | 0 / 10 (0, [0, 0.2775327998628892]) |
| `wide-surface` | 55 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.5+` | 29 | 28 | 7 / 28 (0.25, [0.12676494919293316, 0.4335567031899896]) | 3 / 28 (0.1071, [0.03711836682929999, 0.27195851548672156]) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 171 | 40 | 8 / 40 (0.2, [0.10499989725437703, 0.34757306346399497]) |
| `botOrAgentOrigin` | 0 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 26 | 14 | 4 / 14 (0.2857, [0.1172137864457692, 0.5464908432989318]) |
| `dependencyOrVersionOnly` | 10 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 2 | 6 | 2 / 6 (0.3333, [0.09677141110578043, 0.7000066848616079]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 34
- **PRs with questions:** 77 / 200 (0.385, [0.3203330972692322, 0.45400132779753916])
- **Total questions:** 103 (per PR: 0.515)
- **Salience `quiet`:** 108 / 200 (0.54, [0.47082289188953336, 0.6076694820002854])
- **Salience `brief`:** 52 / 200 (0.26, [0.20413830063574684, 0.3249074560253411])
- **Salience `full` (full-salience share):** 40 / 200 (0.2, [0.15045200926098115, 0.26085518656537876])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 12 |
| `notFollowedUp` | 42 |
| `censored` | 1 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 55 |
| Shared follow-up outcomes across PR windows | 4 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 12 / 54 (0.2222, [0.13195416567633134, 0.3493867165963889]) | [0.1199, 0.3333] (median 0.2188, n=1000, seed=20261108) |
| Question-level follow-up rate | 10 / 47 (0.2128, [0.11989707998095002, 0.349040267091984]) | — |
| `forgotten-companion` Precision@1 | 6 / 23 (0.2609, [0.12548616044986347, 0.4647000483742537]) | — |
| `forgotten-companion` Precision@3 | 7 / 28 (0.25, [0.12676494919293316, 0.4335567031899896]) | — |
| Same-author follow-up rate | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | — |
| Same-author share of `followedUp` | 6 / 12 (0.5, [0.2537815976337061, 0.7462184023662939]) | — |
| RA-signal follow-up rate | 5 / 54 (0.0926, [0.04020113475702944, 0.19909882590962688]) | — |
| Missed co-change follow-up recall proxy | 7 / 493 (0.0142, [0.006894542719487446, 0.029015219849527464]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 486 untouched historical co-change partner(s) across 114 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0.3428 · **Bootstrap CI:** [0.1765, 0.5294] (median 0.3415, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 54 | 0 (0) | 31 / 54 (0.5741, [0.4416273382599006, 0.6966817598007073]) | 29 / 34 (0.8529, [0.6987194350454783, 0.9355055855521754]) | 13 / 54 (0.2407, [0.14644291495284428, 0.36947524183502795]) | ×0.387 | [0.1818, 0.6552] (median 0.3824, n=1000, seed=20261108) |
| `popular-near` | 54 | 0 (0) | 11 / 54 (0.2037, [0.11774054087421391, 0.3290230668833543]) | 10 / 34 (0.2941, [0.1683463067042242, 0.46168909794714436]) | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | ×1.0908 | [0.4737, 2.8571] (median 1.0833, n=1000, seed=20261108) |
| `recent` | 54 | 0 (0) | 35 / 54 (0.6481, [0.5148483072023631, 0.7617698889188528]) | 29 / 34 (0.8529, [0.6987194350454783, 0.9355055855521754]) | 17 / 54 (0.3148, [0.20679280660052918, 0.44743444824795103]) | ×0.3428 | [0.1765, 0.5294] (median 0.3415, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 12 / 54 (0.2222, [0.13195416567633134, 0.3493867165963889]) | 31 / 54 (0.5741, [0.4416273382599006, 0.6966817598007073]) | 11 / 54 (0.2037, [0.11774054087421391, 0.3290230668833543]) | 35 / 54 (0.6481, [0.5148483072023631, 0.7617698889188528]) | `recent` | ×0.3428 | [0.1765, 0.5294] (median 0.3415, n=1000, seed=20261108) |
| Same-author follow-up | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | 13 / 54 (0.2407, [0.14644291495284428, 0.36947524183502795]) | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | 17 / 54 (0.3148, [0.20679280660052918, 0.44743444824795103]) | `recent` | ×0.3529 | [0.0909, 0.6875] (median 0.35, n=1000, seed=20261108) |
| RA-signal follow-up | 5 / 54 (0.0926, [0.04020113475702944, 0.19909882590962688]) | 7 / 54 (0.1296, [0.06423720747326259, 0.2442173022236977]) | 6 / 54 (0.1111, [0.05193022496999549, 0.22194701021181282]) | 11 / 54 (0.2037, [0.11774054087421391, 0.3290230668833543]) | `recent` | ×0.4546 | [0.0909, 1] (median 0.4444, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#5131** ([`80959d4`](https://github.com/honojs/hono/commit/80959d47d56ac18c2985336ad311917dc56497c5)) · fix\(utils/body\): reuse cached formData in \`parseBody\(\)\` \(\#5131\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.6536393971937905): `src/request.ts` changed alongside `src/request.test.ts` in 18 of its 21 commits \(95% CI 65%–95%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/request.ts`](https://github.com/honojs/hono/blob/80959d47d56ac18c2985336ad311917dc56497c5/src/request.ts) · outcome: `followedUp` in [`d796450`](https://github.com/honojs/hono/commit/d7964503c956ae4af78597b7b11a05f9e5e73d2d) (0.29h, sameAuthor=true)
- **\#5012** ([`74c2cf8`](https://github.com/honojs/hono/commit/74c2cf8ef4f5cc29a876380df1ba230ff7128b3f)) · test\(aws\-lambda\): update integration tests \(\#5012\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.6414692935030094): `src/adapter/aws-lambda/handler.ts` changed alongside `runtime-tests/lambda/index.test.ts` in 20 of its 24 commits \(95% CI 64%–93%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/adapter/aws-lambda/handler.ts`](https://github.com/honojs/hono/blob/74c2cf8ef4f5cc29a876380df1ba230ff7128b3f/src/adapter/aws-lambda/handler.ts) · outcome: `followedUp` in [`fa5f9bf`](https://github.com/honojs/hono/commit/fa5f9bfcc25d65e08af85211cc2e5ecd0e0ea24b) (0.06h, sameAuthor=true)
- **\#5463** ([`b877827`](https://github.com/honojs/hono/commit/b877827fccde0be4ee78457ae8b65db2436139f9)) · feat\(adapters\): add the seven adapters as workspace packages \(\#5463\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.5101091635454027): `package.json` changed alongside `src/adapter/deno/index.ts` in 4 of its 4 commits \(95% CI 51%–100%\) but is untouched here\. Does it need a matching change?
  - Target: [`package.json`](https://github.com/honojs/hono/blob/b877827fccde0be4ee78457ae8b65db2436139f9/package.json) · outcome: `followedUp` in [`645ddd6`](https://github.com/honojs/hono/commit/645ddd6e6ceb0cf5bd9c49dfe03850f874409151) (1.32h, sameAuthor=true)
- **\#5447** ([`fc2343d`](https://github.com/honojs/hono/commit/fc2343dbad8af7ab82bc4a6c6907e57416aed878)) · feat\(adapters\): add @​hono/bun as a workspace package \(\#5447\) · author(s): Yusuke Wada
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(serve\-static\.ts across src/adapter/\*\)\. Should `src/adapter/cloudflare-workers/serve-static.ts` \(\+1 more\) follow?
  - Target: [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/fc2343dbad8af7ab82bc4a6c6907e57416aed878/src/adapter/cloudflare-workers/serve-static.ts) · outcome: `followedUp` in [`b877827`](https://github.com/honojs/hono/commit/b877827fccde0be4ee78457ae8b65db2436139f9) (0.89h, sameAuthor=true)
- **\#5447** ([`fc2343d`](https://github.com/honojs/hono/commit/fc2343dbad8af7ab82bc4a6c6907e57416aed878)) · feat\(adapters\): add @​hono/bun as a workspace package \(\#5447\) · author(s): Yusuke Wada
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(serve\-static\.ts across src/adapter/\*\)\. Should `src/adapter/cloudflare-workers/serve-static.ts` \(\+1 more\) follow?
  - Target: [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/fc2343dbad8af7ab82bc4a6c6907e57416aed878/src/adapter/deno/serve-static.ts) · outcome: `followedUp` in [`b877827`](https://github.com/honojs/hono/commit/b877827fccde0be4ee78457ae8b65db2436139f9) (0.89h, sameAuthor=true)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#5116** ([`fb9d7bf`](https://github.com/honojs/hono/commit/fb9d7bf8fb0dd7b3c92a0c289d5dc685edf5f3a3)) · test\(context\): assert case\-insensitive header names in response helpers \(\#5116\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.787449267620232): `src/context.ts` changed alongside `src/context.test.ts` in 71 of its 81 commits \(95% CI 79%–93%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/context.ts`](https://github.com/honojs/hono/blob/fb9d7bf8fb0dd7b3c92a0c289d5dc685edf5f3a3/src/context.ts) · outcome: `notFollowedUp`
- **\#5442** ([`859e2c2`](https://github.com/honojs/hono/commit/859e2c2bd0ec6d104e98e126eaa86cfcf5def0d9)) · chore: let oxfmt sort imports instead of eslint \(\#5442\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.7575059933447591): `src/jsx/hooks/index.ts` changed alongside `src/jsx/hooks/dom.test.tsx` in 12 of its 12 commits \(95% CI 76%–100%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/jsx/hooks/index.ts`](https://github.com/honojs/hono/blob/859e2c2bd0ec6d104e98e126eaa86cfcf5def0d9/src/jsx/hooks/index.ts) · outcome: `notFollowedUp`
- **\#5142** ([`e36f57d`](https://github.com/honojs/hono/commit/e36f57dac0615c1bdd03ff1975b6ca8d3dc5917f)) · fix\(aws\-lambda\): add jwt and lambda authorizer types for API Gateway v2 \(\#5142\) · author(s): Jason G
  - Question (`forgotten-companion`, intervalLow=0.7301796936242461): `src/adapter/aws-lambda/handler.ts` changed alongside `src/adapter/aws-lambda/handler.test.ts` in 16 of its 17 commits \(95% CI 73%–99%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/adapter/aws-lambda/handler.ts`](https://github.com/honojs/hono/blob/e36f57dac0615c1bdd03ff1975b6ca8d3dc5917f/src/adapter/aws-lambda/handler.ts) · outcome: `notFollowedUp`
- **\#5479** ([`1e1207c`](https://github.com/honojs/hono/commit/1e1207cabfcd154146bf6ac9fd6a0b646f7fc484)) · test\(serve\-static\): fix the test \(\#5479\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.7167126242970107): `src/middleware/serve-static/index.ts` changed alongside `src/middleware/serve-static/index.test.ts` in 15 of its 16 commits \(95% CI 72%–99%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/1e1207cabfcd154146bf6ac9fd6a0b646f7fc484/src/middleware/serve-static/index.ts) · outcome: `notFollowedUp`
- **\#5380** ([`cb5bea3`](https://github.com/honojs/hono/commit/cb5bea3614e6591e8ab933ef9a38ce7addf1d09a)) · fix\(jsx\): replace Suspense and ErrorBoundary content across newlines \(\#5380\) · author(s): Neil Daquioag
  - Question (`forgotten-companion`, intervalLow=0.6853129557584889): `src/helper/streaming/sse.ts` changed alongside `src/helper/streaming/sse.test.tsx` in 13 of its 14 commits \(95% CI 69%–99%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/helper/streaming/sse.ts`](https://github.com/honojs/hono/blob/cb5bea3614e6591e8ab933ef9a38ce7addf1d09a/src/helper/streaming/sse.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **92261.01 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 1224.38 | 1224.38 | 1224.38 |
| `sessionOpen` | 200 | 29297.19 | 137.12 | 197.95 |
| `staticAnalysis` | 200 | 22819.28 | 113.87 | 147.13 |
| `brief` | 200 | 1815.97 | 8.81 | 11.29 |
| `scoring` | 200 | 2685.78 | 12.16 | 18.23 |
| `report` | 1 | 22.64 | 22.64 | 22.64 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
