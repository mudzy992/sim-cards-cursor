# SIM Tracker Monorepo (Phase 1)

## Projects
- `backend/` - NestJS + Prisma + MySQL (auth, RBAC, users)
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
- Backend expects MySQL connection via `DATABASE_URL`.
- Seed script creates admin user using env variables in `backend/.env`.
