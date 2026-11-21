# Audit Run 6 — Email, primaoci, notifikacije i push kampanje (`mail` + `branch-email-recipients` + `notifications` + `push-tokens` + `push-campaigns`)

**Obuhvaćeni moduli:** `mail` (`mail.controller.ts`, `mail.service.ts`, `dto/mail.dto.ts`), `branch-email-recipients` (`branch-email-recipients.controller.ts`, `branch-email-recipients.service.ts`), `notifications` (`notifications.controller.ts`, `notifications.service.ts`, `notifications.gateway.ts`, `dto/notifications-query.dto.ts`), `push-tokens` (`push-tokens.controller.ts`, `push-tokens.service.ts`), i `push-campaigns` (`push-campaigns.controller.ts`, `push-campaigns.service.ts`, `push-receipts.poller.ts`, `dto/*`).  
**Datum audita:** 2026-11-21 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** **Paketi A + B + C implementirani i verifikovani**.

---

## 1. Mapa funkcija po osobama (Role Matrix)

| Modul / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Nalazi iz koda |
|---|---|---|---|---|---|
| `mail/*` (`templates`, `preview`, `test`) | Pun pristup | Ne (403) | Ne (403) | Ne (403) | **P0-3:** `updateTemplate` ne validira Handlebars sintaksu prije snimanja u DB; `nodemailer` transport nema connection/socket timeouta. |
| `branch-email-recipients/*` | Sve podružnice | Svoje podružnice (`distributionId`, fail-closed) | Ne (403) | Ne (403) | **P2-1:** Nema prevencije duplog emaila unutar iste podružnice (`branchId + email`); `BranchEmailRecipient` nema unique/composite indeks. |
| `notifications/*` & WS `/notifications` | Vlastite notifikacije | Vlastite notifikacije | Vlastite notifikacije | Vlastite notifikacije | **P1-1:** `NotificationsGateway.handleConnection` prihvata bilo koji JWT potpisan s `JWT_SECRET` bez provjere da li je korisnik `ACTIVE`. **P1-2:** `NotificationsService.create` radi pojedinačni `AppSetting` query po korisniku — kod slanja kampanje za N korisnika okida N upita umjesto batch/bulk operacije. |
| `push-tokens/register`, `/invalidate` | Da | Da | Da | Da | **P1-2:** `RegisterPushTokenDto` nema `@IsNotEmpty()` / `@MaxLength()` provjere; `PushTokensService.register` može prebaciti tuđi `token` na novog korisnika bez validacije ili ograničenja. |
| `push-campaigns/*` | Sve kampanje | Svoje kampanje (`scopeDistributionId`) | Ne (403) | Ne (403) | **P0-1:** `assertCampaignScope` propušta globalne (`scopeDistributionId = null`) kampanje `SYSTEM_ADMIN`-a ka `DIST_ADMIN`-u (IDOR + pregled tuđih korisnika/tokena + neovlašteno slanje)! `list()` nije fail-closed kad `DIST_ADMIN` nema `distributionId`. **P0-2:** `sendCampaign` nema atomični `DRAFT -> SENDING` lock (dvostruko slanje); `recipients` prima nevalidirane `page`/`limit`; `resolveRecipientUsers` uključuje neaktivne korisnike. |

---

## 2. Analiza po operativnim ulogama (Bottlenecks & Edge Cases)

### Persona 1: `SYSTEM_ADMIN`
- **Slomljen email template ruši slanje svih SEP zapisnika (`MailService.updateTemplate`):** Admin može u `EmailSettingsPage` sačuvati neispravan Handlebars template (npr. nezatvoren tag `{{#if}}`) jer `updateTemplate` snima tekst u `AppSetting` bez kompajliranja/validacije, pa kasnije svaki zapisnik puca u `autoSendRecordEmail`.
- **Visoka latencija `sendCampaign` za veći broj korisnika:** `PushCampaignsService.sendCampaign` poziva `Promise.all(recipients.map(u => notifications.create(...)))`, što za 500 korisnika otvara 500 pojedinačnih `AppSetting` upita + 500 `Notification` `INSERT`-a + 500 socket emit-a odjednom.
- **Neispravan SMTP može blokirati workere:** `nodemailer.createTransport` nema definisane `connectionTimeout`, `greetingTimeout`, ni `socketTimeout`.

### Persona 2: `DIST_ADMIN`
- **P0-1 IDOR na globalne kampanje `SYSTEM_ADMIN`-a:** U `PushCampaignsService.assertCampaignScope`, uslov `if (campaign.scopeDistributionId && campaign.scopeDistributionId !== actor.distributionId)` ignoriše kampanje gdje je `scopeDistributionId === null` (sve kampanje koje je kreirao `SYSTEM_ADMIN`)! `DIST_ADMIN` može pozvati `GET /push-campaigns/:id`, `GET :id/stats`, `GET :id/recipients` (i vidjeti emailove/tokene korisnika iz drugih distribucija!) ili čak `POST :id/send` nad globalnom kampanjom!
- **P0-1 Fail-open na `list()`:** Ako `DIST_ADMIN` nema `distributionId`, `list()` vraća sve kampanje umjesto prazne liste (ili `ForbiddenException`).
- **P0-2 Dvostruko slanje kampanje & neograničeni `recipients` upit:** Paralelni `POST :id/send` zahtjevi mogu proći `campaign.status !== DRAFT` prije nego prvi upiše `SENDING`; `GET :id/recipients` nema `PaginationDto` (`@Max(100)`) i pri `limit=NaN` ili prevelikom broju ruši ili preopterećuje upit.

### Persona 3 & 4: `BRANCH_MODERATOR` & `USER` (Terenski monter)
- **WebSocket notifikacije za suspendovane/deaktivirane korisnike (`NotificationsGateway`):** Token koji je potpisan prije deaktivacije korisnika i dalje otvara `/notifications` WebSocket dok ne istekne jer gateway ne provjerava status korisnika u bazi (niti tip tokena).
- **Push kampanje ka neaktivnim nalozima:** `resolveRecipientUsers()` ne filtrira `status: UserStatus.ACTIVE`, pa se troše Expo push kvote i prave neuspjele dostave ka ugašenim korisnicima.
- **Nevalidan `deepLink` / `filters` u `CreatePushCampaignDto`:** `deepLink` može biti proizvoljan URL umjesto relativne app putanje.

---

## 3. Konkretni prijedlozi za unapređenje i ubrzanje

### Paket A — Kritične sigurnosne i konkurentne ispravke (P0)
1. **P0-1 (`PushCampaignsService` scope & aktivni primaoci):**
   - U `assertCampaignScope`: za `DIST_ADMIN` zahtijevati `campaign.scopeDistributionId === actor.distributionId` (strogo jednako — nikad `null`!).
   - U `list()`: za `DIST_ADMIN` bez `distributionId` vratiti praznu listu (`items: [], total: 0`) fail-closed.
   - U `resolveRecipientUsers`: dodati `status: UserStatus.ACTIVE` na sve upite korisnika.
2. **P0-2 (`PushCampaignsService.sendCampaign` atomični lock + paginacija + sanitizacija):**
   - Zamijeniti `if (campaign.status !== DRAFT)` + `update` atomičnim `updateMany({ where: { id, status: PushCampaignStatus.DRAFT }, data: { status: PushCampaignStatus.SENDING } })`; ako je `count === 0`, baciti `BadRequestException('Campaign already sent or sending')`.
   - U `PushCampaignsController.recipients`: uvesti `PaginationDto` (`@Max(100)`) umjesto sirovih `parseInt` stringova, i izostaviti sirovi Expo `token` iz odgovora ili ga maskirati ako nije potreban UI-u (provjeriti `PushCampaignsPage.tsx` prije maskiranja!).
   - U `CreatePushCampaignDto` / `validateCreate`: validirati `deepLink` ako je proslijeđen (mora počinjati sa `/` ili `simtracker://`, bez `javascript:`).
3. **P0-3 (`MailService` validacija šablona & SMTP timeouti):**
   - U `updateTemplate`: kompajlirati sadržaj pomoću `Handlebars.compile(value, { strict: true })` (i opciono testno renderovanje ili bar sintaksna provjera `Handlebars.precompile(value)`) prije upisa u `AppSetting` — ako sintaksa nije validna, baciti `BadRequestException`.
   - U `getSmtpTransport()`: dodati `connectionTimeout: 10_000`, `greetingTimeout: 10_000`, `socketTimeout: 20_000` u `nodemailer.createTransport`.
   - U `sendRecordWithPdf`: deduplicirati `recipients` (`[...new Set(...)]`), trimovati i preskočiti prazan niz s jasnim warningom.

### Paket B — Performanse, bulk operacije i WebSocket hardening (P1)
4. **P1-1 (`NotificationsGateway` & `NotificationsService`):**
   - U `NotificationsGateway.handleConnection`: asinhrono provjeriti u `PrismaService` da je korisnik `ACTIVE` (`status === UserStatus.ACTIVE`), te da `this.server` postoji u `sendToUser`.
   - Dodati `NotificationsService.createBulk(dtos)` koji jednim pozivom provjeri `inAppEnabled`, uradi `prisma.notification.createMany` + `findMany`/emit ili sekvencijalno bez duplog čitanja `SettingsService` u `PushCampaignsService.sendCampaign` (smanjuje 500 `AppSetting` upita na 1!).
5. **P1-2 (`PushTokensController` & `PushTokensService`):**
   - Izdvojiti `RegisterPushTokenDto` / `InvalidatePushTokenDto` s `@IsNotEmpty()`, `@MaxLength(512)` na `token`, i `@MaxLength(32)` na `platform`/`deviceId` (`@IsOptional()`).
   - Ograničiti `NotificationsService.findByUser` `limit` na `[1, 100]` i na servisnom nivou.

### Paket C — Integritet podataka, indeksi i testovi (P2)
6. **P2-1 (`BranchEmailRecipientsService` + Prisma indeksi):**
   - U `BranchEmailRecipientsService.create` i `update`: uhvatiti Prisma `P2002` (ili provjeriti duplikat `branchId + email`) i baciti `ConflictException` / `BadRequestException` umjesto `500`.
   - Prisma schema + migracija: `@@unique([branchId, email])` na `BranchEmailRecipient` (uz bezbjednu deduplikaciju / provjeru u migraciji ili provjeru na servisnom nivou ako bi migracija mogla pasti na postojećim duplikatima — sigurnije `@@index([branchId, isActive])` + provjera u servisu!) i `@@index([userId, isRead, createdAt])` na `Notification`, `@@index([userId, isValid])` na `PushToken`, `@@index([campaignId, status])` na `PushDelivery`.
7. **P2-2 (Unit testovi):**
   - Dodati unit testove (`push-campaigns.service.spec.ts`, `mail.service.spec.ts`, `notifications.service.spec.ts`, `branch-email-recipients.service.spec.ts`) koji pokrivaju cross-distribution `DIST_ADMIN` blokadu nad globalnom kampanjom, atomični `sendCampaign` lock, Handlebars template sintaksnu provjeru, bulk notifikacije i duplicate email provjeru.

---

## 4. Sažetak implementacije (Paketi A + B + C)

- **Backend (`push-campaigns`, `mail`, `notifications`, `push-tokens`, `branch-email-recipients`, `prisma`):**
  - **Push campaigns (P0-1, P0-2):** `assertCampaignScope` strogo zahtijeva `campaign.scopeDistributionId === actor.distributionId` za `DIST_ADMIN` (blokira pristup globalnim kampanjama `SYSTEM_ADMIN`-a); `list()` je fail-closed kad `DIST_ADMIN` nema `distributionId`; `resolveRecipientUsers` filtrira isključivo `status: UserStatus.ACTIVE`; `sendCampaign` koristi atomični `DRAFT -> SENDING` lock (`updateMany`); `recipients` endpoint koristi `PaginationDto` (`@Max(100)`) i ne vraća sirovi Expo `token`; `deepLink` validiran na `/` ili `simtracker://`.
  - **Mail (P0-3):** `updateTemplate` provjerava sintaksu putem `Handlebars.precompile` prije snimanja u `AppSetting`; `getSmtpTransport` dodaje `connectionTimeout` / `greetingTimeout` / `socketTimeout`; `sendRecordWithPdf` i `sendMail` dedupliciraju i trimuju primaoce.
  - **Notifications & WebSocket (P1-1, P1-2):** `NotificationsGateway.handleConnection` provjerava tip tokena i da je korisnik `UserStatus.ACTIVE` u bazi (uz null-provjeru `this.server` u `sendToUser`); `NotificationsService.createBulk` jednim upitom provjerava `inAppEnabled` i koristi `createMany` + socket emit (korišteno u `PushCampaignsService.sendCampaign`); `findByUser` clampuje `limit` na `[1, 100]`.
  - **Push tokens (P1-2):** `RegisterPushTokenDto` / `InvalidatePushTokenDto` dopunjeni s `@IsNotEmpty()`, `@MaxLength()` i trimovanjem tokena u servisu.
  - **Branch email recipients (P2-1):** Prevencija duplikata (`branchId + email`) s `ConflictException` umjesto `500`.
  - **Prisma migracija `20261121040000_add_messaging_indexes` (P2-1):** Indeksi na `Notification(userId, isRead, createdAt)`, `PushToken(userId, isValid)`, `PushDelivery(campaignId, status)`, `BranchEmailRecipient(branchId, isActive)`.
- **Frontend (`PushCampaignsPage.tsx`):** `recipients` upit ograničen na `limit: 100` u skladu s `PaginationDto`.
- **Verifikacija:**
  - `backend`: `nest build`, `eslint`, `jest` (**20/20 suites, 102/102 tests** uključujući 4 nova spec fajla za Run 6).
  - `frontend`: `tsc --noEmit`, `eslint`, `check:i18n` (**1067 ključeva**), `check:ui` (**141 fajl**), `vitest` (**9/9 suites, 30/30 tests**), `vite build`.
  - `mobile`: `tsc --noEmit`, `eslint`, `jest` (**2/2 suites, 8/8 tests**).
