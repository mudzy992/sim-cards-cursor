# Production deployment runbook

## Priprema okruženja

- **Server**: Linux host sa instaliranim Docker i Docker Compose.
- **Direktorij za upload fajlove**: kreirati `/mnt/shared-app-files/sim-cards-codex` i podesiti prava tako da Docker proces ima read/write pristup.
- **Environment fajl**: na backend strani pripremiti `.env` sa proizvodnim vrijednostima (JWT secret, mail server, BASE_URL, itd.).

## Koraci deploya

1. `git pull` na glavnoj grani.
2. `docker compose pull` (ako koristite registry) ili `docker compose build backend`.
3. `docker compose up -d db`.
4. Pokrenuti migracije u backend containeru:
   - `docker compose run --rm backend npm run prisma:migrate`.
5. `docker compose up -d backend`.

## Smoke test scenarij

Manualno ili automatizovano provjeriti:

- Web:
  - Prijava kao SYSTEM_ADMIN.
  - Kreiranje zapisnika (WF-01) i provjera statusa.
  - Kreiranje i pregled zadatka demontaže (WF-02).
  - Pregled dashboarda i analitike.
- Mobile:
  - Prijava, kreiranje zapisnika i offline queue (ako nema mreže).
- Backend:
  - Pokretanje `npm test` unutar backend kontejnera.
  - Opcionalno pokretanje `k6 run scripts/perf-smoke.k6.js` prema produkcijskoj API adresi sa malim opterećenjem.

## Sigurna nadogradnja dependencyja

- **Backend**:
  - Zadržati se na trenutnim major verzijama (npr. NestJS 10, Prisma 5).
  - Prije deploya pokrenuti `npm outdated` u `backend` i po potrebi ažurirati samo minor/patch verzije (bez prelaska na novi major).
  - Nakon nadogradnje obavezno pokrenuti `npm run lint` i `npm test`.
- **Frontend**:
  - Zadržati se na trenutnim major verzijama (npr. React 18, Vite 5, AntD 5).
  - Prije deploya pokrenuti `npm outdated` u `frontend` i po potrebi ažurirati samo minor/patch verzije.
  - Nakon nadogradnje pokrenuti `npm run typecheck` i `npm run build`.

Ako `npm outdated` pokazuje samo nove **majore**, odgoditi nadogradnju za posebnu migracijsku fazu i NE raditi je u sklopu redovnog produkcijskog deploya.

Ako bilo koji smoke test ne prođe, izvršiti rollback na prethodnu verziju Docker image-a i ponoviti korake nakon popravke.

