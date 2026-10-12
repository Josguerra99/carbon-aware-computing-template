#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Carbon-aware template (TypeScript) — Ubuntu setup ==="
echo "Installs: Bun, project dependencies (bun install)."
echo "Before run: set MAIN_SERVER_URL in .env to the URL from your facilitator."
echo ""

bash "$(dirname "$0")/../ensure-env.sh"

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    echo "Bun: $(bun --version)"
    return
  fi
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  if [[ -x "$BUN_INSTALL/bin/bun" ]]; then
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo "Bun: $(bun --version)"
    return
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "Installing curl..."
    sudo apt-get update -qq
    sudo apt-get install -y curl unzip
  fi
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"
  echo "Bun: $(bun --version)"
}

ensure_bun

echo "Installing dependencies (bun install)..."
bun install

echo ""
echo "Setup complete. Run: bash scripts/ubuntu/run.sh"
