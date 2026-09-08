# SIM Tracker Mobile — REDIZAJN Faza 1+2 (zamjenski paket)

**Sadržaj paketa:** design sistem (tokens + 9 UI komponenti) + redizajnirana
4 ekrana. **Bez demo koda** — sva logika identična produkciji, mijenja se
samo prezentacija. **`mobile/` u ovom paketu kopirati direktno preko
produkcijskog `mobile/` foldera.**

---

## 1. Mapa zamjene

### NOVI fajlovi (kopirati — ništa se ne prebrisuje)

```
mobile/src/theme/tokens.ts                      ← design tokens (boje, tipografija, senke)
mobile/src/constants/assets.ts                  ← centralni registar asset-a
mobile/src/components/ui/ActionButton.tsx       ← standardna akcija (5 varijanti)
mobile/src/components/ui/StatusBadge.tsx        ← semantičke oznake stanja
mobile/src/components/ui/Section.tsx            ← strukturno grupisanje (anti card-soup)
mobile/src/components/ui/Panel.tsx              ← diskretna okvirna površina
mobile/src/components/ui/ListRow.tsx            ← univerzalni red za liste
mobile/src/components/ui/Skeleton.tsx           ← loading placeholderi
mobile/src/components/ui/EmptyState.tsx         ← smislena prazna stanja
mobile/src/components/ui/WorkflowSteps.tsx      ← guided-procedure stepper
mobile/src/components/ui/ConnectionPill.tsx     ← trajni indikator veze/synca
```

### ZAMJENSKI fajlovi (prepisati preko postojećih)

```
mobile/app/(auth)/login.tsx            ← redizajnirana prijava (logika 1:1)
mobile/app/(app)/(tabs)/home.tsx       ← operativni dashboard (logika 1:1 + outbox brojevi)
mobile/app/(app)/(tabs)/scan.tsx       ← fullscreen skener + historija (logika 1:1)
mobile/app/(app)/(tabs)/_layout.tsx    ← restilizirana tab traka (badge logika 1:1)
```

### NEDIRNUTO (namjerno, bez izmjene)

```
mobile/app/_layout.tsx                 ← root layout (hydration)
mobile/app/(app)/_layout.tsx           ← auth/update/offline gates
mobile/app/(app)/(tabs)/install.tsx    ← workflow ekrani (Faza 3)
mobile/app/(app)/(tabs)/demount.tsx    ← workflow ekrani (Faza 3)
mobile/app/(app)/(tabs)/records.tsx    ← Faza 4
mobile/app/(app)/(tabs)/profile.tsx    ← Faza 4
mobile/app/(app)/*.tsx ostali          ← Faza 3/4
mobile/src/** ostalo                   ← postojeća infrastruktura (api, store, hooks, offline…)
```

---

## 2. Šta je SADRŽAJNO promijenjeno (prezentacija, bez uticaja na logiku)

| Ekran | Prije | Poslije (instrukcije.md) |
|---|---|---|
| **Login** | generična forma | brand blok + neutralna forma, server-status pill uvijek vidljiv (§6, §10) |
| **Home** | kartice sa brojkama | operativni dashboard: ConnectionPill → sync upozorenje → inventar redovi → aktivnost → brze radnje; odgovar na 5 pitanja u sekundi (§10) |
| **Scan** | kamera + input u istom sloju | fullscreen kamera sa okvirom, success flash, rescan, historija 3 čipa; ručni unos u podignutom panelu ispod (§11) |
| **Tabs** | default traka | brand/neutral tonovi, bolji razmaci, filled/outline ikone (§5, §6) |

**Svi importi koji se koriste u zamjenskim ekranima postoje u produkciji**
(verifikovani iz izvornih fajlova): `hooks/useAuth`, `hooks/useServerHealth`,
`utils/error.utils`, `components/LogoWatermark`, `store/auth.store`,
`api/sim-cards.api`, `api/installation-records.api`, `api/notifications.api`,
`offline/offline-cache`, `offline/outbox` (`listOutbox`),
`offline/meter-types-sync`, `store/global-blocking.store`,
`api/install-tasks.api`, `api/demount-tasks.api`,
`components/common/KeyboardAwareScreen`.

---

## 3. Koraci za primjenu

```bash
# 1) sigurnosno — kopija postojećeg mobile/ foldera
cp -r mobile mobile.backup

# 2) kopirati paket (NOVI fajlovi se dodaju, navedeni se prebrisuju)
#    najsigurnije: ručno/kopirati pojedinačne fajlove iz paketa

# 3) provjera
cd mobile
npx tsc --noEmit          # mora proći bez greške
npx expo start            # pregled na Expo Go / emulatoru

# 4) build
eas build -p android --profile production   # po vašem postojećem procesu
```

### Rollback (ako bilo šta ne odgovara)
```bash
rm -rf mobile && mv mobile.backup mobile
```

---

## 4. Poznata ograničenja / napomene timu

1. **Tabs `headerShown: false`** — pretpostavka je da ostali tab ekrani
   (install/demount/records/profile) već renderuju vlastite `ScreenHeader`-e
   (kao što originalni home/scan rade). Ako neki od njih NEMA vlastiti header,
   pojedinacno tome ekranu vratiti naslov: u `tabs/_layout.tsx` za tu rutu
   dodati `options={{ headerShown: true, title: 'Naslov' }}`.
2. **Scan → historija čipova**: ponavlja zadniju akciju (demount/install/
   inventar), ne otvara novi — namjerno, za serijske operacije na terenu.
3. **Barcodes**: dodan `code39`, `ean13`, `qr` uz postojeći `code128`.
4. **Home outbox**: red poziva `listOutbox(user)` (postojeći modul) — bez
   promjene na backend-infrastrukturi.
5. **`colors.ts` nije diran** — tokens.ts ga nadopunjuje (backward-compatible).

---

## 5. Šta slijedi (Faza 3/4 — spremni gradivni blokovi)

1. **Install/Demount stepper** — zamijeniti velike implementacije deklarativnim
   `<WorkflowSteps>` iz `src/components/ui` + zajednički workflow engine
   (smanjuje ~50% duplikacije, adresa audit #2).
2. **create-record / create-record-replacement** — sekciranje monolita na
   korake sa `<WorkflowSteps>` headerom.
3. **Records list** — `ListRow` + filter-chips + search + swipe akcije.
4. **RecordDetails** — structured `Panel`/`ListRow` prikaz podataka.
5. **Profile** — `ListRow` grupisanje postavki.

Svi gradivni blokovi za ovo već postoje u `src/components/ui/` — sljedeća faza
je isključivo prijevod postojećih ekrana na te komponente.
