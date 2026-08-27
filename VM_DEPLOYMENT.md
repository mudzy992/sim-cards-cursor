## Sim Cards Codex – VM deployment (zatvoreni sistem, bez Traefika)
## 1. Priprema VM-a (Ubuntu)

1. Update:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Instalacija osnovnih alata:
   ```bash
   sudo apt install -y ca-certificates curl gnupg git
   ```

3. Instalacija Dockera:
   ```bash
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo \
     "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
     $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

4. Dozvola trenutnom korisniku da koristi Docker bez `sudo`:
   ```bash
   sudo usermod -aG docker $USER
   # nakon ovoga se odjaviti/prijaviti ili pokrenuti novu SSH sesiju
   ```

---

## 2. Priprema globalnog upload mount-a

Za potrebe slika na zapisniku potrebno e imati folder na serveru:

```bash
sudo mkdir -p /mnt/shared-app-files/sim-cards
sudo chown -R $USER:$USER /mnt/shared-app-files/sim-cards
```

Mount-an u backend kontejner kao `/usr/app/uploads`.

---

## 3. Kloniranje repozitorija i priprema grane

1. Kloniranje repozitorija:
   ```bash
   git clone https://github.com/mudzy992/sim-cards-cursor.git
    cd sim-cards-codex
    git checkout vm-deploy
   ```

---

## 4. Konfiguracija `.env` fajlova

### 4.1. PostgreSQL i `DATABASE_URL`

VM koristi isključivo **PostgreSQL** (lokalni kontejner, servis `postgres`
na mreži `sim-tracker-net`) — isti pristup kao i produkcija na
`sql.ba101.top`, samo je ovdje baza lokalna umjesto eksterne. Stari MySQL
setup je arhiviran u `docker-compose.vm.db.mysql.backup.yml` i ne koristi
se, osim za eventualni rollback.

1. Backend `.env.prod` (već podešeno u repou, `DATABASE_URL` se ionako
   override-uje iz `docker-compose.vm.app.yml` preko `environment:`).
   Hostname mora biti **container_name** (`sim-tracker-postgres`), ne
   naziv servisa iz compose fajla (`postgres`) — pošto se
   `docker-compose.vm.db.yml` i `docker-compose.vm.app.yml` pokreću kao
   odvojeni `docker compose -f ...` pozivi, service-name DNS alias se ne
   registruje pouzdano preko granice dva fajla, dok container_name uvijek
   radi:
   ```env
   DATABASE_URL="postgresql://mudzy:nije,kikiriki@sim-tracker-postgres:5432/sim_app_db"
   ```

2. Postgres/pgAdmin env varijable — root `.env` (u istom folderu gdje se
   pokreće `docker compose`):
   ```env
   POSTGRES_DB=sim_app_db
   POSTGRES_USER=mudzy
   POSTGRES_PASSWORD=change_me
   PGADMIN_DEFAULT_EMAIL=admin@simtracker.local
   PGADMIN_DEFAULT_PASSWORD=change_me
   ```
   Ove varijable se mapiraju na servise `postgres` i `dbadmin` u
   `docker-compose.vm.db.yml`. **Promijeniti lozinke prije prave upotrebe.**

### 4.2. Frontend

Frontend na VM-u se **ne builda unutar Dockera** (nema `npm run build` na
VM-u) — vidi sekciju 5.2. `dist/` se pravi unaprijed na mašini sa
internetom preko `scripts/vm-frontend-build.sh`, sa istim relativnim
`VITE_API_BASE_URL=/backend/api` koji koristi i produkcija (Traefik na oba
mjesta strip-uje `/backend` prefiks isto).

---

## 5. Docker okruženje na VM-u — offline build strategija

VM **nema izlaz na internet**. Zato je build podijeljen na dva nivoa:

- **Zavisnosti** (node_modules, apt paketi za Puppeteer/Chromium, Postgres/
  pgAdmin image-i) — grade/povlače se na mašini koja **ima** internet, pa
  se prenose na VM jednom (`docker save` + `scp` + `docker load`). Ovo se
  radi rijetko — samo kad se nešto od ovoga promijeni.
- **Kod aplikacije** — builda se **direktno na VM-u**, offline, jer sve što
  mu treba (node_modules, Prisma engine binarni fajlovi, Chromium) već
  postoji lokalno u "deps" image-u.

Sve ovo je automatizovano kroz `scripts/` — vidi sekciju 6 za tačan
redoslijed komandi. Ručni ekvivalent (bez skripti) dat je ispod radi
razumijevanja šta se zapravo dešava.

### 5.1. Backend

- `backend/Dockerfile.deps` — deps image (node + apt paketi + `npm ci`,
  uključujući devDependencies namjerno). Builda se **na mašini sa
  internetom**.
- `backend/Dockerfile.vm` — app image, `FROM simtracker-backend-deps:<tag>`
  (build-arg `DEPS_IMAGE`). Samo kopira kod, `prisma generate`, `npm run
  build`. **Builda se na VM-u**, bez interneta.

### 5.2. Frontend

- `scripts/vm-frontend-build.sh` — `npm ci && npm run build` **na mašini
  sa internetom**, pakuje `frontend/dist` u `.tar.gz`.
- `frontend/Dockerfile.vm` — samo `COPY dist` + nginx, bez ijednog `npm`
  poziva. **Builda se na VM-u**, bez interneta — pod uslovom da je `dist/`
  već raspakovan tamo (preko `scripts/vm-frontend-deploy.sh`) **i** da je
  base image `nginx:alpine` već učitan lokalno (jednokratno, vidi ispod —
  bez toga build puca sa "failed to resolve source metadata for
  docker.io/library/nginx:alpine", jer to je i dalje pravi Docker build
  koji mora povući svoj base image, samo su svi ostali koraci u njemu
  offline).
- `scripts/vm-frontend-baseimage-prepare.sh` / `vm-frontend-baseimage-load.sh`
  — povlače i prenose `nginx:alpine` na VM, isti obrazac kao za Postgres.
  **Pokrenuti jednom** (ili kad se odluči promjena verzije nginx image-a) —
  ne kod svakog frontend deploy-a.

### 5.3. Baza (Postgres + pgAdmin)

Isti `postgres`/`pgadmin4` image-i kao svugdje — povlače se **na mašini sa
internetom** (`scripts/postgres-image-prepare.sh`) i prenose na VM
(`scripts/postgres-image-load.sh`). Poslije toga, `docker-compose.vm.db.yml`
ih pokreće lokalno bez pokušaja mrežnog pristupa.

Struktura servisa (`docker-compose.vm.db.yml`):
- `postgres` – PostgreSQL 16 (alpine) sa lokalnim volume-om `postgres-data`
- `dbadmin` – pgAdmin4 za administraciju Postgresa (bez izloženog porta;
  pristup preko `/dbadmin`)

Struktura servisa (`docker-compose.vm.app.yml`):
- `backend` – NestJS backend, buildan iz `backend/Dockerfile.vm`
- `frontend` – React (Vite) statički fajlovi + Nginx, buildan iz
  `frontend/Dockerfile.vm`

---

## 6. Redoslijed komandi (preko `scripts/deploy.sh`)

Najlakše preko interaktivnog menija:
```bash
./scripts/deploy.sh
```

### 6.1. Prva instalacija (ili kad se mijenjaju zavisnosti/Postgres verzija)

Na **mašini sa internetom**:
```bash
./scripts/postgres-image-prepare.sh          # jednom (ili kad se mijenja verzija)
./scripts/vm-frontend-baseimage-prepare.sh   # jednom (ili kad se mijenja verzija nginx-a)
./scripts/vm-deps-build.sh                   # kad se mijenja backend/package*.json
./scripts/vm-frontend-build.sh               # svaki put kad se mijenja frontend kod
```
Svaka skripta na kraju ispisuje tačnu `scp` komandu za prenos artefakta.

Na **VM-u** (nakon što su artefakti prebačeni, npr. u `/tmp/`):
```bash
docker compose -f docker-compose.vm.traefik.yml up -d

./scripts/postgres-image-load.sh /tmp/postgres-images-<tag>.tar.gz
docker compose -f docker-compose.vm.db.yml up -d

./scripts/vm-deps-load.sh /tmp/simtracker-backend-deps-<tag>.tar.gz
./scripts/vm-backend-build.sh           # pita da li odmah podići kontejner

./scripts/vm-frontend-baseimage-load.sh /tmp/frontend-baseimage-<tag>.tar.gz
./scripts/vm-frontend-deploy.sh /tmp/frontend-dist-<tag>.tar.gz
```

Prva migracija baze (poslije prvog podizanja backend-a):
```bash
docker exec -it sim-tracker-backend-vm sh -c "npx prisma migrate deploy"
# po potrebi: npx prisma db seed
```

### 6.2. Svakodnevni update (samo izmjena koda, bez novih zavisnosti)

Na VM-u, direktno, bez interneta:
```bash
git pull   # na vm-deploy grani
./scripts/vm-backend-build.sh      # ako se mijenjao backend
./scripts/vm-frontend-deploy.sh    # ako se mijenjao frontend (dist mora biti
                                    # unaprijed pripremljen i prebačen — vidi 6.1)
```
Napomena: frontend i dalje zahtijeva da je `dist/` unaprijed napravljen na
mašini sa internetom (`vm-frontend-build.sh`) i prebačen — VM sam ne builda
frontend kod. Za backend, ako se `backend/package*.json` nije mijenjao,
`vm-backend-build.sh` je jedina potrebna komanda, potpuno offline.

Provjere (isto kao ranije):
```bash
docker ps
curl http://localhost:3003/api/health || curl http://localhost:3003
```
- Frontend: `http://<VM_IP>/`
- pgAdmin: `http://<VM_IP>/dbadmin` (login: `PGADMIN_DEFAULT_EMAIL` /
  `PGADMIN_DEFAULT_PASSWORD`, pa unutar pgAdmin dodati server sa host-om
  `postgres`, korisnikom/lozinkom iz `POSTGRES_USER`/`POSTGRES_PASSWORD`)

---

## 7. Šta ide u `vm-deploy` granu

U ovoj grani preporučeno je imati:

- `backend/` + `backend/Dockerfile.vm` + `backend/Dockerfile.deps`
- `frontend/` + `frontend/Dockerfile.vm`
- `docker-compose.vm.app.yml`, `docker-compose.vm.db.yml`,
  `docker-compose.vm.traefik.yml`
- `docker-compose.vm.db.mysql.backup.yml` (arhiva, nije aktivna)
- `scripts/` (sve `.sh` skripte)
- `VM_DEPLOYMENT.md`
- dokumentaciju koja je nužna za deployment (bez osjetljivih `.env` fajlova)

Sve ostalo što nije nužno za runtime na zatvorenom VM-u može ostati u
glavnoj razvojnoj grani.
