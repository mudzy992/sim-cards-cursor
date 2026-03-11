# SIM Tracker — vodič za podizanje sistema (Docker + Windows/Linux)

Ovaj dokument objedinjuje:

- lokalni development setup
- Docker Compose (backend + MySQL)
- produkcijski deploy na Linux i Windows server

Referenca: `docs/production-runbook.md` (smoke test + produkcioni koraci).

---

## 1. Preduvjeti

### 1.1 Lokalno (dev)

- Node.js 20+
- npm
- MySQL 8.x (ili Docker)

### 1.2 Docker okruženje

- Docker Engine
- Docker Compose v2

---

## 2. Lokalno pokretanje (bez Dockera)

### 2.1 Backend

U `backend/`:

- kopirati env:
  - `.env.example` → `.env`
- instalacija i prisma:
  - `npm install`
  - `npm run prisma:generate`
  - `npm run prisma:migrate`
  - `npm run prisma:seed` (kreira admin korisnika iz env varova)
- start:
  - `npm run start:dev`

Provjera:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

### 2.2 Frontend

U `frontend/`:

- `.env.example` → `.env`
- `npm install`
- `npm run dev`

Provjera:

- Web: `http://localhost:5173`

### 2.3 Mobile

U `mobile/`:

- `.env.example` → `.env`
- `npm install`
- `npm run start`

Napomena:

- `EXPO_PUBLIC_API_BASE_URL` treba biti vidljiv uređaju/emulatoru (npr. LAN IP hosta), ne uvijek `localhost`.

---

## 3. Docker Compose (preporučeni lokalni/staging setup)

Root `docker-compose.yml` podiže:

- `db` (MySQL)
- `backend` (NestJS runtime image)

### 3.1 Pokretanje

U root folderu:

- `docker compose up -d db`
- `docker compose up -d backend`

Migracije (jednokratno ili kod deploy-a):

- `docker compose run --rm backend npm run prisma:migrate`
- (opciono) seed:
  - `docker compose run --rm backend npm run prisma:seed`

### 3.2 Uploads direktorij (bind mount)

Compose mapira host direktorij:

- host: `/mnt/shared-app-files/sim-cards-codex`
- container: `/usr/app/uploads`

**Važno (path mismatch):**

- Backend kod (upload/serve) koristi `process.cwd()/uploads` (npr. `/usr/src/app/uploads`).
- Dockerfile koristi `WORKDIR /usr/src/app`, ali volume je definisan kao `/usr/app/uploads`.

Preporučene opcije za produkciju:

- **Opcija A (najčistije)**: standardizovati da aplikacija koristi env var `UPLOAD_DIR` i čita/piše u taj direktorij (npr. `/usr/app/uploads`), pa uskladiti kod + compose.
- **Opcija B (brza ops korekcija)**: mapirati volume na putanju koja se zaista koristi u runtime-u (npr. bind mount na `/usr/src/app/uploads`) ili dodati symlink u image-u (uz oprez).

Dokumentaciono pravilo: prije produkcije mora biti jasno definisana “jedina istina” za uploads putanju.

---

## 4. Produkcijski deploy (Linux server)

Minimalna preporuka: Ubuntu 22.04+ / Debian 12+, Docker + Compose.

### 4.1 Priprema

- kreirati uploads direktorij na host-u:
  - `/mnt/shared-app-files/sim-cards-codex`
- dati prava (write) korisniku koji pokreće docker.
- pripremiti `backend/.env` sa produkcijskim vrijednostima:
  - `DATABASE_URL` (prod)
  - `JWT_SECRET` + `JWT_REFRESH_SECRET`
  - SMTP parametri

### 4.2 Deploy koraci (prema `docs/production-runbook.md`)

- `git pull`
- `docker compose build backend` (ili `docker compose pull` ako imate registry)
- `docker compose up -d db`
- migracije:
  - `docker compose run --rm backend npm run prisma:migrate`
- `docker compose up -d backend`

### 4.3 Reverse proxy i TLS (preporučeno)

U produkciji se preporučuje:

- Nginx/Traefik ispred backend-a (TLS termination)
- CORS `FRONTEND_URL` postaviti na stvarni web domen
- Firewall: otvoriti samo potrebne portove (80/443 spolja; 3000 interno)

### 4.4 Backup i rollback

- DB backup:
  - redovni `mysqldump` ili snapshot volumen-a
- Rollback:
  - rollback docker image-a + migracijski rollback plan (playbook REL-03)
- Smoke test nakon deploy-a (vidi sekciju 6).

---

## 5. Produkcijski deploy (Windows server)

Praktične opcije:

- **Opcija A**: Windows Server + Docker Desktop (manje idealno za server)
- **Opcija B**: Windows Server + WSL2 + Docker Engine u WSL2 (češća praksa)
- **Opcija C**: hostovati backend na Linux VM-u (na Hyper-V) i zadržati Windows samo kao host

Ključne napomene:

- Putanja `/mnt/shared-app-files/...` je Linux stil; na Windows-u je preporučeno:
  - koristiti WSL2 i mount-ovati Windows folder u WSL (npr. `/mnt/c/...`)
  - ili promijeniti compose mount path da odgovara Windows filesystem-u (npr. `C:\\shared\\sim-cards-codex` → container path)
- Networking:
  - portovi 3000 (API) i 3306 (DB, samo interno po potrebi) moraju biti ispravno mapirani i zaštićeni firewall-om

---

## 6. Smoke test (minimalno, nakon podizanja)

Preporučeni set (prema `docs/production-runbook.md` i playbook WF-01/02/03):

- **Backend**:
  - `GET /api/docs` dostupan
  - `npm test` (unutar kontejnera ili CI)
- **Web**:
  - login kao SYSTEM_ADMIN
  - dashboard učitava KPI
  - import tok (WF-01) prolazi barem preview
- **Mobile**:
  - login
  - scan → claim → create record
  - offline queue: ugasiti mrežu, kreirati record, vratiti mrežu, otvoriti Records i provjeriti sync

---

## 7. CI/CD (kratko)

Repo sadrži GitHub Actions CI workflow (`.github/workflows/ci.yml`) koji tipično pokriva:

- backend: typecheck/lint/test
- frontend: typecheck/build
- (opciono) docker build

Produkcijski release gate (playbook):

- nema otvorenih P0/P1 bugova
- e2e workflow-i (WF-01/02/03) prolaze
- migracije testirane + rollback plan
- env var set kompletan i validiran

