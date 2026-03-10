# 03_RULEBOOK

Povratna referenca: [SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## Pravila po prioritetu

### Kritična (R-C)
- `R-C-01`: Svaki endpoint mora imati auth guard osim eksplicitno javnih auth ruta.
- `R-C-02`: RBAC mora biti proveden na svim administrativnim i moderatorskim akcijama.
- `R-C-03`: Status transition za `SimCard` i `InstallationRecord` mora biti validiran centralno.
- `R-C-04`: Nijedan email/PDF se ne smije poslati za `RecordStatus != APPROVED`.
- `R-C-05`: Import mora detektovati duplikate i nevalidne ICCID vrijednosti prije upisa.
- `R-C-06`: Svaka kritična mutacija mora ostaviti audit trag u `ActivityLog`.

### Visoka (R-H)
- `R-H-01`: Svi input DTO objekti moraju imati `class-validator` pravila.
- `R-H-02`: Response payload mora biti konzistentan po modulu.
- `R-H-03`: Upload mora imati limit veličine i dozvoljene MIME tipove.
- `R-H-04`: Sve async operacije moraju imati timeout handling.
- `R-H-05`: Frontend i mobile greške moraju biti prevedive u korisnički razumljivu poruku.

### Srednja (R-M)
- `R-M-01`: Svaki modul ima jasan sloj: `controller -> service -> prisma`.
- `R-M-02`: Komponente se ne smiju direktno vezati za neobrađene API response-e.
- `R-M-03`: Datumi se standardizuju kroz jednu util biblioteku (`dayjs`).
- `R-M-04`: Feature flag/podešavanja idu kroz `AppSetting`, ne hardcode.

## Pravila kvaliteta
- `Q-01`: Minimalni coverage cilj za backend servise: 70% u fazi 5.
- `Q-02`: Kritični workflow e2e testovi su obavezni prije produkcije.
- `Q-03`: PR ne prolazi ako postoji lint ili type error.
- `Q-04`: Svaki bug fix mora sadržavati reprodukciju i test dokaz.

## Pravila sigurnosti
- `S-01`: JWT tajne i SMTP kredencijali samo iz environment varijabli.
- `S-02`: CORS whitelist mora biti eksplicitna, bez wildcard u produkciji.
- `S-03`: Helmet middleware aktivan u produkciji.
- `S-04`: Rate limit 100 req/min po IP minimalno na javnim endpointima.
- `S-05`: Upload putanje i imena fajlova sanitizovati prije snimanja.
- `S-06`: HTTPS je obavezan u produkcionom okruženju.

## Pravila release-a
- `REL-01`: Nema release-a bez prolaska phase-gate checkliste.
- `REL-02`: Svi env ključevi iz `DOC-06` moraju biti validirani.
- `REL-03`: Rollback plan mora postojati prije svake produkcione migracije.
- `REL-04`: Mobile build (EAS) mora biti testiran na realnom uređaju.

## Pravila dokumentacije
- `D-01`: Svaka promjena funkcionalnosti mora ažurirati odgovarajući fazni dokument.
- `D-02`: Ako se promijeni workflow, ažurirati `DOC-06`.
- `D-03`: Ako se doda skill ili procesno pravilo, ažurirati `DOC-04` ili `DOC-02`.
