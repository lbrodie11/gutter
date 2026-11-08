# GU-27 · Cross-Repository Coupling Experimental Methodology

**Status:** Preregistered prior to evaluation run (2026-11-08)

---

## 1. Methodological Objective

Determine whether historical cross-repository change relationships between an upstream repository $A$ and a downstream repository $B$ can produce **actionable, sufficiently precise, low-noise review questions** at pull-request review time $t$ — using strictly information available at or before $t$.

> **Core discipline:** Temporal proximity between commits in two repositories does **not** prove a dependency, an overlooked change, or a bug. The experiment separates:
> 1. **Historical alignment** (did $A$ and $B$ change within $\Delta$ hours historically?),
> 2. **Prospective prediction** (given only history fully observed before time $t$, can we predict what changes in $B$ during $(t, t + \Delta]$?), and
> 3. **Human actionability** (would a warning issued at time $t$ help a human reviewer catch an uncoordinated omission, rather than merely echoing a scheduled codegen or mirror bot?).

---

## 2. Prediction Unit, As-Of-Time Causality ($t$), and Right-Censoring

### 2.1 Prediction Timestamp ($t$)
Let $e_A = (\text{sha}_A, t_A^{\text{author}}, t_A^{\text{commit}}, F_A, \text{meta}_A)$ be an eligible commit in repository $A$ touching at least one eligible upstream file $F_A \neq \emptyset$ (and touching at most `maxFiles = 50` files to exclude sweeping repo-wide reformat commits).

- **Primary event clock:** Committer timestamp $t = t_A^{\text{commit}}$ (UTC epoch seconds), which reflects when the change landed in the branch history.
- **Timestamp anomaly tracking:** For every commit in $A$ and $B$, we record both $t^{\text{author}}$ and $t^{\text{commit}}$. Any commit with $|t^{\text{commit}} - t^{\text{author}}| > 86,400\text{s}$ ($24\text{h}$) or where $t^{\text{commit}}$ decreases relative to its parent is counted under `timestampAnomalies`.

### 2.2 Strict No-Future-Leakage Training Rule at Time $t$
When issuing a prediction for an upstream event $e_A$ at time $t$ for horizon $\Delta \in \{24\text{h}, 72\text{h}, 168\text{h}\}$:

1. **Completed upstream training events only:** A prior upstream event $e_{A,i}$ at time $t_i$ is eligible for training at time $t$ **if and only if** its entire outcome window has closed by time $t$:
   $$t_i + \Delta \le t$$
   If $t_i < t < t_i + \Delta$, the window $(t_i, t_i + \Delta]$ is still open at time $t$; using outcomes from $(t, t_i + \Delta]$ would leak future downstream activity into time $t$, and truncating the window to $(t_i, t]$ would bias negative counts. Therefore, only completed historical windows ($t_i + \Delta \le t$) enter the training table at time $t$.
2. **Downstream history visibility:** Baseline file frequencies and recency scores at time $t$ use only downstream commits $e_{B,j}$ with $t_{B,j}^{\text{commit}} \le t$.
3. **As-of-time rule for explicit references:** Any cross-repository reference (`owner/repo#num`, commit SHA, or shared schema/path identifier) extracted from commit messages or paths at prediction time $t$ may only inspect $e_A$'s own commit metadata at time $t$ and historical commits with timestamps $\le t$. A downstream PR or commit message created at $t_B > t$ that references $e_A$ is **never** visible as a feature at prediction time $t$.

### 2.3 Right-Censoring at Observation Boundary $T_{\text{end}}$
Let $[T_{\text{start}}, T_{\text{end}}]$ be the pair's observation window. Any upstream event $e_A$ with:
$$t_A + \Delta > T_{\text{end}}$$
does not have a full $\Delta$-hour future window inside the dataset. Such events are flagged `rightCensored = true`, counted in the report under `censoredEvents`, and **excluded** from completed-outcome precision/hit-rate denominators.

---

## 3. Chronological Partitioning & Embargo Intervals

For each repository pair, the ordered timeline $[T_{\text{start}}, T_{\text{end}}]$ is partitioned chronologically with a mandatory embargo of $\Delta_{\max} = 168\text{h}$ ($7$ days) between splits so that no outcome window from an earlier split overlaps a later split:

1. **Warmup / Initial Training Split ($60\%$ of timeline):** $[T_{\text{start}}, T_{\text{train}}]$
2. **Embargo 1 ($168\text{h}$):** $(T_{\text{train}}, T_{\text{train}} + 168\text{h}]$ — upstream events in this buffer are not scored in tuning because their $168\text{h}$ windows cross the boundary.
3. **Tuning Split ($15\%$ of timeline):** $(T_{\text{train}} + 168\text{h}, T_{\text{tune}}]$ — used only to inspect hyperparameter sanity (`minShared = 3`, `minWilsonLow = 0.20`, `topK = 3`).
4. **Embargo 2 ($168\text{h}$):** $(T_{\text{tune}}, T_{\text{tune}} + 168\text{h}]$
5. **Held-Out Final Evaluation Split (final $25\%$ of timeline):** $(T_{\text{tune}} + 168\text{h}, T_{\text{end}} - \Delta]$ (with $(T_{\text{end}} - \Delta, T_{\text{end}}]$ recorded as right-censored).

During the held-out evaluation split, the model updates walk-forward using all completed historical windows ($t_i + \Delta \le t_A$) prior to each test event $t_A$, matching how Gutter would operate in production. Thresholds are **frozen** prior to running the held-out split.

---

## 4. Two Alert Granularities: Repository-Level vs. File-Level

Following Section 6 of the GU-27 review, we evaluate two distinct product surfaces separately:

1. **Repository-Level Alert (Lower Specificity):**
   - *Question:* When an upstream commit $e_A$ touches files that have historically preceded Repo B activity ($\ge 3$ prior completed windows with Wilson lower bound $\ge 0.25$ and lift $> 1.2\times$ over Repo B's background $\Delta$-window active probability), does **any** eligible file in Repo B change during $(t_A, t_A + \Delta]$?
2. **File-Level Alert (Higher Specificity, Top-$K$ with $K = 3$):**
   - *Question:* Given $e_A$, the predictor ranks candidate downstream files $b \in \text{Repo B}$ that have co-occurred in $(t_i, t_i + \Delta]$ across at least `minShared = 3` prior completed upstream commits of $a \in F_A$, requiring Wilson lower bound $W_{\text{low}}(k_{a \to b}, n_a) \ge 0.20$ and lift $\ge 1.5\times$ over $b$'s marginal $\Delta$-window probability. The top $K = 3$ candidate files $\hat{F}_B(e_A)$ are emitted.
   - *Outcome:* A file suggestion $b \in \hat{F}_B(e_A)$ is a **true match** if $b$ is modified in at least one Repo B commit in $(t_A, t_A + \Delta]$.

### 4.1 Deduplication of Many-to-Many Relationships
- **Within-window downstream deduplication:** If file $b$ is modified multiple times in Repo B within $(t_A, t_A + \Delta]$, it counts as at most **one** hit for $(e_A, b)$.
- **Shared downstream commit attribution (`uniqueDownstreamCommitHits`):** When multiple upstream commits $e_{A,1}, e_{A,2}$ occur close together and their $(t_A, t_A + \Delta]$ windows match the *same* downstream commit $e_B$, standard per-query scoring counts both queries, which can inflate apparent sample size during release bursts. We therefore explicitly track:
  1. **Deduplicated unique downstream commits matched**, and
  2. **Time-block / release-cluster bootstrap confidence intervals** (grouping upstream events into non-overlapping $7$-day release blocks so clustered warnings within the same week are resampled together as a single unit).

---

## 5. Alignment Methods Compared

1. **`temporal` (Prospective Time-Window Alignment at $\Delta \in \{24\text{h}, 72\text{h}, 168\text{h}\}$):**
   - Uses empirical directional follow-up counts $k_{a \to b} / n_a$ from completed historical windows $t_i + \Delta \le t_A$, ranked by Wilson 95% lower bound $W_{\text{low}}(k_{a \to b}, n_a)$.
2. **`explicit_ref` (Explicit Reference & Shared Contract Stem Alignment, As-Of-Time Safe):**
   - Restricts candidate pairs $(a, b)$ to those that **either**:
     - Have a historical explicit cross-repo commit/PR/version reference observed prior to $t_A$, **or**
     - Share a canonical normalized domain/contract identifier known at time $t_A$ (for example, `staging/src/k8s.io/client-go/<subpath>` $\leftrightarrow$ `<subpath>` in `client-go`, `logs.proto` / `trace.proto` / `metrics.proto` stem tokens $\leftrightarrow$ `otlp` log/trace/metric files, or OpenAPI resource stems in `stripe-node` `src/resources/<stem>.ts`) backed by prior co-change evidence before $t_A$.

---

## 6. Baselines and Negative Controls

Every method and horizon $\Delta$ is compared against four controls evaluated on the **exact same set of fired upstream events**:

1. **`popular_baseline` (Activity-Matched Popular Files):** Emits the $K$ downstream files most frequently modified in Repo B up to time $t_A$ (matching the exact number of suggestions emitted by the predictor on each fired event).
2. **`recent_baseline` (Recency Baseline):** Emits the $K$ downstream files most recently modified in Repo B at or before time $t_A$.
3. **`shuffled_control` (Shuffled-Time Negative Control):** Circularly shifts all Repo B commit timestamps by $+3,888,000\text{s}$ ($+45$ days modulo the observation window span), preserving Repo B's exact commit frequency, burst structure, and within-repo file co-changes while breaking genuine cross-repository synchronization, then re-runs the full training and evaluation pipeline.
4. **`explicit_only` Control:** Evaluates whether explicit/shared-identifier links alone outperform unconstrained temporal windows.

---

## 7. Confounder & Change-Origin Classification

Every commit and file touch is deterministically classified into one of five categories:

| Category | Detection Rule |
|---|---|
| `mirrored` | Author/committer or subject matches known mirror automation (`k8s-publishing-bot`, `sync-openapi-`, `mirror`, `staging/src/k8s.io/` automated sync) |
| `generated` | Path or commit subject matches generated code conventions (`zz_generated.`, `.pb.go`, `generated.`, `applyconfigurations/`, `openapi/spec3`, `latest/openapi.spec3`, `src/resources/` in `stripe-node` with `Update generated code` / OpenAPI codegen commits) |
| `dependency_or_version` | Path or subject is a version/dependency bump (`package.json`, `package-lock.json`, `go.mod`, `go.sum`, `src/apiVersion.ts`, `CHANGELOG.md`, `version.ts`, `Bump `, `chore(deps)`) |
| `bot` | Author/committer matches `dependabot`, `renovate`, `[bot]`, `github-actions` (when not already classified above) |
| `manual` | All remaining human-authored source, schema, and test changes |

Metrics are reported both for **all eligible downstream files (`all`)** and **restricted to `manual` downstream files (`manual_only`)**.
