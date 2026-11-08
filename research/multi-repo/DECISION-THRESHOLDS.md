# GU-27 · Precommitted Decision Thresholds (GO / NO-GO / NOT YET)

**Status:** Preregistered prior to inspecting held-out evaluation results (2026-11-08)

---

## 1. Minimum Sample-Size & Uncertainty Gate

To prevent small-sample flukes (e.g., 5 hits out of 7 warnings = 71% precision) from driving product architecture:

- **Minimum fired queries per pair:** At least **$N_{\min} = 30$ independent or meaningfully distinct fired upstream events** in the held-out evaluation window (preferred target: $\ge 50$).
- If a pair has $< 30$ fired queries on the held-out split, its result for that method/horizon MUST be labeled **`INCONCLUSIVE (sparse data)`**, regardless of point-estimate precision.
- **Cluster-robust uncertainty:** In addition to standard binomial 95% Wilson confidence intervals $[W_{\text{low}}, W_{\text{high}}]$, we compute **7-day time-block bootstrap 95% confidence intervals** ($B = 500$ resamples with deterministic PRNG seed) to account for intra-release clustering.

---

## 2. Precommitted Decision Rules

### ✅ `GO` (Proceed to Opt-In Prototype)
A **`GO`** recommendation requires **all six** conditions to hold on the held-out evaluation period:

1. **Cross-pair repeatability:** At least **2 of the 3 repository pairs** satisfy the sample-size gate ($N_{\text{fired}} \ge 30$) and demonstrate a repeatable positive signal.
2. **Minimum accuracy:** Held-out **Precision@3 $\ge 60\%$** (or Repository-Level Precision $\ge 60\%$ for a repo-level-only prototype), with 95% Wilson and block-bootstrap intervals reported.
3. **Meaningful lift over controls:** Beats the strongest matched baseline (`popular_baseline`, `recent_baseline`, and `shuffled_control`) by at least **+15 percentage points** and **$\ge 1.5\times$ lift**.
4. **Survives confounder filtering (`manual_only`):** Signal is not primarily an artifact of `mirrored`, `generated`, or `dependency_or_version` commits; precision and baseline lift remain positive and practically meaningful on `manual_only` changes.
5. **Human usefulness review:** In a preregistered manual audit of sampled predictions (both true matches and false alarms), at least **50%** of true matches are judged **`Actionable review question`** rather than `Known automated synchronization` or `Interesting historical correlation but not actionable`.
6. **Practical deployment & permissions:** The expected warning cadence (target exploratory range: ~2+ warnings/month or high-value rare contract events) and cross-repository GitHub token/App permission requirements are practical for opt-in adoption.

---

### 🛑 `NO-GO` (Do Not Build Cross-Repo Co-Change in Gutter)
A **`NO-GO`** recommendation is triggered if **any** of the following holds:

1. **Indistinguishable from controls:** Held-out precision on manually maintained code (`manual_only`) is indistinguishable from `popular_baseline`, `recent_baseline`, or `shuffled_control` (lift $< 1.2\times$ or within noise).
2. **Driven by automation / mirroring:** High raw precision occurs primarily on pairs or files governed by automated repository mirroring (`k8s-publishing-bot`) or scheduled SDK codegen (`stripe-node`), and collapses when those automated artifacts are separated.
3. **Low human actionability:** Manual inspection shows that most warnings either fire on routine backward-compatible additions or merely duplicate existing automated release pipelines.
4. **Disproportionate permission friction:** The value of the surviving manual signal does not justify asking users to replace GitHub Actions' default repo-scoped `GITHUB_TOKEN` with a multi-repo GitHub App or fine-grained cross-repo PAT.

---

### ⏸️ `NOT YET` (Defer Pending Specific Prerequisites)
A **`NOT YET`** recommendation applies if:

1. Fewer than 2 pairs reach the $N_{\min} = 30$ held-out fired-event threshold, or confidence intervals are too wide (e.g., 95% CI width $> 35$ percentage points) to distinguish signal from baseline.
2. Repository-level alerts show promise on manual code, but file-level alerts fail, requiring a narrower coordination-only design or richer explicit-contract metadata (e.g., OpenAPI/Protobuf AST diffing rather than git co-change alone).
