#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Carbon-aware TypeScript template — WSL + TensorFlow.js GPU"
echo "    $ROOT"

if ! grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
  echo "ERROR: Run inside WSL. From Windows: npm run setup:wsl"
  exit 1
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "==> Installing nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"

echo "==> Node 20 (tfjs-node prebuilds)..."
nvm install 20
nvm use 20
node -v
npm -v

if command -v nvidia-smi >/dev/null 2>&1; then
  echo "==> GPU:"
  nvidia-smi -L || true
else
  echo "WARN: nvidia-smi not found in WSL. Install NVIDIA WSL drivers on Windows first."
fi

echo "==> npm install..."
npm install

echo "==> Linux-native tfjs bindings (remove Windows .node files on /mnt/d)..."
rm -rf node_modules/@tensorflow/tfjs-node node_modules/@tensorflow/tfjs-node-gpu
npm install @tensorflow/tfjs-node-gpu@4.22.0 @tensorflow/tfjs-node@4.22.0
npm rebuild @tensorflow/tfjs-node-gpu @tensorflow/tfjs-node

cuda_wheels_present() {
  local venv
  venv="$(bash "$ROOT/scripts/wsl-tfjs-cuda-venv-path.sh" "$ROOT")"
  shopt -s nullglob
  local hits=("$venv"/lib/python3.*/site-packages/nvidia/cuda_runtime)
  shopt -u nullglob
  [[ ${#hits[@]} -gt 0 ]]
}

if cuda_wheels_present; then
  echo "==> CUDA pip venv already present (CUDA 11 wheels)."
else
  echo "==> CUDA 11 + cuDNN 8 for GPU (pip venv; needs python3-venv once via apt)..."
  bash scripts/setup-wsl-tfjs-cuda-venv.sh
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

MAIN_URL="$(bash scripts/wsl-resolve-main-url.sh 2>/dev/null || echo "http://127.0.0.1:3915")"
export MAIN_SERVER_URL="$MAIN_URL"

node <<'NODE'
const fs = require("fs");
const path = ".env";
let text = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const mainUrl = process.env.MAIN_SERVER_URL || "http://127.0.0.1:3915";
function setLine(key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text) ? text.replace(re, line) : text.trimEnd() + (text ? "\n" : "") + line + "\n";
}
setLine("PORT", "3916");
setLine("MAIN_SERVER_URL", mainUrl);
setLine("TFJS_BACKEND", "gpu");
fs.writeFileSync(path, text);
console.log(`==> .env updated (MAIN_SERVER_URL=${mainUrl}, TFJS_BACKEND=gpu)`);
NODE

echo "==> Smoke test native backend (TFJS_BACKEND=gpu)..."
if ! TFJS_BACKEND=gpu node --import tsx -e "import { ensureTfBackend } from './src/core/tf/tfBackend.ts'; await ensureTfBackend();" 2>&1 | tee /tmp/tfjs-smoke.log; then
  echo "WARN: backend smoke test failed."
fi
if grep -q "libcudart.so.11" /tmp/tfjs-smoke.log 2>/dev/null; then
  echo ""
  echo "NOTE: Native TF works, but GPU needs CUDA 11 + cuDNN 8 inside WSL (tfjs-node-gpu 4.22)."
  echo "      Until then training uses fast CPU-native TensorFlow (still much faster than Bun/JS)."
  echo "      After installing CUDA libs, run: npm rebuild @tensorflow/tfjs-node-gpu"
fi
echo ""
echo "Do not run 'npm install' on Windows for this repo if you develop in WSL — it replaces Linux .node binaries."

cat <<EOF

==> Setup complete.

From WSL (nodemon + GPU):
  cd "$ROOT"
  source "\$NVM_DIR/nvm.sh" && nvm use 20
  bash scripts/start-wsl-tf.sh

From Windows (website on :3915 + proxy + WSL):
  npm run start:wsl

EOF
