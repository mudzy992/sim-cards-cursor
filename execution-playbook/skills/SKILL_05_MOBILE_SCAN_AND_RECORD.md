# SKILL_05_MOBILE_SCAN_AND_RECORD

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Implementacija ili promjena toka: scan barcode -> pregled kartice -> kreiranje zapisnika.

## Ulaz
- Kamera i barcode dozvole
- ICCID sa skena
- Endpoint `GET /api/sim-cards/scan/:iccid`

## Procedura
1. Implementirati scanner ekran sa fokus zonom i flashlight kontrolom.
2. Po uspješnom skenu pozvati scan endpoint i prikazati rezultat.
3. Ako kartica postoji i dozvoljen status, otvoriti formu za zapisnik.
4. Auto-popuniti SIM podatke, ručno unijeti meter i lokaciju.
5. Omogućiti GPS capture i photo attachment.
6. Snimiti zapisnik i prikazati status odgovora.

## Izlaz
- Stabilan mobilni flow bez ručnog prepisivanja ICCID-a.
- Kreiran zapisnik sa validnim podacima i vezom na SIM.

## Quality gate
- Nema mogućnosti kreiranja zapisnika bez validnog skena.
- UI mora prikazati jasne fallback poruke za sve greške (kamera, mreža, not found).
