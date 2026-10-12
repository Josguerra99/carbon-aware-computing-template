#!/usr/bin/env bash
# User-space CUDA 11 + cuDNN 8 for @tensorflow/tfjs-node-gpu (no apt/sudo).
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
  echo "ERROR: Run inside WSL."
  exit 1
fi

VENV="${ROOT}/.venv-tfjs-cuda"
if [[ ! -d "$VENV" ]]; then
  echo "==> Creating $VENV ..."
  python3 -m venv "$VENV"
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install -q --upgrade pip
echo "==> Installing NVIDIA CUDA 11 + cuDNN 8 wheels (large download) ..."
pip install \
  nvidia-cuda-runtime-cu11 \
  nvidia-cublas-cu11 \
  "nvidia-cudnn-cu11==8.9.6.50" \
  nvidia-cufft-cu11 \
  nvidia-curand-cu11 \
  nvidia-cusolver-cu11 \
  nvidia-cusparse-cu11

echo "==> Library paths (used by start-wsl-tf.sh):"
bash scripts/wsl-tfjs-gpu-libpath.sh 2>/dev/null || true
# shellcheck disable=SC1091
source scripts/wsl-tfjs-gpu-libpath.sh
echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH:-<empty>}"

echo "==> Done. Restart team server: bash scripts/start-wsl-tf.sh"
