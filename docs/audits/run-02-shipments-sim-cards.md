# Audit Run 2 — Isporuke i SIM kartice (`shipments` + `sim-cards`)

**Obuhvaćeni moduli:** `shipments` (`shipments.service.ts`, `shipments.controller.ts`, `excel-import.service.ts`, `column-mapper.service.ts`), `sim-cards` (`sim-cards.service.ts`, `sim-cards.controller.ts`), web stranice (`shipments/*`, `sim-cards/*`), mobilni ekrani i API (`scan`, `scan-result`, `offline-inventory`, `sim-cards.api.ts`, `sim-inventory-reconcile.ts`).  
**Datum audita:** 2026-11-21 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** Audit završen i **Paketi A + B + C implementirani i verificirani**.

---

## Implementacija (Paketi A + B + C)
- **Prisma & DB (`backend/prisma/schema.prisma`, `backend/prisma/migrations/20261121000000_add_sim_card_indexes/migration.sql`):** Dodati idempotentni indeksi na `sim_cards` (`public_ip_address`, `phone_number`, `shipment_id`, `assigned_to_id`).
- **Backend `shipments` & `excel-import`:** Prazan `selectedRowNumbers = []` se sada odbija umjesto importa svih redova; masovni Excel import upisuje početne `SimEvent('IMPORTED')` zapise u chunkovima; `ShipmentsService.findAll` koristi `mode: 'insensitive'`; `ShipmentsService.update` validira `distributionId` i blokira promjenu distribucije ako isporuka već ima dodijeljene/ugrađene SIM kartice.
- **Backend `sim-cards`:** `findOne` i `listEvents` za `BranchModerator` koriste strogi opseg moderiranih poslovnica (`meter.branchId` + vlastite kartice) preko `toScopeContext`; `update` normalizuje polja, provjerava duplikate (`iccid`, `ipAddress`, `publicIpAddress`, `phoneNumber`), štiti `INSTALLED` kartice vezane za brojilo i sinhronizuje `Shipment.totalCards` (kao i `create`/`remove`); `scanByIccid` normalizuje ICCID; dodani su `POST /sim-cards/scan-batch`, `POST /sim-cards/bulk-assign`, `POST /sim-cards/:id/return-to-stock`, `mode: 'insensitive'` pretrage, i `meter` u `simCardInclude()`.
- **Mobile (`mobile/src/api/sim-cards.api.ts`, `mobile/src/offline/sim-inventory-reconcile.ts`):** `myAssigned()` ispravno čita `PaginatedResult.items` (`limit: 100`), a `reconcileOfflineSimInventory` koristi jedan `POST /sim-cards/scan-batch` poziv umjesto do 80 sekvencijalnih zahtjeva.
- **Frontend (`ShipmentsListPage`, `ShipmentDetailsPage`, `SimCardDetailsPage`, `labels.utils`, `bs.ts`/`en.ts`):** Dodana masovna dodjela dostupnih SIM kartica, filter korisnika (`role: 'USER', limit: 100` + pretraga) u draweru za dodjelu, prikaz povezanog brojila i dugme "Vrati u dostupne" na detaljima SIM kartice, te potpuna lokalizacija statusa isporuka i novih SIM događaja.
- **Testovi i gate-ovi:** Backend Jest `14/14` (`66/66`), Mobile Jest `1/1` (`5/5`), Frontend Vitest `9/9` (`30/30`), `check:i18n` (`1061` ključeva), `check:wcag` (`72` para), `check:ui` (`141` fajl), svi `typecheck`/`lint`/`build` zadaci prošli.

---

## 1. Mapa funkcija po osobama (Role Matrix)

### 1.1 `shipments` (`backend/src/modules/shipments/*`, `frontend/src/pages/shipments/*`)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `GET /shipments` | Sve isporuke | Samo isporuke svoje `distributionId` | Ne (403) | Ne (403) | Vraća paginaciju + `cardStatusCounts` preko `SimCard.groupBy`. |
| `GET /shipments/:id` & `:id/sim-cards` | Sve | Samo vlastita distribucija | Ne (403) | Ne (403) | `:id/sim-cards` koristi `ShipmentSimCardsQueryDto` (`limit <= 250`) za `ShipmentPrintPage`. |
| `POST /shipments` | Za bilo koju distribuciju | Automatski vezano na svoju `distributionId` | Ne (403) | Ne (403) | Wizard korak 1 kreira isporuku, korak 2 uvozi SIM-ove. |
| `POST /shipments/:id/import` | Preview & Apply (do 25 MB) | Preview & Apply za svoju distribuciju | Ne (403) | Ne (403) | Throttle `10/600s`. Podržava `importAllValid`, 5k/2k chunking i 120s transakciju. |
| `PATCH /shipments/:id` | Sve | Samo vlastita (ne smije prebaciti u drugu distribuciju) | Ne (403) | Ne (403) | Ne provjerava postojanje nove `distributionId` kod `SYSTEM_ADMIN`-a. |
| `DELETE /shipments/:id` | Praznu ili sa ne-operativnim SIM-ovima | Samo praznu (`simCount === 0`) | Ne (403) | Ne (403) | Odbija ako ima `ASSIGNED`/`INSTALLED` SIM-ova, brojila ili zapisnika. |
| Web `ShipmentPrintPage` | Štampa naljepnica (A4 preseti) | Štampa za svoju distribuciju | Ne | Ne | Paginirano vuče po `20–250` SIM-ova sa progress barom. |

### 1.2 `sim-cards` (`backend/src/modules/sim-cards/*`, `frontend/src/pages/sim-cards/*`, mobile `scan`/`offline-inventory`)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `GET /sim-cards` & `/available` & `/stats` | Sve | Po svojoj distribuciji (`viaShipment`) | Ne (403) | Ne (403) | Na webu `ShipmentsListPage` ima tab "SIM kartice" sa status filterima. |
| `GET /sim-cards/moderated-installed` | Sve `INSTALLED` | Sve `INSTALLED` u svojoj distribuciji | `INSTALLED` na brojilima njegovih poslovnica | 403 (`BranchModeratorGuard`) | Koristi `ModeratedInstalledSimCardsPage`. |
| `GET /sim-cards/my-assigned` | Vlastite | Vlastite | Vlastite | Vlastite (`ASSIGNED`) | Vraća `PaginatedResult`, ali **mobile `simCardsApi.myAssigned()` očekuje niz** (P0-1)! |
| `GET /sim-cards/scan/:iccid` | Bilo koji ICCID | U svojoj distribuciji | U distribuciji / poslovnici | U distribuciji (`viaShipment`) | Backend ne normalizuje `iccid` u `scanByIccid`; mobile kešira u `offlineSimInventory`. |
| `GET /sim-cards/:id` & `/:id/events` | Da | U svojoj distribuciji | Pušta `BranchModeratorGuard`, ali **scope ne koristi `branchModeratorBranchIds`** (P0-2) | 403 (`BranchModeratorGuard`) | Prikazuje detalje i timeline u `SimCardDetailsPage`. |
| `POST /sim-cards` / `PATCH` / `DELETE` | Da | U svojoj distribuciji | Ne (403) | Ne (403) | `PATCH` zaobilazi duplikate, normalizaciju i guard za ugrađene kartice (P0-3). |
| `POST /sim-cards/:id/assign` / `unassign` | Da | U svojoj distribuciji | Ne (403) | Ne (403) | `assign` samo za `AVAILABLE`/`ASSIGNED`; `unassign` samo za `ASSIGNED`. |
| `POST /sim-cards/:id/claim` | Da | U svojoj distribuciji | Da | Da (atomic `updateMany` za `AVAILABLE`) | Offline mobile stavlja `SIM_CARD_CLAIM` u `Outbox` i lokalno mijenja status. |

---

## 2. End-to-End tokovi i životni ciklus SIM kartice

1. **Import isporuke (`ShipmentWizardPage` -> `ShipmentsService.importExcel`)**:
   - Korak 1: `POST /shipments` -> status `RECEIVED`.
   - Korak 2 (`applyImport=false`): parsiranje `.xlsx`/`.xls`/`.csv`, auto-mapiranje kolona (`ICCID`, `IP`, `Public_IP`, `Phone`, `APN`), batch provjera duplikata po 5.000 vrijednosti, povrat kompletnog preview izvještaja.
   - Korak 3 (`applyImport=true`): ponovna transakcijska provjera duplikata + `createMany` u chunkovima po 2.000, postavljanje statusa SIM-a na `AVAILABLE` i isporuke na `COMPLETED` + `totalCards`.
2. **Životni ciklus statusa SIM kartice (`SimCardStatus`)**:
   - `AVAILABLE` -> `ASSIGNED` (putem admin `assign` ili monterskog `claim`) -> `INSTALLED` (kroz zapisnik montaže ili `InstallTask`) -> `DEMOUNTED` / `DEFECTIVE` / `RETURNED` / `DEACTIVATED` (kroz `DemountTask`).
   - `ASSIGNED` -> `AVAILABLE` preko `unassign`.
   - Svi prelazi u `SimCardsService` upisuju `SimEvent` (`CREATED`, `ASSIGNED`, `CLAIMED`, `UNASSIGNED`, `STATUS_*`), dok masovni Excel import **ne upisuje** početni `SimEvent`.

---

## 3. Identifikovani problemi, bugovi i uska grla

### Kritično (P0 — Direktni bugovi i narušen integritet podataka)

1. **[P0-1] `mobile/src/api/sim-cards.api.ts:127-139` — `myAssigned()` uvijek vraća prazan niz `[]`**
   - **Gdje:** `mobile/src/api/sim-cards.api.ts:130-134`, `backend/src/modules/sim-cards/sim-cards.controller.ts:62-68`.
   - **Uzrok:** Backend `GET /sim-cards/my-assigned` vraća `PaginatedResult` (`{ items: [...], page, limit, total, totalPages }`), pa je `response.data.data` objekat s `items`. Mobilni klijent radi `Array.isArray(data) ? data : []`, što je uvijek `false` i pregazi lokalni cache praznim nizom!

2. **[P0-2] `SimCardsController.findOne` i `listEvents` imaju IDOR / scope bug za `BranchModerator`-e**
   - **Gdje:** `backend/src/modules/sim-cards/sim-cards.controller.ts:96-111`, `backend/src/modules/sim-cards/sim-cards.service.ts:255-271, 567-588`.
   - **Uzrok:** `BranchModeratorGuard` propušta `USER` ulogu koja ima `branchModeratorBranchIds`, ali controller metode `findOne` (`GET /sim-cards/:id`) i `listEvents` (`GET /sim-cards/:id/events`) ne prosljeđuju `branchModeratorBranchIds` u `scope`, a `SimCardsService` koristi `scopeWhere(scope, { viaShipment: true })`.
   - **Posljedica:** Budući da `JwtStrategy` za moderatora popunjava `distributionId` iz prve moderirane poslovnice, moderator jedne poslovnice preko `viaShipment` može čitati detalje i timeline **bilo koje SIM kartice u cijeloj distribuciji** (čak i onih na drugim poslovnicama ili još neugradjenih), umjesto da bude ograničen na svoje `branchModeratorBranchIds`!

3. **[P0-3] `SimCardsService.update` zaobilazi normalizaciju, duplikate i integritet s brojilom**
   - **Gdje:** `backend/src/modules/sim-cards/sim-cards.service.ts:273-307`.
   - **Uzrok:** Za razliku od `create`, `update` ne trimuje/normalizuje `iccid` i `phoneNumber`, ne provjerava koliziju `ipAddress` / `publicIpAddress` / `phoneNumber` (koje u bazi nisu `@unique`), dozvoljava promjenu `status`-a kartici koja je aktivno ugrađena u `Meter` (čime se razilaze `SimCard.status` i `Meter.simCardId`), i ako promijeni `shipmentId`, ne ažurira `Shipment.totalCards` na staroj i novoj isporuci!

4. **[P0-4] `ExcelImportService.toCreateManyData` i `Shipment.status` kod parcijalnog/praznog izbora**
   - **Gdje:** `backend/src/modules/shipments/import/excel-import.service.ts:340`, `backend/src/modules/shipments/shipments.service.ts:741-746`.
   - **Uzrok:**
     - Ako klijent pošalje `selectedRowNumbers = "[]"` (prazan niz) bez `importAllValid = 'true'`, `selectedRowNumbers.length > 0` je `false`, pa `selected` postaje `null` i **uvozi sve validne redove umjesto da odbije prazan izbor**!
     - `ShipmentsService.importExcel` uvijek postavlja `shipment.status = ShipmentStatus.COMPLETED` nakon bilo kojeg importa, čak i kad je od 1.000 redova uvezeno samo 10 (parcijalni import), dok `SimCardsService.create`/`remove` ne ažuriraju `Shipment.totalCards`.

### Visoki prioritet (P1 — Performanse, PostgreSQL indeksi i poslovni proces)

5. **[P1-1] Nedostajući PostgreSQL indeksi na `SimCard` (Full Table Scan na importu od 8.500+ redova i pregledima)**
   - **Gdje:** `backend/prisma/schema.prisma:194-217`.
   - **Uzrok:** `SimCard` ima indekse samo na `iccid`, `ipAddress`, `status`. Nedostaju indeksi na:
     - `shipmentId` (koriste ga `findShipmentSimCards`, `ShipmentsService.findAll` `groupBy`, `ShipmentsService.remove`),
     - `assignedToId` (koriste ga `myAssigned` i filteri po monteru),
     - `publicIpAddress` i `phoneNumber` (`fetchExistingSimFields` pri svakom importu od 8.500 redova radi `IN (...)` upit dvaput — van i unutar transakcije — što na velikoj bazi uzrokuje full table scan!).
   - Dodatno, `ipAddress`, `publicIpAddress` i `phoneNumber` nemaju DB `@unique` (niti partial unique index za non-null), pa paralelni pojedinačni `create`/`update` zahtjevi mogu stvoriti duplikate.

6. **[P1-2] PostgreSQL case-sensitive pretraga u `ShipmentsService.findAll` i `SimCardsService.findAll`**
   - **Gdje:** `shipments.service.ts:127-146`, `sim-cards.service.ts:62, 224`.
   - **Posljedica:** `{ contains: filter.search }` i `{ contains: filter.provider }` nemaju `mode: 'insensitive'`, pa pretraga `"bh telecom"` ne pronalazi `"BH Telecom"`.

7. **[P1-3] `reconcileOfflineSimInventory` pravi do 80 sekvencijalnih HTTP poziva u petlji**
   - **Gdje:** `mobile/src/offline/sim-inventory-reconcile.ts:24-40`.
   - **Posljedica:** Na mobilnom telefonu pri osvježavanju offline inventara šalje do 80 pojedinačnih `GET /sim-cards/scan/:iccid` zahtjeva jedan za drugim (20–40 sekundi na slaboj 4G vezi). Jedan batch endpoint (`POST /sim-cards/scan-batch`) sve rješava za <300 ms.

8. **[P1-4] Uska grla kod dodjele i pregleda SIM kartica na Webu**
   - **Gdje:** `frontend/src/pages/shipments/ShipmentsListPage.tsx:118`, `backend/src/modules/sim-cards/sim-cards.service.ts:346, 676-700`, `frontend/src/pages/sim-cards/SimCardDetailsPage.tsx`.
   - **Posljedica:**
     - `ShipmentsListPage` za dropdown dodjele SIM kartice zove `usersApi.list()` bez parametara -> dobija samo prvih 20 korisnika uključujući admine (`limit: 20`), umjesto `{ role: 'USER', limit: 100 }` + search!
     - Ne postoji **bulk dodjela (`POST /sim-cards/bulk-assign`)** niti **bulk promjena statusa**, pa za isporuku od 8.500 SIM kartica admin mora klikati karticu po karticu!
     - `SimCardsService.scanByIccid` ne normalizuje `:iccid` parametar na backendu (ako stigne sa razmacima/crticama, vraća 404).
     - `SimCardsService.simCardInclude()` ne uključuje `meter: { select: { id, serialNumber, status, branch } }`, pa `SimCardDetailsPage` ne prikazuje direktno u kojem je brojilu ugrađena kartica.

9. **[P1-5] Nedostaje početni `SimEvent('IMPORTED')` za masovno uvezene SIM kartice**
   - **Gdje:** `backend/src/modules/shipments/shipments.service.ts:725-734`.
   - **Posljedica:** Za razliku od pojedinačnog `SimCardsService.create` koji kreira `SimEvent('CREATED')`, Excel import u `SimCardDetailsPage` ostavlja prazan timeline sve do prvog dodjeljivanja.

### Srednji prioritet (P2 — UX & robusnost poslovne logike)

10. **[P2-1] `SimCardsService.assign` ne dozvoljava ponovnu dodjelu vraćenih/demontiranih ispravnih kartica** (`DEMOUNTED` / `RETURNED` moraju prvo ručno na `AVAILABLE`), niti postoji jasna akcija "Vrati u dostupne" (`return-to-stock`) s revizijskim tragom.
11. **[P2-2] `ShipmentsService.update` ne validira postojanje nove `distributionId`** kada ga `SYSTEM_ADMIN` mijenja (FK P2003 umjesto 404/400), i ako isporuka već ima dodijeljene/ugrađene kartice, promjena distribucije može ostaviti SIM kartice u starim poslovnicama/korisnicima druge distribucije!
12. **[P2-3] `ShipmentDetailsPage.tsx` prikazuje sirovi enum status (`COMPLETED`/`RECEIVED`)** u `StatusBadge` umjesto lokalizovanog naziva.

---

## 4. Konkretan akcioni plan za Run 2 (čeka odobrenje)

### Paket A (P0 — Kritični bugovi i sigurnost)
1. **Popraviti `mobile/src/api/sim-cards.api.ts` (`myAssigned`):**
   - Podržati `PaginatedResult` (`Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []`) i dodati `limit: 100` parametar da monter dobije sve svoje dodijeljene kartice.
2. **Zatvoriti `BranchModerator` IDOR na `SimCardsController` & `SimCardsService`:**
   - Proslijediti `branchModeratorBranchIds` u `findOne` i `listEvents`.
   - U `SimCardsService.findOne` i `listEvents` za `USER` ulogu (moderatora) ograničiti pristup isključivo na kartice ugrađene u brojila njegovih moderiranih poslovnica (`meter.branchId IN branchModeratorBranchIds`) ili dodijeljene njemu lično (`assignedToId === user.id`), nikako na cijelu distribuciju!
3. **Obezbijediti `SimCardsService.update`:**
   - Normalizovati `iccid` i `phoneNumber`, trimovati IP adrese, provjeriti duplikate (`iccid`, `ipAddress`, `publicIpAddress`, `phoneNumber`) uz isključenje vlastitog `id`.
   - Zabraniti ručnu promjenu `status`-a ako je kartica povezana na `Meter` (`INSTALLED`) — uputiti na demontažu.
   - Ako se mijenja `shipmentId`, u transakciji ažurirati `totalCards` na obje isporuke.
4. **Popraviti prazan `selectedRowNumbers: []` u `ExcelImportService.toCreateManyData`:**
   - Razlikovati `selectedRowNumbers === undefined` (uvezi sve validne) od eksplicitnog `[]` (uvezi 0 -> `BadRequestException('Nije odabran nijedan red')`).

### Paket B (P1 — PostgreSQL performanse, bulk operacije i terenska brzina)
5. **Dodati PostgreSQL indekse na `SimCard` (`schema.prisma` + Prisma migracija):**
   - `@@index([shipmentId])`, `@@index([assignedToId])`, `@@index([publicIpAddress])`, `@@index([phoneNumber])`.
   - Optimizovati `fetchExistingSimFields` (izbjeći nepotrebno dupliranje velikog `IN` upita kad `selectedRowNumbers` sadrži samo podskup redova).
6. **Case-insensitive pretraga + normalizacija skeniranog ICCID-a:**
   - `mode: 'insensitive'` na `ShipmentsService.findAll` i `SimCardsService.findAll`/`moderatedInstalled`.
   - `normalizeIccid(iccid)` u `SimCardsService.scanByIccid`.
7. **Batch endpoint za offline reconcile (`POST /sim-cards/scan-batch`) + update `reconcileOfflineSimInventory`:**
   - Zamijeniti do 80 sekvencijalnih HTTP poziva na mobilnom jednim batch zahtjevom.
8. **Bulk dodjela SIM kartica (`POST /sim-cards/bulk-assign`) + popravka `ShipmentsListPage` dropdowna i `SimCardDetailsPage` prikaza brojila:**
   - `ShipmentsListPage`: korisnici `{ role: 'USER', limit: 100 }` + search u draweru + checkbox selekcija SIM kartica za masovnu dodjelu monteru u jednom kliku!
   - `SimCardDetailsPage`: uključiti `meter` (`id`, `serialNumber`, `status`, `branch`) u `simCardInclude` i prikazati link ka brojilu direktno u opisu kartice.
9. **Kreiranje `SimEvent('IMPORTED')` u `importExcel`** i sinkronizacija `Shipment.totalCards` kod pojedinačnog `create`/`remove` SIM kartice.

### Paket C (P2 — Poslovne dorade i UX)
10. Dozvoliti validaciju `distributionId` kod `ShipmentsService.update` (i zabraniti promjenu distribucije ako isporuka već ima dodijeljene/ugrađene kartice).
11. Lokalizovati `ShipmentDetailsPage` status badge i dodati opciju vraćanja `DEMOUNTED`/`RETURNED` kartice u `AVAILABLE` (s `SimEvent` zapisom).

---

**Čekam tvoju potvrdu:** Koje pakete iz Run 2 želiš da implementiramo (**Paket A**, **Paket B**, **Paket C**)?
