# SIM Tracker — Plan implementacije (Phase 3 & Phase 4)

**Grana:** `arena/015aa78f-sim-cards-cursor`  
**Status:** Implementacija je završena (Faza 1–4 kompletirane, uključujući naknadna poboljšanja za stabilnu paginaciju štampe, 4-poljnu provjeru duplikata, `ErrorBoundary`, `ErrorCodes`, `reorderFields` DTO, paginaciju pregleda naljepnica i `mobile/` typecheck/401 mutex). Ovaj dokument služi kao historijska referenca plana izvršenja.

> **Napomena za VM produkcijski deploy:**
> 1. `backend/Dockerfile.vm` svjesno ostavlja podrazumijevanog korisnika radi kompatibilnosti s postojećim host bind-mount direktorijem `/mnt/shared-app-files/sim-cards`; nakon `chown -R 1000:1000 /mnt/shared-app-files/sim-cards` na VM-u može se uključiti `USER node`.
> 2. Rotirati ranije committane tajne (Firebase Admin SDK ključ, DB/JWT/SMTP tajne iz ranijih `.env` fajlova) prije narednog produkcijskog izdanja.

---

## Principi izvršenja
1. **Izolovani testovi u GitHub Actions CI:** Svi backend unit, migracioni (`prisma migrate deploy`) i integracioni/e2e testovi pokreću se isključivo unutar GitHub Actions CI protiv efemernog `postgres:16-alpine` kontejnera (nikakva lokalna ili vanjska produkcijska baza).
2. **Strogi redoslijed prioriteta:** Prvo stabilnost i sigurnost (`P1`), zatim funkcionalni bugovi, validacija i performanse (`P2`), pa refaktoring, code splitting i standardizacija (`P3`).
3. **Bez PR-a i bez promjene grane:** Sav rad ostaje na `arena/015aa78f-sim-cards-cursor`.

---

## Korak 1 — CI Pipeline & Standardizacijska infrastruktura (Temelj verifikacije)
**Specifikacije:** `.specs/05-github-actions-ci.spec`, `.specs/06-standardization-scripts.spec`

1. Kreirati `.github/workflows/ci.yml` sa:
   - `backend-lint-build-test` jobom + efemerni `postgres:16-alpine` service container (`pg_isready` healthcheck, `prisma generate`, `prisma migrate deploy`, `lint`, `tsc --noEmit`, `build`, `jest` unit + `test:e2e`).
   - `frontend-lint-build-audit` jobom (`lint`, `typecheck`, `i18n:check`, `ui:check`, `build`, vitest/a11y).
   - `repo-hygiene` jobom (provjera da nema `.env`/`.apk`/Firebase ključeva).
2. Popraviti `backend/jest.config.ts` (zamijeniti deprecated `globals['ts-jest']` sa `transform`) i dodati `backend/test/jest-e2e.json` + `test:e2e` skriptu.
3. Uvesti ESLint v9 + Prettier za `backend/` i `frontend/` (uključujući `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks`, `@typescript-eslint/no-explicit-any`).
4. Napraviti prenosive skripte:
   - `frontend/scripts/check-i18n.mjs` (zamjena za slomljeni `check_used_keys.sh` + provjera pariteta ključeva, parametara i detekcija hardcoded UI stringova).
   - `frontend/scripts/check-ui-consistency.mjs` (deprecated AntD props, `href` reload linkovi, unsafe `iframe`, light boje izvan `.print-preview-scope`).
   - Dodati `@axe-core/react` / `vitest` + `axe-core` a11y smoke testove za ključne ekrane.

---

## Korak 2 — Sigurnost, Tenant Scope, RBAC & IDOR (P1)
**Specifikacija:** `.specs/01-security-auth-rbac-idor.spec`

1. **`scope-filter.util.ts`:** Uvesti strogo fail-closed ponašanje (`DIST_ADMIN` bez `distributionId` baca `ForbiddenException`; `USER` bez validnog branch/distribution scope-a dobija nemoguć filter umjesto `undefined`; ispraviti granu sa 1 moderiranom podružnicom).
2. **Kontroleri i servisi:**
   - `installation-records`: dodati `@Roles` i `scope` + ownership check na `PATCH /:id`; forsirati `installedById = currentUser.id` za `USER`; uključiti `branchModeratorBranchIds` u `findOne` i `downloadPdf`.
   - `files`: dodati tenant/scope autorizaciju na `GET /files/photo` provjerom povezanog `InstallationRecord`-a + stream `error` handler.
   - `users`: spriječiti `DIST_ADMIN` promjenu `role`/`distributionId` i cross-distribution targetiranje na `PATCH /users/:id`.
   - `distributions`, `branches`, `branch-moderators`, `activity-log`: uvesti obaveznu `DIST_ADMIN` / `USER` scope izolaciju na svim `GET` i `:id` rutama.
   - `shipments`, `sim-cards`, `meters`, `install-tasks`, `demount-tasks`: zatvoriti cross-distribution rupe (`update.distributionId`, `assign`, `cancel`, `reassign`, `getMetersReadScopeClause`, `findOne`/`listEvents` za moderatore).
3. **Auth & Gateway & Secrets:**
   - Zamijeniti `bcrypt` na refresh tokenima sa `SHA-256` + `timingSafeEqual`; spojiti `JwtStrategy.validate` u 1 DB upit.
   - Maskirati `smtp.pass` i tajne u `GET /settings`.
   - Ograničiti WebSocket CORS na `FRONTEND_URLS` i ukloniti token iz URL query stringa.
4. **Frontend sigurnost:**
   - Dodati `<RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>` na `/shipments/:id/print`.
   - Dodati `sandbox=""` na `<iframe srcDoc={previewHtml}>` u `EmailSettingsPage.tsx`.
5. **Repo Hygiene (P1):**
   - Ažurirati `.gitignore` (`.env*` osim `*.example`, `*.apk`, `*firebase-adminsdk*.json`) i ukloniti committane `.env`, Firebase JSON i `.apk` iz aktivnog stabla (`git rm --cached`), uz jasnu uputu korisniku za rotaciju Firebase ključa i čišćenje git historije.

---

## Korak 3 — Transakciona atomičnost, DTO validacija i stabilnost podataka (P1/P2)
**Specifikacija:** `.specs/02-backend-data-integrity-transactions.spec`

1. **`RecordNumberGenerator`:** Zamijeniti non-atomic `findFirst` + `sequence + 1` atomskim brojačem u PostgreSQL-u unutar transakcije (rješava `P2002` race condition i sortiranje iznad `99999`).
2. **Atomske transakcije:**
   - `SimCardsService.claim`: atomski `updateMany` sa `status: AVAILABLE, assignedToId: null`.
   - `InstallTasksService.complete` & `InstallationRecordsService.create` & `MetersService.create`: jedinstvena `prisma.$transaction` za sve povezane mutacije.
   - `DemountTasksService.complete` (`REPLACE_SIM`): atomski lock nad `newSimCardId`.
3. **DTO zamjena za inline body tipove:** `install-tasks`, `demount-tasks`, `mail`, `settings` (`setMobilePush`), `meter-type-definitions` (`reorderFields`), `notifications` (`limit` DTO).
4. **OOM/DoS prevencija & Error Handling:**
   - `shipments.service.ts`: `fetchExistingIccidMap` ograničiti na `iccid: { in: candidateIccids }`.
   - `analytics.service.ts` & `dashboard.service.ts`: validirati `CUSTOM` datume (max 366/730 dana), prebaciti `getSimCardsAnalytics` na agregacije, dodati CSV formula-injection sanitizaciju i bacati `BadRequestException` za nepoznati report.
   - `prisma-exception.filter.ts`: ukloniti `exception.meta`, dodati `P2003` i `P2014`.
   - Uvesti centralne `ErrorCodes` na backendu za ključne poslovne greške radi potpune dvojezičnosti (bs/en).

---

## Korak 4 — VM & Production Optimizacija (P1/P2)
**Specifikacije:** `.specs/04-vm-production-optimization.spec`

1. **`PdfGeneratorService`:** `try/finally` zatvaranje browsera, `--disable-dev-shm-usage`, `--disable-gpu`, concurrency semafor (max 2-3 paralelna rendera), uklanjanje `data: any`.
2. **Graceful shutdown & Healthcheck:** `app.enableShutdownHooks()`, `listen(port, '0.0.0.0')`, `PrismaService implements OnModuleDestroy`, `HealthController` sa `SELECT 1`, Docker `healthcheck` + `init: true` + resource limiti u `docker-compose.vm.app.yml`.
3. **250MB APK Streaming:** `diskStorage` + streaming `SHA-256` hash + async filesystem operacije u `app-releases`.
4. **`TimeoutInterceptor`:** Podrška za `@RequestTimeout(ms)` metapodatke na dugim rutama (import, upload, PDF).
5. **Config & Hardening:** `main.ts` čita i `FRONTEND_URLS` i `FRONTEND_URL`, CORS localhost samo u dev-u, Swagger pod flagom, ukloniti `nije,kikiriki` fallback, non-root `USER` u `Dockerfile`/`Dockerfile.vm`, `seed.ts` maskira DB password i zabranjuje default lozinku u produkciji.
6. **`frontend/nginx.conf`:** `gzip`, immutable caching za `/assets/*`, `no-cache` za `index.html`, uklanjanje HSTS na plain-HTTP portu 80, dodavanje CSP-a.

---

## Korak 5 — Web Frontend Bugovi, Performanse, i18n & A11y (P1–P3)
**Specifikacija:** `.specs/03-frontend-bugs-architecture.spec`, `.specs/06-standardization-scripts.spec`

1. **P1 popravke:**
   - `PushCampaignsPage.tsx`: premjestiti rani `return` ispod svih hookova; povezati `userSearch` i `[t]` deps.
   - `InstallationRecordDetailPage.tsx`: ukloniti render-body `URL.createObjectURL` + `setPdfObjectUrl`; premjestiti `isError` provjeru iznad `!record`.
   - `axios.instance.ts`: `refreshPromise` mutex za paralelne 401 zahtjeve.
   - `useNotificationSocket.ts`: ispraviti `/notifications` namespace i `path` za `/backend/api` prefiks + reconnect handler.
2. **P2 popravke:**
   - `RecordPhotoImage.tsx` (`cancelled` cleanup + i18n + dark theme).
   - `UsersListPage.tsx` (server-side paginacija, `pendingModeratorSync` fix, `DIST_ADMIN` role lock).
   - `MetersListPage.tsx`, `MeterDetailPage.tsx`, `MeterTypeUpsertPage.tsx`, `ActivityLogPage.tsx`, `ShipmentsListPage.tsx` (invalidacije, reset stranice na filter, `useEffect` umjesto `fields` propa, uklanjanje dead state-a).
   - `error.utils.ts` (nizovi validacionih poruka + `errorCode` -> `i18n`).
   - Uklanjanje svih 12 `as any` pojavljivanja.
3. **P3 optimizacije & A11y:**
   - `React.lazy` + `Suspense` u `router/index.tsx` + uklanjanje nekorištenog `ShipmentCreatePage`.
   - React `ErrorBoundary` u `AppLayout.tsx`, SPA navigacija umjesto `<Button href>`, ažuriranje deprecated AntD v5 props-a.
   - A11y popravke (`aria-label` na `NotificationBell`, tastaturna navigacija za liste/redove).
   - Paginacija/optimizacija pregleda listova u `ShipmentPrintPage.tsx`, lokalizovan `app-version.ts` i preostali sitni stringovi.

---

## Korak 6 — Završna verifikacija (Phase 4)
1. Push na `arena/015aa78f-sim-cards-cursor` i provjera da svi GitHub Actions CI jobovi prolaze zeleno (uključujući `prisma migrate deploy`, unit + e2e testove na efemernoj PostgreSQL bazi, ESLint/Prettier, i18n, a11y i Vite production build).
2. Ažuriranje izvještaja o završenim izmjenama i sigurnosnih preporuka za operatera/VM deploy.
