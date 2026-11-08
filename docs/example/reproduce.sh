#!/usr/bin/env bash
# Reproduce the Hono example from scratch against real honojs/hono history.
# Requires: git, Node.js >= 22.6, and npx access to repo-archaeology@^0.3.0.
set -euo pipefail

GUTTER_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK_DIR="${1:-$(mktemp -d "${TMPDIR:-/tmp}/gutter-hono-repro-XXXXXX")}"
BASE_SHA="eb754bd5ef22c63f1634a4c374a86be086f85710"

echo "1. Building Gutter in ${GUTTER_ROOT}..."
(cd "$GUTTER_ROOT" && npm run build)

echo "2. Fetching honojs/hono into ${WORK_DIR} at ${BASE_SHA} (--depth 1500)..."
mkdir -p "$WORK_DIR"
git init -q "$WORK_DIR"
cd "$WORK_DIR"
git remote add origin https://github.com/honojs/hono.git
git fetch -q --depth 1500 origin "$BASE_SHA"
git checkout -q -B main FETCH_HEAD
git checkout -q -b feat/serve-static-cache-control

echo "3. Applying illustrative 2-file cacheControl change (+10/-0)..."
node -e '
const fs = require("node:fs");
const mw = "src/middleware/serve-static/index.ts";
fs.writeFileSync(
  mw,
  fs.readFileSync(mw, "utf8") +
    "\n// Illustrative option for static Cache-Control header\nexport interface ServeStaticCacheOption {\n  cacheControl?: string\n}\nexport const applyCacheControl = (value?: string): string | undefined => {\n  return value ? value.trim() : undefined\n}\n"
);
const bun = "src/adapter/bun/serve-static.ts";
fs.writeFileSync(
  bun,
  fs.readFileSync(bun, "utf8") +
    "// Forward cacheControl option in Bun serve-static adapter\nexport type BunCacheControl = string | undefined\n"
);
'
GIT_AUTHOR_DATE="2026-11-07T01:14:00Z" GIT_COMMITTER_DATE="2026-11-07T01:14:00Z" \
  git commit -am "feat(serve-static): add cacheControl option" -q

echo "4. Running Gutter against main (${BASE_SHA})..."
node "$GUTTER_ROOT/dist/cli.js" brief \
  --base main \
  --head feat/serve-static-cache-control \
  --title "feat(serve-static): add cacheControl option" \
  --intent "Adds a cacheControl option so static responses can set Cache-Control without custom middleware." \
  --repo-url "https://github.com/honojs/hono" \
  --ra-version "0.3.0" \
  --out "$WORK_DIR/.gutter"

# Pin headSha to BASE_SHA and commits[0].sha to "local-sim" so GitHub file links resolve upstream
BASE_SHA="$BASE_SHA" WORK_DIR="$WORK_DIR" node -e '
const fs = require("node:fs");
const p = `${process.env.WORK_DIR}/.gutter/gutter.json`;
const brief = JSON.parse(fs.readFileSync(p, "utf8"));
brief.change.headSha = process.env.BASE_SHA;
if (brief.change.commits[0]) brief.change.commits[0].sha = "local-sim";
fs.writeFileSync(p, JSON.stringify(brief, null, 2) + "\n");
'
node "$GUTTER_ROOT/dist/cli.js" render "$WORK_DIR/.gutter/gutter.json" --format md > "$WORK_DIR/.gutter/brief.md"
node "$GUTTER_ROOT/dist/cli.js" render "$WORK_DIR/.gutter/gutter.json" --format html > "$WORK_DIR/.gutter/gutter.html"
cat "$WORK_DIR/.gutter/brief.md"
