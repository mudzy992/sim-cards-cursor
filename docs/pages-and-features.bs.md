# SIM Tracker — stranice, screenovi i funkcionalnosti (BS)

Izvor rute:

- Web: `frontend/src/router/index.tsx`
- Mobile: `mobile/app/**` (expo-router)

Dokument je namijenjen da:

- kupac vidi **šta sistem radi**
- tehnički tim vidi **kako je mapirano na API** i **ko ima pristup (RBAC/scope)**.

---

## 1. Web aplikacija (`frontend/`)

### 1.1 Public rute

#### `/login` — Prijava

- **Svrha**: prijava korisnika (email ili username) i inicijalno učitavanje profila/sesije.
- **Rola**: svi (public).
- **API**:
  - `POST /api/auth/login`
  - (implicitno) `POST /api/auth/refresh` (auto na 401, preko axios interceptora)
- **Edge case**:
  - nevalidne kredencijale → prikaz jasne poruke
  - token expire → refresh i retry automatski

#### `/forbidden` — Zabranjen pristup

- **Svrha**: korisnički jasan ekran kada `RoleGuard` blokira rutu.

#### `*` — 404 Not found

- **Svrha**: fallback za nepostojeće rute.

---

### 1.2 Protected shell (AppLayout)

Sve rute ispod su iza `ProtectedRoute` (auth) i često `RoleGuard` (RBAC).

#### `/dashboard` — Dashboard

- **Svrha**: operativni pregled KPI + recent activity.
- **Role**: SYSTEM_ADMIN / MODERATOR / USER (po implementaciji rute).
- **API**:
  - `GET /api/dashboard/*` (statistike)
  - `GET /api/notifications/unread-count` (badge)
- **Napomena**: web app se oslanja na React Query cache + refetch nakon WS eventa.

#### `/users` — Korisnici (lista + organizacijski tabovi)

- **Svrha**: upravljanje korisnicima i organizacionom hijerarhijom (po scope pravilima).
- **Role**: SYSTEM_ADMIN, MODERATOR.
- **API**:
  - `GET /api/users`
  - `POST/PATCH/DELETE /api/users/*`
  - organizacioni endpointi: `GET/POST /api/distributions`, `GET/POST /api/branches` (ovisno o UI integraciji)
- **Ključno**: scope enforcement — moderator vidi samo svoju distribuciju.

#### `/shipments` — Isporuke + SIM (lista)

- **Svrha**: pregled isporuka, pretraga/filteri, ulaz u import tok.
- **Role**: SYSTEM_ADMIN, MODERATOR.
- **API**:
  - `GET /api/shipments`
  - `GET /api/shipments/:id/sim-cards`
  - `GET /api/sim-cards/*` (detalji/statistike u okviru UI-a)

#### `/shipments/new` — Nova isporuka + import

- **Svrha**: kreiranje shipment-a i pokretanje WF-01 importa.
- **Role**: SYSTEM_ADMIN.
- **API**:
  - `POST /api/shipments`
  - `POST /api/shipments/:id/import` (preview/apply)
- **Edge case**:
  - duplikat ICCID u fajlu / nevalidan ICCID → import preview mora pokazati greške (WF-01 acceptance).

#### `/shipments/:id` — Detalji isporuke

- **Svrha**: pregled shipment-a i pripadajućih SIM kartica.
- **Role**: SYSTEM_ADMIN, MODERATOR.
- **API**:
  - `GET /api/shipments/:id`
  - `GET /api/shipments/:id/sim-cards`

#### `/meters` — Brojila (tabovi: Brojila + Tipovi brojila)

- **Svrha**: inventar brojila + katalog tipova brojila, kreiranje zapisnika kroz tok “pridruživanje SIM brojilu”.
- **Role**: SYSTEM_ADMIN, MODERATOR (po routeru).
- **API**:
  - `GET /api/meters` (+ filteri, search)
  - `POST/PATCH/DELETE /api/meters/*`
  - `GET/POST/PATCH/DELETE /api/meter-type-definitions/*`
  - `GET /api/installation-records?meterId=...` (zapisnici po brojilu)
- **Napomena**: playbook P3 definira “jedna stranica Brojila” i one-to-many records po meter-u.

#### `/sim-cards/:id` — Detalji SIM kartice

- **Svrha**: pregled SIM-a (ICCID, IP, status, assignment) i historija/veze gdje je relevantno.
- **Role**: SYSTEM_ADMIN, MODERATOR.
- **API**:
  - `GET /api/sim-cards/:id`
  - (akcije) `POST /api/sim-cards/:id/assign`, `POST /api/sim-cards/:id/unassign`

#### `/installation-records` — Lista zapisnika

- **Svrha**: pregled i filtriranje zapisnika po statusu/scope-u.
- **Role**: SYSTEM_ADMIN, MODERATOR, USER.
- **API**:
  - `GET /api/installation-records` (scope-aware)
  - `GET /api/installation-records/my` (mobile fokus, ali može se koristiti i na web-u)
- **Ključno**: za USER listu backend može vratiti “samo moje” ili “scope šire” zavisno od approval membership-a (P4 RBAC scenario).

#### `/installation-records/new` — Kreiranje zapisnika

- **Svrha**: kreiranje zapisnika (web tok).
- **Role**: SYSTEM_ADMIN, MODERATOR, USER.
- **API**:
  - `POST /api/installation-records`
  - pomoćni dropdown-i:
    - `GET /api/sim-cards/my-assigned` (za odabir SIM)
    - `GET /api/meters/available` ili `GET /api/meters` (za odabir brojila)

#### `/installation-records/:id` — Detalj zapisnika

- **Svrha**: potpuni detalj, akcije po statusu, PDF preview/download, timeline, slanje.
- **Role**: SYSTEM_ADMIN, MODERATOR, USER (scope-aware).
- **API**:
  - `GET /api/installation-records/:id`
  - `GET /api/installation-records/:id/permissions` (UI prikaz akcija za USER)
  - `GET /api/installation-records/:id/timeline`
  - `GET /api/installation-records/:id/pdf`
  - akcije:
    - `POST /api/installation-records/:id/submit-for-approval`
    - `POST /api/installation-records/:id/approve`
    - `POST /api/installation-records/:id/reject`
    - `POST /api/installation-records/:id/activate-sep`
    - `POST /api/installation-records/:id/send` (admin/moderator)
- **Fotografije**:
  - serve: `GET /api/files/photo?path=installation-records/...` (JWT)

#### `/recipients` — Primaoci i approval grupe

- **Svrha**: upravljanje recipient grupama, mapiranje na podružnicu, članovi (emails + korisnici aplikacije).
- **Role**: SYSTEM_ADMIN, MODERATOR (scope enforcement: moderator samo svoju distribuciju).
- **API**:
  - `GET/POST/PATCH/DELETE /api/recipients/*`
  - `POST /api/recipients/groups/:id/users`, `DELETE .../users/:userId`, `GET .../users`
  - `GET /api/recipients/users-for-picker` (dropdown)

#### `/activity-log` — Dnevnik aktivnosti

- **Svrha**: audit trail (ko/šta/kad, filteri).
- **Role**: SYSTEM_ADMIN, MODERATOR.
- **API**:
  - `GET /api/activity-log`

#### `/settings` — Postavke (Admin)

- **Svrha**: upravljanje sistemskim postavkama (notifikacije/email/workflow/rate-limit/offline queue/tour).
- **Role**: SYSTEM_ADMIN.
- **API**:
  - `GET/PATCH /api/settings/*` i `GET/PATCH /api/settings/me` (tour state)
- **Napomena**: promjene se auditiraju (playbook P4).

#### `/analytics` — Analitika + CSV export

- **Svrha**: KPI, grafovi i export; role-aware i scope-aware.
- **Role**: SYSTEM_ADMIN, MODERATOR, USER.
- **API**:
  - `GET /api/analytics/overview`
  - `GET /api/analytics/sim-cards`
  - `GET /api/analytics/installation-records`
  - `GET /api/analytics/users`
  - `GET /api/analytics/exports/:report.csv`

---

## 2. Mobile aplikacija (`mobile/`)

### 2.1 Auth tok

#### `/(auth)/login` — Prijava

- **Svrha**: login + čuvanje sesije u SecureStore.
- **API**:
  - `POST /api/auth/login`
  - refresh na 401: `POST /api/auth/refresh`

---

### 2.2 Tabovi (privatni dio)

#### `/(app)/(tabs)/home` — Početna

- **Svrha**: brzi pregled (dashboard) + ulaz u notifikacije + mini-tour (first-run tips).
- **API**:
  - `GET /api/dashboard/*` (minimalni set)
  - `GET /api/notifications/unread-count`

#### `/(app)/(tabs)/scan` — Skeniranje (WF-02)

- **Svrha**: skeniranje ICCID barkoda i prikaz rezultata.
- **Native**: `expo-camera` permission + barcode scan.
- **API**:
  - `GET /api/sim-cards/scan/:iccid`
- **Edge case**:
  - kartica izvan scope-a → 403 + jasna poruka
  - throttle / prečesto skeniranje → handling greške

#### `/(app)/scan-result` — Rezultat skena + “claim”

- **Svrha**: prikaz SIM detalja i CTA `Zaduži karticu`.
- **API**:
  - `POST /api/sim-cards/:id/claim`

#### `/(app)/create-record` — Novi zapisnik

- **Svrha**: kreirati installation record nakon uspješnog claim-a.
- **Native**:
  - GPS: `expo-location` (foreground)
  - foto: `expo-image-picker` (kamera) + upload
- **API**:
  - `POST /api/installation-records`
  - photo upload: `POST /api/installation-records/upload-photo` (vraća `path`)
- **Offline**:
  - ako nema mreže: payload ide u offline queue (`SecureStore`), korisnik dobija potvrdu da je snimljeno offline.

#### `/(app)/(tabs)/records` — Zapisnici (moji)

- **Svrha**: lista mojih zapisnika + statusi + sinhronizacija offline queue-a.
- **API**:
  - `GET /api/installation-records/my`
  - (sync) `POST /api/installation-records` za queued stavke

#### `/(app)/record-details` — Detalji zapisnika + akcije

- **Svrha**: detalj, ručno “Pošalji na odobrenje” kada nije automatski.
- **API**:
  - `GET /api/installation-records/:id`
  - `POST /api/installation-records/:id/submit-for-approval`

#### `/(app)/(tabs)/demount` — Demontaža

- **Svrha**: lista demount taskova i akcije statusa.
- **API**:
  - `GET /api/demount-tasks/my`
  - `PATCH /api/demount-tasks/:id/status`

#### `/(app)/(tabs)/profile` — Profil

- **Svrha**: pregled sesije/korisnika, logout, potencijalno podešavanja device permission-a.
- **API**:
  - `GET /api/auth/profile`
  - `POST /api/auth/logout`

---

### 2.3 Notifikacije (mobile)

#### `/(app)/notifications` — Notifikacije (REST source of truth)

- **Svrha**: lista notifikacija i read/unread.
- **API**:
  - `GET /api/notifications`
  - `POST /api/notifications/:id/read` / `POST /api/notifications/read-all` (ovisno o implementaciji)
- **Push**:
  - Expo push token registracija nakon login-a + deep link na ekran.

---

## 3. Veza sa fazama (P1–P5)

- P1: login + protected routes + osnovni RBAC
- P2: shipments + import + scan/claim
- P3: meters + records + PDF
- P3.5: distribucije/podružnice + scope filtering
- P4: recipients + email + notifikacije (REST+WS) + settings + timeline
- P4.1: tour (web) + mini tips (mobile)
- P4.2: analytics + CSV export
- P5: offline queue + polish + test + deploy

