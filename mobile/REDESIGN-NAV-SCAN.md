# SIM Tracker Mobile — Redizajn navigacije, filtera i skeniranja

Overlay paket. Kopirati preko postojećeg `mobile/` foldera.

---

## 1. Filter tabovi (Ugradnja · Demontaža · Zapisnici)

**Problem:** horizontalno skrolabilni chipovi bili su razvučeni, neujednačene
širine i vizuelno teški.

**Rješenje:** nova komponenta `SegmentedFilter` — kompaktna segmentirana kontrola
(iOS-style) sa jednakim širinama segmenata, visina trake 38pt umjesto ~52pt.

### Redukcija broja filtera

| Ekran | Prije | Sada |
|---|---|---|
| Ugradnja / Demontaža | 5 (Aktivni, Čekaju, U toku, Završeni, Svi) | **3** — Aktivni · Završeni · Svi |
| Zapisnici | 5 (Svi, Nacrti, Poslano, Greška, Završeno) | **4** — Svi · Poslano · Greška · Završeno |

Obrazloženje: razlika `PENDING` / `IN_PROGRESS` je već jasno vidljiva u status
badge-u na svakoj kartici, pa poseban filter za svaki nije potreban. Nacrti su
rijetki i ostaju dostupni pod „Svi".

Na „Aktivni" segmentu prikazuje se **brojač** aktivnih zadataka.

**Novi/izmijenjeni fajlovi**
```text
mobile/src/components/ui/SegmentedFilter.tsx      (novo)
mobile/src/features/tasks/TaskFilterBar.tsx       (prepravljeno)
mobile/app/(app)/(tabs)/records.tsx               (lokalni chipovi -> SegmentedFilter)
mobile/app/(app)/(tabs)/install.tsx               (prosljeđuje brojač)
mobile/app/(app)/(tabs)/demount.tsx               (prosljeđuje brojač)
```

---

## 2. Donja tab navigacija

**Problem:** 6 tabova — pretrpano, labele se lome, primarna akcija (skeniranje)
nije istaknuta.

**Rješenje:** 5 tabova, novi redoslijed prema terenskom toku, skeniranje u centru
kao vizuelno dominantna akcija.

```
Prije:  Početna · Ugradnja · Skeniraj · Zapisnici · Demontaža · Profil
Sada:   Početna · Ugradnja · [ SKEN ] · Demontaža · Zapisnici
```

### Šta je isključeno
- **Profil** je uklonjen iz trake (`href: null`). Ruta i dalje postoji, pa svi
  postojeći `router.push('/(app)/(tabs)/profile')` pozivi rade nepromijenjeno.
  Pristup je sada preko **avatara u headeru Početne** (desno, uz zvono).

### Šta je promijenjeno
- Skeniranje: brand krug bez labele, `accessibilityLabel` zadržan.
- Ugradnja i Demontaža sada simetrično okružuju sken — obje ga koriste.
- Labele smanjene na 10.5pt, visina trake usklađena (iOS 86 / Android 66).
- **Badge logika je netaknuta** (PENDING brojači, refresh 45s).

**Izmijenjeni fajlovi**
```text
mobile/app/(app)/(tabs)/_layout.tsx
mobile/app/(app)/(tabs)/home.tsx     (avatar dugme za profil u headeru)
```

---

## 3. Ekran skeniranja

**Problem:** kamera je dijelila ekran sa stalnim panelom za ručni unos i time
gubila dominaciju; nije bilo svjetla ni indikacije da skeniranje traje.

**Rješenje:** camera-first ekran.

| Element | Prije | Sada |
|---|---|---|
| Kamera | ~55% ekrana | **full-bleed**, cijeli ekran |
| Ručni unos | stalni panel ispod | **bottom sheet** na dugme |
| Svjetlo | nema | **torch toggle** u headeru |
| Indikacija | statični okvir | **animirana linija** + „Očitano" nakon skena |
| Kontekst | nije prikazan | naslov prikazuje svrhu (ugradnja / demontaža / inventar) |
| Historija | 3 čipa preko kamere | 3 kompaktna čipa u donjoj traci |

Ostalo nepromijenjeno: dozvole, `onBarcodeScanned`, beep + vibracija, rute
`afterScan` (install / demount / inventory), filtriranje unosa na cifre.

Torch se automatski gasi pri napuštanju ekrana i nakon uspješnog skena.

**Izmijenjeni fajl**
```text
mobile/app/(app)/(tabs)/scan.tsx
```

---

## Primjena

```bash
cp -r mobile mobile.before-nav-scan
# kopirati sadržaj ovog mobile/ foldera preko produkcijskog

cd mobile
npx tsc --noEmit
npx expo start -c
```

## Test lista

1. **Tab traka:** 5 tabova, sken u centru istaknut, profil se NE vidi u traci.
2. **Profil:** otvara se tapom na avatar gore desno na Početnoj; odjava radi.
3. **Badge:** brojevi na Ugradnji i Demontaži se i dalje pojavljuju i osvježavaju.
4. **Filteri:** Aktivni / Završeni / Svi na oba task ekrana; brojač na „Aktivni".
5. **Zapisnici:** 4 segmenta + pretraga + „x" za brisanje pretrage.
6. **Sken:** kamera preko cijelog ekrana, animirana linija, torch pali/gasi.
7. **Sken → ručni unos:** bottom sheet, samo cifre, „Provjeri ICCID".
8. **Sken kontekst:** iz Ugradnje/Demontaže naslov prikazuje ispravnu svrhu i
   nakon skena se vraća u odgovarajući wizard.
9. **Historija:** nakon 2–3 skena čipovi se pojave i ponavljaju akciju.

## Rollback

```bash
rm -rf mobile && mv mobile.before-nav-scan mobile
```

## Napomena

Sandbox ne pokreće Expo/Metro, pa je `npx tsc --noEmit` na vašem checkoutu
obavezan prije builda. `expo start -c` je bitan jer Metro keš zna servirati
staru verziju route fajlova (naročito `_layout.tsx`).
