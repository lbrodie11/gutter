# Gutter Benchmark Report · honojs/hono

Branch: `HEAD` · Head: [`eb754bd`](https://github.com/honojs/hono/commit/eb754bd5ef22c63f1634a4c374a86be086f85710) (`eb754bd5ef22c63f1634a4c374a86be086f85710`) · Generated: `2026-11-10T14:42:28.898Z` · Gutter `0.4.0` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.40 (< 1/3) ✗
Question usefulness (Gate A): UNVERIFIED. Follow-up proxy 0.23 [0.16–0.32], lift ×0.36 vs recent. Human labels: GU-04.
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
| Scored PRs (`production`) | 70 | ≥ 1 scorable question with observed 7-day window |

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
| `noQuestions` | 90 |
| `unscorableOnly` | 35 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 5 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 70
- **PRs with questions:** 110 / 200 (0.55, [0.4807561513847569, 0.6173593159775166])
- **Total questions:** 164 (per PR: 0.82)
- **Salience `quiet`:** 79 / 200 (0.395, [0.32984101013207967, 0.46411650840714636])
- **Salience `brief`:** 41 / 200 (0.205, [0.15486176203836208, 0.26625698052422514])
- **Salience `full` (full-salience share):** 80 / 200 (0.4, [0.3346057856680734, 0.46916327960737997])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 25 |
| `notFollowedUp` | 82 |
| `censored` | 6 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 58 |
| Shared follow-up outcomes across PR windows | 10 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 25 / 107 (0.2336, [0.16356165995161556, 0.32219032665650293]) | [0.156, 0.3175] (median 0.2342, n=1000, seed=20261108) |
| Question-level follow-up rate | 23 / 100 (0.23, [0.1584326588030345, 0.3215438302287378]) | — |
| `forgotten-companion` Precision@1 | 14 / 64 (0.2188, [0.13502319406719474, 0.3343278395662582]) | — |
| `forgotten-companion` Precision@3 | 20 / 84 (0.2381, [0.15974690895549554, 0.3393506630712311]) | — |
| Same-author follow-up rate | 13 / 107 (0.1215, [0.07239434166761743, 0.19683216561760356]) | — |
| Same-author share of `followedUp` | 13 / 25 (0.52, [0.33498516950356777, 0.6996871404588704]) | — |
| RA-signal follow-up rate | 9 / 107 (0.0841, [0.044881945524203326, 0.15216940198671847]) | — |
| Missed co-change follow-up recall proxy | 20 / 495 (0.0404, [0.026305346090061278, 0.06158121194450798]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 475 untouched historical co-change partner(s) across 109 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0.3589 · **Bootstrap CI:** [0.2329, 0.5101] (median 0.3539, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 107 | 0 (0) | 61 / 106 (0.5755, [0.48036088516716324, 0.6653036041047654]) | 58 / 69 (0.8406, [0.7366551828518044, 0.9085817572223197]) | 24 / 106 (0.2264, [0.15713470742524072, 0.3148315189640176]) | ×0.4059 | [0.2576, 0.6] (median 0.4029, n=1000, seed=20261108) |
| `popular-near` | 107 | 0 (0) | 27 / 105 (0.2571, [0.18315909307507203, 0.34826945857620983]) | 25 / 68 (0.3676, [0.26300465135235673, 0.4864436436088385]) | 10 / 105 (0.0952, [0.0525563098634332, 0.16649127622203672]) | ×0.9086 | [0.54, 1.5828] (median 0.9167, n=1000, seed=20261108) |
| `recent` | 107 | 0 (0) | 69 / 106 (0.6509, [0.5563658870548236, 0.7349630914890337]) | 57 / 69 (0.8261, [0.7201637386871084, 0.8976163103200319]) | 31 / 106 (0.2925, [0.21433337400446412, 0.3850892804977318]) | ×0.3589 | [0.2329, 0.5101] (median 0.3539, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 25 / 107 (0.2336, [0.16356165995161556, 0.32219032665650293]) | 61 / 106 (0.5755, [0.48036088516716324, 0.6653036041047654]) | 27 / 105 (0.2571, [0.18315909307507203, 0.34826945857620983]) | 69 / 106 (0.6509, [0.5563658870548236, 0.7349630914890337]) | `recent` | ×0.3589 | [0.2329, 0.5101] (median 0.3539, n=1000, seed=20261108) |
| Same-author follow-up | 13 / 107 (0.1215, [0.07239434166761743, 0.19683216561760356]) | 24 / 106 (0.2264, [0.15713470742524072, 0.3148315189640176]) | 10 / 105 (0.0952, [0.0525563098634332, 0.16649127622203672]) | 31 / 106 (0.2925, [0.21433337400446412, 0.3850892804977318]) | `recent` | ×0.4154 | [0.2141, 0.6906] (median 0.4085, n=1000, seed=20261108) |
| RA-signal follow-up | 9 / 107 (0.0841, [0.044881945524203326, 0.15216940198671847]) | 14 / 106 (0.1321, [0.08033205324120549, 0.20955356155814195]) | 7 / 105 (0.0667, [0.03266588465602071, 0.1312556486825412]) | 21 / 106 (0.1981, [0.13338893526287282, 0.2839531076494123]) | `recent` | ×0.4245 | [0.1427, 0.9057] (median 0.4091, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 90 | 84 | 20 / 84 (0.2381, [0.15974690895549554, 0.3393506630712311]) | 84 | 20 / 84 (0.2381, [0.15974690895549554, 0.3393506630712311]) | 10 / 84 (0.119, [0.0659654924759903, 0.2054491577447029]) |
| `family-drift` | 9 | 9 | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 17 | 5 / 17 (0.2941, [0.1327998961029523, 0.5313311006653985]) | 3 / 17 (0.1765, [0.06191126637620998, 0.4102945856883412]) |
| `untested-change` | 7 | 7 | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 7 | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) | 0 / 7 (0, [3.584186086443356e-17, 0.3543304350666874]) |
| `wide-surface` | 58 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |

### Breakdown by `interval.low` Bucket (`production`)

| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|
| `0-0.3` | 0 | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `0.3-0.5` | 60 | 55 | 12 / 55 (0.2182, [0.12946024041123025, 0.34370034021840024]) | 7 / 55 (0.1273, [0.06304210427364633, 0.24017027655909076]) |
| `0.5+` | 30 | 29 | 8 / 29 (0.2759, [0.14698755102087954, 0.45717132416865935]) | 3 / 29 (0.1034, [0.03581489135067708, 0.26385081090773804]) |

### Breakdown by Confounder Slice (`production`)

| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |
|---|---:|---:|---|
| `cleanManual` | 171 | 84 | 18 / 84 (0.2143, [0.14006766544991558, 0.3134933222156043]) |
| `botOrAgentOrigin` | 0 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 26 | 23 | 7 / 23 (0.3043, [0.15604024453214022, 0.5086575626875921]) |
| `dependencyOrVersionOnly` | 10 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 2 | 6 | 2 / 6 (0.3333, [0.09677141110578043, 0.7000066848616079]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `sufficient`
- **PRs evaluated:** 200
- **PRs scored:** 70
- **PRs with questions:** 110 / 200 (0.55, [0.4807561513847569, 0.6173593159775166])
- **Total questions:** 164 (per PR: 0.82)
- **Salience `quiet`:** 79 / 200 (0.395, [0.32984101013207967, 0.46411650840714636])
- **Salience `brief`:** 41 / 200 (0.205, [0.15486176203836208, 0.26625698052422514])
- **Salience `full` (full-salience share):** 80 / 200 (0.4, [0.3346057856680734, 0.46916327960737997])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 25 |
| `notFollowedUp` | 82 |
| `censored` | 6 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 58 |
| Shared follow-up outcomes across PR windows | 10 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 25 / 107 (0.2336, [0.16356165995161556, 0.32219032665650293]) | [0.156, 0.3175] (median 0.2342, n=1000, seed=20261108) |
| Question-level follow-up rate | 23 / 100 (0.23, [0.1584326588030345, 0.3215438302287378]) | — |
| `forgotten-companion` Precision@1 | 14 / 64 (0.2188, [0.13502319406719474, 0.3343278395662582]) | — |
| `forgotten-companion` Precision@3 | 20 / 84 (0.2381, [0.15974690895549554, 0.3393506630712311]) | — |
| Same-author follow-up rate | 13 / 107 (0.1215, [0.07239434166761743, 0.19683216561760356]) | — |
| Same-author share of `followedUp` | 13 / 25 (0.52, [0.33498516950356777, 0.6996871404588704]) | — |
| RA-signal follow-up rate | 9 / 107 (0.0841, [0.044881945524203326, 0.15216940198671847]) | — |
| Missed co-change follow-up recall proxy | 20 / 495 (0.0404, [0.026305346090061278, 0.06158121194450798]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 475 untouched historical co-change partner(s) across 109 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0.3589 · **Bootstrap CI:** [0.2329, 0.5101] (median 0.3539, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 107 | 0 (0) | 61 / 106 (0.5755, [0.48036088516716324, 0.6653036041047654]) | 58 / 69 (0.8406, [0.7366551828518044, 0.9085817572223197]) | 24 / 106 (0.2264, [0.15713470742524072, 0.3148315189640176]) | ×0.4059 | [0.2576, 0.6] (median 0.4029, n=1000, seed=20261108) |
| `popular-near` | 107 | 0 (0) | 27 / 105 (0.2571, [0.18315909307507203, 0.34826945857620983]) | 25 / 68 (0.3676, [0.26300465135235673, 0.4864436436088385]) | 10 / 105 (0.0952, [0.0525563098634332, 0.16649127622203672]) | ×0.9086 | [0.54, 1.5828] (median 0.9167, n=1000, seed=20261108) |
| `recent` | 107 | 0 (0) | 69 / 106 (0.6509, [0.5563658870548236, 0.7349630914890337]) | 57 / 69 (0.8261, [0.7201637386871084, 0.8976163103200319]) | 31 / 106 (0.2925, [0.21433337400446412, 0.3850892804977318]) | ×0.3589 | [0.2329, 0.5101] (median 0.3539, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 25 / 107 (0.2336, [0.16356165995161556, 0.32219032665650293]) | 61 / 106 (0.5755, [0.48036088516716324, 0.6653036041047654]) | 27 / 105 (0.2571, [0.18315909307507203, 0.34826945857620983]) | 69 / 106 (0.6509, [0.5563658870548236, 0.7349630914890337]) | `recent` | ×0.3589 | [0.2329, 0.5101] (median 0.3539, n=1000, seed=20261108) |
| Same-author follow-up | 13 / 107 (0.1215, [0.07239434166761743, 0.19683216561760356]) | 24 / 106 (0.2264, [0.15713470742524072, 0.3148315189640176]) | 10 / 105 (0.0952, [0.0525563098634332, 0.16649127622203672]) | 31 / 106 (0.2925, [0.21433337400446412, 0.3850892804977318]) | `recent` | ×0.4154 | [0.2141, 0.6906] (median 0.4085, n=1000, seed=20261108) |
| RA-signal follow-up | 9 / 107 (0.0841, [0.044881945524203326, 0.15216940198671847]) | 14 / 106 (0.1321, [0.08033205324120549, 0.20955356155814195]) | 7 / 105 (0.0667, [0.03266588465602071, 0.1312556486825412]) | 21 / 106 (0.1981, [0.13338893526287282, 0.2839531076494123]) | `recent` | ×0.4245 | [0.1427, 0.9057] (median 0.4091, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#5131** ([`80959d4`](https://github.com/honojs/hono/commit/80959d47d56ac18c2985336ad311917dc56497c5)) · fix\(utils/body\): reuse cached formData in \`parseBody\(\)\` \(\#5131\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.6536): `src/request.ts` changed alongside `src/request.test.ts` in 18 of its 21 commits \(95% CI 65%–95%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/request.ts`](https://github.com/honojs/hono/blob/80959d47d56ac18c2985336ad311917dc56497c5/src/request.ts) · outcome: `followedUp` in [`d796450`](https://github.com/honojs/hono/commit/d7964503c956ae4af78597b7b11a05f9e5e73d2d) (0.29h, sameAuthor=true)
- **\#5012** ([`74c2cf8`](https://github.com/honojs/hono/commit/74c2cf8ef4f5cc29a876380df1ba230ff7128b3f)) · test\(aws\-lambda\): update integration tests \(\#5012\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.6414): `src/adapter/aws-lambda/handler.ts` changed alongside `runtime-tests/lambda/index.test.ts` in 20 of its 24 commits \(95% CI 64%–93%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/adapter/aws-lambda/handler.ts`](https://github.com/honojs/hono/blob/74c2cf8ef4f5cc29a876380df1ba230ff7128b3f/src/adapter/aws-lambda/handler.ts) · outcome: `followedUp` in [`fa5f9bf`](https://github.com/honojs/hono/commit/fa5f9bfcc25d65e08af85211cc2e5ecd0e0ea24b) (0.06h, sameAuthor=true)
- **\#5463** ([`b877827`](https://github.com/honojs/hono/commit/b877827fccde0be4ee78457ae8b65db2436139f9)) · feat\(adapters\): add the seven adapters as workspace packages \(\#5463\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.5101): `package.json` changed alongside `src/adapter/deno/index.ts` in 4 of its 4 commits \(95% CI 51%–100%\) but is untouched here\. Does it need a matching change?
  - Target: [`package.json`](https://github.com/honojs/hono/blob/b877827fccde0be4ee78457ae8b65db2436139f9/package.json) · outcome: `followedUp` in [`645ddd6`](https://github.com/honojs/hono/commit/645ddd6e6ceb0cf5bd9c49dfe03850f874409151) (1.32h, sameAuthor=true)
- **\#5036** ([`6735fea`](https://github.com/honojs/hono/commit/6735fea78db8ca72e8606001f57b10ee6a96b349)) · fix\(jsx\): cast awaitedFallback through unknown to fix Deno type check \(\#5036\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.4901): `src/jsx/components.test.tsx` changed alongside `src/jsx/components.ts` in 8 of its 10 commits \(95% CI 49%–94%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/jsx/components.test.tsx`](https://github.com/honojs/hono/blob/6735fea78db8ca72e8606001f57b10ee6a96b349/src/jsx/components.test.tsx) · outcome: `followedUp` in [`d4853a8`](https://github.com/honojs/hono/commit/d4853a8f2794ce982818783f123e388a6dedd966) (0.2h, sameAuthor=true)
- **\#5447** ([`fc2343d`](https://github.com/honojs/hono/commit/fc2343dbad8af7ab82bc4a6c6907e57416aed878)) · feat\(adapters\): add @​hono/bun as a workspace package \(\#5447\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.4385): `src/adapter/deno/ssg.ts` changed alongside `src/adapter/bun/ssg.ts` in 3 of its 3 commits \(95% CI 44%–100%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/adapter/deno/ssg.ts`](https://github.com/honojs/hono/blob/fc2343dbad8af7ab82bc4a6c6907e57416aed878/src/adapter/deno/ssg.ts) · outcome: `followedUp` in [`b877827`](https://github.com/honojs/hono/commit/b877827fccde0be4ee78457ae8b65db2436139f9) (0.89h, sameAuthor=true)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#5116** ([`fb9d7bf`](https://github.com/honojs/hono/commit/fb9d7bf8fb0dd7b3c92a0c289d5dc685edf5f3a3)) · test\(context\): assert case\-insensitive header names in response helpers \(\#5116\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.7874): `src/context.ts` changed alongside `src/context.test.ts` in 71 of its 81 commits \(95% CI 79%–93%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/context.ts`](https://github.com/honojs/hono/blob/fb9d7bf8fb0dd7b3c92a0c289d5dc685edf5f3a3/src/context.ts) · outcome: `notFollowedUp`
- **\#5442** ([`859e2c2`](https://github.com/honojs/hono/commit/859e2c2bd0ec6d104e98e126eaa86cfcf5def0d9)) · chore: let oxfmt sort imports instead of eslint \(\#5442\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.7575): `src/jsx/hooks/index.ts` changed alongside `src/jsx/hooks/dom.test.tsx` in 12 of its 12 commits \(95% CI 76%–100%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/jsx/hooks/index.ts`](https://github.com/honojs/hono/blob/859e2c2bd0ec6d104e98e126eaa86cfcf5def0d9/src/jsx/hooks/index.ts) · outcome: `notFollowedUp`
- **\#5142** ([`e36f57d`](https://github.com/honojs/hono/commit/e36f57dac0615c1bdd03ff1975b6ca8d3dc5917f)) · fix\(aws\-lambda\): add jwt and lambda authorizer types for API Gateway v2 \(\#5142\) · author(s): Jason G
  - Question (`forgotten-companion`, intervalLow=0.7301): `src/adapter/aws-lambda/handler.ts` changed alongside `src/adapter/aws-lambda/handler.test.ts` in 16 of its 17 commits \(95% CI 73%–99%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/adapter/aws-lambda/handler.ts`](https://github.com/honojs/hono/blob/e36f57dac0615c1bdd03ff1975b6ca8d3dc5917f/src/adapter/aws-lambda/handler.ts) · outcome: `notFollowedUp`
- **\#5479** ([`1e1207c`](https://github.com/honojs/hono/commit/1e1207cabfcd154146bf6ac9fd6a0b646f7fc484)) · test\(serve\-static\): fix the test \(\#5479\) · author(s): Yusuke Wada
  - Question (`forgotten-companion`, intervalLow=0.7167): `src/middleware/serve-static/index.ts` changed alongside `src/middleware/serve-static/index.test.ts` in 15 of its 16 commits \(95% CI 72%–99%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/1e1207cabfcd154146bf6ac9fd6a0b646f7fc484/src/middleware/serve-static/index.ts) · outcome: `notFollowedUp`
- **\#5380** ([`cb5bea3`](https://github.com/honojs/hono/commit/cb5bea3614e6591e8ab933ef9a38ce7addf1d09a)) · fix\(jsx\): replace Suspense and ErrorBoundary content across newlines \(\#5380\) · author(s): Neil Daquioag
  - Question (`forgotten-companion`, intervalLow=0.6853): `src/helper/streaming/sse.ts` changed alongside `src/helper/streaming/sse.test.tsx` in 13 of its 14 commits \(95% CI 69%–99%\) but is untouched here\. Does it need a matching change?
  - Target: [`src/helper/streaming/sse.ts`](https://github.com/honojs/hono/blob/cb5bea3614e6591e8ab933ef9a38ce7addf1d09a/src/helper/streaming/sse.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **107033.98 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 943.79 | 943.79 | 943.79 |
| `sessionOpen` | 200 | 85034.12 | 411.96 | 515.69 |
| `staticAnalysis` | 200 | 7024.46 | 32.11 | 43.35 |
| `brief` | 200 | 1792.25 | 8.77 | 10.13 |
| `scoring` | 200 | 2398.07 | 10.98 | 14.56 |
| `report` | 1 | 26.28 | 26.28 | 26.28 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
