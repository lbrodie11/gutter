<!-- gutter:brief -->
### Gutter · change briefing

**feat\(serve\-static\): add cacheControl option**: 2 files across 2 modules (+14/−0)

**Worth a look**

1. `src/middleware/serve-static/index.ts` changed \(\+12/−0\); its test file `src/middleware/serve-static/index.test.ts` didn't change in this PR\.<br><sub>receipts: [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts)</sub>

<details><summary><b>Usually changes with</b> (history, not a prediction) · 4 pairs</summary>

- [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.ts) and [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts) changed together in 17 of 20 commits; [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts) isn't in this PR · last together 2026\-10\-16<br><sub>receipts: [d54720d](https://github.com/honojs/hono/commit/d54720da80134a180f5fe2dd98a7676cfc8f08b4) [588ec13](https://github.com/honojs/hono/commit/588ec13fa68ea44fed1b5e1b503341db2bf09d70) [8b05c77](https://github.com/honojs/hono/commit/8b05c774ef1555c70f5ba5e2991b7e77cc3635cc)</sub>
- [`src/adapter/bun/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/serve-static.ts) and [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts) changed together in 9 of 11 commits; [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts) isn't in this PR · last together 2026\-05\-16<br><sub>receipts: [26f8c33](https://github.com/honojs/hono/commit/26f8c33f23e6151873d165107f2dbcadf1204d15) [1196f14](https://github.com/honojs/hono/commit/1196f14b94e589e2ac44fa7f1c8785d70c1cf83e) [246a06a](https://github.com/honojs/hono/commit/246a06aa1d35aa206dcf11186b3aa90badb2de72)</sub>
- [`src/adapter/bun/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/serve-static.ts) and [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts) changed together in 6 of 11 commits; [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts) isn't in this PR · last together 2026\-05\-16<br><sub>receipts: [26f8c33](https://github.com/honojs/hono/commit/26f8c33f23e6151873d165107f2dbcadf1204d15) [f8371ab](https://github.com/honojs/hono/commit/f8371ab356f79fcf762c66aa372448a8018bcfc7) [d74d95d](https://github.com/honojs/hono/commit/d74d95d11c8d06ff7588a3a2e899e3843c4a7d1e)</sub>
- Parallel implementations (serve\-static\.ts across src/adapter/\*): this PR changes 1 of 3; not in this PR: [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts), [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts)

<sub>3 weaker pairs not shown.</sub>

</details>

<details><summary><b>What it touches</b> · 2 changed files with importers outside this PR (partial)</summary>

- [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.ts) ← [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts), [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts), [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts)
- [`src/adapter/bun/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/serve-static.ts) ← [`src/adapter/bun/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/index.ts)

</details>

<sub>84 imports use aliases or packages Gutter can't resolve yet, so some importers may be missing.</sub>

<details><summary><b>Tests</b> · 0 updated · 1 unchanged · 1 with no test found</summary>

- [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts) — unchanged in this PR · changed together with [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.ts) in 17 of 20 commits<br><sub>receipts: [d54720d](https://github.com/honojs/hono/commit/d54720da80134a180f5fe2dd98a7676cfc8f08b4) [588ec13](https://github.com/honojs/hono/commit/588ec13fa68ea44fed1b5e1b503341db2bf09d70) [8b05c77](https://github.com/honojs/hono/commit/8b05c774ef1555c70f5ba5e2991b7e77cc3635cc)</sub>

<sub>Test rows are facts about this PR and past commits, not a request to change anything\.</sub>

</details>

<details><summary><b>What changed</b> · by module</summary>

| Module | Files | +/− |
|---|---|---|
| `src/middleware` | 1 | +12/−0 |
| `src/adapter` | 1 | +2/−0 |

</details>

<sub>Replayed on the last 375 commits: when it flagged files, at least one really did change 73% of the time \(6\.8× better than guessing busy files\), and 57% of all flagged files did\. · No AI wrote this: every line comes from git history and the code · gutter 0.2.1 + repo-archaeology 0.3.0</sub>
