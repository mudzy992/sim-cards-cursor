#!/usr/bin/env bash
# =====================================================================
# scripts/deploy.sh — glavni izborni meni za build/deploy.
#
# Pokrenuti bez argumenata za interaktivni meni:
#   ./scripts/deploy.sh
#
# Skripta sama ne "zna" da li mašina na kojoj se pokreće ima internet —
# svaka opcija u meniju jasno piše GDJE se ta konkretna komanda treba
# pokrenuti (mašina sa internetom vs. VM offline).
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

print_header() {
  echo -e "\n${c_bold}=== SIM Tracker — build/deploy meni ===${c_reset}\n"
}

vm_menu() {
  echo -e "\n${c_bold}-- VM (zatvoreni sistem, bez interneta) --${c_reset}"
  echo "  1) Trebamo li novi deps image (promijenjene zavisnosti)?"
  echo "     -> gradi se NA MAŠINI SA INTERNETOM, pa se prenosi na VM"
  echo "  2) Backend (app kod, offline build NA VM-u, koristi postojeći deps image)"
  echo "  3) Frontend — build dist-a (NA MAŠINI SA INTERNETOM)"
  echo "  4) Frontend — deploy već pripremljenog dist-a (NA VM-u, offline)"
  echo "  5) Postgres/pgAdmin image-i — priprema (NA MAŠINI SA INTERNETOM)"
  echo "  6) Postgres/pgAdmin image-i — učitavanje (NA VM-u, offline)"
  echo "  7) Frontend base image (nginx:alpine) — priprema (NA MAŠINI SA INTERNETOM, samo jednom)"
  echo "  8) Frontend base image (nginx:alpine) — učitavanje (NA VM-u, offline, samo jednom)"
  echo "  9) Nazad"
  read -r -p "Izbor [1-9]: " vmc
  case "$vmc" in
    1) ./vm-deps-build.sh ;;
    2) ./vm-backend-build.sh ;;
    3) ./vm-frontend-build.sh ;;
    4) ./vm-frontend-deploy.sh ;;
    5) ./postgres-image-prepare.sh ;;
    6) ./postgres-image-load.sh ;;
    7) ./vm-frontend-baseimage-prepare.sh ;;
    8) ./vm-frontend-baseimage-load.sh ;;
    9) return ;;
    *) warn "Nepoznat izbor." ;;
  esac
}

main_menu() {
  print_header
  echo "  1) Public (host, ima internet) — build & deploy"
  echo "  2) VM (zatvoreni sistem, bez interneta) — podmeni"
  echo "  3) Izlaz"
  read -r -p "Izbor [1-3]: " choice
  case "$choice" in
    1) ./public-deploy.sh ;;
    2) vm_menu ;;
    3) exit 0 ;;
    *) warn "Nepoznat izbor." ;;
  esac
}

main_menu
