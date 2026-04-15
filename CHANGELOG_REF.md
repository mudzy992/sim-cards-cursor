# SIM Tracker v2 - Changelog Reference (Faze 1-2)

> Handover dokument za nastavak implementacije u sljedecoj sesiji.
> Migracija `20260415120000_v2_workflow_update` je primjenjena rucno na bazu.

---

## 1. Enum promjene

### UserRole (tabela `users`, kolona `role`)

| Prije                          | Poslije                       |
|--------------------------------|-------------------------------|
| `SYSTEM_ADMIN, MODERATOR, USER` | `SYSTEM_ADMIN, DIST_ADMIN, USER` |

- `MODERATOR` je preimenovan u `DIST_ADMIN` (administrator distribucije).
- Svi postojeci korisnici sa `MODERATOR` su migrirani na `DIST_ADMIN`.

### RecordStatus (tabela `installation_records`, kolona `status`)

| Prije                                                                                           | Poslije                                                    |
|-------------------------------------------------------------------------------------------------|------------------------------------------------------------|
| `DRAFT, PENDING, SUBMIT_FAILED, REJECTED, WAITING_SEP_ACTIVATION, ACTIVATED_IN_SEP, SENT` | `DRAFT, SENT, SEND_FAILED, SEP_ACTIVATED, LEGACY_COMPLETED` |

- Uklonjeni statusi vezani za approval workflow: `PENDING`, `SUBMIT_FAILED`, `REJECTED`, `WAITING_SEP_ACTIVATION`, `ACTIVATED_IN_SEP`.
- Dodani novi statusi: `SEND_FAILED` (email slanje neuspjesno), `SEP_ACTIVATED` (moderator podruznice oznacio), `LEGACY_COMPLETED` (migrirani stari zapisi).
- Svi postojeci zapisi u uklonjenim statusima su migrirani na `LEGACY_COMPLETED`.

### MeterFieldType (novi enum)

```
STRING | NUMBER | BOOLEAN | DATE
```

Koristi se za `meter_type_fields.field_type`.

---

## 2. Nove tabele

### `branch_moderators`

Mapira USER-a kao moderatora jedne ili vise podruznica. DIST_ADMIN dodjeljuje ovu sub-rolu.

| Kolona      | Tip           | Opis                         |
|-------------|---------------|------------------------------|
| `id`        | VARCHAR(191)  | PK, UUID                     |
| `user_id`   | VARCHAR(191)  | FK -> `users.id`, CASCADE    |
| `branch_id` | VARCHAR(191)  | FK -> `branches.id`, CASCADE |
| `created_at`| DATETIME(3)   | Default CURRENT_TIMESTAMP    |

- Unique constraint: `(user_id, branch_id)`
- Index na `user_id` i `branch_id`

### `branch_email_recipients`

Email adrese po podruznici na koje se automatski salje zapisnik nakon kreiranja.

| Kolona      | Tip           | Opis                         |
|-------------|---------------|------------------------------|
| `id`        | VARCHAR(191)  | PK, UUID                     |
| `branch_id` | VARCHAR(191)  | FK -> `branches.id`, CASCADE |
| `email`     | VARCHAR(191)  | Email adresa primatelja      |
| `label`     | VARCHAR(191)  | Opcionalni label/opis        |
| `is_active` | BOOLEAN       | Default `true`               |
| `created_at`| DATETIME(3)   | Default CURRENT_TIMESTAMP    |
| `updated_at`| DATETIME(3)   | Auto-update                  |

- Index na `branch_id`

### `meter_type_fields`

Dinamicka polja po tipu brojila. System admin definise, operator popunjava na terenu.

| Kolona                      | Tip                                    | Opis                                  |
|-----------------------------|----------------------------------------|---------------------------------------|
| `id`                        | VARCHAR(191)                           | PK, UUID                              |
| `meter_type_definition_id`  | VARCHAR(191)                           | FK -> `meter_type_definitions.id`, CASCADE |
| `name`                      | VARCHAR(191)                           | Kljuc polja (npr. "vt", "mt")         |
| `label`                     | VARCHAR(191)                           | Display label (npr. "VT", "MT")       |
| `field_type`                | ENUM('STRING','NUMBER','BOOLEAN','DATE') | Tip podatka                          |
| `is_required`               | BOOLEAN                                | Default `false`                       |
| `is_operator_fillable`      | BOOLEAN                                | `true` = operator unosi na terenu     |
| `default_value`             | VARCHAR(191)                           | Opciona default vrijednost            |
| `sort_order`                | INTEGER                                | Default 0, za redoslijed prikaza      |
| `created_at`                | DATETIME(3)                            | Default CURRENT_TIMESTAMP             |
| `updated_at`                | DATETIME(3)                            | Auto-update                           |

- Index na `meter_type_definition_id`

---

## 3. Izmjene na postojecim tabelama

### `meters` - nova kolona

| Kolona                | Tip  | Opis                                        |
|-----------------------|------|---------------------------------------------|
| `dynamic_field_values`| JSON | Dinamicke vrijednosti polja za konkretan brojilo |

### `branches` - nove relacije (samo Prisma schema, bez DDL)

- `emailRecipients` -> `BranchEmailRecipient[]`
- `branchModerators` -> `BranchModerator[]`

### `users` - nova relacija (samo Prisma schema, bez DDL)

- `branchModeratorRoles` -> `BranchModerator[]`

### `meter_type_definitions` - nova relacija (samo Prisma schema, bez DDL)

- `fields` -> `MeterTypeField[]`

---

## 4. Migracija

Fajl: `backend/prisma/migrations/20260415120000_v2_workflow_update/migration.sql`

Migracija se izvrsava u 6 koraka:
1. UserRole enum rename (3-step ALTER za MySQL)
2. RecordStatus enum simplifikacija (3-step ALTER + UPDATE)
3. `meters.dynamic_field_values` JSON kolona
4. `branch_moderators` tabela + FK + indeksi
5. `branch_email_recipients` tabela + FK + indeksi
6. `meter_type_fields` tabela + FK + indeksi

---

## 5. Backend source - izmijenjeni fajlovi (28 fajlova)

### Globalni rename: `MODERATOR` -> `DIST_ADMIN`

Svaki fajl koji je koristio `UserRole.MODERATOR` ili string `'MODERATOR'` je azuriran:

| Fajl                                              | Vrsta promjene                       |
|---------------------------------------------------|--------------------------------------|
| `src/common/utils/scope-filter.util.ts`           | `'MODERATOR'` -> `'DIST_ADMIN'` u role checks i JSDoc |
| `src/modules/activity-log/activity-log.controller.ts` | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/analytics/analytics.controller.ts`   | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/branches/branches.controller.ts`     | `'MODERATOR'` -> `'DIST_ADMIN'` (string literals) |
| `src/modules/dashboard/dashboard.controller.ts`   | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/demount-tasks/demount-tasks.controller.ts` | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/demount-tasks/demount-tasks.service.ts` | `'MODERATOR'` -> `'DIST_ADMIN'` |
| `src/modules/distributions/distributions.controller.ts` | `UserRole.MODERATOR` + `'MODERATOR'` -> `DIST_ADMIN` |
| `src/modules/meter-type-definitions/meter-type-definitions.controller.ts` | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/meters/meters.controller.ts`         | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/notifications/notifications.controller.ts` | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/push-campaigns/push-campaigns.controller.ts` | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/push-campaigns/push-campaigns.service.ts` | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/push-tokens/push-tokens.controller.ts` | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/recipients/recipients.controller.ts` | `UserRole.MODERATOR` + `'MODERATOR'` -> `DIST_ADMIN` |
| `src/modules/recipients/recipients.service.ts`    | `UserRole.MODERATOR` + `'MODERATOR'` -> `DIST_ADMIN` |
| `src/modules/settings/settings.controller.ts`     | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/shipments/shipments.controller.ts`   | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/shipments/shipments.service.ts`      | `'MODERATOR'` -> `'DIST_ADMIN'` |
| `src/modules/sim-cards/sim-cards.controller.ts`   | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |
| `src/modules/users/users.controller.ts`           | `UserRole.MODERATOR` -> `UserRole.DIST_ADMIN` |

### Workflow promjene (installation-records modul)

| Fajl | Promjena |
|------|----------|
| `installation-records.service.ts` | **Uklonjene metode:** `approve()`, `reject()`, `submitForApproval()`, `activateInSep()`, `isUserApprovalOperator()`. **Dodane metode:** `markSepActivated()`, `retrySendEmail()`, `autoSendRecordEmail()`, `isBranchModerator()`. **Izmijenjene metode:** `create()` (sada poziva `autoSendRecordEmail()` asinhrono nakon kreacije), `getPermissions()` (vraca `canRetrySend` i `canMarkSepActivated` umjesto starih approval permisija), `findAllForUser()` (koristi `BranchModerator` tabelu umjesto `BranchApprovalGroup`), `findManyWithFilter()` (prima opcionalni `additionalWhere` parametar). **Uklonjene zavisnosti:** `RecipientsService`, `NotificationsService`. |
| `installation-records.controller.ts` | **Uklonjeni endpointi:** `POST :id/approve`, `POST :id/reject`, `POST :id/submit-for-approval`, `POST :id/send`, `POST :id/activate-sep`. **Dodani endpointi:** `POST :id/mark-sep-activated`, `POST :id/retry-send`. **Uklonjeni importi:** `RejectionReasonDto`, `SendRecordDto`. |
| `installation-records.module.ts` | Uklonjeni importi: `RecipientsModule`, `NotificationsModule`. |
| `guards/status-transition.guard.ts` | Nova mapa tranzicija: `DRAFT -> [SENT, SEND_FAILED]`, `SEND_FAILED -> [SENT, SEND_FAILED]`, `SENT -> [SEP_ACTIVATED]`, `SEP_ACTIVATED -> []`, `LEGACY_COMPLETED -> []`. |
| `installation-records.service.spec.ts` | Uklonjeni testovi za approval workflow. Azurirani preostali testovi za nove statuse. |

### Analytics modul

| Fajl | Promjena |
|------|----------|
| `analytics.service.ts` | `RecordStatus.ACTIVATED_IN_SEP` -> `RecordStatus.SEP_ACTIVATED` u `collectActivationSamples()`. |

---

## 6. Novi workflow zapisnika

```
DRAFT  ──(auto)──>  SENT  ──(branch moderator)──>  SEP_ACTIVATED
  │                                                     (terminalni)
  └──(email fail)──>  SEND_FAILED  ──(retry)──>  SENT
```

- Kreiranje zapisnika (`POST /installation-records`) automatski pokrece generisanje PDF-a i slanje emaila na adrese konfigurisane za podruznicu (tabela `branch_email_recipients`).
- Ako email slanje ne uspije, status postaje `SEND_FAILED` (moze se ponovo pokusati preko `POST :id/retry-send`).
- Ako nema konfigurisanih email adresa za podruznicu, zapisnik prelazi u `SENT` bez slanja (sa warningom u activity logu).
- Moderator podruznice (ili admin) moze oznaciti zapisnik kao `SEP_ACTIVATED` za evidenciju i analitiku.

---

## 7. Faza 2: Backend - Role & Scope Updates

### Novi modul: `branch-moderators`

Omogucava DIST_ADMIN-u (i SYSTEM_ADMIN-u) dodjelu/uklanjanje branch moderator prava korisnicima sa USER rolom.

| Fajl | Opis |
|------|------|
| `src/modules/branch-moderators/branch-moderators.module.ts` | NestJS modul; importa `PrismaModule`, exporta `BranchModeratorsService` |
| `src/modules/branch-moderators/branch-moderators.controller.ts` | REST endpointi sa `JwtAuthGuard` + `RolesGuard` |
| `src/modules/branch-moderators/branch-moderators.service.ts` | CRUD logika sa scope validacijom |
| `src/modules/branch-moderators/dto/assign-branch-moderator.dto.ts` | DTO za assign operaciju |

**Endpointi:**

| Metoda | Ruta | Roles | Opis |
|--------|------|-------|------|
| `POST` | `/branch-moderators` | `SYSTEM_ADMIN`, `DIST_ADMIN` | Dodijeli usera kao moderatora podruznice |
| `DELETE` | `/branch-moderators/:id` | `SYSTEM_ADMIN`, `DIST_ADMIN` | Ukloni moderatorski pristup |
| `GET` | `/branch-moderators` | `SYSTEM_ADMIN`, `DIST_ADMIN` | Lista svih, filtriranje po `?branchId=` ili `?userId=` |

**Scope pravila:**
- `SYSTEM_ADMIN`: vidi/upravlja svim branch moderator zapisima
- `DIST_ADMIN`: vidi/upravlja samo zapisima za podruznice unutar svoje distribucije
- Samo korisnici sa `USER` rolom mogu biti dodijeljeni kao branch moderatori

### Azuriran: `ScopeContext` i `scopeWhere` utility

| Fajl | Promjena |
|------|----------|
| `src/common/utils/scope-filter.util.ts` | Dodan `branchModeratorBranchIds?: string[]` na `ScopeContext`. Za USER-a koji je branch moderator, scope sada obuhvata sve dodijeljene podruznice (OR po branchId). Novi helper `buildMultiBranchWhere()` za multi-branch queries. Exportan novi tip `ScopeWhereOptions`. |

### Azuriran: JWT strategija i auth

| Fajl | Promjena |
|------|----------|
| `src/common/interfaces/jwt-payload.interface.ts` | Dodan `branchModeratorBranchIds?: string[]` na `JwtPayload` |
| `src/modules/auth/strategies/jwt.strategy.ts` | `validate()` sada ucitava `branchModerator` zapise za USER-a i dodaje `branchModeratorBranchIds` na `request.user` |
| `src/modules/auth/auth.service.ts` | `SafeUser` tip prosiren sa `branchModeratorBranchIds`. Nova privatna metoda `loadBranchModeratorIds()`. Metode `login()`, `refresh()`, `profile()`, `validateUser()` sada vracaju `branchModeratorBranchIds` u user objektu. |

### Azurirani user-facing stringovi

| Fajl | Promjena |
|------|----------|
| `src/modules/push-campaigns/push-campaigns.service.ts` | `"Moderator distribution scope is missing"` -> `"Distribution admin scope is missing"`. `"Missing moderator distribution"` -> `"Missing distribution admin scope"`. |
| `src/modules/recipients/recipients.service.ts` | 4 poruke: `"Moderator može..."` -> `"Admin distribucije može..."` |
| `src/modules/auth/dto/register.dto.ts` | API example email: `moderator@simtracker.local` -> `user@simtracker.local` |

### Registracija u `app.module.ts`

| Fajl | Promjena |
|------|----------|
| `src/app.module.ts` | Dodan import i registracija `BranchModeratorsModule` |

---

## 8. Cleanup: Uklanjanje starog Recipients sistema

Stari approval-based recipients sistem je u potpunosti uklonjen. Zamijenjen je novim `branch_email_recipients` + `branch_moderators` tabelama.

### Uklonjena Prisma schema

| Entitet | Tip | Opis |
|---------|-----|------|
| `RecipientGroupType` | Enum | `APPROVAL`, `PDF` |
| `RecipientGroup` | Model | Tabela `recipient_groups` |
| `RecipientGroupUser` | Model | Tabela `recipient_group_users` |
| `BranchApprovalGroup` | Model | Tabela `branch_approval_groups` |
| `Recipient` | Model | Tabela `recipients` |

Uklonjene relacije sa drugih modela:
- `Distribution.recipientGroups` -> `RecipientGroup[]`
- `Branch.approvalGroupMapping` -> `BranchApprovalGroup?`
- `User.recipientGroups` -> `RecipientGroupUser[]`

### Migracija

Fajl: `backend/prisma/migrations/20260415140000_remove_old_recipients/migration.sql`

```sql
DROP TABLE IF EXISTS `branch_approval_groups`;
DROP TABLE IF EXISTS `recipient_group_users`;
DROP TABLE IF EXISTS `recipients`;
DROP TABLE IF EXISTS `recipient_groups`;
```

### Uklonjeni backend fajlovi

| Fajl/Direktorij | Opis |
|-----------------|------|
| `src/modules/recipients/` (cijeli direktorij) | `RecipientsModule`, `RecipientsController`, `RecipientsService`, 6 DTOs |
| `src/modules/installation-records/dto/send-record.dto.ts` | Orphaned DTO (stari send endpoint) |
| `src/modules/installation-records/dto/rejection-reason.dto.ts` | Orphaned DTO (stari reject endpoint) |

### Azurirani fajlovi

| Fajl | Promjena |
|------|----------|
| `src/app.module.ts` | Uklonjen import i registracija `RecipientsModule` |
| `src/modules/installation-records/installation-records.service.spec.ts` | Uklonjeni mock za `RecipientsService` i `NotificationsService`. Dodani mockovi za `branchModerator` i `branchEmailRecipient` Prisma delegate. |

### Napomena za frontend

- Frontend `src/api/recipients.api.ts` i `src/pages/recipients/RecipientsPage.tsx` jos postoje -- ukloniti u Fazi 6.
- `InstallationRecordDetailPage.tsx` referencira `recipientsApi` -- azurirati u Fazi 6.

---

## 9. Sta je ostalo za implementaciju (Faze 3-7)

| Faza | Opis | Status |
|------|------|--------|
| 3 | Backend: Kreiranje `BranchEmailRecipients` modula (CRUD) | Pending |
| 4 | Backend: Dynamic meter fields - CRUD za `MeterTypeField`, validacija pri kreaciji brojila, update PDF generatora | Pending |
| 5 | Backend: Import permisije za DIST_ADMIN, analytics scope update | Done |
| 6 | Frontend: Rename role, update router/sidebar, nove stranice, ukloniti stari recipients UI | Pending |
| 7 | Mobile: Update auth tipova, simplify create-record flow, dynamic meter fields u formi | Pending |

### Napomene za nastavak

- Frontend i Mobile aplikacije jos koriste `MODERATOR` u tipovima i UI-u -- to se rjesava u Fazama 6 i 7.
- `seed.ts` ne referencira `MODERATOR`, ne zahtijeva promjene.

---

## 10. Verifikacija (nakon Faze 2 + cleanup)

| Provjera | Rezultat |
|----------|----------|
| `prisma validate` | Valid |
| `prisma generate` | Prisma Client v5.22.0 generisan |
| `tsc --noEmit` | 0 gresaka |
| `jest` | 5/5 test suites, 5 testova proslo |
