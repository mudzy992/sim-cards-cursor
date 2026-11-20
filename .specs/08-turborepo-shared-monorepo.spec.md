# Specifikacija 08 — Opcija 2 (Naredna Faza): Turborepo Monorepo & Dijeljeni `@sim-tracker/shared` Paket

**Preduvjet:** Potpuni završetak **Opcije 1** (`.specs/07-ui-standardization-wcag-aaa.spec.md`).  
**Cilj:** Uvesti **Turborepo** monorepo strukturu oko postojećih aplikacija (`backend` NestJS, `frontend` React + Vite, `mobile` Expo) bez prepisivanja web aplikacije na Next.js, kako bismo eliminisali dupliranje ugovora između servisa i ubrzali build/CI pipeline.

---

## 1. Zašto Turborepo bez Next.js-a?

- Web frontend ostaje brza statička **React + Vite + Nginx** aplikacija (~15–20 MB RAM na VM-u, bez potrebe za promjenom JWT/`localStorage` toka, Traefik pravila ili Node SSR servera).
- Turborepo rješava glavni problem višeplatformskog projekta (`backend` + `frontend` + `mobile`): **jedinstven izvor istine za tipove, `ErrorCodes`, konstante, formatere i design tokene**.

---

## 2. Planirana struktura repozitorija

```text
sim-cards-cursor/
├── package.json              # Root npm workspaces + turbo skripte
├── turbo.json                # Pipeline definicija (build, typecheck, lint, test, check:*)
├── packages/
│   └── shared/               # @sim-tracker/shared
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── error-codes.ts       # Jedinstveni ErrorCodes enum (BE + FE + Mobile)
│           ├── enums.ts             # UserRole, SimCardStatus, MeterStatus, TaskStatus...
│           ├── api-contracts.ts     # Zajednički request/response DTO tipovi & paginacija
│           ├── validation.ts        # ICCID/IP/phone normalizacija & regex konstante
│           ├── tokens.ts            # Zajednički WCAG AAA design tokeni (Web + Mobile)
│           └── index.ts
├── backend/                  # NestJS API (konzumira @sim-tracker/shared)
├── frontend/                 # Vite React web konzola (konzumira @sim-tracker/shared)
└── mobile/                   # React Native Expo aplikacija (konzumira @sim-tracker/shared)
```

---

## 3. Fazni plan izvršenja (Opcija 2 — nakon Opcije 1)

### Faza 1 — Workspace & Turborepo Temelj
1. Konfigurisati root `package.json` sa `workspaces: ["packages/*", "backend", "frontend", "mobile"]` (uz pažljivu provjeru Expo Metro bundler kompatibilnosti sa npm workspaces / symlinks).
2. Kreirati `turbo.json` sa taskovima:
   - `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`)
   - `typecheck` (`dependsOn: ["^build"]`)
   - `lint`, `test`, `check:i18n`, `check:ui`, `check:wcag`.
3. Inicijalizovati `packages/shared` (`@sim-tracker/shared`) sa čistim ESM/CJS exportima (ili TypeScript source transpilacijom za NestJS, Vite i Metro).

### Faza 2 — Konsolidacija dijeljenog koda u `@sim-tracker/shared`
1. **Premjestiti `ErrorCodes`:**
   - Iz `backend/src/common/constants/error-codes.ts` u `@sim-tracker/shared`, te ga direktno uvesti u `backend`, `frontend` (`error.utils.ts`) i `mobile` (`error.utils.ts`).
2. **Premjestiti domenske normale i validacije:**
   - `normalizeIccid`, `normalizePhoneNumber`, `normalizeEmail` i regex/ograničenja (da se web import, backend import/create i mobile unos ponašaju 100% identično).
3. **Premjestiti zajedničke API tipove i domenske enume:**
   - `UserRole`, `UserStatus`, `SimCardStatus`, `MeterStatus`, `MeterSimCardState`, `InstallTaskStatus`, `DemountTaskStatus`, `ApiEnvelope<T>`, `PaginatedResult<T>`.
4. **Uskladiti Design Tokene (`packages/shared/src/tokens.ts`):**
   - Povezati `mobile/src/theme/tokens.ts` sa istim WCAG AAA akcentima i statusnim bojama iz Opcije 1.

### Faza 3 — Prilagodba Docker, VM Offline Skripti & CI Pipeline-a
1. **Docker & Offline VM build (`Dockerfile`, `Dockerfile.vm`, `scripts/vm-*.sh`):**
   - Osigurati da `backend/Dockerfile`, `backend/Dockerfile.vm`, `frontend/Dockerfile` i `frontend/Dockerfile.vm` imaju pristup root `package*.json` i `packages/shared` u Docker build kontekstu (bez lomljenja postojećih `simtracker-backend-deps` / offline VM skripti!).
2. **GitHub Actions CI (`.github/workflows/ci.yml`):**
   - Iskoristiti `turbo run typecheck lint build` sa remote/action kešom za brže provjere, uz zadržavanje izolovanog `postgres:16-alpine` E2E posla i `mobile` Metro/typecheck provjere.

---

## 4. Kriteriji završetka Opcije 2
- [ ] `packages/shared` se gradi deterministički i bez cirkularnih zavisnosti.
- [ ] Nema dupliranih definicija za `ErrorCodes`, `normalizeIccid`, `normalizePhoneNumber` i API envelope tipove između `backend`, `frontend` i `mobile`.
- [ ] Svi Dockerfiles (`Dockerfile`, `Dockerfile.vm`) i `scripts/vm-*.sh` uspješno grade slike s uključenim `@sim-tracker/shared`.
- [ ] `turbo run typecheck lint test build` i backend E2E prolaze zeleno u GitHub Actions CI.
