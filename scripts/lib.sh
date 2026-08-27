#!/usr/bin/env bash
# =====================================================================
# scripts/lib.sh — zajedničke funkcije/podešavanja za sve deploy skripte.
# Ne pokreće se direktno — učitavaju ga ostale skripte preko `source`.
# =====================================================================
set -euo pipefail

# Root projekta (jedan nivo iznad scripts/), bez obzira odakle se skripta poziva.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"

# --- Image tag konvencija ---------------------------------------------------
# Podrazumijevano: git short SHA ako je dostupan, inače timestamp.
DEFAULT_TAG="$( (cd "$ROOT_DIR" && git rev-parse --short HEAD 2>/dev/null) || date +%Y%m%d-%H%M )"
IMAGE_TAG="${IMAGE_TAG:-$DEFAULT_TAG}"

DEPS_IMAGE_NAME="simtracker-backend-deps"
DEPS_IMAGE_LATEST="${DEPS_IMAGE_NAME}:latest"
DEPS_IMAGE_TAGGED="${DEPS_IMAGE_NAME}:${IMAGE_TAG}"

POSTGRES_IMAGE="postgres:16-alpine"
PGADMIN_IMAGE="dpage/pgadmin4:latest"
NGINX_IMAGE="nginx:alpine"

mkdir -p "$ARTIFACTS_DIR"

# --- Output helpers ----------------------------------------------------------
c_reset="\033[0m"; c_bold="\033[1m"; c_green="\033[32m"; c_yellow="\033[33m"; c_red="\033[31m"; c_blue="\033[34m"

info()  { echo -e "${c_blue}==>${c_reset} $*"; }
ok()    { echo -e "${c_green}OK${c_reset}  $*"; }
warn()  { echo -e "${c_yellow}!!${c_reset}  $*"; }
err()   { echo -e "${c_red}FAIL${c_reset} $*" 1>&2; }
step()  { echo -e "\n${c_bold}--- $* ---${c_reset}"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Komanda '$1' nije pronađena u PATH-u. Instaliraj je pa pokušaj ponovo."
    exit 1
  fi
}

confirm() {
  # confirm "Pitanje?" -> vraća 0 (da) ili 1 (ne)
  local prompt="${1:-Nastaviti?} [y/N]: "
  local reply
  read -r -p "$prompt" reply
  [[ "$reply" =~ ^[Yy]$ ]]
}
