# GU-27 · Candidate Repository Pairs & Prerequisite Verification

**Status:** Preregistered & Approved for GU-27 Research Spike (2026-11-08)  
**Scope:** Research-only (`research/multi-repo/`). No product code (`src/`), GitHub Action (`action.yml`), or public JSON schema (`schema/`) is modified.

---

## 1. Prerequisite & Dependency Verification

Before selecting repository pairs or writing the experiment runner, we verified the live state of `lbrodie11/repo-archaeology` and `lbrodie11/gutter` as of **2026-11-08**:

| Prerequisite / Milestone | Verified State | Impact on GU-27 |
|---|---|---|
| **RA-03 (`openRepository()` Library API)** | **Merged** on `lbrodie11/repo-archaeology` (`main` commit `fe47f97`, PR #12; documented in `docs/api.md`). Note: `repo-archaeology@0.3.0` on npm predates PR #12, while the workspace checkout has `openRepository()`. | `openRepository()` exposes `diff`, `scan`, `file`, `explain`, `backtest`, and `importGraph` on a single repository session. It **does not** expose raw chronological commit records (`commits()` or `history()`). Per Mandatory Change A, `research/multi-repo/run.mjs` uses `openRepository()` when available for single-repo metadata and implements a bounded, research-only Git history reader via argument-vector `execFileSync('git', ['log', ...])` without importing `repo-archaeology` private internals. |
| **RA-06 (Track-record milestone)** | **Not present** on `lbrodie11/repo-archaeology` `main`. | GU-27 does not assume RA-06 exists and defines its own chronological walk-forward evaluation and block-resampling protocol in [`METHODOLOGY.md`](./METHODOLOGY.md). |
| **GU-03 (Single-repo benchmark milestone)** | **Not present** on `lbrodie11/gutter` `main`. | GU-27 does not assume GU-03 benchmark definitions exist and defines all metrics, baselines, and decision gates in [`DECISION-THRESHOLDS.md`](./DECISION-THRESHOLDS.md). |

---

## 2. Candidate Selection Criteria (Established Prior to Performance Inspection)

To avoid cherry-picking repositories with homogeneous release automation, candidate pairs must satisfy four precommitted criteria:

1. **Three distinct coupling archetypes:**
   - *Archetype A (Vendor API Specification → Official Language SDK):* Tests whether spec updates predict SDK resource changes and how much of that coupling is automated code generation.
   - *Archetype B (Cross-Language Wire Protocol → Manual/Hybrid SDK Implementation):* Tests whether protocol `.proto` changes predict language-specific exporter/transformer updates under asynchronous, human-driven adoption.
   - *Archetype C (Monorepo Staging Tree → Published Client Repository):* Serves as a **known-mirror stress test** to verify whether high temporal precision is explained by automated repository mirroring (`k8s-publishing-bot`) rather than actionable human omissions.
2. **Public, active histories:** Both repositories in each pair must be public on GitHub with active commit history across the 18-month observation window (`2025-05-01T00:00:00Z` through `2026-11-01T00:00:00Z`).
3. **Identifiable plausible API-to-consumer path:** Before running any predictive evaluation, each pair must have at least one documented structural path linking upstream contract files to downstream consumer files.
4. **Explicit confounder accounting:** Known code generators, mirror bots, and release scripts must be cataloged upfront so the experiment reports metrics both **overall (`all`)** and **restricted to manually maintained code (`manual_only`)**.

---

## 3. Preregistered Repository Pairs

### Pair 1 · `stripe/openapi` → `stripe/stripe-node` (Archetype A: OpenAPI Spec → Official SDK)

| Field | Upstream (Repo A) | Downstream (Repo B) |
|---|---|---|
| **Repository URL** | `https://github.com/stripe/openapi` | `https://github.com/stripe/stripe-node` |
| **Immutable Head SHA** | `6360907ca278d6aecff118df90167e94aaba1437` | `dacc71670c82e62cdf3f3dc56374ce941362aaca` |
| **Total Commits at SHA** | `4,158` | `2,670` |
| **Observation Window** | `2025-05-01T00:00:00Z` – `2026-11-01T00:00:00Z` | `2025-05-01T00:00:00Z` – `2026-11-01T00:00:00Z` |
| **Eligible File Filter** | `openapi/**`, `latest/**` (`.yaml`, `.json`) | `src/**`, `types/**` (`.ts`, `.d.ts`) |
| **Plausible API → Consumer Path** | `openapi/spec3.sdk.yaml` & `latest/openapi.spec3.sdk.yaml` | `src/resources/*.ts`, `types/*.d.ts`, `src/apiVersion.ts` |
| **Known Generation / Release Mechanism** | Automated spec snapshot exports from Stripe's internal API definitions (`sync-openapi-specs.sh`). | Most files under `src/resources/` and `types/` carry `// File generated from our OpenAPI spec` and are updated in synchronized codegen releases alongside `src/apiVersion.ts`. |

### Pair 2 · `open-telemetry/opentelemetry-proto` → `open-telemetry/opentelemetry-js` (Archetype B: Wire Protocol → Manual/Hybrid Implementation)

| Field | Upstream (Repo A) | Downstream (Repo B) |
|---|---|---|
| **Repository URL** | `https://github.com/open-telemetry/opentelemetry-proto` | `https://github.com/open-telemetry/opentelemetry-js` |
| **Immutable Head SHA** | `169f2f2c7c1550c364d5eecb05d1b6163a011b06` | `ee94b842fd734e23064539c5f8069e0af0e92b9a` |
| **Total Commits at SHA** | `583` | `3,641` |
| **Observation Window** | `2025-05-01T00:00:00Z` – `2026-11-01T00:00:00Z` | `2025-05-01T00:00:00Z` – `2026-11-01T00:00:00Z` |
| **Eligible File Filter** | `opentelemetry/proto/**` (`.proto`, `.yaml`) | `packages/**`, `experimental/packages/**` (`.ts`, excluding `test/**` when scoring source-only or tracked with test tags) |
| **Plausible API → Consumer Path** | `opentelemetry/proto/{trace,metrics,logs,profiles,common,resource}/v1*/*.proto` | `experimental/packages/otlp-transformer/src/**`, `experimental/packages/exporter-logs-otlp-*/src/**`, `experimental/packages/opentelemetry-exporter-*-otlp-*/src/**` |
| **Known Generation / Release Mechanism** | Language-neutral OTLP protobuf definitions maintained via cross-SIG specification PRs. | `opentelemetry-js` adopts protocol changes asynchronously (often weeks or months after `.proto` merges) via manual TypeScript serializer updates in `otlp-transformer` plus periodic dependency bumps. |

### Pair 3 · `kubernetes/kubernetes` → `kubernetes/client-go` (Archetype C: Monorepo Staging → Published Client Stress Test)

| Field | Upstream (Repo A) | Downstream (Repo B) |
|---|---|---|
| **Repository URL** | `https://github.com/kubernetes/kubernetes` | `https://github.com/kubernetes/client-go` |
| **Immutable Head SHA** | `e3d37bb9fb1d695daff432925cd44b1452df64e1` | `494d62c5edeff3b84f2e6b3e757554c13bc3648f` |
| **Total Commits at SHA** | `143,358` (scoped to `staging/src/k8s.io/{api,apimachinery,client-go}/`) | `5,892` |
| **Observation Window** | `2025-08-01T00:00:00Z` – `2026-11-01T00:00:00Z` | `2025-08-01T00:00:00Z` – `2026-11-01T00:00:00Z` |
| **Eligible File Filter** | `staging/src/k8s.io/client-go/**`, `staging/src/k8s.io/api/**` (`.go`) | `kubernetes/**`, `rest/**`, `tools/**`, `applyconfigurations/**`, `dynamic/**`, `discovery/**` (`.go`) |
| **Plausible API → Consumer Path** | `staging/src/k8s.io/client-go/<subpath>` and `staging/src/k8s.io/api/<group>/<ver>/types.go` | `<subpath>` in `kubernetes/client-go` (e.g., `kubernetes/typed/**`, `tools/cache/**`, `rest/**`) |
| **Known Generation / Mirroring Mechanism** | Kubernetes develops `client-go` inside `staging/src/k8s.io/client-go/` in the main monorepo alongside `zz_generated.*` codegen. | `k8s-publishing-bot` periodically mirrors `staging/src/k8s.io/client-go/` into `kubernetes/client-go` in batch sync commits. This pair intentionally stress-tests whether temporal/path alignment merely rediscovers an automated mirror. |

---

## 4. Human Approval Gate

- **Candidate pairs reviewed and approved prior to full evaluation run:** Yes (2026-11-08, per GU-27 design review).
