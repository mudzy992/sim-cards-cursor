# Audit Run 1 — Identitet, organizacija i kontrola pristupa

**Obuhvaćeni moduli:** `auth`, `users`, `distributions`, `branches`, `branch-moderators` + cross-cutting slojevi (`JwtStrategy`, `RolesGuard`, `BranchModeratorGuard`, `scopeWhere`, `PaginationDto`, web/mobile Axios refresh interceptori).  
**Datum audita:** 2026-11-20 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** **Paketi A (P0), B (P1) i C (P2) implementirani i verifikovani**.

### Status implementacije Paketa A + B + C
- **Paket A (P0):** `BranchModeratorsPage` `limit: 100` + live search; hijerarhija uloga, čišćenje org polja & opoziv `refreshToken`; sigurno rukovanje `refresh` greškama u `axios.instance.ts`.
- **Paket B (P1):** `AuthService` normalizuje username `.trim().toLowerCase()`, koristi brzi `HMAC-SHA256` refresh token hash sa legacy bcrypt fallbackom, `JwtStrategy.validate` spaja user + moderator query u 1 DB upit, `UsersService` + `UsersListPage` prikazuju stvarne nazive distribucija/poslovnica, case-insensitive pretragu po email/username/imenu/prezimenu i `FilterBar` filtere (`search`, `role`, `status`, `distributionId`, `branchId`), te sprječava brisanje korisnika sa povezanim zapisima/zadacima (`409 Conflict`).
- **Paket C (P2):** Uklonjene mrtve strategije `LocalStrategy` i `JwtRefreshStrategy`; `DistributionsService`, `BranchesService` i `BranchModeratorsService` upisuju `ActivityLog` zapise, provjeravaju sve zavisnosti na `remove()` (`409 Conflict`), i podržavaju `distributionId` filter na `/branch-moderators`.

---

## 1. Mapa funkcija po osobama (Role Matrix)

### 1.1 `auth` (`backend/src/modules/auth/*`, web `LoginPage`/`axios.instance.ts`, mobile `(auth)/login`/`axios.instance.ts`)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` (Monter) | Napomena iz koda |
|---|---|---|---|---|---|
| `POST /auth/login` | Da (email/username) | Da | Da | Da | Throttle `5/60s` po IP-u (`trust proxy = 1`). Vraća `user` + `accessToken` (15m) + `refreshToken` (7d). |
| `POST /auth/register` | **Da** | Ne | Ne | Ne | Duplira `POST /users`, ali ne podržava `distributionId`/`branchId`. |
| `POST /auth/refresh` | Da | Da | Da | Da | Throttle `10/60s`. Rotira i prepiše **jedini** `User.refreshToken` hash u bazi. |
| `POST /auth/logout` | Da | Da | Da | Da | Postavlja `User.refreshToken = null` i upisuje `ActivityLog` (`LOGOUT`). |
| `POST /auth/change-password` | Da | Da | Da | Da | Briše `refreshToken = null` (odjavljuje sesiju). |
| `POST /auth/verify-password` | Da | Da | Da | Da | Re-autentifikacija prije osjetljivih akcija. |
| `GET /auth/profile` | Da | Da | Da | Da | Vraća `SafeUser` sa `branch` i `branchModeratorBranchIds`. |

### 1.2 `users` (`backend/src/modules/users/*`, `frontend/src/pages/users/UsersListPage.tsx`)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` | Napomena iz koda |
|---|---|---|---|---|---|
| `GET /users` | Svi korisnici | Korisnici svoje distribucije (`distributionId` ili `branch.distributionId`) | Ne (403) | Ne (403) | Paginacija (`page`, `limit <= 100`), `search`, `role`, `status`. |
| `GET /users/:id` | Bilo ko | Samo unutar svoje distribucije | Ne (403) | Ne (403) | `scopeWhere({ userScope: true })`. |
| `POST /users` | **Da** | Ne (403) | Ne (403) | Ne (403) | Kreira korisnika, generiše `username`, loguje `CREATE`. |
| `PATCH /users/:id` | Svi | Korisnici svoje distribucije (ne smije dirati/dodijeliti `SYSTEM_ADMIN` niti prebaciti u drugu distribuciju) | Ne (403) | Ne (403) | **Može mijenjati `role` između `USER` i `DIST_ADMIN`** (vidi nalaz P0-2). |
| `PATCH /users/:id/status` | Svi | Korisnici svoje distribucije | Ne (403) | Ne (403) | **Ne provjerava** da li `DIST_ADMIN` mijenja status `SYSTEM_ADMIN`-u (osim ako `userScope` sakrije globalnog admina bez distribucije, ali ako `SYSTEM_ADMIN` ima `distributionId` -> može ga suspendovati!). |
| `DELETE /users/:id` | **Da** | Ne (403) | Ne (403) | Ne (403) | Hard delete (`prisma.user.delete`). |

### 1.3 `distributions` & `branches` (`UsersListPage.tsx` tabovi)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` | Napomena iz koda |
|---|---|---|---|---|---|
| `GET /distributions` / `:id` | Sve | Samo vlastita (`user.distributionId`) | Ne (403) | Ne (403) | Vraća `_count` za `branches` i `users`. |
| `POST/PATCH/DELETE /distributions` | **Da** | Ne (403) | Ne (403) | Ne (403) | `DELETE` blokira samo ako ima poslovnica (`branch.count > 0`). |
| `GET /branches` / `:id` | Sve (ili po `distributionId`) | Samo poslovnice vlastite distribucije | Ne (403) | Ne (403) | Vraća `_count` za `meters` i `users`. |
| `POST/PATCH/DELETE /branches` | **Da** | Ne (403) | Ne (403) | Ne (403) | `DELETE` blokira samo ako ima brojila (`meter.count > 0`). |

### 1.4 `branch-moderators` (`BranchModeratorsPage.tsx` + `UsersListPage.tsx`)

| Funkcija / Endpoint | `SYSTEM_ADMIN` | `DIST_ADMIN` | `BRANCH_MODERATOR` | `USER` | Napomena iz koda |
|---|---|---|---|---|---|
| `GET /branch-moderators` | Sve (filtrirano po `branchId`/`userId`) | Samo poslovnice svoje distribucije | Vlastite dodjele (`findByUser(user.id)`) | Vlastite (prazno) | Na webu `BranchModeratorsPage` puni dropdown korisnika pozivom `usersApi.list({ role: 'USER', limit: 200 })` — **pada s 400**! |
| `POST /branch-moderators` | Sve poslovnice | Poslovnice svoje distribucije | Ne (403) | Ne (403) | Dozvoljeno samo ako ciljni korisnik ima `role === USER`. |
| `DELETE /branch-moderators/:id` | Sve | Poslovnice svoje distribucije | Ne (403) | Ne (403) | Uklanja zapis iz `BranchModerator`. |

---

## 2. End-to-End tokovi podataka i stanja

1. **Autentifikacija i sesija (`auth.service.ts` + `jwt.strategy.ts`)**:
   - `login` pronalazi korisnika po emailu (`normalizeEmail`) ili `username`-u, provjerava `status === ACTIVE` i `bcrypt.compare`, kreira `accessToken` (15m) i `refreshToken` (7d), hashira `sha256(refreshToken)` pomoću `bcrypt` (cost 12) i upisuje u `User.refreshToken` (kolona na `users` tabeli — **1 aktivna sesija po korisniku**).
   - Na svaki API poziv, `JwtStrategy.validate` radi `user.findUnique` + (za `USER`) `branchModerator.findMany` i gradi `request.user` sa efektivnim `distributionId` (`rest.distributionId ?? branch?.distributionId ?? moderatorDistributionId`).
   - Svi downstream servisi koriste `scopeWhere(scope, ...)` koja je **fail-closed**: ako `DIST_ADMIN` nema `distributionId` ili `USER` nema nijedan `branchId`/`branchModeratorBranchIds`, vraća `{ id: { in: [] } }`.

2. **Hijerarhija organizacije (`Distribution` -> `Branch` -> `User` / `BranchModerator`)**:
   - `SYSTEM_ADMIN` upravlja distribucijama i poslovnicama; `DIST_ADMIN` upravlja isključivo korisnicima i moderatorima svoje distribucije.
   - `USER` (monter) je vezan za jednu primarnu poslovnicu (`User.branchId`), a dodatno može moderirati 1..N poslovnica preko `BranchModerator(userId, branchId)`.

---

## 3. Identifikovani problemi, bugovi i uska grla

### Kritično (P0 — Direktni bugovi i sigurnosni rizici)

1. **[P0-1] `BranchModeratorsPage` šalje `limit: 200` a `PaginationDto` ima `@Max(100)` (`400 Bad Request`)**
   - **Gdje:** `frontend/src/pages/branch-moderators/BranchModeratorsPage.tsx:35`, `backend/src/common/dto/pagination.dto.ts:18`.
   - **Posljedica:** Otvaranje drawera za dodjelu moderatora poslovnice okida `GET /users?role=USER&limit=200`, što `AppValidationPipe` odbija sa `400 Bad Request`. Lista korisnika u selectu ostaje prazna i dodjela moderatora preko `BranchModeratorsPage` je slomljena.

2. **[P0-2] Eskalacija uloga i curenje starog `distributionId` / `branchId` / `BranchModerator` pri izmjeni korisnika**
   - **Gdje:** `frontend/src/pages/users/UsersListPage.tsx:314-319`, `backend/src/modules/users/users.service.ts:186-255`, `backend/src/modules/users/users.service.ts:276-297`.
   - **Posljedica:**
     - Na frontendu pri promjeni uloge (`DIST_ADMIN` <-> `USER`), nevažeće polje se šalje kao `undefined` umjesto `null`, pa Prisma u bazi **zadržava stari `distributionId` ili `branchId`**! Ako `DIST_ADMIN` pređe u `USER`, `JwtStrategy` mu i dalje čita `rest.distributionId` i zadržava pogrešan tenant kontekst; ako `USER` pređe u `DIST_ADMIN`, zadržava stari `branchId` (a `BranchModerator` zapisi takođe ostaju nepočišćeni).
     - U `UsersService.update`: `DIST_ADMIN` može samostalno promijeniti `dto.role` iz `USER` u `DIST_ADMIN` (i sebi ili drugom korisniku svoje distribucije dati admin ovlasti) ili promijeniti `status` korisniku bez brisanja aktivnog `refreshToken`-a. Također `UsersService.updateStatus` uopšte ne zabranjuje `DIST_ADMIN`-u da promijeni status `SYSTEM_ADMIN`-u (ukoliko taj `SYSTEM_ADMIN` ima `distributionId`/`branchId`), niti `update` / `updateStatus` čiste `refreshToken` kad se korisnik suspenduje/deaktivira ili mu admin promijeni lozinku.

3. **[P0-3] Agresivno brisanje sesije (`clearSession`) na mrežni prekid tokom `refresh` poziva (posebno opasno na terenu)**
   - **Gdje:** `mobile/src/api/axios.instance.ts:47`, `frontend/src/api/axios.instance.ts:48-51, 103-112`.
   - **Posljedica:** Ako monter na terenu ima loš signal ili timeout dok interceptor pokušava `POST /auth/refresh`, `catch` blok bezuslovno poziva `clearSession()` i briše token iz `SecureStore`-a (isto na webu). Korisnik je izbačen na login ekran usred terena iako refresh token nije nevažeći. Također, na webu 401 odgovor sa `/auth/login` ne preskače refresh granu ako je u store-u ostao neki stari token.

### Visoki prioritet (P1 — Poslovna logika, PostgreSQL migracija i performanse)

4. **[P1-1] PostgreSQL case-sensitive `search` u `UsersService.findAll` i `username` prijava**
   - **Gdje:** `backend/src/modules/users/users.service.ts:106-112`, `backend/src/modules/auth/auth.service.ts:346-360`.
   - **Posljedica:**
     - `UsersService.findAll` koristi `{ contains: filter.search }` bez `mode: 'insensitive'` (na PostgreSQL-u `marko` ne pronalazi `Marko`), i uopšte ne pretražuje po `username` koloni.
     - `AuthService.findUserByEmailOrUsername` za username ne radi `.trim().toLowerCase()`, pa mobilna tastatura (auto-capitalize prvog slova: `Marko.markovic`) uzrokuje lažni `Invalid credentials`.

5. **[P1-2] Jedan `refreshToken` po korisniku + skup `bcrypt` (cost 12) na svaki refresh**
   - **Gdje:** `backend/prisma/schema.prisma:146`, `backend/src/modules/auth/auth.service.ts:84-94, 200-209, 329-339`.
   - **Posljedica:**
     - Korisnik koji se prijavi na Web i Mobile (npr. `BRANCH_MODERATOR` ili admin na dva uređaja) gubi sesiju na prvom uređaju jer drugi login prepiše `user.refreshToken`.
     - `bcrypt.hash(sha256(token), 12)` i `bcrypt.compare` na svaki `POST /auth/refresh` troše ~250–350 ms CPU-a za visokoentropijski JWT, dok bi `HMAC-SHA256` (ili tabela `UserSession` sa max N sesija po korisniku + `HMAC-SHA256` hashom) radio za <0.1 ms i podržao više uređaja uz mogućnost "Odjavi sve uređaje".

6. **[P1-3] `JwtStrategy.validate` izvršava 2 DB upita na SVAKI HTTP zahtjev**
   - **Gdje:** `backend/src/modules/auth/strategies/jwt.strategy.ts:22-51`.
   - **Posljedica:** Svaki pojedinačni API poziv radi `user.findUnique` + dodatni `branchModerator.findMany` za `USER` ulogu. Spajanjem u jedan `select` (`branchModeratorRoles: { select: ... }`) ili kratkotrajnim TTL cache-om (uz invalidaciju na `UsersService.update/updateStatus` i `BranchModeratorsService.assign/remove`) smanjuje se broj DB upita za 50%–95%.

7. **[P1-4] Nedostajuća validacija `distributionId <-> branchId` i FK 500 greške pri kreiranju/brisanju**
   - **Gdje:** `backend/src/modules/users/users.service.ts:62-84, 261`, `distributions.service.ts:67-76`, `branches.service.ts:86-95`.
   - **Posljedica:**
     - `UsersService.create` ne provjerava postojanje `distributionId`/`branchId` niti da `branch.distributionId === dto.distributionId` (baca sirovi DB FK error ili dozvoljava korisniku `branchId` iz druge distribucije!).
     - `UsersService.remove` radi hard delete koji puca ako korisnik ima zapisnike/isporuke/zadatke umjesto sigurnog sprječavanja ili deaktivacije.
     - `DistributionsService.remove` ne provjerava `Shipment` i `User` veze; `BranchesService.remove` ne provjerava `User`, `BranchModerator`, `BranchEmailRecipient`.
     - `Distributions`, `Branches` i `BranchModerators` **ne pišu nijedan `ActivityLog` zapis** za `CREATE`/`UPDATE`/`DELETE`/`ASSIGN`/`REMOVE`.

8. **[P1-5] `UsersService.toUserListItem` baca već učitane `distribution` i `branch` nazive**
   - **Gdje:** `backend/src/modules/users/users.service.ts:75, 118, 141, 317-334`, `frontend/src/pages/users/UsersListPage.tsx:409-417`.
   - **Posljedica:** Backend već izvršava SQL `JOIN` na `distribution` i `branch`, ali ih ne vraća u DTO-u; zbog toga tabela korisnika na frontendu prikazuje samo generičku značku `"Distribucija"` / `"Poslovnica"` umjesto stvarnog naziva/koda organizacione jedinice.

### Srednji prioritet (P2 — UX, čistoća koda i održivost)

9. **[P2-1] `UsersListPage` nema pretragu ni filtere (uloga, status, distribucija, poslovnica)** iako backend `UserFilterDto` već podržava `search`, `role`, `status`.
10. **[P2-2] `UsersListPage` editovanje `moderatorBranchIds` race condition:** `pendingModeratorSync` koristi `branchModeratorAssignmentsQuery.data` koja može biti stale/loading ako se forma brzo snimi. Bolje je sinhronizaciju moderatora ili podržati direktno ili sačekati/validirati prije submita.
11. **[P2-3] `AuthModule` dead code:** `LocalStrategy` i `JwtRefreshStrategy` se ne koriste nigdje u kontrolerima; `AuthService.register` je duplikat `UsersService.create` bez podrške za `distributionId`/`branchId`.
12. **[P2-4] `BranchModeratorsService.findAll` ne podržava filter po `distributionId` niti paginaciju** (što će s rastom broja poslovnica usporiti prikaz), a `UsersListPage` ne prikazuje moderator dodjele za `DIST_ADMIN` u draweru korisnika.

---

## 4. Konkretan akcioni plan za Run 1 (čeka odobrenje)

Predlažem sljedeće izmjene u kodu (redoslijedom prioriteta):

### Paket A — Hitni popravci i sigurnost (P0)
1. **Popraviti `BranchModeratorsPage` + `UsersService` limit:**
   - U `BranchModeratorsPage.tsx` zamijeniti `limit: 200` sa `limit: 100` (ili uvesti pretragu `search` na serveru za korisnike preko 100, tj. `showSearch` s remote search-om ili paginiranim/dediciranim lookupom — idealno oboje: `limit: 100` + `onSearch` filter po `search`).
2. **Popraviti hijerarhiju uloga i čišćenje polja (`UsersService` + `UsersListPage`):**
   - U `UsersService.update`: zabraniti `DIST_ADMIN`-u promjenu `role` u `DIST_ADMIN`/`SYSTEM_ADMIN` (ili ograničiti da `DIST_ADMIN` ne može mijenjati `role` uopšte, samo profilne podatke i `branchId`/`status` za `USER` u svojoj distribuciji), te u `updateStatus` zabraniti `DIST_ADMIN`-u izmjenu statusa `SYSTEM_ADMIN`-a.
   - Pri promjeni statusa u `INACTIVE`/`SUSPENDED` ili promjeni `password` u `UsersService`, automatski obrisati `refreshToken: null` (trenutni opoziv sesije).
   - U `UsersService.create` & `update`: validirati da `distributionId` i `branchId` postoje, da `branch.distributionId === distributionId` (ako su oba zadana), i kad se rola mijenja na `USER` očistiti `distributionId: null` (a za `DIST_ADMIN` očistiti `branchId: null` + obrisati `BranchModerator` zapise ako korisnik više nije `USER`). U `UsersListPage.tsx` slati eksplicitno `null` umjesto `undefined`.
3. **Sigurno rukovanje `refresh` greškama na Webu i Mobilnom:**
   - U `mobile/src/api/axios.instance.ts` i `frontend/src/api/axios.instance.ts`:
     - Preskočiti refresh logiku za `/auth/login` i `/auth/refresh`.
     - Pozivati `clearSession()` **isključivo** kada `/auth/refresh` vrati HTTP `401` ili `403` (odbijen/nevažeći refresh token), a ne na mrežne greške / timeout / 5xx!

### Paket B — Poslovna logika, PostgreSQL i performanse (P1)
4. **PostgreSQL case-insensitive search + normalizacija username-a:**
   - `UsersService.findAll`: dodati `mode: 'insensitive'` na `email`, `firstName`, `lastName` i dodati `{ username: { contains: filter.search, mode: 'insensitive' } }`, plus opcione filtere `distributionId` i `branchId` u `UserFilterDto`.
   - `AuthService.findUserByEmailOrUsername`: dodati `.trim().toLowerCase()` i na `username` granu.
5. **Višestruke sesije (`UserSession` model) ili brzi `HMAC-SHA256` token hash:**
   - *(Odluka za tebe)*:
     - **Opcija 1 (Preporučena poslovna nadogradnja):** Novi model `UserSession` (`id`, `userId`, `tokenHash` sa `HMAC-SHA256`, `deviceLabel`/`platform`, `ipAddress`, `expiresAt`, `lastUsedAt`) — korisnik može biti prijavljen istovremeno na Webu i Mobitelu bez izbacivanja, a `logout` / promjena lozinke / suspenzija briše ili sve sesije ili samo trenutnu!
     - **Opcija 2 (Minimalna bez migracije baze):** Zamijeniti `bcrypt` hash refresh tokena brzim `HMAC-SHA256` (ubrzanje ~1000x, ali i dalje 1 sesija po korisniku).
6. **Jedan upit u `JwtStrategy.validate` + proširen `UserListItem`:**
   - Spojiti `user.findUnique` i `branchModeratorRoles` u jedan Prisma upit u `JwtStrategy.validate`.
   - Uključiti `distribution: { id, name, code }` i `branch: { id, name, code }` u `UserListItem` i prikazati stvarno ime distribucije/poslovnice u `UsersListPage` tabeli + dodati `FilterBar` (`search`, `role`, `status`) na `UsersListPage`.
7. **Bezbijedno brisanje i `ActivityLog` za organizaciju:**
   - Dodati `ActivityLog` u `DistributionsService`, `BranchesService` i `BranchModeratorsService`.
   - U `DistributionsService.remove` i `BranchesService.remove` provjeriti sve povezane entitete (`shipments`, `users`, `branchModerators`, `emailRecipients`, `meters`) i vratiti jasnu lokalizovanu `409 Conflict` poruku.
   - U `UsersService.remove` spriječiti hard delete ako korisnik ima povezane zapisnike, dodijeljene SIM kartice ili zadatke (preporučiti deaktivaciju `status = INACTIVE`).

### Paket C — Održivost i čistoća (P2)
8. Ukloniti nekorištene `LocalStrategy`/`JwtRefreshStrategy` ili ih povezati kako treba, te ukloniti duplikaciju kreiranja korisnika između `AuthService.register` i `UsersService.create`.

---

**Čekam tvoju potvrdu:**
1. Koje stavke iz **Paketa A / B / C** želiš da odmah implementiramo u kodu za Run 1 (npr. sve P0 + P1, i da li si za **Opciju 1: `UserSession` multi-device** ili **Opciju 2**)?
2. Nakon toga (ili odmah nakon implementacije Run 1), prelazimo na **Run 2 (`shipments` + `sim-cards`)**.
