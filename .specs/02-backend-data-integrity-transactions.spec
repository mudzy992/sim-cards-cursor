# SPEC 02 — Backend Data Integrity, Transactions, DTO Validation & Performance
**Prioritet:** P1 (Critical), P2 (High), P3 (Low)
**Opseg:** Svi backend moduli i `backend/src/common/`

---

## 1. P1 — Atomicity, Race Conditions & Data Corruption

### 1.1 `record-number.generator.ts` — Race Condition & Lexicographical Sort Bug
- **Fajl:** `backend/src/common/utils/record-number.generator.ts`
- **Problem:** Čita zadnji zapisnik (`findFirst({ orderBy: { recordNumber: 'desc' } })`) pa inkrementira u Node memoriji. Pod konkurentnim zahtjevima dva klijenta dobijaju isti `recordNumber` -> `P2002` unique constraint crash. Dodatno, leksikografsko sortiranje puca kad broj pređe `99999` (`REC-2026-99999` > `REC-2026-100000`).
- **Rješenje:** Zamijeniti PostgreSQL sekvencom po godini (ili atomskim upsert/increment counter redom u `AppSetting`/namjenskoj tabeli unutar `$transaction`, ili `INSERT ... ON CONFLICT DO UPDATE SET value = ... RETURNING` preko `$queryRaw`), sa zero-padded formatiranjem min 5 cifara.

### 1.2 `sim-cards.service.ts` — Non-Atomic Claim Race Condition
- **Fajl:** `backend/src/modules/sim-cards/sim-cards.service.ts`
- **Problem:** `claim` čita karticu i potom radi `update` bez atomskog `where: { id, status: SimCardStatus.AVAILABLE }` unutar transakcije. Dva terenska operatora mogu istovremeno preuzeti istu SIM karticu.
- **Rješenje:** Koristiti `updateMany` unutar `prisma.$transaction` sa uslovom `{ id, status: SimCardStatus.AVAILABLE, assignedToId: null }`, provjeriti `count === 1`, pa upisati `SimEvent`.

### 1.3 `install-tasks.service.ts` & `demount-tasks.service.ts` — Split Transactions
- **Fajlovi:**
  - `backend/src/modules/install-tasks/install-tasks.service.ts` (`complete`)
  - `backend/src/modules/demount-tasks/demount-tasks.service.ts` (`complete`)
- **Problemi:**
  1. `InstallTasksService.complete`: `claim`, `meter.update`, `installationRecord.create`, i `installTask.update` ne izvršavaju se u jednoj atomskoj Prisma transakciji — pad bilo kojeg koraka ostavlja sistem u polukonzistentnom stanju (SIM `INSTALLED` bez zapisnika, ili brojilo ažurirano bez zatvorenog zadatka).
  2. `DemountTasksService.complete` (`REPLACE_SIM`): `newSimCardId` nema atomski lock u transakciji -> dva zadatka mogu preuzeti istu zamjensku SIM karticu.
- **Rješenje:** Obuhvatiti cijeli `complete` flow u jednu `prisma.$transaction(async (tx) => ...)` koristeći `tx` za sve operacije i atomski `updateMany` za zaključavanje zadatka (`status: { in: ['PENDING', 'IN_PROGRESS'] }`) i nove SIM kartice (`status: AVAILABLE` ili `ASSIGNED` tom operatoru).

### 1.4 `installation-records.service.ts` & `meters.service.ts` — Non-Atomic Record & Meter Creation
- **Fajlovi:**
  - `backend/src/modules/installation-records/installation-records.service.ts` (`create`)
  - `backend/src/modules/meters/meters.service.ts` (`create`)
- **Problemi:**
  1. `InstallationRecordsService.create`: ažuriranje brojila/SIM kartice i kreiranje `installationRecord` nisu uvijek atomski povezani u jednoj transakciji sa validacijom stanja SIM kartice.
  2. `MetersService.create`: kreira brojilo i opciono zapisnik odvojeno.
  3. `autoSendRecordEmail` koristi neobrađeni fire-and-forget promise (`void this.autoSendRecordEmail(...)`) bez strukturisanog error recoveryja ako proces dobije shutdown signal.
- **Rješenje:**
  - Sve mutacije kreiranja brojila + vezivanja SIM + kreiranja zapisnika + kreiranja `SimEvent` staviti u jednu `prisma.$transaction`.
  - Za `autoSendRecordEmail`, osigurati pouzdano logovanje greške i siguran update statusa na `SEND_FAILED` čak i kad padne PDF generisanje ili SMTP.

---

## 2. P2 — Validation, DoS/OOM & Error Handling

### 2.1 Inline Body Types Bypassing `ValidationPipe`
- **Fajlovi:**
  - `backend/src/modules/install-tasks/install-tasks.controller.ts` (`@Body() body: { status: InstallTaskStatus }`)
  - `backend/src/modules/demount-tasks/demount-tasks.controller.ts` (`@Body() body: { status: DemountTaskStatus }`)
  - `backend/src/modules/mail/mail.controller.ts` (inline body tipovi za template update/preview/test)
  - `backend/src/modules/settings/settings.controller.ts` (`setMobilePush` inline body)
  - `backend/src/modules/meter-type-definitions/meter-type-definitions.controller.ts` (`reorderFields` inline body)
- **Rješenje:** Kreirati eksplicitne DTO klase sa `class-validator` dekoratorima (`@IsEnum`, `@IsBoolean`, `@IsArray`, `@IsUUID('4', { each: true })`, `@IsEmail`, `@IsString`) za svaki od ovih endpointa kako globalni `whitelist: true` i `forbidNonWhitelisted: true` ne bi tiho propuštali nevalidirane payload-e.

### 2.2 Unbounded Queries, OOM & Event-Loop Blocking
- **Fajlovi:**
  - `backend/src/modules/shipments/shipments.service.ts` (`fetchExistingIccidMap` učitava SVE ICCID-ove iz cijele baze u RAM kod svakog preview/import poziva!) -> filtrirati upit isključivo na `iccid: { in: candidateIccids }` (chunkovano po npr. 2000 komada).
  - `backend/src/modules/analytics/analytics.service.ts`:
    - `CUSTOM` range bez validacije datuma i limita raspona (`for (let t = from.getTime(); t <= to.getTime(); t += dayMs)` može napraviti beskonačnu/milionsku petlju i OOM). Validirati `from <= to`, `max 366` (ili `730`) dana, validne `Date` instance -> `BadRequestException` u suprotnom.
    - `getSimCardsAnalytics` učitava sve `SimCard` redove u Node memoriju umjesto SQL/Prisma agregacije (`groupBy` / `$queryRaw`).
    - `getExportCsv`: dodati CSV formula-injection sanitizaciju (prefix `'` ispred `=`, `+`, `-`, `@`, `\t`, `\r`) i baciti `BadRequestException` umjesto `Error` za nepoznat tip izvještaja.
  - `backend/src/modules/dashboard/dashboard.service.ts`: ograničiti `days` parametar (min 1, max 365) i agregirati na nivou baze umjesto učitavanja svih redova.
  - `backend/src/modules/notifications/notifications.controller.ts`: validirati `limit` query param kroz DTO (`@Min(1) @Max(100)` umjesto neograničenog `parseInt(limit)`).
  - `backend/src/modules/meters/meters.service.ts` (`findAvailable`): dodati `take` limit / paginaciju ili pretragu.

### 2.3 Prisma Exception Filter & Standardized Error Codes
- **Fajlovi:**
  - `backend/src/common/filters/prisma-exception.filter.ts`
  - `backend/src/common/filters/http-exception.filter.ts`
- **Problemi:**
  1. `prisma-exception.filter.ts` izlaže `exception.meta` direktno u HTTP response (može otkriti imena tabela/kolona/constrainta) i ne mapira `P2003` (FK constraint -> 400/409) i `P2014` (relation violation -> 400).
  2. Business exception-i širom backend servisa bacaju samo bosanske stringove bez `code` polja, pa `errorCode` u `HttpExceptionFilter` ostaje `undefined` i frontend ne može lokalizovati API greške na engleski.
- **Rješenje:**
  1. Ukloniti sirovi `exception.meta` iz produkcijskog odgovora; dodati mapiranje za `P2003`, `P2014`, `P2025`, `P2002`.
  2. Uvesti centralni `ErrorCodes` enum/konstante na backendu i postepeno dodati `{ code: ErrorCodes.XYZ, message: '...' }` na ključne exception-e u `auth`, `users`, `shipments`, `sim-cards`, `meters`, `install-tasks`, `demount-tasks`, `installation-records`.

### 2.4 Case-Insensitive Search & Prisma Query Consistency (P3)
- Provjeriti i dodati `mode: 'insensitive'` na sve tekstualne `contains` pretrage gdje nedostaje (`shipments`, `meters`, `users`, `activity-log`), te provjeriti da li su potrebni dodatni indeksi u `schema.prisma` (npr. `InstallationRecord.createdAt`, `ActivityLog(entity, entityId)`).
