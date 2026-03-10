# PHASE_4_EMAIL_NOTIFICATIONS_DASHBOARD

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)
Period: Sedmica 7-8

## Cilj faze
Omogućiti slanje odobrenih zapisnika, notifikacije u realnom vremenu i operativni dashboard.

## Obavezni deliverable-i
- Email servis i template-i.
- Recipient grupe i upravljanje primaocima.
- Notifikacije (REST + WebSocket).
- Dashboard statistike i prikazi na web/mobile.
- Settings modul.

## Dodatne odluke (Mart 2026)

### Notifikacije moraju biti "live" i robusne
Notifikacijski sistem se smatra kritičnim operativnim kanalom. “Live” znači da korisnik dobija obavijesti **u realnom vremenu** dok je aplikacija otvorena, uz fallback mehanizme ako WebSocket nije dostupan.

**Minimalni standard pouzdanosti (web):**
- UI mora uvijek prikazati konzistentno stanje: badge count, lista notifikacija i “read” status ne smiju divergirati.
- WebSocket reconnect mora biti automatski (backoff + retry), bez rušenja UI-a.
- Ako WebSocket nije spojen: UI mora degradirati na periodični REST polling (npr. svakih 30–60s) za unread count + listu.
- “Mark as read” mora biti idempotentan (više puta → isti rezultat).
- Eventovi moraju biti **deduplicirani** (npr. po `notificationId`) da se ne dupliraju pri reconnect-u.
- API i WS payload moraju imati `createdAt` i stabilan identifikator.

**Minimalni standard pouzdanosti (mobile):**
- Ako nema push notifikacija u ovoj iteraciji, mobile mora barem imati ekran “Notifikacije” koji radi preko REST-a (polling na focus) i prikazuje nepročitane.
- (Opcionalno kasnije) Push notifikacije kao dodatni kanal, ali ne smiju biti jedini izvor istine.

**Preporučena implementacijska smjernica:**
- Backend je “source of truth” za unread/read stanje.
- WebSocket šalje događaje (nove notifikacije + eventualno promjene stanja), ali UI nakon eventa radi “soft refresh” (npr. refetch unread count) da ostane konzistentan.

### Push notifikacije (mobile) – specifikacija (v1)
Push notifikacije se uvode kao **dodatni kanal** za mobilnu aplikaciju (Expo). One ne zamjenjuju in-app notifikacije; mobilna aplikacija i dalje mora imati notifikacijski ekran (REST) kao izvor istine i fallback.

**Tehnički zahtjevi (Expo/FCM):**
- Expo push tokens se prikupljaju i vežu za korisnika (i uređaj) nakon login-a i nakon promjene permission-a za notifikacije.
- Backend čuva token-e (više uređaja po korisniku), uz mogućnost invalidacije (device uninstall / token expired).
- Slanje push-a se vrši preko Expo push servisa (ili direktno FCM/APNs u kasnijoj iteraciji).

**Kanali (Android) i kategorije (iOS) – minimalno:**
- Kanal: `approval` (high importance) – odobravanje/akcije na zapisnicima.
- Kanal: `records` (default) – promjene statusa zapisnika, slanje, greške.
- Kanal: `system` (low/default) – opšte obavijesti, administrativne poruke.

**Dizajn payload-a (standardizovano):**
- `title`, `body`
- `type` (enum): `RECORD_SUBMITTED`, `RECORD_APPROVED`, `RECORD_REJECTED`, `RECORD_WAITING_SEP`, `RECORD_ACTIVATED_SEP`, `RECORD_SENT`, `SYSTEM_MESSAGE`
- `entityType` (npr. `INSTALLATION_RECORD`)
- `entityId` (id zapisnika)
- `deepLink` (npr. `app://records/<id>` ili ruter-specific path)
- `createdAt`
- `notificationId` (stabilan ID iz baze radi dedupe)

**Ručno slanje push notifikacija (SYSTEM_ADMIN):**
- UI u Admin Postavkama: forma za “Broadcast push” (svim korisnicima / po distribuciji / po podružnici / po roli).
- Podrška za “test push” (samo sebi) radi verifikacije konfiguracije.
- Sve ručne poruke se auditiraju u ActivityLog (ko/šta/kome).

**Deep linking ponašanje:**
- Klik na push vodi na odgovarajući ekran:
  - zapisnik detalj (`Installation Record Details`) ako postoji `entityId`
  - notifikacije ekran ako deepLink nije validan ili korisnik nema pravo
- Ako korisnik nije logovan: deepLink se pamti i izvrši nakon login-a (ili fallback na Home).

**Ponašanje kad push ne radi:**
- Push je best-effort; greške slanja ne smiju blokirati primarni tok (approval/send).
- Invalid token se uklanja iz baze nakon neuspjeha.

### Admin Postavke: definicija
Settings modul postoji, ali mora imati jasno definisan set opcija koje SYSTEM_ADMIN može mijenjati. Postavke su podijeljene na:
- **Sistemske postavke (globalno)**: mijenja samo SYSTEM_ADMIN.
- **Operativne postavke (workflow)**: SYSTEM_ADMIN, a MODERATOR samo ako je eksplicitno dozvoljeno u budućem inkrementu (trenutno: ne).

**Predloženi set postavki (v1 – maksimalno pokrivanje sistema):**
1. **Notifikacije (web + mobile)**
   - `notifications.enabled` (bool)
   - `notifications.websocket.enabled` (bool)
   - `notifications.pollingIntervalSeconds` (number, 10–300)
   - `notifications.showBadgeCount` (bool)
   - `notifications.mobile.enabled` (bool)
   - `notifications.mobile.pushEnabled` (bool)
2. **Email**
   - `email.enabled` (bool)
   - `email.fromName` (string)
   - `email.fromAddress` (string)
   - `email.replyTo` (string, optional)
   - `email.sendOnApprove` (bool) – automatsko slanje po odobrenju
   - `email.sendOnActivateSep` (bool)
3. **Zapisnici – workflow**
   - `installationRecords.autoSubmitForApproval` (bool) – da li se DRAFT automatski šalje u PENDING nakon kreiranja
   - `installationRecords.allowSelfApproval` (bool) – trenutna odluka je “dozvoli ako je član approval grupe”; ova postavka omogućava kontrolu politike bez koda
   - `installationRecords.maxPhotosPerRecord` (number)
   - `installationRecords.requirePhotoForApproval` (bool)
4. **Organizacioni scope i RBAC**
   - `rbac.allowModeratorManageUsersInDistribution` (bool)
   - `rbac.allowUserSeeAllRecordsInBranch` (bool) – inače samo vlastite
   - `rbac.allowUserFilterByBranch` (bool)
5. **Upload limita (foto/dokumenti)**
   - `uploads.maxPhotoSizeMb` (number)
   - `uploads.allowedPhotoMimeTypes` (string list)
   - `uploads.maxDocumentSizeMb` (number)
   - `uploads.allowedDocumentMimeTypes` (string list)
6. **Sigurnost / rate-limit**
   - `security.rateLimit.enabled` (bool)
   - `security.rateLimit.windowSeconds` (number)
   - `security.rateLimit.maxRequests` (number)
   - `security.ipWhitelist` (list, optional)
7. **Dashboard & Tour**
   - `dashboard.defaultTimeRange` (enum: TODAY, 7_DAYS, 30_DAYS)
   - `dashboard.showDemountTasksWidget` (bool)
   - `tour.web.enabled` (bool)
   - `tour.mobile.enabled` (bool)
8. **Mobile specifično**
   - `mobile.offlineQueue.enabled` (bool)
   - `mobile.offlineQueue.maxItems` (number)
   - `mobile.requireGpsForRecord` (bool)
   - `mobile.push.testMode` (bool) – omogućava “send test push to me”
   - `mobile.push.defaultChannel` (enum: approval, records, system)

**Audit pravila:**
- Svaka promjena postavke mora biti auditovana u Dnevniku aktivnosti (ko/šta/stara vrijednost/nova vrijednost).
- UI mora prikazati “last updated by / at”.

### Activity Log → Timeline za zapisnike
Pošto postoji Dnevnik aktivnosti, isti se koristi kao osnova za Timeline na detalju zapisnika.

**Minimalni zahtjevi:**
- Timeline prikazuje događaje vezane za konkretan zapisnik (create, update, submit for approval, approve, reject, activate SEP, send email, upload photo).
- Svaki događaj prikazuje: vrijeme, korisnika, akciju, i “diff” (gdje je smisleno).
- Timeline je sortirana po vremenu (najnovije gore) i paginirana.

**Predlog tehničke realizacije:**
- Backend: endpoint `GET /installation-records/:id/timeline` koji vraća normaliziran feed (spaja ActivityLog + specifične događaje ako postoje).
- Frontend: komponenta `Timeline` na detail stranici zapisnika (web), mobile opcionalno u kasnijem inkrementu.

## Task backlog
| Task ID | Domen | Opis | Dependency | Output |
|---|---|---|---|---|
| P4-BE-01 | Backend | Email service konfiguracija (SMTP + template rendering) | P3-BE-* | Email modul |
| P4-BE-02 | Backend | Recipient groups i recipients CRUD | P4-BE-01 | Recipient API |
| P4-BE-03 | Backend | Send record endpoint sa PDF attachment-om | P3-BE-06, P4-BE-01 | Slanje zapisnika |
| P4-BE-04 | Backend | Notifications modul + WebSocket gateway | P3-BE-02 | Real-time notifikacije |
| P4-BE-05 | Backend | Dashboard stats/recent/charts endpoint-i | P2-BE-05, P3-BE-02 | Dashboard API |
| P4-BE-06 | Backend | Settings modul (get/update key-value) | P1-BE-* | App settings API |
| P4-BE-07 | Backend | Notifikacije: reconnect/backoff, deduplikacija eventova i REST polling fallback (API podrška) | P4-BE-04 | Robust live notif tok |
| P4-BE-08 | Backend | Timeline endpoint za zapisnike: `GET /installation-records/:id/timeline` (ActivityLog feed) | P2-BE-08, P3-BE-* | Normalizovan timeline API |
| P4-BE-09 | Backend | Settings: proširenje za “Admin Postavke” ključeve + audit (old/new vrijednost) | P4-BE-06 | Settings v1 komplet |
| P4-BE-10 | Backend | Mobile push: model za device push tokene + registracija/invalidacija | P1-BE-*, P4-BE-04 | Persistovani push tokeni |
| P4-BE-11 | Backend | Mobile push: servis za slanje (Expo) + retry + invalid token cleanup | P4-BE-10 | Push dispatch |
| P4-BE-12 | Backend | Mobile push: ručno slanje (broadcast/targeting) + audit log | P4-BE-11, P4-BE-09 | Admin broadcast push |
| P4-FE-01 | Frontend | Dashboard stranica (stats, chart, recent activity) | P4-BE-05 | Dashboard UI |
| P4-FE-02 | Frontend | Recipients management UI (grupe + primaoci) | P4-BE-02 | Recipient UI |
| P4-FE-03 | Frontend | Send record modal (odabir grupe/ručni email) | P4-BE-03 | Slanje UI |
| P4-FE-04 | Frontend | Notification bell + dropdown + mark as read | P4-BE-04 | Notification UI |
| P4-FE-05 | Frontend | Activity log stranica | P2-BE-08 | Audit pregled |
| P4-FE-06 | Frontend | Settings stranica | P4-BE-06 | Admin settings UI |
| P4-FE-07 | Frontend | Notifikacije: WS status indikator + fallback polling + dedupe u UI | P4-BE-07 | “Neprikosnoven” notif UX |
| P4-FE-08 | Frontend | Timeline komponenta na detalju zapisnika (feed + paginacija) | P4-BE-08 | Timeline UI |
| P4-FE-09 | Frontend | Settings UI: sekcije/forme za v1 Admin Postavke + “last updated by/at” | P4-BE-09 | Admin postavke UI |
| P4-MB-01 | Mobile | Home screen sa osnovnim statistikama | P4-BE-05 | Mobile home update |
| P4-MB-02 | Mobile | Push/notification screen integracija | P4-BE-04 | Mobile notif view |
| P4-MB-03 | Mobile | Profile screen stabilizacija | P1-MB-* | Profile management |
| P4-MB-04 | Mobile | Notifikacije (minimalno): REST lista + unread count refresh na focus | P4-BE-04 | Mobile notif (bez pusha) |
| P4-MB-05 | Mobile | Push: traženje permission-a, registracija Expo tokena, refresh na login | P4-BE-10 | Mobile push registration |
| P4-MB-06 | Mobile | Push: kanali (Android), handler, deep link routing na zapisnik/notifikacije | P4-MB-05 | Mobile push UX |
| P4-QA-01 | QA | Testovi slanja maila i validacija stanja `SENT` | P4-BE-03 | Email flow testovi |
| P4-QA-02 | QA | E2E: approve -> send -> sent status | P4-FE-03 | End-to-end send flow |
| P4-QA-03 | QA | E2E: notification receive/read-all | P4-FE-04 | Notification e2e |
| P4-QA-04 | QA | E2E: WS down → polling fallback → state konzistentan (read/unread) | P4-FE-07 | Notif resilience e2e |
| P4-QA-05 | QA | E2E: Timeline prikaz (create/approve/send) | P4-FE-08 | Timeline e2e |
| P4-QA-06 | QA | Push: token registracija, test push, deep link na zapisnik, fallback kad nije logovan | P4-MB-06, P4-BE-12 | Push e2e |

## Phase gate - acceptance
- Odobren zapisnik se može poslati email-om sa PDF attachmentom.
- Notification centar radi i ažurira read status.
- Notifikacije rade “live” uz WS reconnect i fallback polling bez dupliranja događaja.
- Mobile push notifikacije rade (registracija tokena, kanali, deep link, i admin test/broadcast).
- Dashboard prikazuje tačne agregirane podatke.
- Settings izmjene su sačuvane i auditovane.
- Timeline je dostupan na detalju zapisnika (najmanje web) i prikazuje ključne događaje.

## Rizici i mitigacija
- Rizik: SMTP nestabilnost utiče na slanje.
- Mitigacija: retry logika + jasan failure status bez lažnog `SENT`.

## RBAC matrica - odobravanje zapisnika

| Rola | Podrola (funkcionalno) | Pristup `/installation-records` | Pristup detalju `/installation-records/:id` | Approve/Reject (`PENDING`) | Activate SEP (`WAITING_SEP_ACTIVATION`) | Send PDF (`ACTIVATED_IN_SEP`) |
|---|---|---|---|---|---|---|
| SYSTEM_ADMIN | Globalni admin | DA (svi scope-ovi) | DA | DA | DA | DA |
| MODERATOR | Distribucijski moderator | DA (samo distribucija) | DA (samo distribucija) | DA | DA | DA |
| USER | Operator (nije approver) | DA (samo podružnica) | DA (samo podružnica) | NE (403) | NE (403) | NE |
| USER | Approver u RecipientGroupUser za branch | DA (samo podružnica) | DA (samo podružnica) | DA (ako je u approval grupi) | DA (ako je u approval grupi) | NE |

### Scenariji verifikacije (minimalni set)

| ID | Scenarij | Očekivani rezultat |
|---|---|---|
| RBAC-IR-01 | USER otvara listu bez branchId | 403 Forbidden |
| RBAC-IR-02 | USER (operator, nije u approval grupi) pokuša approve | 403 Forbidden |
| RBAC-IR-03 | USER u approval grupi za branch pokuša approve | 200 OK, status -> `WAITING_SEP_ACTIVATION` |
| RBAC-IR-04 | USER u approval grupi za branch pokuša reject | 200 OK, status -> `REJECTED` |
| RBAC-IR-05 | USER u approval grupi za branch pokuša activate SEP | 200 OK, status -> `ACTIVATED_IN_SEP` |
| RBAC-IR-06 | MODERATOR pokuša approve bez membership provjere | 200 OK |
| RBAC-IR-07 | Notification link vodi USER approvera na detalj zapisa | Detalj se otvara, akcije su dostupne po statusu |
| RBAC-IR-08 | USER (član approval grupe) pokuša approve/reject/activate vlastiti zapisnik | 200 OK (dozvoljeno jer je član approval grupe) |

### Backlog odluka
- Modularne permisije po grupi/statusu (npr. checkbox `može odobravati`, `može aktivirati SEP`) ostaju planirane za naredni inkrement kako bi se izbjeglo širenje modela usred stabilizacije RBAC osnovnog toka.

## Planirani inkrement (bez implementacije): granularne permisije po grupi

### Predložena mini-faza: P4.1 - Approval Permissions Matrix

**Status:** Planirano, čeka odobrenje  
**Napomena:** U ovom koraku nema implementacije, samo specifikacija.

### Cilj
- Uvesti modularna prava po approval grupi tako da moderator može precizno definisati šta članovi grupe smiju raditi po statusima zapisnika.

### Predloženi scope
- `canApproveFromPending`
- `canRejectFromPending`
- `canActivateSep`
- (opciono za kasnije) `canSendPdf`

### Predložene izmjene modela
- Proširenje `RecipientGroupUser` relacije dodatnim permission poljima (bool), ili uvođenje nove tabele `RecipientGroupPermission` po grupi i akciji.
- Preporuka v1: permissions na `RecipientGroupUser` nivou (najfleksibilnije za miješane timove).

### Predloženi backend zadaci
- Novi DTO za ažuriranje permissions po korisniku u grupi.
- Endpoint za update permissions:
  - `PATCH /recipients/groups/:id/users/:userId/permissions`
- RBAC enforcement u:
  - `POST /installation-records/:id/approve`
  - `POST /installation-records/:id/reject`
  - `POST /installation-records/:id/activate-sep`
- Audit log za svaku promjenu permission-a.

### Predloženi frontend zadaci
- Na `RecipientsPage` za APPROVAL grupe:
  - tabela članova sa checkbox kolonama:
    - Odobri
    - Odbij
    - Aktiviraj SEP
  - snimanje promjene odmah (optimistic update) ili kroz "Sačuvaj" batch dugme.

### Predloženi acceptance kriteriji
- Korisnik u approval grupi sa isključenim permission-om dobija `403` na odgovarajuću akciju.
- Uključeni permission odmah omogućava akciju bez potrebe za restartom.
- UI jasno prikazuje trenutno stanje permissions po korisniku.

### QA matrica (plan)
- Kombinacije role (`SYSTEM_ADMIN`, `MODERATOR`, `USER`) x membership x permission flag.
- Negativni testovi: korisnik član grupe, ali bez `canActivateSep` ne može aktivirati.
- Regresija: postojeći approval tok i notifikacije ostaju netaknuti.
