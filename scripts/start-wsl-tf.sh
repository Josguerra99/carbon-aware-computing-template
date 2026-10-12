#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WORKSHOP_PORT="${WORKSHOP_PORT:-3915}"

if ! grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
  echo "ERROR: Run inside WSL, or use npm run start:wsl from Windows."
  exit 1
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

set -a
if [[ -f .env ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    export "$line"
  done < .env
fi
set +a

export TFJS_BACKEND="${TFJS_BACKEND:-gpu}"

# CUDA 11 + cuDNN 8: pip venv (no sudo) or system toolkit (see wsl-install-cuda11-tfjs.sh).
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl-tfjs-gpu-libpath.sh"
for cuda_lib in /usr/local/cuda-11.8/lib64 /usr/local/cuda/lib64; do
  if [[ -d "$cuda_lib" ]]; then
    export LD_LIBRARY_PATH="$cuda_lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  fi
done

resolve_main_url() {
  bash scripts/wsl-resolve-main-url.sh
}

check_health() {
  local base="$1"
  curl -4 -sf --connect-timeout 2 --max-time 4 "${base}/api/health" >/dev/null
}

MAIN_SERVER_URL=""
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if candidate="$(resolve_main_url)" && check_health "$candidate"; then
    MAIN_SERVER_URL="$candidate"
    export MAIN_SERVER_URL
    break
  fi
  if [[ "$attempt" -lt 10 ]]; then
    echo "Waiting for workshop site on port ${WORKSHOP_PORT} (attempt ${attempt}/10)..."
    sleep 2
  fi
done

if [[ -z "${MAIN_SERVER_URL:-}" ]]; then
  echo "ERROR: Workshop site not reachable from WSL on port ${WORKSHOP_PORT}."
  echo "On Windows start: cd carbon-aware-computing-website && bun dev"
  echo "Site must listen on 0.0.0.0:3915"
  exit 1
fi

if [[ "${WIN_PROXY:-}" == "1" ]]; then
  PORT=3917
  echo "WSL team server on port ${PORT} (Windows proxy publishes :3916)"
else
  PORT="${PORT:-3916}"
fi
export PORT

echo "TFJS_BACKEND=${TFJS_BACKEND} | MAIN_SERVER_URL=${MAIN_SERVER_URL}"
echo "Training + forecast server on http://0.0.0.0:${PORT}"

NODEMON_RELOAD="${NODEMON_RELOAD:-1}"
if [[ "$NODEMON_RELOAD" == "1" || "$NODEMON_RELOAD" == "true" ]]; then
  echo "Nodemon: edits under src/ restart server and retrain the model."
  exec npm run dev:node
fi

exec npm run start:node
