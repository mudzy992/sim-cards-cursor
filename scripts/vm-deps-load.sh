#!/usr/bin/env bash
# =====================================================================
# scripts/vm-deps-load.sh <putanja-do-tar.gz>
#
# POKRENUTI NA VM-u (offline).
#
# Učitava deps image (napravljen preko scripts/vm-deps-build.sh na
# mašini sa internetom i prebačen na VM) u lokalni Docker image store.
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  # Ako nije prosljeđen argument, ponudi najnoviji fajl iz artifacts/
  FILE="$(ls -t "${ARTIFACTS_DIR}/${DEPS_IMAGE_NAME}"-*.tar.gz 2>/dev/null | head -n1 || true)"
  if [[ -z "$FILE" ]]; then
    err "Nije prosljeđena putanja do .tar.gz fajla i ništa nije pronađeno u ${ARTIFACTS_DIR}/"
    echo "Upotreba: $0 /putanja/do/${DEPS_IMAGE_NAME}-<tag>.tar.gz"
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

ok "Deps image učitan. Provjera:"
docker images "${DEPS_IMAGE_NAME}"

cat <<EOF

Ako želiš da ovaj tag bude podrazumijevani ("latest") za build backend
app image-a, provjeri da je i on tagovan kao ${DEPS_IMAGE_LATEST} (skripta
vm-deps-build.sh to već radi automatski prije snimanja), ili eksplicitno:
  docker tag <učitani-tag> ${DEPS_IMAGE_LATEST}

Sljedeći korak: ./scripts/vm-backend-build.sh
EOF
