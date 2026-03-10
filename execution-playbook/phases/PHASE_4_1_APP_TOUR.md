# PHASE_4_1_APP_TOUR

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)  
Period: Sedmica 8 (inkrement između faze 4 i 5)

## Cilj faze
Uvesti vođeni “Tour” kroz aplikaciju za ključne uloge (MODERATOR i SYSTEM_ADMIN) kako bi onboarding bio brz, konzistentan i mjerljiv. Tour mora biti robustan u realnim uslovima (različite rezolucije, stanje podataka, RBAC).

## Obavezni deliverable-i
- Web: Tour za SYSTEM_ADMIN.
- Web: Tour za MODERATOR.
- (Opcionalno) Mobile: mini-tour / “first-run tips” za USER (operator) ili MODERATOR, ako je izvedivo bez velikog rizika.
- Evidencija “tour completed/skipped” per user (audit-friendly, ali ne u ActivityLog kao spam).

## Principi i pravila
- Tour je **role-aware**: korisnik vidi samo korake koji su relevantni za njegovu rolu i dostupne rute.
- Tour je **data-aware**: ako nema podataka (npr. nema isporuka), korak se ili preskače ili vodi korisnika na “kreiraj” akciju.
- Tour je **idempotentan**: može se restartovati u Postavkama, a stanje se pamti po korisniku.
- Tour je **otporan na promjene UI-a**: selektori/metode targetiranja ne smiju biti krhki (preferirati stabilne `data-tour-id` atribute nad CSS klasama).

## Predloženi scope (web)

### Tour: SYSTEM_ADMIN
1. **Dashboard**: gdje su statistike i “recent activity”.
2. **Korisnici** (tabovi): Users + (integrisano) Distribucije/Podružnice; objašnjenje scope modela.
3. **Isporuke + SIM kartice**: kreiranje isporuke, import iz Excel-a, validacije, filteri.
4. **Recipients / Approval grupe**: mapiranje grupe na podružnicu, dodavanje email primaoca i korisnika (RecipientGroupUser).
5. **Brojila**: pregled, detalj, zapisnici po brojilu, kreiranje zapisnika.
6. **Zapisnici**: statusi lifecycle-a (DRAFT → PENDING → WAITING_SEP_ACTIVATION → ACTIVATED_IN_SEP → SENT), akcije po statusu.
7. **Notifikacije**: bell, read/unread, real-time update.
8. **Dnevnik aktivnosti**: audit i filtriranje (ko/šta/kad).
9. **Postavke**: gdje se upravlja sistemskim parametrima (vidi “Admin Postavke” u fazi 4).

### Tour: MODERATOR
1. **Dashboard**: fokus na distribuciju i podružnice.
2. **Korisnici**: pregled operatera u svojoj distribuciji i dodjela/validacija scope-a.
3. **Isporuke + SIM**: pregled dostupnih SIM kartica u distribuciji, provjera stanja.
4. **Zapisnici**: odobravanje ulogom moderatora, tipični problemi i rješenja.
5. **Recipients**: upravljanje samo grupama svoje distribucije (enforcement reminder).
6. **Notifikacije**: real-time obavijesti vezane za approval tok.

## (Opcionalno) Mobile mini-tour
- “First run” tips na tabovima: Početna, Skeniranje, Zapisnici, Demontaža, Profil.
- Fokus: kako skenirati, kako napraviti zapisnik, kako poslati na odobrenje, gdje vidjeti status.

## Minimalni backend/API zahtjevi
- Settings/state per user:
  - `tour.web.systemAdmin.completedAt`
  - `tour.web.moderator.completedAt`
  - `tour.web.lastVersionSeen` (da se tour može ponovo prikazati nakon većih promjena)
  - (opciono) `tour.mobile.completedAt`
- Endpointi:
  - `GET /settings/me` (ili proširenje postojećeg profila) – vraća tour state.
  - `PATCH /settings/me` – upis tour state.

## Acceptance kriteriji
- SYSTEM_ADMIN i MODERATOR dobijaju tour samo jednom (osim ako ga ručno restartuju).
- Tour ne puca ako nedostaje target element (korak se preskače uz fallback poruku).
- Tour ne prikazuje korake za rute koje korisnik nema pravo otvoriti.
- Tour radi na najmanje 3 rezolucije (npr. 1366, 1440, 1920) i bez horizontalnog skrola.
- Stanje tour-a je sačuvano po korisniku i preživljava refresh/login.

## QA scenariji (minimalno)
- TOUR-01: SYSTEM_ADMIN prvi login → tour start → complete → više se ne prikazuje.
- TOUR-02: MODERATOR prvi login → tour start → skip → više se ne prikazuje; restart iz Postavki ga ponovo aktivira.
- TOUR-03: Role mismatch → SYSTEM_ADMIN ne dobija moderator tour i obrnuto.
- TOUR-04: Prazni podaci (nema isporuka / grupa) → koraci se prilagođavaju bez errora.

## Status faze

- Status: **ZAVRŠENO**
- Datum zaključivanja: 2026-03-10
- Napomena: Globalni web tour (SYSTEM_ADMIN, MODERATOR), detaljni page tour-ovi za ključne stranice (Isporuke, Brojila, Zapisnici, Korisnici, Primaoci) i mobile mini-tour na Početnoj su implementirani i verifikovani kroz scenarije TOUR-01..TOUR-04.

## Task backlog

| Task ID | Domen | Opis | Dependency | Output |
|---|---|---|---|---|
| P4.1-BE-01 | Backend | Proširenje settings modela za tour state per user (`tour.web.*`, `tour.mobile.*`) | P4-BE-06, P4-BE-09 | Tour state storage |
| P4.1-BE-02 | Backend | Endpointi `GET /settings/me` i `PATCH /settings/me` (ili proširenje profila) za čitanje/upis tour state-a | P4.1-BE-01 | Tour API |
| P4.1-FE-01 | Frontend | Implementacija SYSTEM_ADMIN tour-a (koraci, `data-tour-id`, role-aware logika) | P4-FE-01..P4-FE-06 | Web tour – admin |
| P4.1-FE-02 | Frontend | Implementacija MODERATOR tour-a (koraci fokusirani na distribuciju/podružnice) | P4-FE-01..P4-FE-06 | Web tour – moderator |
| P4.1-FE-03 | Frontend | Tour launcher + “Restart tour” opcija u Postavkama (vezano na settings/tour state) | P4.1-BE-02 | Tour kontrola u UI |
| P4.1-FE-04 | Frontend | Fallback handling: preskakanje koraka kada target element ne postoji + logging | P4.1-FE-01, P4.1-FE-02 | Robustan tour UX |
| P4.1-MB-01 | Mobile | (Opcionalno) Mini-tour / first-run tips po tabovima (Početna, Skeniranje, Zapisnici, Demontaža, Profil) | P3-MB-*, P4-MB-* | Mobile tour v1 |
| P4.1-QA-01 | QA | Testovi TOUR-01..TOUR-04 (role, first-run, skip/restart, prazni podaci) | P4.1-FE-01..04 | Tour e2e set |

