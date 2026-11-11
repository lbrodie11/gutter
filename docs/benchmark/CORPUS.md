# GU-30 · Gate A′ corpus run (preregistration)

**Status:** PREREGISTERED on 2026-11-10. Sections 1–5 were committed, together with the ROADMAP amendment and `bench/corpus.json`, before any corpus run, any seeded mutation run, and any result. They must not be edited afterwards; any change goes under a dated `## Errata` entry at the end of this file. `test/gu30-prereg.test.ts` checks that this commit precedes every results commit and that sections 1–5 are unchanged since.
**Decision owner:** the rule in section 5, applied mechanically. Post-hoc reading goes in a separate, labeled paragraph and cannot change the verdict.
**Scope:** measurement only. No product default, `gutter.json` field or public schema changes. Bench records gain three additive optional fields (section 2).

## Why

M0's exit test is Gate A′ (`docs/ROADMAP.md`, DECISIONS #17): is Gutter quiet, true and non-predictive on the median repository? It has only been measured on hono, where `broken-import` fired 0 times in 200 merged PRs in both the GU-29 and GU-05 runs. Merged PRs passed CI, so they rarely contain a broken import, and Repo Archaeology's RA-18 pilot hit the same wall. This run measures Gate A′ on 20 repositories and exercises the `broken-import` truth check with seeded pull requests whose answers are known.

## 1. Corpus

Twenty public repositories, chosen by rule on 2026-11-10 by [`bench/corpus-select.ts`](../../bench/corpus-select.ts) from the saved GitHub search results in [`bench/corpus-candidates.json`](../../bench/corpus-candidates.json). Every candidate considered, and why it was taken or skipped, is in [`bench/corpus-selection.json`](../../bench/corpus-selection.json). The corpus itself is [`bench/corpus.json`](../../bench/corpus.json), validated against [`bench/corpus.schema.json`](../../bench/corpus.schema.json).

**Selection procedure.**

1. `honojs/hono` at `eb754bd` is included for continuity with Stage 0, GU-29 and GU-05.
2. Every other category is a `gh search repos` query, sorted by stars (descending, first 40 results), with the global filters: not archived; pushed after 2026-08-12 (activity in the last 90 days); repository size under 100,000 KB (so one repository fits the 45-minute budget).
3. Candidates are taken in star order. A candidate is skipped when it was already taken by an earlier category, when it fails its category's structural check at the pin, or when Gutter's own discovery funnel (`discoverChangeUnits`, the same code `gutter bench` uses) reaches fewer than 200 merged PRs at the pin.
4. **Pin:** the newest first-parent commit of the default branch at or before 2026-11-03T23:59:59Z, so every PR's 7-day follow-up window ends before selection. hono keeps `eb754bd`.
5. Categories, in this order (a repository counts in the first that takes it):

| Category | Query | Structural check at the pin | Take |
|---|---|---|---|
| `ts-library` | `--language=typescript --topic=library` | root `package.json`, no workspace manifest, ≥ 20 TS/JS files | 5 |
| `ts-app-paths` | `--language=typescript --topic=nextjs` | a `tsconfig*.json` with `compilerOptions.paths`; not a workspace monorepo | 3 |
| `ts-monorepo` | `--language=typescript --topic=monorepo` | root `package.json` `workspaces` or `pnpm-workspace.yaml`; ≥ 20 TS/JS files | 3 |
| `go` | `--language=go` | root `go.mod`; ≥ 50 `.go` files | 3 |
| `python` | `--language=python` | root `pyproject.toml` or `setup.py`; ≥ 50 `.py` files | 3 |
| `young` (expected hard) | `--language=typescript --created=>=2025-11-10` | ≥ 20 TS/JS files | 1 |
| `generated` (expected hard) | `"generated with Stainless" in:readme --language=typescript` | ≥ 20 TS/JS files | 1 |

**Merge style** is measured on the 200 newest reachable PRs: `merge` when ≥ 80% are merge commits, `squash` when ≤ 20% are, otherwise `mixed`. **Bot share** is the share of those PRs whose authors or subject match Gutter's bot/agent patterns (`isBotOrAgentStrings`); "heavy bot or agent commits" means ≥ 0.20.

**The corpus** (all fields from `bench/corpus.json`):

| # | Repository | Pinned SHA | Branch | Language | Category | Merge style | Bot share | Expected |
|---|---|---|---|---|---|---|---|---|
| 1 | [`honojs/hono`](https://github.com/honojs/hono) | `eb754bd5ef22c63f1634a4c374a86be086f85710` | `main` | typescript | continuity | squash | 0.00 | good |
| 2 | [`remarkablemark/html-react-parser`](https://github.com/remarkablemark/html-react-parser) | `46e79e4cf4ef6cd7a5c280ed9c8885ac4fad6632` | `master` | typescript | ts-library | squash | 0.98 | good |
| 3 | [`faastjs/faast.js`](https://github.com/faastjs/faast.js) | `0038379bf4669c7abcc93d2b821f62313c0f6210` | `master` | typescript | ts-library | squash | 1.00 | good |
| 4 | [`binance/binance-connector-js`](https://github.com/binance/binance-connector-js) | `62a2ec1a164f8e2238b81f5163b5d08f073d56f5` | `master` | typescript | ts-library | squash | 0.00 | good |
| 5 | [`allianz/ng-aquila`](https://github.com/allianz/ng-aquila) | `5b23a36e0b47a1dd90a6ffe36e50e7b2cbf7a9a4` | `main` | typescript | ts-library | squash | 0.01 | good |
| 6 | [`matrix-org/matrix-appservice-bridge`](https://github.com/matrix-org/matrix-appservice-bridge) | `6392ab0550e23fffa9f014411148c667ba2e77da` | `develop` | typescript | ts-library | mixed | 0.09 | good |
| 7 | [`ChatGPTNextWeb/NextChat`](https://github.com/ChatGPTNextWeb/NextChat) | `1d3dc331512929a4b1d3e82354e72acce33b5c7a` | `main` | typescript | ts-app-paths | merge | 0.04 | good |
| 8 | [`DayuanJiang/next-ai-draw-io`](https://github.com/DayuanJiang/next-ai-draw-io) | `c9dc5f5cc62e7e5a327a62b39027d80033e1548c` | `main` | typescript | ts-app-paths | squash | 0.13 | good |
| 9 | [`slymnoyann/hey.xyz`](https://github.com/slymnoyann/hey.xyz) | `44dee0c1223b9202699915fd3e92e670fd8e34e6` | `main` | typescript | ts-app-paths | squash | 0.12 | good |
| 10 | [`lerna/lerna`](https://github.com/lerna/lerna) | `d6226111673016062ba099b2876334069407ef41` | `main` | typescript | ts-monorepo | squash | 0.61 | good |
| 11 | [`vbenjs/vue-vben-admin`](https://github.com/vbenjs/vue-vben-admin) | `71dc5ac59dcd832e45df861a283746a3cd143125` | `main` | typescript | ts-monorepo | squash | 0.03 | good |
| 12 | [`hypit-ai/hypit`](https://github.com/hypit-ai/hypit) | `0762c6be56c0af43fff3cdbdb285e21414dd249b` | `main` | typescript | ts-monorepo | mixed | 0.15 | good |
| 13 | [`ollama/ollama`](https://github.com/ollama/ollama) | `e9fde36d75fea66579d84099956ce1430792737a` | `main` | go | go | squash | 0.11 | good |
| 14 | [`fatedier/frp`](https://github.com/fatedier/frp) | `331abd5aa144e3f105abba29a22af701acf1a298` | `dev` | go | go | squash | 0.01 | good |
| 15 | [`gin-gonic/gin`](https://github.com/gin-gonic/gin) | `0f09c3a9b4626d9fe9979cf4d0521d6ae32ab646` | `master` | go | go | squash | 0.23 | good |
| 16 | [`TheAlgorithms/Python`](https://github.com/TheAlgorithms/Python) | `574d100b7181956e9c8384552fd078165e4cc326` | `master` | python | python | squash | 0.10 | good |
| 17 | [`yt-dlp/yt-dlp`](https://github.com/yt-dlp/yt-dlp) | `b77c9304e1c4220cca450c583491904daf8455af` | `master` | python | python | squash | 0.00 | good |
| 18 | [`github/spec-kit`](https://github.com/github/spec-kit) | `a227e38315cd38172b04f2fb8f06ce8b69b38331` | `main` | python | python | squash | 0.27 | good |
| 19 | [`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph) | `f72c9d2efb14454ff4f9fd7b8460abd82f19a287` | `main` | typescript | young | squash | 0.01 | hard |
| 20 | [`team-telnyx/telnyx-node`](https://github.com/team-telnyx/telnyx-node) | `db3dd007839c35b3adb454606c23f216f98deb7c` | `master` | typescript | generated | squash | 0.65 | hard |

Coverage of the prompt's requirements: hono; 10 more TypeScript/JavaScript repositories outside the app category (5 libraries, 3 monorepos, 1 young, 1 generated); 3 apps with `paths` aliases; 3 workspace monorepos; 3 Go; 3 Python; 6 with bot share ≥ 0.20; 2 expected hard; merge styles: merge, mixed and squash.

## 2. Real-PR runs

[`bench/run-corpus.mjs`](../../bench/run-corpus.mjs), per repository, against a blobless clone in `$GUTTER_BENCH_CACHE` (default `~/.cache/gutter-bench`) checked out at the pinned SHA:

1. `gutter bench --cwd <clone> --prs 200 --window-days 7` with the default configuration (no `--config`), production policy, repo-archaeology as installed (0.10.0, the dev pin).
2. `bench/gate-a-prime.ts` on that `bench.json`: replays every PR in default mode and re-checks every `broken-import`, `untested-change` and test-history fact (unchanged since GU-29 except that its wording check strips paths and branch names, GU-29 review).
3. The seeded run (section 3).
4. `repo-archaeology backtest --json` and `repo-archaeology backtest --compare-origin-weights bot=0,agent=0.5 --json` at the pin (ROADMAP M0 items; reported, never decisive).

`--jobs` (default 2) repositories run at once; a run resumes from per-step status files; each repository has a 45-minute timeout for steps 1–3 together. Versions (gutter, repo-archaeology, git, Node, TypeScript), the machine, wall time per repository and step, and every failure with its reason are recorded. A repository that fails or times out is listed with the step and reason, never silently dropped. A repository with fewer than 200 evaluated PRs is listed with its count.

**Bench records gain three additive, optional fields** (`schema/bench.schema.json`): `coverage` (the production brief's `dependents.coverage`), `unresolvedByReason` (`dependents.unresolved.byReason`) and `uncheckedLanguages` (languages of changed files in `dependents.unchecked`), so coverage is measured on every PR.

## 3. Seeded mutations (the `broken-import` truth check)

Implemented by [`bench/seeded.ts`](../../bench/seeded.ts). Nothing from the analyzed repositories is installed, built or run.

- **Seed:** `20261110`, mixed with the repository name (`owner/repo`, FNV-1a), PRNG mulberry32. Deterministic for a fixed seed, pin and corpus.
- **Hosts:** 3 distinct PR heads, drawn with the seed from the PRs in that repository's `bench.json`. Each mutation is one commit whose parent is a host, written with git plumbing (temporary index, `hash-object -w` from a file, `commit-tree`; fixed author, committer and date; no checkout). Gutter's replay (`replayBriefWithMeta`, default configuration, `noCalibration: true`) analyzes the synthetic PR host → mutation commit.
- **Quotas:** 30 positives and 30 negative controls per repository, split as evenly as possible across the 3 hosts.
- **Oracle (ground truth), by module resolution, never by symbol references (RA-18's lesson),** independent of Repo Archaeology:
  - TypeScript/JavaScript: TypeScript's `resolveModuleName` with the importer's nearest `tsconfig.json`/`jsconfig.json` (with `extends`; `Bundler` resolution when none is set), every `package.json` name in the tree linked virtually under `node_modules` (so workspace imports and `exports` subpaths resolve), imports read by `ts.preProcessFile` (static, dynamic, `require`, `export … from`, type-only included). Files under `node_modules`, `vendor`, `dist`, `build`, `third_party`, `testdata` and `.d.ts` files are not sources.
  - Go: each `go.mod` maps a module path to a directory; an import path resolves to a package directory that has ≥ 1 non-test `.go` file.
  - Python: dotted names over the source roots (the repository root and any `src/` or `lib/` directory at depth ≤ 4); `import a.b`, `from a.b import x`, relative `from .b import x`, and `from a import b` when `a/b.py` is a module.
- **Positives** (kinds `delete` and `rename`, round robin): a source unit with ≥ 1 importer outside it (TS/JS and Python: a non-test file; Go: a package's non-test files) is deleted, or renamed (`<stem>_seeded_moved`, Go: directory `<dir>_seededmoved`), leaving its importers untouched. Accepted only if the oracle finds ≥ 1 untouched importer whose specifier resolved to the removed target at the host and fails to resolve after the mutation.
- **Negative controls** (round robin, quota 30 / 4 per kind, shortfalls filled by the other kinds in order): `rename-updated` (a rename with every importer's specifier rewritten; TS/JS only for relative, non-`index` specifiers; Python for `from`/`import` module forms); `delete-unimported` (a non-test source file with no importer; Go: one non-test file of a package that keeps others); `move-reexport` (the file moves to `<stem>_seeded_moved` and the old path becomes `export * from` / `from … import *` of it; not applicable to Go); `test-only` (a test file gains one comment line). Accepted only if the oracle finds no importer left broken.
- **Scoring**, per mutation, from the replayed brief:
  - *Reported item:* a `broken-import` checklist item. It is *confirmed* when every importer it names is an importer the oracle left broken for that removed target (Go: the removed file's package).
  - *Detected positive:* a reported item names one of the positive's removed paths.
  - *Skipped:* a positive not detected whose removed path is in `dependents.unchecked` (`unchecked`) or whose brief has `coverage: partial` (`partial`). Reported separately; never counted as a hit.
  - *False positive:* a negative control with any reported item.

## 4. Metrics

Per repository with Wilson 95% intervals for rates, plus the median repository and the pooled corpus. The median is over completed repositories (bench, gate and seeded steps all finished); with an even count it is the mean of the two middle values.

- **(a) Loudness:** quiet, brief and full shares of evaluated PRs; checklist items per PR; the share of PRs carrying each checklist kind (`wide-surface` reported first).
- **(b) Truth:**
  - real-PR `broken-import` items and the share confirmed by `gate-a-prime.ts` (TypeScript resolution for TS/JS, file existence otherwise);
  - seeded **precision** = confirmed reported items ÷ reported items (positives and negatives together); seeded **recall** = detected positives ÷ positives (skipped positives stay in the denominator); seeded **false-positive rate** = negative controls with a reported item ÷ negative controls; the skipped share (`unchecked`, `partial`) of positives;
  - `untested-change` and test-history facts confirmed by `gate-a-prime.ts` (expected 100%).
- **(c) Wording:** banned-word hits in Gutter's own text on every replayed page (`gate-a-prime.ts`: PR text, paths and branch names stripped).
- **Coverage:** the share of PRs with `coverage: partial`, unresolved imports by reason, and the languages listed as unchecked, per language group (TS/JS, Go, Python).
- **Runtime:** p50 and p95 of replay time per PR (bench `timings`), and wall time per repository.
- **Reported, never decisive:** the two backtests (precision, hit rate, lift) and the difference the origin weights make.

## 5. Verdict rule (preregistered; applied mechanically)

Copied verbatim from the GU-30 prompt:

> * PASS: all three hold:
>    * (a) the median repo's full share ≤ 1/3;
>    * (b) if real PRs give ≥ 20 `broken-import` items pooled, ≥ 95% of them are confirmed. Otherwise, seeded pooled precision ≥ 0.95 and recall ≥ 0.90, with no repo below 0.85 precision. Also, `untested-change` and test-history facts are 100% correct in every repo;
>    * (c) zero banned-word hits.
> * INCONCLUSIVE: fewer than 15 repos completed, or (b) can't be computed for ≥ 3 language groups (TS/JS, Go, Python). Say exactly what's missing.
> * FAIL: otherwise. List the top three failure classes by count, and propose variants (as `bench/variants/*.json`, run with `--config`). Don't change defaults in this PR.
> * Post-hoc reading goes in a separate, labeled paragraph and can't change the verdict.

**Application order** (fixed now): INCONCLUSIVE → PASS → FAIL; the first that holds is the verdict. Thresholds compare point estimates.

**Definitions fixed now:**

- *Completed repository:* steps 1–3 of section 2 finished within the timeout. Backtests (step 4) never affect completion.
- *(b) computable for a language group:* ≥ 10 seeded positives were scored in completed repositories of that group (so recall is defined). A group below that is "not computable" and named.
- *Pooled seeded precision* is over all reported items in completed repositories; with no reported item it is undefined, and then (b) does not hold. A repository with no reported item has no precision and does not trip "no repo below 0.85 precision"; its positives still count in pooled recall.
- *`untested-change` and test-history 100% in every repo:* every completed repository with ≥ 1 such fact confirms all of them; a repository with none is "not exercised" for that clause, never "met".
- *Real-PR items:* `broken-import` items re-checked by `gate-a-prime.ts` across completed repositories.
- *Failure classes* (for FAIL): every missed seeded positive (`missed positive: <language>, <kind>, <unchecked | partial | missed>`), every seeded false positive (`false positive: <language>, <kind>`), every unconfirmed reported item (`unconfirmed item: <language>`), every repository with full share > 1/3 (`loud: <category>`), every banned-word hit (`wording`), every unconfirmed `untested-change` or test-history fact (`fact: <kind>`). Ranked by count; ties by name.

## Results

Generated by [`bench/aggregate.mjs`](../../bench/aggregate.mjs) into [`docs/benchmark/README.md`](README.md) and [`docs/benchmark/results.json`](results.json). Raw data: `docs/benchmark/data/<owner>__<repo>/corpus/`.

**Verdict (mechanical, §5): FAIL.** 20 of 20 repositories completed. (a) met: the median repository's full share is 0.00. (c) met: zero banned-word hits. (b) not met: real PRs produced 0 `broken-import` items, so (b) was evaluated on the seeded mutations. Pooled precision is 0.98 (361/367, needs ≥ 0.95), but pooled recall is 0.63 (366/579, needs ≥ 0.90); the false-positive rate is 0.00 (1/600). `untested-change` and test-history facts were 100% correct in every repository that had any.

**Top three failure classes** (from `results.json`): missed positive, Python, rename, `partial` (43); missed positive, Go, delete, `partial` (41); missed positive, Go, rename, `partial` (40).

**Variants.** §5 asks for `bench/variants/*.json` proposals. None is proposed, because no configuration key changes these classes: Gutter maps an import of a removed file to a broken import only for relative TS/JS specifiers (`src/evidence/import-graph.ts`, a GU-05 decision), and no `.gutter.json` key alters that. The fix is code, in a follow-up prompt.

### Run notes

- **Disk full during the run (infrastructure, not Gutter).** The machine's volume filled up (about 2 GB free of 460 GB, from other software). `hypit-ai/hypit`'s bench step failed with `No space left on device` while git fetched an object, and the runner then exited mid-run (its last log write was lost; ENOSPC presumed). The runner was resumed with the same command (`node bench/run-corpus.mjs --jobs 2`): finished steps were kept, `TheAlgorithms/Python`'s gate step was rerun (deterministic), `yt-dlp/yt-dlp`'s bench resumed from its saved PRs, and hypit's failed bench step was retried and completed. hypit's recorded wall time includes the failed attempt.
- **Shortfalls:** `remarkablemark/html-react-parser` produced 18 positives (too few files with importers) and `gin-gonic/gin` 21; both are listed in `README.md`. Every other repository reached 30 positives and 30 negative controls.
- **Runtime:** the slowest repository took 23.4 minutes of its 45-minute budget (`hypit-ai/hypit`, including the failed attempt); no repository timed out. "Replay time per PR" in `README.md` is the sum of the bench's per-stage p50/p95 (session, static analysis, brief), because bench records do not store a per-PR total.

### Reading of the evidence (post-hoc, 2026-11-10; not part of the rule and cannot change the verdict)

1. **The failure is language coverage, not correctness.** In the 14 TS/JS repositories, seeded recall is 0.90 (366/408) and precision 0.98 (361/367). In Go (0/81) and Python (0/90), Gutter reported nothing at all, so it was never wrong there either, only silent. Repo Archaeology's import graph resolves Go packages and Python modules, but Gutter's GU-05 mapping from "removed path" to importers reads only relative `target-missing` specifiers.
2. **Within TS/JS, the misses are aliases.** The three lowest TS/JS recalls are the `paths`-alias apps and an alias-using monorepo (`next-ai-draw-io` 0.40, `hey.xyz` 0.60, `vue-vben-admin` 0.80), the GU-05 follow-up "map `target-missing` alias/workspace specifiers to deleted files".
3. **Quiet holds everywhere.** No repository produced a single `full` page in 200 PRs (so the "highest full share" list in `README.md` is a tie at 0.00, listed alphabetically). The median repository is quiet on 0.56 of PRs and brief on 0.44, and `wide-surface` (on 0.20 of PRs at the median, 0.81 on `codegraph`) is the main reason a page is brief.
4. **`coverage: partial` is honest but uninformative.** At the median repository every PR is `partial`, because one unresolved import anywhere marks every PR. A per-PR or per-file scope would make the label useful.
5. **What would change the verdict:** mapping Go package and Python module removals (and TS/JS aliases) to their importers. On this data, recall would then be bounded by how often Repo Archaeology resolves those imports; a rerun needs a new preregistration and seed.

## Errata

- **2026-11-10, before any corpus result (instrument fix, no rule or threshold change).** A smoke run of the seeded harness on hono (12 mutations, not committed as data) found that both TypeScript oracles (`bench/seeded.ts` and the broken-import re-check in `bench/gate-a-prime.ts`) failed to resolve a directory specifier such as `import '.'`: TypeScript probes directories with a trailing slash, which the virtual hosts did not normalize. Such importers were missing from the ground truth, so a correct Gutter item naming one would have counted as unconfirmed. Both hosts now strip trailing slashes; `test/gu30.test.ts` covers `.` and `./dir` specifiers in both. Section 2's "unchanged since GU-29" for `gate-a-prime.ts` now reads: unchanged except for this fix and the GU-29 review's path stripping.
- **2026-11-11, GU-31, after GU-30's results and before Rerun 1's preregistration (§6): GU-30's seven precision cases, classified; instrument fix, no rule or threshold change; GU-30's results are not edited.** GU-30 reported 6 unconfirmed TS/JS items, one of them on the single false-positive control (`colbymchenry/codegraph`, `rename-updated`). Each was re-read at its mutation commit:

  | Repository · mutation | Extra importer Gutter named | What the file does | Classification |
  |---|---|---|---|
  | `binance/binance-connector-js` · `6b8d0a5-delete-9` | `clients/dual-investment/src/index.ts` | `export * as DualInvestmentRestAPI from './rest-api'` | oracle wrong: `ts.preProcessFile` drops `export * as ns from` |
  | `lerna/lerna` · `3e74703-delete-0` | `libs/core/src/index.ts` | `export * as npmDistTag from "./lib/npm-dist-tag"` | oracle wrong (same) |
  | `matrix-org/matrix-appservice-bridge` · `f5dba5a-rename-0` | `src/index.ts` | `export * as Logging from "./components/logging"` | oracle wrong (same) |
  | `colbymchenry/codegraph` · `8bd55fa-delete-5` | `ui/src/lib/steps-model.ts` | imports `./screens-model`; the file holds a literal NUL byte in a template string | oracle wrong: the oracle's reader (`GitTreeReader`) skips NUL-containing files as binary |
  | `colbymchenry/codegraph` · `fa03fa6-rename-updated-18` (the false positive) | `src/upgrade/index.ts` | `await import('../installer/targets/claude')` at line 956 | oracle wrong: `ts.preProcessFile` missed the call, so the control did not rewrite this importer and the rename really broke it |
  | `team-telnyx/telnyx-node` · `dbc903d-rename-5` | `src/resources/comments_seeded_moved.ts` | the moved copy keeps `import * as CommentsAPI from './comments'` (a self-import), which no longer resolves | ambiguous: true, but outside the oracle's definition (§3 counts importers that existed at the host) |

  No case was a Gutter error. **Oracle fix (erratum 2), applied to both TypeScript oracles (`bench/seeded.ts`, and the broken-import re-check in `bench/gate-a-prime.ts`) before any Rerun 1 data:** import specifiers come from a walk of TypeScript's AST (`importSpecifiers`: `import`/`export … from` including `export * as ns from`, `import x = require()`, `import()` and `require()` calls anywhere, `import('x')` types) in union with `ts.preProcessFile`; and the seeded oracle reads a blob that `GitTreeReader` rejects (a NUL byte) as raw text. Everything else in §3 (module resolution, hosts, quotas, kinds, scoring) is unchanged. `test/gu31.test.ts` covers each case.

## 6. Rerun 1 (preregistration)

**Status:** PREREGISTERED on 2026-11-11 (GU-31). This section was committed before any Rerun 1 data: no Rerun 1 seeded mutation, replay or result existed when it was written. It must not be edited afterwards; any change goes under a dated entry in `## Errata`. `test/gu31-prereg.test.ts` checks that this commit precedes every Rerun 1 data commit, that this section is unchanged since, and that the rule below is §5's, verbatim.
**Why a rerun:** GU-30's verdict was FAIL on (b): seeded recall 0.63 (366/579), with Go (0/81) and Python (0/90) silent. GU-31 changed how `broken-import` is detected: the importers of a deleted or renamed-away path now come from Repo Archaeology's import graph at the PR's base tree, checked against the head graph, in every language Repo Archaeology resolves (`dependents.method: base-graph`; DECISIONS #20). `CORPUS.md` requires a new preregistration and a new seed for a rerun.
**Decision owner:** the rule in §6.5 (§5's), applied mechanically. Post-hoc reading goes in a separate, labeled paragraph and cannot change the verdict. GU-30's results are not edited; both runs are published side by side.

### 6.1 Corpus

The **same** 20 repositories and pins as §1: `bench/corpus.json`, unchanged since GU-30's preregistration commit (`test/gu30-prereg.test.ts` checks it). The clones in `$GUTTER_BENCH_CACHE` are checked out at the same pins.

### 6.2 Real PRs: (a), (c) and the real-PR facts of (b)

No new `gutter bench` run. For each repository, `bench/gate-a-prime.ts` replays the same PRs as GU-30 (the 200 in `docs/benchmark/data/<owner>__<repo>/corpus/bench/bench.json`) with the GU-31 code (default configuration, `noCalibration: true`, as in GU-30), and records every replay (salience, checklist kinds, coverage, `dependents.method`, whether the PR removes a file, wall time, base-graph time). Then:

- **(a) Loudness** is measured on these replays: the full share is the share of replayed briefs whose salience is `full`. (GU-30 measured it on `bench.json`; its replays agreed with `bench.json` on every PR: 0 salience and 0 checklist-kind mismatches in all 20 repositories.)
- **(b) Real-PR facts:** `broken-import`, `untested-change` and test-history facts in the replays are re-checked as in §2 (TypeScript resolution for TS/JS `broken-import`, with erratum 2's AST walk; file existence otherwise).
- **(c) Wording:** banned-word hits in Gutter's own text on every replayed page, as in §2.

### 6.3 Seeded mutations: (b)

Exactly §3, with two differences only:

- **Seed: `20261111`** (GU-30: `20261110`), mixed with the repository name as in §3 (FNV-1a, mulberry32). New hosts and new mutations follow from it.
- **Oracle:** §3's, with erratum 2 (2026-11-11: AST import walk in both TypeScript oracles; NUL-byte blobs read as text). Module resolution, the Go and Python oracles, the source and test rules, and the scoring are unchanged.

The **same** quotas: 3 hosts; 30 positives (`delete`, `rename`, round robin) and 30 negative controls (`rename-updated`, `delete-unimported`, `move-reexport`, `test-only`, round robin, shortfalls filled by the other kinds) per repository. The same acceptance rule (the oracle must find ≥ 1 broken untouched importer for a positive, none for a negative control). The same scoring (reported item, confirmed, detected, skipped as `unchecked`/`partial` but kept in the recall denominator, false positive).

### 6.4 Runs, metrics and outputs

- Command: `node bench/run-corpus.mjs --rerun rerun1 --seed 20261111 --jobs 2` (steps: clone at the pin, the gate replay of §6.2, the seeded run of §6.3; 45-minute timeout per repository for the last two together). A repository that fails or times out is listed with its step and reason, never dropped.
- Raw data: `docs/benchmark/data/<owner>__<repo>/rerun1/` and `docs/benchmark/data/rerun1-run.json`. Results: `docs/benchmark/results-rerun1.json`, by `bench/aggregate.mjs`, with GU-30 and Rerun 1 side by side in `docs/benchmark/README.md`.
- Metrics: §4's, per repository, median repository and pooled, with Wilson 95% intervals; loudness, coverage and runtime from the replays of §6.2. Performance (reported, never decisive): per-PR replay p50 and p95, split by whether the PR removes a file, with and without the base graph's own time.
- *Completed repository:* the gate replay and the seeded run both finished within the timeout.

### 6.5 Verdict rule (§5, verbatim; applied mechanically)

The rule, its application order and its definitions are §5's, copied verbatim. Where they name section 2's steps, Rerun 1 reads §6.4: a completed repository finished the gate replay and the seeded run.

> * PASS: all three hold:
>    * (a) the median repo's full share ≤ 1/3;
>    * (b) if real PRs give ≥ 20 `broken-import` items pooled, ≥ 95% of them are confirmed. Otherwise, seeded pooled precision ≥ 0.95 and recall ≥ 0.90, with no repo below 0.85 precision. Also, `untested-change` and test-history facts are 100% correct in every repo;
>    * (c) zero banned-word hits.
> * INCONCLUSIVE: fewer than 15 repos completed, or (b) can't be computed for ≥ 3 language groups (TS/JS, Go, Python). Say exactly what's missing.
> * FAIL: otherwise. List the top three failure classes by count, and propose variants (as `bench/variants/*.json`, run with `--config`). Don't change defaults in this PR.
> * Post-hoc reading goes in a separate, labeled paragraph and can't change the verdict.

**Application order** (fixed now): INCONCLUSIVE → PASS → FAIL; the first that holds is the verdict. Thresholds compare point estimates.

**Definitions fixed now:**

- *Completed repository:* steps 1–3 of section 2 finished within the timeout. Backtests (step 4) never affect completion.
- *(b) computable for a language group:* ≥ 10 seeded positives were scored in completed repositories of that group (so recall is defined). A group below that is "not computable" and named.
- *Pooled seeded precision* is over all reported items in completed repositories; with no reported item it is undefined, and then (b) does not hold. A repository with no reported item has no precision and does not trip "no repo below 0.85 precision"; its positives still count in pooled recall.
- *`untested-change` and test-history 100% in every repo:* every completed repository with ≥ 1 such fact confirms all of them; a repository with none is "not exercised" for that clause, never "met".
- *Real-PR items:* `broken-import` items re-checked by `gate-a-prime.ts` across completed repositories.
- *Failure classes* (for FAIL): every missed seeded positive (`missed positive: <language>, <kind>, <unchecked | partial | missed>`), every seeded false positive (`false positive: <language>, <kind>`), every unconfirmed reported item (`unconfirmed item: <language>`), every repository with full share > 1/3 (`loud: <category>`), every banned-word hit (`wording`), every unconfirmed `untested-change` or test-history fact (`fact: <kind>`). Ranked by count; ties by name.
