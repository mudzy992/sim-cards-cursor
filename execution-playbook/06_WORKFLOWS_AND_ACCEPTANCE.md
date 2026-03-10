# 06_WORKFLOWS_AND_ACCEPTANCE

Povratna referenca: [SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## WF-01: Excel Import SIM Kartica
### Cilj
Uvesti SIM kartice iz Excel/CSV fajla u odabrani shipment uz validaciju i izvještaj.

### Koraci
1. Admin/Moderator kreira shipment.
2. Upload fajla (`.xlsx`, `.xls`, `.csv`).
3. Backend parsira i vraća preview kolona.
4. Korisnik mapira kolone na domenska polja.
5. Sistem validira redove (duplikat, format, prazna polja).
6. Potvrda importa upisuje validne redove i loguje rezultat.

### Acceptance kriteriji
- Vraćen broj validnih/nevalidnih/duplih redova.
- Nijedan nevalidan red se ne upisuje u bazu.
- Uspješan import kreira `SimCard.status = AVAILABLE`.
- Kreiran `ActivityLog` zapis za import akciju.

### Test minimum
- 1 success test sa validnim fajlom.
- 1 test sa duplikatima ICCID.
- 1 test sa nevalidnim formatom ICCID.

## WF-02: Scan -> Create Record (Mobile)
### Cilj
Na terenu skenirati SIM i kreirati installation record bez ručnog prepisivanja ICCID-a.

### Koraci
1. User otvara scanner ekran i skenira barcode.
2. Mobile poziva `GET /api/sim-cards/scan/:iccid`.
3. Prikazuju se podaci kartice + CTA `Zaduži karticu`.
4. User klikne `Zaduži karticu`, mobile poziva `POST /api/sim-cards/:id/claim`.
5. Kartica prelazi u `ASSIGNED` i vezuje se za prijavljenog operatera.
6. User otvara formu za novi zapisnik.
7. Unosi podatke brojila, lokacije i opcionalne fotografije.
8. Backend kreira/vezuje meter i installation record.
9. Status SIM prelazi na `INSTALLED`; record prelazi u `PENDING` (ili `DRAFT` pa submit).

### Acceptance kriteriji
- Bez validnog skena nije moguće kreirati record.
- Bez uspješnog claim-a nije moguće nastaviti na ugradnju kartice.
- Record ima validnu vezu na `simCardId` i `meterId`.
- Generisan `recordNumber` prema obrascu.
- Moderator dobija notifikaciju za odobravanje.

### Test minimum
- 1 test validnog skena i kreiranja record-a.
- 1 test za nepostojeći ICCID.
- 1 test za claim već zadužene kartice kod drugog operatora.
- 1 test za scan kartice u nedozvoljenom statusu.

## WF-03: Approve -> PDF -> Email
### Cilj
Odobren zapisnik pretvoriti u PDF i poslati odabranim primaocima.

### Koraci
1. Moderator/Admin odobrava zapisnik.
2. Pokreće se slanje uz odabir grupe ili ručni email.
3. Backend renderuje PDF i priprema email template.
4. Email se šalje sa PDF attachmentom.
5. Record status prelazi na `SENT`.

### Acceptance kriteriji
- Slanje je moguće samo za `APPROVED` zapisnik.
- PDF je fizički generisan i putanja sačuvana.
- `sentAt` i `sentToEmail` su popunjeni.
- Neuspjeh slanja ne smije ostaviti lažno `SENT` stanje.

### Test minimum
- 1 success test sa validnim primaocima.
- 1 test za pokušaj slanja neodobrenog zapisnika.
- 1 test SMTP greške i provjera rollback/status ponašanja.

## Uniformni acceptance format po tasku
Za svaki task koristiti template:
- Task ID:
- Preconditions:
- Steps:
- Expected Result:
- Evidence (log/screenshot/test output):
