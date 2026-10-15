#!/usr/bin/env bash
# CUDA 11 + cuDNN 8 for @tensorflow/tfjs-node-gpu via pip wheels in a Python venv.
# Installs python3-venv with apt/sudo when ensurepip is missing.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
  echo "ERROR: Run inside WSL."
  exit 1
fi

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null; then
  echo "ERROR: python3 not found. Install: sudo apt install -y python3 python3-pip"
  exit 1
fi

PY_VER="$("$PY" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"

VENV="$(bash "$ROOT/scripts/wsl-tfjs-cuda-venv-path.sh" "$ROOT")"
LEGACY_VENV="${ROOT}/.venv-tfjs-cuda"

venv_probe() {
  local probe="${TMPDIR:-/tmp}/tfjs-venv-probe-$$"
  if "$PY" -m venv "$probe" >/dev/null 2>&1; then
    rm -rf "$probe"
    return 0
  fi
  rm -rf "$probe" 2>/dev/null || true
  return 1
}

install_python_venv_via_apt() {
  if ! command -v apt-get >/dev/null; then
    echo "ERROR: apt-get not found; install python${PY_VER}-venv manually."
    return 1
  fi
  if ! command -v sudo >/dev/null; then
    echo "ERROR: sudo not found; install python${PY_VER}-venv manually."
    return 1
  fi

  echo "==> Python venv unavailable; installing via apt (sudo password may be required) ..."
  sudo apt-get update
  sudo apt-get install -y python3 python3-pip python3-venv "python${PY_VER}-venv" || \
    sudo apt-get install -y python3 python3-pip python3-venv
}

ensure_python_venv() {
  if venv_probe; then
    return 0
  fi
  install_python_venv_via_apt || return 1
  if venv_probe; then
    return 0
  fi
  cat <<EOF

ERROR: Could not create a Python venv after apt install.

Try in WSL:

  sudo apt update
  sudo apt install -y python${PY_VER}-venv python3-pip

Then re-run: scripts/windows/setup-wsl-cuda.cmd

EOF
  return 1
}

venv_usable() {
  [[ -f "$1/bin/activate" ]] && [[ -x "$1/bin/python" || -x "$1/bin/python3" ]]
}

create_project_venv() {
  local target="$1"
  mkdir -p "$(dirname "$target")"
  rm -rf "$target"
  echo "==> Creating CUDA pip venv at $target (Python ${PY_VER}) ..."
  if [[ "$ROOT" == /mnt/[a-z]/* && "$target" == "$ROOT"/* ]]; then
    echo "WARN: Repo is on /mnt/<drive>; venv should use the Linux path from wsl-tfjs-cuda-venv-path.sh"
  fi
  if [[ "$target" == /mnt/[a-z]/* ]]; then
    "$PY" -m venv --copies "$target"
  else
    "$PY" -m venv "$target"
  fi
}

ensure_python_venv

if [[ "$LEGACY_VENV" != "$VENV" && -d "$LEGACY_VENV" ]]; then
  echo "==> Removing legacy venv on Windows mount ($LEGACY_VENV) ..."
  rm -rf "$LEGACY_VENV"
fi

if [[ -d "$VENV" ]] && ! venv_usable "$VENV"; then
  echo "==> Removing broken venv ($VENV) ..."
  rm -rf "$VENV"
fi

if [[ ! -d "$VENV" ]]; then
  create_project_venv "$VENV"
fi

if ! venv_usable "$VENV"; then
  echo "ERROR: Venv at $VENV is still invalid after create."
  exit 1
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
