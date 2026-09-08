# SIM Tracker Mobile — Redizajn Faza 3 i 4

Ovaj folder je **produkcijski overlay paket**, ne samostalna demo aplikacija.
Kopirati `mobile/` preko postojećeg produkcijskog `mobile/` foldera. Postojeći
API, store, hooks, assets i offline infrastruktura ostaju netaknuti.

## Šta je implementirano

### Faza 3 — operativni workflowi

- `install.tsx`: lista/filter zadataka, offline pending indikator, scan/claim SIM,
  dinamička polja brojila i vođeni završetak ugradnje.
- `demount.tsx`: lista/filter zadataka, izbor rezolucije, ishod stare SIM,
  kategorija demontaže, skeniranje zamjenske SIM i vođeni završetak.
- `create-record.tsx`: zapisnik novog priključka, GPS, fotografije, dinamička
  polja i offline queue fallback.
- `create-record-replacement.tsx`: dva jasna koraka (demontirano + novo brojilo),
  GPS, fotografije, dinamička polja i offline queue fallback.

### Faza 4 — liste i detalji

- `records.tsx`: pretraga po zapisniku/brojilu/ICCID-u, status filteri, statusi.
- `record-details.tsx`: SIM, staro/novo brojilo, dinamička polja, GPS/Maps,
  retry emaila i SEP activation permissions.
- `scan-result.tsx`: dominantni ICCID/IP, status i kontekstualna sljedeća akcija.
- `notifications.tsx`: unread stanje, read/all-read mutations i deep links.
- `offline-inventory.tsx`: pretraga, reconcile, scan add, long-press remove.
- `outbox.tsx`: pending/failed sažetak, ručni sync i clear potvrda.
- `profile.tsx`: korisnik, organizacija, offline prečice, verzija i sigurna odjava.

## Novi zajednički fajlovi

```text
mobile/src/components/ui/Field.tsx
mobile/src/components/ui/ChoiceRow.tsx
mobile/src/components/ui/ScreenTitleBar.tsx
mobile/src/features/tasks/TaskCard.tsx
mobile/src/features/tasks/TaskFilterBar.tsx
mobile/src/features/tasks/WorkflowModal.tsx
mobile/src/features/tasks/DynamicMeterFields.tsx
mobile/src/features/records/MeterTypePicker.tsx
mobile/src/features/records/LocationFields.tsx
mobile/src/features/records/PhotoCapture.tsx
```

## Zamjenski produkcijski fajlovi

```text
mobile/app/(app)/(tabs)/install.tsx
mobile/app/(app)/(tabs)/demount.tsx
mobile/app/(app)/(tabs)/records.tsx
mobile/app/(app)/(tabs)/profile.tsx
mobile/app/(app)/create-record.tsx
mobile/app/(app)/create-record-replacement.tsx
mobile/app/(app)/scan-result.tsx
mobile/app/(app)/record-details.tsx
mobile/app/(app)/notifications.tsx
mobile/app/(app)/offline-inventory.tsx
mobile/app/(app)/outbox.tsx
```

## Očuvani backend/offline ugovori

- `installTasksApi.getMy/updateStatus/complete`
- `demountTasksApi.getMy/updateStatus/complete`
- `simCardsApi.scanByIccidWithOffline/claimById`
- `installationRecordsApi.create/retrySend/markSepActivated`
- `queueInstallationRecord`, `listOutbox`, `syncOutbox`, `clearOutbox`
- `reconcileOfflineSimInventory`
- `meterTypeDefinitionsApi.list/listFields/get`
- `notificationsApi.list/markAsRead/markAllAsRead`

## Primjena

```bash
# iz korijena repozitorija
cp -r mobile mobile.before-redesign-phase-3-4

# kopirati/overlay sadržaj ovog mobile/ foldera preko produkcijskog mobile/

cd mobile
npx tsc --noEmit
npx expo start -c
```

`expo start -c` je važan jer Metro inače može servirati prethodnu verziju
route fajlova.

## Obavezna test matrica prije EAS builda

1. **Ugradnja online**: PENDING → Započni → skeniraj AVAILABLE SIM → potvrdi.
2. **Ugradnja offline**: promjena statusa i complete se pojave u Outbox ekranu.
3. **Demontaža**: testirati sva 3 ishoda: FULL_DEMOUNT, REPLACE_SIM,
   REMOVE_SIM_ONLY; za REPLACE_SIM skenirati novu SIM.
4. **Zapisnik novog priključka**: obavezna dinamička polja, GPS, fotografija,
   online i offline kreiranje.
5. **Zamjena brojila**: oba koraka, integrisana SIM checkbox, staro i novo
   dinamičko polje, offline kreiranje.
6. **Zapisnici**: search + svi status filteri + detalji + Google Maps.
7. **SEND_FAILED**: retry email; **SENT**: SEP activation samo uz permission.
8. **Notifikacije**: pojedinačno read, read-all i deep link.
9. **Offline inventar**: add skenom, search, long-press remove, clear all.
10. **Outbox**: sync now, failed poruka, clear confirmation.

## Rollback

```bash
rm -rf mobile
mv mobile.before-redesign-phase-3-4 mobile
```

## Važna napomena o provjeri

Ovaj sandbox može potvrditi svoj Vite build, ali ne pokreće `mobile/package.json`
ni Android native build. Zato je `cd mobile && npx tsc --noEmit` obavezan na
produkcijskom checkoutu prije `expo start` i EAS builda. Ako TypeScript prijavi
neusklađenost sa tačnim lokalnim Expo Router typed-route generisanjem, poslati
kompletan izlaz; izmjena se radi ciljano, bez vraćanja dizajna.