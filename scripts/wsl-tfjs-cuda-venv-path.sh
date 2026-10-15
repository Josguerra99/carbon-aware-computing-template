#!/usr/bin/env bash
# Print absolute path to the pip CUDA venv (lib path for tfjs-node-gpu).
# On /mnt/<drive>/ repos, venv lives under $HOME (drvfs breaks venv symlinks).
set -eu

if [[ $# -lt 1 ]]; then
  echo "usage: wsl-tfjs-cuda-venv-path.sh <repo-root>" >&2
  exit 1
fi

ROOT="$(cd "$1" && pwd)"

if [[ -n "${TFJS_CUDA_VENV:-}" ]]; then
  printf '%s' "$TFJS_CUDA_VENV"
  exit 0
fi

if [[ "$ROOT" == /mnt/[a-z]/* ]]; then
  slug="$(printf '%s' "$ROOT" | md5sum | awk '{print $1}')"
  printf '%s' "${HOME}/.local/share/tfjs-cuda-venv/${slug}"
else
  printf '%s' "${ROOT}/.venv-tfjs-cuda"
fi
