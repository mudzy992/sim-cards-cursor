# PHASE_4_2_ANALYTICS

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)  
Period: Sedmica 8.5–9 (inkrement nakon faze 4.1, prije završnog polisha)

## Cilj faze

- Uvesti **napredne, role-aware analitike** za SYSTEM_ADMIN, MODERATOR i USER (operator) uz **grafikone** i **CSV export**.
- Omogućiti **precizne KPI-je za SIM kartice i zapisnike** (ugradnja, odobrenje, aktivacija), uključujući brzinu aktivacije kroz historiju događaja.

## Obavezni deliverable-i

- Backend analytics modul sa scope-aware endpointima (overview, SIM, zapisnici, korisnici).
- SimEvent/SimHistory model i emitovanje događaja na ključnim tačkama lifecycle-a.
- Web Analitika stranica sa tabovima, grafikonima i CSV exportom.
- Mobile “Moja analitika” za operatere (minimalni set metrika).

## Role-aware analitika

- **SYSTEM_ADMIN**:
  - Globalni pregled svih distribucija i podružnica.
  - Drill-down po distribuciji, podružnici, korisniku i SIM kartici.
  - Time range: danas, 7 dana, 30 dana, mjesec, godina, custom raspon.
- **MODERATOR**:
  - Iste metrike, ali strogo ograničene na vlastitu distribuciju i pripadajuće podružnice/korisnike.
- **USER / Operator**:
  - Samo lične metrike (moji zapisnici, moj throughput, moja vremena odobrenja/aktivacije).

## Data model: SimEvent / SimHistory

- Novi model u bazi: `SimEvent` (ili `SimCardEvent`), s poljima:
  - `id`, `simCardId`, `type`, `recordId?`, `userId?`, `distributionId?`, `branchId?`, `metadata JSON`, `createdAt`.
- Događaji se generišu na:
  - SIM lifecycle: ASSIGNED, INSTALLED, DEMOUNTED, RETURNED, DEFECTIVE.
  - Zapisnik lifecycle: SUBMITTED_FOR_APPROVAL, APPROVED, REJECTED, ACTIVATED_IN_SEP, SENT.
- KPI “brzina aktivacije” računa se iz lanca događaja (npr. INSTALLED → APPROVED → ACTIVATED_IN_SEP → SENT).

## Backend API: Analytics modul

- Novi modul (ili proširenje dashboard-a) sa endpointima:
  - `GET /analytics/overview?range=...&from=...&to=...&distributionId?&branchId?&userId?`
  - `GET /analytics/sim-cards?range=...`
  - `GET /analytics/installation-records?range=...`
  - `GET /analytics/users?range=...`
  - `GET /analytics/exports/<report>.csv?...`
- Svi endpointi:
  - poštuju organizacioni scope preko `scopeWhere(...)`,
  - imaju validaciju parametara (`range`, `from/to`, filteri),
  - vraćaju agregirane podatke optimizovanim upitima (groupBy, indeksirani where uslovi).

## Frontend (Web): Analitika UI

- Nova stranica “Analitika” sa tabovima:
  - **Overview**: KPI kartice (broj aktivnih SIM, broj zapisnika po statusima, prosječno vrijeme aktivacije, sl.).
  - **SIM analitika**: trendovi po statusima, broj aktivnih/instaliranih, lead time.
  - **Zapisnici analitika**: funnel po statusima (DRAFT → PENDING → WAITING_SEP_ACTIVATION → ACTIVATED_IN_SEP → SENT), throughput po danima.
  - **Korisnici analitika**: aktivnost po korisniku (broj zapisnika, vrijeme odgovora, sl.).
- Kontrole:
  - selector vremenskog raspona (TODAY / 7_DAYS / 30_DAYS / MONTH / YEAR / CUSTOM),
  - za admina/moderatora: filteri po distribuciji/podružnici/korisniku.
- Grafikoni:
  - linijski grafikoni (trend po danima),
  - bar/stacked bar grafikoni (statusi),
  - jednostavan funnel prikaz (npr. bar graf).
- Export:
  - dugme “Preuzmi CSV” po tabu, koje poziva odgovarajući `/analytics/exports/*.csv` endpoint.

## Mobile: “Moja analitika”

- U okviru postojećeg Home ili posebnog ekrana:
  - broj mojih zapisnika po statusu u zadnjih 7/30 dana,
  - osnovni trend (npr. lista po danima sa brojem zapisnika),
  - opcionalno CSV export ili share link.

## Acceptance kriteriji

- SYSTEM_ADMIN vidi globalne KPI-je i može filtrirati po distribuciji/podružnici/korisniku.
- MODERATOR vidi samo podatke svoje distribucije i njenih podružnica/korisnika.
- USER vidi samo vlastite podatke; ne može vidjeti tuđe metrike.
- Time range radi dosljedno za sve endpoint-e (uključujući custom raspon).
- KPI za SIM aktivaciju računa se iz SimEvent historije i uključuje minimalno: broj, prosjek, median, p90.
- CSV export dostupan je za glavne izveštaje i poštuje scope i filtere.
- Grafikoni se renderuju bez vidljivog kašnjenja za tipične dataset-e (npr. do 30 dana historije).

