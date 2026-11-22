# Audit Run 9 — Mobilna terenska aplikacija (`mobile/` + Bulk Task Dispatch)

**Obuhvaćeni moduli:** `mobile/app/**`, `mobile/src/theme/**`, `mobile/src/components/**`, `mobile/src/features/**`, `mobile/src/offline/**`, `mobile/src/i18n/**`, `mobile/scripts/**`, te `backend` + `frontend` bulk task dispatch (`install-tasks/bulk`, `demount-tasks/bulk`).  
**Datum audita:** 2026-11-22 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** **Kompletan redizajn, WCAG AAA dual `light`/`dark` tema, CI guardrails i terenske nadogradnje implementirani i verifikovani**.

---

## 1. Sažetak zatečenog stanja i nalaza

1. **Dark-only tema & 27 hardcoded hex boja:** `mobile/src/theme/colors.ts` i `tokens.ts` su bili zaključani na `SHARED_THEME_COLORS.dark`, sa statičnim `StyleSheet.create` referencama i 27 hardcoded hex vrijednosti (`#4D82E6`, `#D63F55`, `#FFFFFF`, `#000000`, `#FBBF24`, `#60A5FA` itd.). Na jakom dnevnom suncu terenski radnici nisu imali visokokontrastnu svijetlu (`light`) temu.
2. **Nedostajući CI guardrails za `mobile/`:** Za razliku od `frontend/`, `mobile/` nije imao `check:i18n`, `check:wcag`, ni `check:ui` u `package.json` i `.github/workflows/ci.yml`.
3. **Terenska ergonomija i pouzdanost:**
   - Serijski broj brojila se unosio ručno na terenima bez mogućnosti brzog barcode/QR skeniranja.
   - Zapisnici (`create-record`, `create-record-replacement`) nisu automatski čuvali nacrt (draft) u slučaju gašenja aplikacije ili pražnjenja baterije.
   - Liste naloga (`Ugradnja`, `Demontaža`) nisu izračunavale udaljenost od trenutnog GPS položaja montera, nisu imale sortiranje "Najbliže", direktno otvaranje u mapama niti SLA indikatore starosti/kašnjenja naloga.
   - `OutboxScreen` nije omogućavao pojedinačni retry/uklanjanje neuspjele stavke, a `OfflineInventoryScreen` nije imao eksplicitno dugme za usklađivanje s povratnim sažetkom.
   - Mobilna aplikacija je imala samo 2 offline Jest suita (8 testova).
4. **Dispečing naloga:** Admini/moderatori su na webu morali kreirati naloge za ugradnju/demontažu pojedinačno za svako brojilo umjesto grupne dodjele (`bulk`).

---

## 2. Implementirane nadogradnje

### Paket A — WCAG AAA Dual `light`/`dark` tema & CI Guardrails (`mobile`)
- **`mobile/src/store/theme.store.ts`:** Reaktivni Zustand store sa `mode: 'system' | 'light' | 'dark'`, `SecureStore` perzistencijom i `Appearance` praćenjem OS teme.
- **`mobile/src/theme/{colors,tokens}.ts`:** Generisanje `palettes.light` i `palettes.dark` direktno iz `@sim-tracker/shared` `SHARED_THEME_COLORS`, plus `useTheme()` i `useThemedStyles()` hookovi. Uklonjeno svih 27 hardcoded hex boja.
- **`mobile/scripts/{check-i18n.mjs,check-ui-consistency.mjs,check-wcag-aaa.mjs}`:** Automatske provjere u `mobile/package.json` i `.github/workflows/ci.yml`.
- **`ProfileScreen`:** Dodati kontroleri za promjenu teme (**Sistem / Svijetla (Sunce) / Tamna (Mrak)**) i jezika (**Bosanski / English**).

### Paket B — Terenske nadogradnje (`mobile`)
- **`mobile/src/utils/haptics.ts`:** Taktičke vibracije za skeniranje, uspješne akcije i upozorenja (RN `Vibration`, bez novih native paketa).
- **`mobile/src/utils/geo.ts`:** Haversine distanca (`calculateDistanceMeters`, `formatDistance`), ekstrakcija koordinata brojila i otvaranje vanjske GPS navigacije (`Linking.openURL`).
- **`mobile/src/offline/draft-store.ts`:** Debounced auto-save nacrta za `create-record` i `create-record-replacement` s vraćanjem/odbacivanjem nacrta pri ponovnom otvaranju ekrana.
- **`scan.tsx` (`afterScan=meterSerial`):** Podrška za skeniranje serijskog broja brojila direktno iz formi `create-record`, `create-record-replacement` i `install`.
- **`TaskCard.tsx` + `install.tsx` + `demount.tsx`:** Prikaz GPS udaljenosti, sortiranje "Najbliže" vs "Najnovije", dugme za GPS navigaciju i SLA indikatori kašnjenja (`> 48h` upozorenje, `> 120h` hitno).
- **`OutboxScreen` & `OfflineInventoryScreen`:** Pojedinačni retry/brisanje outbox stavke i eksplicitno "Uskladi sa serverom" sa sažetkom osvježenih/uklonjenih kartica.

### Paket C — Bulk Task Dispatch (`backend` + `frontend`) & Mobile Jest testovi
- **Backend:** `POST /install-tasks/bulk` i `POST /demount-tasks/bulk` (`BulkCreateInstallTaskDto`, `BulkCreateDemountTaskDto`) sa deduplikacijom ID-eva, provjerom opsega i parcijalnim izvještajem (`createdCount`, `failedCount`, `created`, `failed`).
- **Web (`MetersListPage.tsx`):** `rowSelection` za višestruki odabir brojila, akciona traka sa brojanjem pogodnih brojila i grupno dodjeljivanje zadataka ugradnje/demontaže monteru.
- **Mobile Jest testovi:** Dodati `outbox.spec.ts`, `draft-store.spec.ts`, `geo.spec.ts` i `theme-tokens.spec.ts` (ukupno **6 suite-ova / 19 testova**).

---

## 3. Verifikacija

- **`@sim-tracker/shared`:** `build` (CJS+ESM) + `test` (**5/5**).
- **`backend`:** `nest build` + `tsc --noEmit` + `eslint` + `jest` (**25/25 suite-ova, 126/126 testova**).
- **`frontend`:** `tsc --noEmit` + `eslint` + `check:i18n` (**1,076** ključeva u paritetu) + `check:wcag` (**72** para, min **4.92:1**) + `check:ui` (**141** fajl) + `vitest` (**9/9 fajlova, 30/30 testova**) + `vite build`.
- **`mobile`:** `tsc --noEmit` + `eslint` + `check:i18n` (**219** ključeva u paritetu) + `check:wcag` (**46** para light/dark, min **4.92:1**) + `check:ui` (**98** fajlova, 0 hex/any) + `jest` (**6/6 suite-ova, 19/19 testova**).

