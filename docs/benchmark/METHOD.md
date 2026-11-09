# Gutter Benchmark Methodology & Preregistration (`GU-03`)

**Status:** Preregistered before the `hono` benchmark run (`eb754bd5ef22c63f1634a4c374a86be086f85710`)  
**Scoring Version:** `1` · **Schema Version:** `1` (`schema/bench.schema.json`)

This document preregisters the replay rules, observational outcome definitions, baseline construction, sample-size floors, and gate interpretations for `gutter bench`. Any future modifications must be appended under a dated `## Errata` section at the bottom of this file; prior rules must never be silently edited.

---

## 1. Non-Negotiable Principles

1. **No future information.** Every input to a replayed question — source files, `.gutter.json`, `.repo-archaeology.json`, `.repo-archaeology.verdicts.json`, `CODEOWNERS`, `package.json`, `tsconfig.json`, import edges, test candidates, co-change statistics, calibration backtests, and baseline proposals — must come strictly from the repository state available at that PR's prediction point (`head` tree for static/config files, `base` ancestry for historical co-change training and calibration). Git ancestry, never wall-clock timestamps, defines history availability.
2. **No manufactured correctness.** A suggested file changing in a later commit within the follow-up window is an **observation** (`followedUp`), not proof that Gutter caught a genuine defect or omission. Subsequent commits may be routine feature iterations, refactors, or unrelated edits. Whether a question was genuinely useful to a reviewer (Roadmap **Gate A**) is judged by human labels in **GU-04**, never by automated follow-up counts alone.

---

## 2. Change-Unit Discovery & Funnel

`gutter bench` walks `git rev-list --first-parent <branch>` (default `HEAD`) offline without GitHub API dependencies and classifies every first-parent commit into exactly one bucket:

| Bucket | Rule | `detection` / `confidence` | Pooled with PRs? |
|---|---|---|---|
| Merge-commit PR | 2 parents, subject matches `Merge pull request #(\d+)` | `merge-commit` / `high` | Yes |
| Merge, unnumbered | 2 parents, no PR number | `merge-commit` / `medium` | Yes |
| Squash PR | 1 parent, subject ends with `(#<n>)` | `squash-subject` / `medium` | Yes |
| Octopus merge | > 2 parents | skipped: `octopus` | Excluded |
| Direct push / rebase / other | 1 parent (or root), no `(#<n>)` | skipped: `not-a-pr`, or `change-unit` / `low` with `--include-unnumbered` | Never pooled; reported separately |

- **Merge-commit PR coordinates:** `head = parent2`, `base = merge-base(parent1, parent2)`, `mergedAt = committer time` of the merge commit.
- **Squash PR coordinates:** `head = commit`, `base = parent1`, `mergedAt = committer time` of the squash commit.
- **Merge conflict resolution (`mergeDiffers` / `resolvedAtMerge`):** If a merge commit's resulting tree differs from `head` (`parent2`) on any file referenced by a question, the PR records `mergeDiffers: true` and lists those files. If the merge commit itself changed a suggested target file relative to both `head` and `parent1`, that target is marked `resolvedAtMerge`, excluded from follow-up scoring denominators, and counted separately.
- **Funnel accounting:** Every run reports exact counts across `discovered` → `classified` (per bucket) → `eligible` → `evaluated` → `scored`, with explicit counts for every exclusion reason (`octopus`, `notAPr`, `rootCommit`, `beforeSince`, `missingMergeBase`, `emptyDiff`, `beyondPrsLimit`, `historyUnavailable`, `noQuestions`, `unscorableOnly`, `resolvedAtMergeOnly`, `censored`).

---

## 3. Policies (`production` vs. `ungated`)

Every evaluated PR is replayed through the shared `assembleBrief` pipeline under two policies that are always reported separately:

1. **`production` (headline policy):** Exact product behavior. Co-change calibration for PR *i* is computed from `backtest()` in the same Repo Archaeology session trained on PR *i*'s `base` ancestry (or, when `--calibration-every <n>` is passed, from the newest calibration checkpoint at or before PR *i*'s `base` — never from a later commit). When measured precision is `< 0.25`, `coChangeTrusted()` suppresses `forgotten-companion` questions.
2. **`ungated` (`research: not product behavior`):** Calibration gating bypassed (`noCalibration: true`) to observe raw co-change signal even on repos where calibration would suppress it. Every report table and schema field labels `ungated` as `"research: not product behavior"`, and its figures are never cited as Gutter's precision.

---

## 4. Observational Outcome Definitions

Outcomes are evaluated over first-parent commits on the target branch after `mergedAt` within `--window-days` (default **7 days** = 168 hours), at both the **target-file level** and the **question level**:

- **`followedUp`:** The target file (tracking renames along first-parent history) was modified in at least one first-parent commit with `mergedAt < commitTime <= mergedAt + windowDays * 86400`. Records:
  - `commitSha`: first matching follow-up commit SHA;
  - `delayHours`: `(commitTime - mergedAt) / 3600`;
  - `sameAuthor`: `true` when the follow-up commit's `.mailmap`-normalized author matches at least one `.mailmap`-normalized author of the PR's commits;
  - `raFollowUpSignal`: `true` when the follow-up commit matches Repo Archaeology's `backtest --follow-ups` signal heuristics (same author as PR or fix/follow-up commit subject).
- **`notFollowedUp`:** The follow-up window was fully observed (`mergedAt + windowDays * 86400 <= newestBranchCommitTime`) and the target file was neither modified nor deleted within the window.
- **`censored`:** Right-censored (`mergedAt + windowDays * 86400 > newestBranchCommitTime`) and the target file did not change before history ended. Excluded from scored precision denominators.
- **`targetDeleted`:** The target file was deleted on the first-parent branch within the window before any modification. Counted as its own outcome, **never** as a `followedUp` hit, and excluded from `followedUp / (followedUp + notFollowedUp)` hit-rate denominators while reported explicitly in outcome breakdowns.
- **`targetRenamed`:** Recorded when a target file was renamed along the first-parent chain within the window; rename tracking continues following the new path for modifications within the window.
- **`resolvedAtMerge`:** The merge commit itself modified the suggested target file; excluded from post-merge follow-up denominators.
- **`unscorable`:** Questions without a concrete target file expecting a follow-up edit (`wide-surface`).

### Question-Level Aggregation by Kind

- `forgotten-companion`: single target file (`forgotten.items[i].file`).
- `family-drift`: each untouched sibling in `family.untouchedMembers` is a target file; the question counts as `followedUp` if **any** target file was `followedUp` (file-level counts are also reported separately).
- `docs-drift`: the named documentation file.
- `untested-change`: the untouched candidate test file(s); counts as `followedUp` if any candidate test file changed within the window.
- `broken-import`: listed importer files; counts as `followedUp` if any listed importer changed or the broken import path was restored within the window.
- `wide-surface`: always `unscorable`.

### Overlapping Windows

When a single follow-up commit falls inside the observation window of multiple earlier PRs, it is attributed to each eligible PR and counted once per PR. The report explicitly states the number of `followedUp` outcomes that share a follow-up commit with another PR (`sharedFollowUpCommits`).

---

## 5. Matched Per-Event Baselines

For each scored PR where Gutter suggests $k \ge 1$ scorable target files, three matched baselines each propose up to $k$ candidate files using **only** commits in the ancestry of that PR's `base` and candidate files that:
1. exist as regular files in that PR's `head` tree;
2. were **not** touched by the PR (`base...head`); and
3. pass the same generated, vendored, lockfile, and bot/sweep filters as Gutter and Repo Archaeology.

The three baselines are:
- **`popular`:** top-$k$ candidate files ranked by total historical change frequency in `base` ancestry (ties broken by most recent change, then lexicographically by path).
- **`popular-near` (activity-matched directory baseline):** top-$k$ candidate files sharing a top-level directory (`moduleOf` or first path segment) with at least one file touched by the PR, ranked by historical change frequency in `base` ancestry.
- **`recent`:** top-$k$ candidate files ranked by change count in the 30 days (`30 * 86400` seconds) ending at `base`'s committer timestamp.

If a baseline has fewer than $k$ qualifying candidates at PR *i*, it proposes only those candidates and records the shortfall (`shortfallCount`) without padding. Baselines are scored with the identical window, censoring, and rename/deletion rules. Lift is reported against each baseline individually, and **lift against the strongest baseline** (highest baseline precision on the same set of scored PRs) is used as the headline multiplier.

---

## 6. Statistical Rules & Sample-Size Floor

- **Proportions & intervals:** Every rate reports `numerator`, `denominator`, point estimate, and a **Wilson 95% confidence interval**.
- **Zero-denominator rule:** Whenever `denominator === 0`, the rate and interval bounds are `null` in JSON and rendered as `N/A` in Markdown and HTML — **never** `0%` or `100%`.
- **Precision@1 and Precision@3:** Computed over `forgotten-companion` suggestions per PR. Queries with fewer than 3 suggestions use their actual suggestion count ($1$ or $2$) as the denominator, and reports state this explicitly.
- **Sample-size floor (`N >= 30`):** If fewer than **30 questions** (or target files) are scored under a policy, the report prints the observed counts and Wilson intervals but marks the sample as `insufficient-sample (< 30 scored)` and draws no directional conclusions.
- **PR-clustered bootstrap:** Uncertainty on lift and PR-level rates is estimated with a deterministic, seeded (`seed = 20261108`) **1,000-resample bootstrap over PRs** (resampling PRs with replacement so multiple questions on the same PR stay clustered).

---

## 7. Gate Check Interpretation

`gutter bench` prints two gate lines at the end of a run:

1. **Salience budget (`--gate-full-share`, default `0.3333`):**
   - `Full-salience share: <value> (< 1/3) ✓` (or `✗` if `>= 1/3`). Directly measurable from replay.
2. **Question usefulness (Roadmap Gate A, `--proxy-min-lift`, default `1.5`):**
   - `Question usefulness (Gate A): UNVERIFIED. Follow-up proxy <rate> [<low>–<high>], lift ×<lift> vs <strongest-baseline>. Human labels: GU-04.`
   - **Rule:** Automated replay must **never** print `PASS` for Gate A. The 70% usefulness gate requires human audit labels in GU-04.

---

## Errata

- **2026-11-08 (Provenance & rebase disclosure):** `docs/benchmark/METHOD.md` was originally authored and committed prior to the 200-PR `hono` (`eb754bd5ef22c63f1634a4c374a86be086f85710`) benchmark run (`authorDate: 2026-11-08T18:54:51-05:00`, initial commit `57c24ce` before stack rebase). Rebasing the PR #12 branch onto PR #11's cross-platform CI fixes updated the git committer timestamp of the commit carrying `METHOD.md` without altering any preregistered rule, threshold, or outcome definition.
- **2026-11-09 (Post-review implementation fixes):** Following code review on PRs #11–#13, four implementation bugs were fixed so the code matches this preregistered specification:
  1. **Within-PR file-level deduplication (§4 / §5):** When multiple questions on the same PR target the same file (for example, `forgotten-companion` and `family-drift` naming the same sibling), `computePolicyAggregates` deduplicates target files within each PR for file-level precision, outcome counts, interval/confounder breakdowns, and PR-clustered bootstrap inputs, matching the deduplicated $k$ used by the baselines while keeping question-level rates per-question.
  2. **Non-monotonic commit timestamps (§4):** `scoreSingleTarget` checks `mergedAt < commitTime <= mergedAt + windowDays * 86400` on each post-merge commit along the first-parent chain instead of assuming monotonic timestamps or breaking early on the first out-of-window timestamp.
  3. **Ancestry verification & `--resume` restoration for `--calibration-every <n>` (§3):** Calibration checkpoints are reused only when the checkpoint's `base` SHA is in the git ancestry of the current PR's `base` SHA, and checkpoint payloads are persisted in `bench.partial.jsonl` so `--resume` restores identical calibration state.
  4. **Snapshot `.repo-archaeology.json` filters in baselines (§5):** Validated snapshot `.repo-archaeology.json` filter settings (`ignore`, `useDefaultIgnores`, `maxCommits`, `maxFilesPerCommit`, `since`, `skipCommits`, `skipCommitPrefixes`) are applied to baseline history statistics and candidate pools.
