# SPEC 01 — Security, Auth, RBAC, Tenant Scope & IDOR Remediation
**Prioritet:** P1 (Critical) & P2 (High)
**Opseg:** `backend/src/common/utils/scope-filter.util.ts`, `auth`, `users`, `distributions`, `branches`, `branch-moderators`, `branch-email-recipients`, `activity-log`, `shipments`, `sim-cards`, `meters`, `install-tasks`, `demount-tasks`, `installation-records`, `files`, `mail`, `settings`, `notifications`, `frontend/src/router/index.tsx`

---

## 1. P1 — Tenant Scope & Authorization Bypass

### 1.1 `scope-filter.util.ts` — Fail-Closed Tenant Isolation
- **Fajl:** `backend/src/common/utils/scope-filter.util.ts` (linije 26–67)
- **Problem:**
  - `DIST_ADMIN` sa `distributionId: null` dobija `undefined` (neograničen pristup svim podacima).
  - `USER` bez `branchId` i `distributionId` (i bez moderiranih podružnica) dobija `undefined` u više grana.
  - Linija 59: `USER` sa `branchId: null` i tačno 1 moderiranom podružnicom pada na `distributionIdField` fallback ako `branchIdField` nije proslijeđen.
  - Linija 62: `USER` na opciji `distributionIdField` dobija `undefined` umjesto da bude odbijen (`ForbiddenException`).
- **Zahtjev / Rješenje:**
  1. `SYSTEM_ADMIN` je jedina rola koja vraća `undefined` (globalni scope).
  2. `DIST_ADMIN` bez `distributionId` mora odmah baciti `ForbiddenException` (fail-closed).
  3. `USER` bez ikakvog validnog scope-a (`branchId`, `branchModeratorBranchIds`, `distributionId`) ili kada poziv traži nekompatibilan scope (`distributionIdField` za `USER` bez prava) mora dobiti nemoguć filter `{ id: '__none__' }` ili `ForbiddenException`, NIKAD `undefined`.
- **Testovi (CI):** Unit testovi za sve kombinacije rola (`SYSTEM_ADMIN`, `DIST_ADMIN` sa/bez `distributionId`, `USER` sa/bez `branchId`, `USER` sa 1 ili više `branchModeratorBranchIds`).

### 1.2 `installation-records` — IDOR i Privilege Escalation na `PATCH`, `create`, `findOne`, `downloadPdf`
- **Fajlovi:**
  - `backend/src/modules/installation-records/installation-records.controller.ts`
  - `backend/src/modules/installation-records/installation-records.service.ts`
- **Problemi:**
  1. `PATCH /installation-records/:id` (`controller.ts`) nema `@Roles(...)` niti prosljeđuje `scope`/`currentUser` u `service.update(id, dto)` -> bilo koji autentifikovani `USER` može mijenjati status/podatke tuđih zapisnika.
  2. `create` (`service.ts`) prihvata `dto.installedById` bez provjere da li `USER` kreira zapisnik u svoje ime -> moguća impersonacija drugog korisnika.
  3. `findOne` i `downloadPdf` ne uključuju `branchModeratorBranchIds` u provjeru pristupa.
- **Rješenje:**
  1. Na `PATCH /installation-records/:id` dodati `@Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)` i provjeru vlasništva + scope-a u servisu (običan `USER` može mijenjati samo svoje `DRAFT` zapisnike i ne može proizvoljno mijenjati zaštićene statuse bez state-machine pravila).
  2. U `create`: ako je rola `USER`, forsirati `installedById = currentUser.userId` (ignorisati ili odbiti tuđi `installedById`), a za `DIST_ADMIN` provjeriti da `installedById` pripada istoj distribuciji.
  3. U `findOne`/`downloadPdf` uključiti `branchModeratorBranchIds` kroz jedinstveni helper za scope zapisnika.

### 1.3 `files` — Photo Endpoint Without Tenant Authorization
- **Fajl:** `backend/src/modules/files/files.controller.ts`
- **Problem:** `GET /files/photo?path=...` ima samo `JwtAuthGuard`, bez ikakve provjere da li prijavljeni korisnik smije vidjeti fotografiju tog zapisnika/podružnice/distribucije. Također, `createReadStream` nema `error` event handler.
- **Rješenje:**
  1. Normalizovati i validirati `path` protiv path traversal-a i očekivanog prefiksa (`installation-records/`).
  2. Pronaći povezani `InstallationRecord` (ili odbiti pristup ako fotografija nije vezana za zapisnik u korisnikovom scope-u) koristeći isti scope check kao `InstallationRecordsService.findOne`.
  3. Dodati `stream.on('error', ...)` da ne obara proces ili ne ostavlja viseće response streamove.

### 1.4 `users` — Privilege Escalation & Cross-Tenant Modification
- **Fajlovi:** `backend/src/modules/users/users.controller.ts`, `backend/src/modules/users/users.service.ts`
- **Problem:** `PATCH /users/:id` dopušta `DIST_ADMIN`-u da promijeni `role` (npr. u `SYSTEM_ADMIN`), `distributionId` ili `branchId`, te može ciljati korisnika van svoje distribucije ako `update` DTO prođe.
- **Rješenje:**
  1. Zabraniti `DIST_ADMIN`-u izmjenu `role` (ili ograničiti isključivo na `USER` unutar vlastite distribucije) i zabraniti izmjenu `distributionId`.
  2. Validirati da target `branchId` (ako se mijenja) pripada `DIST_ADMIN`-ovoj distribuciji.
  3. Eksplicitno verificirati scope na `findOne` i `update` prije izmjene u bazi.

### 1.5 `distributions`, `branches`, `branch-moderators`, `activity-log` — Cross-Tenant Read Leaks
- **Fajlovi:**
  - `backend/src/modules/distributions/distributions.controller.ts` & `.service.ts`
  - `backend/src/modules/branches/branches.controller.ts` & `.service.ts`
  - `backend/src/modules/branch-moderators/branch-moderators.controller.ts` & `.service.ts`
  - `backend/src/modules/activity-log/activity-log.controller.ts` & `.service.ts`
- **Problemi:**
  1. `GET /distributions/:id` nema scope filter za `DIST_ADMIN`.
  2. `GET /branches?distributionId=...` dopušta `DIST_ADMIN`-u da preko query parametra `distributionId` čita podružnice drugih distribucija; `GET /branches/:id` nema scope provjeru.
  3. `GET /branch-moderators?userId=...` omogućava bilo kom `USER`-u da ispita moderatorske dodjele drugih korisnika, a `DIST_ADMIN`-u van svoje distribucije.
  4. `GET /activity-log` nema nikakvo scope filtriranje (bilo koji `DIST_ADMIN` vidi audit log svih distribucija).
- **Rješenje:**
  1. Primijeniti `scope` na sve navedene `GET` i `findOne` rute; za `DIST_ADMIN` ignorisati/odbiti strani `distributionId` query param.
  2. Na `GET /branch-moderators`, `USER` smije čitati isključivo vlastiti `userId === currentUser.userId`.
  3. U `activity-log`, filtrirati zapise po korisnikovoj distribuciji/podružnici za `DIST_ADMIN`.

### 1.6 `shipments`, `meters`, `sim-cards`, `install-tasks`, `demount-tasks` — Scope Gaps
- **Problemi:**
  - `shipments.service.ts`: `update` dozvoljava `DIST_ADMIN`-u promjenu `distributionId`.
  - `sim-cards.service.ts`: `findOne` i `listEvents` ignorišu `branchModeratorBranchIds`; `viaShipment` daje branch moderatoru pristup svim SIM karticama cijele distribucije; `assign` ne provjerava da li `userId` pripada istoj distribuciji; `update` poziva `ensureShipmentExists(dto.shipmentId)` bez `scope`.
  - `meters.controller.ts` / `meters.service.ts`: `create` ignoriše `scope`; `update` ne provjerava da `dto.branchId` pripada `DIST_ADMIN` distribuciji; `getMetersReadScopeClause` daje branch moderatoru čitanje SVIH podružnica u distribuciji umjesto samo moderiranih/vlastite podružnice.
  - `install-tasks.service.ts` & `demount-tasks.service.ts`: `cancel` i `reassign` ne provjeravaju distribuciju za `DIST_ADMIN`.
- **Rješenje:** Ujednačiti scope provjere u svim navedenim servisima i zabraniti cross-distribution dodjele i prelaze.

### 1.7 Frontend Route & Template XSS Protections
- **Fajlovi:**
  - `frontend/src/router/index.tsx` (`/shipments/:id/print` nema `RoleGuard`)
  - `frontend/src/pages/settings/EmailSettingsPage.tsx` (`<iframe srcDoc={previewHtml}>` bez `sandbox=""`)
- **Rješenje:**
  1. Umotati `/shipments/:id/print` u `<RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>`.
  2. Dodati `sandbox=""` na `iframe` u `EmailSettingsPage.tsx` kako bi izvršavanje skripti u HTML preview-u bilo potpuno onemogućeno.

---

## 2. P2 — Auth Hardening, Secrets Hygiene & WebSocket Security

### 2.1 Refresh Token Handling (`auth.service.ts`, `jwt.strategy.ts`)
- **Problemi:**
  - `bcrypt` truncira input na 72 bajta -> dva različita JWT refresh tokena sa istim prvim 72 znaka mogu proći validaciju! Koristiti `SHA-256` + `crypto.timingSafeEqual` (ili HMAC) umjesto `bcrypt` za JWT refresh tokene.
  - Jedan `user.refreshToken` string u bazi ruši sesiju kad korisnik koristi i web i mobilnu aplikaciju istovremeno (ili kad paralelni refresh zahtjevi stignu).
  - `jwt.strategy.ts` izvršava 2 odvojena DB upita po svakom HTTP zahtjevu (`user.findUnique` + `branchModerator.findMany`) -> spojiti u 1 upit (`include: { branchModerations: { select: { branchId: true } } }`).

### 2.2 Settings Secret Exposure (`settings.service.ts`)
- **Problem:** `GET /settings` vraća `smtp.pass` u plain-textu svim `SYSTEM_ADMIN` klijentima.
- **Rješenje:** Maskirati tajne ključeve (`smtp.pass`, ključevi koji sadrže `secret`/`pass`/`token`) u `GET /settings` odgovoru (npr. `hasValue: true` / `'********'`) i ne prepisivati postojeću šifru ako klijent pošalje maskiranu vrijednost.

### 2.3 WebSocket Gateway Security (`notifications.gateway.ts`)
- **Problem:** `cors: { origin: '*' }`, prihvata JWT preko `query.token` (curi u Nginx/Traefik access logove), i drži `USER_SOCKET_MAP` samo u lokalnoj memoriji procesa.
- **Rješenje:**
  1. Uskladiti WebSocket CORS sa `FRONTEND_URLS` allowlistom iz `ConfigService`.
  2. Ukloniti ili deprecirati čitanje tokena iz query stringa; koristiti isključivo `client.handshake.auth.token` (ili `Authorization` header).

### 2.4 Git History & Committed Secrets / Binaries
- **Problem:** U repo su commitovani: `.env`, `backend/.env`, `backend/.env.prod`, `backend/.env.host`, `frontend/.env`, `frontend/.env.prod`, `mobile/.env`, `mobile/.env.prod`, `mobile/android/sim-tracker-162d1-firebase-adminsdk-fbsvc-0ddd5cbe99.json`, te `39_1776859844856_simtracker-prod-22042026-arm64-v8a-39.apk` (41MB).
- **Rješenje:** Dokumentovati hitnu rotaciju Firebase Admin SDK ključa i prod kredencijala, dodati stroga `.gitignore` pravila za `.env*` (osim `*.example`), `*firebase-adminsdk*.json`, `*.apk`, i ukloniti ih iz aktivnog tree-a u Phase 3 (uz napomenu za `git filter-repo` za čišćenje historije).
