#!/usr/bin/env bash
# =====================================================================
# scripts/mobile-build-android.sh
#
# Profesionalni Android APK build za SIM Tracker mobile aplikaciju.
# Podržava odvojene profile:
#   - vm    -> EAS profil "production-lan"   (VM / LAN API: http://10.50.255.189/api)
#   - cloud -> EAS profil "production-cloud" (Produkcija:   https://api.simtracker.ba101.top)
#   - dev   -> EAS profil "development"      (Dev client:   http://10.50.255.189/api)
#
# Primjeri:
#   ./scripts/mobile-build-android.sh --target vm --mode local
#   ./scripts/mobile-build-android.sh --target cloud --mode local --bump patch
#   ./scripts/mobile-build-android.sh --target cloud --mode cloud --bump minor
#   ./scripts/mobile-build-android.sh --target vm --api-url http://10.10.10.30/api --dry-run
# =====================================================================
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

MOBILE_DIR="${ROOT_DIR}/mobile"
TARGET=""
MODE="local"
BUMP=""
CUSTOM_API_URL=""
SKIP_CHECKS="false"
DRY_RUN="false"

print_help() {
  cat <<'EOF'
SIM Tracker — Android APK Build (EAS Local / Cloud)

Upotreba:
  ./scripts/mobile-build-android.sh [opcije]

Opcije:
  --target <vm|cloud|dev>      Ciljno okruženje:
                                 vm    -> profil production-lan   (VM API)
                                 cloud -> profil production-cloud (Produkcijski API)
                                 dev   -> profil development      (Dev client)
  --mode <local|cloud>         Način builda: local (eas --local, default) ili cloud (EAS serveri)
  --bump <patch|minor|major>   Automatski podigni SemVer i android.versionCode prije builda
  --api-url <url>              Privremeni override za EXPO_PUBLIC_API_BASE_URL
  --skip-checks                Preskoči pre-flight provjere (typecheck, lint, i18n, wcag, ui, test)
  --dry-run                    Prikaži plan i komandu bez pokretanja EAS builda
  -h, --help                   Prikaži ovu pomoć
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --target=*)
      TARGET="${1#*=}"
      shift
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    --bump)
      BUMP="${2:-}"
      shift 2
      ;;
    --bump=*)
      BUMP="${1#*=}"
      shift
      ;;
    --api-url)
      CUSTOM_API_URL="${2:-}"
      shift 2
      ;;
    --api-url=*)
      CUSTOM_API_URL="${1#*=}"
      shift
      ;;
    --skip-checks)
      SKIP_CHECKS="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      err "Nepoznata opcija: $1"
      print_help
      exit 1
      ;;
  esac
done

interactive_select() {
  echo -e "\n${c_bold}=== SIM Tracker — Android APK Build ===${c_reset}\n"
  echo "Odaberi ciljni API:"
  echo "  1) VM / LAN API (profil: production-lan)"
  echo "  2) Produkcijski API van VM-a (profil: production-cloud)"
  echo "  3) Development klijent (profil: development)"
  read -r -p "Izbor [1-3]: " t_choice
  case "$t_choice" in
    1) TARGET="vm" ;;
    2) TARGET="cloud" ;;
    3) TARGET="dev" ;;
    *) err "Neispravan izbor."; exit 1 ;;
  esac

  echo ""
  echo "Odaberi način builda:"
  echo "  1) Lokalni EAS build (--local, izlaz u artifacts/)"
  echo "  2) Expo Cloud EAS build (remote)"
  read -r -p "Izbor [1-2]: " m_choice
  case "$m_choice" in
    1) MODE="local" ;;
    2) MODE="cloud" ;;
    *) err "Neispravan izbor."; exit 1 ;;
  esac

  echo ""
  echo "Uvećati verziju prije builda?"
  echo "  1) Ne (koristi trenutnu verziju iz mobile/app.json)"
  echo "  2) patch (+0.0.1, versionCode +1)"
  echo "  3) minor (+0.1.0, versionCode +1)"
  echo "  4) major (+1.0.0, versionCode +1)"
  read -r -p "Izbor [1-4]: " b_choice
  case "$b_choice" in
    1) BUMP="" ;;
    2) BUMP="patch" ;;
    3) BUMP="minor" ;;
    4) BUMP="major" ;;
    *) err "Neispravan izbor."; exit 1 ;;
  esac
}

if [[ -z "$TARGET" ]]; then
  if [[ -t 0 ]]; then
    interactive_select
  else
    err "Nedostaje --target <vm|cloud|dev> u non-interactive modu."
    print_help
    exit 1
  fi
fi

case "$TARGET" in
  vm)
    EAS_PROFILE="production-lan"
    ARTIFACT_TAG="vm"
    ;;
  cloud)
    EAS_PROFILE="production-cloud"
    ARTIFACT_TAG="prod"
    ;;
  dev)
    EAS_PROFILE="development"
    ARTIFACT_TAG="dev"
    ;;
  *)
    err "Neispravan --target='${TARGET}'. Dozvoljeno: vm, cloud, dev"
    exit 1
    ;;
esac

if [[ "$MODE" != "local" && "$MODE" != "cloud" ]]; then
  err "Neispravan --mode='${MODE}'. Dozvoljeno: local, cloud"
  exit 1
fi

require_cmd node
require_cmd npm

if [[ -n "$BUMP" ]]; then
  step "Podizanje verzije (${BUMP}) za mobile"
  if [[ "$DRY_RUN" == "true" ]]; then
    node "${ROOT_DIR}/scripts/bump-version.mjs" "$BUMP" --target=mobile --dry-run
  else
    node "${ROOT_DIR}/scripts/bump-version.mjs" "$BUMP" --target=mobile
  fi
fi

read -r APP_VERSION APP_BUILD_CODE PROFILE_API_URL < <(
  node -e '
    const fs = require("node:fs");
    const app = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const eas = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    const profile = eas.build?.[process.argv[3]] ?? {};
    const api = process.argv[4] || profile.env?.EXPO_PUBLIC_API_BASE_URL || "";
    console.log(
      app.expo?.version || "0.0.0",
      app.expo?.android?.versionCode || 1,
      api
    );
  ' "${MOBILE_DIR}/app.json" "${MOBILE_DIR}/eas.json" "${EAS_PROFILE}" "${CUSTOM_API_URL}"
)

OUTPUT_APK="${ARTIFACTS_DIR}/simtracker-${ARTIFACT_TAG}-v${APP_VERSION}-b${APP_BUILD_CODE}.apk"
OUTPUT_SHA="${OUTPUT_APK}.sha256"

step "Konfiguracija Android builda"
info "Profil:        ${EAS_PROFILE} (${TARGET})"
info "Način:         ${MODE}"
info "Verzija:       ${APP_VERSION} (versionCode: ${APP_BUILD_CODE})"
info "API Base URL:  ${PROFILE_API_URL}"
if [[ "$MODE" == "local" ]]; then
  info "Izlazni APK:   ${OUTPUT_APK}"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  info "[DRY-RUN] Komanda: eas build --platform android --profile ${EAS_PROFILE}$([[ "$MODE" == "local" ]] && echo " --local --output ${OUTPUT_APK}") --non-interactive"
  exit 0
fi

if [[ "$SKIP_CHECKS" != "true" ]]; then
  step "Pre-flight provjere (@sim-tracker/shared + mobile guards & tests)"
  (
    cd "${ROOT_DIR}"
    npm run build --workspace=@sim-tracker/shared
    npm run typecheck --workspace=sim-tracker-mobile
    npm run lint --workspace=sim-tracker-mobile
    npm run check:i18n --workspace=sim-tracker-mobile
    npm run check:wcag --workspace=sim-tracker-mobile
    npm run check:ui --workspace=sim-tracker-mobile
    npm test --workspace=sim-tracker-mobile
  )
fi

if [[ "$MODE" == "local" ]]; then
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      err "Lokalni EAS build (--local) nije podržan direktno na Windowsu. Koristi Linux, macOS, WSL2 ili --mode cloud."
      exit 1
      ;;
  esac
  require_cmd java
  if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
    warn "ANDROID_HOME / ANDROID_SDK_ROOT nije postavljen u okruženju; Gradle build može pasti ako Android SDK nije u podrazumijevanoj putanji."
  fi
fi

EAS_CMD=(eas)
if ! command -v eas >/dev/null 2>&1; then
  info "Globalni 'eas' nije u PATH-u — koristim 'npx --yes eas-cli'."
  EAS_CMD=(npx --yes eas-cli)
fi

BUILD_ARGS=(build --platform android --profile "${EAS_PROFILE}" --non-interactive)
if [[ "$MODE" == "local" ]]; then
  BUILD_ARGS+=(--local --output "${OUTPUT_APK}")
fi

step "Pokrećem EAS Android build (${EAS_PROFILE})"
(
  cd "${MOBILE_DIR}"
  if [[ -n "$CUSTOM_API_URL" ]]; then
    EXPO_PUBLIC_API_BASE_URL="${CUSTOM_API_URL}" "${EAS_CMD[@]}" "${BUILD_ARGS[@]}"
  else
    "${EAS_CMD[@]}" "${BUILD_ARGS[@]}"
  fi
)

if [[ "$MODE" == "local" && -f "${OUTPUT_APK}" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${OUTPUT_APK}" | tee "${OUTPUT_SHA}"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${OUTPUT_APK}" | tee "${OUTPUT_SHA}"
  fi
  ok "Android APK spreman: ${OUTPUT_APK}"
  info "Za objavu u Web Admin -> App Releases koristi:"
  info "  versionName: ${APP_VERSION}"
  info "  versionCode: ${APP_BUILD_CODE}"
fi
