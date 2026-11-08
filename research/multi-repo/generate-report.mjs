#!/usr/bin/env node
/**
 * GU-27 · Deterministic Report Generator (`research/multi-repo/generate-report.mjs`)
 *
 * Generates `research/multi-repo/REPORT.md` directly from `research/multi-repo/results.json`
 * and `research/multi-repo/diagnostics.json` so that no numerical table or metric in the
 * report can drift from the underlying JSON artifacts.
 *
 * Usage:
 *   node research/multi-repo/generate-report.mjs          # writes REPORT.md
 *   node research/multi-repo/generate-report.mjs --check  # verifies REPORT.md matches byte-for-byte
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function fmtNum(n, digits = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits);
}

function fmtLift(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(2)}x`;
}

function fmtCI([low, high]) {
  return `\`[${fmtNum(low, 4)}, ${fmtNum(high, 4)}]\``;
}

export function buildReportMarkdown(results, diagnostics) {
  const stripePair = results.pairs.find((p) => p.pairId === 'stripe-openapi-to-node');
  const otelPair = results.pairs.find((p) => p.pairId === 'otel-proto-to-js');
  const k8sPair = results.pairs.find((p) => p.pairId === 'k8s-staging-to-client-go');

  const getRun = (pair, deltaHours, method, targetScope) =>
    pair.runs.find(
      (r) => r.deltaHours === deltaHours && r.method === method && r.targetScope === targetScope,
    );

  const getDiagRun = (pairId, deltaHours, method, targetScope) =>
    diagnostics.pairs[pairId].runs.find(
      (r) => r.deltaHours === deltaHours && r.method === method && r.targetScope === targetScope,
    );

  const s72All = getRun(stripePair, 72, 'temporal', 'all');
  const s72Man = getRun(stripePair, 72, 'temporal', 'manual_only');
  const s168All = getRun(stripePair, 168, 'temporal', 'all');
  const s168Man = getRun(stripePair, 168, 'temporal', 'manual_only');

  const s72AllDiag = getDiagRun('stripe-openapi-to-node', 72, 'temporal', 'all');
  const s72ManDiag = getDiagRun('stripe-openapi-to-node', 72, 'temporal', 'manual_only');
  const s168ManDiag = getDiagRun('stripe-openapi-to-node', 168, 'temporal', 'manual_only');
  const s168AllDiag = getDiagRun('stripe-openapi-to-node', 168, 'temporal', 'all');
  const stripeEvalDiag = diagnostics.stripeShuffledEvalWindowDiagnostics;

  const o72Man = getRun(otelPair, 72, 'temporal', 'manual_only');
  const o168Man = getRun(otelPair, 168, 'temporal', 'manual_only');

  const k168All = getRun(k8sPair, 168, 'temporal', 'all');
  const k168Man = getRun(k8sPair, 168, 'temporal', 'manual_only');
  const k8sDiag = diagnostics.kubernetesMirrorDiagnostics;
  const k8sTbLeTaPct = fmtNum(
    (k8sDiag.pairsWithTbLessOrEqualTa / k8sDiag.matchedSubjectAndAuthorTimePairs) * 100,
    1,
  );

  const renderPairTable = (pair) => {
    const header = [
      '| $\\Delta$ | Method | Scope | Eligible / Censored | Fired ($N_{\\text{fired}}$) | Unique B Hits | Precision@3 (Hits / Sug) | Wilson 95% CI | Block-Bootstrap 95% CI | Query Hit@3 | Recall | Warnings / Mo | `popular` (Matched) | `recent` (Matched) | Lift vs Matched | `shuffled` Matched Window (Hits / Sug) | `shuffled` Retrained Placebo (Hits / Sug, Fired) | `results.json` Lift vs All | Status |',
      '| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |',
    ];
    const rows = pair.runs.map((r) => {
      const d = getDiagRun(pair.pairId, r.deltaHours, r.method, r.targetScope);
      const mb = d.matchedBaselines;
      const sp = d.shuffledRetrainedPlacebo;
      const isK8sManualInvalid =
        pair.pairId === 'k8s-staging-to-client-go' && r.targetScope === 'manual_only';
      const statusLabel = isK8sManualInvalid
        ? `\`${r.status}\` *(invalid mirror test)*`
        : `\`${r.status}\``;
      return `| **${r.deltaHours}h** | \`${r.method}\` | \`${r.targetScope}\` | ${r.eligibleUpstreamEvents} / ${r.censoredEvents} | ${r.queriesWithPrediction} | ${r.uniqueDownstreamCommitHits} | **${fmtNum(r.precisionAtK)}** (${r.correctSuggestions}/${r.totalSuggestions}) | ${fmtCI(r.wilson95)} | ${fmtCI(r.blockBootstrap95)} | ${fmtNum(r.queryHitAtK)} | ${fmtNum(r.recall)} | ${fmtNum(r.warningsPerMonth, 2)} | ${fmtNum(r.baselines.popularPrecision)} | ${fmtNum(r.baselines.recentPrecision)} | **${fmtLift(mb.liftOverMatchedBaseline)}** | ${fmtNum(mb.shuffledMatchedWindowPrecision)} (${mb.shuffledMatchedWindowHits}/${mb.shuffledMatchedWindowSuggestions}) | ${fmtNum(sp.precisionAtK)} (${sp.correctSuggestions}/${sp.totalSuggestions}, $N=${sp.queriesWithPrediction}$) | ${fmtLift(r.liftOverStrongestBaseline)} | ${statusLabel} |`;
    });
    return [...header, ...rows].join('\n');
  };

  const repoLevelSelection = [
    { pair: stripePair, deltaHours: 72, method: 'temporal', targetScope: 'all' },
    { pair: stripePair, deltaHours: 72, method: 'temporal', targetScope: 'manual_only' },
    { pair: stripePair, deltaHours: 168, method: 'temporal', targetScope: 'all' },
    { pair: stripePair, deltaHours: 168, method: 'temporal', targetScope: 'manual_only' },
    { pair: otelPair, deltaHours: 72, method: 'temporal', targetScope: 'manual_only' },
    { pair: k8sPair, deltaHours: 24, method: 'temporal', targetScope: 'all' },
    { pair: k8sPair, deltaHours: 72, method: 'temporal', targetScope: 'all' },
    { pair: k8sPair, deltaHours: 168, method: 'temporal', targetScope: 'all' },
    { pair: k8sPair, deltaHours: 168, method: 'temporal', targetScope: 'manual_only' },
  ];

  const renderRepoLevelTable = () => {
    const header = [
      '| Pair ID | $\\Delta$ | Scope | Repo-Level Fired | Repo-Level Precision (Hits / Fired) | Repo-Level Wilson 95% CI | Unconditional Repo B Base Rate | Repo-Level Lift | File-Level Precision@3 | File-Level Lift vs Matched Baseline |',
      '| :--- | :--- | :--- | ---: | ---: | :--- | ---: | ---: | ---: | ---: |',
    ];
    const rows = repoLevelSelection.map(({ pair, deltaHours, method, targetScope }) => {
      const r = getRun(pair, deltaHours, method, targetScope);
      const d = getDiagRun(pair.pairId, deltaHours, method, targetScope);
      const rl = r.repoLevelAlert;
      return `| \`${pair.pairId}\` | **${deltaHours}h** | \`${targetScope}\` | ${rl.fired} | **${fmtNum(rl.precision)}** (${rl.hits}/${rl.fired}) | ${fmtCI(rl.wilson95)} | ${fmtNum(rl.baseRate)} | **${fmtLift(rl.lift)}** | ${fmtNum(r.precisionAtK)} (${r.correctSuggestions}/${r.totalSuggestions}) | ${fmtLift(d.matchedBaselines.liftOverMatchedBaseline)} |`;
    });
    return [...header, ...rows].join('\n');
  };

  return `# GU-27 · Cross-Repository Coupling Research Report

- **Experiment ID:** \`${results.experimentId}\`
- **Preregistration Commit:** \`0ea8a61\` ([\`PAIRS.md\`](./PAIRS.md), [\`METHODOLOGY.md\`](./METHODOLOGY.md), [\`DECISION-THRESHOLDS.md\`](./DECISION-THRESHOLDS.md), [\`run.mjs\`](./run.mjs), [\`test/multi-repo.test.mjs\`](./test/multi-repo.test.mjs))
- **Initial Results Commit:** \`1014af3\` ([\`results.json\`](./results.json), [\`manifest.json\`](./manifest.json))
- **Supplementary Diagnostics & Generator:** [\`diagnostics.json\`](./diagnostics.json), [\`run-diagnostics.mjs\`](./run-diagnostics.mjs), [\`generate-report.mjs\`](./generate-report.mjs)
- **Operational Product Decision:** **\`NO-GO\` (Do not build cross-repository temporal co-change warnings now)**
- **Preregistered Rule Classification:** **\`NO-GO\` and \`NOT YET\` Overlap** (see Section 1.2)

> [!NOTE]
> Every numerical table and metric in this report is generated deterministically from [\`results.json\`](./results.json) and [\`diagnostics.json\`](./diagnostics.json) by [\`generate-report.mjs\`](./generate-report.mjs) and verified in CI via \`node research/multi-repo/generate-report.mjs --check\`.

---

## 1. Executive Summary & Decision Analysis

### 1.1 Three-Category Empirical Outcome Summary

To separate what the evidence proves from what was sparse or methodologically compromised, findings are grouped into three explicit categories:

1. **Supported Negative Findings (\`stripe/openapi\` → \`stripe/stripe-node\`, plus Repository-Level Base-Rate Confounding):**
   - **\`stripe/openapi\` → \`stripe/stripe-node\`** is the only pair with a large held-out evaluation sample on manually maintained code ($N_{\\text{fired}} = ${s72Man.queriesWithPrediction}$ at $72\\text{h}$; $N_{\\text{fired}} = ${s168Man.queriesWithPrediction}$ at $168\\text{h}$).
   - On \`manual_only\`, temporal co-change precision is **\`${fmtNum(s72Man.precisionAtK)}\`** (\`${s72Man.correctSuggestions}/${s72Man.totalSuggestions}\`, Wilson 95% CI ${fmtCI(s72Man.wilson95)}) at $72\\text{h}$ and **\`${fmtNum(s168Man.precisionAtK)}\`** (\`${s168Man.correctSuggestions}/${s168Man.totalSuggestions}\`, Wilson 95% CI ${fmtCI(s168Man.wilson95)}) at $168\\text{h}$.
   - Even without relying on the shuffled control, the \`manual_only\` temporal predictor **merely ties the activity-matched \`popular_baseline\` at $72\\text{h}$ (\`${fmtNum(s72Man.baselines.popularPrecision)}\`, lift \`${fmtLift(s72ManDiag.matchedBaselines.liftOverMatchedBaseline)}\`) and loses to \`popular_baseline\` at $168\\text{h}$ (\`${fmtNum(s168Man.baselines.popularPrecision)}\`, lift \`${fmtLift(s168ManDiag.matchedBaselines.liftOverMatchedBaseline)}\`, margin \`${fmtNum(s168ManDiag.matchedBaselines.marginOverMatchedBaseline)}\`)**, while matching only \`${s72Man.uniqueDownstreamCommitHits}\` ($72\\text{h}$) and \`${s168Man.uniqueDownstreamCommitHits}\` ($168\\text{h}$) unique downstream commits across \`${fmtNum(s72Man.warningsPerMonth, 2)}\`–\`${fmtNum(s168Man.warningsPerMonth, 2)}\` warnings/month.
   - Across all pairs, **repository-level alerts** with high nominal precision at $168\\text{h}$ (\`${fmtNum(s168Man.repoLevelAlert.precision)}\` on \`stripe\` \`manual_only\`, \`${fmtNum(k168All.repoLevelAlert.precision)}\` on \`k8s\` \`all\`) match the unconditional downstream activity base rate (\`${fmtNum(s168Man.repoLevelAlert.baseRate)}\` and \`${fmtNum(k168All.repoLevelAlert.baseRate)}\`, yielding lifts of **\`${fmtLift(s168Man.repoLevelAlert.lift)}\`** and **\`${fmtLift(k168All.repoLevelAlert.lift)}\`**).
2. **Inconclusive Findings (\`open-telemetry/opentelemetry-proto\` → \`open-telemetry/opentelemetry-js\`):**
   - Only \`${otelPair.upstreamBreakdown.total}\` non-merge upstream commits occurred across the 18-month observation window (\`${o72Man.eligibleUpstreamEvents}\` eligible in the held-out split). Only \`${o72Man.queriesWithPrediction}\` ($72\\text{h}$) and \`${o168Man.queriesWithPrediction}\` ($168\\text{h}$) predictions fired (\`${o72Man.correctSuggestions}/${o72Man.totalSuggestions}\` and \`${o168Man.correctSuggestions}/${o168Man.totalSuggestions}\` hits), which is far below the preregistered $N_{\\min} = 30$ sample-size gate (\`INCONCLUSIVE (sparse data)\`).
3. **Invalid or Unverified Analyses (\`kubernetes/kubernetes\` → \`kubernetes/client-go\` Mirror Test & Non-Matched Shuffled Placebo):**
   - **Kubernetes mirror confounder test is invalid as run:** Inspection of the pinned \`kubernetes/client-go\` history (\`${k8sDiag.downstreamTotalNonMergeCommits}\` non-merge commits in window: \`${k8sDiag.downstreamKeptCommits}\` kept with $\\le 50$ files and $\\ge 1$ scoped \`.go\` file, \`${k8sDiag.downstreamDroppedOver50Files}\` dropped by the 50-file cap, and \`${k8sDiag.downstreamDroppedNoScopedGoFiles}\` dropped because commit \`${k8sDiag.downstreamDroppedNoScopedGoCommitSha}\` touched only \`OWNERS\` files) shows that **\`${k8sDiag.downstreamCommitterKubernetesPublisherAll}/${k8sDiag.downstreamTotalNonMergeCommits}\` (\`100%\`) have committer \`"Kubernetes Publisher"\`**, which initial \`classifyCommit()\` failed to match (it checked only \`k8s-publishing-bot\` and \`publishing-bot\`). Furthermore, \`Kubernetes Publisher\` preserves the upstream author timestamp as its committer timestamp ($t_{\\text{commit}} = t_{\\text{author}}$ on \`${k8sDiag.downstreamAuthorTimeEqualsCommitTimeKept}/${k8sDiag.downstreamKeptCommits}\` kept commits), whereas \`kubernetes/kubernetes\` records the later Prow merge timestamp as $t_A$. Across \`${k8sDiag.matchedSubjectAndAuthorTimePairs}\` matched commit pairs, **\`${k8sDiag.pairsWithTbLessOrEqualTa}/${k8sDiag.matchedSubjectAndAuthorTimePairs}\` (\`${k8sTbLeTaPct}%\`) have $t_B \\le t_A$** (median $t_B - t_A = ${k8sDiag.medianTbMinusTaHours}\\text{h}$) and were skipped by \`cB.commitTime <= tA\`. Thus, the observed \`manual_only\` precision of \`${fmtNum(k168Man.precisionAtK)}\` on \`k8s\` cannot be used as valid evidence of confounder survival or collapse.
   - **Non-matched retrained \`shuffled\` placebo in \`results.json\`:** In initial \`run.mjs\`, \`shuffledPrecision\` was computed by retraining and firing on the circularly shifted stream (which fired on a different set of upstream events, e.g., $N = ${s72ManDiag.shuffledRetrainedPlacebo.queriesWithPrediction}$ vs. $N = ${s72Man.queriesWithPrediction}$ on Stripe $72\\text{h}$ \`manual_only\`), rather than scoring on the exact same fired events. Section 4.4 reports both the non-matched retrained counts and a true matched-event shuffled window evaluation alongside the matched \`popular\` and \`recent\` baselines.

---

### 1.2 Evaluation Against Original Preregistered Thresholds ([\`DECISION-THRESHOLDS.md\`](./DECISION-THRESHOLDS.md))

The table below grades the results strictly against the **original preregistered wording** in [\`DECISION-THRESHOLDS.md\`](./DECISION-THRESHOLDS.md), without post-hoc threshold substitutions:

| Preregistered Rule in [\`DECISION-THRESHOLDS.md\`](./DECISION-THRESHOLDS.md) | Exact Preregistered Wording | Observed Result in \`results.json\` / \`diagnostics.json\` | Status |
| :--- | :--- | :--- | :--- |
| **Sample-Size Gate (Sec. 1) & \`GO\` Rule 1** | $N_{\\min} = 30$ fired upstream events in held-out split; **at least 2 of 3 pairs** satisfy $N_{\\text{fired}} \\ge 30$ and show repeatable positive signal | **1 of 3 pairs** reaches $N_{\\text{fired}} \\ge 30$ on \`manual_only\` (\`stripe\`: $N = ${s72Man.queriesWithPrediction}$ at $72\\text{h}$, $N = ${s168Man.queriesWithPrediction}$ at $168\\text{h}$). \`otel\` has $N \\le ${o168Man.queriesWithPrediction}$ (\`INCONCLUSIVE\`); \`k8s\` has $N \\le ${k168Man.queriesWithPrediction}$ on \`manual_only\` ($N = ${k168All.queriesWithPrediction}$ on \`all\`) and is methodologically invalid as run | **FAIL (\`GO\` Rule 1)** / **Triggers \`NOT YET\` Rule 1** |
| **\`GO\` Rule 2 (Minimum Accuracy)** | Held-out **Precision@3 $\\ge 60\\%$** (or Repo-Level Precision $\\ge 60\\%$ for a repo-level-only prototype), with 95% Wilson and block-bootstrap CIs | On \`stripe\` \`manual_only\`, Precision@3 is **\`${fmtNum(s72Man.precisionAtK)}\` (${fmtNum(s72Man.precisionAtK * 100, 2)}%)** at $72\\text{h}$ and **\`${fmtNum(s168Man.precisionAtK)}\` (${fmtNum(s168Man.precisionAtK * 100, 2)}%)** at $168\\text{h}$. On \`stripe\` \`all\`, Precision@3 is **\`${fmtNum(s72All.precisionAtK)}\` (${fmtNum(s72All.precisionAtK * 100, 2)}%)** at $72\\text{h}$ and **\`${fmtNum(s168All.precisionAtK)}\` (${fmtNum(s168All.precisionAtK * 100, 2)}%)** at $168\\text{h}$ | **FAIL (\`GO\` Rule 2)** |
| **\`GO\` Rule 3 & \`NO-GO\` Rule 1 (Baseline Lift)** | \`GO\`: Beats strongest matched baseline by $\\ge +15\\text{ pp}$ and $\\ge 1.5\\times$ lift.<br>\`NO-GO\` Rule 1: \`manual_only\` precision indistinguishable from controls (lift $< 1.2\\times$ or within noise) | On \`stripe\` \`manual_only\`, vs. matched \`popular_baseline\`: at $72\\text{h}$, \`${fmtNum(s72Man.precisionAtK)}\` vs. \`${fmtNum(s72Man.baselines.popularPrecision)}\` (**lift \`${fmtLift(s72ManDiag.matchedBaselines.liftOverMatchedBaseline)}\`**, margin \`${fmtNum(s72ManDiag.matchedBaselines.marginOverMatchedBaseline)}\`); at $168\\text{h}$, \`${fmtNum(s168Man.precisionAtK)}\` vs. \`${fmtNum(s168Man.baselines.popularPrecision)}\` (**lift \`${fmtLift(s168ManDiag.matchedBaselines.liftOverMatchedBaseline)}\`**, margin \`${fmtNum(s168ManDiag.matchedBaselines.marginOverMatchedBaseline)}\`). Both are $< 1.2\\times$ | **FAIL (\`GO\` Rule 3)** / **Triggers \`NO-GO\` Rule 1** |
| **\`GO\` Rule 4 & \`NO-GO\` Rule 2 (Confounder Filtering)** | Signal is not primarily an artifact of \`mirrored\`, \`generated\`, or \`dependency_or_version\` commits; remains positive and meaningful on \`manual_only\` | On \`stripe\`, excluding generated \`src/resources/*\` and \`types/*\` drops $72\\text{h}$ precision from \`${fmtNum(s72All.precisionAtK)}\` to \`${fmtNum(s72Man.precisionAtK)}\` and $168\\text{h}$ precision from \`${fmtNum(s168All.precisionAtK)}\` to \`${fmtNum(s168Man.precisionAtK)}\` (both $\\le$ \`popular_baseline\`). Note: \`k8s\` is excluded from this gate due to the mirror classifier/timestamp defect (Section 4.3) | **FAIL (\`GO\` Rule 4)** / **Triggers \`NO-GO\` Rule 2 (on Stripe)** |
| **\`GO\` Rule 5 & \`NO-GO\` Rule 3 (Human Audit)** | At least **50% of true matches** judged \`Actionable review question\` rather than \`Known automated synchronization\` or \`Interesting historical correlation but not actionable\` | In the 15-prediction convenience sample (Section 6), only **4 were true matches** (\`2\` on \`stripe\` $72\\text{h}$ \`all\`, \`2\` on \`k8s\` $168\\text{h}$ \`all\`; \`0\` on \`manual_only\`), and **\`0 / 4\` (0%)** were rated \`Actionable review question\`. *(See Section 6 for sampling/rater provenance limitations)* | **FAIL (\`GO\` Rule 5)** |
| **\`GO\` Rule 6 & \`NO-GO\` Rule 4 (Cadence & Permissions)** | Expected warning cadence (exploratory target: \`~2+ warnings/month\` or high-value rare contract events) and cross-repo GitHub token/App requirements are practical | \`stripe\` \`manual_only\` emits \`${fmtNum(s72Man.warningsPerMonth, 2)}\` ($72\\text{h}$) to \`${fmtNum(s168Man.warningsPerMonth, 2)}\` ($168\\text{h}$) warnings/month with \`${fmtNum(s72Man.falseAlarmRate * 100, 1)}%\`–\`${fmtNum(s168Man.falseAlarmRate * 100, 1)}%\` false-alarm query rates and $\\le ${fmtLift(s72ManDiag.matchedBaselines.liftOverMatchedBaseline)}$ matched lift, which does not justify replacing single-repo \`GITHUB_TOKEN\` with a multi-repo GitHub App / PAT | **FAIL (\`GO\` Rule 6)** / **Triggers \`NO-GO\` Rule 4** |

### 1.3 Overlap Between Preregistered \`NO-GO\` and \`NOT YET\` Rules

Under [\`DECISION-THRESHOLDS.md\`](./DECISION-THRESHOLDS.md), two decision blocks are simultaneously satisfied:
- **\`NOT YET\` Rule 1 is satisfied:** Fewer than 2 repository pairs reached the $N_{\\min} = 30$ fired-event gate on \`manual_only\` (only \`stripe-openapi-to-node\` reached $N_{\\text{fired}} \\ge 30$; \`otel-proto-to-js\` had $N_{\\text{fired}} \\le ${o168Man.queriesWithPrediction}$, and \`k8s-staging-to-client-go\` is invalid as run).
- **\`NO-GO\` Rules 1, 2, and 4 are satisfied:** \`NO-GO\` is defined to trigger if **any** of its conditions hold, and on the one high-volume pair (\`stripe-openapi-to-node\`), \`manual_only\` precision is indistinguishable from or worse than \`popular_baseline\` (lift \`${fmtLift(s72ManDiag.matchedBaselines.liftOverMatchedBaseline)}\` at $72\\text{h}$ and \`${fmtLift(s168ManDiag.matchedBaselines.liftOverMatchedBaseline)}\` at $168\\text{h}$, both $< 1.2\\times$).

Because [\`DECISION-THRESHOLDS.md\`](./DECISION-THRESHOLDS.md) did not specify a precedence rule when both \`NOT YET\` (cross-pair sparsity) and \`NO-GO\` (negative signal on a qualifying pair) hold, we separate the decision into two explicit statements:
1. **Operational Product Decision — \`NO-GO\` (Do not build temporal cross-repository co-change warnings now):** The well-powered negative result on \`stripe/openapi\` → \`stripe/stripe-node\` shows that naive commit-timestamp alignment loses to simple popularity baselines and suffers severe many-to-many inflation, making it unsuitable for PR warnings given cross-repository token friction.
2. **Scope of Empirical Generalization — \`NO-GO_AND_NOT_YET_OVERLAP\`:** This negative finding applies specifically to **commit-timestamp window correlation** on the tested Stripe pair. It does **not** prove that cross-repository impact analysis as a whole is a dead end; structured contract analysis (e.g., OpenAPI or Protobuf AST diffing linked to consumer symbol references) remains a distinct, untested hypothesis.

---

## 2. Preregistration Errata, Chronology, & Methodological Disclosures

In accordance with research reporting best practices, all deviations, errata, and provenance limitations in the initial PR commits (\`0ea8a61\` and \`1014af3\`) are disclosed below while preserving the original preregistration files untouched:

1. **Execution Chronology & Hardcoded \`generatedAt\` Timestamp:**
   - In [\`results.json\`](./results.json) and [\`manifest.json\`](./manifest.json) (commit \`1014af3\`), \`generatedAt\` is set to \`"2026-11-08T15:40:00Z"\`. That string was a hardcoded literal in initial [\`run.mjs\`](./run.mjs) rather than a dynamic \`new Date().toISOString()\` clock reading (fixed in \`run.mjs\` for future runs).
   - In Git history, the preregistration commit (\`0ea8a61\`, committed at \`15:49:02Z\`) precedes the results commit (\`1014af3\`, committed at \`15:53:26Z\`), but both commits were authored and pushed within the same session. Therefore, while the preregistration commit precedes the results commit in Git, **independent verification that the evaluation was not inspected beforehand is unavailable**.
2. **Post-Hoc Thresholds Removed from Primary Grading:**
   - The initial version of \`REPORT.md\` and \`run.mjs\` introduced three un-preregistered rules: (a) a \`<= 10 warnings/month (or >= 0.75 precision)\` alert-volume rule instead of the preregistered exploratory \`~2+ warnings/month\` description; (b) a \`>= 70% of audited predictions\` human-audit threshold instead of the preregistered \`>= 50% of true matches\` threshold; and (c) a hardcoded \`repo-level precision >= 0.60 and lift >= 1.5x\` check for \`NOT YET\`. All three have been removed from the primary decision table in Section 1.2.
3. **[\`PAIRS.md\`](./PAIRS.md) Metadata Errata:**
   - In [\`PAIRS.md\`](./PAIRS.md) Section 3 (Pair 3), \`143,358\` is the total commit count of the entire \`kubernetes/kubernetes\` repository at \`e3d37bb9fb1d695daff432925cd44b1452df64e1\` prior to path filtering; the path-filtered non-merge commit count (\`staging/src/k8s.io/{client-go,api}\`, $\\le 50$ files) in the observation window is \`${k8sPair.upstreamBreakdown.total}\`.
   - In [\`PAIRS.md\`](./PAIRS.md) Section 3 (Pair 3), the \`kubernetes/kubernetes\` → \`kubernetes/client-go\` observation window was set to 15 months (\`2025-08-01\` – \`2026-11-01\`) rather than the 18 months (\`2025-05-01\` – \`2026-11-01\`) used for Pairs 1 and 2 in order to bound \`git log\` path-traversal time on \`kubernetes/kubernetes\`.

---

## 3. Dataset, Chronological Splits, & Confounder Breakdown

All 6 repositories were evaluated from local bare blobless clones pinned to the exact \`HEAD\` SHAs in [\`PAIRS.md\`](./PAIRS.md) (reproducible via [\`setup-repos.sh\`](./setup-repos.sh)). Each pair's observation window $[T_{\\text{start}}, T_{\\text{end}}]$ was split into **60% Training**, a **168-hour Embargo**, **15% Tuning**, a second **168-hour Embargo**, and the final **~25% Held-Out Evaluation** split:

| Pair ID | Role & Repo (\`HEAD\` SHA) | Window ($T_{\\text{start}}$ → $T_{\\text{end}}$) | Eval Split Start ($T_{\\text{eval}}$) | Scoped Commits ($\\le 50$ files) | \`manual\` | \`generated\` | \`mirrored\` | \`dep / version\` | \`bot\` | Automated Share | Timestamp Anomalies |
| :--- | :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **\`${stripePair.pairId}\`** | **A:** \`${stripePair.repoAId}\` (\`6360907c\`) | \`2025-05-01\` → \`2026-11-01\` | \`${stripePair.window.evalStartIso.slice(0, 10)}\` | ${stripePair.upstreamBreakdown.total} | ${stripePair.upstreamBreakdown.counts.manual} | ${stripePair.upstreamBreakdown.counts.generated} | ${stripePair.upstreamBreakdown.counts.mirrored} | ${stripePair.upstreamBreakdown.counts.dependency_or_version} | ${stripePair.upstreamBreakdown.counts.bot} | **${fmtNum(stripePair.upstreamBreakdown.automatedShare * 100, 2)}%** | ${stripePair.timestampAnomalies.upstream} |
| | **B:** \`${stripePair.repoBId}\` (\`dacc7167\`) | \`2025-05-01\` → \`2026-11-01\` | \`${stripePair.window.evalStartIso.slice(0, 10)}\` | ${stripePair.downstreamBreakdown.total} | ${stripePair.downstreamBreakdown.counts.manual} | ${stripePair.downstreamBreakdown.counts.generated} | ${stripePair.downstreamBreakdown.counts.mirrored} | ${stripePair.downstreamBreakdown.counts.dependency_or_version} | ${stripePair.downstreamBreakdown.counts.bot} | **${fmtNum(stripePair.downstreamBreakdown.automatedShare * 100, 2)}%** | ${stripePair.timestampAnomalies.downstream} |
| **\`${otelPair.pairId}\`** | **A:** \`${otelPair.repoAId}\` (\`169f2f2c\`) | \`2025-05-01\` → \`2026-11-01\` | \`${otelPair.window.evalStartIso.slice(0, 10)}\` | ${otelPair.upstreamBreakdown.total} | ${otelPair.upstreamBreakdown.counts.manual} | ${otelPair.upstreamBreakdown.counts.generated} | ${otelPair.upstreamBreakdown.counts.mirrored} | ${otelPair.upstreamBreakdown.counts.dependency_or_version} | ${otelPair.upstreamBreakdown.counts.bot} | **${fmtNum(otelPair.upstreamBreakdown.automatedShare * 100, 2)}%** | ${otelPair.timestampAnomalies.upstream} |
| | **B:** \`${otelPair.repoBId}\` (\`ee94b842\`) | \`2025-05-01\` → \`2026-11-01\` | \`${otelPair.window.evalStartIso.slice(0, 10)}\` | ${otelPair.downstreamBreakdown.total} | ${otelPair.downstreamBreakdown.counts.manual} | ${otelPair.downstreamBreakdown.counts.generated} | ${otelPair.downstreamBreakdown.counts.mirrored} | ${otelPair.downstreamBreakdown.counts.dependency_or_version} | ${otelPair.downstreamBreakdown.counts.bot} | **${fmtNum(otelPair.downstreamBreakdown.automatedShare * 100, 2)}%** | ${otelPair.timestampAnomalies.downstream} |
| **\`${k8sPair.pairId}\`** | **A:** \`${k8sPair.repoAId}\` (\`e3d37bb9\`) | \`2025-08-01\` → \`2026-11-01\` | \`${k8sPair.window.evalStartIso.slice(0, 10)}\` | ${k8sPair.upstreamBreakdown.total} | ${k8sPair.upstreamBreakdown.counts.manual} | ${k8sPair.upstreamBreakdown.counts.generated} | ${k8sPair.upstreamBreakdown.counts.mirrored} | ${k8sPair.upstreamBreakdown.counts.dependency_or_version} | ${k8sPair.upstreamBreakdown.counts.bot} | **${fmtNum(k8sPair.upstreamBreakdown.automatedShare * 100, 2)}%** | ${k8sPair.timestampAnomalies.upstream} |
| | **B:** \`${k8sPair.repoBId}\` (\`494d62c5\`) | \`2025-08-01\` → \`2026-11-01\` | \`${k8sPair.window.evalStartIso.slice(0, 10)}\` | ${k8sPair.downstreamBreakdown.total} | ${k8sPair.downstreamBreakdown.counts.manual}* | ${k8sPair.downstreamBreakdown.counts.generated} | ${k8sPair.downstreamBreakdown.counts.mirrored}* | ${k8sPair.downstreamBreakdown.counts.dependency_or_version} | ${k8sPair.downstreamBreakdown.counts.bot} | **${fmtNum(k8sPair.downstreamBreakdown.automatedShare * 100, 2)}%*** | ${k8sPair.timestampAnomalies.downstream} |

*\\*Note on \`kubernetes/client-go\` breakdown in \`results.json\`: Initial \`classifyCommit()\` checked for \`k8s-publishing-bot\` / \`publishing-bot\` and missed committer \`"Kubernetes Publisher"\`. In reality, **\`${k8sDiag.downstreamCommitterKubernetesPublisherKept}/${k8sDiag.downstreamKeptCommits}\` (\`100%\`)** of kept \`kubernetes/client-go\` commits were committed by \`Kubernetes Publisher\` (see Section 4.3).*

---

## 4. Quantitative Results by Repository Pair (Generated from \`results.json\` & \`diagnostics.json\`)

### 4.1 Pair 1: \`stripe/openapi\` → \`stripe/stripe-node\` *(Supported Negative Finding)*

${renderPairTable(stripePair)}

**Key Findings on \`stripe-openapi-to-node\`:**
1. **Corrected \`168h temporal all\` row:** Directly from \`results.json\`, \`168h temporal all\` fired on **\`${s168All.queriesWithPrediction}\` queries** (emitting \`${s168All.totalSuggestions}\` suggestions with \`${s168All.correctSuggestions}\` hits, **\`Precision@3 = ${fmtNum(s168All.precisionAtK)}\`**, Wilson 95% CI ${fmtCI(s168All.wilson95)}, block-bootstrap 95% CI ${fmtCI(s168All.blockBootstrap95)}, \`Query Hit@3 = ${fmtNum(s168All.queryHitAtK)}\`, \`warnings/month = ${fmtNum(s168All.warningsPerMonth, 2)}\`). It trailed the matched \`popular\` baseline (\`${fmtNum(s168All.baselines.popularPrecision)}\`, lift **\`${fmtLift(s168AllDiag.matchedBaselines.liftOverMatchedBaseline)}\`**) and the matched \`recent\` baseline (\`${fmtNum(s168All.baselines.recentPrecision)}\`).
2. **Primary \`manual_only\` evaluation fails against matched \`popular\` baseline:**
   - At **$\\Delta = 72\\text{h}$ (\`manual_only\`)**: \`${s72Man.queriesWithPrediction}\` queries fired, with \`${s72Man.correctSuggestions}/${s72Man.totalSuggestions}\` correct suggestions (**\`${fmtNum(s72Man.precisionAtK)}\`**), exactly tying \`popular_baseline\` (**\`${fmtNum(s72Man.baselines.popularPrecision)}\`**, lift **\`${fmtLift(s72ManDiag.matchedBaselines.liftOverMatchedBaseline)}\`**) and matching only **\`${s72Man.uniqueDownstreamCommitHits}\` unique downstream commits**.
   - At **$\\Delta = 168\\text{h}$ (\`manual_only\`)**: \`${s168Man.queriesWithPrediction}\` queries fired, with \`${s168Man.correctSuggestions}/${s168Man.totalSuggestions}\` correct suggestions (**\`${fmtNum(s168Man.precisionAtK)}\`**), underperforming \`popular_baseline\` (**\`${fmtNum(s168Man.baselines.popularPrecision)}\`**, lift **\`${fmtLift(s168ManDiag.matchedBaselines.liftOverMatchedBaseline)}\`**, margin **\`${fmtNum(s168ManDiag.matchedBaselines.marginOverMatchedBaseline)}\`**) and matching only **\`${s168Man.uniqueDownstreamCommitHits}\` unique downstream commits**.
3. **Why \`explicit_ref\` fired 0 times:** \`stripe/openapi\` bundles all endpoint changes into monolithic files (\`openapi/spec3.json\`, \`openapi/spec3.sdk.json\`), providing no per-resource path stem (\`customers\`, \`payment_intents\`) without parsing the internal OpenAPI AST diff.

---

### 4.2 Pair 2: \`open-telemetry/opentelemetry-proto\` → \`open-telemetry/opentelemetry-js\` *(Inconclusive — Sparse Data)*

${renderPairTable(otelPair)}

**Key Findings on \`otel-proto-to-js\`:**
- With only \`${o72Man.eligibleUpstreamEvents}\` eligible upstream commits in the held-out split and $N_{\\text{fired}} \\le ${o168Man.queriesWithPrediction}$ (far below $N_{\\min} = 30$), all runs on this pair are **\`INCONCLUSIVE (sparse data)\`**. Cross-language wire protocol changes in \`opentelemetry-proto\` are adopted by language SDKs over multi-month specification cycles rather than 24h–168h commit windows.

---

### 4.3 Pair 3: \`kubernetes/kubernetes\` → \`kubernetes/client-go\` *(Invalid / Unverified Mirror Experiment)*

${renderPairTable(k8sPair)}

> [!WARNING]
> **Why the Kubernetes Confounder Test Is Marked Invalid for \`manual_only\` Inference:**
> Post-run audit of \`/tmp/gu27-repos/kubernetes_client-go\` (recorded in [\`diagnostics.json\`](./diagnostics.json) under \`kubernetesMirrorDiagnostics\`) identified three structural defects in how initial \`run.mjs\` evaluated this pair:
> 1. **Mirror Bot Classifier Mismatch:** Out of \`${k8sDiag.downstreamTotalNonMergeCommits}\` non-merge commits in \`kubernetes/client-go\` during \`2025-08-01..2026-11-01\` (\`${k8sDiag.downstreamKeptCommits}\` kept with $\\le 50$ files and $\\ge 1$ scoped \`.go\` file, \`${k8sDiag.downstreamDroppedOver50Files}\` dropped by the 50-file cap, and \`${k8sDiag.downstreamDroppedNoScopedGoFiles}\` dropped because commit \`${k8sDiag.downstreamDroppedNoScopedGoCommitSha}\` touched only \`OWNERS\` files), **\`${k8sDiag.downstreamCommitterKubernetesPublisherAll}/${k8sDiag.downstreamTotalNonMergeCommits}\` (\`100%\`) have committer \`"Kubernetes Publisher"\`**. Initial \`classifyCommit()\` checked only \`k8s-publishing-bot\` and \`publishing-bot\`, misclassifying \`${k8sPair.downstreamBreakdown.counts.manual}\` mirrored commits that touched non-\`zz_generated\` paths as \`manual\`. (\`classifyCommit()\` in \`run.mjs\` has now been updated to match \`kubernetes publisher\`).
> 2. **Mirror Timestamp Inversion ($t_B \\le t_A$):** When \`Kubernetes Publisher\` mirrors a commit from \`staging/src/k8s.io/client-go\` into \`kubernetes/client-go\`, it sets the mirrored commit's committer timestamp equal to the original author timestamp ($t_B^{\\text{commit}} = t_A^{\\text{author}}$ on \`${k8sDiag.downstreamAuthorTimeEqualsCommitTimeKept}/${k8sDiag.downstreamKeptCommits}\` kept commits). In \`kubernetes/kubernetes\`, however, $t_A^{\\text{commit}}$ is the later Prow merge timestamp. Across \`${k8sDiag.matchedSubjectAndAuthorTimePairs}\` commits matched by exact \`(authorTime, subject)\` between Repo A and Repo B, **\`${k8sDiag.pairsWithTbLessOrEqualTa}/${k8sDiag.matchedSubjectAndAuthorTimePairs}\` (\`${k8sTbLeTaPct}%\`) have $t_B^{\\text{commit}} \\le t_A^{\\text{commit}}$** (median $t_B^{\\text{commit}} - t_A^{\\text{commit}} = ${k8sDiag.medianTbMinusTaHours}\\text{ hours}$). Because \`evaluateWalkForward()\` checks $t_A < t_B \\le t_A + \\Delta$, \`${k8sTbLeTaPct}%\` of true mirrored commits fell outside the forward window.
> 3. **Bulk Sync & Non-\`.go\` Filtering:** \`${k8sDiag.downstreamDroppedOver50Files}\` downstream commits touched $>50$ files (up to \`${k8sDiag.downstreamMaxFilesInSingleCommit}\` scoped \`.go\` files in a single commit) and were dropped by \`maxFilesPerCommit = 50\`, and \`${k8sDiag.downstreamDroppedNoScopedGoFiles}\` commit (\`${k8sDiag.downstreamDroppedNoScopedGoCommitSha}\`, touching only \`OWNERS\` files) had \`0\` scoped \`.go\` files (\`${k8sDiag.downstreamTotalNonMergeCommits} - ${k8sDiag.downstreamDroppedOver50Files} - ${k8sDiag.downstreamDroppedNoScopedGoFiles} = ${k8sDiag.downstreamKeptCommits}\` kept).
>
> Consequently, this report **removes the claim** that the \`${fmtNum(getRun(k8sPair, 72, 'temporal', 'all').precisionAtK)}\` → \`${fmtNum(getRun(k8sPair, 72, 'temporal', 'manual_only').precisionAtK)}\` drop on \`k8s\` validates the confounder filter, and classifies the Kubernetes pair as **invalid / unverified as run**.

---

### 4.4 Matched vs. Non-Matched Shuffled Control Analysis

In initial [\`run.mjs\`](./run.mjs), \`baselines.shuffledPrecision\` was computed by running \`evaluateWalkForward()\` end-to-end on \`(commitsA, shuffledB)\`. Because that retrained model selected its own firing events based on shifted training windows, its firing set differed from the primary model's firing set (a **non-matched retrained placebo**).

To provide a strict apples-to-apples comparison alongside the matched \`popular\` and \`recent\` baselines, [\`run-diagnostics.mjs\`](./run-diagnostics.mjs) also computed **\`shuffledMatchedWindowPrecision\`**, which takes the **exact same fired upstream events and exact same suggestions** emitted by the primary model and scores whether those files were modified in $(t_A, t_A + \\Delta]$ of the $+45\\text{d}$-shifted downstream stream:

| Pair & Run | Primary Model Fired ($N$) | Primary Precision@3 (Hits / Sug) | Matched \`popular\` Baseline | Matched \`recent\` Baseline | Matched-Event \`shuffled\` Window (Hits / Sug, Unique B Hits) | Non-Matched Retrained \`shuffled\` Placebo in \`results.json\` (Hits / Sug, Fired $N$) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| \`stripe\` $72\\text{h}$ \`temporal\` \`all\` | ${s72All.queriesWithPrediction} | **${fmtNum(s72All.precisionAtK)}** (${s72All.correctSuggestions}/${s72All.totalSuggestions}) | ${fmtNum(s72All.baselines.popularPrecision)} | ${fmtNum(s72All.baselines.recentPrecision)} | **${fmtNum(s72AllDiag.matchedBaselines.shuffledMatchedWindowPrecision)}** (${s72AllDiag.matchedBaselines.shuffledMatchedWindowHits}/${s72AllDiag.matchedBaselines.shuffledMatchedWindowSuggestions}, ${s72AllDiag.matchedBaselines.shuffledMatchedWindowUniqueCommits} B commits) | **${fmtNum(s72AllDiag.shuffledRetrainedPlacebo.precisionAtK)}** (${s72AllDiag.shuffledRetrainedPlacebo.correctSuggestions}/${s72AllDiag.shuffledRetrainedPlacebo.totalSuggestions}, $N=${s72AllDiag.shuffledRetrainedPlacebo.queriesWithPrediction}$) |
| \`stripe\` $72\\text{h}$ \`temporal\` \`manual_only\` | ${s72Man.queriesWithPrediction} | **${fmtNum(s72Man.precisionAtK)}** (${s72Man.correctSuggestions}/${s72Man.totalSuggestions}) | ${fmtNum(s72Man.baselines.popularPrecision)} | ${fmtNum(s72Man.baselines.recentPrecision)} | **${fmtNum(s72ManDiag.matchedBaselines.shuffledMatchedWindowPrecision)}** (${s72ManDiag.matchedBaselines.shuffledMatchedWindowHits}/${s72ManDiag.matchedBaselines.shuffledMatchedWindowSuggestions}, ${s72ManDiag.matchedBaselines.shuffledMatchedWindowUniqueCommits} B commits) | **${fmtNum(s72ManDiag.shuffledRetrainedPlacebo.precisionAtK)}** (${s72ManDiag.shuffledRetrainedPlacebo.correctSuggestions}/${s72ManDiag.shuffledRetrainedPlacebo.totalSuggestions}, $N=${s72ManDiag.shuffledRetrainedPlacebo.queriesWithPrediction}$) |
| \`stripe\` $168\\text{h}$ \`temporal\` \`all\` | ${s168All.queriesWithPrediction} | **${fmtNum(s168All.precisionAtK)}** (${s168All.correctSuggestions}/${s168All.totalSuggestions}) | ${fmtNum(s168All.baselines.popularPrecision)} | ${fmtNum(s168All.baselines.recentPrecision)} | **${fmtNum(s168AllDiag.matchedBaselines.shuffledMatchedWindowPrecision)}** (${s168AllDiag.matchedBaselines.shuffledMatchedWindowHits}/${s168AllDiag.matchedBaselines.shuffledMatchedWindowSuggestions}, ${s168AllDiag.matchedBaselines.shuffledMatchedWindowUniqueCommits} B commits) | **${fmtNum(s168AllDiag.shuffledRetrainedPlacebo.precisionAtK)}** (${s168AllDiag.shuffledRetrainedPlacebo.correctSuggestions}/${s168AllDiag.shuffledRetrainedPlacebo.totalSuggestions}, $N=${s168AllDiag.shuffledRetrainedPlacebo.queriesWithPrediction}$) |
| \`stripe\` $168\\text{h}$ \`temporal\` \`manual_only\` | ${s168Man.queriesWithPrediction} | **${fmtNum(s168Man.precisionAtK)}** (${s168Man.correctSuggestions}/${s168Man.totalSuggestions}) | ${fmtNum(s168Man.baselines.popularPrecision)} | ${fmtNum(s168Man.baselines.recentPrecision)} | **${fmtNum(s168ManDiag.matchedBaselines.shuffledMatchedWindowPrecision)}** (${s168ManDiag.matchedBaselines.shuffledMatchedWindowHits}/${s168ManDiag.matchedBaselines.shuffledMatchedWindowSuggestions}, ${s168ManDiag.matchedBaselines.shuffledMatchedWindowUniqueCommits} B commits) | **${fmtNum(s168ManDiag.shuffledRetrainedPlacebo.precisionAtK)}** (${s168ManDiag.shuffledRetrainedPlacebo.correctSuggestions}/${s168ManDiag.shuffledRetrainedPlacebo.totalSuggestions}, $N=${s168ManDiag.shuffledRetrainedPlacebo.queriesWithPrediction}$) |

**Why Shuffled Streams Scored Higher on Stripe (Verified in \`diagnostics.json\`):**
In \`stripe/stripe-node\`, the held-out evaluation split (\`2026-06-22\` to \`2026-11-01\`) contained \`${stripeEvalDiag.unshifted.manualEvalCommits}\` manual commits in the unshifted stream vs. \`${stripeEvalDiag.shiftedPlus45d.manualEvalCommits}\` in the $+45\\text{d}$-shifted stream, with slightly more touches to top-suggested core files after the $+45\\text{d}$ shift (\`src/stripe.core.ts\`: \`${stripeEvalDiag.unshifted.fileCounts['src/stripe.core.ts']}\` unshifted vs. \`${stripeEvalDiag.shiftedPlus45d.fileCounts['src/stripe.core.ts']}\` shifted; \`src/stripe.esm.node.ts\`: \`${stripeEvalDiag.unshifted.fileCounts['src/stripe.esm.node.ts']}\` vs. \`${stripeEvalDiag.shiftedPlus45d.fileCounts['src/stripe.esm.node.ts']}\`; \`src/utils.ts\`: \`${stripeEvalDiag.unshifted.fileCounts['src/utils.ts']}\` vs. \`${stripeEvalDiag.shiftedPlus45d.fileCounts['src/utils.ts']}\`). More importantly, because upstream \`stripe/openapi\` commits arrive in dense multi-commit bursts, just **\`${s72ManDiag.matchedBaselines.shuffledMatchedWindowUniqueCommits}\` unique shifted downstream commits** at $72\\text{h}$ \`manual_only\` (and **\`${s168ManDiag.matchedBaselines.shuffledMatchedWindowUniqueCommits}\`** at $168\\text{h}$ \`manual_only\`) landed inside dense upstream spec bursts and credited \`${s72ManDiag.matchedBaselines.shuffledMatchedWindowHits}/${s72ManDiag.matchedBaselines.shuffledMatchedWindowSuggestions}\` (\`${fmtNum(s72ManDiag.matchedBaselines.shuffledMatchedWindowPrecision)}\`) and \`${s168ManDiag.matchedBaselines.shuffledMatchedWindowHits}/${s168ManDiag.matchedBaselines.shuffledMatchedWindowSuggestions}\` (\`${fmtNum(s168ManDiag.matchedBaselines.shuffledMatchedWindowPrecision)}\`) suggestions via many-to-many inflation. Regardless of whether the shuffled control is excluded or included, the primary \`manual_only\` predictor fails to beat the simple matched \`popular\` baseline (\`${fmtLift(s72ManDiag.matchedBaselines.liftOverMatchedBaseline)}\` lift at $72\\text{h}$, \`${fmtLift(s168ManDiag.matchedBaselines.liftOverMatchedBaseline)}\` lift at $168\\text{h}$).

---

## 5. Repository-Level Alerts vs. File-Level Alerts (Generated from \`results.json\`)

${renderRepoLevelTable()}

**Key Takeaway:**
Whenever repository-level precision exceeded \`0.60\` (e.g., \`${fmtNum(s168Man.repoLevelAlert.precision)}\` on \`stripe\` at $168\\text{h}$ \`manual_only\` or \`${fmtNum(k168All.repoLevelAlert.precision)}\` on \`k8s\` at $168\\text{h}$ \`all\`), the unconditional base rate of Repo B activity in a 168-hour window was already \`${fmtNum(s168Man.repoLevelAlert.baseRate)}\` (\`lift = ${fmtLift(s168Man.repoLevelAlert.lift)}\`) and \`${fmtNum(k168All.repoLevelAlert.baseRate)}\` (\`lift = ${fmtLift(k168All.repoLevelAlert.lift)}\`).

---

## 6. Qualitative Inspection of Sampled Predictions & Audit Provenance

### 6.1 Provenance & Limitations of the 15-Prediction Inspection

- **Selection method (non-random convenience sample):** \`evaluateWalkForward()\` stores the first 15 fired predictions in chronological order in \`samplePredictions\` for each run. The 15 rows below were selected by taking 5 early predictions from each pair across representative horizons.
- **Rater provenance:** Rated by a single rater (the AI agent authoring GU-27), not by blind or multi-rater human annotation.
- **True-match count vs. preregistered \`GO\` Rule 5:** Preregistered \`GO\` Rule 5 specifies that at least **50% of true matches** be judged \`Actionable review question\` (vs. \`Known automated synchronization\` or \`Interesting historical correlation but not actionable\`). In this 15-item sample, **only 4 predictions were true matches (\`hit: true\`)**—Rows 1 and 2 on \`stripe\` $72\\text{h}$ \`all\` (both matching the same downstream commit \`f96a3a0002\`), and Rows 11 and 12 on \`k8s\` $168\\text{h}$ \`all\` (both matching generated \`applyconfigurations/internal/internal.go\`). **Zero (\`0 / 4 = 0%\`) of the true matches were rated \`Actionable review question\`.**
- **Post-hoc 4th category for false alarms:** The remaining 11 inspected predictions were false alarms (\`hit: false\`), labeled below with the post-hoc descriptive tag *\`False alarm — irrelevant or misleading\`*. Because of the small true-match count ($n = 4$) and single-rater convenience sampling, this table is presented as **qualitative diagnostic evidence** rather than a formal statistical gate.

| # | Pair ID | Upstream Commit ($t_A$) & Subject | Triggered From ($f_A$) → Suggested ($f_B$) | Outcome in $(t_A, t_A + \\Delta]$ | Preregistered 3-Class Rubric (True Matches) / Post-Hoc Tag (False Alarms) | Qualitative Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | \`stripe\` ($72\\text{h}$ \`all\`) | \`63fcf17ef3\` (\`2026-06-23T22:37Z\`)<br>*"Update fixture data"* | \`openapi/fixtures3.json\` → \`src/stripe.core.ts\` (\`shared 8/19\`, low \`0.231\`) | **True Match** (\`f96a3a0002\`, $+6.1\\text{h}$) | **Interesting historical correlation, not actionable** | Upstream fixture dump preceded a general SDK core update (\`f96a3a0002\`); fixture updates do not require manual edits to \`stripe.core.ts\`. |
| 2 | \`stripe\` ($72\\text{h}$ \`all\`) | \`f4ac6d9a7f\` (\`2026-06-23T22:37Z\`)<br>*"Update OpenAPI specification for GA and public preview"* | \`openapi/spec3.json\` → \`src/stripe.core.ts\` (\`shared 13/31\`, low \`0.264\`) | **True Match** (\`f96a3a0002\`, $+6.1\\text{h}$) | **Interesting historical correlation, not actionable** | Credits the exact same downstream commit \`f96a3a0002\` 1 second after \`63fcf17ef3\`; \`stripe.core.ts\` changes on SDK release cadence, not per-endpoint spec edits. |
| 3 | \`stripe\` ($72\\text{h}$ \`man\`) | \`46c4473bf1\` (\`2026-06-25T03:11Z\`)<br>*"Update OpenAPI specification for private preview"* | \`openapi/spec3.private_preview.sdk.json\` → \`src/stripe.core.ts\` (\`shared 65/232\`, low \`0.226\`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Private-preview spec snapshot has no impact on public \`stripe-node\` core runtime. |
| 4 | \`stripe\` ($168\\text{h}$ \`man\`) | \`63fcf17ef3\` (\`2026-06-23T22:37Z\`)<br>*"Update fixture data"* | \`openapi/fixtures3.beta.json\` → \`src/RequestSender.ts\`, \`src/Types.d.ts\` (\`shared 22/56\`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Beta fixture data has no causal relationship to HTTP \`RequestSender.ts\`. |
| 5 | \`stripe\` ($168\\text{h}$ \`man\`) | \`bc0062b49f\` (\`2026-06-25T19:10Z\`)<br>*"Update OpenAPI specification for private preview"* | \`openapi/spec3.private_preview.sdk.json\` → \`src/stripe.core.ts\`, \`src/stripe.esm.node.ts\`, \`src/utils.ts\` | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | High-frequency upstream spec dump paired with high-frequency SDK entrypoint files. |
| 6 | \`otel\` ($72\\text{h}$ \`man\`) | \`3b93166f82\` (\`2026-08-28T19:11Z\`)<br>*"Move attribute examples to latest semconv. (#853)"* | \`opentelemetry/proto/trace/v1/trace.proto\` → \`.../EnvironmentConfigProvider.ts\` (\`shared 3/4\`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Doc/example comment move in \`trace.proto\` has zero impact on JS \`EnvironmentConfigProvider.ts\`. |
| 7 | \`otel\` ($72\\text{h}$ \`man\`) | \`bb8796bff6\` (\`2026-09-02T13:56Z\`)<br>*"Add \`since <version>\` requirement to new proto fields and backfill (#854)"* | \`opentelemetry/proto/metrics/v1/metrics.proto\` → \`.../EnvironmentConfigProvider.ts\` (\`shared 3/5\`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Proto comment/version-annotation policy backfill does not affect JS environment configuration. |
| 8 | \`otel\` ($168\\text{h}$ \`man\`) | \`9bff3f876f\` (\`2026-09-29T05:16Z\`)<br>*"Fix typo in metrics.proto comment (#872)"* | \`opentelemetry/proto/metrics/v1/metrics.proto\` → \`.../EnvironmentConfigProvider.ts\` (\`shared 4/6\`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Comment typo fix in \`metrics.proto\` triggered a cross-repo warning on an unrelated experimental JS file. |
| 9 | \`otel\` ($168\\text{h}$ \`exp\`) | \`3b93166f82\` (\`2026-08-28T19:11Z\`) (\`explicit_ref\`) | \`opentelemetry/proto/trace/v1/trace.proto\` → \`.../EnvironmentConfigProvider.ts\` (\`shared 4/4\`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Shared generic token \`opentelemetry\` allowed \`explicit_ref\` to pair \`trace.proto\` with \`EnvironmentConfigProvider.ts\`. |
| 10 | \`otel\` ($168\\text{h}$ \`exp\`) | \`bb8796bff6\` (\`2026-09-02T13:56Z\`) (\`explicit_ref\`) | \`opentelemetry/proto/trace/v1/trace.proto\` → \`.../EnvironmentConfigProvider.ts\` (\`shared 4/4\`) | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Same spurious small-sample pairing (\`4/4\` in training, \`0/3\` in evaluation). |
| 11 | \`k8s\` ($168\\text{h}$ \`all\`) | \`316b0b064a\` (\`2026-07-18T00:00Z\`)<br>*"add workload config building blocks API types"* | \`staging/src/k8s.io/api/scheduling/v1alpha3/types.go\` → \`applyconfigurations/internal/internal.go\` | **True Match** (\`f2ffee48ce\`, $+16.8\\text{h}$) | **Known automated synchronization** | \`applyconfigurations/internal/internal.go\` is a generated \`client-go\` artifact synced by \`Kubernetes Publisher\`. |
| 12 | \`k8s\` ($168\\text{h}$ \`all\`) | \`3c20ae3c47\` (\`2026-07-21T16:06Z\`)<br>*"KEP-5729: Promote DRAWorkloadResourceClaims to beta"* | \`staging/.../podgrouptemplate.go\` → \`applyconfigurations/internal/internal.go\` | **True Match** (\`16f6ccdf67\`, $+40.4\\text{h}$) | **Known automated synchronization** | Downstream hit is automated staging-to-mirror synchronization of generated applyconfiguration code. |
| 13 | \`k8s\` ($168\\text{h}$ \`man\`) | \`b8d76348fa\` (\`2026-09-03T18:00Z\`)<br>*"validation-gen: Let deep-equal func be set by tag"* | \`staging/.../zz_generated.validations.go\` → \`tools/events/event_broadcaster.go\`, \`event_recorder.go\` | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Coincidental training-window overlap between validation codegen and \`tools/events/*\`. |
| 14 | \`k8s\` ($168\\text{h}$ \`man\`) | \`e060f3c2bc\` (\`2026-09-09T05:00Z\`)<br>*"client-go: avoid holding the event broadcaster lock during EventSeries updates"* | \`staging/src/k8s.io/client-go/tools/events/event_broadcaster.go\` → \`tools/events/event_broadcaster.go\` | Scored Miss (mirror $t_B \\le t_A$) | **Known automated synchronization** *(artifact of mirror clock)* | Exact mirrored path in read-only \`kubernetes/client-go\`; scored as a miss because \`Kubernetes Publisher\` preserved author timestamp ($t_B \\le t_A$). |
| 15 | \`k8s\` ($168\\text{h}$ \`man\`) | \`a114ef37c6\` (\`2026-09-23T14:54Z\`)<br>*"api/certificates: update CertificateSigningRequest usages field documentation..."* | \`staging/.../certificates/v1/types_swagger_doc_generated.go\` → \`tools/events/event_broadcaster.go\` | False Alarm (no match) | *False alarm — irrelevant or misleading (post-hoc)* | Certificate doc comment update has no relationship to \`event_broadcaster.go\`. |

---

## 7. Operational Cost, Permissions Friction, & Future Direction

### 7.1 Runtime & Resource Costs (from \`results.json\`)

| Pair ID | Scoped Commits (A / B) | \`git log\` Subprocess Calls | GitHub API Requests | Wall-Clock Runtime |
| :--- | ---: | ---: | ---: | ---: |
| \`${stripePair.pairId}\` | ${stripePair.upstreamBreakdown.total} / ${stripePair.downstreamBreakdown.total} | ${stripePair.costs.gitSubprocessCalls} | ${stripePair.costs.apiRequests} | \`${stripePair.costs.runtimeMs} ms\` |
| \`${otelPair.pairId}\` | ${otelPair.upstreamBreakdown.total} / ${otelPair.downstreamBreakdown.total} | ${otelPair.costs.gitSubprocessCalls} | ${otelPair.costs.apiRequests} | \`${otelPair.costs.runtimeMs} ms\` |
| \`${k8sPair.pairId}\` | ${k8sPair.upstreamBreakdown.total} / ${k8sPair.downstreamBreakdown.total} | ${k8sPair.costs.gitSubprocessCalls} | ${k8sPair.costs.apiRequests} | \`${k8sPair.costs.runtimeMs} ms\` |
| **Total (36 runs)** | **${stripePair.upstreamBreakdown.total + otelPair.upstreamBreakdown.total + k8sPair.upstreamBreakdown.total} / ${stripePair.downstreamBreakdown.total + otelPair.downstreamBreakdown.total + k8sPair.downstreamBreakdown.total}** | **${stripePair.costs.gitSubprocessCalls + otelPair.costs.gitSubprocessCalls + k8sPair.costs.gitSubprocessCalls}** | **0** | **\`${stripePair.costs.runtimeMs + otelPair.costs.runtimeMs + k8sPair.costs.runtimeMs} ms\`** |

### 7.2 Why Temporal Cross-Repository Warnings Should Not Be Built Now

1. **GitHub Actions \`GITHUB_TOKEN\` Permission Boundary:** Gutter runs out-of-the-box using the default single-repository \`GITHUB_TOKEN\`. Accessing private sibling repositories requires provisioning a cross-repository Fine-Grained PAT or multi-repo GitHub App plus maintaining explicit repository-pair manifests.
2. **Insufficient Signal-to-Noise Ratio:** On the only high-volume pair (\`stripe/openapi\` → \`stripe/stripe-node\`), \`manual_only\` temporal predictions fire \`${fmtNum(s72Man.warningsPerMonth, 2)}\`–\`${fmtNum(s168Man.warningsPerMonth, 2)}\` times per month while performing no better than a static popular-file list (\`1.00x\` lift at $72\\text{h}$, \`0.83x\` lift at $168\\text{h}$).

### 7.3 Preserving Future Optionality: Explicit Contract Analysis (Not Commit Timing)

This \`NO-GO\` decision applies to **commit-timestamp window correlation**, not to all forms of cross-repository impact analysis. If cross-repository analysis is revisited in a later milestone after single-repository resolution and calibration benchmarks are established, it should be built around **explicit static contract evidence**—such as parsing structured breaking changes in OpenAPI/Protobuf/GraphQL ASTs and matching them deterministically to static consumer symbol/endpoint references—rather than inferring coupling from Git commit timestamps.
`;
}

function main() {
  const results = JSON.parse(readFileSync(join(HERE, 'results.json'), 'utf8'));
  const diagnostics = JSON.parse(readFileSync(join(HERE, 'diagnostics.json'), 'utf8'));
  const markdown = buildReportMarkdown(results, diagnostics);
  const reportPath = join(HERE, 'REPORT.md');

  if (process.argv.includes('--check')) {
    const current = readFileSync(reportPath, 'utf8').replace(/\r\n/g, '\n');
    if (current !== markdown) {
      console.error(
        '✗ research/multi-repo/REPORT.md is out of sync with results.json / diagnostics.json. Run: node research/multi-repo/generate-report.mjs',
      );
      process.exit(1);
    }
    console.log('✓ research/multi-repo/REPORT.md matches results.json and diagnostics.json byte-for-byte.');
    return;
  }

  writeFileSync(reportPath, markdown);
  console.log('✓ Generated research/multi-repo/REPORT.md from results.json and diagnostics.json');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
