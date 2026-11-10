# Reproducing the Hono Example (`docs/example/*` & `docs/images/*`)

The files in `docs/example/` (`gutter.json`, `brief.md`, `gutter.html`) and screenshots in `docs/images/` are generated from a deterministic local simulation against [`honojs/hono`](https://github.com/honojs/hono) at pinned commit `eb754bd5ef22c63f1634a4c374a86be086f85710` using `repo-archaeology` 0.10.0 loaded as a library (Gutter's pinned dev dependency; before GU-05 the example used `repo-archaeology@0.3.0` through `npx`).

Since GU-05, "What it touches" comes from Repo Archaeology's import graph, which also finds the three `adapters/*/src/serve-static.ts` files that import the middleware through the package's `exports`, so the page adds a `wide-surface` item.

Since GU-29 the illustrative edit adds 12 lines to the middleware (previously 8), so it passes the `minChurnForTestQuestion` gate (10 changed lines) and the page is `brief`: the unchanged-test fact, the Tests row with its history and the "Usually changes with" context are all visible. The co-change history is the same as before (same commit, same analyzer).

## 1. Re-render from the committed `gutter.json` contract (offline, instant)

```bash
npm run build
node dist/cli.js render docs/example/gutter.json --format md > docs/example/brief.md
node dist/cli.js render docs/example/gutter.json --format html > docs/example/gutter.html
```

## 2. Reproduce the full analysis from scratch against `honojs/hono`

Requires `git`, Node.js ≥ 22, and `npm ci` in Gutter (which installs `repo-archaeology` 0.10.0):

```bash
# Run the reproduction script (fetches honojs/hono at eb754bd5ef22c63f1634a4c374a86be086f85710,
# creates branch feat/serve-static-cache-control with the 2-file cacheControl edit,
# runs `gutter brief` with the repo-archaeology library, and rewrites change.headSha to
# eb754bd5ef22c63f1634a4c374a86be086f85710 and change.commits[0].sha to "local-sim"
# before re-rendering brief.md and gutter.html so GitHub blob links resolve upstream):
bash docs/example/reproduce.sh /tmp/hono-repro
```

Or step by step:

```bash
npm run build
mkdir -p /tmp/hono-repro && cd /tmp/hono-repro
git init && git remote add origin https://github.com/honojs/hono.git
git fetch --depth 1500 origin eb754bd5ef22c63f1634a4c374a86be086f85710
git checkout -B main FETCH_HEAD
git checkout -b feat/serve-static-cache-control

# Apply the 2-file (+14/-0) edit to src/middleware/serve-static/index.ts (+12) and src/adapter/bun/serve-static.ts (+2), commit, and run:
node /path/to/gutter/dist/cli.js brief \
  --base main \
  --head feat/serve-static-cache-control \
  --title "feat(serve-static): add cacheControl option" \
  --intent "Adds a cacheControl option so static responses can set Cache-Control without custom middleware." \
  --repo-url "https://github.com/honojs/hono" \
  --ra-lib /path/to/gutter/node_modules/repo-archaeology \
  --out /tmp/hono-repro/.gutter
```

## 3. Verify visual layout and regenerate screenshots with Playwright

```bash
node --experimental-strip-types scripts/verify-screenshots.ts --update-docs-images
```
