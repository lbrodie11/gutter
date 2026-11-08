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
   -*(If `gutter-brief` has never been published on npm yet and npm requires an initial bootstrap publish before configuring Trusted Publishing, run `npm publish --access public` once locally after `npm run build`, then enable Trusted Publishing on the package settings page so all future releases use passwordless OIDC.)*

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

3. **Automated `.github/workflows/release.yml` pipeline:**
   When `vX.Y.Z` is pushed, the `Release` workflow automatically:
   1. Checks out the tag, runs `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
   2. Verifies `package.json` version matches the tag (`vX.Y.Z`).
   3. Force-adds `dist/` into a detached-HEAD commit (`release: vX.Y.Z (with dist)`), force-updates tag `vX.Y.Z` to that commit, and (for non-prerelease tags) force-updates the major floating tag (`v0`) to the same commit.
   4. Publishes `gutter-brief@X.Y.Z` to npm with `--provenance --access public`.
   5. Extracts the `## X.Y.Z` section from `CHANGELOG.md` and creates the GitHub Release for `vX.Y.Z`.

4. **Human Step: List on GitHub Marketplace (first release / when updating Marketplace metadata):**
   - Open the created release at `https://github.com/lbrodie11/gutter/releases/tag/vX.Y.Z`.
   - Click **Edit release**.
   - Tick **"Publish this Action to the GitHub Marketplace"** (accepting the GitHub Marketplace Developer Agreement if prompted), select a primary category (e.g., *Code quality* / *Code review*), and click **Update release**.
