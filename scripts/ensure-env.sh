#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  echo ".env ya existe."
  exit 0
fi

if [[ -f .env.example ]]; then
  cp .env.example .env
  echo "Creado .env desde .env.example"
else
  cat > .env <<'EOF'
# URL base del sitio del taller (te la da el facilitador).
MAIN_SERVER_URL=http://192.168.0.100:3915
PORT=3916
TFJS_BACKEND=gpu
TRAIN_DATASETS=all
HISTORIC_CACHE_TTL_MS=0
REFRESH_HISTORIC=0
EOF
  echo "Creado .env con valores por defecto."
fi

echo "Edita .env y pon MAIN_SERVER_URL con la URL del facilitador."
