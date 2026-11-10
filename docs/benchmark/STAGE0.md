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
