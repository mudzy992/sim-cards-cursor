# 04_SKILLS_CATALOG

Povratna referenca: [SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## Svrha
Skill-ovi predstavljaju standardizovane načine rada za ponovljive tipove zadataka u ovom projektu.

## Skill mapa
| Skill ID | Fajl | Primarna namjena | Tipični trigger |
|---|---|---|---|
| SK-01 | `skills/SKILL_01_PRODUCT_BREAKDOWN.md` | Razbijanje zahtjeva u taskove | Novi feature ili veća promjena scope-a |
| SK-02 | `skills/SKILL_02_BACKEND_API_IMPLEMENTATION.md` | Implementacija backend modula i endpointa | Novi endpoint ili servis logika |
| SK-03 | `skills/SKILL_03_DATA_MODEL_AND_MIGRATIONS.md` | Modeliranje podataka i migracije | Izmjena schema/modela/statusa |
| SK-04 | `skills/SKILL_04_EXCEL_IMPORT_PIPELINE.md` | Import pipeline i validacija podataka | Uvoz isporuka i SIM batch-eva |
| SK-05 | `skills/SKILL_05_MOBILE_SCAN_AND_RECORD.md` | Mobile scan -> record workflow | Terenski tok i barcode funkcije |
| SK-06 | `skills/SKILL_06_PDF_EMAIL_DISPATCH.md` | PDF generisanje i slanje email-a | Approval/sending tok zapisnika |
| SK-07 | `skills/SKILL_07_QA_AUTOMATION.md` | Test strategija i automatizacija | Bug fix, regresija, release gate |
| SK-08 | `skills/SKILL_08_DEVOPS_RELEASE.md` | CI/CD, docker, deployment | Pred-release i produkciona isporuka |

## Pravilo korištenja skill-ova
1. Za svaki task mora biti odabran barem jedan skill ID.
2. Ako task ima backend + mobile + QA implikacije, koriste se kombinovani skill-ovi (`SK-02 + SK-05 + SK-07`).
3. Skill output mora biti vidljiv kroz artefakte: kod, test, dokumentacija.
4. Skill koji se koristi mora biti naveden u opisu taska/PR-a.

## Skill chaining pravilo
Preporučeni redoslijed za kompleksne feature-e:
1. `SK-01` (dekompozicija)
2. `SK-03` (ako schema mijenja)
3. `SK-02` i/ili `SK-05`
4. `SK-06` (ako se generiše ili šalje zapisnik)
5. `SK-07`
6. `SK-08` (za release spremnost)
