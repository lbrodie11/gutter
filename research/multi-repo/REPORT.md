# GU-27 · Cross-Repository Coupling Research Report

- **Experiment ID:** `GU-27`
- **Preregistration Commit:** `0ea8a61` ([`PAIRS.md`](./PAIRS.md), [`METHODOLOGY.md`](./METHODOLOGY.md), [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md), [`run.mjs`](./run.mjs), [`test/multi-repo.test.mjs`](./test/multi-repo.test.mjs))
- **Initial Results Commit:** `1014af3` ([`results.json`](./results.json), [`manifest.json`](./manifest.json))
- **Supplementary Diagnostics & Generator:** [`diagnostics.json`](./diagnostics.json), [`run-diagnostics.mjs`](./run-diagnostics.mjs), [`generate-report.mjs`](./generate-report.mjs)
- **Operational Product Decision:** **`NO-GO` (Do not build cross-repository temporal co-change warnings now)**
- **Preregistered Rule Classification:** **`NO-GO` and `NOT YET` Overlap** (see Section 1.2)

> [!NOTE]
> Every numerical table and metric in this report is generated deterministically from [`results.json`](./results.json) and [`diagnostics.json`](./diagnostics.json) by [`generate-report.mjs`](./generate-report.mjs) and verified in CI via `node research/multi-repo/generate-report.mjs --check`.

---

## 1. Executive Summary & Decision Analysis

### 1.1 Three-Category Empirical Outcome Summary

To separate what the evidence proves from what was sparse or methodologically compromised, findings are grouped into three explicit categories:

1. **Supported Negative Findings (`stripe/openapi` → `stripe/stripe-node`, plus Repository-Level Base-Rate Confounding):**
   - **`stripe/openapi` → `stripe/stripe-node`** is the only pair with a large held-out evaluation sample on manually maintained code ($N_{\text{fired}} = 142$ at $72\text{h}$; $N_{\text{fired}} = 323$ at $168\text{h}$).
   - On `manual_only`, temporal co-change precision is **`0.1056`** (`15/142`, Wilson 95% CI `[0.0651, 0.1670]`) at $72\text{h}$ and **`0.3738`** (`225/602`, Wilson 95% CI `[0.3360, 0.4131]`) at $168\text{h}$.
   - Even without relying on the shuffled control, the `manual_only` temporal predictor **merely ties the activity-matched `popular_baseline` at $72\text{h}$ (`0.1056`, lift `1.00x`) and loses to `popular_baseline` at $168\text{h}$ (`0.4502`, lift `0.83x`, margin `-0.0764`)**, while matching only `4` ($72\text{h}$) and `14` ($168\text{h}$) unique downstream commits across `33.97`–`79.77` warnings/month.
   - Across all pairs, **repository-level alerts** with high nominal precision at $168\text{h}$ (`0.6918` on `stripe` `manual_only`, `1.0000` on `k8s` `all`) match the unconditional downstream activity base rate (`0.6964` and `0.9890`, yielding lifts of **`0.99x`** and **`1.01x`**).
2. **Inconclusive Findings (`open-telemetry/opentelemetry-proto` → `open-telemetry/opentelemetry-js`):**
   - Only `43` non-merge upstream commits occurred across the 18-month observation window (`7` eligible in the held-out split). Only `2` ($72\text{h}$) and `3` ($168\text{h}$) predictions fired (`0/2` and `0/3` hits), which is far below the preregistered $N_{\min} = 30$ sample-size gate (`INCONCLUSIVE (sparse data)`).
3. **Invalid or Unverified Analyses (`kubernetes/kubernetes` → `kubernetes/client-go` Mirror Test & Non-Matched Shuffled Placebo):**
   - **Kubernetes mirror confounder test is invalid as run:** Inspection of the pinned `kubernetes/client-go` history (`102` non-merge commits in window; `95` with $\le 50$ files) shows that **`102/102` (`100%`) have committer `"Kubernetes Publisher"`**, which initial `classifyCommit()` failed to match (it checked only `k8s-publishing-bot` and `publishing-bot`). Furthermore, `Kubernetes Publisher` preserves the upstream author timestamp as its committer timestamp ($t_{\text{commit}} = t_{\text{author}}$ on `94/95` kept commits), whereas `kubernetes/kubernetes` records the later Prow merge timestamp as $t_A$. Across `92` matched commit pairs, **`91/92` (`98.9%`) have $t_B \le t_A$** (median $t_B - t_A = -48.98\text{h}$) and were skipped by `cB.commitTime <= tA`. Thus, the observed `manual_only` precision of `0.0000` on `k8s` cannot be used as valid evidence of confounder survival or collapse.
   - **Non-matched retrained `shuffled` placebo in `results.json`:** In initial `run.mjs`, `shuffledPrecision` was computed by retraining and firing on the circularly shifted stream (which fired on a different set of upstream events, e.g., $N = 95$ vs. $N = 142$ on Stripe $72\text{h}$ `manual_only`), rather than scoring on the exact same fired events. Section 4.4 reports both the non-matched retrained counts and a true matched-event shuffled window evaluation alongside the matched `popular` and `recent` baselines.

---

### 1.2 Evaluation Against Original Preregistered Thresholds ([`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md))

The table below grades the results strictly against the **original preregistered wording** in [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md), without post-hoc threshold substitutions:

| Preregistered Rule in [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md) | Exact Preregistered Wording | Observed Result in `results.json` / `diagnostics.json` | Status |
| :--- | :--- | :--- | :--- |
| **Sample-Size Gate (Sec. 1) & `GO` Rule 1** | $N_{\min} = 30$ fired upstream events in held-out split; **at least 2 of 3 pairs** satisfy $N_{\text{fired}} \ge 30$ and show repeatable positive signal | **1 of 3 pairs** reaches $N_{\text{fired}} \ge 30$ on `manual_only` (`stripe`: $N = 142$ at $72\text{h}$, $N = 323$ at $168\text{h}$). `otel` has $N \le 3$ (`INCONCLUSIVE`); `k8s` has $N \le 11$ on `manual_only` ($N = 45$ on `all`) and is methodologically invalid as run | **FAIL (`GO` Rule 1)** / **Triggers `NOT YET` Rule 1** |
| **`GO` Rule 2 (Minimum Accuracy)** | Held-out **Precision@3 $\ge 60\%$** (or Repo-Level Precision $\ge 60\%$ for a repo-level-only prototype), with 95% Wilson and block-bootstrap CIs | On `stripe` `manual_only`, Precision@3 is **`0.1056` (10.56%)** at $72\text{h}$ and **`0.3738` (37.38%)** at $168\text{h}$. On `stripe` `all`, Precision@3 is **`0.1903` (19.03%)** at $72\text{h}$ and **`0.4577` (45.77%)** at $168\text{h}$ | **FAIL (`GO` Rule 2)** |
| **`GO` Rule 3 & `NO-GO` Rule 1 (Baseline Lift)** | `GO`: Beats strongest matched baseline by $\ge +15\text{ pp}$ and $\ge 1.5\times$ lift.<br>`NO-GO` Rule 1: `manual_only` precision indistinguishable from controls (lift $< 1.2\times$ or within noise) | On `stripe` `manual_only`, vs. matched `popular_baseline`: at $72\text{h}$, `0.1056` vs. `0.1056` (**lift `1.00x`**, margin `0.0000`); at $168\text{h}$, `0.3738` vs. `0.4502` (**lift `0.83x`**, margin `-0.0764`). Both are $< 1.2\times$ | **FAIL (`GO` Rule 3)** / **Triggers `NO-GO` Rule 1** |
| **`GO` Rule 4 & `NO-GO` Rule 2 (Confounder Filtering)** | Signal is not primarily an artifact of `mirrored`, `generated`, or `dependency_or_version` commits; remains positive and meaningful on `manual_only` | On `stripe`, excluding generated `src/resources/*` and `types/*` drops $72\text{h}$ precision from `0.1903` to `0.1056` and $168\text{h}$ precision from `0.4577` to `0.3738` (both $\le$ `popular_baseline`). Note: `k8s` is excluded from this gate due to the mirror classifier/timestamp defect (Section 4.3) | **FAIL (`GO` Rule 4)** / **Triggers `NO-GO` Rule 2 (on Stripe)** |
| **`GO` Rule 5 & `NO-GO` Rule 3 (Human Audit)** | At least **50% of true matches** judged `Actionable review question` rather than `Known automated synchronization` or `Interesting historical correlation but not actionable` | In the 15-prediction convenience sample (Section 6), only **4 were true matches** (`2` on `stripe` $72\text{h}$ `all`, `2` on `k8s` $168\text{h}$ `all`; `0` on `manual_only`), and **`0 / 4` (0%)** were rated `Actionable review question`. *(See Section 6 for sampling/rater provenance limitations)* | **FAIL (`GO` Rule 5)** |
| **`GO` Rule 6 & `NO-GO` Rule 4 (Cadence & Permissions)** | Expected warning cadence (exploratory target: `~2+ warnings/month` or high-value rare contract events) and cross-repo GitHub token/App requirements are practical | `stripe` `manual_only` emits `33.97` ($72\text{h}$) to `79.77` ($168\text{h}$) warnings/month with `89.4%`–`52.0%` false-alarm query rates and $<1.0\times$ matched lift, which does not justify replacing single-repo `GITHUB_TOKEN` with a multi-repo GitHub App / PAT | **FAIL (`GO` Rule 6)** / **Triggers `NO-GO` Rule 4** |

### 1.3 Overlap Between Preregistered `NO-GO` and `NOT YET` Rules

Under [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md), two decision blocks are simultaneously satisfied:
- **`NOT YET` Rule 1 is satisfied:** Fewer than 2 repository pairs reached the $N_{\min} = 30$ fired-event gate on `manual_only` (only `stripe-openapi-to-node` reached $N_{\text{fired}} \ge 30$; `otel-proto-to-js` had $N_{\text{fired}} \le 3$, and `k8s-staging-to-client-go` is invalid as run).
- **`NO-GO` Rules 1, 2, and 4 are satisfied:** `NO-GO` is defined to trigger if **any** of its conditions hold, and on the one high-volume pair (`stripe-openapi-to-node`), `manual_only` precision is indistinguishable from or worse than `popular_baseline` (lift `1.00x` at $72\text{h}$ and `0.83x` at $168\text{h}$, both $< 1.2\times$).

Because [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md) did not specify a precedence rule when both `NOT YET` (cross-pair sparsity) and `NO-GO` (negative signal on a qualifying pair) hold, we separate the decision into two explicit statements:
1. **Operational Product Decision — `NO-GO` (Do not build temporal cross-repository co-change warnings now):** The well-powered negative result on `stripe/openapi` → `stripe/stripe-node` shows that naive commit-timestamp alignment loses to simple popularity baselines and suffers severe many-to-many inflation, making it unsuitable for PR warnings given cross-repository token friction.
2. **Scope of Empirical Generalization — `NO-GO_AND_NOT_YET_OVERLAP`:** This negative finding applies specifically to **commit-timestamp window correlation** on the tested Stripe pair. It does **not** prove that cross-repository impact analysis as a whole is a dead end; structured contract analysis (e.g., OpenAPI or Protobuf AST diffing linked to consumer symbol references) remains a distinct, untested hypothesis.

---

## 2. Preregistration Errata, Chronology, & Methodological Disclosures

In accordance with research reporting best practices, all deviations, errata, and provenance limitations in the initial PR commits (`0ea8a61` and `1014af3`) are disclosed below while preserving the original preregistration files untouched:

1. **Execution Chronology & Hardcoded `generatedAt` Timestamp:**
   - In [`results.json`](./results.json) and [`manifest.json`](./manifest.json) (commit `1014af3`), `generatedAt` is set to `"2026-11-08T15:40:00Z"`. That string was a hardcoded literal in initial [`run.mjs`](./run.mjs) rather than a dynamic `new Date().toISOString()` clock reading (fixed in `run.mjs` for future runs).
   - In Git history, the preregistration commit (`0ea8a61`, committed at `15:49:02Z`) precedes the results commit (`1014af3`, committed at `15:53:26Z`), but both commits were authored and pushed within the same session. Therefore, while the preregistration commit precedes the results commit in Git, **independent verification that the evaluation was not inspected beforehand is unavailable**.
2. **Post-Hoc Thresholds Removed from Primary Grading:**
   - The initial version of `REPORT.md` and `run.mjs` introduced three un-preregistered rules: (a) a `<= 10 warnings/month (or >= 0.75 precision)` alert-volume rule instead of the preregistered exploratory `~2+ warnings/month` description; (b) a `>= 70% of audited predictions` human-audit threshold instead of the preregistered `>= 50% of true matches` threshold; and (c) a hardcoded `repo-level precision >= 0.60 and lift >= 1.5x` check for `NOT YET`. All three have been removed from the primary decision table in Section 1.2.
3. **[`PAIRS.md`](./PAIRS.md) Metadata Errata:**
   - In [`PAIRS.md`](./PAIRS.md) Section 3 (Pair 3), `143,358` is the total commit count of the entire `kubernetes/kubernetes` repository at `e3d37bb9fb1d695daff432925cd44b1452df64e1` prior to path filtering; the path-filtered non-merge commit count (`staging/src/k8s.io/{client-go,api}`, $\le 50$ files) in the observation window is `687`.
   - In [`PAIRS.md`](./PAIRS.md) Section 3 (Pair 3), the `kubernetes/kubernetes` → `kubernetes/client-go` observation window was set to 15 months (`2025-08-01` – `2026-11-01`) rather than the 18 months (`2025-05-01` – `2026-11-01`) used for Pairs 1 and 2 in order to bound `git log` path-traversal time on `kubernetes/kubernetes`.

---

## 3. Dataset, Chronological Splits, & Confounder Breakdown

All 6 repositories were evaluated from local bare blobless clones pinned to the exact `HEAD` SHAs in [`PAIRS.md`](./PAIRS.md) (reproducible via [`setup-repos.sh`](./setup-repos.sh)). Each pair's observation window $[T_{\text{start}}, T_{\text{end}}]$ was split into **60% Training**, a **168-hour Embargo**, **15% Tuning**, a second **168-hour Embargo**, and the final **~25% Held-Out Evaluation** split:

| Pair ID | Role & Repo (`HEAD` SHA) | Window ($T_{\text{start}}$ → $T_{\text{end}}$) | Eval Split Start ($T_{\text{eval}}$) | Scoped Commits ($\le 50$ files) | `manual` | `generated` | `mirrored` | `dep / version` | `bot` | Automated Share | Timestamp Anomalies |
| :--- | :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **`stripe-openapi-to-node`** | **A:** `stripe/openapi` (`6360907c`) | `2025-05-01` → `2026-11-01` | `2026-06-23` | 1128 | 235 | 893 | 0 | 0 | 0 | **79.17%** | 0 |
| | **B:** `stripe/stripe-node` (`dacc7167`) | `2025-05-01` → `2026-11-01` | `2026-06-23` | 157 | 82 | 33 | 0 | 42 | 0 | **47.77%** | 4 |
| **`otel-proto-to-js`** | **A:** `open-telemetry/opentelemetry-proto` (`169f2f2c`) | `2025-05-01` → `2026-11-01` | `2026-06-23` | 43 | 43 | 0 | 0 | 0 | 0 | **0.00%** | 0 |
| | **B:** `open-telemetry/opentelemetry-js` (`ee94b842`) | `2025-05-01` → `2026-11-01` | `2026-06-23` | 357 | 356 | 0 | 0 | 1 | 0 | **0.28%** | 0 |
| **`k8s-staging-to-client-go`** | **A:** `kubernetes/kubernetes` (`e3d37bb9`) | `2025-08-01` → `2026-11-01` | `2026-07-16` | 687 | 636 | 49 | 0 | 2 | 0 | **7.42%** | 459 |
| | **B:** `kubernetes/client-go` (`494d62c5`) | `2025-08-01` → `2026-11-01` | `2026-07-16` | 95 | 38* | 56 | 0* | 1 | 0 | **60.00%*** | 43 |

*\*Note on `kubernetes/client-go` breakdown in `results.json`: Initial `classifyCommit()` checked for `k8s-publishing-bot` / `publishing-bot` and missed committer `"Kubernetes Publisher"`. In reality, **`95/95` (`100%`)** of kept `kubernetes/client-go` commits were committed by `Kubernetes Publisher` (see Section 4.3).*

---

## 4. Quantitative Results by Repository Pair (Generated from `results.json` & `diagnostics.json`)

### 4.1 Pair 1: `stripe/openapi` → `stripe/stripe-node` *(Supported Negative Finding)*

| $\Delta$ | Method | Scope | Eligible / Censored | Fired ($N_{\text{fired}}$) | Unique B Hits | Precision@3 (Hits / Sug) | Wilson 95% CI | Block-Bootstrap 95% CI | Query Hit@3 | Recall | Warnings / Mo | `popular` (Matched) | `recent` (Matched) | Lift vs Matched | `shuffled` Matched Window (Hits / Sug) | `shuffled` Retrained Placebo (Hits / Sug, Fired) | `results.json` Lift vs All | Status |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **24h** | `temporal` | `all` | 343 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `temporal` | `manual_only` | 343 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `explicit_ref` | `all` | 343 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `explicit_ref` | `manual_only` | 343 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `temporal` | `all` | 339 / 4 | 290 | 20 | **0.1903** (59/310) | `[0.1505, 0.2377]` | `[0.1087, 0.2918]` | 0.1966 | 0.4914 | 69.37 | 0.1903 | 0.0742 | **1.00x** | 0.5516 (171/310) | 0.6316 (96/152, $N=152$) | 0.30x | `NO-GO` |
| **72h** | `temporal` | `manual_only` | 339 / 4 | 142 | 4 | **0.1056** (15/142) | `[0.0651, 0.1670]` | `[0.0247, 0.1795]` | 0.1056 | 0.1613 | 33.97 | 0.1056 | 0.0141 | **1.00x** | 0.3803 (54/142) | 0.3684 (35/95, $N=95$) | 0.29x | `NO-GO` |
| **72h** | `explicit_ref` | `all` | 339 / 4 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `explicit_ref` | `manual_only` | 339 / 4 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **168h** | `temporal` | `all` | 336 / 7 | 334 | 25 | **0.4577** (287/627) | `[0.4191, 0.4969]` | `[0.2865, 0.6327]` | 0.6377 | 0.8192 | 82.48 | 0.7097 | 0.5136 | **0.64x** | 0.5614 (352/627) | 0.8097 (183/226, $N=213$) | 0.57x | `NO-GO` |
| **168h** | `temporal` | `manual_only` | 336 / 7 | 323 | 14 | **0.3738** (225/602) | `[0.3360, 0.4131]` | `[0.2309, 0.5468]` | 0.4799 | 0.6624 | 79.77 | 0.4502 | 0.2259 | **0.83x** | 0.4269 (257/602) | 0.5455 (294/539, $N=310$) | 0.69x | `NO-GO` |
| **168h** | `explicit_ref` | `all` | 336 / 7 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **168h** | `explicit_ref` | `manual_only` | 336 / 7 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |

**Key Findings on `stripe-openapi-to-node`:**
1. **Corrected `168h temporal all` row:** Directly from `results.json`, `168h temporal all` fired on **`334` queries** (emitting `627` suggestions with `287` hits, **`Precision@3 = 0.4577`**, Wilson 95% CI `[0.4191, 0.4969]`, block-bootstrap 95% CI `[0.2865, 0.6327]`, `Query Hit@3 = 0.6377`, `warnings/month = 82.48`). It trailed the matched `popular` baseline (`0.7097`, lift **`0.64x`**) and the matched `recent` baseline (`0.5136`).
2. **Primary `manual_only` evaluation fails against matched `popular` baseline:**
   - At **$\Delta = 72\text{h}$ (`manual_only`)**: `142` queries fired, with `15/142` correct suggestions (**`0.1056`**), exactly tying `popular_baseline` (**`0.1056`**, lift **`1.00x`**) and matching only **`4` unique downstream commits**.
   - At **$\Delta = 168\text{h}$ (`manual_only`)**: `323` queries fired, with `225/602` correct suggestions (**`0.3738`**), underperforming `popular_baseline` (**`0.4502`**, lift **`0.83x`**, margin **`-0.0764`**) and matching only **`14` unique downstream commits**.
3. **Why `explicit_ref` fired 0 times:** `stripe/openapi` bundles all endpoint changes into monolithic files (`openapi/spec3.json`, `openapi/spec3.sdk.json`), providing no per-resource path stem (`customers`, `payment_intents`) without parsing the internal OpenAPI AST diff.

---

### 4.2 Pair 2: `open-telemetry/opentelemetry-proto` → `open-telemetry/opentelemetry-js` *(Inconclusive — Sparse Data)*

| $\Delta$ | Method | Scope | Eligible / Censored | Fired ($N_{\text{fired}}$) | Unique B Hits | Precision@3 (Hits / Sug) | Wilson 95% CI | Block-Bootstrap 95% CI | Query Hit@3 | Recall | Warnings / Mo | `popular` (Matched) | `recent` (Matched) | Lift vs Matched | `shuffled` Matched Window (Hits / Sug) | `shuffled` Retrained Placebo (Hits / Sug, Fired) | `results.json` Lift vs All | Status |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **24h** | `temporal` | `all` | 7 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `temporal` | `manual_only` | 7 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `explicit_ref` | `all` | 7 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `explicit_ref` | `manual_only` | 7 / 0 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `temporal` | `all` | 7 / 0 | 2 | 0 | **0.0000** (0/2) | `[0.0000, 0.6576]` | `[0.0000, 0.6576]` | 0.0000 | 0.0000 | 0.48 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/2) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `temporal` | `manual_only` | 7 / 0 | 2 | 0 | **0.0000** (0/2) | `[0.0000, 0.6576]` | `[0.0000, 0.6576]` | 0.0000 | 0.0000 | 0.48 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/2) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `explicit_ref` | `all` | 7 / 0 | 2 | 0 | **0.0000** (0/2) | `[0.0000, 0.6576]` | `[0.0000, 0.6576]` | 0.0000 | 0.0000 | 0.48 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/2) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `explicit_ref` | `manual_only` | 7 / 0 | 2 | 0 | **0.0000** (0/2) | `[0.0000, 0.6576]` | `[0.0000, 0.6576]` | 0.0000 | 0.0000 | 0.48 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/2) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **168h** | `temporal` | `all` | 7 / 0 | 3 | 0 | **0.0000** (0/3) | `[0.0000, 0.5615]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.74 | 0.3333 | 0.0000 | **0.00x** | 0.0000 (0/3) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **168h** | `temporal` | `manual_only` | 7 / 0 | 3 | 0 | **0.0000** (0/3) | `[0.0000, 0.5615]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.74 | 0.3333 | 0.0000 | **0.00x** | 0.0000 (0/3) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **168h** | `explicit_ref` | `all` | 7 / 0 | 3 | 0 | **0.0000** (0/3) | `[0.0000, 0.5615]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.74 | 0.3333 | 0.0000 | **0.00x** | 0.0000 (0/3) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **168h** | `explicit_ref` | `manual_only` | 7 / 0 | 3 | 0 | **0.0000** (0/3) | `[0.0000, 0.5615]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.74 | 0.3333 | 0.0000 | **0.00x** | 0.0000 (0/3) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |

**Key Findings on `otel-proto-to-js`:**
- With only `7` eligible upstream commits in the held-out split and $N_{\text{fired}} \le 3$ (far below $N_{\min} = 30$), all runs on this pair are **`INCONCLUSIVE (sparse data)`**. Cross-language wire protocol changes in `opentelemetry-proto` are adopted by language SDKs over multi-month specification cycles rather than 24h–168h commit windows.

---

### 4.3 Pair 3: `kubernetes/kubernetes` → `kubernetes/client-go` *(Invalid / Unverified Mirror Experiment)*

| $\Delta$ | Method | Scope | Eligible / Censored | Fired ($N_{\text{fired}}$) | Unique B Hits | Precision@3 (Hits / Sug) | Wilson 95% CI | Block-Bootstrap 95% CI | Query Hit@3 | Recall | Warnings / Mo | `popular` (Matched) | `recent` (Matched) | Lift vs Matched | `shuffled` Matched Window (Hits / Sug) | `shuffled` Retrained Placebo (Hits / Sug, Fired) | `results.json` Lift vs All | Status |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **24h** | `temporal` | `all` | 205 / 5 | 3 | 2 | **0.6667** (2/3) | `[0.2077, 0.9385]` | `[0.0000, 1.0000]` | 0.6667 | 0.0152 | 0.86 | 0.6667 | 0.3333 | **1.00x** | 0.0000 (0/3) | 0.0000 (0/0, $N=0$) | 1.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `temporal` | `manual_only` | 205 / 5 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` *(invalid mirror test)* |
| **24h** | `explicit_ref` | `all` | 205 / 5 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **24h** | `explicit_ref` | `manual_only` | 205 / 5 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/0, $N=0$) | 0.00x | `INCONCLUSIVE (sparse data)` *(invalid mirror test)* |
| **72h** | `temporal` | `all` | 194 / 16 | 14 | 4 | **0.2632** (5/19) | `[0.1181, 0.4879]` | `[0.0769, 0.4615]` | 0.3571 | 0.0286 | 4.09 | 0.2632 | 0.0526 | **1.00x** | 0.1579 (3/19) | 0.0000 (0/6, $N=2$) | 1.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `temporal` | `manual_only` | 194 / 16 | 2 | 0 | **0.0000** (0/4) | `[0.0000, 0.4899]` | `[0.0000, 0.4899]` | 0.0000 | 0.0000 | 0.58 | 0.0000 | 0.0000 | **0.00x** | 1.0000 (4/4) | 0.0000 (0/6, $N=2$) | 0.00x | `INCONCLUSIVE (sparse data)` *(invalid mirror test)* |
| **72h** | `explicit_ref` | `all` | 194 / 16 | 2 | 0 | **0.0000** (0/6) | `[0.0000, 0.3903]` | `[0.0000, 0.3903]` | 0.0000 | 0.0000 | 0.58 | 0.3333 | 0.0000 | **0.00x** | 0.0000 (0/6) | 0.0000 (0/2, $N=2$) | 0.00x | `INCONCLUSIVE (sparse data)` |
| **72h** | `explicit_ref` | `manual_only` | 194 / 16 | 0 | 0 | **0.0000** (0/0) | `[0.0000, 0.0000]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | **0.00x** | 0.0000 (0/0) | 0.0000 (0/2, $N=2$) | 0.00x | `INCONCLUSIVE (sparse data)` *(invalid mirror test)* |
| **168h** | `temporal` | `all` | 182 / 28 | 45 | 6 | **0.3125** (20/64) | `[0.2123, 0.4339]` | `[0.1250, 0.5385]` | 0.4444 | 0.1111 | 13.66 | 0.4844 | 0.0156 | **0.65x** | 0.3750 (24/64) | 0.0000 (0/9, $N=3$) | 0.65x | `NO-GO` |
| **168h** | `temporal` | `manual_only` | 182 / 28 | 11 | 0 | **0.0000** (0/24) | `[0.0000, 0.1380]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 3.34 | 0.0000 | 0.0000 | **0.00x** | 0.2917 (7/24) | 0.0000 (0/9, $N=3$) | 0.00x | `INCONCLUSIVE (sparse data)` *(invalid mirror test)* |
| **168h** | `explicit_ref` | `all` | 182 / 28 | 8 | 1 | **0.0625** (1/16) | `[0.0111, 0.2833]` | `[0.0000, 0.3750]` | 0.1250 | 0.0056 | 2.43 | 0.6250 | 0.0000 | **0.10x** | 0.5625 (9/16) | 0.0000 (0/3, $N=3$) | 0.10x | `INCONCLUSIVE (sparse data)` |
| **168h** | `explicit_ref` | `manual_only` | 182 / 28 | 1 | 0 | **0.0000** (0/1) | `[0.0000, 0.7935]` | `[0.0000, 0.7935]` | 0.0000 | 0.0000 | 0.30 | 0.0000 | 0.0000 | **0.00x** | 1.0000 (1/1) | 0.0000 (0/3, $N=3$) | 0.00x | `INCONCLUSIVE (sparse data)` *(invalid mirror test)* |

> [!WARNING]
> **Why the Kubernetes Confounder Test Is Marked Invalid for `manual_only` Inference:**
> Post-run audit of `/tmp/gu27-repos/kubernetes_client-go` (recorded in [`diagnostics.json`](./diagnostics.json) under `kubernetesMirrorDiagnostics`) identified three structural defects in how initial `run.mjs` evaluated this pair:
> 1. **Mirror Bot Classifier Mismatch:** Out of `102` non-merge commits in `kubernetes/client-go` during `2025-08-01..2026-11-01` (`95` with $\le 50$ files), **`102/102` (`100%`) have committer `"Kubernetes Publisher"`**. Initial `classifyCommit()` checked only `k8s-publishing-bot` and `publishing-bot`, misclassifying `38` mirrored commits that touched non-`zz_generated` paths as `manual`. (`classifyCommit()` in `run.mjs` has now been updated to match `kubernetes publisher`).
> 2. **Mirror Timestamp Inversion ($t_B \le t_A$):** When `Kubernetes Publisher` mirrors a commit from `staging/src/k8s.io/client-go` into `kubernetes/client-go`, it sets the mirrored commit's committer timestamp equal to the original author timestamp ($t_B^{\text{commit}} = t_A^{\text{author}}$ on `94/95` kept commits). In `kubernetes/kubernetes`, however, $t_A^{\text{commit}}$ is the later Prow merge timestamp. Across `92` commits matched by exact `(authorTime, subject)` between Repo A and Repo B, **`91/92` (`98.9%`) have $t_B^{\text{commit}} \le t_A^{\text{commit}}$** (median $t_B^{\text{commit}} - t_A^{\text{commit}} = -48.98\text{ hours}$). Because `evaluateWalkForward()` checks $t_A < t_B \le t_A + \Delta$, `98.9%` of true mirrored commits fell outside the forward window.
> 3. **Bulk Sync Filtering:** `6` downstream commits touched $>50$ files (up to `148` scoped `.go` files in a single commit) and were dropped by `maxFilesPerCommit = 50`.
>
> Consequently, this report **removes the claim** that the `0.3125` → `0.0000` drop on `k8s` validates the confounder filter, and classifies the Kubernetes pair as **invalid / unverified as run**.

---

### 4.4 Matched vs. Non-Matched Shuffled Control Analysis

In initial [`run.mjs`](./run.mjs), `baselines.shuffledPrecision` was computed by running `evaluateWalkForward()` end-to-end on `(commitsA, shuffledB)`. Because that retrained model selected its own firing events based on shifted training windows, its firing set differed from the primary model's firing set (a **non-matched retrained placebo**).

To provide a strict apples-to-apples comparison alongside the matched `popular` and `recent` baselines, [`run-diagnostics.mjs`](./run-diagnostics.mjs) also computed **`shuffledMatchedWindowPrecision`**, which takes the **exact same fired upstream events and exact same suggestions** emitted by the primary model and scores whether those files were modified in $(t_A, t_A + \Delta]$ of the $+45\text{d}$-shifted downstream stream:

| Pair & Run | Primary Model Fired ($N$) | Primary Precision@3 (Hits / Sug) | Matched `popular` Baseline | Matched `recent` Baseline | Matched-Event `shuffled` Window (Hits / Sug) | Non-Matched Retrained `shuffled` Placebo in `results.json` (Hits / Sug, Fired $N$) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `stripe` $72\text{h}$ `temporal` `all` | 290 | **0.1903** (59/310) | 0.1903 | 0.0742 | **0.5516** (171/310) | **0.6316** (96/152, $N=152$) |
| `stripe` $72\text{h}$ `temporal` `manual_only` | 142 | **0.1056** (15/142) | 0.1056 | 0.0141 | **0.3803** (54/142) | **0.3684** (35/95, $N=95$) |
| `stripe` $168\text{h}$ `temporal` `all` | 334 | **0.4577** (287/627) | 0.7097 | 0.5136 | **0.5614** (352/627) | **0.8097** (183/226, $N=213$) |
| `stripe` $168\text{h}$ `temporal` `manual_only` | 323 | **0.3738** (225/602) | 0.4502 | 0.2259 | **0.4269** (257/602) | **0.5455** (294/539, $N=310$) |

**Why Shuffled Streams Scored Higher on Stripe:**
In `stripe/stripe-node`, updates to high-frequency core files (`src/stripe.core.ts`, `src/stripe.esm.node.ts`, `src/utils.ts`) were denser in May–June 2026 than in late June–July 2026. Circularly shifting Repo B's timestamps forward by $+45\text{ days}$ moved that high-density May–June cluster directly into the late-June/July held-out evaluation window where `stripe/openapi` had bursts of private-preview spec commits. Regardless of whether the shuffled control is excluded or included, the primary `manual_only` predictor fails to beat the simple matched `popular` baseline (`1.00x` lift at $72\text{h}$, `0.83x` lift at $168\text{h}$).

---

## 5. Repository-Level Alerts vs. File-Level Alerts (Generated from `results.json`)

| Pair ID | $\Delta$ | Scope | Repo-Level Fired | Repo-Level Precision (Hits / Fired) | Repo-Level Wilson 95% CI | Unconditional Repo B Base Rate | Repo-Level Lift | File-Level Precision@3 | File-Level Lift vs Matched Baseline |
| :--- | :--- | :--- | ---: | ---: | :--- | ---: | ---: | ---: | ---: |
| `stripe-openapi-to-node` | **72h** | `all` | 339 | **0.3422** (116/339) | `[0.2937, 0.3942]` | 0.3422 | **1.00x** | 0.1903 (59/310) | 1.00x |
| `stripe-openapi-to-node` | **72h** | `manual_only` | 317 | **0.2808** (89/317) | `[0.2341, 0.3326]` | 0.2743 | **1.02x** | 0.1056 (15/142) | 1.00x |
| `stripe-openapi-to-node` | **168h** | `all` | 286 | **0.7343** (210/286) | `[0.6802, 0.7821]` | 0.7738 | **0.95x** | 0.4577 (287/627) | 0.64x |
| `stripe-openapi-to-node` | **168h** | `manual_only` | 318 | **0.6918** (220/318) | `[0.6390, 0.7400]` | 0.6964 | **0.99x** | 0.3738 (225/602) | 0.83x |
| `otel-proto-to-js` | **72h** | `manual_only` | 3 | **1.0000** (3/3) | `[0.4385, 1.0000]` | 0.8571 | **1.17x** | 0.0000 (0/2) | 0.00x |
| `k8s-staging-to-client-go` | **24h** | `all` | 12 | **0.8333** (10/12) | `[0.5520, 0.9530]` | 0.6439 | **1.29x** | 0.6667 (2/3) | 1.00x |
| `k8s-staging-to-client-go` | **72h** | `all` | 47 | **0.9362** (44/47) | `[0.8284, 0.9781]` | 0.9021 | **1.04x** | 0.2632 (5/19) | 1.00x |
| `k8s-staging-to-client-go` | **168h** | `all` | 67 | **1.0000** (67/67) | `[0.9458, 1.0000]` | 0.9890 | **1.01x** | 0.3125 (20/64) | 0.65x |
| `k8s-staging-to-client-go` | **168h** | `manual_only` | 26 | **0.7308** (19/26) | `[0.5392, 0.8630]` | 0.8462 | **0.86x** | 0.0000 (0/24) | 0.00x |

**Key Takeaway:**
Whenever repository-level precision exceeded `0.60` (e.g., `0.6918` on `stripe` at $168\text{h}$ `manual_only` or `1.0000` on `k8s` at $168\text{h}$ `all`), the unconditional base rate of Repo B activity in a 168-hour window was already `0.6964` (`lift = 0.99x`) and `0.9890` (`lift = 1.01x`).

---

## 6. Qualitative Inspection of Sampled Predictions & Audit Provenance

### 6.1 Provenance & Limitations of the 15-Prediction Inspection

- **Selection method (non-random convenience sample):** `evaluateWalkForward()` stores the first 15 fired predictions in chronological order in `samplePredictions` for each run. The 15 rows below were selected by taking 5 early predictions from each pair across representative horizons.
- **Rater provenance:** Rated by a single rater (the AI agent authoring GU-27), not by blind or multi-rater human annotation.
- **True-match count vs. preregistered `GO` Rule 5:** Preregistered `GO` Rule 5 specifies that at least **50% of true matches** be judged `Actionable review question` (vs. `Known automated synchronization` or `Interesting historical correlation but not actionable`). In this 15-item sample, **only 4 predictions were true matches (`hit: true`)**—Rows 1 and 2 on `stripe` $72\text{h}$ `all` (both matching the same downstream commit `f96a3a0002`), and Rows 11 and 12 on `k8s` $168\text{h}$ `all` (both matching generated `applyconfigurations/internal/internal.go`). **Zero (`0 / 4 = 0%`) of the true matches were rated `Actionable review question`.**
- **Post-hoc 4th category for false alarms:** The remaining 11 inspected predictions were false alarms (`hit: false`), labeled below with the post-hoc descriptive tag *`False alarm — irrelevant or misleading`*. Because of the small true-match count ($n = 4$) and single-rater convenience sampling, this table is presented as **qualitative diagnostic evidence** rather than a formal statistical gate.

| # | Pair ID | Upstream Commit ($t_A$) & Subject | Triggered From ($f_A$) → Suggested ($f_B$) | Outcome in $(t_A, t_A + \Delta]$ | Preregistered 3-Class Rubric (True Matches) / Post-Hoc Tag (False Alarms) | Qualitative Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `stripe` ($72\text{h}$ `all`) | `63fcf17ef3` (`2026-06-23T22:37Z`)<br>*"Update fixture data"* | `openapi/fixtures3.json` → `src/stripe.core.ts` (`shared 8/19`, low `0.231`) | **True Match** (`f96a3a0002`, $+6.1\text{h}$) | **Interesting historical correlation, not actionable** | Upstream fixture dump preceded a general SDK core update (`f96a3a0002`); fixture updates do not require manual edits to `stripe.core.ts`. |
| 2 | `stripe` ($72\text{h}$ `all`) | `f4ac6d9a7f` (`2026-06-23T22:37Z`)<br>*"Update OpenAPI specification for GA and public preview"* | `openapi/spec3.json` → `src/stripe.core.ts` (`shared 13/31`, low `0.264`) | **True Match** (`f96a3a0002`, $+6.1\text{h}$) | **Interesting historical correlation, not actionable** | Credits the exact same downstream commit `f96a3a0002` 1 second after `63fcf17ef3`; `stripe.core.ts` changes on SDK release cadence, not per-endpoint spec edits. |
| 3 | `stripe` ($72\text{h}$ `man`) | `46c4473bf1` (`2026-06-25T03:11Z`)<br>*"Update OpenAPI specification for private preview"* | `openapi/spec3.private_preview.sdk.json` → `src/stripe.core.ts` (`shared 65/232`, low `0.226`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Private-preview spec snapshot has no impact on public `stripe-node` core runtime. |
| 4 | `stripe` ($168\text{h}$ `man`) | `63fcf17ef3` (`2026-06-23T22:37Z`)<br>*"Update fixture data"* | `openapi/fixtures3.beta.json` → `src/RequestSender.ts`, `src/Types.d.ts` (`shared 22/56`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Beta fixture data has no causal relationship to HTTP `RequestSender.ts`. |
| 5 | `stripe` ($168\text{h}$ `man`) | `bc0062b49f` (`2026-06-25T19:10Z`)<br>*"Update OpenAPI specification for private preview"* | `openapi/spec3.private_preview.sdk.json` → `src/stripe.core.ts`, `src/stripe.esm.node.ts`, `src/utils.ts` | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | High-frequency upstream spec dump paired with high-frequency SDK entrypoint files. |
| 6 | `otel` ($72\text{h}$ `man`) | `3b93166f82` (`2026-08-28T19:11Z`)<br>*"Move attribute examples to latest semconv. (#853)"* | `opentelemetry/proto/trace/v1/trace.proto` → `.../EnvironmentConfigProvider.ts` (`shared 3/4`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Doc/example comment move in `trace.proto` has zero impact on JS `EnvironmentConfigProvider.ts`. |
| 7 | `otel` ($72\text{h}$ `man`) | `bb8796bff6` (`2026-09-02T13:56Z`)<br>*"Add `since <version>` requirement to new proto fields and backfill (#854)"* | `opentelemetry/proto/metrics/v1/metrics.proto` → `.../EnvironmentConfigProvider.ts` (`shared 3/5`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Proto comment/version-annotation policy backfill does not affect JS environment configuration. |
| 8 | `otel` ($168\text{h}$ `man`) | `9bff3f876f` (`2026-09-29T05:16Z`)<br>*"Fix typo in metrics.proto comment (#872)"* | `opentelemetry/proto/metrics/v1/metrics.proto` → `.../EnvironmentConfigProvider.ts` (`shared 4/6`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Comment typo fix in `metrics.proto` triggered a cross-repo warning on an unrelated experimental JS file. |
| 9 | `otel` ($168\text{h}$ `exp`) | `3b93166f82` (`2026-08-28T19:11Z`) (`explicit_ref`) | `opentelemetry/proto/trace/v1/trace.proto` → `.../EnvironmentConfigProvider.ts` (`shared 4/4`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Shared generic token `opentelemetry` allowed `explicit_ref` to pair `trace.proto` with `EnvironmentConfigProvider.ts`. |
| 10 | `otel` ($168\text{h}$ `exp`) | `bb8796bff6` (`2026-09-02T13:56Z`) (`explicit_ref`) | `opentelemetry/proto/trace/v1/trace.proto` → `.../EnvironmentConfigProvider.ts` (`shared 4/4`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Same spurious small-sample pairing (`4/4` in training, `0/3` in evaluation). |
| 11 | `k8s` ($168\text{h}$ `all`) | `316b0b064a` (`2026-07-18T00:00Z`)<br>*"add workload config building blocks API types"* | `staging/src/k8s.io/api/scheduling/v1alpha3/types.go` → `applyconfigurations/internal/internal.go` | **True Match** (`f2ffee48ce`, $+16.8\text{h}$) | **Known automated synchronization** | `applyconfigurations/internal/internal.go` is a generated `client-go` artifact synced by `Kubernetes Publisher`. |
| 12 | `k8s` ($168\text{h}$ `all`) | `3c20ae3c47` (`2026-07-21T16:06Z`)<br>*"KEP-5729: Promote DRAWorkloadResourceClaims to beta"* | `staging/.../podgrouptemplate.go` → `applyconfigurations/internal/internal.go` | **True Match** (`16f6ccdf67`, $+40.4\text{h}$) | **Known automated synchronization** | Downstream hit is automated staging-to-mirror synchronization of generated applyconfiguration code. |
| 13 | `k8s` ($168\text{h}$ `man`) | `b8d76348fa` (`2026-09-03T18:00Z`)<br>*"validation-gen: Let deep-equal func be set by tag"* | `staging/.../zz_generated.validations.go` → `tools/events/event_broadcaster.go`, `event_recorder.go` | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Coincidental training-window overlap between validation codegen and `tools/events/*`. |
| 14 | `k8s` ($168\text{h}$ `man`) | `e060f3c2bc` (`2026-09-09T05:00Z`)<br>*"client-go: avoid holding the event broadcaster lock during EventSeries updates"* | `staging/src/k8s.io/client-go/tools/events/event_broadcaster.go` → `tools/events/event_broadcaster.go` | Scored Miss (mirror $t_B \le t_A$) | **Known automated synchronization** *(artifact of mirror clock)* | Exact mirrored path in read-only `kubernetes/client-go`; scored as a miss because `Kubernetes Publisher` preserved author timestamp ($t_B \le t_A$). |
| 15 | `k8s` ($168\text{h}$ `man`) | `a114ef37c6` (`2026-09-23T14:54Z`)<br>*"api/certificates: update CertificateSigningRequest usages field documentation..."* | `staging/.../certificates/v1/types_swagger_doc_generated.go` → `tools/events/event_broadcaster.go` | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Certificate doc comment update has no relationship to `event_broadcaster.go`. |

---

## 7. Operational Cost, Permissions Friction, & Future Direction

### 7.1 Runtime & Resource Costs (from `results.json`)

| Pair ID | Scoped Commits (A / B) | `git log` Subprocess Calls | GitHub API Requests | Wall-Clock Runtime |
| :--- | ---: | ---: | ---: | ---: |
| `stripe-openapi-to-node` | 1128 / 157 | 2 | 0 | `474 ms` |
| `otel-proto-to-js` | 43 / 357 | 2 | 0 | `36 ms` |
| `k8s-staging-to-client-go` | 687 / 95 | 2 | 0 | `882 ms` |
| **Total (36 runs)** | **1858 / 609** | **6** | **0** | **`1392 ms`** |

### 7.2 Why Temporal Cross-Repository Warnings Should Not Be Built Now

1. **GitHub Actions `GITHUB_TOKEN` Permission Boundary:** Gutter runs out-of-the-box using the default single-repository `GITHUB_TOKEN`. Accessing private sibling repositories requires provisioning a cross-repository Fine-Grained PAT or multi-repo GitHub App plus maintaining explicit repository-pair manifests.
2. **Insufficient Signal-to-Noise Ratio:** On the only high-volume pair (`stripe/openapi` → `stripe/stripe-node`), `manual_only` temporal predictions fire `33.97`–`79.77` times per month while performing no better than a static popular-file list (`1.00x` lift at $72\text{h}$, `0.83x` lift at $168\text{h}$).

### 7.3 Preserving Future Optionality: Explicit Contract Analysis (Not Commit Timing)

This `NO-GO` decision applies to **commit-timestamp window correlation**, not to all forms of cross-repository impact analysis. If cross-repository analysis is revisited in a later milestone after single-repository resolution and calibration benchmarks are established, it should be built around **explicit static contract evidence**—such as parsing structured breaking changes in OpenAPI/Protobuf/GraphQL ASTs and matching them deterministically to static consumer symbol/endpoint references—rather than inferring coupling from Git commit timestamps.
