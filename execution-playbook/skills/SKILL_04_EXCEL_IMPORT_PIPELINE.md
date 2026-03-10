# SKILL_04_EXCEL_IMPORT_PIPELINE

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Uvoz nove SIM isporuke iz Excel/CSV fajla.
- Ispravke u mapiranju kolona ili validaciji reda.

## Ulaz
- Upload fajl
- Shipment ID
- Mapping kolona prema domeni (`ICCID`, `ipAddress`, `publicIpAddress`)

## Procedura
1. Parsirati fajl i prikazati preview kolona.
2. Primijeniti mapiranje kolona.
3. Validirati redove: format ICCID, duplikati, prazna obavezna polja.
4. Razdvojiti rezultat na valid/noisy/error skup.
5. Batch upisati validne redove i vezati na shipment.
6. Evidentirati rezultat importa u activity log.

## Izlaz
- Import report: broj validnih, duplikata i odbijenih redova.
- Kreirani `SimCard` zapisi sa statusom `AVAILABLE`.

## Quality gate
- Nema direktnog upisa bez preview + validacije.
- Nema prekida cijelog importa zbog parcijalno nevalidnih redova.
