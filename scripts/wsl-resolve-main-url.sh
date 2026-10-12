#!/usr/bin/env bash
# Pick a MAIN_SERVER_URL that reaches the workshop site from WSL (port 3915).
set -eu

WORKSHOP_PORT="${WORKSHOP_PORT:-3915}"

declare -a CANDIDATES=()
declare -A SEEN=()

add_host() {
  local h="${1//[$'\r\n']/}"
  [[ -z "$h" ]] && return
  [[ -n "${SEEN[$h]+x}" ]] && return
  SEEN[$h]=1
  CANDIDATES+=("$h")
}

GW="$(ip route show default 2>/dev/null | awk '{print $3; exit}' || true)"

add_host "127.0.0.1"
add_host "$GW"
add_host "localhost"

while read -r _ ns; do
  add_host "$ns"
done < <(awk '/^nameserver/{print $2}' /etc/resolv.conf 2>/dev/null || true)

if getent hosts host.docker.internal >/dev/null 2>&1; then
  add_host "host.docker.internal"
fi

probe() {
  local base="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -4 -sf --connect-timeout 1 --max-time 3 "${base}/api/health" >/dev/null 2>&1
    return $?
  fi
  return 1
}

for host in "${CANDIDATES[@]}"; do
  base="http://${host}:${WORKSHOP_PORT}"
  if probe "$base"; then
    echo "$base"
    exit 0
  fi
done

exit 1
