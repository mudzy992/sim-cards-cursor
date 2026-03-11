---
name: safe-backend-frontend-upgrade
overview: Sigurna, fazna nadogradnja backend (NestJS/Prisma) i frontend (React/Vite/AntD) paketa na najnovije kompatibilne verzije, isključujući Expo 55 i mobilnu aplikaciju.
todos:
  - id: backend-collect-outdated
    content: Pregledati `backend` `npm outdated` i potvrditi koje dependencyje je moguće sigurno nadograditi unutar istog majora.
    status: completed
  - id: backend-upgrade-minor-patch
    content: Ažurirati verzije backend dependencyja u package.json na zadnje minor/patch verzije unutar istog majora i pokrenuti npm install.
    status: completed
  - id: backend-test-verify
    content: Pokrenuti lint/test/smoke skripte i ručne provjere backend API-ja nakon nadogradnje.
    status: completed
  - id: frontend-upgrade-minor-patch
    content: Ažurirati verzije frontend dependencyja u package.json na zadnje minor/patch verzije unutar istog majora i pokrenuti npm install.
    status: completed
  - id: frontend-test-verify
    content: Pokrenuti typecheck, build i osnovni ručni QA frontenda nakon nadogradnje.
    status: completed
  - id: cross-check-and-docs
    content: Verificirati end-to-end flow (frontend+backend) i dopuniti playbook/runbook dokumentaciju o strategiji sigurne nadogradnje.
    status: completed
isProject: false
---

# Plan sigurne nadogradnje backend-a i frontenda (bez mobilne aplikacije)

## Ciljevi

- **Backend**: Zadržati se na trenutnim major verzijama (NestJS 10, Prisma 5, Jest 29, itd.) i osigurati da su SVI ključni paketi na **zadnjim stabilnim minor/patch verzijama** u tim majorima.
- **Frontend**: Zadržati se na trenutnim major verzijama (React 18, Vite 5, AntD 5, Tailwind 3, React Router 6, itd.) i dovesti dependencyje na **zadnje kompatibilne minor/patch verzije**.
- **Mobilna aplikacija** (`mobile`): **isključena iz ove faze** – Expo 55 i RN nadogradnja se rade u posebnoj iteraciji.
- **Sigurnost**: Ne uvoditi nove majore (Nest 11, Prisma 7, React 19, Vite 7, AntD 6, Tailwind 4, Expo 55, itd.) u ovoj fazi.

## Arhitektura i scope

- **Repo struktura**:
  - Backend: `[backend/package.json](backend/package.json)`
  - Frontend: `[frontend/package.json](frontend/package.json)`
  - Mobile (isključeno): `[mobile/package.json](mobile/package.json)`
- **Scope ove nadogradnje**:
  - Obuhvata samo dependencyje i devDependencyje u **backend** i **frontend** aplikacijama.
  - Ne dira se konfiguracija baza, Prisma schema, Dockerfile-ovi i CI osim ako neka library nadogradnja to eksplicitno zahtijeva.

## Backend faza (NestJS + Prisma)

### 1. Analiza trenutnih verzija i dostupnih nadogradnji

- **Koraci**:
  - U `backend` direktoriju pokrenuti:
    - `npm outdated` (već je urađeno; koristi se kao referenca u ovoj fazi).
  - Identificirati pakete gdje je **Current < Wanted ≤ Latest u istom majoru**:
    - Primarno: `@nestjs/`*, `prisma`, `@prisma/client`, `class-validator`, `rxjs`, `helmet`, `nodemailer`, `puppeteer`.
- **Rezultat**:
  - Ako su `Current` i `Wanted` već jednaki (kao sada), zaključak je da je backend već na zadnjim minor/patch verzijama izabranih majora.
  - Plan svejedno predviđa postupak za buduće sigurne nadogradnje.

### 2. Definisanje pravila za “sigurnu nadogradnju” backend-a

- **Pravila**:
  - Dozvoljene su promjene samo u okviru **istog major broja** (npr. 10.4.x → 10.5.x za Nest, 5.22.x → 5.23.x za Prisma).
  - Zabranjeno automatsko prelaženje na:
    - `@nestjs/`* 11.x,
    - `prisma` / `@prisma/client` 7.x,
    - `jest` 30.x,
    - `bcrypt` 6.x,
    - ostale pakete gdje bi skok bio major.
  - Za svaki paket provjeriti **CHANGELOG** za target verziju ako je razlika više od jednog patch releasa.

### 3. Mehanizam nadogradnje backend dependencyja

- **Alat**:
  - Opcija A: koristiti `npm install` sa eksplicitno zadanim ciljnim verzijama u `package.json` (ručno ažuriranje verzija.
  - Opcija B: koristiti `npx npm-check-updates` (`ncu`) sa ograničenjem na isti major:
    - `npx npm-check-updates '/.*/' -t minor`
    - Ručno pregledati listu i primijeniti samo željene pakete.
- **Koraci**:
  1. Kreirati privremenu granu za nadogradnju backend-a.
  2. Ažurirati odabrane dependencyje u `[backend/package.json](backend/package.json)` na zadnje minor/patch verzije unutar istog majora.
  3. Pokrenuti `npm install` u `backend` direktoriju.

### 4. Testiranje backend-a nakon nadogradnje

- **Automatski testovi**:
  - `npm run lint` (ili `npm run test` ako već postoji) iz `backend`:
    - Provjeriti da TypeScript build prolazi bez novih errora.
    - Pokrenuti `npm test` (Jest) i provjeriti da svi testovi prolaze.
- **Specifične funkcionalne provjere** (ručno ili kroz skripte):
  - Pokrenuti lokalni backend server (`npm run start:dev`) i provjeriti:
    - Auth flow (login, refresh token) – prema zahtjevima iz `PHASE_1_FOUNDATION_AUTH`.
    - Tipične API pozive: kreiranje korisnika, CRUD nad ključnim resursima (sim kartice, recordi, shipmente itd.).
    - WebSocket/notifications dio (ako postoji integracija sa frontend-om).
  - Po potrebi koristiti postojeće smoke skripte: `smoke:phase2`, `smoke:phase2:import`, `smoke:phase2:import-validation`.
- **Rollback strategija**:
  - Ako se pojave problemi, vratiti verzije pojedinačnih paketa na prethodne (preko git diffa na `package.json` i `package-lock.json`).

### 5. Sigurnosna provjera dependencyja backend-a

- **Koraci**:
  - Pokrenuti `npm audit --production` u `backend`.
  - Ako se pojave visokorizične ranjivosti:
    - Provjeriti ima li fix unutar istog majora; ako da, uključiti ga.
    - Ako fix zahtijeva major upgrade, dokumentirati to kao **posebnu fazu** izvan "sigurne" nadogradnje.

## Frontend faza (React + Vite + AntD)

### 6. Analiza trenutnih verzija i dostupnih nadogradnji

- **Referenca**: `[frontend/package.json](frontend/package.json)` i `npm outdated` izlaz.
- **Cilj**:
  - Potvrditi koje su biblioteke već na zadnjim minor/patch verzijama unutar svojih majora (npr. React 18.x, Vite 5.x, AntD 5.x, Tailwind 3.x, React Router 6.x).

### 7. Definisanje pravila za “sigurnu nadogradnju” frontenda

- **Pravila**:
  - Zadržati se na:
    - `react` / `react-dom` 18.x (ne skakati na 19.x).
    - `vite` 5.x (ne na 6/7 bez posebne migracije).
    - `antd` 5.x (AntD 6 je zasebna migracija).
    - `tailwindcss` 3.x (Tailwind 4 traži veće promjene u configu).
    - `react-router-dom` 6.x (7.x kao posebna migracija).
  - `@types/`* pakete uskladiti sa runtime major verzijama (npr. `@types/react` 18.x za React 18).

### 8. Mehanizam nadogradnje frontend dependencyja

- **Alat**:
  - Ponovno `npm-check-updates` ograničen na minor/patch:
    - `npx npm-check-updates '/.*/' -t minor` u `frontend`.
  - Ručno filtrirati listu tako da se ne prelazi na nove majore.
- **Koraci**:
  1. Kreirati privremenu granu za frontend nadogradnju.
  2. Ažurirati odabrane dependencyje u `[frontend/package.json](frontend/package.json)` na zadnje minor/patch verzije unutar trenutnog majora.
  3. Pokrenuti `npm install` u `frontend`.

### 9. Testiranje frontenda nakon nadogradnje

- **Build i type-check**:
  - U `frontend`:
    - `npm run typecheck` (TS provjera).
    - `npm run build` (Vite build) – očekujemo da build i dalje prolazi bez errora.
- **Ručni QA**:
  - Pokrenuti `npm run dev` i ručno proći ključne ekrane:
    - Login i osnovna navigacija (dashboard, liste, detalji zapisa, forme).
    - Komponente koje jako ovise o AntD-u (tabele, forme, modali, notifikacije).
    - Socket-based real-time dijelovi (ako postoje) – provjeriti da se konekcija uspostavlja i da se događaji isporučuju.

### 10. Sigurnosna provjera dependencyja frontenda

- **Koraci**:
  - `npm audit --production` u `frontend`.
  - Ako postoje ranjivosti koje se mogu riješiti unutar istog majora:
    - Uključiti njihove patch/minor upgradeove.
  - Ranjivosti koje traže major upgrade dokumentovati za narednu fazu.

## Kros-repo provjere i stabilizacija

### 11. Provjera kompatibilnosti frontend–backend nakon nadogradnje

- **Koraci**:
  - Pokrenuti backend i frontend zajedno (lokalno ili kroz docker-compose ako postoji).
  - Proći kompletan osnovni poslovni flow:
    - Login → dashboard.
    - Kreiranje i pregled entiteta (sim kartice, zapisnici itd.).
    - Notifikacije i real-time dijelovi.
  - Obratiti pažnju na:
    - Tipove u API response-ovima (da se nisu promijenili serializeri/validatori).
    - CORS, auth header-e i sl.

### 12. CI/CD i dokumentacija

- **CI**:
  - Ažurirati CI pipeline (ako postoji) da pokreće:
    - `npm run lint` / `npm test` za backend.
    - `npm run typecheck` / `npm run build` za frontend.
- **Dokumentacija**:
  - U `docs/production-runbook.md` i/ili `execution-playbook` fazama dopisati:
    - Kratku sekciju o strategiji "sigurne nadogradnje" dependencyja.
    - Komande koje se trebaju pokretati prije svake produkcijske nadogradnje (lint, test, build, audit).

## Šta slijedi nakon ove faze

- Nakon što backend i frontend budu potvrđeni kao stabilni s novim minor/patch verzijama:
  - Planirati **odvojene migracije**:
    - Mobile → Expo 55 / RN upgrade.
    - Backend → Nest 11 + Prisma 7 (ako i kada bude potrebno).
    - Frontend → React 19, Vite 7, AntD 6, Tailwind 4, React Router 7.
- Svaka od tih migracija bi imala vlastiti plan (s koracima za breaking promjene).
