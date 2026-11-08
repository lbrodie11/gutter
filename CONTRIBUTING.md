# Contributing to Gutter

Thank you for helping improve Gutter. Before opening a pull request, please read [docs/DECISIONS.md](docs/DECISIONS.md) so changes stay aligned with the project's core boundaries.

## House Rules

1. **Comprehension, not verdicts.** Gutter asks evidence-backed questions ("Does it need a matching change?") and never grades code, suggests rewrites, or blocks merges.
2. **`gutter.json` is the contract.** Every renderer (`brief.md`, `gutter.html`) must read exclusively from `gutter.json`, and every checklist item must cite evidence IDs that resolve inside `gutter.json` (`assertEvidenceResolves`).
3. **Unchecked, never silent.** If an analyzer cannot check a language or import convention (such as unresolved path aliases), report it as `unchecked` or `partial` rather than claiming "no dependents."
4. **Zero direct runtime dependencies.** Keep the runtime dependency-free on Node.js >= 22.6. Co-change statistics belong upstream in [Repo Archaeology](https://github.com/lbrodie11/repo-archaeology).
5. **FRAME/12 grammar.** Any changes to `src/render/comic.ts` must pass `lintPage()` (no raw color literals, font families, or gradients outside `src/render/frame12-tokens.ts`).

## Local Development

Requires **Node.js >= 22.6** and **git**.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

To run the CLI directly against a local repository while developing:

```bash
npm run dev -- brief --base main --print md
```

To re-render the stored example files from `docs/example/gutter.json`:

```bash
node dist/cli.js render docs/example/gutter.json --format md > docs/example/brief.md
node dist/cli.js render docs/example/gutter.json --format html > docs/example/gutter.html
```
