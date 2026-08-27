#!/usr/bin/env bash
# =====================================================================
# scripts/vm-frontend-baseimage-prepare.sh
#
# POKRENUTI NA MAŠINI SA INTERNETOM (ne na VM-u).
#
# frontend/Dockerfile.vm je "samo COPY + nginx" (bez npm-a), ali i dalje
# mu treba BASE image (nginx:alpine) da bi se od njega gradio — taj base
# image se, kao i node_modules za backend, mora povući sa interneta i
# prenijeti na VM JEDNOM (ili kad se odluči promjena verzije).
#
# Bez ovoga, `docker compose ... build frontend` na VM-u puca sa
# "failed to resolve source metadata for docker.io/library/nginx:alpine"
# jer VM nema izlaz na internet.
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

step "Povlačenje ${NGINX_IMAGE}"
docker pull "${NGINX_IMAGE}"

OUT_FILE="${ARTIFACTS_DIR}/frontend-baseimage-${IMAGE_TAG}.tar.gz"
step "Snimanje u ${OUT_FILE}"
docker save "${NGINX_IMAGE}" | gzip > "${OUT_FILE}"
ok "Sačuvano: ${OUT_FILE} ($(du -h "$OUT_FILE" | cut -f1))"

cat <<EOF

${c_bold}Sljedeći koraci (na VM-u):${c_reset}
  1) scp "${OUT_FILE}" <user>@<vm-host>:/tmp/
  2) Na VM-u: ./scripts/vm-frontend-baseimage-load.sh /tmp/$(basename "$OUT_FILE")

EOF
