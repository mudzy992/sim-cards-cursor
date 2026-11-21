# Arhitekturalni i poslovni audit — SIM Tracker (`sim-cards-cursor`)

Ovaj direktorij sadrži sistematsku dokumentaciju sistema **modul po modul**, analiziranu kroz prizmu sve **4 operativne uloge (persone)**, s ciljem otkrivanja uskih grla, rubnih slučajeva u poslovnoj logici, sigurnosnih rizika, neiskorištenih DB upita i prilika za ubrzanje i unapređenje rada na webu i terenu.

---

## 1. Operativne osobe (uloge) u sistemu

| Persona | Tehnička definicija (`schema.prisma`) | Primarni kanal | Opseg podataka (Scope) |
|---|---|---|---|
| **1. `SYSTEM_ADMIN`** | `User.role = SYSTEM_ADMIN` | Web Admin | Globalni pristup svim distribucijama, poslovnicama, korisnicima, podešavanjima, kampanjama i izdanjima. |
| **2. `DIST_ADMIN`** | `User.role = DIST_ADMIN` + `User.distributionId` | Web Admin | Sve unutar vlastite distribucije (`distributionId`) i svih njenih poslovnica (`Branch`). Fail-closed ako `distributionId` nedostaje. |
| **3. `BRANCH_MODERATOR`** | `User.role = USER` + zapisi u `BranchModerator` | Web Admin + Mobile | Instalirane SIM kartice, brojila, zadaci i zapisnici unutar dodijeljenih `branchModeratorBranchIds` (+ vlastiti `branchId`). |
| **4. `USER` (Terenski monter)** | `User.role = USER` + `User.branchId` | Mobile (primarno) + Web ograničeno | Vlastite dodijeljene SIM kartice, terenski zadaci montaže/demontaže, kreiranje zapisnika i offline outbox unutar svog `branchId`. |

---

## 2. Kompletan inventar sistema (23 backend modula + 3 cross-cutting sloja)

### Grupa A — Identitet, organizacija i pristup
- `auth` — JWT login/refresh/logout, bcrypt, single refresh token po korisniku, promjena/potvrda lozinke (`488` linija BE + `axios.instance` + `auth.store`)
- `users` — CRUD korisnika, statusi (`ACTIVE`/`INACTIVE`/`SUSPENDED`), scope po distribucijama (`419` linija BE + `UsersListPage`)
- `distributions` — CRUD elektrodistribucija (`157` linija BE + tab u `UsersListPage`)
- `branches` — CRUD poslovnica unutar distribucija (`197` linija BE + tab u `UsersListPage`)
- `branch-moderators` — dodjela i uklanjanje moderatora poslovnica (`208` linija BE + `BranchModeratorsPage`)

### Grupa B — Core životni ciklus SIM kartica i brojila
- `shipments` — Excel/CSV import (8.500+ SIM-ova, `importAllValid`), dodjela distribuciji/monteru, štampa naljepnica (`1.097` linija BE + `shipments/*`)
- `sim-cards` — statusi SIM kartica (`AVAILABLE` -> `ASSIGNED` -> `INSTALLED` -> `DEMOUNTED`/`DEFECTIVE`/`RETURNED`/`DEACTIVATED`), `SimEvent`, offline inventar (`924` linija BE)
- `meters` — katalog brojila, veza `Meter <-> SimCard`, statusi brojila (`738` linija BE + `MetersListPage`/`MeterDetailPage`)
- `meter-type-definitions` (+ `meter-type-fields`) — tipovi brojila i dinamička polja formi (`375` linija BE)

### Grupa C — Terenski zapisnici, montaža i demontaža
- `installation-records` (+ `photo-upload`) — zapisnici (`NEW_CONNECTION`, `METER_REPLACEMENT`), PDF generacija, slike, offline sync (`1.469` linija BE)
- `install-tasks` — radni nalozi za montažu (`705` linija BE + mobile `(tabs)/install`)
- `demount-tasks` — radni nalozi za demontažu i raspolaganje skinutim SIM-om (`868` linija BE + mobile `(tabs)/demount`)

### Grupa D — Obavještenja, email, push i izvještavanje
- `mail` — SMTP slanje SEP zapisnika i PDF priloga (`354` linija BE)
- `branch-email-recipients` — primaoci izvještaja po poslovnicama (`194` linija BE)
- `notifications` — in-app notifikacije (`144` linija BE)
- `push-tokens` — registracija Expo push tokena (`120` linija BE)
- `push-campaigns` — ciljane push kampanje i delivery tracking (`546` linija BE)
- `dashboard` — operativni pregledi po ulogama (`214` linija BE)
- `analytics` — napredne analitike i trendovi (`732` linija BE)

### Grupa E — Administracija, fajlovi, logovi i infrastruktura
- `settings` (+ `public`) — dinamička podešavanja aplikacije i SMTP-a (`587` linija BE)
- `app-releases` — distribucija Android APK izdanja i force-update provjere (`265` linija BE)
- `activity-log` — revizorski trag (`173` linija BE)
- `files` — auth-zaštićeno serviranje fotografija i fajlova (`93` linije BE)
- Cross-cutting: `StorageModule` (`UploadsStorageService`), `PdfGeneratorService`, `scopeWhere`, `packages/shared`, mobile `offline/outbox`.

---

## 3. Raspored i status Audit Run-ova

| Run | Obuhvaćeni moduli | Status | Izvještaj |
|---|---|---|---|
| **Run 1** | `auth`, `users`, `distributions`, `branches`, `branch-moderators` | **Paket A (P0) implementiran; Paket B/C na čekanju** | [`run-01-identity-org-access.md`](./run-01-identity-org-access.md) |
| **Run 2** | `shipments`, `sim-cards` | Planiran | — |
| **Run 3** | `meters`, `meter-type-definitions`, `meter-type-fields` | Planiran | — |
| **Run 4** | `installation-records`, `photo-upload`, `files`, mobile `outbox` | Planiran | — |
| **Run 5** | `install-tasks`, `demount-tasks` | Planiran | — |
| **Run 6** | `mail`, `branch-email-recipients`, `notifications`, `push-tokens`, `push-campaigns` | Planiran | — |
| **Run 7** | `dashboard`, `analytics` | Planiran | — |
| **Run 8** | `settings`, `app-releases`, `activity-log`, `packages/shared`, globalna sigurnost | Planiran | — |
