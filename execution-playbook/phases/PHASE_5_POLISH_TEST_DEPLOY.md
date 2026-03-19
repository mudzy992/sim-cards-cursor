# PHASE_5_POLISH_TEST_DEPLOY

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)
Period: Sedmica 9-10

## Cilj faze
Zatvoriti kvalitet, sigurnost i release spremnost sistema za produkciju.

## Obavezni deliverable-i
- Stabilan error handling i UX polish.
- Testna pokrivenost kritičnih tokova.
- Docker + CI/CD pipeline.
- Produkcioni deployment i mobile build.
- Završna dokumentacija.

## Task backlog
| Task ID | Domen | Opis | Dependency | Output |
|---|---|---|---|---|
| P5-PL-01 | Platform | Poboljšanje globalnog error handling-a (web/mobile/backend) | P1-P4 | Stabilniji failure UX |
| P5-PL-02 | Platform | Loading/skeleton stanja za spore ekrane i liste | P1-P4 | Konzistentan UX |
| P5-MB-01 | Mobile | Offline support za ključne akcije (queue + retry) | P3-MB-05 | Offline resilient flow |
| P5-BE-01 | Backend | Rate limiting hardening i endpoint tuning | P1-BE-04 | Sigurnosna zaštita |
| P5-BE-02 | Backend | Input sanitization i dodatna validacija | P1-P4 | Hardened input sloj |
| P5-QA-01 | QA | Unit testovi backend servisa (target >= 70%) | P1-P4 | Coverage izvještaj |
| P5-QA-02 | QA | E2E suite za kritične workflow-e (`WF-01`, `WF-02`, `WF-03`) | P1-P4 | End-to-end sigurnost |
| P5-OPS-01 | DevOps | Performance optimizacija i osnovni monitoring signal | P1-P4 | Perf baseline |
| P5-OPS-02 | DevOps | Docker setup za backend + MySQL | P1-P4 | Reproducibilno lokalno/staging okruženje |
| P5-OPS-03 | DevOps | CI/CD pipeline (build, test, deploy stage) | P5-OPS-02 | Automatizovan delivery tok |
| P5-OPS-04 | DevOps | Production deployment + smoke test runbook | P5-OPS-03 | Produkcijska isporuka |
| P5-MB-02 | Mobile | EAS build za Android APK i validacija instalacije - ovo se može preskočiti uraditi ću ručno | P5-QA-02 | Release build |
| P5-DOC-01 | Dokumentacija | Završna tehnička dokumentacija i operativni runbook | Svi taskovi | Zatvoren dokumentacioni paket |

## Phase gate - acceptance
- Svi kritični workflow-i prolaze automatske testove.
- CI/CD pipeline je green na glavnoj grani.
- Produkcioni deploy izvršen uz rollback provjeru.
- Mobile APK je testiran i validiran.
- Nema otvorenih P0/P1 bugova.

## Rizici i mitigacija
- Rizik: regresije pri završnom hardening-u.
- Mitigacija: freeze scope, samo bug-fix i stabilization taskovi nakon starta faze 5.
