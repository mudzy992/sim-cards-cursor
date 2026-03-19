# 05_PHASES_OVERVIEW

Povratna referenca: [SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## Timeline
| Faza | Sedmice | Fokus | Detalji |
|---|---|---|---|
| Faza 1 | 1-2 | Foundation & Auth (Completed 2026-03-07) | [PHASE_1_FOUNDATION_AUTH.md](./phases/PHASE_1_FOUNDATION_AUTH.md) |
| Faza 2 | 3-4 | SIM Cards & Excel Import (Completed 2026-03-07) | [PHASE_2_SIM_EXCEL.md](./phases/PHASE_2_SIM_EXCEL.md) |
| Faza 3 | 5-6 | Meters, Records & PDF (Completed 2026-03-07) | [PHASE_3_METERS_RECORDS_PDF.md](./phases/PHASE_3_METERS_RECORDS_PDF.md) |
| Faza 3.5 | 6.5-7 | Organizaciona hijerarhija (Completed 2026-03-08) | [PHASE_3_5_ORGANIZATIONAL_HIERARCHY.md](./phases/PHASE_3_5_ORGANIZATIONAL_HIERARCHY.md) |
| Faza 4 | 7-8 | Email, Notifications & Dashboard | [PHASE_4_EMAIL_NOTIFICATIONS_DASHBOARD.md](./phases/PHASE_4_EMAIL_NOTIFICATIONS_DASHBOARD.md) |
| Faza 4.1 | 8 | App Tour (Moderator + System Admin) | [PHASE_4_1_APP_TOUR.md](./phases/PHASE_4_1_APP_TOUR.md) |
| Faza 4.2 | 8.5-9 | Advanced Analytics & KPI | [PHASE_4_2_ANALYTICS.md](./phases/PHASE_4_2_ANALYTICS.md) |
| Faza 5 | 9-10 | Polish, Testing & Deployment | [PHASE_5_POLISH_TEST_DEPLOY.md](./phases/PHASE_5_POLISH_TEST_DEPLOY.md) |

## Milestone-i
1. M1 (kraj faze 1): Auth, users i role guard funkcionalni na web + mobile login.
2. M2 (kraj faze 2): End-to-end import shipment-a, scan lookup i operator self-claim (`Zaduži karticu`).
3. M3 (kraj faze 3): Potpuni tok kreiranja zapisnika i PDF preview.
3.5. M3.5 (kraj faze 3.5): Organizaciona hijerarhija – admin/moderator/operator scope po distribuciji i podružnici.
4. M4 (kraj faze 4): Slanje odobrenog zapisnika email-om + notifikacije + dashboard.
4.1. M4.1 (kraj faze 4.1): Interaktivni tour kroz ključne UI tokove za MODERATOR i SYSTEM_ADMIN (web), opcionalno mobile.
4.2. M4.2 (kraj faze 4.2): Napredne analitike (SIM, zapisnici, korisnici) sa role-aware dashboardom, KPI-jevima, grafikonima i CSV exportom.
5. M5 (kraj faze 5): Release-ready sistem sa testovima, CI/CD i deploy procedurom.

## Phase-gate pravilo
Faza se zatvara tek kad su ispunjeni svi uslovi:
- Svi P0/P1 bugovi zatvoreni ili imaju odobren workaround.
- Obavezni taskovi označeni kao završeni.
- Acceptance kriteriji iz faznog dokumenta potvrđeni.
- Dokumentacija i env checklista ažurirane.

## Dependency redoslijed između faza
- Faza 2 zavisi od auth + users + osnovne RBAC matrice iz faze 1.
- Faza 3 zavisi od stabilnog lifecycle-a SIM kartica iz faze 2.
- Faza 3.5 zavisi od Faze 3 (meters, records, users).
- Faza 4 zavisi od status workflow-a zapisnika iz faze 3 i scope-a iz faze 3.5.
- Faza 5 zavisi od kompletirane funkcionalnosti i instrumentacije iz faza 1-4.
