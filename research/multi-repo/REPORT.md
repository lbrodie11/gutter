# GU-27 · Cross-Repository Coupling Research Report

- **Experiment ID:** `GU-27`
- **Date:** 2026-11-08
- **Preregistration Commit:** `0ea8a61` ([`PAIRS.md`](./PAIRS.md), [`METHODOLOGY.md`](./METHODOLOGY.md), [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md), [`run.mjs`](./run.mjs), [`test/multi-repo.test.mjs`](./test/multi-repo.test.mjs))
- **Machine-Readable Outputs:** [`results.json`](./results.json), [`manifest.json`](./manifest.json)
- **Final Verdict:** **`NO-GO`** (`0 / 3` pairs met the preregistered `manual_only` go criteria)

---

## 1. Executive Summary & Decision Verdict

**Verdict: `NO-GO` — Do not ship cross-repository temporal co-change warnings in Gutter or Repo Archaeology.**

Across three deliberately distinct repository pairs spanning vendor OpenAPI specifications (`stripe/openapi` → `stripe/stripe-node`), cross-language wire protocols (`open-telemetry/opentelemetry-proto` → `open-telemetry/opentelemetry-js`), and monorepo-to-mirror synchronization (`kubernetes/kubernetes` → `kubernetes/client-go`), **temporal commit-window alignment failed every preregistered accuracy, baseline-lift, confounder-survival, and human-usefulness gate**:

| Preregistered Gate ([`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md)) | Required Threshold (`manual_only`) | Observed Result | Gate Status |
| :--- | :--- | :--- | :--- |
| **1. Sample-Size Gate** | $N_{\text{fired}} \ge 30$ queries on $\ge 2$ pairs | Passed on **1 / 3** pairs (`stripe-openapi-to-node` at $72\text{h}$ and $168\text{h}$); `otel-proto-to-js` ($N_{\text{fired}} \le 3$) and `k8s-staging-to-client-go` ($N_{\text{fired}} \le 11$ on `manual_only`) are sparse | **FAIL** |
| **2. Absolute Precision Gate** | $\text{Precision@3} \ge 0.60$ | Best `manual_only` precision with $N_{\text{fired}} \ge 30$ is **`0.3738`** (`37.4%`, Wilson 95% CI `[0.3360, 0.4131]`, block-bootstrap 95% CI `[0.2309, 0.5468]`) on `stripe` at $168\text{h}$; `0.1056` (`10.6%`) at $72\text{h}$; `0.0000` (`0.0%`) on `otel` and `k8s` | **FAIL** |
| **3. Baseline Lift Gate** | $\ge +0.15$ absolute margin and $\ge 1.5\times$ lift over `max(popular, recent, shuffled)` | **Negative margin on every qualifying run.** On `stripe` ($72\text{h}$ `manual_only`), precision (`0.1056`) ties `popular` (`0.1056`) and trails the `+45d` `shuffled` negative control (`0.3684`, lift **`0.29x`**, margin **`-0.2628`**). At $168\text{h}$ `manual_only`, precision (`0.3738`) trails both `popular` (`0.4502`) and `shuffled` (`0.5455`, lift **`0.69x`**, margin **`-0.1717`**) | **FAIL** |
| **4. Confounder Survival Gate** | Signal survives excluding `generated`, `mirrored`, `dependency_or_version`, and `bot` targets | On `k8s-staging-to-client-go` ($\Delta = 168\text{h}$), `all`-target precision is `0.3125` (`20/64` hits, all on generated `applyconfigurations/internal/internal.go`), which collapses to **`0.0000` (`0/24`)** under `manual_only` | **FAIL** |
| **5. Alert Volume Gate** | $\le 10$ warnings/month (or $\ge 0.75$ precision if $>10$/month) | `stripe` emits **`33.97`–`79.77` warnings/month** with **`79.7%`–`89.4%` false-alarm rate** | **FAIL** |
| **6. Human Usefulness Audit** | $\ge 70\%$ of audited predictions rated *Actionable review question* | **`0 / 15` (`0%`)** audited predictions rated *Actionable review question* | **FAIL** |

### Why Methodological Controls Changed the Conclusion

Without the controls mandated in [`METHODOLOGY.md`](./METHODOLOGY.md), a naive experiment could easily have reported a false positive:
- At $\Delta = 168\text{h}$, **repository-level alerts** achieved **`69.2%`–`73.4%` precision** on `stripe/openapi` → `stripe/stripe-node` and **`100.0%` precision (`67/67`)** on `kubernetes/kubernetes` → `kubernetes/client-go`.
- However, comparing against the **unconditional downstream activity base rate** (`69.6%`–`77.4%` on `stripe`, `98.9%` on `k8s`) and the **`+45d` circularly shifted `shuffled` negative control** proves that these hits are an artifact of independent high-frequency release cadences (`lift = 0.95x–1.01x`), not causal cross-repository file coupling.

---

## 2. Prerequisite & Repository Verification

Prior to running the experiment, all external dependencies and repository assumptions were verified against live repository state:

1. **`lbrodie11/repo-archaeology` Library API (`RA-03`):**
   - Verified merged on `main` (`openRepository()` exported from `dist/api/index.js`).
   - `probeRepoArchaeologyApi()` in [`run.mjs`](./run.mjs) confirmed that the `Repository` session exposes `diff`, `scan`, `file`, `explain`, `backtest`, `importGraph`, and `close`, with `exposesRawCommitHistory: false`.
   - Because `openRepository()` does not expose raw chronological commit records (`commits()` / `history()`), [`run.mjs`](./run.mjs) uses an argument-vector `execFileSync('git', ['-C', repoDir, 'log', headSha, ...])` reader and never imports private `repo-archaeology` internals.
2. **Benchmark Milestones (`RA-06` and `GU-03`):**
   - Verified that neither `RA-06` nor `GU-03` benchmark files exist on `main` of `lbrodie11/repo-archaeology` or `lbrodie11/gutter`.
   - GU-27 therefore defines its own self-contained walk-forward evaluation protocol in [`METHODOLOGY.md`](./METHODOLOGY.md) without modifying any product code (`src/`, `action.yml`, `package.json`, `schema/`).

---

## 3. Dataset, Chronological Splits, & Confounder Breakdown

All 6 repositories were evaluated from local bare blobless clones pinned to the exact `HEAD` SHAs preregistered in [`PAIRS.md`](./PAIRS.md). Each pair's observation window $[T_{\text{start}}, T_{\text{end}}]$ was partitioned into **60% Training**, a **168-hour (7-day) Embargo**, **15% Tuning**, a second **168-hour Embargo**, and the final **~25% Held-Out Evaluation** split:

| Pair ID | Role & Repo (`HEAD` SHA) | Scoped Commits ($\le 50$ files) | `manual` | `generated` | `mirrored` | `dep / version` | `bot` | Automated Share | Timestamp Anomalies |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **`stripe-openapi-to-node`** | **A:** `stripe/openapi` (`6360907c`) | 1,128 | 235 | 893 | 0 | 0 | 0 | **79.17%** | 0 |
| *(2025-05-01 → 2026-11-01)* | **B:** `stripe/stripe-node` (`dacc7167`) | 157 | 82 | 33 | 0 | 42 | 0 | **47.77%** | 4 |
| **`otel-proto-to-js`** | **A:** `open-telemetry/opentelemetry-proto` (`169f2f2c`) | 43 | 43 | 0 | 0 | 0 | 0 | **0.00%** | 0 |
| *(2025-05-01 → 2026-11-01)* | **B:** `open-telemetry/opentelemetry-js` (`ee94b842`) | 357 | 356 | 0 | 0 | 1 | 0 | **0.28%** | 0 |
| **`k8s-staging-to-client-go`** | **A:** `kubernetes/kubernetes` (`e3d37bb9`) | 687 | 636 | 49 | 0 | 2 | 0 | **7.42%** | 459 |
| *(2025-08-01 → 2026-11-01)* | **B:** `kubernetes/client-go` (`494d62c5`) | 95 | 38 | 56 | 0 | 1 | 0 | **60.00%** | 43 |

> [!NOTE]
> **Structural Observation on Bulk Codegen / Mirror Commits ($\le 50$ Files Cap):**
> Consistent with single-repository co-change hygiene (which skips commits touching $>50$ files to prevent $O(F^2)$ co-change clique explosion), `readGitHistory()` skips bulk commits with $>50$ files. In `stripe/stripe-node` and `kubernetes/client-go`, full-repo codegen sweeps and bulk subtree syncs frequently touch $>50$ files at once, whereas in `stripe/openapi` each spec dump touches only `4–8` monolithic JSON/YAML files (`openapi/spec3.json`, `openapi/spec3.sdk.json`, etc.). Also note that in `kubernetes/client-go`, `k8s-publishing-bot` preserves the original human `Author` and `Committer` headers when mirroring commits from `kubernetes/kubernetes`, which causes `459` upstream and `43` downstream author-vs-committer timestamp anomalies ($|t_{\text{commit}} - t_{\text{author}}| > 24\text{h}$).

---

## 4. Quantitative Results by Repository Pair

### 4.1 Pair 1: `stripe/openapi` → `stripe/stripe-node`

- **Held-Out Evaluation Split:** `2026-06-23T18:00:00Z` → `2026-11-01T00:00:00Z` (~4.27 months)

| $\Delta$ | Method | Target Scope | Eligible / Censored | Fired Queries ($N_{\text{fired}}$) | Unique B Hits | Precision@3 (Hits / Sug) | Wilson 95% CI | Block-Bootstrap 95% CI | Query Hit@3 | Recall | Warnings / Mo | `popular` | `recent` | `shuffled` (+45d) | Lift vs Strongest | Status |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **24h** | `temporal` | `all` | 343 / 0 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **24h** | `temporal` | `manual_only` | 343 / 0 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **24h** | `explicit_ref` | `all` | 343 / 0 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **24h** | `explicit_ref` | `manual_only` | 343 / 0 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **72h** | `temporal` | `all` | 339 / 4 | 290 | 20 | **0.1903** (59/310) | `[0.1505, 0.2377]` | `[0.1087, 0.2918]` | 0.1966 | 0.4914 | 69.37 | 0.1903 | 0.0742 | **0.6316** | **0.30x** | **`NO-GO`** |
| **72h** | `temporal` | `manual_only` | 339 / 4 | 142 | 4 | **0.1056** (15/142) | `[0.0651, 0.1670]` | `[0.0247, 0.1795]` | 0.1056 | 0.1613 | 33.97 | 0.1056 | 0.0141 | **0.3684** | **0.29x** | **`NO-GO`** |
| **72h** | `explicit_ref` | `all` | 339 / 4 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **72h** | `explicit_ref` | `manual_only` | 339 / 4 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **168h** | `temporal` | `all` | 336 / 7 | 310 | 28 | **0.2368** (157/663) | `[0.2060, 0.2706]` | `[0.1303, 0.3693]` | 0.3613 | 0.4308 | 76.56 | 0.3122 | 0.1584 | **0.5888** | **0.40x** | **`NO-GO`** |
| **168h** | `temporal` | `manual_only` | 336 / 7 | 323 | 14 | **0.3738** (225/602) | `[0.3360, 0.4131]` | `[0.2309, 0.5468]` | 0.4799 | 0.6624 | 79.77 | 0.4502 | 0.2259 | **0.5455** | **0.69x** | **`NO-GO`** |
| **168h** | `explicit_ref` | `all` | 336 / 7 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **168h** | `explicit_ref` | `manual_only` | 336 / 7 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |

**Diagnosis (`stripe-openapi-to-node`):**
1. **Severe many-to-many inflation:** At $\Delta = 72\text{h}$ (`manual_only`), `142` upstream queries fired and produced `15` hit suggestions, but those `15` hits mapped to only **`4` unique downstream commits** in `stripe/stripe-node`. At $\Delta = 168\text{h}$ (`manual_only`), `225` hit suggestions mapped to only **`14` unique downstream commits**. Because `stripe/openapi` publishes multiple spec snapshots per day (`spec3.private_preview.sdk.json`, `fixtures3.private_preview.json`, `spec3.json`), dozens of consecutive upstream commits claim credit for the same weekly `stripe-node` commit.
2. **Temporal aligner loses to `popular` and `shuffled` controls:** Every single suggestion emitted by `temporal` on `manual_only` pointed to the same 3–4 high-frequency SDK infrastructure files (`src/stripe.core.ts`, `src/stripe.esm.node.ts`, `src/utils.ts`, `src/RequestSender.ts`). Predicting the most popular files (`0.4502`) or circularly shifting `stripe-node` timestamps by $+45\text{ days}$ (`0.5455`) achieved higher precision than the unshifted temporal model (`0.3738`).
3. **Zero path-level contract token overlap (`explicit_ref`):** Because `stripe/openapi` commits bundle all endpoint changes into monolithic files (`openapi/spec3.json`, `openapi/spec3.sdk.json`) rather than per-resource files (`schemas/customer.yaml`), path-based `explicit_ref` token matching cannot link an upstream commit to a specific downstream resource file without parsing the full multi-megabyte OpenAPI AST diff.

---

### 4.2 Pair 2: `open-telemetry/opentelemetry-proto` → `open-telemetry/opentelemetry-js`

- **Held-Out Evaluation Split:** `2026-06-23T18:00:00Z` → `2026-11-01T00:00:00Z` (~4.27 months)

| $\Delta$ | Method | Target Scope | Eligible / Censored | Fired Queries ($N_{\text{fired}}$) | Unique B Hits | Precision@3 (Hits / Sug) | Wilson 95% CI | Block-Bootstrap 95% CI | Query Hit@3 | Recall | Warnings / Mo | `popular` | `recent` | `shuffled` (+45d) | Lift vs Strongest | Status |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **24h** | `temporal` / `explicit_ref` | `all` / `manual_only` | 7 / 0 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **72h** | `temporal` | `all` / `manual_only` | 7 / 0 | 2 | 0 | **0.0000** (0/2) | `[0.0000, 0.6576]` | `[0.0000, 0.6576]` | 0.0000 | 0.0000 | 0.48 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **72h** | `explicit_ref` | `all` / `manual_only` | 7 / 0 | 2 | 0 | **0.0000** (0/2) | `[0.0000, 0.6576]` | `[0.0000, 0.6576]` | 0.0000 | 0.0000 | 0.48 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **168h** | `temporal` | `all` / `manual_only` | 7 / 0 | 3 | 0 | **0.0000** (0/3) | `[0.0000, 0.5615]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.74 | **0.3333** | 0.0000 | 0.0000 | **0.00x** | `INCONCLUSIVE` |
| **168h** | `explicit_ref` | `all` / `manual_only` | 7 / 0 | 3 | 0 | **0.0000** (0/3) | `[0.0000, 0.5615]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 0.74 | **0.3333** | 0.0000 | 0.0000 | **0.00x** | `INCONCLUSIVE` |

**Diagnosis (`otel-proto-to-js`):**
1. **Cross-language protocol specifications evolve on multi-month governance cycles, not 24h–168h commit windows:** Over 18 months, `open-telemetry/opentelemetry-proto` recorded only `43` non-merge commits (`7` in the held-out evaluation split).
2. **Spurious small-sample associations fail out-of-sample:** During the training window, `trace.proto` and `metrics.proto` happened to co-occur within 168h of active work on `experimental/packages/opentelemetry-configuration/src/EnvironmentConfigProvider.ts` (`shared = 4/4`). In the held-out evaluation split, all 3 fired predictions (`3b93166f82`, `bb8796bff6`, `9bff3f876f` — including a comment typo fix in `metrics.proto`) predicted `EnvironmentConfigProvider.ts` and missed (`0/3` hits).

---

### 4.3 Pair 3: `kubernetes/kubernetes` (`staging/src/k8s.io/{client-go,api}`) → `kubernetes/client-go`

- **Held-Out Evaluation Split:** `2026-07-16T18:00:00Z` → `2026-11-01T00:00:00Z` (~3.51 months)

| $\Delta$ | Method | Target Scope | Eligible / Censored | Fired Queries ($N_{\text{fired}}$) | Unique B Hits | Precision@3 (Hits / Sug) | Wilson 95% CI | Block-Bootstrap 95% CI | Query Hit@3 | Recall | Warnings / Mo | `popular` | `recent` | `shuffled` (+45d) | Lift vs Strongest | Status |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **24h** | `temporal` | `all` | 205 / 5 | 3 | 2 | **0.6667** (2/3) | `[0.2077, 0.9385]` | `[0.0000, 1.0000]` | 0.6667 | 0.0152 | 0.86 | **0.6667** | 0.3333 | 0.0000 | **1.00x** | `INCONCLUSIVE` |
| **24h** | `temporal` | `manual_only` | 205 / 5 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **24h** | `explicit_ref` | `all` / `manual_only` | 205 / 5 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **72h** | `temporal` | `all` | 194 / 16 | 14 | 4 | **0.2632** (5/19) | `[0.1181, 0.4879]` | `[0.0769, 0.4615]` | 0.3571 | 0.0286 | 4.09 | **0.2632** | 0.0526 | 0.0000 | **1.00x** | `INCONCLUSIVE` |
| **72h** | `temporal` | `manual_only` | 194 / 16 | 2 | 0 | **0.0000** (0/4) | `[0.0000, 0.4899]` | `[0.0000, 0.4899]` | 0.0000 | 0.0000 | 0.58 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **72h** | `explicit_ref` | `all` | 194 / 16 | 2 | 0 | **0.0000** (0/6) | `[0.0000, 0.3903]` | `[0.0000, 0.3903]` | 0.0000 | 0.0000 | 0.58 | **0.3333** | 0.0000 | 0.0000 | **0.00x** | `INCONCLUSIVE` |
| **72h** | `explicit_ref` | `manual_only` | 194 / 16 | 0 | 0 | 0.0000 (0/0) | `[0.00, 0.00]` | `[0.00, 0.00]` | 0.0000 | 0.0000 | 0.00 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **168h** | `temporal` | `all` | 182 / 28 | 45 | 6 | **0.3125** (20/64) | `[0.2123, 0.4339]` | `[0.1250, 0.5385]` | 0.4444 | 0.1111 | 13.66 | **0.4844** | 0.0156 | 0.0000 | **0.65x** | **`NO-GO`** |
| **168h** | `temporal` | `manual_only` | 182 / 28 | 11 | 0 | **0.0000** (0/24) | `[0.0000, 0.1380]` | `[0.0000, 0.0000]` | 0.0000 | 0.0000 | 3.34 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |
| **168h** | `explicit_ref` | `all` | 182 / 28 | 8 | 1 | **0.0625** (1/16) | `[0.0111, 0.2833]` | `[0.0000, 0.3750]` | 0.1250 | 0.0056 | 2.43 | **0.6250** | 0.0000 | 0.0000 | **0.10x** | `INCONCLUSIVE` |
| **168h** | `explicit_ref` | `manual_only` | 182 / 28 | 1 | 0 | **0.0000** (0/1) | `[0.0000, 0.7935]` | `[0.0000, 0.7935]` | 0.0000 | 0.0000 | 0.30 | 0.0000 | 0.0000 | 0.0000 | 0.00x | `INCONCLUSIVE` |

**Diagnosis (`k8s-staging-to-client-go`):**
1. **Confounder stress test worked as designed:** In `all` mode at $\Delta = 168\text{h}$, `temporal` fired `45` times (`N_fired >= 30`) with `31.25%` precision (`20/64`) and `44.44%` query hit rate (median follow-up latency `16.75h`, IQR `[7.23h, 61.07h]`). Every single one of those `20` hits was on the generated file `applyconfigurations/internal/internal.go` (which `popular` predicted with `48.44%` precision, `lift = 0.65x`), and those `20` hits mapped to only **`6` unique downstream commits**.
2. **Complete collapse on `manual_only`:** Once generated files are excluded (`manual_only`), precision drops from `31.25%` to **`0.00%` (`0/24` suggestions across `11` fired queries)**. Even when an upstream commit in `staging/src/k8s.io/client-go/tools/events/event_broadcaster.go` (`e060f3c2bc`) predicted the exact corresponding path `tools/events/event_broadcaster.go` in `kubernetes/client-go`, the prediction missed in our filtered stream or represented an automated mirror sync where warning a human developer on the upstream PR ("Remember to also edit the read-only mirror repo!") would be actively harmful.

---

## 5. Repository-Level Alerts vs. File-Level Alerts

To test whether a coarser product surface (*"This change in Repo A may affect Repo B"*) is viable even when file-level predictions fail, [`run.mjs`](./run.mjs) evaluated repository-level alerts alongside Top-3 file-level alerts:

| Pair ID | Horizon ($\Delta$) | Scope | Repo-Level Fired | Repo-Level Precision (Hits / Fired) | Repo-Level Wilson 95% CI | Unconditional Repo B Base Rate | Repo-Level Lift | File-Level Precision@3 | File-Level Lift vs Strongest Baseline |
| :--- | :--- | :--- | ---: | ---: | :--- | ---: | ---: | ---: | ---: |
| **`stripe-openapi-to-node`** | **72h** | `all` | 339 | **0.3422** (116/339) | `[0.2937, 0.3942]` | 0.3422 | **1.00x** | 0.1903 | 0.30x |
| **`stripe-openapi-to-node`** | **72h** | `manual_only` | 317 | **0.2808** (89/317) | `[0.2341, 0.3326]` | 0.2743 | **1.02x** | 0.1056 | 0.29x |
| **`stripe-openapi-to-node`** | **168h** | `all` | 286 | **0.7343** (210/286) | `[0.6802, 0.7821]` | 0.7738 | **0.95x** | 0.2368 | 0.40x |
| **`stripe-openapi-to-node`** | **168h** | `manual_only` | 318 | **0.6918** (220/318) | `[0.6390, 0.7400]` | 0.6964 | **0.99x** | 0.3738 | 0.69x |
| **`otel-proto-to-js`** | **72h** | `manual_only` | 3 | **1.0000** (3/3) | `[0.4385, 1.0000]` | 0.8571 | **1.17x** | 0.0000 | 0.00x |
| **`k8s-staging-to-client-go`** | **24h** | `all` | 12 | **0.8333** (10/12) | `[0.5520, 0.9530]` | 0.6439 | **1.29x** | 0.6667 | 1.00x |
| **`k8s-staging-to-client-go`** | **72h** | `all` | 47 | **0.9362** (44/47) | `[0.8284, 0.9781]` | 0.9021 | **1.04x** | 0.2632 | 1.00x |
| **`k8s-staging-to-client-go`** | **168h** | `all` | 67 | **1.0000** (67/67) | `[0.9458, 1.0000]` | 0.9890 | **1.01x** | 0.3125 | 0.65x |
| **`k8s-staging-to-client-go`** | **168h** | `manual_only` | 26 | **0.7308** (19/26) | `[0.5392, 0.8630]` | 0.8462 | **0.86x** | 0.0000 | 0.00x |

**Key Takeaway:**
Repository-level alerts **do not rescue the feature** (`NOT YET` gate requires $\text{precision} \ge 0.60$ **and** $\text{lift} \ge 1.5\times$ over the unconditional downstream activity rate). Whenever repository-level precision exceeded `0.60` (e.g., `0.6918` on `stripe` at $168\text{h}$ or `1.0000` on `k8s` at $168\text{h}$), the unconditional probability that Repo B had *any* commit in a 168-hour window was already `0.6964` (`lift = 0.99x`) and `0.9890` (`lift = 1.01x`). A warning that fires on 94% of upstream commits to announce that an actively maintained downstream SDK will receive *some* commit within the next 7 days carries zero information value (`lift ~ 1.0x`).

---

## 6. Human Usefulness Audit of Sampled Predictions

We audited 15 concrete predictions emitted during the held-out evaluation split across the three pairs (5 per pair) against the preregistered 4-level usefulness rubric in [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md):

| # | Pair ID | Upstream Commit (`t_A`) & Subject | Triggered From (`f_A`) → Suggested (`f_B`) | Outcome in $(t_A, t_A + \Delta]$ | Rubric Classification | Audit Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `stripe` (`72h`) | `63fcf17ef3` (`2026-06-23T22:37Z`)<br>*"Update fixture data"* | `openapi/fixtures3.json` → `src/stripe.core.ts` (`shared 8/19`, low `0.231`) | Hit (`f96a3a0002`, $+6.1\text{h}$) | **Irrelevant or misleading** | Upstream fixture dump happened 6h before a general SDK core update (`f96a3a0002`); fixture changes do not require manual edits to `stripe.core.ts`. |
| 2 | `stripe` (`72h`) | `f4ac6d9a7f` (`2026-06-23T22:37Z`)<br>*"Update OpenAPI specification for GA and public preview"* | `openapi/spec3.json` → `src/stripe.core.ts` (`shared 13/31`, low `0.264`) | Hit (`f96a3a0002`, $+6.1\text{h}$) | **Interesting historical correlation, not actionable** | Same downstream commit `f96a3a0002` credited a second time 1 second later; `stripe.core.ts` is updated during releases, not per-endpoint spec edits. |
| 3 | `stripe` (`72h`) | `46c4473bf1` (`2026-06-25T03:11Z`)<br>*"Update OpenAPI specification for private preview"* | `openapi/spec3.private_preview.sdk.json` → `src/stripe.core.ts` (`shared 65/232`, low `0.226`) | Miss (no match) | **Irrelevant or misleading** | Private-preview spec snapshot has no impact on public `stripe-node` core runtime. |
| 4 | `stripe` (`168h`) | `63fcf17ef3` (`2026-06-23T22:37Z`)<br>*"Update fixture data"* | `openapi/fixtures3.beta.json` → `src/RequestSender.ts`, `src/Types.d.ts` (`shared 22/56`) | Miss (no match) | **Irrelevant or misleading** | Beta fixture data has no causal relationship to HTTP `RequestSender.ts`. |
| 5 | `stripe` (`168h`) | `bc0062b49f` (`2026-06-25T19:10Z`)<br>*"Update OpenAPI specification for private preview"* | `openapi/spec3.private_preview.sdk.json` → `src/stripe.core.ts`, `src/stripe.esm.node.ts`, `src/utils.ts` | Miss (no match) | **Irrelevant or misleading** | Pure cadence noise from high-frequency upstream spec dumps paired with high-frequency SDK entrypoint files. |
| 6 | `otel` (`72h`) | `3b93166f82` (`2026-08-28T19:11Z`)<br>*"Move attribute examples to latest semconv. (#853)"* | `opentelemetry/proto/trace/v1/trace.proto` → `.../EnvironmentConfigProvider.ts` (`shared 3/4`) | Miss (no match) | **Irrelevant or misleading** | Doc/example comment move in `trace.proto` has zero impact on JS `EnvironmentConfigProvider.ts`. |
| 7 | `otel` (`72h`) | `bb8796bff6` (`2026-09-02T13:56Z`)<br>*"Add `since <version>` requirement to new proto fields and backfill (#854)"* | `opentelemetry/proto/metrics/v1/metrics.proto` → `.../EnvironmentConfigProvider.ts` (`shared 3/5`) | Miss (no match) | **Irrelevant or misleading** | Proto comment/version-annotation policy backfill does not affect JS environment configuration. |
| 8 | `otel` (`168h`) | `9bff3f876f` (`2026-09-29T05:16Z`)<br>*"Fix typo in metrics.proto comment (#872)"* | `opentelemetry/proto/metrics/v1/metrics.proto` → `.../EnvironmentConfigProvider.ts` (`shared 4/6`) | Miss (no match) | **Irrelevant or misleading** | Comment typo fix in `metrics.proto` triggered a cross-repo warning on an unrelated experimental JS file. |
| 9 | `otel` (`168h`) | `3b93166f82` (`2026-08-28T19:11Z`) (`explicit_ref`) | `opentelemetry/proto/trace/v1/trace.proto` → `.../EnvironmentConfigProvider.ts` (`shared 4/4`) | Miss (no match) | **Irrelevant or misleading** | Shared generic token `opentelemetry` allowed `explicit_ref` to pair `trace.proto` with `EnvironmentConfigProvider.ts`. |
| 10 | `otel` (`168h`) | `bb8796bff6` (`2026-09-02T13:56Z`) (`explicit_ref`) | `opentelemetry/proto/trace/v1/trace.proto` → `.../EnvironmentConfigProvider.ts` (`shared 4/4`) | Miss (no match) | **Irrelevant or misleading** | Same spurious small-sample pairing (`4/4` in training, `0/3` in evaluation). |
| 11 | `k8s` (`168h` `all`) | `316b0b064a` (`2026-07-18T00:00Z`)<br>*"add workload config building blocks API types"* | `staging/src/k8s.io/api/scheduling/v1alpha3/types.go` → `applyconfigurations/internal/internal.go` | Hit (`f2ffee48ce`, $+16.8\text{h}$) | **Known automated synchronization** | `applyconfigurations/internal/internal.go` is a generated client-go artifact synced automatically by Kubernetes codegen/publishing bots. |
| 12 | `k8s` (`168h` `all`) | `3c20ae3c47` (`2026-07-21T16:06Z`)<br>*"KEP-5729: Promote DRAWorkloadResourceClaims to beta"* | `staging/.../podgrouptemplate.go` → `applyconfigurations/internal/internal.go` | Hit (`16f6ccdf67`, $+40.4\text{h}$) | **Known automated synchronization** | Downstream hit is automated staging-to-mirror synchronization of generated applyconfiguration code. |
| 13 | `k8s` (`168h` `manual`) | `b8d76348fa` (`2026-09-03T18:00Z`)<br>*"validation-gen: Let deep-equal func be set by tag"* | `staging/.../zz_generated.validations.go` → `tools/events/event_broadcaster.go`, `event_recorder.go` | Miss (no match) | **Irrelevant or misleading** | Coincidental training-window overlap between validation codegen and `tools/events/*`; completely unrelated. |
| 14 | `k8s` (`168h` `manual`) | `e060f3c2bc` (`2026-09-09T05:00Z`)<br>*"client-go: avoid holding the event broadcaster lock during EventSeries updates"* | `staging/src/k8s.io/client-go/tools/events/event_broadcaster.go` → `tools/events/event_broadcaster.go` | Miss (within $\le 50$-file stream) | **Known automated synchronization** | Even when the exact mirrored file path is predicted, `kubernetes/client-go` is a read-only bot mirror of `staging/src/k8s.io/client-go`—humans are forbidden from opening manual PRs against `client-go` directly. |
| 15 | `k8s` (`168h` `manual`) | `a114ef37c6` (`2026-09-23T14:54Z`)<br>*"api/certificates: update CertificateSigningRequest usages field documentation..."* | `staging/.../certificates/v1/types_swagger_doc_generated.go` → `tools/events/event_broadcaster.go` | Miss (no match) | **Irrelevant or misleading** | Certificate doc comment update has no relationship to `event_broadcaster.go`. |

**Audit Summary:**
- **Actionable review question:** `0 / 15` (`0.0%`)
- **Known automated synchronization:** `3 / 15` (`20.0%`)
- **Interesting historical correlation, not actionable:** `1 / 15` (`6.7%`)
- **Irrelevant or misleading:** `11 / 15` (`73.3%`)

---

## 7. Operational Cost & Commercial / GitHub Actions Architecture Analysis

### 7.1 Runtime & Resource Costs

| Pair ID | Upstream / Downstream Commits | `git log` Subprocess Calls | GitHub API Requests | Wall-Clock Runtime (12 Runs + Shuffled Controls) |
| :--- | ---: | ---: | ---: | ---: |
| `stripe-openapi-to-node` | 1,128 / 157 | 2 | 0 | `474 ms` |
| `otel-proto-to-js` | 43 / 357 | 2 | 0 | `36 ms` |
| `k8s-staging-to-client-go` | 687 / 95 | 2 | 0 | `882 ms` |
| **Total (36 configurations)** | **1,858 / 609** | **6** | **0** | **`1,392 ms` (`1.39 s`)** |

While local CPU/memory cost is negligible (`1.39 s` total once bare histories are available), the **deployment and permission barriers** in real customer environments are severe:

### 7.2 Why Cross-Repository Coupling Breaks Gutter's Zero-Config Action Model

1. **`GITHUB_TOKEN` Single-Repository Boundary:**
   - Gutter's core adoption advantage (`lbrodie11/gutter@v0`) is that it runs inside a single repository's pull-request workflow using the default, ephemeral `GITHUB_TOKEN` (`permissions: pull-requests: write, contents: read`) with **zero external secrets or app installations**.
   - GitHub's default `GITHUB_TOKEN` cannot read private sibling repositories (`org/backend-api` vs. `org/web-client`).
2. **High Onboarding Friction for Multi-Repo Access:**
   - Supporting cross-repository analysis in private organizations requires customers to either:
     - Provision and rotate a cross-repository Fine-Grained PAT or Organization GitHub App installation token (`repo` / `contents: read` across multiple repos), **and**
     - Maintain an explicit cross-repository mapping configuration declaring which upstream/downstream repositories pair together and cloning multiple histories on every PR run.
3. **Commercial Verdict:**
   - Asking engineering teams to grant multi-repository read tokens and configure repo-pair manifests is only defensible if the resulting warnings are **highly specific and low-noise ($\ge 60\%$ precision, $\ge 1.5\times$ lift over popularity)**.
   - Delivering a `10.6%`–`37.4%` precision signal that loses to a `+45d` shuffled timestamp control (`0.29x`–`0.69x` lift) and fires `34`–`80` times per month would immediately erode trust in Gutter's single-repository PR brief.

### 7.3 Narrow Condition for Future Re-Evaluation (Static Contract Diffing, Not Temporal Windows)

If cross-repository impact analysis is ever revisited in a future milestone, **do not use commit-timestamp window correlation**:
- Instead, require **explicit static contract linkage**: parse structured schema diffs in Repo A (e.g., removed/renamed OpenAPI operation IDs, GraphQL fields, or Protobuf message fields—filtering out comment-only commits like `otel` `#853`/`#872`) and match them deterministically against static symbol/endpoint references in Repo B's AST.
- Until such a static contract analyzer exists and proves $\ge 60\%$ precision on held-out changes, Gutter and Repo Archaeology should remain strictly single-repository tools.
