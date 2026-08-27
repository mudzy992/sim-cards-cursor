#!/usr/bin/env bash
# =====================================================================
# scripts/vm-backend-build.sh
#
# POKRENUTI NA VM-u (offline).
#
# Builda samo backend app image (backend/Dockerfile.vm) koristeći deps
# image koji je već učitan preko scripts/vm-deps-load.sh. Ne radi
# NIKAKAV npm install — samo kopira kod, generiše Prisma klijent (iz već
# instaliranih binarnih engine-a) i kompajlira TypeScript.
#
# Preduslov: deps image mora već postojati lokalno (docker images | grep
# simtracker-backend-deps). Ako ne postoji, skripta to javlja i staje.
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd docker

DEPS_TAG="${DEPS_IMAGE_TAG:-${DEPS_IMAGE_LATEST}}"

if ! docker image inspect "${DEPS_TAG}" >/dev/null 2>&1; then
  err "Deps image '${DEPS_TAG}' nije pronađen lokalno."
  echo "Prvo pokreni (na mašini sa internetom) scripts/vm-deps-build.sh,"
  echo "prebaci artefakt na VM, pa na VM-u scripts/vm-deps-load.sh."
  exit 1
fi
ok "Koristim deps image: ${DEPS_TAG}"

step "Build backend app image (offline)"
export DEPS_IMAGE_TAG="${DEPS_TAG}"
(cd "${ROOT_DIR}" && docker compose -f docker-compose.vm.app.yml build backend)
ok "Backend app image izgrađen."

if confirm "Podići (restart) backend kontejner sada?"; then
  (cd "${ROOT_DIR}" && docker compose -f docker-compose.vm.app.yml up -d backend)
  ok "Backend podignut."
  warn "Ako je ovo prva instalacija ili su dodane nove migracije, ne zaboravi:"
  echo "  docker exec -it sim-tracker-backend-vm sh -c 'npx prisma migrate deploy'"
else
  warn "Preskočeno pokretanje — pokreni ručno kad budeš spreman:"
  echo "  docker compose -f docker-compose.vm.app.yml up -d backend"
fi
