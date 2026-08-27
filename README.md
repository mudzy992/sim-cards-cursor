# SIM Tracker Monorepo (Phase 1)

## Projects
- `backend/` - NestJS + Prisma + PostgreSQL (auth, RBAC, users)
- `frontend/` - Vite + React + Antd (login, protected routes, users page)
- `mobile/` - Expo Router app (login flow, tab navigation, secure session)
- `execution-playbook/` - source-of-truth planning docs

## Quick start

### 1) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

### 2) Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 3) Mobile
```bash
cd mobile
cp .env.example .env
npm install
npm run start
```

## Default URLs
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Frontend: `http://localhost:5173`

## Notes
- Backend expects PostgreSQL connection via `DATABASE_URL` (MySQL config kept
  as backup/rollback reference — see `docs/MIGRATION_MYSQL_TO_POSTGRES.md`).
- Seed script creates admin user using env variables in `backend/.env`.

## Deployment
- Public/host: `docker-compose.yml` (has internet, normal build).
- VM (closed network, no internet): `docker-compose.vm.*.yml`, offline
  build via deps images — see `VM_DEPLOYMENT.md` and `scripts/deploy.sh`.

## Notification settings (verification)

### Web (global admin switches)
- Open `Settings` page as `SYSTEM_ADMIN`.
- In **Notifikacije**:
  - Turn **Push notifikacije (mobile)** OFF → backend updates settings; push campaigns sending will be blocked.
  - Turn **Email notifikacije** OFF → backend email sending is skipped even if SMTP is configured.
  - Turn **In-app notifikacije** OFF → backend stops creating/emitting in-app notifications.

### Mobile (push token behavior)
- With **Push OFF** (web setting):
  - App must **not** request notification permission
  - App must **not** call `getExpoPushTokenAsync`
  - App must **not** call `POST /push-tokens/register`
- Offline / cannot reach backend:
  - App uses last cached value of the setting; if no cache exists it defaults to **Push OFF** (fail-closed).
