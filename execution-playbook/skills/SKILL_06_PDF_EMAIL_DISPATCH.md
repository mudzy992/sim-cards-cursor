# SKILL_06_PDF_EMAIL_DISPATCH

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Odobren zapisnik treba poslati email-om.
- Potrebna promjena PDF template-a ili email template-a.

## Ulaz
- `RecordStatus = APPROVED`
- Lista primalaca (grupa ili pojedinačni email)
- Podaci zapisnika (SIM, brojilo, lokacija, odobrio)

## Procedura
1. Učitati potpune podatke zapisnika.
2. Renderovati HTML template za PDF.
3. Generisati PDF i snimiti putanju u `pdfPath`.
4. Renderovati email template i attach-ovati PDF.
5. Poslati email svim primaocima.
6. Ažurirati status na `SENT` i upisati `sentAt`/`sentToEmail`.

## Izlaz
- Validan PDF dokument.
- Uspješno poslan email sa attachment-om.

## Quality gate
- Slanje je zabranjeno za neodobrene zapisnike.
- Failover mora ostaviti konzistentan status i detaljnu grešku.
