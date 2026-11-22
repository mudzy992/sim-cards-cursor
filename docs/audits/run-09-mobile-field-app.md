# Audit Run 9 — Mobilna terenska aplikacija (`mobile/` + Bulk Task Dispatch)

**Obuhvaćeni moduli:** `mobile/app/**`, `mobile/src/**`, `mobile/.maestro/**`, `mobile/scripts/**`, te `backend` + `frontend` bulk task dispatch (`install-tasks/bulk`, `demount-tasks/bulk`).  
**Datum audita:** 2026-11-22 (branch `arena/015aa78f-sim-cards-cursor`)  
**Status:** **Kompletan redizajn, WCAG AAA dual `light`/`dark` tema, CI guardrails, terenske nadogradnje, full `bs`/`en` i18n, in-app APK downloader, Maestro E2E i RNTL testovi implementirani i verifikovani**.

---

## 1. Sažetak zatečenog stanja i nalaza

1. **Dark-only tema & 27 hardcoded hex boja:** `mobile/src/theme/colors.ts` i `tokens.ts` su bili zaključani na `SHARED_THEME_COLORS.dark`, sa statičnim `StyleSheet.create` referencama i 27 hardcoded hex vrijednosti (`#4D82E6`, `#D63F55`, `#FFFFFF`, `#000000`, `#FBBF24`, `#60A5FA` itd.). Na jakom dnevnom suncu terenski radnici nisu imali visokokontrastnu svijetlu (`light`) temu.
2. **Nedostajući CI guardrails za `mobile/`:** Za razliku od `frontend/`, `mobile/` nije imao `check:i18n`, `check:wcag`, ni `check:ui` u `package.json` i `.github/workflows/ci.yml`.
3. **Nepotpuna internacionalizacija & parcijalni QR/foto tokovi:**
   - Rješnici `bs.ts`/`en.ts` su postojali, ali većina ekrana i feature komponenti nije koristila `useTranslation()` (`t(...)`).
   - `create-record.tsx` i `create-record-replacement.tsx` su slali pogrešne route parametre za povratak iz `scan.tsx` (`serialTarget` / `returnTo`).
   - `PhotoCapture.tsx` je prikazivao samo broj fotografija bez thumbnail pregleda i bez uklanjanja pojedinačnih slika.
   - Aplikacija nije imala globalni React `ErrorBoundary`, ni in-app Android APK downloader sa prikazom napretka.
4. **Terenska ergonomija i pouzdanost:**
   - Serijski broj brojila se unosio ručno na terenima bez mogućnosti brzog barcode/QR skeniranja.
   - Zapisnici (`create-record`, `create-record-replacement`) nisu automatski čuvali nacrt (draft) u slučaju gašenja aplikacije ili pražnjenja baterije.
   - Liste naloga (`Ugradnja`, `Demontaža`) nisu izračunavale udaljenost od trenutnog GPS položaja montera, nisu imale sortiranje "Najbliže", direktno otvaranje u mapama niti SLA indikatore starosti/kašnjenja naloga.
   - `OutboxScreen` nije omogućavao pojedinačni retry/uklanjanje neuspjele stavke, a `OfflineInventoryScreen` nije imao eksplicitno dugme za usklađivanje s povratnim sažetkom.
   - Mobilna aplikacija je imala samo 2 offline Jest suita (8 testova) i bez Maestro E2E flowova.
5. **Dispečing naloga:** Admini/moderatori su na webu morali kreirati naloge za ugradnju/demontažu pojedinačno za svako brojilo umjesto grupne dodjele (`bulk`).

---

## 2. Implementirane nadogradnje

### Paket A — WCAG AAA Dual `light`/`dark` tema & CI Guardrails (`mobile`)
- **`mobile/src/store/theme.store.ts`:** Reaktivni Zustand store sa `mode: 'system' | 'light' | 'dark'`, `SecureStore` perzistencijom i `Appearance` praćenjem OS teme.
- **`mobile/src/theme/{colors,tokens}.ts`:** Generisanje `palettes.light` i `palettes.dark` direktno iz `@sim-tracker/shared` `SHARED_THEME_COLORS`, plus `useTheme()` i `useThemedStyles()` hookovi. Uklonjeno svih 27 hardcoded hex boja.
- **`mobile/scripts/{check-i18n.mjs,check-ui-consistency.mjs,check-wcag-aaa.mjs}`:** Automatske provjere u `mobile/package.json` i `.github/workflows/ci.yml`.
- **`ProfileScreen`:** Dodati kontroleri za promjenu teme (**Sistem / Svijetla (Sunce) / Tamna (Mrak)**) i jezika (**Bosanski / English**).

### Paket B — Terenske nadogradnje, Full `bs`/`en` i18n, APK Downloader & ErrorBoundary (`mobile`)
- **Kompletan `bs`/`en` i18n:** Prošireni `bs.ts` i `en.ts` na **721 ključ u punom paritetu**; svi ekrani (`(tabs)/*`, sekundarni ekrani i feature komponente) prevedeni putem `useTranslation()`.
- **`PhotoCapture.tsx`:** Horizontalni `ScrollView` thumbnail strip (`photo-preview-strip`) za lokalne i poslane fotografije uz statusne oznake i uklanjanje pojedinačne slike (`photo-remove-local-{i}`, `photo-remove-uploaded-{i}`).
- **`useAppUpdateCheck.ts` + `HomeScreen` + `ProfileScreen`:** Provjera zadnjeg Android releasea (`appReleasesApi.getLatestAndroid()`), ugrađeni APK downloader (`FileSystem.createDownloadResumable`) sa progres trakom i procentom (`home-update-progress`, `profile-update-progress`), otkazivanjem (`cancelDownload`) i pokretanjem Android instalera putem `FileSystem.getContentUriAsync` + `IntentLauncher.startActivityAsync` (`REQUEST_INSTALL_PACKAGES` u `app.json`).
- **`AppErrorBoundary.tsx` + `mobile/app/_layout.tsx`:** Globalni prevedeni fallback ekran sa tehničkim detaljima i retry resetom (`error-boundary-screen`, `error-boundary-retry`).
- **`mobile/src/utils/haptics.ts` & `geo.ts`:** Taktičke vibracije, Haversine distanca, ekstrakcija koordinata brojila i vanjska GPS navigacija.
- **`mobile/src/offline/draft-store.ts` & `scan.tsx`:** Debounced auto-save nacrta za `create-record` i `create-record-replacement` + ispravljeni `serialTarget`/`returnTo` parametri za skeniranje serijskog broja brojila.
- **`TaskCard.tsx` + `install.tsx` + `demount.tsx`:** GPS distanca, sortiranje "Najbliže" vs "Najnovije", navigacija i SLA indikatori kašnjenja (`> 48h` upozorenje, `> 120h` hitno).
- **`OutboxScreen` & `OfflineInventoryScreen`:** Pojedinačni retry/brisanje outbox stavke i eksplicitno "Uskladi sa serverom" sa sažetkom osvježenih/uklonjenih kartica.

### Paket C — Bulk Task Dispatch (`backend` + `frontend`), Maestro E2E & RNTL/Vitest testovi
- **Backend:** `POST /install-tasks/bulk` i `POST /demount-tasks/bulk` (`BulkCreateInstallTaskDto`, `BulkCreateDemountTaskDto`) sa deduplikacijom ID-eva, provjerom opsega i parcijalnim izvještajem (`createdCount`, `failedCount`, `created`, `failed`).
- **Web (`MetersListPage.tsx`):** `rowSelection` za višestruki odabir brojila, akciona traka sa brojanjem pogodnih brojila i grupno dodjeljivanje zadataka ugradnje/demontaže monteru; pokriveno komponentnim testom `MetersListPage.spec.tsx` i proširenim Playwright `smoke.spec.ts`.
- **Maestro E2E (`mobile/.maestro/`):** Stabilni `testID` atributi na svim ekranima + 4 YAML flowa (`01-login-and-home.yaml`, `02-language-and-theme-switch.yaml`, `03-scan-manual-and-result.yaml`, `04-offline-inventory-and-outbox.yaml`).
- **Mobile Jest & RNTL testovi (`@testing-library/react-native` + `test-renderer`):** `offline-iccid.spec.ts`, `meter-types-sync.spec.ts`, `outbox.spec.ts`, `draft-store.spec.ts`, `geo.spec.ts`, `theme-tokens.spec.ts`, `useAppUpdateCheck.spec.tsx`, `AppErrorBoundary.spec.tsx`, `PhotoCapture.spec.tsx`, `TaskCard.spec.tsx`, `WorkflowModal.spec.tsx` i `DynamicMeterFields.spec.tsx` (**12 suite-ova / 35 testova**).

---

## 3. Verifikacija

- **`@sim-tracker/shared`:** `build` (CJS+ESM) + `test` (**5/5**).
- **`backend`:** `nest build` + `tsc --noEmit` + `eslint` + `jest` (**25/25 suite-ova, 126/126 testova**) + Supertest `workflows.e2e-spec.ts` (`WF-00`..`WF-10`).
- **`frontend`:** `tsc --noEmit` + `eslint` + `check:i18n` (**1,076** ključeva u paritetu) + `check:wcag` (**72** para, min **4.92:1**) + `check:ui` (**142** fajla) + `vitest` (**10/10 fajlova, 31/31 test**) + `vite build` + Playwright `smoke.spec.ts`.
- **`mobile`:** `tsc --noEmit` + `eslint` + `check:i18n` (**721** ključ u paritetu, **484** `t()` poziva) + `check:wcag` (**46** para light/dark, min **4.92:1**) + `check:ui` (**108** fajlova, 0 hex/any) + `jest` (**12/12 suite-ova, 35/35 testova**).
