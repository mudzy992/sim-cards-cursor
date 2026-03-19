# 07_DELIVERY_GOVERNANCE

Povratna referenca: [SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## 1. Operativni ritam
- Planiranje: početak svake sedmice.
- Daily sync: kratki status blok (šta je završeno, blokeri, plan danas).
- Review: kraj sedmice, demo funkcionalnosti i status gate-a.
- Retrospektiva: nakon svake faze.

## 2. Prioritetni model
- `P0`: produkcijski blocker ili data-loss/security rizik.
- `P1`: kritična poslovna funkcija ne radi.
- `P2`: funkcija radi uz workaround.
- `P3`: kozmetički ili low-impact problem.

## 3. Task lifecycle
1. `Planned`
2. `In Progress`
3. `In Review`
4. `In QA`
5. `Done`

Pravilo: task ne smije ići u `Done` bez acceptance dokaza.

## 4. Bloker protokol
- Ako blokada traje > 4 sata, eskalirati i zapisati root cause.
- Ako blokada utiče na milestone, replanirati fazu isti dan.
- Svaka eskalacija mora imati owner-a i očekivani ETA.

## 5. Risk register (minimalni set)
- R-01: Nevalidan import podataka remeti inventory tačnost.
- R-02: Nekonzistentan status transition ruši workflow zapisnika.
- R-03: SMTP/PDF kvar blokira slanje odobrenih zapisnika.
- R-04: Mobile kamera/permission edge case blokira teren.
- R-05: Loš CI/CD signal dovodi do nestabilnog release-a.

## 6. KPI i kontrolne metrike
- Feature lead time po fazi.
- Broj otvorenih P0/P1 bugova.
- Prolaznost test pipeline-a.
- Uspješnost importa (valid rows / total rows).
- Uspješnost slanja zapisnika (sent success rate).

## 7. Release gate checklista
1. Svi kritični workflow-i prolaze e2e.
2. Env var set je kompletan i validiran.
3. Nema otvorenih P0 bugova.
4. Migracije testirane na staging-u.
5. Rollback procedura provjerena.
6. Smoke test produkcije definisan.

## 8. Dokumentacioni gate
Prije zatvaranja faze ažurirati:
- fazni dokument
- `DOC-05` ako je pomjeren scope/rok
- `DOC-06` ako je promijenjen tok
- `SOURCE_OF_TRUTH.md` ako je promijenjena mapa fajlova
