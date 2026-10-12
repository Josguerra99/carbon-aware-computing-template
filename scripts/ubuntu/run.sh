#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun not found. Run: bash scripts/ubuntu/setup.sh" >&2
  exit 1
fi

bash "$(dirname "$0")/../ensure-env.sh"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ ! -d node_modules ]]; then
  echo "node_modules missing — running setup..."
  bash "$(dirname "$0")/setup.sh"
fi

echo "Starting forecast server (bun run dev) on port ${PORT:-3916}..."
exec bun run dev
