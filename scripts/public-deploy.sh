#!/usr/bin/env bash
# =====================================================================
# scripts/public-deploy.sh
#
# POKRENUTI NA HOST SERVERU (ima internet — sql.ba101.top/simtracker.ba101.top).
#
# Normalan tok — docker-compose.yml radi svoj build (npm ci unutar
# Dockerfile-a, uključujući Chromium download za Puppeteer u runtime
# stage-u) bez ikakvih posebnih priprema, jer server ima izlaz na
# internet.
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

TARGETS=()
if confirm "Buildati backend?"; then TARGETS+=("backend"); fi
if confirm "Buildati frontend?"; then TARGETS+=("frontend"); fi

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  warn "Ništa nije izabrano za build."
  exit 0
fi

step "docker compose build ${TARGETS[*]}"
(cd "${ROOT_DIR}" && docker compose -f docker-compose.yml build "${TARGETS[@]}")

if confirm "Podići (restart) izabrane servise sada?"; then
  (cd "${ROOT_DIR}" && docker compose -f docker-compose.yml up -d "${TARGETS[@]}")
  ok "Podignuto: ${TARGETS[*]}"
else
  warn "Preskočeno pokretanje — pokreni ručno kad budeš spreman:"
  echo "  docker compose -f docker-compose.yml up -d ${TARGETS[*]}"
fi
