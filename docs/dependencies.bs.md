# SIM Tracker — katalog dependencyja (BS)

Izvor: `backend/package.json`, `frontend/package.json`, `mobile/package.json`.

Pravilo čitanja:

- **Osnovne biblioteke** (framework/runtime) su navedene kratko.
- **Ne-osnovne** su opisane detaljno: *šta radi*, *zašto je korištena*, *gdje se koristi (putanje)*, *trade-off/alternative*.

---

## 1. Backend (`backend/`)

### 1.1 Osnovne (kratko)

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`: NestJS framework.
- `rxjs`: reaktivni utilities koje koristi NestJS.
- `reflect-metadata`: metadata support za dekoratore.
- `typescript`: TS toolchain (dev).

### 1.2 Ne-osnovne (detaljno)

- `@nestjs/config`
  - **Funkcija**: učitavanje env varova i tipiziran pristup konfiguraciji.
  - **Zašto**: centralno mjesto za `DATABASE_URL`, JWT secret-e, SMTP parametre.
  - **Gdje**: `backend/src/app.module.ts` (ConfigModule global), `backend/src/main.ts` (CORS/PORT), auth i mail moduli.
  - **Alternative**: direktno `process.env` (manje testabilno i teže za centralizaciju).

- `@prisma/client` + `prisma`
  - **Funkcija**: ORM i migracije prema MySQL-u.
  - **Zašto**: standardizovan data access sloj (playbook pravilo: Prisma je jedini DAO).
  - **Gdje**: `backend/src/prisma/**`, moduli kroz `PrismaService`.
  - **Trade-off**: strogo prati schema/migracije; raw SQL samo izuzetno.

- `@nestjs/jwt`, `passport`, `passport-jwt`, `passport-local`, `@nestjs/passport`
  - **Funkcija**: auth strategije (JWT access + refresh) i guard-ovi.
  - **Zašto**: industrijski standard za Nest auth; lak RBAC enforcement.
  - **Gdje**: `backend/src/modules/auth/**`, `backend/src/common/guards/**`.
  - **Alternative**: session-cookie auth (drugačiji ops i skaliranje).

- `bcrypt`
  - **Funkcija**: hash lozinki (i eventualno refresh tokena).
  - **Zašto**: sigurniji storage tajni; playbook minimum 12 rounds.
  - **Gdje**: `backend/src/modules/auth/**`, `backend/src/modules/users/**`, `backend/prisma/seed.ts`.
  - **Alternative**: `argon2` (često preporučen, ali drugačiji perf profil).

- `class-validator` + `class-transformer`
  - **Funkcija**: DTO validacija i transformacija request payload-a.
  - **Zašto**: API protokol (whitelist/forbid), stabilne greške i sigurnost.
  - **Gdje**: `backend/src/common/pipes/validation.pipe.ts`, DTO fajlovi po modulima.
  - **Alternative**: Zod/Joi (ali nest-idiom je class-validator).

- `@nestjs/swagger`
  - **Funkcija**: generisanje OpenAPI/Swagger UI.
  - **Zašto**: brza verifikacija contract-a i integracija.
  - **Gdje**: `backend/src/main.ts` (setup), dekoratori u controllerima/DTO.

- `@nestjs/throttler`
  - **Funkcija**: rate limiting.
  - **Zašto**: zaštita auth/scan/import/analytics od abuse i grešaka klijenata.
  - **Gdje**: `backend/src/app.module.ts` (global), `@Throttle` npr. u shipments import / scan / analytics.
  - **Trade-off**: in-memory limiter po instanci; za horizontalno skaliranje treba shared store (npr. Redis).

- `helmet`
  - **Funkcija**: sigurnosni HTTP headeri.
  - **Zašto**: osnovni security hardening u produkciji.
  - **Gdje**: `backend/src/main.ts`.

- `@nestjs/platform-socket.io` + `@nestjs/websockets`
  - **Funkcija**: WebSocket gateway preko Socket.IO.
  - **Zašto**: real-time notifikacije (uz fallback polling po playbooku).
  - **Gdje**: `backend/src/modules/notifications/notifications.gateway.ts`.
  - **Alternative**: SSE (jednostavnije, ali manje fleksibilno za bidirectional).

- `@nestjs-modules/mailer` + `nodemailer` + `handlebars`
  - **Funkcija**: SMTP slanje i templating email-a (Handlebars).
  - **Zašto**: WF-03 (approve → send), approval email notifikacije i sl.
  - **Gdje**: `backend/src/modules/mail/**`, templates u `backend/src/templates/email/**`.
  - **Trade-off**: SMTP pouzdanost (playbook rizik R-03); treba retry/observability.

- `puppeteer`
  - **Funkcija**: headless Chromium render u PDF.
  - **Zašto**: generisanje PDF zapisnika iz HTML template-a (WF-03).
  - **Gdje**: servis za PDF generaciju u modulu zapisnika; playbook P3 opisuje Puppeteer + Handlebars.
  - **Trade-off**: veći runtime footprint; u Dockeru često treba `--no-sandbox`.
  - **Alternative**: `playwright` (PDF), `pdfkit` (programatski PDF bez HTML).

- `xlsx`
  - **Funkcija**: čitanje Excel/CSV fajlova.
  - **Zašto**: WF-01 import SIM batch-eva sa preview/validacijom.
  - **Gdje**: shipments import servis (`backend/src/modules/shipments/import/**`).
  - **Alternative**: `exceljs` (drugačiji API), ali `xlsx` je dovoljno za parsing.

- `@types/multer`
  - **Funkcija**: TS tipovi za multer (upload).
  - **Gdje**: upload photo endpoint u installation records.

- `jest`, `supertest`, `ts-jest`
  - **Funkcija**: unit/integration/e2e testovi.
  - **Zašto**: phase gate zahtijeva e2e za WF-01/02/03.
  - **Gdje**: `backend/test/**`, `backend/scripts/*smoke*.ts`.

---

## 2. Frontend (`frontend/`)

### 2.1 Osnovne (kratko)

- `react`, `react-dom`: UI runtime.
- `react-router-dom`: SPA routing.
- `vite`: dev server + build.
- `typescript`: typecheck/build.

### 2.2 Ne-osnovne (detaljno)

- `antd` + `@ant-design/icons`
  - **Funkcija**: UI komponentna biblioteka + ikone.
  - **Zašto**: brzo graditi admin/operativne ekrane (tabele, forme, modali, layout).
  - **Gdje**: cijeli UI; `frontend/src/main.tsx` koristi AntD `ConfigProvider`.
  - **Trade-off**: teži “custom” dizajn bez theme tokena; CSS override oprezno.

- `tailwindcss` + `postcss` + `autoprefixer`
  - **Funkcija**: utility-first styling.
  - **Zašto**: brzi spacing/layout detalji uz AntD komponente.
  - **Gdje**: globalni stilovi `frontend/src/styles/index.css` i komponentni className.

- `axios`
  - **Funkcija**: HTTP client.
  - **Zašto**: interceptori za attach token + refresh flow.
  - **Gdje**: `frontend/src/api/axios.instance.ts` + `frontend/src/api/*.api.ts`.
  - **Alternative**: fetch + custom wrapper (više ručnog posla).

- `@tanstack/react-query`
  - **Funkcija**: server state (cache, refetch, invalidation).
  - **Zašto**: konzistentan UI state i “soft refresh” nakon WS eventa.
  - **Gdje**: `frontend/src/main.tsx` (provider) + stranice/hookovi.
  - **Trade-off**: disciplina oko queryKey standarda.

- `zustand`
  - **Funkcija**: client state (auth session, tour state).
  - **Zašto**: jednostavan store sa persistom; “getState” za axios interceptore.
  - **Gdje**: `frontend/src/store/auth.store.ts`, `frontend/src/store/tour.store.ts`.
  - **Alternative**: Redux Toolkit (više boilerplate).

- `socket.io-client`
  - **Funkcija**: WS konekcija na backend notifikacije.
  - **Zašto**: playbook zahtijeva live notifikacije + fallback.
  - **Gdje**: `frontend/src/hooks/useNotificationSocket.ts`.
  - **Trade-off**: reconnect/dedupe mora biti pažljivo dizajniran.

- `dayjs`
  - **Funkcija**: standardizacija datuma i vremena u UI.
  - **Zašto**: playbook pravilo (R-M-03), manje bugova u formatiranju.
  - **Gdje**: prikazi datuma u tabelama/detaljima.
  - **Alternative**: `date-fns`, Luxon.

---

## 3. Mobile (`mobile/`)

### 3.1 Osnovne (kratko)

- `react`, `react-native`: mobile runtime.
- `expo`: Expo platform.
- `expo-router`: file-based routing.
- `typescript`: typecheck.

### 3.2 Ne-osnovne (detaljno)

- `@tanstack/react-query`
  - **Funkcija**: server state, cache, refetch.
  - **Zašto**: konzistentan UI na home/records/notifications.
  - **Gdje**: `mobile/app/_layout.tsx` + screenovi.

- `zustand`
  - **Funkcija**: auth store + hydration flag.
  - **Zašto**: jednostavan store koji radi dobro sa SecureStore.
  - **Gdje**: `mobile/src/store/auth.store.ts`.

- `axios`
  - **Funkcija**: HTTP client + refresh flow.
  - **Gdje**: `mobile/src/api/axios.instance.ts`.

- `expo-secure-store`
  - **Funkcija**: sigurna perzistencija tokena i offline queue-a.
  - **Zašto**: tokeni i offline payload-i ne smiju biti u plain storage.
  - **Gdje**: `mobile/src/utils/storage.ts`, `mobile/src/api/installation-records.api.ts`.
  - **Alternative**: MMKV (brže, ali drugačije sigurnosne/ops implikacije).

- `expo-camera`
  - **Funkcija**: kamera i barcode skeniranje.
  - **Zašto**: WF-02 “scan” je core mobile tok.
  - **Gdje**: `mobile/app/(app)/(tabs)/scan.tsx`.

- `expo-location`
  - **Funkcija**: GPS koordinata (foreground).
  - **Zašto**: zapisnik može sadržati geo lokaciju za audit/operativu.
  - **Gdje**: `mobile/app/(app)/create-record.tsx`.

- `expo-image-picker`
  - **Funkcija**: fotografija (kamera) + upload.
  - **Zašto**: foto dokaz instalacije.
  - **Gdje**: `mobile/app/(app)/create-record.tsx`, upload preko `installationRecordsApi.uploadPhoto`.

- `expo-notifications`
  - **Funkcija**: push notifikacije (permission, token, response handler).
  - **Zašto**: dodatni kanal obavještavanja + deep link.
  - **Gdje**: `mobile/src/hooks/usePushNotifications.ts`.
  - **Trade-off**: push je best-effort; in-app notifikacije ostaju source of truth.

- `expo-linking`
  - **Funkcija**: deep link podrška.
  - **Zašto**: klik na push vodi na zapisnik ili notifikacije ekran.
  - **Gdje**: routing kroz expo-router + `scheme` u `mobile/app.json`.

- `@react-navigation/native`, `react-native-screens`, `react-native-safe-area-context`
  - **Funkcija**: navigation primitives i performanse.
  - **Zašto**: expo-router koristi React Navigation ispod haube.

- `babel-plugin-module-resolver`
  - **Funkcija**: aliasi (npr. `@/`).
  - **Zašto**: čitljiviji importi u TS.

