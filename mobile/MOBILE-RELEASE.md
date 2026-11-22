# Mobile Release & Versioning Guide (`mobile/`)

Ovaj dokument opisuje standardizirani proces praćenja verzija (`SemVer` + Android `versionCode`) i pravljenja odvojenih Android APK buildova za **VM (LAN)** i **Produkciju (Cloud)**.

---

## 1. Pregled verzija u monorepu

```bash
npm run version:status
```

Single source of truth za mobilnu aplikaciju:
- `mobile/app.json` -> `expo.version` (`major.minor.patch`) i `expo.android.versionCode` (cijeli broj koji backend `app-releases` i mobilni `useAppUpdateCheck` koriste za poređenje verzija).
- `mobile/package.json` -> `version` (automatski sinhronizovan sa `mobile/app.json`).
- `mobile/eas.json` -> `cli.appVersionSource: "local"`, tako da i lokalni (`--local`) i cloud EAS build uvijek koriste istu verziju iz repozitorija.

---

## 2. Podizanje verzije (`patch`, `minor`, `major`)

```bash
# Bugfix izdanje (1.0.0 -> 1.0.1, versionCode +1)
npm run version:bump -- patch

# Nova funkcionalnost (1.0.1 -> 1.1.0, versionCode +1)
npm run version:bump -- minor

# Breaking / veće izdanje (1.1.0 -> 2.0.0, versionCode +1)
npm run version:bump -- major

# Provjera bez izmjene fajlova
npm run version:bump -- patch --dry-run

# Podizanje verzije i kreiranje git taga (npr. mobile-v1.0.1+b41)
npm run version:bump -- patch --tag

# Podizanje verzije za sve pakete odjednom (mobile, frontend, backend, shared)
npm run version:bump -- minor --target=all
```

---

## 3. Odvojeni Android APK build (VM vs Produkcija)

### Profili u `mobile/eas.json`
| Cilj (`--target`) | EAS Profil | `EXPO_PUBLIC_API_BASE_URL` | Izlazni artefakt |
| --- | --- | --- | --- |
| `vm` | `production-lan` | `http://10.50.255.189/api` | `artifacts/simtracker-vm-v<ver>-b<code>.apk` |
| `cloud` | `production-cloud` | `https://api.simtracker.ba101.top` | `artifacts/simtracker-prod-v<ver>-b<code>.apk` |
| `dev` | `development` | `http://10.50.255.189/api` | `artifacts/simtracker-dev-v<ver>-b<code>.apk` |

### Preduslovi za lokalni build (`--mode local`)
- Linux ili macOS (na Windowsu koristiti WSL2 ili `--mode cloud`).
- Instaliran JDK 17+, Android SDK (`ANDROID_HOME`), te `eas-cli` (ili automatski fallback preko `npx eas-cli`).

### Komande za build

```bash
# 1. Lokalni APK za VM API (sa pre-flight provjerama i testovima)
npm run mobile:build:vm
# ili iz mobile/ ili direktno:
./scripts/mobile-build-android.sh --target vm --mode local

# 2. Lokalni APK za produkcijski Cloud API
npm run mobile:build:cloud
# ili direktno:
./scripts/mobile-build-android.sh --target cloud --mode local

# 3. Podizanje verzije + lokalni build u jednom koraku
./scripts/mobile-build-android.sh --target cloud --mode local --bump patch

# 4. Pokretanje na Expo EAS Cloud serverima umjesto lokalno
./scripts/mobile-build-android.sh --target cloud --mode cloud --bump minor

# 5. Privremeni override API adrese za testni VM
./scripts/mobile-build-android.sh --target vm --api-url http://10.10.10.30/api
```

Skripta prije pakovanja APK-a automatski pokreće:
1. Build `@sim-tracker/shared`
2. Mobile `typecheck`, `lint`, `check:i18n`, `check:wcag`, `check:ui` i `jest` testove
3. EAS Android build i generisanje `.sha256` checksum fajla u `artifacts/`.

---

## 4. Objava nove verzije u sistem (In-App Auto-Update)

1. U Web Admin panelu otvorite **App Releases** (`/app-releases`).
2. Uploadujte generisani `.apk` iz `artifacts/`.
3. Unesite tačne vrijednosti `versionName` i `versionCode` koje je ispisala build skripta.
4. Svi terenski uređaji sa starijim `versionCode` brojem dobit će na `Home` ekranu baner za direktno preuzimanje i instalaciju nove verzije sa prikazom progresa.
