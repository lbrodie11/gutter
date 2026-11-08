# Releasing Gutter

This guide covers how Gutter releases are built, tagged, published to npm, and listed on the GitHub Marketplace.

## Overview

- **npm package:** `gutter-brief` (CLI binary: `gutter`)
- **GitHub Action:** `lbrodie11/gutter@v0` (composite action running `dist/action/main.js` on Node.js ≥ 22)
- **Source branch (`main`):** `dist/` is gitignored on `main`.
- **Release tags (`vX.Y.Z` and `v0`):** `.github/workflows/release.yml` builds `dist/`, commits `dist/` on a detached HEAD, moves `vX.Y.Z` and the floating major tag (`v0`) to that built commit, publishes `gutter-brief` to npm with OIDC provenance, and creates the GitHub Release from `CHANGELOG.md`.

---

## One-time Human Setup (Before First Public Release)

1. **Repository visibility:**
   - When ready for public launch, switch `github.com/lbrodie11/gutter` to **Public** (Settings → General → Danger Zone → Change repository visibility). GitHub Actions Marketplace and unauthenticated `uses: lbrodie11/gutter@v0` require a public repository.
2. **npm Trusted Publishing (OIDC):**
   - Sign in to [npmjs.com](https://www.npmjs.com/) and configure Trusted Publishing for `gutter-brief`:
     - **Repository owner:** `lbrodie11`
     - **Repository name:** `gutter`
     - **Workflow filename:** `release.yml`
   - *(If `gutter-brief` has never been published on npm yet and npm requires an initial bootstrap publish before configuring Trusted Publishing, run `npm publish --access public` once locally after `npm run build`, then enable Trusted Publishing on the package settings page so all future releases use passwordless OIDC.)*

---

## Release Checklist (Every Version `vX.Y.Z`)

1. **Update version & changelog on `main`:**
   - Bump `"version"` in `package.json` AND `GUTTER_VERSION` in `src/version.ts` to `X.Y.Z` (`npm test` verifies they match).
   - Add a `## X.Y.Z · YYYY-MM-DD` section to `CHANGELOG.md`.
   - Run full local verification (requires Node.js ≥ 22.6):
     ```bash
     npm ci
     npm run typecheck
     npm test
     npm run build
     ```
   - Merge to `main` and wait for the `CI` workflow to turn green across Linux, macOS, and Windows.

2. **Push the version tag (`vX.Y.Z`):**
   ```bash
   git checkout main && git pull --ff-only
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
   > **Note on tag signing / annotations:** Push a lightweight tag (`git tag vX.Y.Z`). Because `release.yml` creates a detached-HEAD commit containing the compiled `dist/` directory and force-updates `refs/tags/vX.Y.Z` to point to that commit, any local tag annotation or GPG signature on the initial tag would be replaced by the workflow's built release tag.

3. **Automated `.github/workflows/release.yml` pipeline:**
   When `vX.Y.Z` is pushed, the `Release` workflow automatically:
   1. **Read-only `build` job:** Checks out the tag (`persist-credentials: false`), validates `vX.Y.Z` against `package.json`, runs `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`, and uploads `dist/` as an artifact.
   2. **Scoped `publish` job:** Downloads `dist/`, commits `dist/` on a detached HEAD (`release: vX.Y.Z (with dist)`), verifies `dist/action/main.js` and `dist/cli.js` exist in the tag tree, force-updates `vX.Y.Z` to that commit, and updates the major floating tag (`v0`) only when `vX.Y.Z` is a non-prerelease version greater than or equal to all existing stable `v0.*.*` tags (preventing backport patches from moving `v0` backwards).
   3. **Idempotent npm publish:** Checks whether `gutter-brief@X.Y.Z` is already on npm (so workflow re-runs after partial failures succeed) and publishes with `--provenance --access public --ignore-scripts` (adding `--tag next` for prereleases).
   4. **GitHub Release:** Extracts the `## X.Y.Z` section from `CHANGELOG.md` via `extractReleaseNotes()` and creates/updates the GitHub Release for `vX.Y.Z`.
   5. **Dry-run verification (`workflow_dispatch` with `dry_run: true`):** Builds and verifies the detached-HEAD tag commit tree locally (`git ls-tree`) and runs `npm publish --dry-run` **without** pushing any tags to `origin` or mutating remote state.

   > **Note for consumers who SHA-pin actions:** Because `dist/` lives on the release tag commit rather than on `main`, users who pin `lbrodie11/gutter@<40-char-sha>` must use the commit SHA that `vX.Y.Z` points to (`git rev-parse v0.1.0^{commit}`), not a commit SHA from `main`.

4. **Human Step: List on GitHub Marketplace (first release / when updating Marketplace metadata):**
   - Open the created release at `https://github.com/lbrodie11/gutter/releases/tag/vX.Y.Z`.
   - Click **Edit release**.
   - Tick **"Publish this Action to the GitHub Marketplace"** (accepting the GitHub Marketplace Developer Agreement if prompted), select a primary category (e.g., *Code quality* / *Code review*), and click **Update release**.
