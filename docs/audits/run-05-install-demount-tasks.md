# Audit Run 5 — Terenski zadaci ugradnje i demontaže (`install-tasks` + `demount-tasks`)

**Obuhvaćeni moduli:** `install-tasks` (`install-tasks.controller.ts`, `install-tasks.service.ts`, `dto/*`), `demount-tasks` (`demount-tasks.controller.ts`, `demount-tasks.service.ts`, `dto/*`), web integracija (`MeterDetailPage.tsx`, `MetersListPage.tsx`, `install-tasks.api.ts`, `demount-tasks.api.ts`), i mobile (`install.tsx`, `demount.tsx`, `install-tasks.api.ts`, `demount-tasks.api.ts`).  
**Datum audita:** 2026-11-21 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** Kompletiran audit i prijedlog izmjena — **čeka odobrenje prije izmjena koda**.

---

## 1. Mapa funkcija po osobama (Role Matrix)

### 1.1 `install-tasks`

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `POST /install-tasks` | Da (bilo koja podružnica) | Da (svoja distribucija) | Da (moderirana podružnica + operator iz iste podružnice) | Ne (400 u servisu) | Provjerava `NO_SIM`, `ACTIVE`, `hasOpenInstallTask`. Ne provjerava da li je `assignedTo.status === 'ACTIVE'`. |
| `GET /install-tasks/my` | Vlastiti dodijeljeni | Vlastiti dodijeljeni | Vlastiti dodijeljeni | Vlastiti dodijeljeni | Nema globalnog `GET /install-tasks` za pregled vraćenih/svih naloga po opsegu (P1-2). |
| `PATCH /install-tasks/:id/status` | Samo ako je `assignedToId` | Samo ako je `assignedToId` | Samo ako je `assignedToId` | Samo ako je `assignedToId` | **P0-2:** Inline `@Body() body: { status }` bez DTO klase/validacije! **P1-1:** Prvo radi `update` u bazi pa naknadno provjerava `otherOpen` i baca grešku. |
| `POST /install-tasks/:id/cancel` | Svi zadaci | **Bilo koji zadatak (nedostaje distribution scope!)** | Samo ako je `createdById` | Samo ako je `createdById` | **P0-2:** `cancel()` ne provjerava `scopeWhere(..., { viaMeter: true })` za `DIST_ADMIN`. |
| `POST /install-tasks/:id/reassign` | Svi zadaci | **Nedostaje distribution scope zadatka!** | **Može dodijeliti operatoru iz druge podružnice!** | Samo ako je `createdById` | **P0-2:** Inline `@Body()` bez `@IsUUID()`, nedostaje `scopeWhere` na samom tasku za `DIST_ADMIN` i provjera `assignedTo.branchId === meter.branchId` za `USER`, te `assignedTo.status === 'ACTIVE'`. |
| `POST /install-tasks/:id/complete` | Ako je dodijeljen | Ako je dodijeljen | Ako je dodijeljen | Ako je dodijeljen | **P0-1:** Nije atomičan (`simCardsService.claim`, `meter.update`, `installationRecordsService.create`, i `installTask.updateMany` su odvojeni); nema `clientRequestId` za idempotentnost ni `photos` podrške. |

### 1.2 `demount-tasks`

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `POST /demount-tasks` | Da | Da (svoja distribucija) | Da (moderirana podružnica + operator iz iste podružnice) | Ne (400 u servisu) | Zaključava `meter.hasOpenDemountTask = true`. Ne provjerava `assignedTo.status === 'ACTIVE'`. |
| `GET /demount-tasks/my` | Vlastiti | Vlastiti | Vlastiti | Vlastiti | Nema `GET /demount-tasks` za administratore/moderatore (P1-2). |
| `PATCH /demount-tasks/:id/status` | Samo ako je `assignedToId` | Samo ako je `assignedToId` | Samo ako je `assignedToId` | Samo ako je `assignedToId` | **P0-2:** Inline `@Body() body: { status }` bez DTO klase/validacije! Ne osigurava da nema duplog otvorenog zadatka ako se vrati u `PENDING`. |
| `POST /demount-tasks/:id/cancel` | Svi | **Nedostaje distribution scope!** | Samo ako je `createdById` | Samo ako je `createdById` | **P0-2:** `DIST_ADMIN` može otkazati zadatak van svoje distribucije. |
| `POST /demount-tasks/:id/reassign` | Svi | **Nedostaje distribution scope zadatka!** | **Nedostaje provjera podružnice operatora!** | Samo ako je `createdById` | **P0-2:** Inline `@Body()` bez `@IsUUID()`, nedostaje scope taska i provjera `assignedTo.branchId === meter.branchId` i `assignedTo.status === 'ACTIVE'`. |
| `POST /demount-tasks/:id/complete` | Ako je dodijeljen | Ako je dodijeljen | Ako je dodijeljen | Ako je dodijeljen | **P0-3:** (1) Ne provjerava `meter.status === 'ACTIVE'` kod `complete()`; (2) Poređenje zaključanog `requestedReason !== dto.reason` ne radi `.trim()` pa ruši validan mobile zahtjev; (3) `REPLACE_SIM` ažurira `simCard.status = INSTALLED` bez poravnanja/provjere i bez zapisa u `InstallationRecord` ili eksplicitne dokumentacije razlike. |

---

## 2. Analiza po operativnim ulogama (Bottlenecks & Edge Cases)

### Persona 1: `SYSTEM_ADMIN`
- **Odsustvo centralnog pregleda zadataka (`GET /install-tasks`, `GET /demount-tasks`):** Kada terenski operater vrati nalog inicijatoru (`IN_PROGRESS -> PENDING` postavlja `assignedToId: null`), taj nalog nestaje iz `GET */my` i može se pronaći samo otvaranjem pojedinačnog brojila.
- **Neaktivni korisnici kao izvršioci:** Ni `create` ni `reassign` ne odbijaju korisnike sa `status !== ACTIVE` (`INACTIVE` / `SUSPENDED`), što stvara zaglavljene naloge.

### Persona 2: `DIST_ADMIN`
- **Cross-distribution IDOR na `cancel` i `reassign`:** `InstallTasksService` i `DemountTasksService` na `cancel()` i `reassign()` provjeravaju samo `actor.role === DIST_ADMIN`, bez `scopeWhere(scope, { viaMeter: true })` na samom zadatku — `DIST_ADMIN` može otkazati ili pre-dodijeliti zadatak tuđe distribucije!
- **Preklapanje ručnog kreiranja zapisnika sa aktivnim `InstallTask`-om:** Ako admin ili monter ručno napravi `InstallationRecord` za brojilo koje već ima aktivan `InstallTask`, `hasOpenInstallTask` ostaje `true` i `InstallTask` ostaje `PENDING`/`IN_PROGRESS` iako brojilo već ima ugrađenu SIM karticu.

### Persona 3: `BRANCH_MODERATOR`
- **Bypass podružnice na `reassign()`:** Moderator ima ispravnu provjeru `assignedTo.branchId === meter.branchId` pri `create()`, ali ne i pri `reassign()` — može pre-dodijeliti zadatak operateru van svoje podružnice ili ako je sam kreator, čak i za brojilo van moderacije ako mu se promijenila dodjela.

### Persona 4: `USER` (Terenski monter / Mobile)
- **P0-1 Polovično završen `InstallTask.complete` ostavlja nekonzistentno stanje:** Zbog odvojenog `simCardsService.claim`, `meter.update`, `installationRecordsService.create` i finalnog `installTask.updateMany`, prekid ili greška u zadnjem koraku ostavlja brojilo sa ugrađenim SIM-om dok je zadatak još `IN_PROGRESS`, pa svaki naredni retry zauvijek pada s `INSTALL_TASK_METER_HAS_SIM`.
- **P0-3 `DemountTask.complete` sa zaključanim `requestedReason`:** Mobile radi `reason = wizard.reason.trim()`, pa ako je inicijator unio razlog s vodećim/pratećim razmakom, poređenje `task.requestedReason !== dto.reason` odbija završetak zadatka (`DEMOUNT_TASK_FIELD_LOCKED`).
- **Offline mobile `updateStatus` / `complete`:** `installTasksApi` ne podržava priložene fotografije ni `clientRequestId` prilikom završetka `InstallTask`-a.

---

## 3. Konkretni prijedlozi za unapređenje i ubrzanje

### Paket A — Kritične ispravke sigurnosti i atomičnosti (P0)
1. **P0-1 (`InstallTasksService.complete` atomičnost i idempotentnost):**
   - Prije bilo kakvih mutacija (`claim`, `meter.update`), provjeriti da je `dto.simCardId` u ispravnoj distribuciji (`meterDistributionId`) i dostupan operatoru (`AVAILABLE` ili `ASSIGNED` tom korisniku), te validirati `dynamicFieldValues` i godine.
   - Proslijediti deterministički `clientRequestId: \`install-task:${task.id}\`` u `installationRecordsService.create` kako bi eventualni retry bio idempotentan.
   - Ako `installationRecordsService.create` uspije a `installTask.updateMany` ne uspije ili se nađe da zapisnik već postoji za `install-task:${task.id}`, uraditi atomično završavanje zadatka i resetovanje `hasOpenInstallTask: false` umjesto ostavljanja zaglavljenog zadatka (ili obaviti unutar jedinstvene transakcije / sigurnog kompenzacijskog koraka).
2. **P0-2 (DTO validacija + scope & status kontrole u oba modula):**
   - Zamijeniti inline `@Body()` na `PATCH :id/status` i `POST :id/reassign` u oba controllera pravim DTO klasama (`UpdateInstallTaskStatusDto`, `UpdateDemountTaskStatusDto`, `ReassignTaskDto` sa `@IsEnum` i `@IsUUID()`).
   - Na `cancel()` i `reassign()` u oba servisa dodati `scopeWhere(scope, { viaMeter: true })` (plus kod `USER` provjera da je i dalje moderator te podružnice ili inicijator unutar svoje podružnice), te na `reassign()` dodati provjeru `assignedTo.branchId === meter.branchId` za `USER` ulogu.
   - U `create()` i `reassign()` oba servisa zahtijevati `assignedTo.status === UserStatus.ACTIVE`.
3. **P0-3 (`DemountTasksService.complete` konzistentnost):**
   - Provjeriti `meter.status === MeterStatus.ACTIVE` pri `complete()`.
   - Porediti zaključani `requestedReason` pomoću `.trim()` (`(task.requestedReason ?? '').trim() !== dto.reason.trim()`) kako whitespace ne bi blokirao mobile wizard.
   - Kod `REPLACE_SIM`: pri ažuriranju nove SIM kartice postaviti i `assignedToId: userId` (ili jasno očistiti/sačuvati konzistentno sa `InstallationRecordsService`) i spriječiti završetak na neaktivnoj ili već zauzetoj kartici.

### Paket B — Operativna vidljivost i poslovni tok (P1)
4. **P1-1 (`InstallTasksService.updateStatus` redoslijed provjere + zaštita od duplog zadatka):**
   - Premjestiti `otherOpen` provjeru **prije** `installTask.update()` (idealno u `$transaction`) da ne ostavlja mutiran zapis u bazi kad baci grešku.
   - U `DemountTasksService.updateStatus` dodati istu `otherOpen` provjeru i poravnanje `hasOpenDemountTask` radi simetrije.
5. **P1-2 (Centralizovani `GET /install-tasks` i `GET /demount-tasks` sa filterima + auto-zatvaranje pri ručnoj ugradnji):**
   - Dodati paginirane `GET /install-tasks` i `GET /demount-tasks` (sa filterima `status`, `unassignedOnly`, `branchId`, `search`) pod `scopeWhere(..., { viaMeter: true })` za `SYSTEM_ADMIN` / `DIST_ADMIN` / moderatore kako bi vraćeni (`assignedToId: null`) i aktivni zadaci bili vidljivi bez ulaska u svako pojedinačno brojilo.
   - Kada se preko `InstallationRecordsService.create` ugradi SIM na postojeće brojilo koje ima otvoren `InstallTask`, automatski ga označiti kao `COMPLETED` (ili spriječiti dupli otvoreni zadatak).
6. **P1-3 (`CompleteInstallTaskDto` podrška za `photos`):**
   - Dodati opcionalno `photos?: string[]` u `CompleteInstallTaskDto` i prosliiediti ga u `installationRecordsService.create` (uz već ugrađenu P0 validaciju `installation-records/` putanja).

### Paket C — Prisma indeksi i testovi (P2)
7. **P2-1 (Prisma indeksi):**
   - Dodati `@@index([meterId])`, `@@index([createdById])` i `@@index([assignedToId, status])` na `DemountTask`, te `@@index([createdById])` i `@@index([assignedToId, status])` na `InstallTask`.
8. **P2-2 (Unit testovi):**
   - Proširiti `install-tasks.service.spec.ts` i `demount-tasks.service.spec.ts` za `DIST_ADMIN` cross-distribution `cancel`/`reassign` blokadu, `USER` cross-branch `reassign` blokadu, neaktivnog operatora, `InstallTask.complete` idempotentnost / atomičnost, i `DemountTask` trimmed `requestedReason` + `meter.status !== ACTIVE` provjeru.
