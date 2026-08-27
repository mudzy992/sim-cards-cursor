#!/usr/bin/env bash
# =====================================================================
# scripts/postgres-image-load.sh <putanja-do-tar.gz>
#
# POKRENUTI NA VM-u (offline).
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  FILE="$(ls -t "${ARTIFACTS_DIR}"/postgres-images-*.tar.gz 2>/dev/null | head -n1 || true)"
  if [[ -z "$FILE" ]]; then
    err "Nije prosljeđena putanja do .tar.gz fajla i ništa nije pronađeno u ${ARTIFACTS_DIR}/"
    echo "Upotreba: $0 /putanja/do/postgres-images-<tag>.tar.gz"
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

ok "Postgres/pgAdmin image-i učitani."
docker images | grep -E "postgres|pgadmin" || true

cat <<EOF

Sljedeći korak: pokrenuti bazu preko
  docker compose -f docker-compose.vm.db.yml up -d
EOF
