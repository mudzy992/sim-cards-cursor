#!/usr/bin/env bash
# =====================================================================
# scripts/vm-frontend-baseimage-load.sh [putanja-do-tar.gz]
#
# POKRENUTI NA VM-u (offline).
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  FILE="$(ls -t "${ARTIFACTS_DIR}"/frontend-baseimage-*.tar.gz 2>/dev/null | head -n1 || true)"
  if [[ -z "$FILE" ]]; then
    err "Nije prosljeđena putanja do .tar.gz fajla i ništa nije pronađeno u ${ARTIFACTS_DIR}/"
    echo "Upotreba: $0 /putanja/do/frontend-baseimage-<tag>.tar.gz"
    exit 1
  fi
  warn "Argument nije prosljeđen, koristim najnoviji pronađeni fajl: ${FILE}"
fi

if [[ ! -f "$FILE" ]]; then
  err "Fajl ne postoji: ${FILE}"
  exit 1
fi

step "Učitavanje image-a iz ${FILE}"
docker load -i "$FILE"

ok "nginx base image učitan."
docker images "${NGINX_IMAGE%%:*}"

cat <<EOF

Sljedeći korak: ./scripts/vm-frontend-deploy.sh (ili ponovo pokreni
prethodnu komandu ako je pukla zbog ovog nedostajućeg image-a).
EOF
