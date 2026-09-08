# SIM Tracker Mobile — Dark-only tema

Implementirana je **jedna, fiksna dark tema**. Nema light varijante, system
toggle-a niti runtime prebacivanja. Brand identitet ostaje plav, ali je akcijska
plava osvijetljena radi kontrasta na grafitnim površinama.

## Paleta

| Uloga | Vrijednost |
|---|---|
| App background | `#0B0F17` |
| Primarna površina | `#111827` |
| Sekundarna površina | `#172033` |
| Uvučena površina | `#070B12` |
| Border | `#263244` |
| Glavni tekst | `#F3F6FB` |
| Sekundarni tekst | `#AEB9C8` |
| Brand akcija | `#4D82E6` |
| Success | `#4ADE80` |
| Warning | `#FBBF24` |
| Danger | `#FB7185` |

Semantičke pozadine nisu pastelne light površine; koriste duboke, tonalne
pozadine (`successSoft`, `warningSoft`, `dangerSoft`, `infoSoft`).

## Kompletni zamjenski/globalni fajlovi

```text
mobile/src/theme/colors.ts                  legacy + globalna dark paleta
mobile/src/theme/tokens.ts                  kompletni dark design tokeni
mobile/app.json                             native dark style, splash i system bars
mobile/app/_layout.tsx                      dark hydration ekran
mobile/app/(auth)/_layout.tsx               dark auth stack i tranzicije
mobile/app/(app)/_layout.tsx                dark stack, update gate i blocking overlay
mobile/src/components/common/LoadingScreen.tsx
mobile/src/components/common/OfflineBanner.tsx
mobile/src/components/common/OfflineRequiredNotice.tsx
mobile/src/components/ui/ActionButton.tsx
mobile/src/components/ui/SegmentedFilter.tsx
mobile/app/(app)/(tabs)/home.tsx             light status bar + brand avatar
mobile/app/(app)/(tabs)/_layout.tsx          dark tab bar + light status bar
```

Svi ostali redizajnirani ekrani već koriste `palette.background`,
`palette.surface`, `palette.textPrimary`, semantičke tokene i zato automatski
prelaze na dark nakon zamjene `tokens.ts`.

## Obavezna Expo zavisnost

Expo zahtijeva `expo-system-ui` da `userInterfaceStyle: "dark"` zaista zaključa
native Android temu (system dijalozi, root view i native kontrole).

Pokrenuti iz `mobile/` foldera:

```bash
npx expo install expo-system-ui
```

`app.json` već sadrži `"expo-system-ui"` u plugins listi, zato se ova naredba
mora izvršiti **prije** `expo start` nakon kopiranja paketa.

Ne koristiti obični `npm install expo-system-ui@latest`; `expo install` bira
verziju kompatibilnu sa vašim Expo SDK 55.

Nakon instalacije provjeriti konfiguraciju:

```bash
npx expo config --type introspect
```

Ne bi smjela ostati poruka:

```text
android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.
```

## Primjena

```bash
cp -r mobile mobile.before-dark-only
# overlay ovog mobile/ paketa preko produkcijskog mobile/

cd mobile
npx expo install expo-system-ui
npx tsc --noEmit
npx expo start -c
```

Promjena `app.json` dark/native postavki zahtijeva **novi development ili EAS
build** da bi bila vidljiva u native sistemskim komponentama. Expo Go može
prikazati React ekrane ispravno, ali nije konačna verifikacija native teme.

## Test matrica

1. Cold start/hydration nema bijelog bljeska.
2. Login: inputi, server status, greške i disabled dugme čitljivi.
3. Home: tab bar, header, paneli i semantic statusi imaju jasne granice.
4. Ugradnja/Demontaža: segmented filter i workflow modal ostaju tamni.
5. Zapisnici/Detalji: monospace podaci i sekundarni tekst čitljivi.
6. Scan: kamera ostaje crna/full-bleed; manual bottom sheet je taman.
7. Offline banner: amber tekst na tamnoj amber površini.
8. Update gate: mandatory update i browser ekran nemaju bijelu površinu.
9. Global blocking overlay: tamni scrim + odvojen panel.
10. Native Alert, date/keyboard/system UI prate dark temu u development/EAS buildu.

## Rollback

```bash
rm -rf mobile
mv mobile.before-dark-only mobile
```