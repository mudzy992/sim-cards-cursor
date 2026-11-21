# Audit Run 7 — `dashboard` i `analytics`

**Obuhvaćeni moduli:** `dashboard` (`dashboard.controller.ts`, `dashboard.service.ts`), `analytics` (`analytics.controller.ts`, `analytics.service.ts`, `analytics.service.spec.ts`, `dto/analytics-query.dto.ts`), te pripadajući web/mobile klijenti (`frontend/src/api/dashboard.api.ts`, `frontend/src/api/analytics.api.ts`, `frontend/src/pages/dashboard/DashboardPage.tsx`, `frontend/src/pages/analytics/AnalyticsPage.tsx`, `mobile/src/api/dashboard.api.ts`).  
**Datum audita:** 2026-11-21 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** **Paketi A + B + C implementirani i verifikovani**.

---

## 1. Sažetak arhitekture i uloga

- **`dashboard`** pruža tri brza operativna pregleda (`/dashboard/stats`, `/dashboard/recent-records`, `/dashboard/records-chart`) za web i mobilnu početnu stranicu svih uloga (`SYSTEM_ADMIN`, `DIST_ADMIN`, `USER`).
- **`analytics`** pruža vremenski filtrirane KPI-jeve (`/analytics/overview`, `/analytics/installation-records`, `/analytics/sim-cards`, `/analytics/users`) i CSV eksporte (`/analytics/exports/:report.csv`) za `TODAY`, `7_DAYS`, `30_DAYS`, `MONTH`, `YEAR`, i `CUSTOM` (max 366 dana).

---

## 2. Nalazi kroz prizmu 4 persone

| # | Prioritet | Modul / Sloj | Nalaz | Pogođene uloge |
|---|---|---|---|---|
| 1 | **P0** | `dashboard`, `analytics`, `JwtStrategy` | **Cross-branch curenje SIM statistike i imena operatera za `USER`:** `JwtStrategy` svakom `USER`-u (uključujući običnog terenskog montera) upisuje `distributionId` njegove podružnice. Zbog toga `scopeWhere(scope, { viaShipment: true })` u `DashboardService.getStats`, `AnalyticsService.getOverview` i `AnalyticsService.getSimCardsAnalytics` vraća `{ shipment: { distributionId } }` — pa običan monter vidi SIM kartice **cijele distribucije**, sve podružnice (`byBranch`) i učinak/imena **svih drugih operatera u distribuciji** (`byOperator`). | Terenski monter (`USER`), `BRANCH_MODERATOR` |
| 2 | **P0** | `analytics` (`users`, `exports/users.csv`) + Web | **PII curenje korisničkih emailova i aktivnosti običnim monterima:** `GET /analytics/users` i `GET /analytics/exports/users.csv` dostupni su za `UserRole.USER` bez dodatne provjere uloge/moderatora. Osim toga, `user.findMany({ where: { id: { in: userIds } } })` ne filtrira korisnike po scope-u pa uključuje i `approvedBy` admine iz drugih organizacionih jedinica. | Terenski monter (`USER`) |
| 3 | **P0** | `dashboard` (`DashboardController`, `DashboardService`) | **Nedostaje DTO validacija za `limit` i `days` (NaN -> `500`, DoS petlja):** Query parametri `limit` i `days` parsiraju se ručno (`parseInt(days, 10)`). `?days=abc` daje `NaN` -> `Invalid Date` -> `500`; `?days=1000000` pokreće petlju od milion iteracija i vuče sve redove; `?limit=100000` nema gornji cap. | Sve uloge (stabilnost / sigurnost) |
| 4 | **P1** | `analytics` (`getSimCardsAnalytics`, `getUsersAnalytics`, `getInstallationRecordsAnalytics`) & `dashboard` (`getRecordsChart`) | **Učitavanje velikih tabela u JS memoriju umjesto DB agregacije:** `getSimCardsAnalytics` radi neograničen `simCard.findMany` s 5 relacija; `getUsersAnalytics` vuče sve zapisnike umjesto `groupBy(['installedById'])` i `groupBy(['approvedById'])`; `getRecordsChart` i `getInstallationRecordsAnalytics` vuku sve `createdAt` redove u memoriju umjesto SQL `DATE_TRUNC`/grupisane agregacije (ili ograničenog čitanja). | `SYSTEM_ADMIN`, `DIST_ADMIN` (performanse na velikim tenantima) |
| 5 | **P1** | `analytics`, `dashboard` | **UTC vs lokalna vremenska zona i DST drift u timeline grafovima:** `startDate.setHours(0, 0, 0, 0)` koristi lokalnu zonu (npr. UTC+1), dok se ključ mape računa preko `.toISOString().slice(0, 10)` (UTC), što u ponoć pomjera bucket za 1 dan; petlja `t += dayMs` u `getInstallationRecordsAnalytics` može preskočiti/duplirati dan kod DST prelaza. | Sve uloge |
| 6 | **P2** | `analytics` (`getExportCsv`) | **CSV UTF-8 BOM i konzistentno escapovanje:** `users.csv` bez UTF-8 BOM (`\uFEFF`) pogrešno prikazuje dijakritike (`č, ć, đ, š, ž`) u Excelu; `overview`, `sim-cards` i `installation-records` CSV exporti ne prolaze kroz `escapeCsvCell`. | `SYSTEM_ADMIN`, `DIST_ADMIN`, `BRANCH_MODERATOR` |
| 7 | **P2** | `dashboard`, `analytics` | **Proširiti unit testove:** `dashboard.service.spec.ts` ne postoji, a `analytics.service.spec.ts` ima samo 1 test (`getOverview` s `scope = null`), bez testova za `USER`/`BRANCH_MODERATOR`/`DIST_ADMIN` izolaciju, `CUSTOM` validaciju, CSV formula injection i `getUsersAnalytics`. | Razvoj / regresije |

---

## 3. Prijedlog izmjena po paketima

### Paket A — Sigurnost, Scope izolacija i Validacija ulaza (P0)
1. **Pravi branch/user scope za SIM kartice u `DashboardService` i `AnalyticsService`:**
   - Za `SYSTEM_ADMIN` -> bez filtera.
   - Za `DIST_ADMIN` -> `shipment: { distributionId }` (fail-closed ako nema `distributionId`).
   - Za `USER` (terenski monter ili `BRANCH_MODERATOR`):
     - Ako ima `branchModeratorBranchIds.length > 0` (`BRANCH_MODERATOR`): SIM kartice ograničene na njegove podružnice (`OR: [{ meter: { branchId: { in: allBranchIds } } }, { assignedTo: { branchId: { in: allBranchIds } } }]`), bez uvida u tuđe podružnice i cijelu distribuciju!
     - Ako je obični terenski monter (`USER` bez `branchModeratorBranchIds`): SIM kartice ograničene na vlastite dodijeljene kartice (`assignedToId: user.id` kad imamo `userId` u `ScopeContext`, ili `meter: { branchId }` za instalirane — svakako NE cijela distribucija!). Proširiti `ScopeContext` s `userId?: string` u `toScopeContext`.
2. **Pristup `users` analitici i `users.csv` (P0-2):**
   - U `AnalyticsController` / `AnalyticsService`: `getUsersAnalytics` i `exports/users.csv` dozvoliti samo za `SYSTEM_ADMIN`, `DIST_ADMIN`, i `BRANCH_MODERATOR` (tj. odbiti običnog `USER`-a koji nije moderator sa `ForbiddenException`), te u `getUsersAnalytics` primijeniti `scopeWhere(scope, { userScope: true })` na `prisma.user.findMany` kako se ne bi prikazivali nescope-ovani korisnici iz drugih organizacija.
   - Na `frontend/src/pages/analytics/AnalyticsPage.tsx`: za običnog `USER`-a (koji nije `SYSTEM_ADMIN`, `DIST_ADMIN` ni `BRANCH_MODERATOR`) ne pozivati `analyticsApi.getUsers` i sakriti sekciju aktivnosti korisnika te tabele po distribucijama/operaterima (ili prikazati samo vlastite/podružnične sekcije).
3. **`DashboardQueryDto` s `class-validator` (P0-3):**
   - `GetRecentRecordsQueryDto`: `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10`.
   - `GetRecordsChartQueryDto`: `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days = 30`.

### Paket B — Performanse i DB agregacije (P1)
4. **`AnalyticsService.getUsersAnalytics`:** Zamijeniti puni `installationRecord.findMany` sa dva paralelna `prisma.installationRecord.groupBy` poziva (`by: ['installedById']` i `by: ['approvedById']`).
5. **`AnalyticsService.getSimCardsAnalytics`:** Umjesto neograničenog `simCard.findMany` sa 5 relacija, agregirati:
   - `byStatus`: već postoji `simCard.groupBy({ by: ['status'] })`.
   - `byOperator`: `simCard.groupBy({ by: ['assignedToId', 'status'], where: { ...where, assignedToId: { not: null } }, _count: { id: true } })` + jedan `user.findMany` samo za prisutne operatere.
   - `byBranch`: `simCard.groupBy({ by: ['meterId'], ... })` ili `meter.findMany` za `INSTALLED` kartice / grupisanje po `branchId` preko `prisma.$queryRaw` ili minimalnog `select` upita sa `branchId` i `shipment.distributionId` bez nepotrebnih user/meter detalja (ili `groupBy` po `shipmentId` + lookup pošiljki za `byDistribution`).
6. **`DashboardService.getRecordsChart` & `AnalyticsService.getInstallationRecordsAnalytics`:**
   - Uskladiti UTC datumsku aritmetiku (`Date.UTC(...)` od početnog do krajnjeg dana) tako da se izbjegnu pomaci oko ponoći i DST greške.
   - Koristiti `groupBy` / `SELECT DATE_TRUNC('day', "createdAt") ...` ili minimalni agregat umjesto učitavanja čitave tabele u memoriju (uz siguran fallback za mockove ako je potrebno, ili čisto testirani Prisma upit).
   - Ograničiti `collectActivationSamples` (npr. `take: 5000`, `orderBy: { createdAt: 'desc' }`) radi zaštite memorije na višemilionskim skupovima.

### Paket C — CSV polish & Unit testovi (P2)
7. **`AnalyticsService.getExportCsv`:** Dodati UTF-8 BOM (`\uFEFF`) za Excel kompatibilnost i provući sve CSV ćelije kroz `escapeCsvCell`.
8. **Unit testovi:**
   - Kreirati `backend/src/modules/dashboard/dashboard.service.spec.ts` (testovi za `getStats` po ulogama `SYSTEM_ADMIN`/`DIST_ADMIN`/`USER`/`BRANCH_MODERATOR`, `getRecentRecords` i `getRecordsChart` granice i UTC bucketing).
   - Proširiti `backend/src/modules/analytics/analytics.service.spec.ts` (testovi za `USER` vs `BRANCH_MODERATOR` vs `DIST_ADMIN` scope izolaciju, `ForbiddenException` na `users` za običnog `USER`-a, `CUSTOM` range validacija, `getUsersAnalytics` `groupBy`, CSV formula escaping + BOM).

---

## 4. Sažetak implementacije (Paketi A + B + C)

- **Scope izolacija i validacija (`scope-filter.util.ts`, `dashboard`, `analytics`):**
  - Dodan `userId?: string` u `ScopeContext` i `toScopeContext()`, te `simCardScopeWhere()` i `isScopedAdminOrModerator()`.
  - Običan terenski monter (`USER`) sada u `DashboardService.getStats`, `AnalyticsService.getOverview` i `AnalyticsService.getSimCardsAnalytics` vidi isključivo svoje SIM kartice (`assignedToId`), `BRANCH_MODERATOR` vidi SIM kartice svojih podružnica, a `DIST_ADMIN` SIM kartice svoje distribucije.
  - `GET /analytics/users` i `GET /analytics/exports/users.csv` (kao i servisne metode) odbijaju običnog `USER`-a s `ForbiddenException`, a upit nad `User` tabelom dodatno primjenjuje `scopeWhere(..., { userScope: true })`.
  - Kreiran `DashboardQueryDto` (`GetRecentRecordsQueryDto` `limit` 1–50, `GetRecordsChartQueryDto` `days` 1–365) uz servisni clamp.
- **Performanse i UTC aritmetika (`dashboard`, `analytics`):**
  - `AnalyticsService.getSimCardsAnalytics` prepisan na 4 paralelna `groupBy` upita (`status`, `shipmentId`, `meter.branchId`, `assignedToId + status`) + lookup-e po ID-evima.
  - `AnalyticsService.getUsersAnalytics` koristi dva paralelna `installationRecord.groupBy` upita (`installedById`, `approvedById`).
  - `DashboardService.getRecordsChart` i `AnalyticsService.getInstallationRecordsAnalytics` koriste UTC datumsku aritmetiku (`Date.UTC` / `86_400_000`) i batchirano čitanje s cursor paginacijom (`5000` po batchu, max `50_000`), a `collectActivationSamples` ograničen na `5000` najnovijih zapisa.
- **CSV & Frontend (`analytics.service.ts`, `AnalyticsPage.tsx`):**
  - Svi CSV exporti dodaju UTF-8 BOM (`\uFEFF`), `X-Content-Type-Options: nosniff`, i koriste `escapeCsvCell`.
  - `AnalyticsPage.tsx` gasi `analytics-users` upit i sakriva sekciju aktivnosti korisnika za običnog `USER`-a.
- **Verifikacija:**
  - `backend`: `nest build`, `eslint`, `jest` (**21/21 suites, 111/111 tests** uključujući `dashboard.service.spec.ts` i prošireni `analytics.service.spec.ts`).
  - `frontend`: `tsc --noEmit`, `eslint`, `check:i18n` (**1067 ključeva**), `check:ui` (**141 fajl**), `vitest` (**9/9 suites, 30/30 tests**), `vite build`.
  - `mobile`: `tsc --noEmit`, `eslint`, `jest` (**2/2 suites, 8/8 tests**).
