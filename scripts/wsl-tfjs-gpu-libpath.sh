#!/usr/bin/env bash
# CUDA 11 + cuDNN 8 for tfjs-node-gpu via pip wheels (no sudo). Source from start-wsl-tf.sh.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${ROOT}/.venv-tfjs-cuda"

if [[ ! -d "$VENV" ]]; then
  return 0 2>/dev/null || exit 0
fi

shopt -s nullglob
lib_dirs=()
for lib in "$VENV"/lib/python3.*/site-packages/nvidia/*/lib; do
  [[ -d "$lib" ]] && lib_dirs+=("$lib")
done
shopt -u nullglob

if [[ ${#lib_dirs[@]} -eq 0 ]]; then
  return 0 2>/dev/null || exit 0
fi

IFS=:
joined="${lib_dirs[*]}"
unset IFS

if [[ -d /usr/lib/wsl/lib ]]; then
  export LD_LIBRARY_PATH="${joined}:/usr/lib/wsl/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
else
  export LD_LIBRARY_PATH="${joined}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi
