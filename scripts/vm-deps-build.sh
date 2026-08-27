#!/usr/bin/env bash
# =====================================================================
# scripts/vm-deps-build.sh
#
# POKRENUTI NA MAŠINI SA INTERNETOM (ne na VM-u).
#
# Builda backend/Dockerfile.deps (node_modules + apt paketi za Puppeteer)
# i pakuje ga u .tar.gz spreman za prenos na VM (docker save | gzip).
#
# Pokrenuti ponovo SAMO kada se promijeni backend/package*.json ili
# sistemski paketi u Dockerfile.deps — ne kod svake izmjene aplikativnog
# koda.
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

step "Build deps image: ${DEPS_IMAGE_TAGGED}"
docker build \
  -f "${ROOT_DIR}/backend/Dockerfile.deps" \
  -t "${DEPS_IMAGE_TAGGED}" \
  -t "${DEPS_IMAGE_LATEST}" \
  "${ROOT_DIR}/backend"
ok "Image izgrađen: ${DEPS_IMAGE_TAGGED} (i tagovan kao ${DEPS_IMAGE_LATEST})"

OUT_FILE="${ARTIFACTS_DIR}/${DEPS_IMAGE_NAME}-${IMAGE_TAG}.tar.gz"
step "Snimanje image-a u ${OUT_FILE}"
docker save "${DEPS_IMAGE_TAGGED}" | gzip > "${OUT_FILE}"
ok "Sačuvano: ${OUT_FILE} ($(du -h "$OUT_FILE" | cut -f1))"

cat <<EOF

${c_bold}Sljedeći koraci (na VM-u):${c_reset}
  1) Prebaciti fajl na VM, npr.:
     scp "${OUT_FILE}" <user>@<vm-host>:/tmp/

  2) Na VM-u pokrenuti:
     ./scripts/vm-deps-load.sh /tmp/$(basename "$OUT_FILE")

EOF
