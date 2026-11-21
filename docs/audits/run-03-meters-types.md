# Audit Run 3 — Brojila i tipovi brojila (`meters` + `meter-type-definitions` + `meter-type-fields`)

**Obuhvaćeni moduli:** `meters` (`meters.controller.ts`, `meters.service.ts`, `dto/*`), `meter-type-definitions` (`meter-type-definitions.controller.ts`, `meter-type-definitions.service.ts`, `meter-type-fields.service.ts`, `dto/*`), web stranice (`MetersListPage.tsx`, `MeterDetailPage.tsx`, `MeterTypeUpsertPage.tsx`, `MeterTypeFieldsPage.tsx`), i mobile (`meter-type-definitions.api.ts`, `meter-types-sync.ts`).  
**Datum audita:** 2026-11-21 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** Kompletiran audit i prijedlog izmjena — **čeka odobrenje prije izmjena koda**.

---

## 1. Mapa funkcija po osobama (Role Matrix)

### 1.1 `meters` (`backend/src/modules/meters/*`, `frontend/src/pages/meters/*`)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `GET /meters` | Sva brojila | Brojila svoje distribucije (`branch.distributionId`) | **GREŠKA (P0-4):** Vidi **sva** brojila svoje `distributionId` umjesto samo moderiranih poslovnica | Brojila svoje `branchId` | Nema filtera po `status` ni `branchId`; ne vraća `branch` relaciju u listi. |
| `GET /meters/available` | Sva brojila bez paginacije | Sva brojila distribucije | **GREŠKA (P0-4):** Vidi cijelu distribuciju | Brojila svoje `branchId` | Nema `limit` / paginacije / filtera — vuče kompletnu tabelu `meters` (P0-3). |
| `GET /meters/:id` | Bilo koje brojilo | U svojoj distribuciji | **GREŠKA (P0-4):** Cijela distribucija | U svojoj `branchId` | Uključuje `meterTypeDefinition`, `simCard`, otvorene `installTasks` i `demountTasks`. |
| `POST /meters` | Kreiranje (+ opcionalni `simCardId`) | Kreiranje za poslovnicu svoje distribucije | Ne (403) | Ne (403) | **Ne hvata `P2002` za dupli `serialNumber` niti `P2003` (P0-1)**; `simCardId` zapisnik nije atomičan s kreiranjem brojila (P1-3). |
| `PATCH /meters/:id` | Izmjena svih polja | Izmjena u svom scope-u | Ne (403) | Ne (403) | **Dozvoljava direktnu izmjenu `simCardId` bez ažuriranja `SimCard.status` i `SimEvent` (P0-2)**; ne provjerava `branchId` vlasništvo! |
| `DELETE /meters/:id` | Odbija (`400 BadRequest`) | Odbija (`400 BadRequest`) | Ne (403) | Ne (403) | Koristi ručni `scope` bez `toScopeContext`. |
| `GET :id/delete-summary` & `POST :id/delete` | Brisanje uz potvrdu lozinkom + kaskadno čišćenje SIM-a/zapisnika/fajlova | Ne (403) | Ne (403) | Ne (403) | Koristi direktni `fs.rmSync` umjesto `UploadsStorageService` (P2-2). |

### 1.2 `meter-type-definitions` & `meter-type-fields` (`backend/src/modules/meter-type-definitions/*`, `MetersListPage`, `MeterTypeUpsertPage`, `MeterTypeFieldsPage`, mobile)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `GET /meter-type-definitions/list` | Svi tipovi + `fields` | Svi tipovi + `fields` | Svi tipovi + `fields` | Svi tipovi + `fields` | Mobile `syncMeterTypesOfflineCache` ignoriše već vraćene `fields` i radi N+1 zahtjeve (P1-2)! |
| `GET /meter-type-definitions` & `:id` | Svi | Svi | Svi (`BranchModeratorGuard`) | 403 (`BranchModeratorGuard`) | Katalog je globalan. |
| `POST` / `PATCH` / `DELETE /meter-type-definitions` | Puni CRUD | Ne (403) | Ne (403) | Ne (403) | `DELETE` ne hvata `P2003` ako postoje brojila tog tipa (P1-1). |
| `GET /meter-type-definitions/:id/fields` | Sva polja tipa | Sva polja tipa | Sva polja tipa | Sva polja tipa | Redoslijed po `sortOrder ASC`. |
| `POST`/`PATCH`/`DELETE`/`PUT reorder` polja | Puni CRUD + reorder | Ne (403) | Ne (403) | Ne (403) | **Nema jedinstvenosti `(meterTypeDefinitionId, name)` ni u shemi ni u servisu (P1-1)**; `reorder` ne odbija duplikate. |

---

## 2. Analiza po operativnim ulogama (Bottlenecks & Edge Cases)

### Persona 1: `SYSTEM_ADMIN`
- **Duplikat serijskog broja (`serialNumber`):** Pri unosu postojećeg serijskog broja (npr. `AMM-1001` ili `'AMM-1001 '`), `MetersService.create` ne trimuje string i ne hvata Prisma `P2002`, pa korisnik dobija nečitljiv `500 Internal Server Error` umjesto `409 Conflict`. Isto važi i za `MetersService.update`.
- **Korupcija veze `Meter <-> SimCard` preko `PATCH /meters/:id`:** Budući da `UpdateMeterDto` nasljeđuje `PartialType(CreateMeterDto)`, u `PATCH /meters/:id` je moguće poslati `simCardId` ili `simCardId: null`. `MetersService.update` mijenja `meter.simCardId` i `meter.simCardState`, ali **uopće ne mijenja `SimCard.status`**, ne briše staru dodjelu i ne piše `SimEvent` — čime ostavlja `SimCard` u statusu `INSTALLED` bez brojila ili `AVAILABLE` dok je već ugrađen!
- **Brisanje tipa brojila u upotrebi:** Pokušaj brisanja tipa brojila koji već ima brojila u bazi baca sirovu SQL/Prisma grešku `P2003` (`500`).
- **Dupla imena dinamičkih polja:** `MeterTypeField` nema `@@unique([meterTypeDefinitionId, name])`, pa dva polja sa istim `name` (npr. `ct_ratio`) tiho prepisuju jedno drugo u `dynamicFieldValues`.
- **Nedostatak filtera u tabeli brojila:** Na `MetersListPage` nije moguće filtrirati brojila po `status` (`ACTIVE`, `DEFECTIVE`, `INACTIVE`, `IN_CALIBRATION`) niti po `branchId` (poslovnici), niti tabela prikazuje poslovnicu brojila.

### Persona 2: `DIST_ADMIN`
- **Nedosljedna zaštita `branchId` u `PATCH /meters/:id`:** `create()` provjerava pripada li `branchId` distribuciji `DIST_ADMIN`-a, ali `update()` (`meters.service.ts:251`) to preskače — `DIST_ADMIN` može izmjenom `branchId` prebaciti brojilo svoje distribucije u podružnicu druge distribucije!
- **Izostanak `branch` detalja u `GET /meters`:** U tabeli brojila `DIST_ADMIN` ne vidi kojoj poslovnici pripada pojedino brojilo bez otvaranja detalja ili zapisnika.

### Persona 3: `BRANCH_MODERATOR`
- **Cross-branch curenje brojila (P0-4):** `MetersService.getMetersReadScopeClause` (`meters.service.ts:534-547`) za `USER` sa `branchModeratorBranchIds.length > 0` vraća `{ branch: { distributionId: scope.distributionId } }` — umjesto da ograniči na `[branchId, ...branchModeratorBranchIds]`! Moderator jedne poslovnice tako kroz `GET /meters`, `GET /meters/:id` i `GET /meters/available` može čitati brojila, lokacije i SIM ICCID-ove svih ostalih poslovnica u distribuciji.

### Persona 4: `USER` (Terenski monter / Mobile)
- **N+1 sinhronizacija kataloga na loginu (`mobile/src/offline/meter-types-sync.ts`):** Pri sinhronizaciji offline keša za tipove brojila, aplikacija poziva `GET /meter-type-definitions/list` (koji **već vraća** `fields` za svaki tip!) i zatim za svaki od `N` tipova šalje zaseban `GET /meter-type-definitions/:id/fields` poziv (`1 + N` umjesto `1` zahtjev).
- **Skalabilnost `GET /meters/available`:** Kako broj brojila raste na više hiljada, nedostatak paginacije/pretrage na `/meters/available` usporava otvaranje forme za zapisnik.

---

## 3. Konkretni prijedlozi za unapređenje i ubrzanje

### Paket A — Kritične ispravke sigurnosti i integriteta (P0)
1. **P0-1 (`MetersService.create` & `update` — `serialNumber` + `meterTypeDefinitionId` integritet):**
   - Trimovati `serialNumber` u `create` i `update`.
   - Provjeriti postojanje `meterTypeDefinitionId` prije upisa (`NotFoundException`/`BadRequestException`).
   - Uhvatiti Prisma `P2002` u `create` i `update` i baciti jasnu `ConflictException` poruku (`Brojilo sa ovim serijskim brojem već postoji.`).
2. **P0-2 (`MetersService.update` & `UpdateMeterDto` — zaštita `branchId` i `simCardId`):**
   - Zabraniti direktno prepisivanje `simCardId` i `simCardState = INSTALLED` kroz `PATCH /meters/:id` (`OmitType` u `UpdateMeterDto` ili eksplicitna validacija u `update()` ako dođe u payload-u) — ugradnja i skidanje SIM-a moraju ići isključivo kroz proces zapisnika/demontaže da `Meter <-> SimCard <-> SimEvent` uvijek budu u 100% konzistentnom stanju.
   - Validirati `branchId` u `MetersService.update` na isti način kao u `create()` (postojanje `Branch` + provjera da pripada `scope.distributionId` za `DIST_ADMIN`).
   - U `MetersController.create`: ako je proslijeđen `simCardId` i `installationRecordsService.create` baci grešku, uraditi kompenzacijsko čišćenje ili koristiti `try/catch` tako da ne ostaje "prazno" brojilo ako je kreiranje inicijalnog zapisnika odbijeno (ili vratiti jasnu grešku uz rollback kreiranog brojila kad nije imalo prethodnih zapisa).
3. **P0-3 (Baza & Performanse — indeksi na `Meter` + limit na `findAvailable`):**
   - Nova Prisma migracija: dodati `@@index([branchId])` i `@@index([simCardState])` na `Meter`, te `@@unique([meterTypeDefinitionId, name])` na `MeterTypeField` (uz sigurnu migraciju).
   - `MetersService.findAvailable`: dodati opcionalne filtere (`search`, `limit` default 200 / max 500) u `GET /meters/available` kako odgovor ne bi rastao neograničeno, uz očuvanje povratnog niza kompatibilnog s postojećim frontendom.
   - Popraviti `MetersController.remove` da koristi `toScopeContext`.
4. **P0-4 (`BRANCH_MODERATOR` scope popravka u `MetersService.getMetersReadScopeClause`):**
   - Zamijeniti `{ branch: { distributionId: scope.distributionId } }` sa `{ branchId: { in: allModeratedBranchIds } }` (uključujući i vlastiti `scope.branchId` + `scope.branchModeratorBranchIds`), tako da moderator vidi samo brojila svojih poslovnica!

### Paket B — Ubrzanje, API i UX poboljšanja (P1)
5. **P1-1 (`MeterTypeDefinitionsService` & `MeterTypeFieldsService` validacije):**
   - `MeterTypeDefinitionsService.remove`: prije brisanja provjeriti `prisma.meter.count({ where: { meterTypeDefinitionId: id } })` (i uhvatiti `P2003`) i baciti čitljivu `ConflictException` poruku.
   - `MeterTypeFieldsService`: normalizovati/trimovati `name` i `label`, provjeriti jedinstvenost `name` unutar istog `meterTypeDefinitionId` (`ConflictException`), te u `reorder` provjeriti da `fieldIds` nema duplikata i da odgovara poljima definicije.
6. **P1-2 (Mobile 1-request sync kataloga tipova brojila):**
   - U `mobile/src/offline/meter-types-sync.ts` i `mobile/src/api/meter-type-definitions.api.ts`: iskoristiti `fields` polja koja `GET /meter-type-definitions/list` već vraća iz backenda, pa `syncMeterTypesOfflineCache` radi **1 HTTP poziv umjesto `1 + N`**!
7. **P1-3 (Filteri po `status` i `branchId` + prikaz poslovnice na webu):**
   - Dodati opcionalne query parametre `status` (`MeterStatus`) i `branchId` (`UUID`) u `MeterFilterDto` i `MetersService.findAll`, uključiti `branch: { select: { id, name, code } }` u `MetersService.findAll` i `findOne`.
   - Dodati dropdown filter za `Status` i `Poslovnica` te kolonu `Poslovnica` na `MetersListPage.tsx` (sa i18n ključevima u `bs.ts`/`en.ts`).
8. **P1-4 (`MeterTypeDefinitionsService.findAll` count brojila):**
   - Dodati `_count: { select: { meters: true } }` u `MeterTypeDefinitionsService.findAll` tako da admin u tabu **Tipovi brojila** odmah vidi koliko brojila koristi svaki tip (i kad brisanje nije moguće).

### Paket C — Dugoročna čistoća i auditabilnost (P2)
9. **P2-1 (ActivityLog na `Meter` CRUD i `MeterTypeDefinition`/`Field` CRUD):**
   - Logovati `CREATE` / `UPDATE` u `MetersService` i `CREATE` / `UPDATE` / `DELETE` u `MeterTypeDefinitionsService` i `MeterTypeFieldsService` preko `ActivityLogService` za potpun revizorski trag.
10. **P2-2 (`UploadsStorageService` u `MetersService.deleteWithConfirm`):**
   - Koristiti injektirani `UploadsStorageService` (ili njegov `resolveSafePath`) za uklanjanje direktorija pri brisanju brojila umjesto sirovog `fs.rmSync`.
