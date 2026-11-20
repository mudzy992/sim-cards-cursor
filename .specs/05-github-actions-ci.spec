# SPEC 05 — GitHub Actions CI/CD Pipeline (Ephemeral PostgreSQL)
**Prioritet:** P1 (Critical — Mandatory Verification Infrastructure)
**Opseg:** `.github/workflows/ci.yml`, `backend/jest.config.ts`, `backend/test/`

---

## 1. Arhitektonski zahtjevi
- Svi backend testovi (unit, integracioni, migracioni i e2e testovi) u Phase 3 MORAJU se izvršavati isključivo unutar GitHub Actions CI koristeći **efemernu, izolovanu PostgreSQL bazu** pokrenutu kao Docker service container u samom workflow-u.
- Nikakva lokalna ili vanjska produkcijska/staging baza ne smije biti korištena u testovima.
- CI mora biti determinističan, brz (npm cache) i pokretati se na `push` (na aktivnu granu) i `workflow_dispatch`.
- **Napomena o granama:** Ne kreirati PR-ove; workflow se trigguje na `push` ka granama (npr. `main`, `arena/**`).

---

## 2. Workflow specifikacija (`.github/workflows/ci.yml`)

### Job 1: `backend-lint-build-test`
- **Runs-on:** `ubuntu-latest`
- **Services:**
  - `postgres`:
    - `image: postgres:16-alpine`
    - `env`: `POSTGRES_USER: postgres`, `POSTGRES_PASSWORD: ci_test_password`, `POSTGRES_DB: sim_tracker_test`
    - `ports`: `5432:5432`
    - `options`: `--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5`
- **Env varijable za job:**
  - `DATABASE_URL: postgresql://postgres:ci_test_password@localhost:5432/sim_tracker_test?schema=public`
  - `JWT_SECRET: ci-test-jwt-secret-min-32-chars-long`
  - `JWT_REFRESH_SECRET: ci-test-refresh-secret-min-32-chars-long`
  - `APP_ENV: test`
  - `NODE_ENV: test`
- **Koraci:**
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` (`node-version: '22'`, `cache: 'npm'`, `cache-dependency-path: backend/package-lock.json`)
  3. `npm ci` u `backend/`
  4. `npx prisma generate`
  5. `npx prisma migrate deploy` (verifikuje da sve Prisma migracije prolaze čisto od nule na svježoj PostgreSQL bazi!)
  6. `npx prisma db seed` (opcionalno testirati idempotentnost seed skripte)
  7. `npm run lint` (ESLint + Prettier check)
  8. `npx tsc --noEmit`
  9. `npm run build`
  10. `npm test` (Jest unit testovi)
  11. `npm run test:e2e` (integracioni / e2e testovi protiv efemernog PostgreSQL servisa; `backend/test/workflows.e2e-spec.ts` + novi RBAC/IDOR/transaction testovi)

### Job 2: `frontend-lint-build-audit`
- **Runs-on:** `ubuntu-latest`
- **Koraci:**
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` (`node-version: '22'`, `cache: 'npm'`, `cache-dependency-path: frontend/package-lock.json`)
  3. `npm ci` u `frontend/`
  4. `npm run lint` (ESLint uključujući `eslint-plugin-jsx-a11y`, `prettier --check`)
  5. `npx tsc --noEmit`
  6. `npm run i18n:check` (provjera ključ-pariteta `bs.ts` vs `en.ts`, nekorištenih/nedostajućih ključeva i detekcija hardcoded UI stringova)
  7. `npm run build` (Vite production build test sa `VITE_API_BASE_URL=/backend/api`)
  8. `npm run test` (Vitest + `axe-core` / component testovi ako se uvedu u Phase 3)

### Job 3: `repo-hygiene` (lagani guard)
- Provjera da u commitovima nema novih `.env` (osim `.example`) niti `.apk` / service-account JSON fajlova.

---

## 3. Potrebne dorade Jest konfiguracije (`backend/jest.config.ts`, `backend/test/`)
- U `backend/jest.config.ts`: zamijeniti deprecated `globals: { 'ts-jest': ... }` modernim `transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }] }`.
- Dodati `backend/test/jest-e2e.json` i npm skriptu `test:e2e` sa `--runInBand` za testiranje protiv efemernog PostgreSQL-a bez kolizija u bazi.
- Osigurati da e2e testovi koriste izolovani cleanup između test suite-ova i ne ovise o vanjskim servisima (mockovati SMTP/Expo/Puppeteer gdje je potrebno ili testirati PDF servis zasebno).
