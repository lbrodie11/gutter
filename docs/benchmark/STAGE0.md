# GU-04 Stage 0 · hono go/no-go (preregistration)

**Status:** PREREGISTERED. Rules below were committed before any Stage 0 variant was run and before any item was labeled.
**Repo:** `honojs/hono` pinned at `eb754bd5ef22c63f1634a4c374a86be086f85710`, `gutter bench --prs 200 --window-days 7`, production policy.
**Decision owner:** a human. This file supplies evidence; it never makes the call.

Results are appended under `## Results` once the runs and labels exist. Rules in sections 1–5 must not be edited afterwards; any change goes under a dated `## Errata` entry, as in [`METHOD.md`](METHOD.md).

## Why Stage 0 exists

GU-03's hono run found follow-up precision 0.23 [0.16–0.32] for Gutter against 0.65 for the `recent` baseline (lift ×0.36), 0.58 for `popular`, and 0.26 for `popular-near` (lift ×0.91, CI 0.54–1.58). Full-salience share was 0.40, above the 1/3 budget. "Any follow-up within 7 days" rewards files that are simply busy, which is exactly what `recent` and `popular` pick. Before building a 20-repo corpus, Stage 0 asks a fairer question on one repo.

## 1. Stricter outcomes for baselines too

Every baseline in `bench.json` (`aggregates.<policy>.baselines.<name>`) now also reports, over the same scored target files as its plain follow-up precision:

- `sameAuthorFollowUpRate`: a follow-up commit by an author of the PR (already present; now also bootstrapped);
- `raSignalFollowUpRate`: a follow-up commit matching Repo Archaeology's follow-up signal, exactly as GU-03 scores it for Gutter (`src/bench/outcomes.ts`): by an author of the PR **and** either touching a file the PR touched, landing as the first commit after the merge, or carrying a fix/follow-up subject;
- a PR-clustered bootstrap interval (seed `20261108`, 1,000 resamples) for both, next to the Wilson interval;
- `liftByOutcome.{followUp,sameAuthor,raSignal}`: Gutter's rate divided by the baseline's rate on that outcome, with a paired PR-clustered bootstrap interval.

`headlineBaseline.byOutcome.<outcome>` names the **strongest baseline per outcome**: the baseline with the highest rate on that outcome (ties: `popular-near`, then `recent`, then `popular`). Lift on an outcome is always measured against that outcome's strongest baseline.

These are additive `bench.json` fields; `schemaVersion` stays `1` and `scoringVersion` stays `1` (no existing number changes).

## 2. Blinded comparison labeling

`gutter label --compare <bench.json> --seed 1` writes one self-contained HTML file with 60 items:

- **30 Gutter items:** `forgotten-companion` question targets from the production policy.
- **15 `recent` items** and **15 `popular-near` items:** baseline proposals from the same PRs' matched baseline sets (production policy).

Eligibility, identical for every source: the target file's outcome was observed (`followedUp` or `notFollowedUp`, so not censored, deleted, or resolved at merge). Baseline items whose `(PR, file)` also appears as a Gutter companion target on that PR are excluded, and no `(PR, file)` appears twice, so each item has exactly one source. Sampling is seeded (mulberry32, `--seed 1`), takes at most one item per PR per source before reusing a PR, and the 60 items are shuffled with the same seed.

Every item renders identically, whatever its source: **"Should this PR also have changed `<file>`?"**, the PR title, and a diff summary (changed paths with +/− counts). No evidence, no co-change counts, no outcome. Item ids are opaque (`c01`…`c60`).

After the labeler picks **useful**, **irrelevant**, or **wrong**, the page reveals the source, the evidence (Gutter's question and interval, or the baseline's selection rule), and the automatic follow-up outcome. `labels.json` records `source` for every label. Blinding is honor-system: the reveal data is in the file (encoded, not encrypted), so the labeler should not open developer tools.

## 3. Salience variants

Three variants, each a `--config` file in [`bench/variants/`](../../bench/variants/), each aimed at full share < 1/3. Defaults do not change in this PR.

| Variant | File | Change |
|---|---|---|
| V1 · stricter floor | `stage0-v1-floor.json` | `minIntervalLow: 0.5` (default 0.3): a companion question needs a 95% interval lower bound ≥ 0.5 |
| V2 · two signals | `stage0-v2-two-signals.json` | `salienceFullMinSignals: 2`: `full` needs ≥ 2 independent signals, where each high-signal question (priority ≤ 2) counts once and breadth (≥ 8 files or ≥ 3 modules) counts once |
| V3 · breadth never full alone | `stage0-v3-breadth-not-full.json` | `salienceBreadthFull: false`: size and breadth alone give `brief`, never `full`; only high-signal questions make `full` |

Adaptation: the prompt's example "`wide-surface` alone never `full`" already holds in the current code (`wide-surface` has priority 5 and never triggers `full`). The structural trigger that does produce `full` on its own is breadth (≥ 8 files or ≥ 3 modules), so V3 targets that instead.

For each variant the report gives full share (Wilson), Gutter's follow-up, same-author, and RA-signal rates, and lift per outcome against the strongest baseline. The variants inform a later default proposal; they **do not** feed the decision rule below.

## 4. Decision rule

Inputs come from the default production policy (no variant) and from the 60 blinded labels.

- **Useful rate** per source = `useful / labeled`. `irrelevant` and `wrong` both count as not useful. Wilson 95% intervals are shown. The two baselines are rated separately (15 items each); the **better baseline** is the one with the higher useful rate.
- **Continue to the corpus** only if both hold:
  1. Gutter's useful rate ≥ the better baseline's useful rate + 0.15 (15 percentage points, on point estimates);
  2. Gutter's lift on same-author follow-up **or** on RA-signal follow-up, against that outcome's strongest baseline, is > 1.0 (point estimate).
- **Otherwise stop.** Results are written here with 2–3 concrete options, and nothing is built until a human decides.
- **Incomplete:** with fewer than 60 labels the rule is not evaluated; the results say how many are missing.

Known limits, stated now: 15 items per baseline gives wide intervals (a single label moves the rate by ~7 points), and Stage 0 uses point estimates. That is deliberate: Stage 0 is a cheap screen, not Gate A.

## 5. Options if Stage 0 says stop

Preregistered so they are not chosen after seeing which one flatters the data:

1. **Reposition questions as context, not predictions.** Keep the co-change evidence on the page, but phrase it as "these files usually move together" without asking whether the PR forgot something; drop companion questions from the checklist and salience.
2. **Restrict companion questions to strong, proven pairs.** Only `ghost` pairs that carry a `trackRecord` from Repo Archaeology (for example `trackRecord.fired ≥ 3`), with a stricter interval floor.
3. **Drop companion questions entirely.** Keep "what it touches" (dependents, wide surface, broken imports) and test links, which do not depend on co-change precision.

## Results

Everything between the markers below is generated by [`bench/stage0-report.mjs`](../../bench/stage0-report.mjs) from [`data/honojs__hono/stage0/results.json`](data/honojs__hono/stage0/results.json) and any exported `labels.json`. To fold in labels:

```bash
node bench/stage0-report.mjs --results docs/benchmark/data/honojs__hono/stage0/results.json --labels docs/benchmark/data/honojs__hono/stage0/labels.json --update docs/benchmark/STAGE0.md
```

<!-- stage0:results:start (generated by bench/stage0-report.mjs; do not edit by hand) -->

Runs: `honojs/hono` at `eb754bd`, gutter 0.2.1, repo-archaeology 0.4.0, 200 PRs evaluated, production policy. Intervals are Wilson 95% for rates and PR-clustered bootstrap (seed 20261108, 1,000 resamples) for lifts.

### 1. Stricter outcomes, default policy

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift vs strongest | Bootstrap CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0.23 [0.16–0.32] (25/107) | 0.58 [0.48–0.67] (61/106) | 0.26 [0.18–0.35] (27/105) | 0.65 [0.56–0.73] (69/106) | `recent` | ×0.36 | [0.23–0.51] |
| Same-author follow-up | 0.12 [0.07–0.20] (13/107) | 0.23 [0.16–0.31] (24/106) | 0.10 [0.05–0.17] (10/105) | 0.29 [0.21–0.39] (31/106) | `recent` | ×0.42 | [0.21–0.69] |
| RA-signal follow-up | 0.08 [0.04–0.15] (9/107) | 0.13 [0.08–0.21] (14/106) | 0.07 [0.03–0.13] (7/105) | 0.20 [0.13–0.28] (21/106) | `recent` | ×0.42 | [0.14–0.91] |

### 2. Salience variants

| Variant | Config | Full share (budget < 1/3) | PRs scored | Questions | Follow-up | Same-author | RA-signal | Lift: follow-up | Lift: same-author | Lift: RA-signal |
|---|---|---|---:|---:|---|---|---|---:|---:|---:|
| Default (production) | none | 0.40 [0.33–0.47] (80/200) ✗ | 70 | 161 | 0.23 [0.16–0.32] (25/107) | 0.12 [0.07–0.20] (13/107) | 0.08 [0.04–0.15] (9/107) | ×0.36 | ×0.42 | ×0.42 |
| V1 · stricter floor | `{"minIntervalLow":0.5}` | 0.20 [0.15–0.26] (40/200) ✓ | 34 | 103 | 0.22 [0.13–0.35] (12/54) | 0.11 [0.05–0.22] (6/54) | 0.09 [0.04–0.20] (5/54) | ×0.34 | ×0.35 | ×0.45 |
| V2 · two signals | `{"salienceFullMinSignals":2}` | 0.12 [0.08–0.17] (24/200) ✓ | 70 | 161 | 0.23 [0.16–0.32] (25/107) | 0.12 [0.07–0.20] (13/107) | 0.08 [0.04–0.15] (9/107) | ×0.36 | ×0.42 | ×0.42 |
| V3 · breadth never full alone | `{"salienceBreadthFull":false}` | 0.34 [0.28–0.41] (69/200) ✗ | 70 | 161 | 0.23 [0.16–0.32] (25/107) | 0.12 [0.07–0.20] (13/107) | 0.08 [0.04–0.15] (9/107) | ×0.36 | ×0.42 | ×0.42 |

### 3. Blinded labels

No labels yet. Label the 60 items in [`label-compare.html`](data/honojs__hono/stage0/label-compare.html), export `labels.json`, and rerun this report.

### 4. Decision rule (preregistered in section 4)

- **Lift condition:** same-author ×0.42 vs `recent`, RA-signal ×0.42 vs `recent`; needs either > ×1.00. **NOT MET.**
- **Usefulness condition:** not evaluated, labels incomplete (0 of 60).
- **Rule outcome: STOP: the preregistered rule says do not build the corpus. A human chooses among the options in section 5.**

<!-- stage0:results:end -->

## Reading of the evidence (2026-11-10, written after the runs and before any label)

This section is interpretation, not part of the preregistered rule.

1. **Stricter outcomes don't rescue the companion questions.** The worry was that "any follow-up" rewards busy files. On hono it does, but `recent` still beats Gutter when only the PR's own author touches the file afterwards (0.29 vs 0.12) and on the RA follow-up signal (0.20 vs 0.08). All three bootstrap intervals for lift sit entirely below ×1.00.
2. **Gutter is indistinguishable from "a busy file in the same directory".** Against `popular-near` (the activity-matched baseline), Gutter is level on every outcome: 0.23 vs 0.26, 0.12 vs 0.10, 0.08 vs 0.07. On this repo, the co-change evidence adds no follow-up signal beyond directory and activity.
3. **The salience budget can be met without touching questions.** V2 (two independent signals) brings full share to 0.12 with identical questions. V1 (interval floor 0.5) halves the scored questions and leaves precision flat (0.22), so the floor is not a precision lever here. V3 misses the budget (0.345): most `full` pages come from companion questions, not from breadth.
4. **What the labels can still tell us.** Follow-up is a proxy. If blinded labelers rate Gutter's companion questions clearly more useful than the baselines' files, despite the follow-up gap, that supports option 1: the evidence is worth showing as context, but not as a prediction that something was forgotten. If Gutter's items rate no better than baseline files, that points to option 3. The 60 labels take roughly 30–45 minutes.

5. **Release files inflate `recent` and `popular`, but don't explain the gap (post-hoc, not preregistered).** 58 of `recent`'s 106 scored proposals and 61 of `popular`'s are release and manifest files (`package.json`, `jsr.json`, `deno.json`, lockfiles, `CHANGELOG.md`), which a maintainer often touches right after a merge. Excluding them from every source, `recent` still leads Gutter: follow-up 0.38 vs 0.20, same-author 0.27 vs 0.11, RA-signal 0.27 vs 0.08 (on 48 vs 103 targets, so intervals are wider). In the label sample, 10 of the 15 `recent` items are such files (Gutter 1 of 30, `popular-near` 0 of 15). Labelers will probably rate those irrelevant, but the rule compares Gutter against the *better* of the two baselines, so `popular-near` carries the usefulness comparison.

The corpus (`bench/corpus.json`, `bench/run-corpus.mjs`, aggregation) is **not built**, per section 4.

## Errata

- **2026-11-10 (code review, before any label existed):** three clarifications to sections 1, 2 and 4; no threshold changes.
  1. **Blind labels decide.** The useful rate in section 4 counts each item's **first** label, the one made before the reveal (`firstLabel` in `labels.json`). A label changed after seeing the source and outcome is kept in the file but never counted.
  2. **One vote per labeler and item.** Duplicate exports collapse to the latest label for each (labeler, item); a file without a labeler name counts as its own labeler. "60 labels" means each labeler has labeled 60 distinct items.
  3. **Lift intervals keep zero-baseline resamples.** `liftByOutcome` and `headlineBaseline.byOutcome` intervals (section 1) now count bootstrap resamples where the baseline has no hits but Gutter does as an infinite lift, instead of dropping them, which biased the upper bound down for sparse outcomes. A bound that lands in those resamples is reported as unbounded (`null`, shown as ∞). GU-03's `bootstrapLiftCi` fields keep their original method so published numbers don't move. On hono no resample in any of the four runs had zero baseline hits, so every interval is unchanged (verified by rerunning all four).

## Stage 0b · option 2 (preregistered 2026-11-10)

**Status:** PREREGISTERED. Committed before the `repo-archaeology` upgrade, the V4 filter code, and any Stage 0b run. Prompt: GU-28. Rules in this section follow the same errata policy as sections 1–5.

**Why.** Option 2 in section 5 ("restrict companion questions to strong, proven pairs") needs Repo Archaeology's per-pair `trackRecord`, which arrived in `repo-archaeology` 0.10.0 (RA-06). Stage 0 ran on 0.4.0, so option 2 could not be tested. Stage 0b tests it with one variant, under a rule fixed now.

### 0b.1 Runs

- `repo-archaeology` pinned to exactly **0.10.0** for both runs. Same hono SHA (`eb754bd5ef22c63f1634a4c374a86be086f85710`), `--prs 200 --window-days 7`, production policy, same baselines and scoring as Stage 0.
- **Default:** no config. Output: `docs/benchmark/data/honojs__hono/stage0b/default/`.
- **V4 · proven pairs:** [`bench/variants/stage0b-v4-proven-pairs.json`](../../bench/variants/stage0b-v4-proven-pairs.json) = `{ "minIntervalLow": 0.3, "companionRequireGhost": true, "companionMinTrackRecordFired": 3 }`. Output: `.../stage0b/v4-proven-pairs/`.
  - A `forgotten-companion` question survives only if all three hold for the suggestion behind it: its `relationship` is `ghost`; its `trackRecord.fired ≥ 3`; and its Wilson `interval.low ≥ 0.3` (Gutter's existing floor, stated explicitly).
  - A `trackRecord` of `{ reason: "limited_history" }`, `{ fired: 0, reason: "never_fired" }`, or no `trackRecord` at all, drops the question.
  - Everything else in the checklist (broken imports, family drift, tests, wide surface, the calibration gate, the 4-item cap) is unchanged. The forgotten-companion panel still lists the files; only the question is dropped.

### 0b.2 Pass rule (decisive)

Identical to section 4's lift condition, applied to V4:

- **PASS** if V4's lift on same-author follow-up **or** on RA-signal follow-up, each against that outcome's strongest baseline (the same `headlineBaseline.byOutcome` as Stage 0), is **> ×1.00** (point estimate), **and** V4 has **≥ 30 scored `forgotten-companion` targets** (`breakdowns.byKind["forgotten-companion"].scoredTargets`, production policy).
- **INSUFFICIENT** if V4 has fewer than 30 scored `forgotten-companion` targets, whatever the lift.
- **FAIL** otherwise.

The lift is the policy-level lift, exactly as in section 4: it pools every scored question kind, and the baselines are matched to all of them. The companion-only rates (`byKind`) are reported next to it but are **not decisive**.

### 0b.3 Reported, not decisive

- **Coverage:** the share of evaluated PRs that still get at least one `forgotten-companion` question, default vs V4.
- **Full-salience share** for each run.
- **Analyzer delta:** the default run on 0.10.0 compared with Stage 0's default run on 0.4.0 (full share, scored targets, rates and lifts on each outcome), so changes from the analyzer upgrade (for example 0.6.0's revert skipping) are not mistaken for option 2's effect.

### 0b.4 What Stage 0b does not change

- The blinded labels from section 2 are not reused for V4. A V4 label set is a follow-up only if V4 passes.
- No product default changes. V2 meeting the salience budget (Stage 0) stays a separate proposal for the human.
- Section 4's Stage 0 verdict (STOP) is not re-evaluated; Stage 0b only adds evidence about option 2.

### 0b.R Results

Generated by `bench/stage0-report.mjs --stage0b` from [`data/honojs__hono/stage0b/results.json`](data/honojs__hono/stage0b/results.json):

```bash
node bench/stage0-report.mjs --stage0b --results docs/benchmark/data/honojs__hono/stage0b/results.json --stage0-results docs/benchmark/data/honojs__hono/stage0/results.json --update docs/benchmark/STAGE0.md
```

<!-- stage0b:results:start (generated by bench/stage0-report.mjs --stage0b; do not edit by hand) -->

Runs: `honojs/hono` at `eb754bd`, gutter 0.2.1, repo-archaeology 0.10.0, 200 PRs evaluated, production policy. Same intervals as Stage 0.

### 0b.R1 Analyzer delta: default run, repo-archaeology 0.4.0 → 0.10.0

| Measure | 0.4.0 (Stage 0) | 0.10.0 (Stage 0b) |
|---|---|---|
| Full-salience share | 0.40 [0.33–0.47] (80/200) | 0.40 [0.33–0.47] (80/200) |
| PRs scored / questions | 70 / 161 | 70 / 161 |
| Any follow-up: Gutter | 0.23 [0.16–0.32] (25/107) | 0.23 [0.16–0.32] (25/107) |
| Any follow-up: lift vs strongest | ×0.36 [0.23–0.51] | ×0.36 [0.23–0.51] |
| Same-author follow-up: Gutter | 0.12 [0.07–0.20] (13/107) | 0.12 [0.07–0.20] (13/107) |
| Same-author follow-up: lift vs strongest | ×0.42 [0.21–0.69] | ×0.42 [0.21–0.69] |
| RA-signal follow-up: Gutter | 0.08 [0.04–0.15] (9/107) | 0.08 [0.04–0.15] (9/107) |
| RA-signal follow-up: lift vs strongest | ×0.42 [0.14–0.91] | ×0.42 [0.14–0.91] |

Per PR (200 compared): calibration precision changed on 66 (by +0.0012 to +0.0013), calibration status on 0; questions, outcomes, salience or baselines changed on 3 (#5239, #5205, #5199). The `trackRecord` field itself is ignored in this comparison.

### 0b.R2 V4 · proven pairs, stricter outcomes

| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift vs strongest | Bootstrap CI |
|---|---|---|---|---|---|---:|---|
| Any follow-up | 0.19 [0.09–0.38] (5/26) | 0.38 [0.22–0.57] (10/26) | 0.04 [0.01–0.19] (1/26) | 0.58 [0.39–0.74] (15/26) | `recent` | ×0.33 | [0.00–0.69] |
| Same-author follow-up | 0.12 [0.04–0.29] (3/26) | 0.12 [0.04–0.29] (3/26) | 0.04 [0.01–0.19] (1/26) | 0.23 [0.11–0.42] (6/26) | `recent` | ×0.50 | [0.00–1.43] |
| RA-signal follow-up | 0.12 [0.04–0.29] (3/26) | 0.08 [0.02–0.24] (2/26) | 0.04 [0.01–0.19] (1/26) | 0.19 [0.09–0.38] (5/26) | `recent` | ×0.60 | [0.00–2.00] |

| Measure | Default | V4 · proven pairs |
|---|---|---|
| PRs with a companion question (coverage) | 0.34 (69/200) | 0.00 (0/200) |
| Companion questions | 90 | 0 |
| Scored companion targets (needs ≥ 30) | 84 | 0 |
| Companion follow-up (not decisive) | 0.24 [0.16–0.34] (20/84) | N/A |
| Companion same-author (not decisive) | 0.12 [0.07–0.21] (10/84) | N/A |
| Full-salience share (budget < 1/3) | 0.40 [0.33–0.47] (80/200) ✗ | 0.12 [0.08–0.17] (23/200) ✓ |
| PRs scored / questions (all kinds) | 70 / 161 | 13 / 75 |

### 0b.R3 Pass rule (preregistered in 0b.2)

- **Sample:** 0 scored `forgotten-companion` targets; needs ≥ 30. **NOT MET.**
- **Lift:** same-author ×0.50 vs `recent`, RA-signal ×0.60 vs `recent`; needs either > ×1.00. **NOT MET.** (Not decisive: the sample condition failed, and with no companion targets this lift comes from the other question kinds.)
- **Option 2 verdict: INSUFFICIENT: too few scored companion targets under V4 to judge option 2 on hono (0 < 30).**

<!-- stage0b:results:end -->

### 0b.Reading of the evidence (post-hoc interpretation, 2026-11-10; not part of the rule)

On hono, option 2 as specified removes every companion question, so it cannot be judged here; the verdict is INSUFFICIENT, not FAIL. The reason is the `ghost` requirement, not the track record. Replaying the 90 default companion questions with [`bench/stage0b-funnel.ts`](../../bench/stage0b-funnel.ts): 67 pair a file with its own **test** file, 11 are `direct` imports, 10 `unknown`, and only **2** are `ghost` (both `never_fired`). By track record: 23 have `fired ≥ 3` (20 test pairs, 3 direct), 24 have `fired` 1–2, 43 are `never_fired`. So even a looser rule without the `ghost` condition would keep at most 23 questions on hono, below the 30-target floor; option 2 would need the multi-repo corpus to be measurable at all. Two side effects worth noting: V4 meets the salience budget (0.12), but only because companion questions disappear, which makes it behave like option 3 on this repository; and the analyzer upgrade (0.4.0 → 0.10.0) changed no headline number, so nothing here is an artifact of the new version. Calling the stage now is the human's decision; this section adds only that option 2 is untestable on hono.

## After GU-29 · explain, don't predict (2026-11-10)

**Not preregistered.** GU-29 acts on the evidence above: on the maintainer's explicit delegation, the agent decided that Gutter's default output stops predicting omissions (option 1 in section 5, with the old behavior kept behind a research switch). See [DECISIONS #17](../DECISIONS.md#17-explain-dont-predict-gu-29). This section measures what that change does on hono; it re-scores nothing from Stage 0.

- **Default:** no config, so companion and family-drift questions are gone, `untested-change` is a statement, test history moves to the Tests panel, and `salienceFullMinSignals` defaults to 2. Output: [`data/honojs__hono/gu29/default/`](data/honojs__hono/gu29/default/).
- **Legacy:** [`bench/variants/gu29-legacy.json`](../../bench/variants/gu29-legacy.json) = `{ "legacyPredictions": true }`. It must reproduce Stage 0b's default run. Output: [`data/honojs__hono/gu29/legacy/`](data/honojs__hono/gu29/legacy/).
- **Gate A′** (the new M0 exit test in [`ROADMAP.md`](../ROADMAP.md)): [`data/honojs__hono/gu29/gate-a-prime.json`](data/honojs__hono/gu29/gate-a-prime.json).

Same hono SHA, `--prs 200 --window-days 7`, production policy, repo-archaeology 0.10.0. To reproduce:

```bash
H=~/.cache/gutter-bench/honojs__hono; OUT=/tmp/gutter-gu29; D=docs/benchmark/data/honojs__hono
node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --out $OUT/default
node --experimental-strip-types src/cli.ts bench --cwd $H --prs 200 --window-days 7 --config bench/variants/gu29-legacy.json --out $OUT/legacy
node --experimental-strip-types bench/gate-a-prime.ts $H $OUT/default/bench.json --out $OUT/gate-a-prime.json
node bench/gu29-report.mjs --default $OUT/default/bench.json --legacy $OUT/legacy/bench.json \
  --before $D/stage0b/default/bench.json --gate $OUT/gate-a-prime.json --write-results /tmp/gu29-results.json
node bench/gu29-report.mjs --results $D/gu29/results.json --update docs/benchmark/STAGE0.md
```

<!-- gu29:results:start (generated by bench/gu29-report.mjs; do not edit by hand) -->

Runs: `honojs/hono` at `eb754bd`, gutter 0.3.0, repo-archaeology 0.10.0, 200 PRs evaluated, production policy. "Before" is Stage 0b's default run (the pre-GU-29 defaults on the same analyzer); "after" is the GU-29 default. Intervals are Wilson 95%.

### G.1 Loudness and checklist, before and after

| Measure | Before GU-29 | After GU-29 |
|---|---|---|
| Quiet share | 0.41 [0.34–0.47] (81/200) | 0.60 [0.54–0.67] (121/200) |
| Brief share | 0.20 [0.15–0.26] (39/200) | 0.40 [0.33–0.46] (79/200) |
| Full share (budget < 1/3) | 0.40 [0.33–0.47] (80/200) ✗ | 0.00 [0.00–0.02] (0/200) ✓ |
| Checklist items per PR | 0.81 (161) | 0.33 (66) |
| PRs with at least one item | 0.54 [0.47–0.61] (108/200) | 0.30 [0.24–0.37] (60/200) |
| `broken-import` items (PRs) | 0 (0) | 0 (0) |
| `forgotten-companion` items (PRs) | 90 (69) | 0 (0) |
| `family-drift` items (PRs) | 9 (8) | 0 (0) |
| `untested-change` items (PRs) | 7 (7) | 10 (10) |
| `wide-surface` items (PRs) | 55 (55) | 56 (56) |

`untested-change` (now worded as a statement) appears on 10 PRs, up from 7: 3 PRs show it for the first time, and 2 of those had it hidden before because a companion question already asked about the same test file (the old `asked` set). Before GU-29, 69 PRs carried a companion question and 8 a family-drift question; both are gone by default.

### G.2 The research switch reproduces Stage 0b

`legacyPredictions: true` ([`bench/variants/gu29-legacy.json`](../../bench/variants/gu29-legacy.json)) against Stage 0b's default run: 200 of 200 PR records identical (0 missing); aggregates identical, gates identical, funnel identical. Only the run identity (`configOverrides`, settings hash) and timestamps differ.

| Measure | Stage 0b default | GU-29 legacy |
|---|---|---|
| Full-salience share | 0.40 [0.33–0.47] (80/200) | 0.40 [0.33–0.47] (80/200) |
| PRs scored / questions | 70 / 161 | 70 / 161 |
| Any follow-up: Gutter | 0.23 [0.16–0.32] (25/107) | 0.23 [0.16–0.32] (25/107) |
| Any follow-up: lift vs strongest | ×0.36 | ×0.36 |
| Same-author follow-up: Gutter | 0.12 [0.07–0.20] (13/107) | 0.12 [0.07–0.20] (13/107) |
| Same-author follow-up: lift vs strongest | ×0.42 | ×0.42 |
| RA-signal follow-up: Gutter | 0.08 [0.04–0.15] (9/107) | 0.08 [0.04–0.15] (9/107) |
| RA-signal follow-up: lift vs strongest | ×0.42 | ×0.42 |

### G.3 Gate A′ on hono (docs/ROADMAP.md, M0 exit test)

Checked by [`bench/gate-a-prime.ts`](../../bench/gate-a-prime.ts), which replays all 200 PRs in default mode (replay parity with the bench run: 0 salience and 0 checklist mismatches) and re-checks every fact against git with TypeScript 6.0.3.

| Criterion | Needs | hono | Result |
|---|---|---|---|
| (a) Quiet enough: full share | ≤ 1/3 | 0.00 (0/200) | **MET** |
| (b) `broken-import` confirmed by `ts.resolveModuleName` | ≥ 95% | 0/0 | not exercised |
| (b) `untested-change` facts match git | 100% | 10/10 | **MET** |
| (b) Test-history facts match git | 100% | 43/43 | **MET** |
| (c) No prediction wording on any page | 0 hits | 0 hits on 200 replayed pages | **MET** |

- **Gate A′ for hono: PASS (partly unexercised).** Not exercised on hono: broken-import (no items); the corpus has to exercise it.

<!-- gu29:results:end -->

Reading (post-hoc): the new defaults meet the salience budget with room to spare (no `full` page on hono, because no PR in the sample removed a file that is still imported), and two in five PRs still get a `brief` page: 60 of the 79 carry a checklist item (`wide-surface` on 56 PRs, `untested-change` on 10), and the other 19 are brief only because they change more than three files. `broken-import` never fired on these 200 PRs, so Gate A′'s strongest fact check is unexercised here and has to be exercised on the corpus. The research switch reproduces Stage 0b's default run record for record, so every Stage 0 number stays reproducible.

**2026-11-10 · Decision: see [DECISIONS #17](../DECISIONS.md#17-explain-dont-predict-gu-29).**
