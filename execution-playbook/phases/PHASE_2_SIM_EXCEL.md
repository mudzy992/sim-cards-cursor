# PHASE_2_SIM_EXCEL

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)
Period: Sedmica 3-4

## Status
- Status: COMPLETED
- Datum početka: 2026-03-07
- Datum završetka: 2026-03-07
- Zaključak: svi P2 backend/frontend/mobile/QA taskovi isporučeni i verifikovani.

## Progress update (2026-03-07)
- Backend: P2-BE-01..P2-BE-08 kompletirani (shipments CRUD, Excel parser/mapping/preview/apply, SIM CRUD/filter/paginacija, scan, assign/unassign, activity-log hookovi).
- Frontend: P2-FE-01..P2-FE-05 kompletirani (shipments lista + detalji, import wizard, SIM lista sa filterima/pretragom/paginacijom, SIM detalji, assignment modal).
- Mobile: P2-MB-01..P2-MB-04 kompletirani (kamera permission + barcode scan, scan-result ekran/API, info prikaz kartice, moje dodijeljene kartice).
- QA: P2-QA-01..P2-QA-03 pokriveni smoke scenarijima (`npm run smoke:phase2`, `npm run smoke:phase2:import`, `npm run smoke:phase2:import-validation`).
- CR-01 (2026-03-07): dodan self-service tok `Zaduži karticu` za operatera nakon skena/ICCID unosa (backend `claim` endpoint + mobile CTA), uz zadržanu admin assign logiku.

## Cilj faze
Implementirati kompletan tok upravljanja SIM karticama, uključujući import isporuka i mobilno skeniranje.

## Obavezni deliverable-i
- Shipments CRUD i import workflow.
- SIM kartice CRUD/filter/paginacija + assignment (admin) + self-claim (operator).
- Mobile barcode scan i prikaz kartice.
- Activity log za ključne operacije.

## Task backlog
| Task ID | Domen | Opis | Dependency | Output |
|---|---|---|---|---|
| P2-BE-01 | Backend | Shipments modul (CRUD + listing) | P1-BE-* | Shipment endpoint-i |
| P2-BE-02 | Backend | Excel parser servis sa podrškom za `.xlsx/.xls/.csv` | P2-BE-01 | Parsiranje upload-a |
| P2-BE-03 | Backend | Column mapping logika i preview odgovori | P2-BE-02 | Mapping API |
| P2-BE-04 | Backend | Import validacija (ICCID format, duplikati, obavezna polja) | P2-BE-03 | Validation report |
| P2-BE-05 | Backend | SIM Cards modul (CRUD + filteri + paginacija) | P2-BE-01 | SIM endpoint-i |
| P2-BE-06 | Backend | Scan endpoint po ICCID (`/sim-cards/scan/:iccid`) | P2-BE-05 | Lookup API |
| P2-BE-07 | Backend | Assignment/unassignment logika + status update | P2-BE-05 | Dodjela kartica |
| P2-BE-08 | Backend | Activity log modul i hook-ovi na import/assign | P2-BE-01, P2-BE-07 | Audit evidencija |
| P2-BE-09 | Backend | Self-claim endpoint za operatera (`POST /sim-cards/:id/claim`) | P2-BE-06 | Operator zaduživanje kartice |
| P2-FE-01 | Frontend | Shipments lista i detalji | P2-BE-01 | Shipment UI |
| P2-FE-02 | Frontend | Excel import wizard (upload -> mapping -> preview -> import) | P2-BE-04 | Import UI tok |
| P2-FE-03 | Frontend | SIM kartice lista sa filterima/pretragom/paginacijom | P2-BE-05 | SIM inventory UI |
| P2-FE-04 | Frontend | SIM detalji stranica | P2-FE-03 | Detaljan prikaz kartice |
| P2-FE-05 | Frontend | Dodjela kartice korisniku kroz modal | P2-BE-07 | Assignment UI |
| P2-MB-01 | Mobile | Barcode scanner ekran i permisije | P1-MB-* | Scanner funkcionalnost |
| P2-MB-02 | Mobile | Scan result ekran i API integracija | P2-MB-01, P2-BE-06 | Rezultat skena |
| P2-MB-03 | Mobile | Prikaz info kartice (status, IP, isporuka) | P2-MB-02 | Info view |
| P2-MB-04 | Mobile | Lista dodijeljenih kartica korisniku | P2-BE-07 | My assigned SIM list |
| P2-MB-05 | Mobile | CTA `Zaduži karticu` na scan-result ekranu | P2-BE-09, P2-MB-02 | Self-claim UX |
| P2-QA-01 | QA | Testovi import validacije i duplicate handling | P2-BE-04 | Import test set |
| P2-QA-02 | QA | E2E: upload -> map -> preview -> import | P2-FE-02 | Kritični import e2e |
| P2-QA-03 | QA | E2E: mobile scan success/not-found | P2-MB-02 | Scan e2e scenariji |
| P2-QA-04 | QA | E2E: claim AVAILABLE kartice + blokada claim-a za zauzetu karticu | P2-BE-09, P2-MB-05 | Claim test set |

## Phase gate - acceptance
- Import radi kroz puni wizard bez ručnog SQL fallback-a.
- SIM kartice su pretražive i pravilno filtrirane.
- Mobile sken vraća tačne podatke kartice.
- Assignment (admin) i claim (operator) mijenjaju status i evidentiraju activity log.

## Rizici i mitigacija
- Rizik: Loš kvalitet ulaznih Excel podataka.
- Mitigacija: stroga validacija + parcijalni import sa izvještajem grešaka.
