# GU-27 · Cross-Repository Coupling Research (`research/multi-repo/`)

This directory contains the preregistration documents, evaluation harness, unit tests, raw outputs, supplementary diagnostics, and decision report for **GU-27: Cross-Repository Coupling Research**.

- **Operational Product Decision:** **`NO-GO`** — Do not build cross-repository temporal co-change warnings in Gutter or Repo Archaeology now.
- **Empirical Summary:** See [`REPORT.md`](./REPORT.md) for the full evaluation across **supported negative findings** (`stripe/openapi` → `stripe/stripe-node`), **inconclusive findings** (`open-telemetry/opentelemetry-proto` → `open-telemetry/opentelemetry-js`), and **invalid or unverified analyses** (`kubernetes/kubernetes` → `kubernetes/client-go` mirror experiment under committer-timestamp alignment).

---

## Directory Contents

| File | Purpose |
| :--- | :--- |
| [`PAIRS.md`](./PAIRS.md) | Original preregistered candidate pairs, pinned `HEAD` SHAs, and prerequisite verification (committed in `0ea8a61`). |
| [`METHODOLOGY.md`](./METHODOLOGY.md) | Original preregistered walk-forward causality, 168h embargoes, right-censoring, and confounder controls (committed in `0ea8a61`). |
| [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md) | Original preregistered `GO` / `NO-GO` / `NOT YET` decision rules (committed in `0ea8a61`). |
| [`run.mjs`](./run.mjs) | Research-only chronological walk-forward runner using argument-vector `git log`. |
| [`run-diagnostics.mjs`](./run-diagnostics.mjs) | Supplementary diagnostics collector (matched-baseline lifts, shuffled-control fired/hit counts, and `kubernetes/client-go` mirror timestamp analysis). |
| [`generate-report.mjs`](./generate-report.mjs) | Deterministic generator that builds [`REPORT.md`](./REPORT.md) directly from [`results.json`](./results.json) and [`diagnostics.json`](./diagnostics.json) (`--check` verifies zero drift in CI). |
| [`setup-repos.sh`](./setup-repos.sh) | Reproducible script that clones bare, blobless histories of all 6 repositories and pins each to its exact `HEAD` SHA from [`manifest.json`](./manifest.json). |
| [`test/multi-repo.test.mjs`](./test/multi-repo.test.mjs) | Synthetic unit tests verifying zero future leakage, right-censoring, confounder classification (`Kubernetes Publisher`), decision overlap logic, and report-to-JSON consistency. |
| [`results.json`](./results.json) | Preserved raw evaluation output from commit `1014af3`. |
| [`diagnostics.json`](./diagnostics.json) | Supplementary matched-baseline, shuffled-placebo, and Kubernetes mirror metadata diagnostics. |
| [`manifest.json`](./manifest.json) | Environment and pinned-repository manifest. |
| [`REPORT.md`](./REPORT.md) | Final GU-27 research report (generated deterministically from `results.json` + `diagnostics.json`). |

---

## Reproducing the Tests & Report Verification (No Network Required)

Run the synthetic unit tests and verify that [`REPORT.md`](./REPORT.md) matches [`results.json`](./results.json) and [`diagnostics.json`](./diagnostics.json) (both checks also run automatically in GitHub Actions CI):

```bash
node --test research/multi-repo/test/*.test.mjs
node research/multi-repo/generate-report.mjs --check
```

---

## Reproducing the Full Repository Evaluation From Scratch

### 1. Clone the 6 Pinned Bare Repositories

Run [`setup-repos.sh`](./setup-repos.sh) to clone blobless bare histories into `/tmp/gu27-repos` (or pass a custom directory path) and pin each repository's `HEAD` to its immutable SHA from [`PAIRS.md`](./PAIRS.md):

```bash
bash research/multi-repo/setup-repos.sh /tmp/gu27-repos
```

### 2. Optional: Resolving `repo-archaeology` (`openRepository()` Probe)

[`run.mjs`](./run.mjs) probes whether Repo Archaeology's `openRepository()` library API (`RA-03`) is importable to record API capability metadata in `manifest.json`, and reads raw commit histories directly via `execFileSync('git', ['log', ...])` because `openRepository()` does not expose a raw commit stream (`exposesRawCommitHistory: false`).

No local sibling checkout is required:
- By default, `run.mjs` runs standalone using `git` and Node.js 22+ built-ins.
- If you want `probeRepoArchaeologyApi()` to resolve `openRepository()` without a sibling checkout, install `repo-archaeology` from GitHub or npm without saving to `package.json`:
  ```bash
  npm install --no-save github:lbrodie11/repo-archaeology
  ```

### 3. Run Diagnostics & Regenerate the Report

[`results.json`](./results.json) is the frozen raw evaluation output from commit `1014af3` (prior to adding `"Kubernetes Publisher"` to `classifyCommit()`, the `NOT YET (wide CI > 35pp)` run status, and `decisionSummary` / `computeOverallDecision()` in [`run.mjs`](./run.mjs)).

- **Recomputing [`diagnostics.json`](./diagnostics.json) and [`REPORT.md`](./REPORT.md) against frozen `results.json`:**
  [`run-diagnostics.mjs`](./run-diagnostics.mjs) deliberately restores the initial `1014af3` classification for `"Kubernetes Publisher"` when computing `diagnostics.json` so that its matched-window shuffled control and audit counts align with the frozen `results.json` artifact:
  ```bash
  node research/multi-repo/run-diagnostics.mjs
  node research/multi-repo/generate-report.mjs
  ```
- **Reproducing the frozen [`results.json`](./results.json) from `1014af3`:**
  To reproduce the exact `results.json` from commit `1014af3` (apart from runtime timings), run the `1014af3` revision of `run.mjs` against `/tmp/gu27-repos`:
  ```bash
  git show 1014af3:research/multi-repo/run.mjs > /tmp/gu27-run-1014af3.mjs
  node /tmp/gu27-run-1014af3.mjs --repos-dir /tmp/gu27-repos --out-dir /tmp/gu27-repro-1014af3
  ```
- **Running the updated [`run.mjs`](./run.mjs) (with `"Kubernetes Publisher"` classified as `mirrored`, `liftOverMatchedBaseline`, and `computeOverallDecision()`):**
  To execute a fresh evaluation run with the updated `run.mjs` into a separate output directory (without overwriting the frozen `results.json`):
  ```bash
  node research/multi-repo/run.mjs --repos-dir /tmp/gu27-repos --out-dir /tmp/gu27-rerun
  ```
