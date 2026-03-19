---
name: sim-cards-codex-deploy-pipeline
overview: Plan za podešavanje env fajlova, upload sistema, Docker/Docker Compose/Traefik konfiguracije i GitHub Actions CI/CD workflowa za automatski deploy backend i frontend servisa na server sa Dockerom.
todos:
  - id: todo-env-backend
    content: Ažurirati backend .env (DB, URL-ovi, upload varijable) i osigurati da backend kod koristi te varijable.
    status: completed
  - id: todo-env-frontend-mobile
    content: Ažurirati frontend i mobile .env vrijednosti za produkcijski API i upload URL-ove.
    status: completed
  - id: todo-upload-backend
    content: Implementirati upload servis i static serviranje fajlova u backendu koristeći UPLOAD_ROOT_PATH i UPLOAD_PUBLIC_PREFIX.
    status: completed
  - id: todo-docker-backend-frontend
    content: Kreirati ili doraditi Dockerfile-ove za backend i frontend, uključujući Nginx konfiguraciju za frontend.
    status: completed
  - id: todo-compose-traefik
    content: Kreirati ili doraditi root docker-compose.yml sa Traefik integracijom i upload volume mappingom.
    status: completed
  - id: todo-github-actions
    content: Kreirati GitHub Actions workflow za automatski deploy koji detektuje promjene u backend/frontend direktorijima i restartuje samo potrebne servise na serveru.
    status: completed
isProject: false
---

## Plan za deploy i CI/CD za sim-cards-codex

### 1. Konfiguracija okruženja i URL-ova

- **Backend `.env`** (`[backend/.env](backend/.env)`):
  - Ostaviti `DATABASE_URL` sa MySQL konekcijom na `inventory.hopto.org:3306` sa korisnikom `mudzy` i lozinkom `nije,kikiriki` (već postoji u fajlu).
  - Postaviti `PORT=3000` (ili ostaviti ako je već tako).
  - Postaviti `FRONTEND_URL="https://sim-tracker.hopto.org"` (produkcijski URL bez `/backend`).
  - Dodati varijable za upload sistem, tako da se lako mijenjaju:
    - `UPLOAD_ROOT_PATH="/usr/app/uploads"` (putanja u kontejneru).
    - `UPLOAD_PUBLIC_PREFIX="/backend/uploads"` (URL prefix preko kojega će se fajlovi služiti prema vani).
- **Frontend `.env`** (`[frontend/.env](frontend/.env)`):
  - Zamijeniti `VITE_API_BASE_URL` iz lokalnog u produkcijski:
    - `VITE_API_BASE_URL="https://sim-tracker.hopto.org/backend/api"` (pretpostavka da backend API i dalje koristi `/api` prefix).
- **Mobile `.env` / `.env.example`** (`[mobile/.env.example](mobile/.env.example)` i eventualno `[mobile/.env](mobile/.env)`):
  - Postaviti:
    - `EXPO_PUBLIC_API_BASE_URL="https://sim-tracker.hopto.org/backend/api"`.
  - Ako mobilna aplikacija koristi dodatne URL-ove (npr. za upload), definirati i npr. `EXPO_PUBLIC_UPLOAD_BASE_URL="https://sim-tracker.hopto.org/backend/uploads"`.

### 2. Upload sistem i static fajlovi

- **Backend kod (npr. NestJS/Express)**:
  - U glavnom fajlu aplikacije (npr. `[backend/src/main.ts](backend/src/main.ts)` ili slično):
    - Pročitati `UPLOAD_ROOT_PATH` i `UPLOAD_PUBLIC_PREFIX` iz `process.env`.
    - Postaviti static middleware da služi fajlove iz `UPLOAD_ROOT_PATH` pod URL-om `UPLOAD_PUBLIC_PREFIX` (npr. `app.use(UPLOAD_PUBLIC_PREFIX, express.static(UPLOAD_ROOT_PATH))`).
  - U servisima koji rade upload:
    - Koristiti `UPLOAD_ROOT_PATH` za fizičku lokaciju na disku.
    - Kod generisanja URL-a fajlova, koristiti `UPLOAD_PUBLIC_PREFIX` + ime fajla, kombinovano sa baznim URL-om API-ja.
- **Docker Compose volume mapping**:
  - U `docker-compose.yml` na root-u projekta (`[docker-compose.yml](docker-compose.yml)`):
    - Definisati volume za upload:
      - `- /mnt/shared-files/sim-card-tracker:/usr/app/uploads` za backend servis.
    - Time se ispunjava zahtjev da se fajlovi fizički čuvaju na hostu (`/mnt/shared-files/sim-card-tracker`) i da su u kontejneru pod `/usr/app/uploads`.

### 3. Security i HTTP(S) headere

- **Backend security headere**:
  - Uvesti `helmet` (ili ručno postavljene headere) u backend aplikaciji:
    - `Strict-Transport-Security` (HSTS) – npr. `max-age=31536000; includeSubDomains`.
    - `X-Content-Type-Options: nosniff`.
    - `X-Frame-Options: DENY` (ili `SAMEORIGIN` ako treba embed).
    - `Referrer-Policy: strict-origin-when-cross-origin`.
    - `X-XSS-Protection: 0` (moderni preglednici; ili odgovarajući CSP ako se bude uvodio).
  - Provjeriti CORS konfiguraciju da dopušta pozive sa `https://sim-tracker.hopto.org`.
- **Frontend security headere**:
  - Pošto frontend će biti serviran preko Nginx-a (ili drugog web servera), u Nginx konfiguraciji:
    - Postaviti iste ključne headere (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
  - Ostaviti mogućnost kasnijeg dodavanja Content Security Policy (CSP) ako bude potrebno.

### 4. Dockerfile za backend

- **Lokacija**: `[backend/Dockerfile](backend/Dockerfile)` (može se prilagoditi postojećem fajlu).
- **Struktura** (multi-stage build):
  - Stage 1 (build):
    - `FROM node:20-alpine` (ili verzija koju već koristite).
    - `WORKDIR /usr/app`.
    - Kopirati `package.json` i `package-lock.json` (ili `pnpm-lock.yaml`/`yarn.lock`), pokrenuti `npm ci` / `npm install`.
    - Kopirati ostatak koda i pokrenuti `npm run build` (npr. `nest build` ili `tsc`).
  - Stage 2 (runtime):
    - `FROM node:20-alpine`.
    - `WORKDIR /usr/app`.
    - Kopirati `node_modules` i build artefakte iz build stage-a.
    - Kreirati direktorij `/usr/app/uploads` (ali će biti mount-ovan volume).
    - Expose `PORT 3000`.
    - `CMD ["node", "dist/main.js"]` ili odgovarajući start command.
  - Obezbijediti da backend koristi `UPLOAD_ROOT_PATH=/usr/app/uploads` kroz env (ne hardkodirati putanju u kodu).

### 5. Dockerfile za frontend

- **Lokacija**: `[frontend/Dockerfile](frontend/Dockerfile)`.
- **Struktura** (Vite + Nginx):
  - Stage 1 (build):
    - `FROM node:20-alpine`.
    - `WORKDIR /usr/app`.
    - Kopirati `package.json`/`lock` i `npm ci`.
    - Kopirati frontend kod i pokrenuti `npm run build` (Vite build).
  - Stage 2 (serve):
    - `FROM nginx:alpine`.
    - Kopirati build output (npr. `dist`) u `/usr/share/nginx/html`.
    - Dodati custom Nginx config fajl (npr. `[frontend/nginx.conf](frontend/nginx.conf)`) koji:
      - Servira SPA (fallback na `index.html` za nepoznate rute).
      - Postavlja security headere.
    - Expose `80`.

### 6. Docker Compose i Traefik integracija

- **Root `docker-compose.yml`**:
  - Definisati eksternu mrežu koju koristi Traefik:
    - `networks: web: external: true` (naziv mreže tačno `web`, kako je već na serveru).
  - Definisati servise:
    - **Backend servis** (npr. `backend`):
      - `build: ./backend`.
      - `env_file: ./backend/.env`.
      - `volumes: - /mnt/shared-files/sim-card-tracker:/usr/app/uploads`.
      - `networks: - web`.
      - Traefik labels:
        - `traefik.enable=true`.
        - `traefik.http.routers.simtracker-backend.rule=Host(`"sim-tracker.hopto.org"`) && PathPrefix(`/backend`)`.
        - `traefik.http.routers.simtracker-backend.entrypoints=websecure`.
        - `traefik.http.routers.simtracker-backend.tls=true`.
        - `traefik.http.routers.simtracker-backend.tls.certresolver=letsencrypt` (ili ime resolvera koji već koristite).
        - `traefik.http.services.simtracker-backend.loadbalancer.server.port=3000`.
    - **Frontend servis** (npr. `frontend`):
      - `build: ./frontend`.
      - `networks: - web`.
      - Traefik labels:
        - `traefik.enable=true`.
        - `traefik.http.routers.simtracker-frontend.rule=Host(`"sim-tracker.hopto.org"`) && PathPrefix(`/`)`.
        - `traefik.http.routers.simtracker-frontend.entrypoints=websecure`.
        - `traefik.http.routers.simtracker-frontend.tls=true`.
        - `traefik.http.routers.simtracker-frontend.tls.certresolver=letsencrypt`.
        - `traefik.http.services.simtracker-frontend.loadbalancer.server.port=80`.
  - Traefik sam po sebi može biti u istom ili zasebnom Compose fajlu – bitno je da svi servisi budu na mreži `web`.

### 7. GitHub Actions CI/CD workflow

- **Secrets i env u GitHub repo**:
  - U `Settings -> Secrets and variables -> Actions` postaviti:
    - `SSH_PRIVATE_KEY` – privatni ključ za pristup serveru.
    - `SERVER_USER` – korisničko ime na serveru.
    - `SERVER_SSH_PORT` – SSH port (npr. `22` ili custom).
    - `SERVER_IP` – javna IP adresa servera.
    - `APP_PATH` – putanja na serveru gdje je kloniran repo (npr. `/opt/apps/sim-cards-codex`).
- **Workflow fajl**: kreirati `[.github/workflows/deploy.yml](.github/workflows/deploy.yml)` sa sljedećom logikom:
  - Trigger:
    - `on: push: branches: ["main"]`.
  - Job `deploy` koji radi na `ubuntu-latest`:
    - **Korak: Checkout** koda (`actions/checkout@v4`) sa full history (radi detekcije promjena).
    - **Korak: Odredi šta se promijenilo**:
      - Pokrenuti `git diff --name-only ${{ github.event.before }} ${{ github.sha }}` i spremiti listu fajlova.
      - Postaviti output varijable `backend_changed` i `frontend_changed` na osnovu toga da li je neki fajl u `backend/` ili `frontend/` direktoriju.
    - **Korak: Priprema SSH**:
      - Koristiti `SSH_PRIVATE_KEY` da se kreira `~/.ssh/id_rsa` i postave permisije.
      - Dodati server u `known_hosts` (npr. `ssh-keyscan -p $SERVER_SSH_PORT $SERVER_IP >> ~/.ssh/known_hosts`).
    - **Korak: Deploy na server** (single SSH komanda):
      - Povezati se na server: `ssh -p $SERVER_SSH_PORT $SERVER_USER@$SERVER_IP`.
      - Unutar SSH sesije:
        - `cd $APP_PATH`.
        - `git pull origin main`.
        - Na osnovu prenesenih flagova `BACKEND_CHANGED` i `FRONTEND_CHANGED`:
          - Ako je `BACKEND_CHANGED == true`:
            - `docker compose build backend` (ili `docker compose pull backend` ako se koristi registry).
            - `docker compose up -d backend`.
          - Ako je `FRONTEND_CHANGED == true`:
            - `docker compose build frontend`.
            - `docker compose up -d frontend`.
        - Ako su oba promijenjena, izvršiti oba bloka.
      - Flagove proslijediti iz GitHub Actions u SSH komandu kao env varijable (`BACKEND_CHANGED`, `FRONTEND_CHANGED`).
- **Fallback scenarij**:
  - Ako iz bilo kojeg razloga detekcija promjena ne radi (npr. prvi deploy gdje `github.event.before` nije setovan), workflow može defaultno deployati oba servisa.

### 8. Pregled toka sistema (visok nivo)

```mermaid
flowchart LR
  developer[Developer Push] --> github[GitHub Repo]
  github --> ci[GitHub Actions Deploy Job]
  ci -->|SSH using secrets| server[App Server]
  server -->|git pull main| repoDir[APP_PATH]
  repoDir --> compose[Docker Compose]
  compose --> backendSvc[Backend Container]
  compose --> frontendSvc[Frontend Container]
  backendSvc -->|uploads volume| hostUploads[/mnt/shared-files/sim-card-tracker]
  backendSvc --> mysql[(MySQL inventory.hopto.org:3306)]
  frontendSvc --> traefik[Traefik]
  backendSvc --> traefik
  traefik --> userBrowser[User/Mobile Client]
```



### 9. To-do koraci za implementaciju

- **todo-env-backend**: Ažurirati backend `.env` (DB, URL-ovi, upload varijable) i osigurati da kod koristi te varijable.
- **todo-env-frontend-mobile**: Ažurirati frontend i mobile `.env` vrijednosti za produkcijski API URL.
- **todo-upload-backend**: Implementirati upload servis i static serviranje fajlova preko `UPLOAD_ROOT_PATH` i `UPLOAD_PUBLIC_PREFIX`.
- **todo-docker-backend-frontend**: Dovršiti/kreirati Dockerfile-ove za backend i frontend, plus Nginx konfiguraciju za frontend.
- **todo-compose-traefik**: Kreirati ili doraditi root `docker-compose.yml` sa Traefik labelama, mrežom `web` i volume mappingom.
- **todo-github-actions**: Kreirati GitHub Actions workflow koji detektuje promjene po folderima, spaja se na server i radi selektivni `docker compose up` za backend/frontend.
