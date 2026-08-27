#!/usr/bin/env bash
# =====================================================================
# scripts/vm-frontend-deploy.sh [putanja-do-tar.gz]
#
# POKRENUTI NA VM-u (offline).
#
# Raspakuje frontend dist (napravljen preko scripts/vm-frontend-build.sh
# na mašini sa internetom) u frontend/dist, pa builda i podiže samo
# frontend servis preko frontend/Dockerfile.vm (čisti nginx + COPY,
# bez npm-a, bez interneta).
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  FILE="$(ls -t "${ARTIFACTS_DIR}"/frontend-dist-*.tar.gz 2>/dev/null | head -n1 || true)"
  if [[ -z "$FILE" ]]; then
    err "Nije prosljeđena putanja do .tar.gz fajla i ništa nije pronađeno u ${ARTIFACTS_DIR}/"
    echo "Upotreba: $0 /putanja/do/frontend-dist-<tag>.tar.gz"
    exit 1
  fi
  warn "Argument nije prosljeđen, koristim najnoviji pronađeni fajl: ${FILE}"
fi

if [[ ! -f "$FILE" ]]; then
  err "Fajl ne postoji: ${FILE}"
  exit 1
fi

if ! docker image inspect "${NGINX_IMAGE}" >/dev/null 2>&1; then
  err "Base image '${NGINX_IMAGE}' nije pronađen lokalno (potreban frontend/Dockerfile.vm)."
  echo "Prvo pokreni (na mašini sa internetom) scripts/vm-frontend-baseimage-prepare.sh,"
  echo "prebaci artefakt na VM, pa na VM-u scripts/vm-frontend-baseimage-load.sh."
  exit 1
fi

step "Raspakivanje ${FILE} u ${ROOT_DIR}/frontend/"
rm -rf "${ROOT_DIR}/frontend/dist"
tar -xzf "$FILE" -C "${ROOT_DIR}/frontend"
ok "dist/ spreman: ${ROOT_DIR}/frontend/dist"

step "Docker build (samo COPY, bez npm-a)"
(cd "${ROOT_DIR}" && docker compose -f docker-compose.vm.app.yml build frontend)

if confirm "Podići (restart) frontend kontejner sada?"; then
  (cd "${ROOT_DIR}" && docker compose -f docker-compose.vm.app.yml up -d frontend)
  ok "Frontend podignut."
else
  warn "Preskočeno pokretanje — pokreni ručno kad budeš spreman:"
  echo "  docker compose -f docker-compose.vm.app.yml up -d frontend"
fi
