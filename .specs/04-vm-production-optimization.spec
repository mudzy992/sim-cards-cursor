# SPEC 04 — VM & Production Readiness Optimization
**Prioritet:** P1 (Critical) & P2 (High)
**Opseg:** `backend/src/main.ts`, `backend/src/prisma/prisma.service.ts`, `backend/src/health.controller.ts`, `backend/src/common/interceptors/timeout.interceptor.ts`, `backend/src/common/utils/pdf-generator.service.ts`, `backend/src/modules/app-releases/app-releases.service.ts`, `backend/prisma/seed.ts`, `backend/Dockerfile`, `backend/Dockerfile.vm`, `backend/Dockerfile.deps`, `frontend/nginx.conf`, `docker-compose.vm.*.yml`

---

## 1. P1 — Stability, Memory Leaks, Graceful Shutdown & Container Hardening

### 1.1 Puppeteer / Chromium Memory Leak & Crash Prevention
- **Fajl:** `backend/src/common/utils/pdf-generator.service.ts`
- **Problemi:**
  1. `puppeteer.launch(...)` se poziva za SVAKI PDF zahtjev i nema `try { ... } finally { await browser.close(); }` -> ako `page.setContent` ili `page.pdf` baci izuzetak, Chromium proces ostaje zombi u RAM-u (~150-300MB po leak-u -> OOM na VM-u).
  2. Nedostaje `--disable-dev-shm-usage` flag -> Docker default `/dev/shm` od 64MB dovodi do rušenja Chromium tabova.
  3. Koristi `data: any` parametar.
- **Rješenje:**
  1. Dodati `try / finally` za garantovano zatvaranje stranice i browsera (ili pool/shared browser instance sa automatskim reconnectom i max concurrency semaforom npr. max 2-3 paralelna rendera radi zaštite CPU/RAM-a na VM-u).
  2. Dodati `'--disable-dev-shm-usage'` i `'--disable-gpu'` u `args`, uz eksplicitni `timeout` na `setContent` i `pdf`.
  3. Zamijeniti `data: any` sa tipiziranim interfejsom.

### 1.2 Graceful Shutdown & PostgreSQL Connection Lifecycle
- **Fajlovi:** `backend/src/main.ts`, `backend/src/prisma/prisma.service.ts`, `docker-compose.vm.app.yml`
- **Problemi:**
  1. `main.ts` ne poziva `app.enableShutdownHooks()` i sluša samo `process.env.PORT ?? 3003` bez eksplicitnog `'0.0.0.0'` hosta.
  2. `PrismaService.enableShutdownHooks` koristi `process.on('beforeExit', ...)` koji se NE aktivira na `SIGTERM` / `SIGINT` u Docker kontejneru.
  3. `docker-compose.vm.app.yml` nema `init: true` -> Node kao PID 1 ne prosljeđuje/reap-uje pravilno signale i zombi procese (npr. Chromium).
- **Rješenje:**
  1. U `main.ts`: pozvati `app.enableShutdownHooks()` i `await app.listen(port, '0.0.0.0')`.
  2. U `PrismaService`: implementirati `OnModuleDestroy` (`async onModuleDestroy() { await this.$disconnect(); }`) i ukloniti nepouzdani `beforeExit` hook.
  3. U `docker-compose.vm.app.yml`: dodati `init: true`, `stop_grace_period: 30s`, `mem_limit` / `cpus` limite, i `shm_size: '256m'` (ili oslonac na `--disable-dev-shm-usage`).

### 1.3 Healthcheck Endpoint & Docker Healthcheck
- **Fajlovi:** `backend/src/health.controller.ts`, `docker-compose.vm.app.yml`
- **Problemi:**
  1. `GET /api/health` vraća statičnih `{ status: 'ok' }` bez provjere PostgreSQL konekcije.
  2. `docker-compose.vm.app.yml` ima zakomentarisan/uklonjen healthcheck za backend kontejner.
- **Rješenje:**
  1. U `HealthController`: izvršiti lagani `await this.prisma.$queryRaw` (`SELECT 1`) uz timeout; vratiti `503 Service Unavailable` ako baza nije dostupna.
  2. U `docker-compose.vm.app.yml`: dodati Docker `healthcheck` koji gađa `http://127.0.0.1:3003/api/health` (uz `start_period: 25s`, `interval: 30s`, `retries: 3`).

### 1.4 250MB APK Upload Memory/Event-Loop Fix
- **Fajlovi:** `backend/src/modules/app-releases/app-releases.controller.ts`, `backend/src/modules/app-releases/app-releases.service.ts`
- **Problem:** Multer koristi default `memoryStorage()` za `.apk` fajlove do 250MB, zatim `service` radi sinhroni `fs.writeFileSync` i `crypto.createHash('sha256').update(buffer)` u glavnom threadu -> do 500MB RAM spike i blokiranje event loop-a.
- **Rješenje:** Prebaciti upload na `diskStorage` (temp fajl u upload direktoriju), računati SHA-256 preko `fs.createReadStream` (`pipeline`), i premjestiti fajl async metodama (`fs.promises.rename` / `unlink` pri grešci).

### 1.5 Global Timeout vs Long-Running Operations
- **Fajl:** `backend/src/common/interceptors/timeout.interceptor.ts`
- **Problem:** Globalni `timeout(15_000)` na svim rutama prekida velike Excel importe (`POST /shipments/:id/import`), generisanje većih PDF-ova i upload APK-a od 250MB.
- **Rješenje:** Napraviti `@RequestTimeout(ms)` dekorator + `Reflector` u `TimeoutInterceptor` (npr. 15s default, 120s za import/upload/PDF rute).

---

## 2. P2 — Production Config, Security Headers, Container Hygiene & Seed Safety

### 2.1 `main.ts` CORS & Swagger Production Guard
- **Fajl:** `backend/src/main.ts` (linije 53–70, 145–167)
- **Problemi:**
  1. CORS uvijek bezuslovno dodaje `localhost` i `127.0.0.1` na allowlistu i provjerava samo `url.hostname` (ignorišući shemu/port).
  2. Swagger (`/api/docs`) se montira bezuslovno i u produkciji.
- **Rješenje:**
  1. `localhost`/`127.0.0.1` dodavati samo kad je `APP_ENV !== 'production'` (ili `NODE_ENV !== 'production'`); porediti puni `origin` (`protocol + host + port`).
  2. Montirati Swagger samo kad je `APP_ENV !== 'production'` ili `ENABLE_SWAGGER === 'true'`.

### 2.2 `backend/Dockerfile.vm` & `backend/Dockerfile` Hardening
- **Fajlovi:** `backend/Dockerfile.vm`, `backend/Dockerfile`
- **Problemi:** Oba image-a pokreću proces kao `root` user; `Dockerfile.vm` zadržava sve `devDependencies` u runtime stage-u.
- **Rješenje:**
  1. Kreirati/koristiti non-root korisnika (`USER node` ili namjenski `appuser`) sa `chown` na `/usr/app/uploads` i `/usr/app`.
  2. Osigurati da runtime ima samo potrebne fajlove (`dist/`, `node_modules/`, `prisma/`, `templates/`).

### 2.3 `frontend/nginx.conf` Optimization & TLS Header Fix
- **Fajl:** `frontend/nginx.conf`
- **Problemi:**
  1. Postavlja `Strict-Transport-Security` header preko HTTP port 80 dok Traefik na VM-u servira čisti HTTP (`10.10.10.30`).
  2. Nedostaje `gzip` kompresija za JS/CSS/JSON/SVG i dugoročni `Cache-Control: public, max-age=31536000, immutable` za Vite `/assets/*` sa content-hash imenima (dok `index.html` treba `no-cache`).
  3. Nedostaje `Content-Security-Policy` i `Permissions-Policy`.
- **Rješenje:**
  1. Uključiti `gzip on`, `gzip_types`, `gzip_min_length 1024`.
  2. Dodati poseban `location /assets/` sa `immutable` cache headerima i `no-cache` za `index.html`.
  3. Ukloniti HSTS iz plain-HTTP server bloka (HSTS pripada TLS terminatoru / Traefik HTTPS ruteru) i dodati odgovarajući `Content-Security-Policy` kompatibilan sa AntD/OSM embedom.

### 2.4 `docker-compose.vm.*.yml` & `seed.ts` Safety
- **Fajlovi:** `docker-compose.vm.db.yml`, `docker-compose.vm.app.yml`, `backend/prisma/seed.ts`
- **Problemi:**
  1. Hardkodirana default šifra `nije,kikiriki` u oba compose fajla.
  2. `seed.ts` loguje puni `DATABASE_URL` (sa DB lozinkom!) u stdout i ima fallback admin lozinku `ChangeMe123!`.
- **Rješenje:**
  1. Zamijeniti hardcoded fallback lozinku sa obaveznim `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}` u compose fajlovima.
  2. U `seed.ts` maskirati lozinku prije logovanja `DATABASE_URL` i spriječiti seedovanje sa default lozinkom `ChangeMe123!` u produkciji (`if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) throw ...`).

### 2.5 Frontend Bundle & Production Logging
- Konfigurisati `build.rollupOptions.output.manualChunks` u `frontend/vite.config.ts` (odvojiti `antd`, `@tanstack/react-query`, `react-router-dom` radi boljeg keširanja).
- Zamijeniti `Logger` plain-text format u produkciji opcionalnim JSON strukturisanim logovanjem i dodati `X-Request-Id` korelaciju u `LoggingInterceptor`.
