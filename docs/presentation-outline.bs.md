# SIM Tracker — prezentacija (outline)

Namjena: ovaj dokument je **outline po slajdovima** za prezentaciju potencijalnom kupcu. Tehničke detalje (implementacija, API, dependency katalog) vidi u ostalim dokumentima u `docs/`.

Izvor istine: `execution-playbook/SOURCE_OF_TRUTH.md` (faze P1–P5, workflow-i, acceptance).

---

## 1. Naslov

- **SIM Tracker**: upravljanje SIM karticama, brojilima i zapisnicima ugradnje (web + mobile)
- Cilj: brži teren → brža administracija → mjerljiva kontrola i audit trail

## 2. Problem koji rješavamo (pain points)

- Ručni unos ICCID/serijskih brojeva → greške i spor rad na terenu
- Nepouzdan tok odobravanja → kašnjenja (email/PDF), slaba vidljivost statusa
- Fragmentirani podaci (ko je ugradio, gdje, kada) bez centralnog audita
- Potreba za real-time obavijestima + fallback kada WS/push ne radi

## 3. Rješenje (što isporučujemo)

- **Mobile (Expo)**: skeniranje SIM-a, “claim”, kreiranje zapisnika na terenu, GPS i foto, offline queue
- **Web (React/AntD)**: operativni dashboard, administracija (korisnici, isporuke, recipients), odobravanje i slanje zapisnika, analitika
- **Backend (NestJS/Prisma/MySQL)**: RBAC + organizacioni scope, import, PDF+email, notifikacije (REST+WS), analytics + CSV export

## 4. Ko koristi sistem (role + organizacioni scope)

- **SYSTEM_ADMIN**: globalni admin, konfiguracija, users/org, kompletna analitika
- **MODERATOR**: distribucija (operativno), odobravanje i slanje, upravljanje grupama u svom scope-u
- **USER (operator)**: teren (scan → zapisnik), praćenje statusa, notifikacije
- Organizacijski model: **Distribucija → Podružnica → Operator** (scope enforcement u backendu)

## 5. Kratki pregled arhitekture

- Jedan centralni backend (`/api`) + dvije klijentske aplikacije (web + mobile)
- Swagger dokumentacija: `/api/docs`
- Notifikacije: WebSocket namespace `/notifications` + REST fallback polling

## 6. Demo scenariji (ključni workflow-i)

### 6.1 WF-01 — Excel Import SIM kartica

- Kreiranje isporuke (shipment)
- Upload `.xlsx/.xls/.csv` → preview → mapiranje kolona → validacija → apply
- Rezultat: SIM kartice u statusu `AVAILABLE` + audit zapis

### 6.2 WF-02 — Scan → Create Record (mobile)

- Skeniranje ICCID (kamera/barcode)
- Lookup (`scan`) + akcija `Zaduži karticu` (`claim`)
- Kreiranje zapisnika (meter + lokacija + opcionalne fotografije)
- Offline: ako nema mreže, zapisnik ide u queue i sinhronizuje se kasnije

### 6.3 WF-03 — Approve → PDF → Email

- Moderator/Admin odobrava zapisnik
- Aktivacija u SEP (statusni korak) i slanje PDF-a na grupu ili ručne email adrese
- Sistem garantuje: nema slanja za neodobren status; failure ne ostavlja lažno `SENT`

## 7. Statusi i kontrola procesa (lifecycle)

- SIM: `AVAILABLE → ASSIGNED → INSTALLED` (+ ostali statusi po potrebi)
- Zapisnik (high-level): `DRAFT/PENDING → WAITING_SEP_ACTIVATION → ACTIVATED_IN_SEP → SENT` (+ `REJECTED`)
- Svaka kritična mutacija ostavlja trag u **Activity Log** (audit)

## 8. Real-time notifikacije + pouzdanost

- Web: WS event + “soft refresh” (refetch) za konzistentno stanje
- Fallback: periodični polling kada WS nije dostupan
- Mobile: in-app notifikacije ekran (REST), plus push kao dodatni kanal (deep link na relevantni ekran)

## 9. Dashboard i analitika (vrijednost za menadžment)

- Dashboard: KPI + recent activity
- Analitika (role-aware): SIM, zapisnici, korisnici; vremenski rasponi; drill-down po distribuciji/podružnici/operatoru
- CSV export za izvještaje

## 10. Sigurnost i usklađenost

- JWT access + refresh token flow (web + mobile)
- RBAC + scope filtering u backendu
- Rate limiting na javnim/operativno osjetljivim endpointima (auth/scan/import/analytics)
- Upload validacija (tip + veličina)

## 11. Implementacija i deploy (za IT)

- Docker Compose: MySQL + backend (uploads bind mount)
- Migracije: Prisma migrate
- Smoke test: definisan u `docs/production-runbook.md`
- Podizanje na Linux i Windows server: opisano u `docs/deploy-guide.bs.md`

## 12. Šta kupac dobija (finalni proizvod)

- Jedinstven sistem (web + mobile) za teren + administraciju
- Mjerljiv proces sa auditom i analitikom
- Brži onboarding kroz App Tour (web) + mini tips (mobile)

## 13. Roadmap (opciono, za prodaju)

- i18n (BS/EN) + Dark/Light mode
- Granularne permisije po approval grupi (planirano u playbooku kao specifikacija)
- Naprednije monitoring/alerting integracije

