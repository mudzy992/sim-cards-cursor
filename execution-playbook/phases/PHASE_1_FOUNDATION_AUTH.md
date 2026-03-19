# PHASE_1_FOUNDATION_AUTH

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)
Period: Sedmica 1-2

## Status
- Status: COMPLETED
- Datum zatvaranja: 2026-03-07
- Napomena: Backend + frontend + mobile auth tok potvrđen kroz ručne testove i smoke provjere.

## Cilj faze
Postaviti stabilan temelj sistema: backend skeleton, autentikacija, RBAC i početni web/mobile auth pristup.

## Obavezni deliverable-i
- Funkcionalan NestJS + Prisma + MySQL setup.
- Auth tok sa access/refresh token mehanikom.
- Users CRUD sa role zaštitom.
- Web login + zaštićene rute.
- Mobile login + sigurno čuvanje sesije.

## Task backlog
| Task ID | Domen | Opis | Dependency | Output |
|---|---|---|---|---|
| P1-BE-01 | Backend | Inicijalni NestJS setup sa strict TS konfiguracijom | - | Pokrenut backend skeleton |
| P1-BE-02 | Backend | Prisma schema inicijalizacija i MySQL konekcija | P1-BE-01 | `schema.prisma`, DB konekcija |
| P1-BE-03 | Backend | Migracije i seed admin korisnika | P1-BE-02 | Migracije + seed skripta |
| P1-BE-04 | Backend | Auth modul: login/register/refresh/logout/profile | P1-BE-03 | Auth endpoint-i |
| P1-BE-05 | Backend | RBAC guard-ovi i decorators (`SYSTEM_ADMIN`, `MODERATOR`, `USER`) | P1-BE-04 | Role enforcement |
| P1-BE-06 | Backend | Users CRUD + status update endpoint | P1-BE-05 | Users modul |
| P1-BE-07 | Backend | Global filters/interceptors/pipes (validation, errors, logging) | P1-BE-01 | Common middleware sloj |
| P1-BE-08 | Backend | Swagger setup i osnovna dokumentacija | P1-BE-04 | API docs dostupne |
| P1-FE-01 | Frontend | Vite + React + Antd + Tailwind setup | - | Pokrenut web projekat |
| P1-FE-02 | Frontend | Axios instance + auth interceptors | P1-FE-01 | Centralni API layer |
| P1-FE-03 | Frontend | Auth store (Zustand) i session handling | P1-FE-02 | Persistirana web sesija |
| P1-FE-04 | Frontend | Login stranica sa validacijom | P1-FE-03 | Funkcionalan login UI |
| P1-FE-05 | Frontend | App layout (sidebar/header) | P1-FE-01 | Navigacioni okvir |
| P1-FE-06 | Frontend | Protected routes + role guard komponente | P1-FE-03 | Zaštićen routing |
| P1-FE-07 | Frontend | Users management stranica (admin) | P1-FE-06, P1-BE-06 | CRUD UI za korisnike |
| P1-MB-01 | Mobile | Expo + Expo Router setup | - | Pokrenut mobile projekat |
| P1-MB-02 | Mobile | Auth flow (login, token storage u SecureStore/MMKV) | P1-MB-01, P1-BE-04 | Mobile prijava |
| P1-MB-03 | Mobile | Tab layout i osnovna navigacija | P1-MB-01 | Funkcionalna app struktura |
| P1-MB-04 | Mobile | Axios instance i auth interceptor | P1-MB-02 | API komunikacija |
| P1-QA-01 | QA | Unit testovi za auth service i user service | P1-BE-04, P1-BE-06 | Test suite za osnovu |
| P1-QA-02 | QA | E2E: login + protected route scenario (web) | P1-FE-06 | Kritični auth e2e |

## Phase gate - acceptance
- Login radi na web i mobile klijentu.
- Refresh token flow radi bez ponovne prijave.
- Users CRUD je role-zaštićen.
- Swagger pokriva auth i users endpoint-e.
- Nema otvorenih P0/P1 bugova u auth i users toku.

## Rizici i mitigacija
- Rizik: nekonzistentan token lifecycle između web i mobile.
- Mitigacija: zajednički auth contract i isti refresh scenariji u testovima.
