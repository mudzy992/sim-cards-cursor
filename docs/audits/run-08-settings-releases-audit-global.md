# Audit Run 8 — `settings`, `app-releases`, `activity-log`, `packages/shared` & Globalna sigurnost

**Obuhvaćeni moduli:** `settings` (`settings.controller.ts`, `settings.public.controller.ts`, `settings.service.ts`, `settings-keys.ts`, `dto/*`), `app-releases` (`app-releases.controller.ts`, `app-releases.service.ts`, `dto/*`), `activity-log` (`activity-log.controller.ts`, `activity-log.service.ts`, `dto/*`), `health.controller.ts`, `packages/shared`, te globalni bootstrap/filters/interceptors (`main.ts`, `timeout.interceptor.ts`, `http-exception.filter.ts`, `prisma-exception.filter.ts`).  
**Datum audita:** 2026-11-21 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** Kompletiran audit i prijedlog izmjena — **čeka odobrenje prije izmjena koda**.

---

## 1. Sažetak arhitekture i uloga

- **`settings`** upravlja globalnim feature flagovima (`email.enabled`, `smtp.*`, `notifications.*`, `uploads.*`), javnim statusom mobilnog pusha (`/settings/mobile-push`), te per-user `tour` stanjem (`/settings/me`).
- **`app-releases`** omogućava `SYSTEM_ADMIN`-u upload Android `.apk` izdanja (do 250 MB) i javno preuzimanje / provjeru najnovije verzije iz mobilne aplikacije (`useAppUpdateGate`).
- **`activity-log`** čuva revizorski trag (`ActivityLog`) i omogućava pregled `SYSTEM_ADMIN`-u (globalno) i `DIST_ADMIN`-u (za korisnike svoje distribucije).
- **`packages/shared`** dijeli enum-e, `ErrorCodes`, design tokene i normalizatore (`normalizeEmail`, `normalizeIccid`, `normalizePhoneNumber`, `isValidIpv4`) između backend/web/mobile (ESM + CJS dual build).

---

## 2. Nalazi kroz prizmu 4 persone i globalne sigurnosti

| # | Prioritet | Modul / Sloj | Nalaz | Pogođene uloge |
|---|---|---|---|---|
| 1 | **P0** | `settings` (`SettingsService.upsert`, `update`, `findAll`) | **Curenje i plaintext audit-logiranje tajni (`smtp.pass`):** (a) `SettingsService.upsert()` vraća sirovi `setting` bez `sanitizeSetting()`, pa admin response vraća plaintext `smtp.pass`; (b) `upsert()` u `ActivityLog.details` zapisuje plaintext `oldValue` i `newValue` za svaki ključ uključujući `smtp.pass` (i potencijalne buduće tajne); (c) `findAll()` vraća i interne per-user `user:tour-state:*` redove svih korisnika u listi globalnih postavki. | `SYSTEM_ADMIN`, `DIST_ADMIN` (sigurnost tajni) |
| 2 | **P0** | `settings` (`SettingsPublicController` vs `SettingsController`) | **Kolizija ruta `/settings/notifications` (autentifikovana ruta postala javna):** `SettingsPublicController` registruje `GET /settings/notifications` bez `JwtAuthGuard`, a u `SettingsModule` je registrovan PRIJE `SettingsController` (koji ima `@UseGuards(JwtAuthGuard, RolesGuard)` na istom `GET /settings/notifications`). Posljedično je zaštićena ruta mrtav kod, a kanalne postavke su javne bez tokena. | Globalna sigurnost |
| 3 | **P0** | `app-releases` (`AppReleasesController`, `AppReleasesService`) | **APK upload/download ranjivosti i curenje internih polja:** (a) Javni `GET /app-releases/android/latest` vraća cijeli `MobileAppRelease` zapis uključujući interni `apkPath` (serversku putanju) i `createdById`; (b) `uploadAndroidRelease` provjerava samo ekstenziju `.apk`, bez provjere ZIP/APK magic bytes (`PK\x03\x04`), i pri grešci `moveLocalFile`/`writeBuffer` ne briše temp fajl iz `/tmp/sim-tracker-apk-uploads`; (c) javni `GET /app-releases/android/download/:id` nema `@Throttle` zaštitu (250 MB download DoS) ni `X-Content-Type-Options: nosniff`. | Javni API / `SYSTEM_ADMIN` |
| 4 | **P1** | `activity-log` (`ActivityLogFilterDto`, `ActivityLogService`) | **Nedovoljna validacija filtera i fail-closed zaštita u servisu:** `ActivityLogFilterDto.userId` nema `@IsUUID()`, `action`/`entity` nemaju `@MaxLength(100)`, `action`/`entity` `contains` nije `mode: 'insensitive'`, a `ActivityLogService.findAll()` ne radi fail-closed za neočekivanu/ne-admin ulogu (samo `SYSTEM_ADMIN` smije prazan `tenantFilter`, sve ostalo bez `DIST_ADMIN + distributionId` mora vratiti prazno). Također `findForEntity` nema opcionalni `scope`. | `DIST_ADMIN`, `SYSTEM_ADMIN` |
| 5 | **P1** | `settings` (`SettingsController`, `UpdateMySettingsDto`, `SettingsService`) | **Validacija ključeva i per-user payloada:** `:key` parametar u `GET/PATCH /settings/:key` nema validaciju formata/dužine i omogućava ručni prepis `user:tour-state:*` mimo `/settings/me`; `WebRoleTourStateDto.completedAt` nema `@MaxLength(64)`; `UpdateMySettingsDto.preferences` je prazan passthrough bez ograničenja. | `SYSTEM_ADMIN`, svi korisnici |
| 6 | **P2** | `backend` global (`HttpExceptionFilter`, `HealthController`) & Unit testovi | **Globalna higijena & testovi:** `HttpExceptionFilter` može eksplicitnije sakriti interne detalje ako `status === 500`, a `settings`, `app-releases` i `activity-log` nemaju nijedan `.spec.ts` unit test fajl. | Sve uloge / održavanje |

---

## 3. Prijedlog izmjena po paketima

### Paket A — Sigurnost tajni, ruta i APK upload/download-a (P0)
1. **`SettingsService` sanitizacija & redakcija tajni:**
   - Uvesti helper `isSensitiveSettingKey(key)` (npr. `key === SETTINGS_KEYS.smtpPass` ili `/pass|secret|token|key/i` za osjetljive SMTP/auth postavke; tačno `smtp.pass` + eventualne buduće tajne).
   - `upsert()` i `update()` obavezno vraćaju `this.sanitizeSetting(setting)` (nikad plaintext `smtp.pass`).
   - `upsert()` u `ActivityLog.details` za osjetljive ključeve zapisuje maskiranu vrijednost (`'••••••••'` ako nije prazno, inače `''`) umjesto plaintext lozinke.
   - `findAll()` filtrira van interne `user:tour-state:*` redove (`where: { NOT: { key: { startsWith: 'user:tour-state:' } } }`).
2. **Riješiti koliziju ruta `/settings/notifications`:**
   - Ukloniti `@Get('notifications')` iz `SettingsPublicController` (javni ostaje samo `GET /settings/mobile-push` koji koristi mobile login/init prije autentifikacije), tako da `GET /settings/notifications` ostane isključivo pod `JwtAuthGuard` + `RolesGuard` u `SettingsController`! (Web već poziva `/settings/notifications` samo kad je korisnik ulogovan.)
3. **`AppReleasesController` & `AppReleasesService` hardening:**
   - `getLatestAndroidRelease()`: ne vraćati `apkPath` ni `createdById` u javnom response-u (zadržati `id`, `platform`, `versionName`, `versionCode`, `apkFileName`, `apkSha256`, `releaseNotes`, `publishedAt`, `mandatoryAfterAt`, `createdAt`, `updatedAt`, `downloadUrl`, `graceDays`).
   - `uploadAndroidRelease()`: validirati ZIP/APK magic bytes (`0x50 0x4b 0x03 0x04`) na prvih 4 bajta fajla (ako nije validna APK/ZIP arhiva -> obrisati temp fajl i baciti `BadRequestException`), te u `try/finally` obavezno obrisati `file.path` ako ostane na disku nakon greške!
   - `downloadAndroid()`: dodati `@Throttle({ default: { limit: 20, ttl: 60_000 } })`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=3600`, i `Content-Length` kad je dostupan (`fs.statSync`).

### Paket B — Validacija i Fail-closed `activity-log` & `settings` (P1)
4. **`ActivityLogFilterDto` & `ActivityLogService`:**
   - `ActivityLogFilterDto`: `@IsUUID()` na `userId`, `@MaxLength(100)` na `action` i `entity`.
   - `ActivityLogService.findAll`: fail-closed za svaku ulogu koja nije `SYSTEM_ADMIN` ili `DIST_ADMIN` sa validnim `distributionId`; `mode: 'insensitive'` na `action` i `entity`.
5. **`SettingsController` & `UpdateMySettingsDto`:**
   - Validirati `:key` na maksimalnu dužinu (`120` znakova) i zabraniti direktno čitanje/pisanje `user:tour-state:*` preko `:key` endpointa (`BadRequestException`).
   - Dodati `@MaxLength(64)` na `completedAt` / `lastVersionSeen` u `UpdateMySettingsDto` i ograničiti `preferences` (ili ukloniti nekorišteni passthrough ako se ne koristi — provjeriti klijente).

### Paket C — Unit testovi (P2)
6. Dodati unit testove:
   - `backend/src/modules/settings/settings.service.spec.ts` (maskiranje `smtp.pass` u `findAll`, `findByKey`, `upsert`, redakcija u `ActivityLog.details`, izuzimanje `user:tour-state:*` iz `findAll`, `getFeatures`).
   - `backend/src/modules/app-releases/app-releases.service.spec.ts` (provjera APK magic bytes, cleanup temp fajla pri grešci, izostavljanje `apkPath`/`createdById` u `getLatestAndroidRelease`, traversal guard u `getAndroidApkStream`).
   - `backend/src/modules/activity-log/activity-log.service.spec.ts` (tenant izolacija za `DIST_ADMIN`, fail-closed za `DIST_ADMIN` bez `distributionId` i `USER`, filteri datuma/akcije).
