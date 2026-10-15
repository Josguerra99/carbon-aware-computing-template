#!/usr/bin/env bash
# One-off smoke test: nodemon restarts when a file under src/ changes.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm use 20 >/dev/null

MAIN="$(bash scripts/wsl-resolve-main-url.sh)"
export PORT="${TEST_PORT:-3920}"
export MAIN_SERVER_URL="$MAIN"
export TFJS_BACKEND="${TFJS_BACKEND:-cpu}"
# Windows-mounted repos (/mnt/d) often miss fs events; match real WSL dev on D:.
export CHOKIDAR_USEPOLLING="${CHOKIDAR_USEPOLLING:-1}"
export CHOKIDAR_INTERVAL="${CHOKIDAR_INTERVAL:-500}"
# shellcheck disable=SC1091
source scripts/wsl-tfjs-gpu-libpath.sh 2>/dev/null || true

LOG="${TMPDIR:-/tmp}/nodemon-reload-test.log"
PROBE="$ROOT/src/_reload_probe.ts"
STAMP_FILE="$ROOT/src/main.ts"
rm -f "$LOG" "$PROBE"

npm run dev:node >>"$LOG" 2>&1 &
NPID=$!
restore_main() {
  if [[ -n "${MAIN_BACKUP:-}" && -f "$MAIN_BACKUP" ]]; then
    mv -f "$MAIN_BACKUP" "$STAMP_FILE"
  fi
  rm -f "$PROBE"
}
cleanup() {
  restore_main
  kill "$NPID" 2>/dev/null || true
  wait "$NPID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> nodemon pid=$NPID PORT=$PORT MAIN_SERVER_URL=$MAIN_SERVER_URL"

ready=0
for i in $(seq 1 90); do
  if grep -q "Prediction model trained" "$LOG" 2>/dev/null; then
    ready=1
    echo "==> first train finished (~${i}s)"
    break
  fi
  sleep 2
done

if [[ "$ready" -ne 1 ]]; then
  echo "ERROR: server never reached 'Prediction model trained'"
  tail -20 "$LOG"
  exit 1
fi

BEFORE="$(grep -c "Prediction model trained" "$LOG" || true)"
MAIN_BACKUP="$(mktemp)"
cp "$STAMP_FILE" "$MAIN_BACKUP"
echo "// reload-probe $(date +%s)" >>"$STAMP_FILE"
sleep 8
AFTER="$(grep -c "Prediction model trained" "$LOG" || true)"

echo "==> nodemon restart lines:"
grep -E '\[nodemon\].*(restart|starting)' "$LOG" | tail -8 || true

echo "==> trained log count: before=$BEFORE after=$AFTER"

if grep -q '\[nodemon\] restarting due to changes' "$LOG" && [[ "$AFTER" -gt "$BEFORE" ]]; then
  echo "PASS: nodemon detected change and process retrained."
  exit 0
fi

echo "FAIL: expected [nodemon] restarting and a second train."
exit 1
