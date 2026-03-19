# 02_STRICT_INSTRUCTIONS

Povratna referenca: [SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## 1. Obavezni operativni režim
1. Prvo validirati zahtjev prema `DOC-05` i aktivnoj fazi.
2. Ne implementirati task koji nema jasan task ID iz faznog dokumenta.
3. Svaku promjenu raditi kroz mali, verifikabilan inkrement.
4. Ne preskakati testove za promijenjeni dio sistema.
5. Ne zatvarati task bez dokumentovanog acceptance dokaza.

## 2. Obavezni ulaz prije implementacije
Prije pisanja koda mora postojati:
- task ID i faza (`P1-*`, `P2-*`, ...)
- cilj i scope taska
- dependency lista
- očekivani output (API endpoint, ekran, servis, test)

## 3. Striktni coding protokol
1. Definisati DTO/Type prvo, pa servis/handler, pa UI integraciju.
2. Zabranjeno "silent fail" ponašanje; svaka greška mora imati eksplicitnu poruku.
3. Zabranjeno direktno oslanjanje na hardkodirane vrijednosti za role/status.
4. Svaki endpoint mora imati:
   - guard (auth + role gdje treba)
   - validaciju inputa
   - konzistentan response shape
5. Svaka mutacija `SimCard`, `InstallationRecord`, `Shipment` mora emitovati audit log.

## 4. Striktni database protokol
1. Schema promjena isključivo kroz Prisma migracije.
2. Migracija mora imati rollback strategiju.
3. Zabranjeno uvođenje nullable polja bez jasnog razloga.
4. Unikati i indeksi moraju pratiti realne query pattern-e.
5. Status transition pravila se provode u servis sloju, ne u kontroleru.

## 5. Striktni API protokol
1. Endpoint nazivi i semantika ostaju usklađeni sa planom.
2. Zabranjeno breaking ponašanje bez verzionog plana.
3. HTTP status kodovi moraju biti predvidivi i standardni.
4. Paginated endpoint-i vraćaju meta blok (`page`, `limit`, `total`).
5. Swagger mora biti ažuran za svaki novi endpoint i DTO.

## 6. Striktni frontend/mobile protokol
1. API pozive centralizovati u `api/*` layer.
2. Zabranjeno direktno fetch-ovanje iz komponenti bez hook/service sloja.
3. UI stanja moraju imati: loading, empty, error, success.
4. Route guard mora štititi i auth i role pristup.
5. Forme moraju imati client-side validaciju usklađenu sa backend DTO pravilima.

## 7. Striktni security protokol
1. Bcrypt salt rounds = 12 minimum.
2. JWT access i refresh token lifecycle mora biti odvojen.
3. Throttling aktivan na auth i import endpoint-ima.
4. Upload validacija: tip + veličina + sanitizovano ime fajla.
5. Nikad ne logovati plaintext lozinku, token ili SMTP tajne.

## 8. Striktni QA protokol
1. Za svaki task kreirati barem jedan test dokaz:
   - unit, integration ili e2e.
2. Kritični flow-ovi (import, scan->record, approve->pdf->send) moraju imati e2e pokrivenost.
3. Bug fix nije zatvoren bez regresionog testa.

## 9. Definition of Done (global)
Task je gotov tek kad su ispunjeni svi uslovi:
- implementacija završena u scope-u task ID-a
- testovi prošli
- dokumentacija ažurirana (ako mijenja ponašanje)
- security i RBAC provjera prošla
- acceptance kriteriji iz faznog dokumenta potvrđeni

## 10. Zabranjene prečice
- Bez preskakanja validacije inputa.
- Bez ručnih SQL upita ako postoji Prisma putanja.
- Bez spajanja više nepovezanih taskova u isti delivery blok.
- Bez deployment-a ako P0/P1 bug postoji.
