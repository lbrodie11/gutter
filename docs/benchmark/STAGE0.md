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
- `raSignalFollowUpRate`: a follow-up commit matching Repo Archaeology's follow-up signal (same author as the PR, or a fix/follow-up subject);
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

_Pending: appended after the runs and the labels._
