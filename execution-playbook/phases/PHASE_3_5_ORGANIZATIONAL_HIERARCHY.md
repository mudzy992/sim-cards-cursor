# PHASE_3_5_ORGANIZATIONAL_HIERARCHY

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)
Period: Prije Faze 4 (Sedmica 6.5–7)
**Status: ZAVRŠENA** (2026-03-08)

## Cilj faze
Implementirati organizacionu hijerarhiju preduzeća: Elektroprivreda (krovna kuća) → Distribucije (ED Sarajevo, ED Zenica, ED Mostar) → Podružnice (Zenica, Visoko, Olovo). Omogućiti više sistemskih administratora, moderatora i operatora sa odgovarajućim scope-om podataka.

## Kontekst
Preduzeće koje koristi aplikaciju ima više nivoa ovlaštenja:
- **Elektroprivreda** – krovna kuća (sistemski administratori)
- **Distribucije** – ED Sarajevo, ED Zenica, ED Mostar (moderatori – zaduženi samo za svoju distribuciju)
- **Podružnice** – unutar distribucija, npr. ED Zenica ima Zenica, Visoko, Olovo (operatori – rade samo na nivou svoje podružnice)

## Scope po ulozi
| Uloga | Scope | Opis |
|------|-------|------|
| **SYSTEM_ADMIN** | Svi podaci | Vidi i upravlja svim – sve distribucije, sve podružnice, svi operatori |
| **MODERATOR** | Samo svoja distribucija | Moderira samo svoju distribuciju i njenim podružnicama/operatorima |
| **USER (Operator)** | Samo svoja podružnica | Radi samo na nivou svoje podružnice |

## Obavezni deliverable-i
- Modeli: Distribution (distribucija), Branch (podružnica).
- User veza na Distribution i Branch (moderator → distribucija, operator → podružnica).
- Backend scope filtering: moderator vidi samo svoju distribuciju, operator samo svoju podružnicu.
- Web UI: upravljanje distribucijama i podružnicama (admin); pri dodjeljivanju moderatora/operatora – odabir distribucije/podružnice.
- Migracija postojećih korisnika (default distribucija/podružnica ili ručno mapiranje).

## Task backlog
| Task ID | Domen | Opis | Dependency | Output |
|---------|-------|------|-------------|--------|
| P35-BE-01 | Backend | Prisma modeli Distribution, Branch; User.distributionId, User.branchId | P3-BE-* | Migracija |
| P35-BE-02 | Backend | CRUD API za distribucije i podružnice (admin) | P35-BE-01 | Distribution/Branch API |
| P35-BE-03 | Backend | Scope filtering u svim modulima (users, meters, records, sim-cards, shipments, demount-tasks) | P35-BE-01 | Filtered queries |
| P35-BE-04 | Backend | Validacija: moderator može dodijeliti zadatak samo operatorima iz svoje distribucije | P35-BE-03 | Guard/logic |
| P35-FE-01 | Frontend | Stranica Distribucije (lista, dodaj, uredi, obriši) | P35-BE-02 | Distributions UI |
| P35-FE-02 | Frontend | Stranica Podružnice (lista po distribuciji, dodaj, uredi, obriši) | P35-BE-02 | Branches UI |
| P35-FE-03 | Frontend | User forma: odabir distribucije (moderator), odabir podružnice (operator) | P35-BE-02 | User form update |
| P35-FE-04 | Frontend | Demount task create: lista operatora filtrirana po distribuciji moderatora | P35-BE-03 | Demount UI |
| P35-QA-01 | QA | Testovi scope-a: moderator vidi samo svoju distribuciju | P35-BE-03 | Scope tests |

## Phase gate - acceptance
- Sistemski administrator vidi sve podatke.
- Moderator vidi i upravlja samo podacima svoje distribucije i njenih podružnica.
- Operator vidi i radi samo na nivou svoje podružnice.
- Buduća analitika može se granularno filtrirati po distribuciji/podružnici.

## Rizici i mitigacija
- Rizik: Postojeći korisnici bez distribucije/podružnice.
- Mitigacija: migracija sa default vrijednostima ili ručno mapiranje preko admin UI.
