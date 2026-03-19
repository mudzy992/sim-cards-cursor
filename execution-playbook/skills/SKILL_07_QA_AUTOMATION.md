# SKILL_07_QA_AUTOMATION

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Novi feature, bug fix, release kandidat.

## Ulaz
- Lista promijenjenih taskova
- Kritični workflow-i iz `DOC-06`

## Procedura
1. Izabrati nivo testiranja: unit/integration/e2e.
2. Definisati test slučajeve za success i failure scenarije.
3. Pokriti RBAC i status transition edge slučajeve.
4. Dodati regresioni test za svaki potvrđeni bug.
5. Izvršiti test suite i dokumentovati rezultat.

## Izlaz
- Test izvještaj po task ID-u.
- Evidencija neuspjelih i popravljanih scenarija.

## Quality gate
- Kritični flow bez e2e testa ne može proći release gate.
- Bug fix bez testa se smatra nedovršenim taskom.
