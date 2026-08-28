#!/usr/bin/env bash
# =====================================================================
# scripts/vm-frontend-build.sh
#
# POKRENUTI NA MAŠINI SA INTERNETOM (ili bilo gdje gdje ima Node.js —
# ne mora biti VM, jer je ovo samo `npm run build`, ne Docker build).
#
# Builda frontend/dist sa istim VITE_API_BASE_URL/VITE_API_BASE_URLS
# vrijednostima koje se koriste i za public deployment (/backend/api,
# relativna putanja — radi identično na VM-u i na produkciji jer Traefik
# na oba mjesta strip-uje /backend prefiks isto).
#
# Pakuje dist/ u .tar.gz spreman za prenos na VM.
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

require_cmd npm

# Zaštita od Git Bash (MSYS2) automatske konverzije putanja na Windowsu:
# ako se ova skripta pokreće kroz Git Bash, MSYS po defaultu "prepoznaje"
# svaku vrijednost koja liči na apsolutnu Unix putanju (počinje sa "/") i
# tiho je pretvara u Windows putanju PRIJE nego stigne do npm-a/Vite-a —
# npr. "/backend/api" postane "C:/Program Files/Git/backend/api", što se
# onda "upeče" u build i login tiho ne radi. MSYS_NO_PATHCONV=1 isključuje
# tu konverziju; na Linuxu/macOS-u ovo je no-op (MSYS ne postoji).
export MSYS_NO_PATHCONV=1

VITE_API_BASE_URL="${VITE_API_BASE_URL:-/backend/api}"
VITE_API_BASE_URLS="${VITE_API_BASE_URLS:-/backend/api}"

step "npm ci (frontend)"
(cd "${ROOT_DIR}/frontend" && npm ci)

step "npm run build (VITE_API_BASE_URL=${VITE_API_BASE_URL})"
(cd "${ROOT_DIR}/frontend" && \
  VITE_API_BASE_URL="${VITE_API_BASE_URL}" \
  VITE_API_BASE_URLS="${VITE_API_BASE_URLS}" \
  npm run build)

ok "Build gotov: ${ROOT_DIR}/frontend/dist"

# Sigurnosna provjera: da MSYS/Git-Bash path-conversion (ili neka druga
# slična zamka) nije pretvorila "/backend/api" u nešto pogrešno (npr.
# Windows putanju). Ako se ovo javi, build NE prenositi na VM.
if grep -qE "Program Files|[A-Za-z]:/.*backend/api" "${ROOT_DIR}/frontend/dist/assets/"*.js 2>/dev/null; then
  err "Detektovana pogrešna (Windows-mangled) vrijednost VITE_API_BASE_URL u build-u!"
  echo "Provjeri da li je MSYS_NO_PATHCONV=1 zaista primijenjen (Git Bash na Windowsu)."
  exit 1
fi
ok "Provjera prošla: VITE_API_BASE_URL nije mangled u build-u."

OUT_FILE="${ARTIFACTS_DIR}/frontend-dist-${IMAGE_TAG}.tar.gz"
step "Pakovanje u ${OUT_FILE}"
tar -czf "${OUT_FILE}" -C "${ROOT_DIR}/frontend" dist
ok "Sačuvano: ${OUT_FILE} ($(du -h "$OUT_FILE" | cut -f1))"

cat <<EOF

${c_bold}Sljedeći koraci (na VM-u):${c_reset}
  1) scp "${OUT_FILE}" <user>@<vm-host>:/tmp/
  2) Na VM-u: ./scripts/vm-frontend-deploy.sh /tmp/$(basename "$OUT_FILE")

EOF
