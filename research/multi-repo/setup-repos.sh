#!/usr/bin/env bash
# GU-27 · Reproducible Bare Repository Setup Script
# Clones bare, blobless histories of all 6 preregistered repositories into ${REPOS_DIR:-/tmp/gu27-repos}
# and verifies that each repository contains the exact immutable SHA pinned in PAIRS.md / manifest.json.

set -euo pipefail

REPOS_DIR="${1:-${REPOS_DIR:-/tmp/gu27-repos}}"
mkdir -p "$REPOS_DIR"

clone_and_verify() {
  local dir_name="$1"
  local url="$2"
  local pinned_sha="$3"
  local target="$REPOS_DIR/$dir_name"

  if [ ! -d "$target" ]; then
    echo "→ Cloning $url into $target ..."
    git clone --bare --filter=blob:none --single-branch "$url" "$target"
  else
    echo "✓ Existing bare clone found at $target"
  fi

  if ! git -C "$target" cat-file -e "${pinned_sha}^{commit}" 2>/dev/null; then
    echo "→ Fetching pinned commit $pinned_sha in $target ..."
    git -C "$target" fetch origin "$pinned_sha"
  fi

  git -C "$target" update-ref HEAD "$pinned_sha"
  echo "✓ Verified $dir_name @ $pinned_sha"
}

clone_and_verify "stripe_openapi" \
  "https://github.com/stripe/openapi.git" \
  "6360907ca278d6aecff118df90167e94aaba1437"

clone_and_verify "stripe_stripe-node" \
  "https://github.com/stripe/stripe-node.git" \
  "dacc71670c82e62cdf3f3dc56374ce941362aaca"

clone_and_verify "open-telemetry_opentelemetry-proto" \
  "https://github.com/open-telemetry/opentelemetry-proto.git" \
  "169f2f2c7c1550c364d5eecb05d1b6163a011b06"

clone_and_verify "open-telemetry_opentelemetry-js" \
  "https://github.com/open-telemetry/opentelemetry-js.git" \
  "ee94b842fd734e23064539c5f8069e0af0e92b9a"

clone_and_verify "kubernetes_kubernetes" \
  "https://github.com/kubernetes/kubernetes.git" \
  "e3d37bb9fb1d695daff432925cd44b1452df64e1"

clone_and_verify "kubernetes_client-go" \
  "https://github.com/kubernetes/client-go.git" \
  "494d62c5edeff3b84f2e6b3e757554c13bc3648f"

echo "✓ All 6 GU-27 repositories are ready in $REPOS_DIR"
