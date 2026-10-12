#!/usr/bin/env bash
set -eu
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
sed -i 's/\r$//' scripts/*.sh 2>/dev/null || true
# shellcheck disable=SC1091
source scripts/wsl-tfjs-gpu-libpath.sh
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null
export TFJS_BACKEND=gpu
exec node --import tsx --import ./src/workshop/tfPreload.ts -e "import { ensureTfBackend } from './src/workshop/tfBackend.ts'; await ensureTfBackend();"
