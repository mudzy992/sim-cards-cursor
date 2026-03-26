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

### 4.1. MySQL i `DATABASE_URL`
1. Backend `.env` (primjer – prilagoditi prema dogovoru):
   ```env
   DATABASE_URL="mysql://sim_app:change_me_app_pass@mysql:3306/CHANGE_ME_DB_NAME"
   ```

2. MySQL env varijable (mogu biti u npr. `./.env.mysql` ili direktno export-ane prije `docker compose` komande):
   ```env
   MYSQL_ROOT_PASSWORD=...
   MYSQL_DATABASE=CHANGE_ME_DB_NAME
   MYSQL_USER=sim_app
   MYSQL_PASSWORD=change_me_app_pass
   # phpMyAdmin iza /dbadmin (obavezno da login redirect ne ode na /index.php u root)
   PMA_ABSOLUTE_URI=http://10.10.10.30/dbadmin/
   ```

   Ove varijable se mapiraju na servis `mysql` u `docker-compose.vm.db.yml`.

### 4.2. Frontend `.env`

Frontend se build-a unutar Docker kontejnera i `VITE_API_BASE_URL` / `VITE_API_BASE_URLS` se prosljeđuju kroz build arg (vidi `docker-compose.vm.app.yml`). Preporuka je koristiti relativni URL `/backend/api` da isti build radi i na VM-u i na produkciji.

Primjer:
```env
VITE_APP_NAME="Sim Cards"
# ostale VITE_ varijable po potrebi
```

---

## 5. Novi docker-compose okruženje (VM)

Struktura servisa:

- `mysql` – MySQL 8.x sa lokalnim volume-om `mysql-data`
- `backend` – NestJS backend, buildan iz `backend/Dockerfile`, mount za `/usr/app/uploads`
- `frontend` – React (Vite) + Nginx, buildan iz `frontend/Dockerfile`
- `dbadmin` – phpMyAdmin za administraciju MySQL (nema izložen port; pristup ide preko postojećeg HTTP entrypointa na putanji `/dbadmin`)

Pokretanje:

```bash
# unutar root foldera repozitorija na VM-u
docker compose -f docker-compose.vm.traefik.yml up -d
docker compose -f docker-compose.vm.db.yml up -d
docker compose -f docker-compose.vm.app.yml up -d --build
```

Provjere:

1. Provjera kontejnera:
   ```bash
   docker ps
   ```

2. Provjera backend health-a (primjer – prilagoditi pravoj ruti/health endpointu):
   ```bash
   curl http://localhost:3003/health || curl http://localhost:3003
   ```

3. Pristup frontendu iz browsera:
   - sa hosta: `http://localhost/`
   - iz mreže firme: `http://<VM_IP>/`

4. Pristup phpMyAdmin (DB admin UI) bez otvaranja novog porta:
   - sa hosta: `http://localhost/dbadmin`
   - iz mreže firme: `http://<VM_IP>/dbadmin`

   Login:
   - **Server/Host**: `mysql`
   - **Username**: vrijednost `MYSQL_USER`
   - **Password**: vrijednost `MYSQL_PASSWORD`

---

## 6. Lifecycle: migracije, seed i update-i

1. **Prva instalacija**:
   - Nakon što se MySQL i backend dignu, ući u backend kontejner i pokrenuti migracije:
     ```bash
     docker exec -it sim-tracker-backend-vm sh
     npx prisma migrate deploy
     # po potrebi: npx prisma db seed
     exit
     ```

2. **Update verzije aplikacije**:
   - `git pull` na VM-u (dok ste na `vm-deploy` grani),
   - ponovo buildati kontejnere:
     ```bash
     docker compose -f docker-compose.vm.traefik.yml pull
     docker compose -f docker-compose.vm.db.yml pull
     docker compose -f docker-compose.vm.app.yml pull
     docker compose -f docker-compose.vm.app.yml up -d --build
     ```
   - po potrebi ponovo pokrenuti `prisma migrate deploy`.

---

## 7. Šta ide u `vm-deploy` granu

U ovoj grani preporučeno je imati:

- `backend/` + `backend/Dockerfile`
- `frontend/` + `frontend/Dockerfile`
- `docker-compose.vm.traefik.yml`
- `docker-compose.vm.db.yml`
- `docker-compose.vm.app.yml`
- `VM_DEPLOYMENT.md`
- dokumentaciju koja je nužna za deployment (bez osjetljivih `.env` fajlova)

Sve ostalo što nije nužno za runtime na zatvorenom VM-u može ostati u glavnoj razvojnoj grani.
