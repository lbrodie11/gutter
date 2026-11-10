# Gutter Benchmark Report · honojs/hono

Branch: `HEAD` · Head: [`eb754bd`](https://github.com/honojs/hono/commit/eb754bd5ef22c63f1634a4c374a86be086f85710) (`eb754bd5ef22c63f1634a4c374a86be086f85710`) · Generated: `2026-11-10T07:33:32.194Z` · Gutter `0.2.1` + Repo Archaeology `0.10.0` · schemaVersion 1 · scoringVersion 1

## Gate Check

```text
Full-salience share: 0.12 (< 1/3) ✓
Question usefulness (Gate A): UNVERIFIED (insufficient sample: N=13 < 30). Follow-up proxy 0.19 [0.09–0.38], lift ×0.33 vs recent. Human labels: GU-04.
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
| Scored PRs (`production`) | 13 | ≥ 1 scorable question with observed 7-day window |

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
| `noQuestions` | 139 |
| `unscorableOnly` | 48 |
| `resolvedAtMergeOnly` | 0 |
| `censored` | 0 |

## Production Policy Summary (`production`)

### Coverage & Salience (`production` — production \(calibrated\))

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 13
- **PRs with questions:** 61 / 200 (0.305, [0.24536415630735034, 0.3719855209797836])
- **Total questions:** 75 (per PR: 0.375)
- **Salience `quiet`:** 120 / 200 (0.6, [0.5308367203926201, 0.6653942143319266])
- **Salience `brief`:** 57 / 200 (0.285, [0.2269500300461729, 0.35115346029605166])
- **Salience `full` (full-salience share):** 23 / 200 (0.115, [0.07786373232561955, 0.16664716898487572])

### Observational Outcomes (`production`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 5 |
| `notFollowedUp` | 21 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 56 |
| Shared follow-up outcomes across PR windows | 2 |

### Follow-Up Proxy Metrics (`production`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 5 / 26 (0.1923, [0.08507061148942409, 0.37876257119317]) | [0, 0.3636] (median 0.1852, n=1000, seed=20261108) |
| Question-level follow-up rate | 3 / 19 (0.1579, [0.05520471638534143, 0.37565475270329074]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | — |
| Same-author share of `followedUp` | 3 / 5 (0.6, [0.23072428127601285, 0.8823792257673521]) | — |
| RA-signal follow-up rate | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | — |
| Missed co-change follow-up recall proxy | 0 / 493 (0, [0, 0.007731759804852509]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 493 untouched historical co-change partner(s) across 115 PR(s) changed within the observation window without a Gutter question._

## Baseline Comparison

### Production Policy vs. Matched As-Of Baselines

- **Strongest baseline (`production`):** `recent` · **Headline lift:** ×0.3333 · **Bootstrap CI:** [0, 0.6875] (median 0.3333, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 26 | 0 (0) | 10 / 26 (0.3846, [0.22428594435712798, 0.5746514991488447]) | 10 / 13 (0.7692, [0.49743624053272495, 0.9182047128150143]) | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | ×0.5 | [0, 1.2509] (median 0.4808, n=1000, seed=20261108) |
| `popular-near` | 26 | 0 (0) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 1 / 13 (0.0769, [0.013710421242556585, 0.3331395092109959]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | ×4.9948 | [0, 10] (median 3, n=1000, seed=20261108) |
| `recent` | 26 | 0 (0) | 15 / 26 (0.5769, [0.3894861374659171, 0.7445555668634343]) | 10 / 13 (0.7692, [0.49743624053272495, 0.9182047128150143]) | 6 / 26 (0.2308, [0.11033849405783289, 0.42051554078943687]) | ×0.3333 | [0, 0.6875] (median 0.3333, n=1000, seed=20261108) |

**Lift by outcome (`production`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 5 / 26 (0.1923, [0.08507061148942409, 0.37876257119317]) | 10 / 26 (0.3846, [0.22428594435712798, 0.5746514991488447]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 15 / 26 (0.5769, [0.3894861374659171, 0.7445555668634343]) | `recent` | ×0.3333 | [0, 0.6875] (median 0.3333, n=1000, seed=20261108) |
| Same-author follow-up | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 6 / 26 (0.2308, [0.11033849405783289, 0.42051554078943687]) | `recent` | ×0.5 | [0, 1.4304] (median 0.5, n=1000, seed=20261108) |
| RA-signal follow-up | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | 2 / 26 (0.0769, [0.021355088472276205, 0.24141553771629057]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 5 / 26 (0.1923, [0.08507061148942409, 0.37876257119317]) | `recent` | ×0.6001 | [0, 2] (median 0.6, n=1000, seed=20261108) |

### Breakdown by Checklist Kind (`production`)

| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |
|---|---:|---:|---|---|---:|---|
| `broken-import` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `forgotten-companion` | 0 | 0 | 0 / 0 (N/A) | 0 | 0 / 0 (N/A) | 0 / 0 (N/A) |
| `family-drift` | 9 | 9 | 3 / 9 (0.3333, [0.1205838183869109, 0.6457978644196036]) | 17 | 5 / 17 (0.2941, [0.1327998961029523, 0.5313311006653985]) | 3 / 17 (0.1765, [0.06191126637620998, 0.4102945856883412]) |
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
| `cleanManual` | 171 | 19 | 3 / 19 (0.1579, [0.05520471638534143, 0.37565475270329074]) |
| `botOrAgentOrigin` | 0 | 0 | 0 / 0 (N/A) |
| `generatedPaths` | 26 | 7 | 2 / 7 (0.2857, [0.0822189240040568, 0.6410655481673808]) |
| `dependencyOrVersionOnly` | 10 | 0 | 0 / 0 (N/A) |
| `largeSweep50Plus` | 2 | 3 | 0 / 3 (0, [4.8683609171202235e-17, 0.5614970317550455]) |

## Ungated Research Section (`ungated` — research: not product behavior)

> **research: not product behavior:** The `ungated` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.

### Coverage & Salience (`ungated` — research: not product behavior)

- **Sample status:** `insufficient-sample (< 30 scored)`
- **PRs evaluated:** 200
- **PRs scored:** 13
- **PRs with questions:** 61 / 200 (0.305, [0.24536415630735034, 0.3719855209797836])
- **Total questions:** 75 (per PR: 0.375)
- **Salience `quiet`:** 120 / 200 (0.6, [0.5308367203926201, 0.6653942143319266])
- **Salience `brief`:** 57 / 200 (0.285, [0.2269500300461729, 0.35115346029605166])
- **Salience `full` (full-salience share):** 23 / 200 (0.115, [0.07786373232561955, 0.16664716898487572])

### Observational Outcomes (`ungated`)

| Outcome | Target Count |
|---|---:|
| `followedUp` | 5 |
| `notFollowedUp` | 21 |
| `censored` | 0 |
| `targetDeleted` | 0 |
| `targetRenamed` | 0 |
| `resolvedAtMerge` | 0 |
| `unscorable` | 56 |
| Shared follow-up outcomes across PR windows | 2 |

### Follow-Up Proxy Metrics (`ungated`)

| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |
|---|---|---|
| File-level follow-up precision | 5 / 26 (0.1923, [0.08507061148942409, 0.37876257119317]) | [0, 0.3636] (median 0.1852, n=1000, seed=20261108) |
| Question-level follow-up rate | 3 / 19 (0.1579, [0.05520471638534143, 0.37565475270329074]) | — |
| `forgotten-companion` Precision@1 | 0 / 0 (N/A) | — |
| `forgotten-companion` Precision@3 | 0 / 0 (N/A) | — |
| Same-author follow-up rate | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | — |
| Same-author share of `followedUp` | 3 / 5 (0.6, [0.23072428127601285, 0.8823792257673521]) | — |
| RA-signal follow-up rate | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | — |
| Missed co-change follow-up recall proxy | 0 / 493 (0, [0, 0.007731759804852509]) | — |

_Queries with fewer than 3 suggestions use their actual suggestion count \(1 or 2\) as the denominator\._
_Missed co-change follow-ups: 493 untouched historical co-change partner(s) across 115 PR(s) changed within the observation window without a Gutter question._

### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)

- **Strongest baseline (`ungated`):** `recent` · **Headline lift:** ×0.3333 · **Bootstrap CI:** [0, 0.6875] (median 0.3333, n=1000, seed=20261108)

| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |
|---|---:|---|---:|---:|---:|---:|---|
| `popular` | 26 | 0 (0) | 10 / 26 (0.3846, [0.22428594435712798, 0.5746514991488447]) | 10 / 13 (0.7692, [0.49743624053272495, 0.9182047128150143]) | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | ×0.5 | [0, 1.2509] (median 0.4808, n=1000, seed=20261108) |
| `popular-near` | 26 | 0 (0) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 1 / 13 (0.0769, [0.013710421242556585, 0.3331395092109959]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | ×4.9948 | [0, 10] (median 3, n=1000, seed=20261108) |
| `recent` | 26 | 0 (0) | 15 / 26 (0.5769, [0.3894861374659171, 0.7445555668634343]) | 10 / 13 (0.7692, [0.49743624053272495, 0.9182047128150143]) | 6 / 26 (0.2308, [0.11033849405783289, 0.42051554078943687]) | ×0.3333 | [0, 0.6875] (median 0.3333, n=1000, seed=20261108) |

**Lift by outcome (`ungated`).** Each outcome picks its own strongest baseline.

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 5 / 26 (0.1923, [0.08507061148942409, 0.37876257119317]) | 10 / 26 (0.3846, [0.22428594435712798, 0.5746514991488447]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 15 / 26 (0.5769, [0.3894861374659171, 0.7445555668634343]) | `recent` | ×0.3333 | [0, 0.6875] (median 0.3333, n=1000, seed=20261108) |
| Same-author follow-up | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 6 / 26 (0.2308, [0.11033849405783289, 0.42051554078943687]) | `recent` | ×0.5 | [0, 1.4304] (median 0.5, n=1000, seed=20261108) |
| RA-signal follow-up | 3 / 26 (0.1154, [0.04003244623610616, 0.2897590321171364]) | 2 / 26 (0.0769, [0.021355088472276205, 0.24141553771629057]) | 1 / 26 (0.0385, [0.006821984993543487, 0.18892778903034757]) | 5 / 26 (0.1923, [0.08507061148942409, 0.37876257119317]) | `recent` | ×0.6001 | [0, 2] (median 0.6, n=1000, seed=20261108) |

## Five Best and Five Worst Questions (`production`)

### Five Best Questions (`followedUp` within observation window)

- **\#5447** ([`fc2343d`](https://github.com/honojs/hono/commit/fc2343dbad8af7ab82bc4a6c6907e57416aed878)) · feat\(adapters\): add @​hono/bun as a workspace package \(\#5447\) · author(s): Yusuke Wada
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(serve\-static\.ts across src/adapter/\*\)\. Should `src/adapter/cloudflare-workers/serve-static.ts` \(\+1 more\) follow?
  - Target: [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/fc2343dbad8af7ab82bc4a6c6907e57416aed878/src/adapter/cloudflare-workers/serve-static.ts) · outcome: `followedUp` in [`b877827`](https://github.com/honojs/hono/commit/b877827fccde0be4ee78457ae8b65db2436139f9) (0.89h, sameAuthor=true)
- **\#5447** ([`fc2343d`](https://github.com/honojs/hono/commit/fc2343dbad8af7ab82bc4a6c6907e57416aed878)) · feat\(adapters\): add @​hono/bun as a workspace package \(\#5447\) · author(s): Yusuke Wada
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(serve\-static\.ts across src/adapter/\*\)\. Should `src/adapter/cloudflare-workers/serve-static.ts` \(\+1 more\) follow?
  - Target: [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/fc2343dbad8af7ab82bc4a6c6907e57416aed878/src/adapter/deno/serve-static.ts) · outcome: `followedUp` in [`b877827`](https://github.com/honojs/hono/commit/b877827fccde0be4ee78457ae8b65db2436139f9) (0.89h, sameAuthor=true)
- **\#5236** ([`63bbcf5`](https://github.com/honojs/hono/commit/63bbcf508c74d9fe7a3e20f4dfe7ffacc566dcce)) · fix\(trie\-router\): match suffix wildcard routes \(\#5236\) · author(s): Taku Amano
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 4 parallel implementations \(router\.ts across src/router/\*\)\. Should `src/router/linear-router/router.ts` \(\+2 more\) follow?
  - Target: [`src/router/reg-exp-router/router.ts`](https://github.com/honojs/hono/blob/63bbcf508c74d9fe7a3e20f4dfe7ffacc566dcce/src/router/reg-exp-router/router.ts) · outcome: `followedUp` in [`a10592f`](https://github.com/honojs/hono/commit/a10592f3e1864cbe277619633db953450a6b1e4b) (58.95h, sameAuthor=true)
- **\#5236** ([`63bbcf5`](https://github.com/honojs/hono/commit/63bbcf508c74d9fe7a3e20f4dfe7ffacc566dcce)) · fix\(trie\-router\): match suffix wildcard routes \(\#5236\) · author(s): Taku Amano
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 4 parallel implementations \(router\.ts across src/router/\*\)\. Should `src/router/linear-router/router.ts` \(\+2 more\) follow?
  - Target: [`src/router/linear-router/router.ts`](https://github.com/honojs/hono/blob/63bbcf508c74d9fe7a3e20f4dfe7ffacc566dcce/src/router/linear-router/router.ts) · outcome: `followedUp` in [`a194628`](https://github.com/honojs/hono/commit/a19462879716e7b600daed8eb3a1b2af4bd68feb) (2.39h, sameAuthor=false)
- **\#5252** ([`a194628`](https://github.com/honojs/hono/commit/a19462879716e7b600daed8eb3a1b2af4bd68feb)) · fix\(pattern\-router/linear\-router\): prevent prefix overmatch on wildcard routes \(\#5252\) · author(s): Yusuke Wada
  - Question (`family-drift`, intervalLow=N/A): This changes 2 of 3 parallel implementations \(router\.ts across src/router/\*\)\. Should `src/router/reg-exp-router/router.ts` follow?
  - Target: [`src/router/reg-exp-router/router.ts`](https://github.com/honojs/hono/blob/a19462879716e7b600daed8eb3a1b2af4bd68feb/src/router/reg-exp-router/router.ts) · outcome: `followedUp` in [`a10592f`](https://github.com/honojs/hono/commit/a10592f3e1864cbe277619633db953450a6b1e4b) (56.56h, sameAuthor=false)

### Five Worst Questions (`notFollowedUp` despite high confidence)

- **\#4955** ([`7e0555d`](https://github.com/honojs/hono/commit/7e0555d14c72d4204347ac9afaae32ba5c013ab9)) · fix\(deno\): echo negotiated WebSocket subprotocol in upgrade response \(\#4955\) · author(s): wheelman
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(websocket\.ts across src/adapter/\*\)\. Should `src/adapter/bun/websocket.ts` \(\+1 more\) follow?
  - Target: [`src/adapter/bun/websocket.ts`](https://github.com/honojs/hono/blob/7e0555d14c72d4204347ac9afaae32ba5c013ab9/src/adapter/bun/websocket.ts) · outcome: `notFollowedUp`
- **\#4955** ([`7e0555d`](https://github.com/honojs/hono/commit/7e0555d14c72d4204347ac9afaae32ba5c013ab9)) · fix\(deno\): echo negotiated WebSocket subprotocol in upgrade response \(\#4955\) · author(s): wheelman
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(websocket\.ts across src/adapter/\*\)\. Should `src/adapter/bun/websocket.ts` \(\+1 more\) follow?
  - Target: [`src/adapter/cloudflare-workers/websocket.ts`](https://github.com/honojs/hono/blob/7e0555d14c72d4204347ac9afaae32ba5c013ab9/src/adapter/cloudflare-workers/websocket.ts) · outcome: `notFollowedUp`
- **\#5071** ([`82b321b`](https://github.com/honojs/hono/commit/82b321b5b0e7a57cdaab45f2f90671ec0737795b)) · fix: avoid circular dependency between body\.ts and request\.ts \(\#5071\) · author(s): Taku Amano
  - Question (`untested-change`, intervalLow=N/A): `src/utils/body.ts` changed \(\+6/−4\) but `src/utils/body.test.ts` didn't\. Is the new behavior covered?
  - Target: [`src/utils/body.test.ts`](https://github.com/honojs/hono/blob/82b321b5b0e7a57cdaab45f2f90671ec0737795b/src/utils/body.test.ts) · outcome: `notFollowedUp`
- **\#5102** ([`0fc7ffc`](https://github.com/honojs/hono/commit/0fc7ffc94988d0dce19477d3e1cce29f3c2da1cb)) · fix\(trie\-router\): match empty wildcard remainder after regexp param \(\#5102\) · author(s): Taku Amano
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(router\.test\.ts across src/router/\*\)\. Should `src/router/pattern-router/router.test.ts` \(\+1 more\) follow?
  - Target: [`src/router/pattern-router/router.test.ts`](https://github.com/honojs/hono/blob/0fc7ffc94988d0dce19477d3e1cce29f3c2da1cb/src/router/pattern-router/router.test.ts) · outcome: `notFollowedUp`
- **\#5102** ([`0fc7ffc`](https://github.com/honojs/hono/commit/0fc7ffc94988d0dce19477d3e1cce29f3c2da1cb)) · fix\(trie\-router\): match empty wildcard remainder after regexp param \(\#5102\) · author(s): Taku Amano
  - Question (`family-drift`, intervalLow=N/A): This changes 1 of 3 parallel implementations \(router\.test\.ts across src/router/\*\)\. Should `src/router/pattern-router/router.test.ts` \(\+1 more\) follow?
  - Target: [`src/router/reg-exp-router/router.test.ts`](https://github.com/honojs/hono/blob/0fc7ffc94988d0dce19477d3e1cce29f3c2da1cb/src/router/reg-exp-router/router.test.ts) · outcome: `notFollowedUp`

## Runtime per Stage

Total wall time: **95398.98 ms**

| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `discovery` | 1 | 1258.02 | 1258.02 | 1258.02 |
| `sessionOpen` | 200 | 29805.47 | 140.4 | 195.17 |
| `staticAnalysis` | 200 | 23774.14 | 114.19 | 168.83 |
| `brief` | 200 | 1907.28 | 8.82 | 12.35 |
| `scoring` | 200 | 2767.8 | 12.46 | 18.89 |
| `report` | 1 | 21.44 | 21.44 | 21.44 |

## Methodology Limits

- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on `HEAD`. Rebase-merged PRs carry no merge parent or `(#n)` suffix and are excluded as `not-a-pr`, while cherry-picks or edited subjects carrying `(#n)` are classified with `medium` confidence.
- **Observational outcomes, not ground-truth defects:** A `followedUp` outcome within the 7-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in 7 days is recorded as `notFollowedUp`.
- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.
- **Right-censoring:** PRs whose 7-day post-merge window extends past the newest commit on `HEAD` without an earlier hit are marked `censored` and excluded from precision denominators.
- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (`--calibration-every 1`), and baseline proposal (`popular`, `popular-near`, `recent`) is computed strictly from git ancestry available at that PR.
