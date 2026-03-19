# PHASE_3_METERS_RECORDS_PDF

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)
Period: Sedmica 5-6

## Cilj faze
Uvesti AMM brojila i kompletan lifecycle zapisnika, uključujući PDF generisanje i approval workflow.

## Obavezni deliverable-i
- Meters CRUD.
- Installation records CRUD + status workflow.
- Auto-generisanje broja zapisnika.
- PDF preview/download podrška na web-u.
- Mobile forma za kreiranje zapisnika nakon skena.

## Task backlog
| Task ID | Domen | Opis | Dependency | Output |
|---|---|---|---|---|
| P3-BE-01 | Backend | Meters modul (CRUD + available endpoint) | P2-BE-* | Meter API |
| P3-BE-02 | Backend | Installation Records modul (CRUD) | P3-BE-01, P2-BE-05 | Records API |
| P3-BE-03 | Backend | Generator broja zapisnika (`ZAP-YYYY-xxxxx`) | P3-BE-02 | Record numbering util |
| P3-BE-04 | Backend | Validacija status transition-a (draft/pending/approved/rejected/sent) | P3-BE-02 | Transition guard logika |
| P3-BE-05 | Backend | Approval/rejection endpoint-i sa reason handling | P3-BE-04 | Moderatorski workflow |
| P3-BE-06 | Backend | PDF generator servis (Handlebars + Puppeteer) | P3-BE-02 | PDF artefakt |
| P3-BE-07 | Backend | PDF download endpoint i storage putanja | P3-BE-06 | `pdfPath` lifecycle |
| P3-FE-01 | Frontend | Meters lista i forma | P3-BE-01 | Meter UI |
| P3-FE-02 | Frontend | Records lista sa filterima i statusima | P3-BE-02 | Records UI |
| P3-FE-03 | Frontend | Record create forma (web) | P3-BE-02 | Record create UI |
| P3-FE-04 | Frontend | Record detail sa PDF preview | P3-BE-07 | Record details UI |
| P3-FE-05 | Frontend | Approval/rejection modal | P3-BE-05 | Moderation UI |
| P3-FE-06 | Frontend | PDF download akcija | P3-BE-07 | PDF preuzimanje |
| P3-MB-01 | Mobile | Create record forma nakon skena | P2-MB-02, P3-BE-02 | Mobile create flow |
| P3-MB-02 | Mobile | Meter input sekcija (serial, tip, manufacturer) | P3-MB-01 | Meter entry |
| P3-MB-03 | Mobile | GPS capture i lokacijski input | P3-MB-01 | Lokacijski podaci |
| P3-MB-04 | Mobile | Photo capture i attach workflow | P3-MB-01 | Foto prilozi |
| P3-MB-05 | Mobile | Moji zapisnici lista + status praćenje | P3-BE-02 | User records view |
| P3-QA-01 | QA | Unit testovi za transition i record number generator | P3-BE-03, P3-BE-04 | Core logic testovi |
| P3-QA-02 | QA | E2E: scan -> create record -> pending status | P3-MB-01, P3-BE-02 | Mobile flow e2e |
| P3-QA-03 | QA | E2E: approve/reject + pdf generation | P3-BE-06 | Moderation/PDF e2e |

## Backend P3-BE-* status (2026-03-07)
- **P3-BE-01 do P3-BE-07**: Implementirani. Meters zaštićen JwtAuthGuard + RolesGuard (ADMIN/MODERATOR, USER samo za GET available). Installation Records: ActivityLog na svim mutacijama; approve/reject samo iz PENDING; paginacija + filter po statusu; PDF storage; **GET /installation-records/my** za moji zapisnici (mobile). Create dozvoljen i za USER (web + mobile).

## Frontend P3-FE-* status (2026-03-07) – kompletirano
- **P3-FE-01**: Meters lista i forma (CRUD, paginacija, role ADMIN/MODERATOR).
- **P3-FE-02**: Records lista sa filterom po statusu, paginacija, link na detalj.
- **P3-FE-03**: Record create forma (web): odabir SIM (my-assigned / ASSIGNED), brojila (available), datum, adresa, lokacija, napomena; role USER + MODERATOR + ADMIN.
- **P3-FE-04**: Record detail stranica: podaci zapisnika, pregled PDF-a (iframe iz blob-a).
- **P3-FE-05**: Approval/rejection modal na detail stranici (samo za ADMIN/MODERATOR, status PENDING).
- **P3-FE-06**: PDF download akcija (preuzimanje blob-a).

## Mobile P3-MB-* status (2026-03-08) – kompletirano
- **P3-MB-01**: Create record forma nakon skena: na rezultatu skena (zadužena kartica) gumb "Kreiraj zapisnik ugradnje" → create-record ekran.
- **P3-MB-02**: Meter input: odabir brojila iz liste dostupnih (GET /meters/available; USER pristup dozvoljen).
- **P3-MB-03**: GPS capture: dugme "Dohvati lokaciju" – automatski dohvat koordinata (opcionalan, preporučljiv); requestForegroundPermissionsAsync; ako korisnik odbije dozvolu, prikaže se poruka.
- **P3-MB-04**: Photo capture: dugme "Dodaj fotografiju" – expo-image-picker (kamera), upload na POST /installation-records/upload-photo; putanje se čuvaju u bazi (photos JSON).
- **P3-MB-05**: Moji zapisnici: tab "Records" prikazuje listu iz GET /installation-records/my (recordNumber, status, ICCID, brojilo, datum).

## Izmjena logike (2026-03-07): Tipovi brojila i broj brojila na zapisniku

### Odluka
- **Tipovi brojila (katalog)**: Sistem administrator i moderator na webu upravljaju **katalogom tipova brojila**. Svaki tip ima predefinisane podatke: naziv, proizvođač, model, tip (jednofazno/trofazno), max struja, napomena. Ovo nije pojedinačno brojilo već šablon (npr. "AMM 3.0", "Landis+Gyr E650").
- **Kreiranje zapisnika**: Pri kreiranju zapisnika (web i mobile) korisnik **bira tip brojila** iz kataloga i **upisuje broj brojila** (serijski broj / broj brojila na terenu). Ti podaci su ključni na zapisniku uz podatke o SIM kartici. Veza zapisnika na pojedinačno "Meter" entitet (inventar) je ukinuta u korist **tip + broj brojila**.
- **Meter (inventar)**: Entitet Meter ostaje za eventualnu inventuru; za zapisnik ugradnje koriste se isključivo **tip brojila (katalog)** + **broj brojila** (tekst).

### Implementacioni zahtjevi
- Backend: novi modul/entitet **MeterTypeDefinition** (katalog tipova) – CRUD, zaštićen rolama ADMIN/MODERATOR. Installation record: polja **meterTypeDefinitionId** (FK, obavezno za novi zapisnik) i **meterNumber** (string, obavezno); **meterId** postaje opcionalan (backward compatibility / deprecated).
- Frontend: stranica "Tipovi brojila" (CRUD) za ADMIN/MODERATOR; u formi za kreiranje zapisnika – odabir tipa brojila iz kataloga i unos broja brojila (umjesto odabira konkretnog Meter).
- Mobile: pri kreiranju zapisnika – odabir tipa brojila i unos broja brojila.
- API limit: zahtjevi koji šalju `limit` veći od 100 (npr. SIM kartice za formu) moraju koristiti max 100 (backend PaginationDto @Max(100)).

### Referenca
- DOC-02, DOC-03; fazni dokument PHASE_3.

## Ujednačena logika: Tipovi brojila i Brojila (2026-03-07)

- **Tipovi brojila** = katalog tipova (npr. ME84, AMM 3.0). Admin/moderator na webu dodaje tipove s predefinisanim podacima (naziv, proizvođač, model, jednofazno/trofazno, max struja, napomena).
- **Brojila** = inventar pojedinačnih brojila. Svako brojilo ima:
  - **Tip brojila** (veza na katalog – opcionalno): iz kataloga "Tipovi brojila".
  - **Serijski broj** (obavezno): jedinstven.
  - Ostale podatke (proizvođač, model, godina, max struja, napomena, lokacija, mjesto) – opcionalno.
  - **Povezanu SIM karticu** kroz zapisnik: trenutno samo jedna SIM po brojilu (ona iz najnovijeg zapisnika za to brojilo).
  - **Svoje zapisnike** (povijest): jedno brojilo može imati **više zapisnika** – npr. svaki put kada se na to brojilo ugradi nova SIM kartica (stara u kvaru, zamjena), kreira se **novi zapisnik** (demontaža stare kartice, pridruživanje nove).
- **Pravilo**: Zapisnik se kreira svaki put kada se brojilu pridružuje (nova) SIM kartica. Pri kreiranju zapisnika bira se **brojilo** (iz inventara) i **SIM kartica**; opcionalno ostaje unos **tip brojila + broj brojila** ako brojilo nije u inventaru.
- **Shema**: `Meter` ima vezu **installationRecords[]** (one-to-many). Na `InstallationRecord` polje `meterId` nije više unique – isto brojilo može imati više zapisnika. GET /meters/available vraća sva brojila (uvijek se može kreirati novi zapisnik = pridruživanje SIM brojilu).

## Kompletna refaktorizacija logike (2026-03-07)

### Matrica
- **Tipovi brojila**: Više tipova s osnovnim podacima (naziv, proizvođač, model, faznost, max struja).
- **Brojila**: Svaki tip može imati više brojila (serijski broj, osnovni podaci, **lokacija instalacije**, **datum**, **mjerno mjesto (MM)**). Svi ti podaci pripadaju brojilu.
- **Jedno brojilo ↔ jedna SIM** (trenutna). Zamjena: označiti brojilo, demontirati staru karticu, operator skenira i dodjeljuje novu → kreira se novi zapisnik.
- **Jedno brojilo ↔ više zapisnika** (povijest).

### Zapisnik (InstallationRecord)
- **Samo link**: simCardId + meterId + installedById. Nema vlastitih instalacijskih podataka – sve dolazi iz Meter i Tip.
- **PDF sadrži**: SIM (ICCID, IP, javna IP, broj, kome dodijeljena), Brojilo (serijski broj, osnovni podaci, lokacija, datum, MM), Tip brojila (svi relevantni podaci).

### Schema
- **Meter**: meterTypeDefinitionId obavezan; dodana polja installationAddress, installationDate, city, municipality, measuringPoint, latitude, longitude.
- **InstallationRecord**: uklonjena installationAddress, installationDate, city, municipality, meterTypeDefinitionId, meterNumber; meterId obavezan.

### Kreiranje
- **Novo brojilo**: forma s obaveznim tipom brojila, serijskim brojem i instalacijskim podacima → zapisuje se u tabelu `meters`.
- **Novi zapisnik**: odabir brojila + SIM kartice → zapisnik = pridruživanje SIM brojilu.

## Jedna stranica "Brojila" (dashboard) (2026-03-07)

- U sidebaru ostaje **jedna stavka: Brojila** (bez posebne stavke "Tipovi brojila").
- Stranica **Brojila** (`/meters`) sadrži:
  - **Tab "Brojila"**: lista svih brojila (ugrađena, po serijskim brojevima i podacima), filter po tipu brojila, dugme **Novo brojilo**, pregled **detalja** određenog brojila (drawer s opisom i listom zapisnika za to brojilo), te mogućnost uređivanja i brisanja.
  - **Tab "Tipovi brojila"**: pregled tipova brojila, dodavanje, izmjena i brisanje tipova.
- Matrica: jedan tip – više brojila; jedno brojilo – jedna SIM (trenutna), više zapisnika.
- Zapisnik (PDF) prolazi sa **svim podacima SIM kartice** (ICCID, IP, broj, APN) i **svim podacima brojila** (tip, proizvođač, model, jednofazno/trofazno, max struja, godina, napomena), uključujući podatke iz tipa brojila kada je brojilo povezano na tip.

## PDF generisanje (2026-03-07)

- Ispravljeno 500 pri GET /installation-records/:id/pdf: putanja do Handlebars predloška (fallback na `process.cwd()/src/templates`), serijalizacija zapisa za PDF (datumi u formatu, ugniježđeni objekti simCard/meter/installedBy), Puppeteer s `headless: true` i `--no-sandbox`. Nest assets: `templates/**/*` kopira se u `dist`.

## Phase gate - acceptance
- Meters i records moduli funkcionalni i role-zaštićeni.
- Record status transition ne dozvoljava nelegalne prelaze.
- PDF se generiše i može preuzeti sa web-a.
- Mobile korisnik može zatvoriti tok kreiranja zapisnika od skena do submit-a.

## Rizici i mitigacija
- Rizik: status race condition kod istovremenih approval akcija.
- Mitigacija: transakcijska obrada i status lock provjera pri mutaciji.
