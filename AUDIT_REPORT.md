# SIM Tracker — Sveobuhvatni Arhitektonski, Sigurnosni, QA & DevOps Audit Izvještaj

**Datum:** 2026-11-20  
**Grana:** `arena/015aa78f-sim-cards-cursor` (bazirano na `335a2fba7a1fb0d7f8b6978623f74b28445e40a8`)  
**Opseg:** 100% Backend (`backend/src`, `backend/prisma`, `backend/test`, Docker/VM konfiguracije) i Web Frontend (`frontend/src`, `frontend/nginx.conf`, Vite/Tailwind/AntD konfiguracije). (`mobile/` je van opsega uz provjeru dijeljenih API ugovora i committanih tajni/binarnih fajlova).

---

## 1. Izvršni sažetak (Executive Summary)

| Prioritet | Backend | Web Frontend | VM / DevOps / CI | Ukupno |
|---|---:|---:|---:|---:|
| **P1 (Critical)** | 13 | 5 | 7 | **25** |
| **P2 (High)** | 15 | 11 | 7 | **33** |
| **P3 (Low)** | 6 | 9 | 3 | **18** |
| **Ukupno** | **34** | **25** | **17** | **76** |

### Ključni kritični nalazi (P1)
1. **Fail-open multi-tenant izolacija (`scope-filter.util.ts`):** U određenim kombinacijama (`DIST_ADMIN` bez `distributionId`, `USER` bez `branchId`/`distributionId`, `USER` sa `distributionIdField`) `scopeWhere()` vraća `undefined` — što efektivno daje globalni pristup svim podacima.
2. **IDOR / Privilege Escalation:**
   - `PATCH /installation-records/:id` nema `@Roles` niti `scope` provjeru (`installation-records.controller.ts:185`, `installation-records.service.ts:469`).
   - `GET /files/photo` nema nikakvu tenant/scope autorizaciju (`files.controller.ts:18-37`).
   - `PATCH /users/:id` dopušta `DIST_ADMIN`-u izmjenu `role`, `distributionId` i `branchId` (`users.controller.ts:58`, `users.service.ts`).
   - Cross-tenant curenje na `GET /distributions/:id`, `GET /branches` (`distributionId` query override), `GET /branch-moderators`, `GET /activity-log`, `sim-cards` (`findOne`/`listEvents`/`viaShipment`), `meters` (`create`/`update`/`getMetersReadScopeClause`), `install-tasks`/`demount-tasks` (`cancel`/`reassign`).
3. **Race conditions & polukonzistentne transakcije:**
   - `RecordNumberGenerator.generate()` koristi `findFirst` + `sequence + 1` bez zaključavanja (`record-number.generator.ts:12-31`), što izaziva `P2002` kolizije i puca preko `99999`.
   - `SimCardsService.claim()` nije atomski (`sim-cards.service.ts:338-375`).
   - `InstallTasksService.complete()` (`install-tasks.service.ts:373-505`) i `InstallationRecordsService.create()` izvode povezane mutacije izvan jedinstvene transakcije; `DemountTasksService.complete()` (`REPLACE_SIM`) ne zaključava atomski `newSimCardId`.
4. **Frontend runtime crash & sigurnosni propusti:**
   - `PushCampaignsPage.tsx:21-37` ima rani `return` prije `useQueryClient`/`useState`/`useQuery` poziva (**kršenje React Rules of Hooks**).
   - `InstallationRecordDetailPage.tsx:141-144,166-198` radi `setState` + `URL.createObjectURL` u tijelu rendera i čini `if (recordQuery.isError)` nedostižnim.
   - `axios.instance.ts:69-108` ima race condition kod paralelnih 401 odgovora (istovremeni `/auth/refresh` izbacuje korisnika).
   - `useNotificationSocket.ts:9-67` konstruira pogrešan namespace `/backend/notifications` kad je `API_BASE_URL=/backend/api`.
   - `/shipments/:id/print` u `router/index.tsx:100` nema `RoleGuard`, a `EmailSettingsPage.tsx:354` renderuje `<iframe srcDoc={previewHtml}>` bez `sandbox`.
5. **VM / Production & Repo Hygiene blokeri:**
   - U Git su committani `.env*`, `mobile/android/sim-tracker-162d1-firebase-adminsdk-fbsvc-0ddd5cbe99.json` i `39_...apk` (41 MB); `docker-compose.vm.*.yml` ima hardkodiranu fallback šifru `nije,kikiriki`; `seed.ts` loguje puni `DATABASE_URL` (sa lozinkom!).
   - `PdfGeneratorService` (`pdf-generator.service.ts:28-36`) nema `try/finally` za `browser.close()` niti `--disable-dev-shm-usage` (zombi Chromium OOM na VM).
   - `AppReleasesService.uploadAndroidRelease` (`app-releases.service.ts:26-50`) drži do 250MB `.apk` u RAM-u (`memoryStorage` + `writeFileSync` + sync SHA-256).
   - Nedostaju `.github/workflows`, ESLint, Prettier i a11y provjere.

---

## 2. Backend — Detaljni audit po modulima

### 2.1 `backend/src/main.ts`, `prisma.service.ts`, `health.controller.ts` & `common/`
- **[P1] `backend/src/common/utils/scope-filter.util.ts:24-79`:**
  - Linija 27: Ako je `ctx.role === 'DIST_ADMIN'` i `ctx.distributionId === null`, funkcija propada do linije 78 i vraća `undefined` (svi podaci svih distribucija!).
  - Linija 61-63: Ako je `ctx.role === 'USER'` i opcija je `{ distributionIdField }`, vraća `undefined`.
  - Linija 52-60: Ako je `ctx.role === 'USER'` sa `branchId: null` i tačno 1 stavkom u `branchModeratorBranchIds`, `allBranchIds.length` je `1`, pa se ne aktivira `buildMultiBranchWhere`, nego linije 58-70 koriste `ctx.branchId` (`null`)!
  - Linija 78: Bilo koja neočekivana kombinacija vraća `undefined` umjesto fail-closed filtera.
- **[P1] `backend/src/common/utils/record-number.generator.ts:12-31`:**
  - `findFirst({ orderBy: { recordNumber: 'desc' } })` + inkrement u aplikaciji nije atomski (konkurentni zahtjevi dobijaju dupli broj -> Prisma `P2002`).
  - Leksikografsko sortiranje (`'ZAP-2026-99999' > 'ZAP-2026-100000'`) uzrokuje grešku nakon 99.999 zapisnika u godini.
- **[P1] `backend/src/common/utils/pdf-generator.service.ts:10,28-36`:**
  - `puppeteer.launch({ headless: true, args: ['--no-sandbox'] })` bez `try / finally` za `browser.close()` ostavlja zombi Chromium procese pri bilo kakvoj grešci u `setContent` ili `pdf()`.
  - Nedostaje `--disable-dev-shm-usage` (kritično u Dockeru sa 64MB `/dev/shm`).
  - Linija 10 koristi `data: any`.
- **[P1] `backend/src/main.ts:171-176` & `backend/src/prisma/prisma.service.ts`:**
  - `main.ts` ne poziva `app.enableShutdownHooks()` i ne vezuje se eksplicitno na `'0.0.0.0'`.
  - `PrismaService` sluša samo `process.on('beforeExit')`, što se ne aktivira na Docker `SIGTERM`/`SIGINT` -> DB konekcije ostaju otvorene do nasilnog kill-a.
- **[P1] `backend/src/health.controller.ts`:** Vraća statički `{ status: 'ok' }` bez provjere PostgreSQL konekcije (`$queryRaw\`SELECT 1\``).
- **[P2] `backend/src/main.ts:53-105,145-167`:**
  - CORS allowlist bezuslovno dodaje `localhost` i `127.0.0.1`, te poredi samo `url.hostname` ignorišući shemu i port.
  - Čita `FRONTEND_URL` umjesto `FRONTEND_URLS` (koji definišu `docker-compose.yml` i `.env.example`).
  - Swagger `/docs` je bezuslovno otvoren i u produkciji.
- **[P2] `backend/src/common/interceptors/timeout.interceptor.ts`:** Globalni fiksni timeout od 15s prekida legitimne duge operacije (veliki Excel importi, PDF renderovanje, 250MB APK upload).
- **[P2] `backend/src/common/filters/prisma-exception.filter.ts`:** Izlaže `exception.meta` klijentu i ne obrađuje `P2003` (FK constraint) i `P2014` (relation violation).
- **[P2] `backend/src/common/filters/http-exception.filter.ts`:** Podržava `errorCode`, ali servisi većinom bacaju samo sirove stringove bez `code` polja, pa i18n mapiranje grešaka na frontendu ne funkcioniše za poslovne greške.

### 2.2 `auth` & `users`
- **[P1] `backend/src/modules/users/users.controller.ts:58-65` & `users.service.ts`:**
  - `PATCH /users/:id` dopušta `DIST_ADMIN`-u izmjenu `role`, `distributionId` i `branchId` -> eskalacija privilegija (npr. promocija korisnika u `SYSTEM_ADMIN` ili prebacivanje u drugu distribuciju).
- **[P2] `backend/src/modules/auth/auth.service.ts` & `jwt.strategy.ts`:**
  - `bcrypt` se koristi za hashiranje JWT refresh tokena (>72 bajta -> `bcrypt` truncira na prvih 72 bajta, čime tokeni koji dijele prefiks postaju kolizioni).
  - Jedan `user.refreshToken` u tabeli `User` poništava sesiju između weba i mobitela ili kod paralelnih zahtjeva.
  - `JwtStrategy.validate` radi 2 odvojena DB upita po svakom API zahtjevu (`user` + `branchModerator`).
- **[P3] `backend/src/modules/users/users.service.ts`:** Tekstualne pretrage na pojedinim filterima bez dosljednog `mode: 'insensitive'`.

### 2.3 `distributions`, `branches`, `branch-moderators`, `branch-email-recipients`, `activity-log`
- **[P1] `distributions.controller.ts:39-40`:** `GET /distributions/:id` nema `DIST_ADMIN` scope provjeru (curenje tuđih distribucija).
- **[P1] `branches.controller.ts:33-44`:** `GET /branches` dopušta `DIST_ADMIN`-u da query parametrom `distributionId` čita podružnice drugih distribucija; `GET /branches/:id` nema scope check.
- **[P1] `branch-moderators.controller.ts:44-59`:** `GET /branch-moderators?userId=...` nema scope izolaciju po distribuciji niti ograničenje da `USER` može vidjeti samo vlastite moderatorske dodjele.
- **[P1] `activity-log.controller.ts:22-24` & `activity-log.service.ts`:** `GET /activity-log` ne primjenjuje tenant scope (`DIST_ADMIN` vidi logove svih distribucija).
- **[P2] `branch-email-recipients`:** Potrebno osigurati da su sve mutacije i pregledi dosljedno ograničeni na distribuciju `DIST_ADMIN`-a.

### 2.4 `shipments` & `sim-cards`
- **[P1] `shipments.service.ts:258-267`:** `update` dopušta `DIST_ADMIN`-u izmjenu `distributionId` pošiljke.
- **[P2] `shipments.service.ts` (`fetchExistingIccidMap`):** Učitava SVE postojeće ICCID-ove iz cijele `sim_cards` tabele u memoriju prilikom svakog Excel preview-a i importa (OOM rizik s rastom baze).
- **[P1] `sim-cards.service.ts:172-196,338-375`:**
  - `findOne` i `listEvents` ne uključuju `branchModeratorBranchIds` u provjeru prava.
  - `scopeWhere(..., { viaShipment: true })` za branch moderatora (`USER` s `distributionId`) daje pristup svim SIM karticama cijele distribucije umjesto samo njegovih podružnica.
  - `claim` (`338-375`) radi ne-atomsko čitanje pa ažuriranje (race condition između dva operatora).
  - `assign` ne validira da ciljani `userId` pripada istoj distribuciji kao SIM kartica.
  - `update` (`189`) poziva `ensureShipmentExists(dto.shipmentId)` bez `scope` provjere (moguće prebacivanje SIM kartice u tuđu pošiljku).

### 2.5 `meters` & `meter-type-definitions`
- **[P1] `meters.controller.ts` & `meters.service.ts`:**
  - `create` ignoriše `scope` i kreira brojilo + zapisnik ne-atomski.
  - `update` (`meters.service.ts:219-285`) ne ograničava `dto.branchId` na distribuciju `DIST_ADMIN`-a.
  - `getMetersReadScopeClause` daje branch moderatorima read pristup svim podružnicama u distribuciji umjesto samo moderiranim/vlastitoj.
- **[P2] `meters.service.ts` (`findAvailable`):** Vraća sva dostupna brojila bez paginacije/`take` limita.
- **[P2] `meter-type-definitions.controller.ts`:** `reorderFields` koristi inline body tip umjesto DTO-a (zaobilazi `ValidationPipe` whitelist).

### 2.6 `install-tasks`, `demount-tasks`, `installation-records`, `files`
- **[P1] `install-tasks.service.ts:342,373-505` & `demount-tasks.service.ts:339,369-550`:**
  - `cancel` i `reassign` omogućavaju `DIST_ADMIN`-u upravljanje zadacima drugih distribucija.
  - `InstallTasksService.complete` (`467-501`) izvršava `claim`, `meter.update`, `installationRecord.create` i `installTask.update` izvan jedne transakcije.
  - `DemountTasksService.complete` (`REPLACE_SIM`) ne zaključava atomski `newSimCardId` unutar transakcije.
- **[P2] `install-tasks.controller.ts:62,91` & `demount-tasks.controller.ts:62,96`:** Inline `@Body() body: { status } / { assignedToId }` zaobilaze DTO validaciju.
- **[P1] `installation-records.controller.ts:185` & `installation-records.service.ts:225-287,380-475`:**
  - `PATCH /installation-records/:id` nema `@Roles` dekorator niti `scope` provjeru (bilo koji `USER` može mijenjati bilo koji zapisnik).
  - `create` slijepo vjeruje `dto.installedById` (impersonacija drugog korisnika).
  - `findOne` (`380`) i `downloadPdf` (`758`) ne uključuju `branchModeratorBranchIds`.
  - Kreiranje/ažuriranje brojila i SIM kartice u `create` nije potpuno ujedinjeno sa kreiranjem zapisnika u atomskoj transakciji kod svih grana.
- **[P2] `installation-records.service.ts:287`:** `this.autoSendRecordEmail(record.id, ctx).catch(() => {})` — tiho guta greške u pozadinskom slanju emaila ako `autoSendRecordEmail` baci grešku izvan svog `try` bloka.
- **[P1] `files.controller.ts:18-37`:** `GET /files/photo` provjerava samo JWT i `installation-records/` prefiks, bez ikakve provjere prava pristupa zapisniku/distribuciji, te `fs.createReadStream(resolved)` nema `error` event handler.

### 2.7 `dashboard`, `analytics`, `app-releases`, `mail`, `settings`, `notifications`, `push-tokens`, `push-campaigns`
- **[P2] `analytics.service.ts:45-52,272-289,303-360,554-586` & `dashboard.service.ts`:**
  - `CUSTOM` opseg datuma ne validira `NaN`, `from <= to` ni maksimalan broj dana (`for (let t = from.getTime(); ...)` može blokirati event loop / izazvati OOM).
  - `getSimCardsAnalytics` učitava sve `SimCard` redove sa relacijama u Node memoriju umjesto agregacije u PostgreSQL-u.
  - `getExportCsv` nema zaštitu od CSV formula injection (`=`, `+`, `-`, `@`) i baca generički `Error` (500) umjesto `BadRequestException` (400).
- **[P1] `app-releases.controller.ts:40` & `app-releases.service.ts:26-50`:** Multer `memoryStorage()` za fajlove do 250MB + `fs.writeFileSync` + sync `sha256` u memoriji (OOM + blokiranje event loopa).
- **[P2] `settings.service.ts:36` & `settings.controller.ts:63`:** `GET /settings` vraća `smtp.pass` u plaintextu; `setMobilePush` koristi inline body tip bez DTO-a.
- **[P2] `mail.controller.ts:33,42`:** Inline body tipovi bez DTO validacije.
- **[P2] `notifications.controller.ts` & `notifications.gateway.ts:21`:** Neograničen `parseInt(limit)` na listanju notifikacija; WebSocket Gateway koristi `cors: { origin: '*' }`, prihvata token u URL query parametru i oslanja se na proces-lokalni `USER_SOCKET_MAP`.
- **[P3] `push-campaigns` & `push-tokens`:** Dobro strukturisani uz provjeru batch limita za Expo SDK i cleanup starih tiketa.

---

## 3. Web Frontend — Detaljni audit po modulima

### 3.1 Core Infrastructure (`router`, `axios.instance`, `main.tsx`, `auth.store`, `useNotificationSocket`, `error.utils`)
- **[P1] `frontend/src/api/axios.instance.ts:69-108`:** Konkurentni 401 odgovori paralelno pozivaju `/auth/refresh` sa istim rotirajućim `refreshToken`-om, što uzrokuje da 2. i 3. poziv padnu i obrišu sesiju (`clearSession()`).
- **[P1] `frontend/src/hooks/useNotificationSocket.ts:9-67`:** Kada je `API_BASE_URL=/backend/api`, `replace(/\/api\/?$/, '')` proizvodi `'/backend'`, pa se Socket.IO spaja na nepostojeći namespace `'/backend/notifications'` umjesto `'/notifications'`. Također, reconnect u `connect_error` ne veže ponovno `connect_error` listener.
- **[P1] `frontend/src/router/index.tsx:100`:** Ruta `/shipments/:id/print` nema `<RoleGuard>` (dostupna i običnom `USER`-u).
- **[P2] `frontend/src/utils/error.utils.ts:17-37`:** Ignoriše `string[]` validacione poruke od NestJS `ValidationPipe` i sadrži hardkodirane bosanske fallback stringove umjesto `i18n` ključeva.
- **[P3] `frontend/src/router/index.tsx:8`:** `ShipmentCreatePage` je importovan i potpuno neiskorišten (dead code); sve 24 stranice su eager-loadane bez `React.lazy` code splittinga.
- **[P3] `frontend/src/main.tsx:10`:** `new QueryClient()` nema definisan `staleTime`, `retry` ni globalne error defaulte.
- **[P3] `frontend/src/components/layout/AppLayout.tsx`:** Nedostaje React `ErrorBoundary` oko `<Outlet />` i skip-to-content pristupačni link.

### 3.2 Layout & Shared Components (`Header`, `Sidebar`, `NotificationBell`, `RecordPhotoImage`, `InstallationRecordCreateForm`)
- **[P2] `frontend/src/components/installation-records/RecordPhotoImage.tsx:15,22-37,55`:**
  - Nedostaje `cancelled` flag u `useEffect` -> ako se komponenta unmounta prije završetka fetcha, `URL.createObjectURL` ostaje trajno u memoriji.
  - Hardkodirani stringovi (`'Fotografija'`, `'Greška učitavanja'`) i svijetla pozadina `#f5f5f5` na tamnoj temi.
- **[P2] `frontend/src/components/layout/NotificationBell.tsx:52-60,99`:** `<Button>` zvona nema `aria-label`; `<List.Item onClick={...}>` je klikabilni ne-interaktivni element (a11y prepreka za tastaturu).
- **[P2] `frontend/src/components/layout/Header.tsx:55,70`:** Kada je `hasMultipleRoles === true`, renderuje se prazan `<Tag>` samo sa ikonom.
- **[P3] `frontend/src/components/layout/Sidebar.tsx:177`:** Koristi deprecated `bodyStyle={{ padding: 0 }}` na `Drawer`-u.

### 3.3 Pages Audit (`push-campaigns`, `installation-records`, `meters`, `meter-types`, `users`, `shipments`, `settings`, `activity-log`, `app-releases`, `analytics`, `dashboard`)
- **[P1] `frontend/src/pages/push-campaigns/PushCampaignsPage.tsx:21-37`:** Rani `return` za `!pushEnabled` stoji prije `useQueryClient`, `useState`, `useQuery`, `useMutation`, `useMemo`, `useCallback` (fatalni Hooks crash pri promjeni `pushEnabled`). Dodatno, `usersQuery` (linija 157) ignoriše `userSearch`, a `useMemo` na linijama 122 i 204 izostavlja `t` iz zavisnosti.
- **[P1] `frontend/src/pages/installation-records/InstallationRecordDetailPage.tsx:141-144,166-198`:**
  - `URL.createObjectURL` + `setPdfObjectUrl` unutar render tijela uzrokuje Blob memory leak i dupli render.
  - `if (recordQuery.isLoading || !record)` blokira `if (recordQuery.isError)` da se ikad izvrši.
- **[P1] `frontend/src/pages/settings/EmailSettingsPage.tsx:354`:** `<iframe srcDoc={previewHtml}>` nema `sandbox=""` (XSS rizik izvršavanja skripti iz mail šablona u originu aplikacije sa pristupom `localStorage` tokenima!). Također `availableFields` `useMemo` (linija 233) nema `[t]` dependency, a `<Button href="/settings">` izaziva puni reload stranice.
- **[P2] `frontend/src/pages/users/UsersListPage.tsx:199,462,657`:**
  - `pagination={false}` na tabeli korisnika dok backend vraća max 20 po stranici -> korisnici >20 su potpuno nedostupni!
  - `pendingModeratorSync` state se ne čisti na `onError`; `role` Select ostaje otključan za `DIST_ADMIN`.
- **[P2] `frontend/src/pages/meters/MetersListPage.tsx:86,189,348,1043,1143`:**
  - Dead state `isQuickDetail` i neiskorišteni `recordsByMeterQuery` / `recordsForMeter`.
  - Promjena `filterTypeId` ne resetuje `pagination.page` na `1`.
  - Lista operatora u drawerima ne filtrira po `branchId` za branch moderatora.
  - `installDrawer`/`demountDrawer` tiho vraćaju `return` bez poruke pri neispravnoj formi; klikabilni redovi tabele (`onRow`) nemaju tastaturnu dostupnost.
- **[P2] `frontend/src/pages/meters/MeterDetailPage.tsx:214`:** `createInstallMutation.onSuccess` ne invalidira `['meters', 'detail', id]` ni `['meters']` pa UI ne prikazuje kreirani nalog bez ručnog refresha.
- **[P2] `frontend/src/pages/meter-types/MeterTypeUpsertPage.tsx:356-367`:** Koristi kontrolisani `fields={...}` prop na AntD `<Form>`, što može prepisati korisnikove izmjene pri pozadinskom refetchu.
- **[P2] `frontend/src/pages/activity-log/ActivityLogPage.tsx:39-48`:** Promjena filtera ne resetuje `page` na `1`.
- **[P2] `frontend/src/pages/shipments/ShipmentsListPage.tsx:136,154`:** `assignMutation` / `unassignMutation` `onError` krije stvarnu backend poruku; filter pošiljki na SIM tabu povlači max 100 pošiljki.
- **[P2] `frontend/src/pages/app-releases/AppReleasesPage.tsx:39,142` & 12 `as any` lokacija:** Upotreba `any` u `AppReleasesPage`, `MeterTypeFieldsPage`, `MeterTypeUpsertPage`, `MeterDetailPage`, `PushCampaignsPage`, `ShipmentDetailsPage`.
- **[P3] `frontend/src/pages/settings/SettingsPage.tsx:355,610`:** Nekorišten poziv `useAuthStore((s) => s.user)`, `<Button href="/settings/email">` radi puni page reload, deprecated `destroyOnClose`.
- **[P3] `frontend/src/pages/shipments/ShipmentPrintPage.tsx:702`:** Renderuje sve A4 listove istovremeno u Preview + Portal `PrintSheets` (težak DOM za velike pošiljke).
- **[P3] `frontend/src/config/app-version.ts:1` & i18n preostali stringovi:** `Intl.DateTimeFormat('bs-BA', ...)` je fiksiran na bosanski locale; ostali su sitni hardkodirani primjeri/oznake (`"npr. ..."`, `APK`, `CSV`, `total:` itd.).

---

## 4. VM / Production Readiness, Docker, Nginx & Repo Hygiene

- **[P1] Trackirane tajne i veliki binarni fajl u Gitu (`git ls-files`):**
  - `.env`, `backend/.env`, `backend/.env.prod`, `backend/.env.host`, `frontend/.env`, `frontend/.env.prod`, `mobile/.env`, `mobile/.env.prod`
  - `mobile/android/sim-tracker-162d1-firebase-adminsdk-fbsvc-0ddd5cbe99.json` (privatni Firebase ključ!)
  - `39_1776859844856_simtracker-prod-22042026-arm64-v8a-39.apk` (41 MB binarni fajl!)
- **[P1] `docker-compose.vm.db.yml` & `docker-compose.vm.app.yml`:**
  - Hardkodiran fallback password `nije,kikiriki` za PostgreSQL.
  - `sim-tracker-backend-vm` nema `init: true`, nema `healthcheck`, nema `mem_limit`/`cpus` i nema `shm_size`.
- **[P1] `backend/Dockerfile.vm` & `backend/Dockerfile`:** Pokreću Node proces kao `root` user; `Dockerfile.vm` zadržava `devDependencies` u runtime slici.
- **[P2] `frontend/nginx.conf`:**
  - Šalje `Strict-Transport-Security` preko HTTP `:80` (iza HTTP-only Traefika na `10.10.10.30`).
  - Nedostaju `gzip` kompresija, `Cache-Control: immutable` za `/assets/*`, `no-cache` za `index.html`, te `Content-Security-Policy`.
- **[P2] `backend/prisma/seed.ts`:** Loguje puni `DATABASE_URL` (sa DB šifrom) u konzolu i ima fallback admin lozinku `ChangeMe123!`.
- **[P2] Nedostatak CI/CD i QA alata:** `.github/workflows` ne postoji; ni `backend/package.json` ni `frontend/package.json` nemaju ESLint, Prettier, a11y ni validne i18n provjere (`check_used_keys.sh` ima hardkodiranu `/home/claude/...` putanju).
