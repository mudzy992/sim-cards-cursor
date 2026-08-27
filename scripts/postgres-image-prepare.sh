#!/usr/bin/env bash
# =====================================================================
# scripts/postgres-image-prepare.sh
#
# POKRENUTI NA MAŠINI SA INTERNETOM (ne na VM-u).
#
# Povlači postgres + pgadmin4 image-e (iste verzije koje koristi
# docker-compose.vm.db.yml) i pakuje ih za prenos na VM. Pokrenuti samo
# jednom (ili kad se odluči promjena verzije Postgres-a).
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

step "Povlačenje ${POSTGRES_IMAGE} i ${PGADMIN_IMAGE}"
docker pull "${POSTGRES_IMAGE}"
docker pull "${PGADMIN_IMAGE}"

OUT_FILE="${ARTIFACTS_DIR}/postgres-images-${IMAGE_TAG}.tar.gz"
step "Snimanje u ${OUT_FILE}"
docker save "${POSTGRES_IMAGE}" "${PGADMIN_IMAGE}" | gzip > "${OUT_FILE}"
ok "Sačuvano: ${OUT_FILE} ($(du -h "$OUT_FILE" | cut -f1))"

cat <<EOF

${c_bold}Sljedeći koraci (na VM-u):${c_reset}
  1) scp "${OUT_FILE}" <user>@<vm-host>:/tmp/
  2) Na VM-u: ./scripts/postgres-image-load.sh /tmp/$(basename "$OUT_FILE")

EOF
