# SOURCE_OF_TRUTH

Datum inicijalizacije: 2026-03-06
Izvor plana: `./execution-playbook/📋 Kompletni Plan Aplikacije.docx`

## Kanonsko pravilo
Ovaj fajl je jedina kanonska ulazna tačka za kompletan plan isporuke. Svaki novi član tima ili agent mora krenuti od ovog dokumenta i tek nakon toga otvarati ostale fajlove.

## Obavezni redoslijed čitanja
1. [01_ARCHITECTURE_BASELINE.md](./01_ARCHITECTURE_BASELINE.md)
2. [02_STRICT_INSTRUCTIONS.md](./02_STRICT_INSTRUCTIONS.md)
3. [03_RULEBOOK.md](./03_RULEBOOK.md)
4. [04_SKILLS_CATALOG.md](./04_SKILLS_CATALOG.md)
5. [05_PHASES_OVERVIEW.md](./05_PHASES_OVERVIEW.md)
6. [06_WORKFLOWS_AND_ACCEPTANCE.md](./06_WORKFLOWS_AND_ACCEPTANCE.md)
7. [07_DELIVERY_GOVERNANCE.md](./07_DELIVERY_GOVERNANCE.md)
8. Skill dokumenti u `./skills/`
9. Faza dokumenti u `./phases/`

## Mapa dokumenata
| ID | Fajl | Svrha |
|---|---|---|
| DOC-01 | `01_ARCHITECTURE_BASELINE.md` | Arhitekturne i domenske osnove sistema |
| DOC-02 | `02_STRICT_INSTRUCTIONS.md` | Striktne operativne instrukcije za izradu |
| DOC-03 | `03_RULEBOOK.md` | Pravila kvaliteta, sigurnosti i isporuke |
| DOC-04 | `04_SKILLS_CATALOG.md` | Definisani skill-ovi, trigger-i i output-i |
| DOC-05 | `05_PHASES_OVERVIEW.md` | Globalni plan po fazama i milestone-i |
| DOC-06 | `06_WORKFLOWS_AND_ACCEPTANCE.md` | Kritični workflow-i i acceptance kriteriji |
| DOC-07 | `07_DELIVERY_GOVERNANCE.md` | Upravljanje delivery procesom i kontrolne tačke |
| SK-01 | `skills/SKILL_01_PRODUCT_BREAKDOWN.md` | Dekompozicija zahtjeva u taskove |
| SK-02 | `skills/SKILL_02_BACKEND_API_IMPLEMENTATION.md` | Implementacija backend API i servisa |
| SK-03 | `skills/SKILL_03_DATA_MODEL_AND_MIGRATIONS.md` | Schema promjene i migracije |
| SK-04 | `skills/SKILL_04_EXCEL_IMPORT_PIPELINE.md` | Import workflow i validacija podataka |
| SK-05 | `skills/SKILL_05_MOBILE_SCAN_AND_RECORD.md` | Mobile scan i kreiranje zapisnika |
| SK-06 | `skills/SKILL_06_PDF_EMAIL_DISPATCH.md` | PDF generisanje i email slanje |
| SK-07 | `skills/SKILL_07_QA_AUTOMATION.md` | Test strategija i regresiona zaštita |
| SK-08 | `skills/SKILL_08_DEVOPS_RELEASE.md` | CI/CD, deployment i release gate |
| P1 | `phases/PHASE_1_FOUNDATION_AUTH.md` | Sedmica 1-2 |
| P2 | `phases/PHASE_2_SIM_EXCEL.md` | Sedmica 3-4 |
| P3 | `phases/PHASE_3_METERS_RECORDS_PDF.md` | Sedmica 5-6 |
| P3.5 | `phases/PHASE_3_5_ORGANIZATIONAL_HIERARCHY.md` | Sedmica 6.5-7 |
| P4 | `phases/PHASE_4_EMAIL_NOTIFICATIONS_DASHBOARD.md` | Sedmica 7-8 |
| P4.1 | `phases/PHASE_4_1_APP_TOUR.md` | Sedmica 8 |
| P4.2 | `phases/PHASE_4_2_ANALYTICS.md` | Sedmica 8.5-9 |
| P5 | `phases/PHASE_5_POLISH_TEST_DEPLOY.md` | Sedmica 9-10 |

## Pravilo referenciranja
- Svaki task, issue ili PR mora citirati najmanje jedan dokument ID iz ove mape.
- Ako dođe do konflikta između dokumenata, prioritet je: `DOC-02` -> `DOC-03` -> fazni dokument -> ostalo.
- Svaka izmjena mora ažurirati ovaj fajl ako je dodan/obrisan/renamovan bilo koji dokument.

## Minimalni lifecycle promjene
1. Ažurirati odgovarajući fazni dokument.
2. Ažurirati globalni pregled (`DOC-05`) ako se mijenja plan/rok.
3. Ažurirati pravila/instrukcije (`DOC-02`/`DOC-03`) ako se mijenja način rada.
4. Evidentirati promjenu u sekciji "Change log" ispod.

## Change log
- 2026-03-06: Inicijalno generisan kompletan execution playbook iz DOCX plana.
- 2026-03-07: Ažuriran status faza - Faza 1 i Faza 2 označene kao završene nakon implementacije i smoke verifikacije.
- 2026-03-07: U plan i workflow uveden operator self-claim tok (`Zaduži karticu`) nakon skena/ICCID unosa.
- 2026-03-07: Faza 3 backend ispravke: Meters (JwtAuthGuard + RolesGuard, RBAC ADMIN/MODERATOR); Installation Records (ActivityLog na create/update/delete/approve/reject, approve/reject samo iz PENDING, paginacija `items`/`limit`/`totalPages`, PDF storage u `./generated/pdf` i `pdfPath` u bazi). Dokumentacija PHASE_3 i SOURCE_OF_TRUTH ažurirana. Spremno za P3-FE-01.
- 2026-03-07: Faza 3 kompletirana: P3-FE-01 do P3-FE-06 (Meters UI, Records lista+filter, create forma, detail+PDF preview, approve/reject modal, PDF download); backend GET /installation-records/my i dozvola USER za create i meters/available; mobile P3-MB-01, P3-MB-02, P3-MB-05 (create record nakon skena, odabir brojila, Moji zapisnici). P3-MB-03 (GPS) i P3-MB-04 (foto) ostavljeni za naredni inkrement. PHASE_3 i SOURCE_OF_TRUTH ažurirani.
- 2026-03-07: Izmjena logike Faze 3: (1) Tipovi brojila – katalog (MeterTypeDefinition) koji ADMIN/MODERATOR upravljaju na webu; pri kreiranju zapisnika bira se tip brojila i upisuje broj brojila. (2) Backend: modul meter-type-definitions (CRUD), GET /meter-type-definitions/list za dropdown; InstallationRecord s meterTypeDefinitionId + meterNumber, meterId opcionalan. (3) Frontend: stranica Tipovi brojila, create record forma s tipom + brojem; limit za SIM list 100. (4) Mobile: create record s tipom brojila + broj brojila. Dokumentacija u PHASE_3 (Izmjena logike).
- 2026-03-07: Ujednačena logika Brojila i Tipovi brojila: (1) Brojilo (Meter) može pripadati tipu iz kataloga (meterTypeDefinitionId). Stranica Brojila: filter po tipu, kolona "Tip brojila", u formi odabir tipa iz kataloga; dugme "Snimi" u footeru modala (Tipovi brojila i Brojila). (2) Mobile: odabir tipa brojila – robusno učitavanje liste (response.data.data ?? response.data), prazno stanje i poruka greške ako nema tipova. (3) Dokumentacija: PHASE_3 sekcija "Ujednačena logika: Tipovi brojila i Brojila"; migracija 20260307200000_meter_belongs_to_type.
- 2026-03-07: PDF 500 ispravljen: template path (fallback na src/templates), serijalizacija zapisa za Handlebars (datumi, ugniježđeni objekti), nest-cli assets za templates, Puppeteer --no-sandbox. Logika zapisnika: jedan Meter ima više InstallationRecord (uklonjen unique s meterId); zapisnik = pridruživanje SIM brojilu (svaki put nova SIM = novi zapisnik). Migracija 20260307210000_meter_many_records; findAvailable vraća sva brojila. PHASE_3 ažuriran (PDF sekcija, pravilo zapisnik = SIM na brojilo).
- 2026-03-07: Web – detalji brojila: prikaz IP adrese (iz meter.simCard.ipAddress); link na SIM karticu (ICCID vodi na /sim-cards/:id). MeterItem tip proširen sa ipAddress u simCard.
- 2026-03-07: Mobile – zadaci demontaže: novi tab "Demontaža" (demount.tsx), API demount-tasks.api.ts (GET my, PATCH status); lista zadataka sa statusom, brojilom, SIM, IP; akcije Započni/Završi/Otkaži/Vrati na čekanje.
- 2026-03-07: Mobile – ikone: tab bar s Ionicons (home, scan, document-text, construct, person); naslovi na bosanskom (Početna, Skeniranje, Zapisnici, Demontaža, Profil); tabBarActiveTintColor #0f766e.
- 2026-03-07: Nova faza P3.5 – Organizaciona hijerarhija: dokument PHASE_3_5_ORGANIZATIONAL_HIERARCHY.md; Elektroprivreda (admin) → Distribucije (moderator) → Podružnice (operator); scope filtering za buduću analitiku. Planirano prije Faze 4.
- 2026-03-07: Stranica Brojila – logika izmijenjena: dugme "Novi zapisnik" otvara modal s formom za novi zapisnik (umjesto forme za novo brojilo). Novo brojilo se dodaje isključivo kroz zapisnik (postojeće ili novo brojilo + SIM). Zajednička komponenta InstallationRecordCreateForm; InstallationRecordCreatePage je refaktorisan da je koristi.
- 2026-03-07: Brojila – pretraga po serijskom broju na backendu (GET /meters?serialNumber=...); frontend: input + dugme Pretraži (pretraga na klik, ne onChange); reset filtera.
- 2026-03-07: Isporuke – vizuelna dotjeranost: ShipmentsListPage samo lista + pretraga + filteri + dugme "Nova isporuka"; ShipmentCreatePage (/shipments/new) – forma za novu isporuku + Excel import; ruta /shipments/new dodana.
- 2026-03-08: Inkrement GPS + foto (mobile): Backend POST /installation-records/upload-photo (multer memoryStorage, max 5MB, JPEG/PNG); PhotoUploadService; photos u bazi samo putanje. Mobile: expo-location (Dohvati lokaciju – opcionalan, preporučljiv; bez opcije odbijanja u UI), expo-image-picker (Dodaj fotografiju → upload → putanje u create payload). P3-MB-03 i P3-MB-04 kompletirani. Faza 3 može se zaključiti.
- 2026-03-08: Detalji brojila: prikaz GPS širine/dužine; mapa (OpenStreetMap iframe) ako postoje koordinate. Zapisnik: prikaz geo koordinata i fotografija ako postoje; mapa; uklonjena sekcija "Podaci o tipu brojila" iz PDF-a (duplikat – sadržano u podacima o brojilu). Backend: GET /api/files/photo?path=... za serviranje fotografija; PDF template: geo u podacima o brojilu, fotografije kao base64, uklonjena sekcija tip brojila.
- 2026-03-07: Jedna stranica Brojila (dashboard): u sidebaru samo "Brojila" (uklonjena stavka "Tipovi brojila"). Stranica /meters s tabovima "Brojila" (lista + detalj drawer + zapisnici po brojilu + novo/uredi/obriši) i "Tipovi brojila" (pregled, dodaj, izmjena, brisanje). Zapisnik/PDF proširen: svi podaci SIM (ICCID, IP, broj, APN) i svi podaci brojila (tip, proizvođač, model, faznost, max struja, godina, napomena). Backend: findOne uključuje meter.meterTypeDefinition; filter zapisnika po meterId; PHASE_3 sekcija "Jedna stranica Brojila".
- 2026-03-07: Kompletna refaktorizacija: (1) Meter ima instalacijske podatke (installationAddress, installationDate, city, municipality, measuringPoint); meterTypeDefinitionId obavezan. (2) InstallationRecord = samo SIM+Meter link (meterId obavezan); uklonjena installationAddress, installationDate, city, municipality, meterTypeDefinitionId, meterNumber. (3) Novo brojilo se dodaje u meters tabelu (forma s tipom, serijskim brojem, lokacijom, datumom, MM). (4) Zapisnik: odabir brojila + SIM (web i mobile). (5) PDF: svi podaci SIM (uključujući publicIpAddress, assignedTo), brojila (lokacija, datum, MM) i tipa. Migracija 20260307220000_meter_installation_data_refactor.
- 2026-03-08: **Faza 3 zatvorena.** Fotografije na stranici zapisnika: RecordPhotoImage komponenta dohvaća slike preko axios (getPhotoBlob) s auth tokenom; FilesController zaštićen JwtAuthGuard. Svi P3-BE, P3-FE, P3-MB taskovi kompletirani.
- 2026-03-08: **Faza 3.5 – Organizaciona hijerarhija implementirana.** P35-BE-01: Prisma modeli Distribution, Branch; User.distributionId, User.branchId; Meter.branchId, Shipment.distributionId. Migracija 20260308120000_organizational_hierarchy. P35-BE-02: CRUD API za distribucije i podružnice (admin). P35-BE-03: Scope filtering u users, meters, shipments, sim-cards, installation-records, demount-tasks. P35-BE-04: Moderator može dodijeliti demount zadatak samo operatorima iz svoje distribucije. P35-FE-01 do P35-FE-03: Stranice Distribucije i Podružnice; sidebar; User lista prikazuje distribuciju/podružnicu. Seed: default ED Zenica + Zenica podružnica.
- 2026-03-08: **Prijava putem email ili username.** User.username (unique, nullable); auto-generiranje: ime.prezime, ime.prezime1, ime.prezime2... (slugify: lowercase, bez diakritika). LoginDto: emailOrUsername umjesto email; AuthService nalazi korisnika po email ili username. Web i mobile: forma "Email ili korisničko ime". Migracija 20260308130000_add_username; seed backfill za postojeće korisnike.
- 2026-03-08: **Faza 3.5 – vizuelna reorganizacija i scope validacije.** (1) Distribucije i Podružnice uklonjene iz Sidebara, integrirane u Korisnici kao tabovi (samo SYSTEM_ADMIN). (2) Isporuke + SIM kartice spojene u jednu stranicu s tabovima; samo SYSTEM_ADMIN dodaje isporuke i importuje; pri kreiranju isporuke obavezan distributionId. (3) Polje Opština (municipality) vezano za branches: moderator – padajući meni podružnica svoje distribucije; operator – automatski popunjeno iz njegove podružnice (web i mobile). (4) Meter.branchId se popunjava pri kreiranju zapisnika (operator: iz profila; moderator: iz odabira). (5) Validacija skeniranja i zaduživanja: korisnik ne može skenirati/zadužiti SIM karticu koja ne pripada njegovoj distribuciji (backend + prikaz poruke na mobilnoj). (6) HttpExceptionFilter: poruka greške uvijek kao string (normalizacija NestJS exception response). PHASE_3_5 kompletirana; spremno za Fazu 4.
- 2026-03-08: **RecipientGroupUser – korisnici aplikacije u grupe za odobrenje.** (1) Prisma model RecipientGroupUser (recipientGroupId, userId) – grupa može imati i Recipients (email) i User-e iz aplikacije. (2) RecipientsService: getEmailsAndUserIdsForGroup (Recipients + RecipientGroupUser), addUserToGroup, removeUserFromGroup, getGroupUsers, isUserInApprovalGroupForBranch. (3) Submit for approval: email šalje na sve (Recipients + RecipientGroupUser); in-app notifikacije za sve RecipientGroupUser. (4) Backend endpointi: POST /recipients/groups/:id/users, DELETE /recipients/groups/:id/users/:userId, GET /recipients/groups/:id/users (AddUserToGroupDto). (5) findAllGroups vraća groupUsers uključeno. Migracija 20260308160000_add_recipient_group_users.
- 2026-03-08: **RBAC – USER može odobravati zapisnike ako je u grupi odobravatelja.** approve, reject, activateInSep: role USER dozvoljen; servis provjerava isUserInApprovalGroupForBranch(userId, branchId) – ako USER nije u RecipientGroupUser za odgovarajuću grupu, ForbiddenException. SYSTEM_ADMIN i MODERATOR bez provjere.
- 2026-03-08: **Recipients stranica – dodavanje postojećih korisnika u grupe.** Za grupe tipa APPROVAL: Select za odabir korisnika iz aplikacije, tabela groupUsers s uklanjanjem; addUserToGroupMutation, removeUserFromGroupMutation; usersApi.list za dropdown.
- 2026-03-08: **Mobile – Pošalji na odobrenje.** Na ekranu Moji zapisnici: dugme "Pošalji na odobrenje" za DRAFT zapisnike; installationRecordsApi.submitForApproval(id); nakon uspjeha refresh liste.
- 2026-03-08: **Obrisan mobile/src/api/records.api.ts** – nije se koristio.
- 2026-03-08: **Approval email template izmjena.** U emailu za odobrenje zapisnika polje `ICCID` zamijenjeno sa `EPBIH IP` (`ipAddress` iz SIM kartice).
- 2026-03-08: **RBAC fix za approver USER tok.** (1) `/installation-records` route i API dozvoljeni za USER uz scope enforcement. (2) Backend guard: USER bez `branchId` dobija Forbidden za listu zapisnika. (3) Detail UI: USER vidi akcije `Odobri/Odbij` (PENDING) i `Aktiviraj u SEP` (WAITING_SEP_ACTIVATION), a backend i dalje autoritativno provjerava membership u approval grupi. (4) Dodan dedicated endpoint `GET /recipients/users-for-picker` za dropdown korisnika u approval grupama.
- 2026-03-08: **RBAC matrica i scenariji verifikacije dokumentovani.** U `PHASE_4_EMAIL_NOTIFICATIONS_DASHBOARD.md` dodane matrice rola/podrola i test scenariji `RBAC-IR-01` do `RBAC-IR-07`.
- 2026-03-09: **Operator post-submit tok i self-approval zabrana.** (1) USER koji je kreator zapisnika više ne može `approve/reject/activate-sep` nad vlastitim zapisnikom (Forbidden), čak i ako je član approval grupe. (2) Mobile: uveden ekran `record-details` i ručno slanje na odobrenje premješteno na detalj zapisa sa porukom "Ukoliko zapisnik nije poslan automatski, pošaljite ga ručno". (3) Lista mobilnih zapisnika sada vodi na detalj umjesto inline slanja.
- 2026-03-09: **RBAC matrica proširena.** U P4 dokumentu dodat scenario `RBAC-IR-08` (član approval grupe ne može procesirati vlastiti zapisnik) i zabilježena backlog odluka za buduće granularne checkbox permisije po statusima.
- 2026-03-09: **RBAC pravilo korigovano po zahtjevu.** Ako je USER član approval grupe za branch, može `approve/reject/activate-sep` (uključujući i zapisnik koji je sam kreirao). Ako nije član approval grupe, nema te akcije (`403`).
- 2026-03-09: **Specifikacija naredne faze (bez implementacije).** U `PHASE_4_EMAIL_NOTIFICATIONS_DASHBOARD.md` definisan planirani inkrement `P4.1 - Approval Permissions Matrix` (checkbox permisije po korisniku u grupi i po statusnim koracima), sa backend/frontend taskovima, acceptance kriterijima i QA matricom.
- 2026-03-09: **Recipients moderacija po organizacionom scope-u.** SYSTEM_ADMIN vidi i moderira sve grupe. MODERATOR može moderirati samo grupe svoje distribucije (update/delete, članovi grupe, recipients, branch mapping). Dodane backend zabrane da moderator ne može uređivati tuđe grupe, korisnike ili podružnice.
- 2026-03-09: **Approval enforcement dodatno pooštren.** Provjera članstva za USER odobravatelja vezana je striktno za `BranchApprovalGroup` + `RecipientGroup.type=APPROVAL` + `RecipientGroupUser` članstvo. Time USER koji nije član odgovarajuće approval grupe ne može `approve/reject/activate-sep`.
- 2026-03-09: **Login UX fallback za USER.** Nakon prijave USER više ne ide na potencijalno nevažeću/ranije zabranjenu putanju; ako prethodna putanja nije dozvoljena, redirect je na `/dashboard` (sprječava 404 scenario odmah nakon login-a).
- 2026-03-09: **UI permissions po zapisu za USER operatore.** Dodan endpoint `GET /installation-records/:id/permissions`; web detalj zapisnika koristi backend permissions za prikaz akcija `Odobri/Odbij` i `Aktiviraj u SEP`, pa operator koji nije u approval grupi više ne vidi te akcije.
- 2026-03-09: **Lista zapisnika za USER diferencirana po membership-u.** `GET /installation-records` za USER: ako je korisnik approval operator (član APPROVAL grupe mapirane na branch/distribuciju) vidi zapisnike distribucije; ako nije, vidi samo svoje zapisnike (`installedById = currentUser`).
- 2026-03-09: **Fix moderator dodavanja korisnika u grupu.** Validacija distribucije pri `addUserToGroup` proširena da koristi `user.distributionId` ili fallback `user.branch.distributionId`; time moderator može dodati operatore svoje distribucije koji imaju distribuciju definiranu preko podružnice.
- 2026-03-10: Dodana Faza 4.1 – App Tour (`PHASE_4_1_APP_TOUR.md`) i ažuriran `05_PHASES_OVERVIEW.md` da uključi novu fazu i milestone.
- 2026-03-10: **Faza 4 – Email, Notifikacije & Dashboard implementirana.** Backend: email servis + recipients grupe, in-app notifikacije (REST + WebSocket) sa retry/polling fallbackom, settings v1 (Admin Postavke) sa audit logom, timeline endpoint za zapisnike, mobile push tokene i servis. Web: notification bell + dropdown, Settings stranica sa tipiziranim editorom, detalj zapisnika sa timeline-om. Mobile: notifikacije ekran + osnovni dashboard.
- 2026-03-10: **Faza 4.2 – Analitike implementirana.** Dodan `AnalyticsModule` (overview KPI, SIM/records/users analitika po vremenskom rasponu, SimEvent historija, CSV export), web stranica `/analytics` sa KPI karticama, grafikonima i breakdown-om po distribucijama/podružnicama/operatorima, te minimalna “Moja analitika” na mobilnoj početnoj stranici.
- 2026-03-10: **Faza 4.1 – App Tour implementirana i zaključena.** Backend: per-user tour state (`tour.web.*`, `tour.mobile.*`) u settings API-ju (`GET/PATCH /settings/me`). Web: globalni role-aware tour za SYSTEM_ADMIN/MODERATOR (Dashboard, Korisnici, Isporuke+SIM, Primaoci, Brojila, Zapisnici, Notifikacije, Dnevnik aktivnosti, Postavke) + detaljni page tour-ovi za Isporuke, Brojila, Zapisnike, Korisnike i Primaoce. Mobile: mini “first-run tips” na Početnoj sa upisom `tour.mobile.completedAt`. Acceptance TOUR-01..TOUR-04 pokriveni i verifikovani.
- 2026-03-10: **Faza 5 – Polish, Test & Deploy implementirana.** Backend: unificirani error envelope (`message`, `errorCode`, `details`), pooštren rate limiting za auth/scan/import/analytics, hardened DTO validacija, Jest + postojeći unit testovi za kritične servise i novi e2e smoke test za WF-01/02/03, k6 perf skripta. Mobile: offline queue za kreiranje zapisnika (pending akcije u SecureStore + retry na `Moji zapisnici`), konzistentna error poruka i loading stanja. DevOps: `backend/Dockerfile`, root `docker-compose.yml` (backend + MySQL + upload mount `/mnt/shared-app-files/sim-cards-codex`), GitHub Actions CI workflow za lint/test/build. Dokumentacija: production runbook (`docs/production-runbook.md`) i osvježeni acceptance kriteriji za fazu 5.
