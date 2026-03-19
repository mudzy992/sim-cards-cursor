# SKILL_01_PRODUCT_BREAKDOWN

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Dobijen novi feature zahtjev.
- Task je preširok i nema jasne granice.

## Ulaz
- Aktivna faza (`P1`-`P5`)
- Originalni zahtjev
- Postojeća pravila (`DOC-02`, `DOC-03`)

## Procedura
1. Ekstraktovati cilj feature-a u jednoj rečenici.
2. Definisati scope granice: šta ulazi, šta ne ulazi.
3. Podijeliti na backend/frontend/mobile/qa blokove.
4. Označiti dependency redoslijed (hard dependency vs paralelno).
5. Kreirati task ID-ove i acceptance kriterije.

## Izlaz
- Lista taskova sa ID prefiksom aktivne faze.
- Definisan DoD po tasku.
- Evidentirane pretpostavke i rizici.

## Quality gate
- Nema taska bez mjerljivog acceptance kriterija.
- Nema taska sa više od jedne odgovorne domene bez podjele.
