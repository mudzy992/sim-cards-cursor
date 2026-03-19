# 01_ARCHITECTURE_BASELINE

Povratna referenca: [SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## 1. Sistem pregled
Sistem se sastoji od tri klijenta i jednog centralnog backend-a:
- Mobile app: Expo + React Native (skeniranje barkoda, kreiranje zapisnika na terenu)
- Web app: Vite + React + Ant Design + Tailwind (operativni dashboard i administracija)
- Backend API: NestJS (REST API, RBAC, import, PDF, email, notifikacije)
- Baza: MySQL preko Prisma ORM

## 2. Tehnološki stack
- Backend: NestJS 10, Prisma 5, JWT auth, Throttler, Swagger, WebSocket
- Web frontend: React 18, React Query, Zustand, Antd, Axios
- Mobile: Expo 50, Expo Router, Camera/Barcode, Location, Secure Store, MMKV
- Integracije: Excel import (`xlsx`/`exceljs`), PDF (`puppeteer` + `handlebars`), SMTP (`nodemailer`)

## 3. Domenski model
Glavni entiteti:
- `User` (role/status/auth lifecycle)
- `Shipment` (isporuke SIM serija)
- `SimCard` (ICCID, IP, status, assignment)
- `Meter` (AMM brojilo metapodaci)
- `InstallationRecord` (zapisnik spajanja SIM + brojilo + lokacija + status workflow)
- `RecipientGroup` i `Recipient` (primaoci mailova)
- `Notification` (user-level notifikacije)
- `ActivityLog` (audit trail)
- `AppSetting` (globalna podešavanja)

## 4. Kritični status lifecycle
- SIM: `AVAILABLE -> ASSIGNED -> INSTALLED` (+ `DEFECTIVE`, `RETURNED`, `DEACTIVATED`)
- Zapisnik: `DRAFT -> PENDING -> APPROVED -> SENT` ili `REJECTED`
- Isporuka: `RECEIVED -> PROCESSING -> COMPLETED`

## 5. Moduli backend-a
- Auth, Users, Shipments (Excel import), Sim Cards, Meters
- Installation Records (PDF, approve/reject/send)
- Recipients, Email, Notifications (WebSocket)
- Dashboard, Activity Log, Settings
- Common (guards, decorators, filters, interceptors, dto, utils)

## 6. RBAC osnova
Role:
- `SYSTEM_ADMIN`
- `MODERATOR`
- `USER`

Sažetak:
- Admin: puni pristup, uključujući users/settings/activity.
- Moderator: operativni pristup (uvoz, kartice, brojila, odobravanje, slanje).
- User: teren (scan, kreiranje zapisnika, pregled vlastitih zapisa, profil).

## 7. API domene
- Auth: login, refresh, logout, profile, password change
- Users: CRUD + status
- Shipments: CRUD + import + listing kartica
- SimCards: CRUD + scan + assignment + stats
- Meters: CRUD + available
- Records: CRUD + approve/reject + pdf + send + my
- Recipients: groups/recipients CRUD
- Dashboard: stats/activity/charts
- Notifications: read/read-all/list
- Settings i Activity Log

## 8. Infrastrukturne granice
- Upload direktorij: `./uploads`
- Generisani PDF: `./generated/pdf`
- Maksimalni upload: 10MB
- JWT + refresh token mehanizam
- CORS whitelist prema frontend domenama

## 9. Arhitekturne odluke koje se ne smiju rušiti
1. Prisma je jedini data access sloj (bez raw SQL osim strogo opravdano).
2. Svaka mutacija kritičnog entiteta mora pisati `ActivityLog`.
3. Record status prelazi isključivo kroz validirane transition metode.
4. Mobile i web koriste isti backend contract (DTO + status semantika).
5. PDF i email su backend odgovornost; klijenti ne generišu finalni dokument.
