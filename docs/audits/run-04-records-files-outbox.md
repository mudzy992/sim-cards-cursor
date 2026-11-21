# Audit Run 4 — Terenski zapisnici, upload slika, serviranje fajlova i offline outbox (`installation-records` + `photo-upload` + `files` + `mobile/outbox`)

**Obuhvaćeni moduli:** `installation-records` (`installation-records.controller.ts`, `installation-records.service.ts`, `photo-upload.service.ts`, `status-transition.guard.ts`, `dto/*`), `files` (`files.controller.ts`), web (`InstallationRecordsListPage.tsx`, `InstallationRecordDetailPage.tsx`), i mobile (`outbox.ts`, `installation-records.api.ts`, `installation-records-upload.api.ts`).  
**Datum audita:** 2026-11-21 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** Kompletiran audit i prijedlog izmjena — **čeka odobrenje prije izmjena koda**.

---

## 1. Mapa funkcija po osobama (Role Matrix)

### 1.1 `installation-records` & `photo-upload`

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `POST /installation-records` | Kreiranje (bilo koja podružnica) | Kreiranje unutar distribucije (provjera montera i podružnice) | Kreiranje za svoju ili moderiranu podružnicu | Kreiranje za svoju podružnicu (`installedById` forsiran na sebe) | **P0-1:** `USER` sa `branchId` u payloadu za novo brojilo **nije validiran** pa može kreirati brojilo u tuđoj podružnici! **P0-2:** `photos` niz nema provjeru prefiksa `installation-records/` niti traversal zaštite. |
| `POST /installation-records/upload-photo` | Da | Da | Da | Da | **P0-4:** Ne provjerava magic bytes slike (`JPEG`/`PNG`), samo klijentski `mimetype`; Multer limit zakucan na `5 MB` pa ignoriše veći limit iz `Settings`. |
| `GET /installation-records` | Svi zapisnici | Zapisnici svoje distribucije | Zapisnici moderiranih podružnica | Vlastiti zapisnici (`installedById`) | Nema pretrage po `recordNumber`, `serialNumber`, `iccid`, ni `branchId` (P1-1). |
| `GET /installation-records/my` | Vlastiti | Vlastiti | Vlastiti | Vlastiti | Paginirano. |
| `GET /installation-records/:id`, `/:id/timeline`, `/:id/pdf` | Sve | U svojoj distribuciji (`viaMeter`) | U svojoj + moderiranim podružnicama | U svojoj podružnici | `generatePdf` i fire-and-forget `autoSendRecordEmail` mogu paralelno renderovati isti PDF (P1-2). |
| `PATCH /installation-records/:id` | Da (uz `StatusTransitionGuard`) | Da (u svom opsegu) | Ne (403) | Ne (403) | **P0-2:** `UpdateInstallationRecordDto` nasljeđuje `PartialType(CreateInstallationRecordDto)` pa prima nepostojeće/opasne atribute (`meterId`, `simCardId`, `serialNumber`, `demountedMeter`) i omogućava `SEP_ACTIVATED` bez `SimEvent`-a! |
| `DELETE /installation-records/:id` | Briše zapisnik | Ne (403) | Ne (403) | Ne (403) | Ne čisti PDF/fotografije s diska i ne provjerava povezane zadatke (`InstallTask`). |
| `POST :id/mark-sep-activated` | Iz `SENT` | Iz `SENT` u distribuciji | Iz `SENT` za moderiranu podružnicu | Ne (403 u servisu) | Upisuje `SimEvent('SEP_ACTIVATED')`. |
| `POST :id/retry-send` | Iz `SEND_FAILED` | Iz `SEND_FAILED` | Iz `SEND_FAILED` (ako je kreator) | Iz `SEND_FAILED` (ako je kreator) | Šalje ponovo preko `autoSendRecordEmail`. |

### 1.2 `files` (`GET /files/photo?path=...`) & Mobile `outbox`

| Funkcija | Ponašanje u kodu | Nalazi |
|---|---|---|
| `GET /files/photo` | `JwtAuthGuard` + `UploadsStorageService.resolvePath` + `installationRecord.findFirst` provjera po `scopeWhere(..., { viaMeter: true })` | Nedostaju `Cache-Control: private, max-age=300` i `X-Content-Type-Options: nosniff` headeri (P1-2). |
| Mobile `outbox.ts` (`INSTALLATION_RECORD_CREATE`) | Čuva zahtjev u AsyncStorage i šalje ga pri sinhronizaciji | **P0-3:** (1) Za postojeće brojilo (`meterId` bez `serialNumber` u body-ju) upload fotografija **trajno pada** (`Nedostaje serialNumber`); (2) Ako upload fotografija uspije a `POST /installation-records` padne, `item.request.body.photos` nije sačuvan u store-u pa svaki retry **duplira upload fotografija**! |

---

## 2. Analiza po operativnim ulogama (Bottlenecks & Edge Cases)

### Persona 1: `SYSTEM_ADMIN`
- **`PATCH /installation-records/:id` korupcija & 500 greške:** `UpdateInstallationRecordDto` nasljeđuje cijeli `CreateInstallationRecordDto`, pa slanje polja novog brojila (`serialNumber`, `demountedMeter`, `meterTypeDefinitionId`) ruši Prisma `update` sa `500`, dok slanje `simCardId`/`meterId` kvari vezu sa SIM karticom/brojilom, a direktno slanje `{ status: 'SEP_ACTIVATED' }` zaobilazi kreiranje `SimEvent('SEP_ACTIVATED')`.
- **Pretraga zapisnika na webu (`InstallationRecordsListPage`):** Kako baza raste, admin može filtrirati zapisnike samo po `status`, bez pretrage po broju zapisnika, serijskom broju brojila, ICCID-u ili poslovnici.
- **Brisanje zapisnika (`DELETE /installation-records/:id`):** Ostavlja siročad fajlove (PDF i slike) na disku i ne provjerava referencu iz `InstallTask.installationRecordId`.

### Persona 2: `DIST_ADMIN`
- **Paralelni PDF renderi u `create()`:** `create()` okida `autoSendRecordEmail` asinhrono u pozadini; ako admin odmah klikne PDF preview ili preuzimanje, `generatePdf()` može pokrenuti drugi paralelni Puppeteer render prije nego prvi snimi `pdfPath`.
- **Upload fotografija iznad 5 MB:** Čak i kad je u podešavanjima dozvoljeno npr. 10 MB, Multer na controlleru odbija fajl iznad 5 MB prije ulaska u `PhotoUploadService`.

### Persona 3: `BRANCH_MODERATOR`
- **Vlastiti zapisnici moderatora u `findAllForUser`:** Ako je moderator sam kreirao zapisnik u svojoj primarnoj podružnici koja nije na listi njegovih `BranchModerator` dodjela, `findAllForUser` ga ne uključuje jer filtrira isključivo po `branchModerator` listi (treba `OR` sa `installedById: userId`).
- **Scope za `branchId` pri kreiranju:** Bez provjere `branchId` za `USER` ulogu, moderator bi mogao poslati proizvoljan `branchId` van svojih poslovnica.

### Persona 4: `USER` (Terenski monter / Mobile)
- **P0-3 Offline Outbox neuspjeh sa slikama:**
  1. Pri rješavanju `InstallTask`-a ili odabiru postojećeg brojila (`meterId`), u body-ju nema `serialNumber`, pa `outbox.ts` baca grešku pri uploadu priloženih fotografija i zapisnik se nikada ne sinhronizuje!
  2. Pri privremenoj mrežnoj grešci nakon uploada slike, `outbox.ts` nije perzistirao već uploadovane putanje (`photos`) i nije ispraznio `localPhotoUris`, pa sljedeći pokušaj opet uploaduje iste fotografije na server.
- **Magic bytes zaštita (`PhotoUploadService`):** Nedostaje validacija stvarnog binarnog zaglavlja JPEG/PNG fajla.

---

## 3. Konkretni prijedlozi za unapređenje i ubrzanje

### Paket A — Kritične ispravke sigurnosti i offline pouzdanosti (P0)
1. **P0-1 (`InstallationRecordsService.create` — autorizacija `branchId` i validacija `photos`):**
   - Za `ctx.role === UserRole.USER`: ako je proslijeđen `branchId`, provjeriti da je u skupu `[ctx.branchId, ...ctx.branchModeratorBranchIds]`; inače baciti `ForbiddenException`.
   - Validirati svaku stavku u `dto.photos`: mora biti string koji počinje sa `installation-records/`, ne sadrži `..`, `\` niti `\0` (`BadRequestException` ako je neispravan).
   - Kod `kind === NEW_CONNECTION` na postojećem `meterId`: ako brojilo već ima drugu `simCardId`, odbiti s jasnom porukom (`Brojilo već ima ugrađenu SIM karticu; koristite zamjenu/demontažu`) umjesto tihog `DEMOUNTED` prepisivanja.
2. **P0-2 (`UpdateInstallationRecordDto` & `StatusTransitionGuard`):**
   - Sužiti `UpdateInstallationRecordDto` isključivo na dozvoljena polja (`notes`, `photos`, eventualno `status`), a u `StatusTransitionGuard` / `update()` zabraniti direktan prelaz na `SEP_ACTIVATED` preko `PATCH` (mora ići preko `POST :id/mark-sep-activated` kako bi se upisao `SimEvent('SEP_ACTIVATED')`).
3. **P0-3 (`mobile/src/offline/outbox.ts` & `installation-records.api.ts` — atomični foto-upload u outboxu):**
   - Dodati opcionalni `meta.serialNumber` u `OutboxItem` (i proslijediti ga iz `queueInstallationRecord` i task formi); ako nedostaje na postojećem `meterId` itemu, fallbackovati na `metersApi` ili `meta.serialNumber` prije odbijanja.
   - Nakon svakog uspješnog uploada jedne fotografije u `sendOne()`, odmah perzistirati ažurirani `request.body.photos` i ukloniti taj URI iz `meta.localPhotoUris` u `outbox` store-u — tako retry nakon mrežne greške **nikada** ne uploaduje istu sliku dvaput!
4. **P0-4 (`PhotoUploadService` magic-bytes provjera + Multer limit):**
   - Provjeriti binarni potpis buffera (`FF D8 FF` za JPEG, `89 50 4E 47 0D 0A 1A 0A` za PNG) u `PhotoUploadService.save` bez oslanjanja samo na `file.mimetype`.
   - Podići Multer gornji limit u `InstallationRecordsController.uploadPhoto` na `50 * 1024 * 1024` kako bi dinamički limit iz `SettingsService` (`uploads.max_photo_size_mb`, 1–50 MB) zaista radio!

### Paket B — Ubrzanje, pretraga i UX poboljšanja (P1)
5. **P1-1 (`InstallationRecordFilterDto` + `InstallationRecordsService` + `InstallationRecordsListPage`):**
   - Dodati opcionalne filtere `search` (`recordNumber`, `meter.serialNumber`, `meter.simCard.iccid` sa `mode: 'insensitive'`) i `branchId` (`UUID`) na backend (`InstallationRecordFilterDto` + `findManyWithFilter`) i na web `InstallationRecordsListPage.tsx`.
   - U `findAllForUser` za moderatora uključiti i vlastite zapisnike: `OR: [{ meter: { branchId: { in: branchIds } } }, { installedById: userId }]`.
6. **P1-2 (`FilesController.servePhoto` + PDF dedup lock):**
   - Na `GET /files/photo` dodati `Cache-Control: private, max-age=300` i `X-Content-Type-Options: nosniff` za brže učitavanje galerije i zaštitu MIME sniffing-a.
   - U `InstallationRecordsService.generatePdf`: dodati in-process `inFlightPdfByRecordId` mapu obećanja tako da dva paralelna zahtjeva za isti zapisnik (npr. background email + ručni download) dijele isti render umjesto duplog pokretanja Puppeteer-a!

### Paket C — Čistoća i upravljanje životnim ciklusom (P2)
7. **P2-1 (`InstallationRecordsService.remove`):**
   - Pri brisanju zapisnika (`SYSTEM_ADMIN`), provjeriti da nije vezan za `InstallTask` (ili otkačiti referencu u transakciji), i ukloniti `pdfPath` fajl preko `UploadsStorageService` (uz sigurnu provjeru ako ga niko drugi ne dijeli).
8. **P2-2 (`InstallationRecordsService` indeksiranje / tipizacija):**
   - Dodati Prisma indeks `@@index([createdAt])` i `@@index([installedById])` na `InstallationRecord` radi bržeg sortiranja i "Moji zapisnici" upita na mobilnoj aplikaciji.
