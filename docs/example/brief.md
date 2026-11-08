<!-- gutter:brief -->
### Gutter · change briefing

**feat\(serve\-static\): add cacheControl option**: 2 files across 2 modules (+10/−0)

**Worth a look**

1. `src/middleware/serve-static/index.test.ts` changed alongside `src/middleware/serve-static/index.ts` in 17 of its 20 commits \(95% CI 64%–95%\) but is untouched here\. Does it need a matching change?<br><sub>receipts: [d54720d](https://github.com/honojs/hono/commit/d54720da80134a180f5fe2dd98a7676cfc8f08b4) · [588ec13](https://github.com/honojs/hono/commit/588ec13fa68ea44fed1b5e1b503341db2bf09d70)</sub>
2. `src/adapter/deno/serve-static.ts` changed alongside `src/adapter/bun/serve-static.ts` in 9 of its 11 commits \(95% CI 52%–95%\) but is untouched here\. Does it need a matching change?<br><sub>receipts: [26f8c33](https://github.com/honojs/hono/commit/26f8c33f23e6151873d165107f2dbcadf1204d15) · [1196f14](https://github.com/honojs/hono/commit/1196f14b94e589e2ac44fa7f1c8785d70c1cf83e)</sub>
3. This changes 1 of 3 parallel implementations \(serve\-static\.ts across src/adapter/\*\)\. Should `src/adapter/cloudflare-workers/serve-static.ts` \(\+1 more\) follow?<br><sub>receipts: [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts) · [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts)</sub>

<details open><summary><b>Likely forgotten</b> · 3 files that usually change with this PR</summary>

| Untouched file | Usually changes with | Together | 95% CI | Last together | Receipts |
|---|---|---|---|---|---|
| [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts) | [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.ts) | 17/20 | 64%–95% | 2026-10-16 | [d54720d](https://github.com/honojs/hono/commit/d54720da80134a180f5fe2dd98a7676cfc8f08b4) [588ec13](https://github.com/honojs/hono/commit/588ec13fa68ea44fed1b5e1b503341db2bf09d70) [8b05c77](https://github.com/honojs/hono/commit/8b05c774ef1555c70f5ba5e2991b7e77cc3635cc) |
| [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts) | [`src/adapter/bun/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/serve-static.ts) | 9/11 | 52%–95% | 2026-05-16 | [26f8c33](https://github.com/honojs/hono/commit/26f8c33f23e6151873d165107f2dbcadf1204d15) [1196f14](https://github.com/honojs/hono/commit/1196f14b94e589e2ac44fa7f1c8785d70c1cf83e) [246a06a](https://github.com/honojs/hono/commit/246a06aa1d35aa206dcf11186b3aa90badb2de72) |
| [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts) | [`src/adapter/bun/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/serve-static.ts) | 6/11 | 28%–79% | 2026-05-16 | [26f8c33](https://github.com/honojs/hono/commit/26f8c33f23e6151873d165107f2dbcadf1204d15) [f8371ab](https://github.com/honojs/hono/commit/f8371ab356f79fcf762c66aa372448a8018bcfc7) [d74d95d](https://github.com/honojs/hono/commit/d74d95d11c8d06ff7588a3a2e899e3843c4a7d1e) |

<sub>3 weaker matches not shown.</sub>

</details>

<details><summary><b>What it touches</b> · 2 changed files with importers outside this PR (partial)</summary>

- [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.ts) ← [`src/adapter/cloudflare-workers/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/cloudflare-workers/serve-static.ts), [`src/adapter/deno/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/deno/serve-static.ts), [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts)
- [`src/adapter/bun/serve-static.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/serve-static.ts) ← [`src/adapter/bun/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/adapter/bun/index.ts)

</details>

<sub>84 imports use aliases or packages Gutter can't resolve yet, so some importers may be missing.</sub>

<details><summary><b>Tests</b> · 0 updated · 1 untouched · 1 with no test found</summary>

- [`src/middleware/serve-static/index.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.ts) → [`src/middleware/serve-static/index.test.ts`](https://github.com/honojs/hono/blob/eb754bd5ef22c63f1634a4c374a86be086f85710/src/middleware/serve-static/index.test.ts) not changed

</details>

<details><summary><b>What changed</b> · by module</summary>

| Module | Files | +/− |
|---|---|---|
| `src/middleware` | 1 | +8/−0 |
| `src/adapter` | 1 | +2/−0 |

</details>

<sub>Replayed on the last 375 commits: when it flagged files, at least one really did change 73% of the time \(6\.8× better than guessing busy files\), and 57% of all flagged files did\. · No AI wrote this: every line comes from git history and the code · gutter 0.1.0 + repo-archaeology 0.3.0</sub>
