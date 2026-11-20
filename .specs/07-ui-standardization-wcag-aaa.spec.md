# Specifikacija 07 — Opcija 1: Potpuna Frontend Standardizacija, WCAG AAA, Light/Dark/System Tema, Nulti Hardkod & A11y

**Datum:** 2026-11-20  
**Grana:** `arena/015aa78f-sim-cards-cursor`  
**Cilj:** Dovesti postojeći React 18 + Vite + Ant Design v5 + Tailwind CSS web frontend (`frontend/`) na najviši nivo konzistentnosti, pristupačnosti (**WCAG 2.1/2.2 AAA**), potpune tokenizacije (**nula hardkodiranih boja, stilova i stringova**), podrške za **Light / Dark / System** temu (podrazumijevano `system`) i dugoročnog održavanja kroz automatizovane CI kapije.

---

## 0. Polazna inventura trenutnog stanja (`937dc40`)

- **Inverzni `slate` hak:** `frontend/tailwind.config.js` redefiniše `slate.50` (`#09090b`) do `slate.900` (`#f8f8fa`), što onemogućava prebacivanje na Light temu.
- **Hardkodirane boje i utility klase:** **89** direktnih hex/`rgb`/`rgba` vrijednosti i **89** literalnih `slate`/`white`/`black` Tailwind klasa u **27** fajlova (`Header.tsx`, `Sidebar.tsx`, `LoginPage.tsx`, `DashboardPage.tsx`, `AnalyticsPage.tsx`, `MetersListPage.tsx`, `MeterDetailPage.tsx`, `SimCardDetailsPage.tsx`, `PushCampaignsPage.tsx`, `SettingsPage.tsx`, `ShipmentPrintPage.tsx`, `ImportReviewTable.tsx`, `ShipmentImportPanel.tsx`, itd.).
- **Ad-hoc `<Tag>` upotreba:** **48** direktnih `<Tag color="...">` poziva sa AntD presetima (`gold`, `blue`, `geekblue`, `green`, `red`, `orange`) koji ne garantuju WCAG AAA kontrast u oba režima.
- **Eksterni fontovi u `frontend/index.html`:** Učitavanje `Inter` i `JetBrains Mono` sa `fonts.googleapis.com` umjesto lokalnog pakovanja (problem za interni VM deploy i strogi CSP).
- **Tema bez FOUC zaštite:** `index.html` hardkodira `<meta name="color-scheme" content="dark" />` i `#0a0a0c`, a `src/styles/theme.ts` izvozi samo statični `darkAlgorithm`.

---

## 1. Strogi zahtjevi za WCAG AAA & Zero-Hardcode

1. **WCAG AAA kontrast:**
   - Normalni tekst (`< 18pt` / `< 14pt bold`): minimalni omjer kontrasta **≥ 7.0 : 1** (u oba moda: Light i Dark).
   - Veliki tekst (`≥ 18pt` ili `≥ 14pt bold`), fokus prstenovi, ikone s informativnom ulogom i granice aktivnih inputa/kontrola: minimalni omjer **≥ 4.5 : 1**.
   - Fokus indikator (`:focus-visible`): vidljivi prsten (`outline: 3px solid var(--focus-ring)`, `outline-offset: 2px`) s kontrastom ≥ 4.5:1 u oba režima.
2. **Nulti hardkod (Zero-Hardcode):**
   - Zabranjeni literalni hex (`#...`), `rgb(...)`, `rgba(...)`, `hsl(...)` i Tailwind palete (`slate-*`, `gray-*`, `zinc-*`, `white`, `black`, `emerald-*`, `red-*`, `amber-*`, `blue-*`) u stranicama i komponentama.
   - Dozvoljeni **isključivo** u:
     - `frontend/src/styles/tokens.ts` & `frontend/src/styles/tokens.css` (centralni izvor istine),
     - `frontend/src/pages/shipments/print/print-labels.css` i `.print-preview-scope` (fizički A4 papir simulacija i ispis na printeru),
     - `frontend/src/pages/shipments/import/import-report.utils.ts` (samostalni print HTML dokument koji se otvara u zasebnom print prozoru, preko namjenskih print CSS konstanti).
   - Svi UI tekstovi, `aria-label`, `title`, `placeholder`, `alt` i formati datuma/brojeva dolaze iz `i18n` i centralnih `formatters` / `constants` modula.

---

## 2. Fazni plan implementacije (Opcija 1)

### Faza 1 — Design Tokeni, WCAG AAA Validator & Light/Dark/System Theme Engine
**Cilj:** Ukloniti inverzni `slate` hak i uspostaviti semantički sistem tokena s matematički verifikovanim WCAG AAA kontrastom.

1. **`frontend/src/styles/tokens.ts` (jedinstveni TS izvor tokena za Light i Dark):**
   - **Surface & Background tokeni:**
     - `canvas`, `surface`, `surfaceRaised`, `surfaceSunken`, `surfaceHover`, `surfaceActive`, `headerBackdrop`
   - **Foreground / Text tokeni (AAA ≥ 7:1 na svim površinama):**
     - `textPrimary` (Light `#09090b` na `#ffffff`/`#f8fafc` ~ 19:1; Dark `#f8fafc` na `#09090b`/`#111318` ~ 17:1)
     - `textSecondary` (Light `#334155` ~ 9.8:1; Dark `#d4d4d8` ~ 12.5:1)
     - `textMuted` (Light `#475569` na `#ffffff` = 7.58:1 — nikad svjetlije!; Dark `#a1a1aa` na `#111318` = 7.4:1)
   - **Border tokeni:**
     - `borderSubtle`, `borderDefault`, `borderStrong` (≥ 4.5:1 za granice inputa i aktivnih kontrola).
   - **Brand & Akcent tokeni (AAA kalibrisani):**
     - Light: `accentPrimary` (`#2d249c` s `#ffffff` tekstom = 10.6:1; za linkove `#2d249c` na `#ffffff`), `accentHover` (`#231b7d`), `accentSoftBg` (`#eef2ff`), `accentSoftFg` (`#1e1b6b` ~ 13:1).
     - Dark: `accentPrimary` (`#3730a3` s `#ffffff` tekstom = 9.4:1 ili `#c7d2fe` s `#09090b` tekstom = 12.8:1; za linkove `#a5b4fc` na `#111318` = 9.3:1), `accentSoftBg` (`#1e1b4b`), `accentSoftFg` (`#e0e7ff`).
   - **Semantički statusni tokeni (`success`, `warning`, `danger`, `info`, `neutral`):**
     - Svaki status ima `bg`, `fg` (kontrast ≥ 7:1 protiv `bg`!), `border` (≥ 4.5:1) i `icon` u oba režima (`light` i `dark`).
   - **Print-papir tokeni (`printPaper`):**
     - Zasebni tokeni za A4 papir (`#ffffff`, `#0f172a`, `#334155`, `#cbd5e1`) vezani samo za `.print-preview-scope` i `@media print`.
2. **`frontend/src/styles/tokens.css` & `frontend/src/styles/index.css`:**
   - Generisati/definisati CSS varijable pod `:root` / `:root[data-theme="light"]` i `:root[data-theme="dark"]` + `color-scheme: light` / `dark`.
   - Ukloniti sve literalne hex boje iz `index.css` i `antd-overrides.css` (zamijeniti CSS varijablama).
   - Ukloniti inverzni `slate` iz `tailwind.config.js` i zamijeniti semantičkim tokenima (`bg-canvas`, `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `text-fg-primary`, `text-fg-secondary`, `text-fg-muted`, `border-subtle`, `border-default`, `border-strong`, `bg-accent`, `text-on-accent`, `bg-status-*`, `text-status-*`).
3. **Lokalni fontovi (bez CDN zavisnosti):**
   - Instalirati `@fontsource-variable/inter` i `@fontsource-variable/jetbrains-mono` (ili `@fontsource/inter` + `@fontsource/jetbrains-mono`), uvesti u `main.tsx` i ukloniti `fonts.googleapis.com` iz `frontend/index.html`.
4. **Automatski WCAG AAA Contrast Gate (`frontend/scripts/check-wcag-aaa.mjs`):**
   - Skripta čita definisane parove iz `tokens.ts`, računa WCAG relativnu luminanciju i kontrast za **svaki par u Light i Dark modu** i prekida build/CI (`exit 1`) ako ijedan tekstualni par padne ispod `7.0:1` ili UI/granica ispod `4.5:1`.
   - Dodati npm skriptu `"check:wcag": "node scripts/check-wcag-aaa.mjs"` i ubaciti je u `.github/workflows/ci.yml`.
5. **Theme Store + Anti-FOUC Boot (`useThemeStore.ts`, `index.html`, `theme.ts`, `AntdLocaleBridge.tsx`):**
   - Opcije teme: `'system' | 'light' | 'dark'`, podrazumijevano **`'system'`**.
   - Inline boot skripta u `index.html` (preko `localStorage.getItem('sim-tracker.theme')` i `window.matchMedia('(prefers-color-scheme: dark)')`) postavlja `data-theme` i `color-scheme` prije prvog rendera — **nula treperenja**.
   - `AntdLocaleBridge.tsx` dinamički gradi `createAntdTheme(resolvedTheme, tableDensity)` koristeći `theme.defaultAlgorithm` / `theme.darkAlgorithm` + `theme.compactAlgorithm` (ako je aktivna kompaktna gustina tabela).

---

### Faza 2 — Standardizovana UI Biblioteka Komponenti & Content/Density Sloj
**Cilj:** Napraviti jedinstven skup komponenti i centralizovane sadržajne/formaterske module kako nijedna stranica ne bi izmišljala vlastiti layout, statuse ili formate.

1. **Standardizovane UI komponente (`frontend/src/components/ui/`):**
   - `PageShell.tsx` & `PageHeader.tsx`: standardno zaglavlje stranice (`<h1>`, opcionalni opis, statusni tag, akcioni slot), ujednačeni razmaci (`space-y-6`).
   - `SectionCard.tsx`: zamjena za šarene ad-hoc `<Card>` omotače sa semantičkim naslovom, opisom i opcijom akcija.
   - `StatCard.tsx`: standardna kartica metrike za `DashboardPage`, `AnalyticsPage`, `ShipmentPrintPage`, itd. (`tabular-nums`, AAA kontrast, optional trend/suffix).
   - `StatusBadge.tsx`: jedinstveni badge za sve domenske statuse (`SimCardStatus`, `MeterStatus`, `MeterSimCardState`, `InstallTaskStatus`, `DemountTaskStatus`, `UserRole`, `UserStatus`, `ShipmentStatus`, `AuditAction`, `BooleanStatus`) koji koristi isključivo AAA statusne tokene (`bg`, `fg`, `border`) umjesto AntD preset boja (`gold`, `blue`, `geekblue`, ...).
   - `FilterBar.tsx`: standardna traka za pretragu, select filtere i "Očisti filtere" akciju.
   - `EmptyNotice.tsx` & `ErrorNotice.tsx`: jedinstveni prikazi praznog stanja i greške.
   - `ThemeSwitcher.tsx`: pristupačni switcher (`System` / `Light` / `Dark`) sa jasnim `aria-label` i opisom trenutnog aktivnog režima, smješten u `Header.tsx`.
   - `DensityToggle.tsx` (opciona brza kontrola za `Komforno` / `Kompaktno` u tabelama, sa persistencijom u `localStorage`).
2. **Učvršćivanje sadržaja (`frontend/src/utils/formatters.ts`, `frontend/src/config/routes.ts`, `frontend/src/constants/ui.ts`):**
   - Centralizovani `formatDate`, `formatDateTime`, `formatNumber`, `formatPercent`, `formatIccid` sa aktivnim `i18n` lokalom (`bs-BA` / `en-US`) i fallbackom `'—'`.
   - Centralizovane konstante ruta (`ROUTES`) i paginacije (`DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`).
   - Pojačanje `frontend/scripts/check-i18n.mjs` tako da provjerava i da nema literalnih UI stringova u `title="..."`, `placeholder="..."`, `aria-label="..."`, `alt="..."` atributima.

---

### Faza 3 — Strogi A11y (`jsx-a11y` strict, Landmarks, Keyboard, Live Regions)
**Cilj:** Učiniti cijelu aplikaciju potpuno upravljivom tastaturom i čitačima ekrana bez ijednog a11y prekršaja.

1. **ESLint & Tooling:**
   - Prebaciti `frontend/eslint.config.mjs` sa `jsxA11y.flatConfigs.recommended` na **`jsxA11y.flatConfigs.strict`**.
   - Pojačati `frontend/scripts/check-ui-consistency.mjs` (Zero-Hardcode Gate):
     - Zabrana svih `#...`, `rgb(...)`, `rgba(...)`, `hsl(...)` izvan whitelistovanih token/print fajlova.
     - Zabrana `bg-slate-*`, `text-slate-*`, `border-slate-*`, `bg-white`, `text-white`, `bg-black`, `text-black`, `bg-emerald-*`, `bg-red-*`, `bg-amber-*`, `bg-blue-*` izvan `.print-preview-scope` / token konfiguracije.
     - Zabrana `<Button href=` internih navigacionih linkova i `window.alert/confirm/prompt`.
2. **Strukturni A11y u Layoutu:**
   - **Skip-to-content** link (`Preskoči na glavni sadržaj` / `Skip to main content`) kao prvi fokusabilni element u `AppLayout.tsx` koji skače na `<main id="main-content" tabIndex={-1}>`.
   - Jasni HTML5 landmarki: `<header>`, `<nav aria-label="...">` (Sidebar + Breadcrumb), `<main id="main-content">`, `<footer>`.
   - Jedan `<h1>` po stranici (kroz `PageHeader` / `LoginPage` / error stranice), ispravna `h1 -> h2 -> h3` hijerarhija.
   - `aria-live="polite"` regioni za status učitavanja, upload/import progres i promjenu teme/jezika.
   - `@media (prefers-reduced-motion: reduce)` u `index.css` za isključenje animacija/tranzicija korisnicima osjetljivim na pokret.

---

### Faza 4 — Kompletna Migracija Svih Stranica i Komponenti (Nulti Hardkod)
**Cilj:** Zamijeniti sve preostale hardkodirane boje, `slate-*` klase, ad-hoc `<Tag>` elemente i nestandardne rasporede kroz sve module:

1. **Core Layout & Auth (7 fajlova):**
   - `AppLayout.tsx`, `Header.tsx`, `Sidebar.tsx`, `Breadcrumb.tsx`, `Footer.tsx`, `NotificationBell.tsx`, `LanguageSwitcher.tsx`, `LoginPage.tsx`, `ForbiddenPage.tsx`, `NotFoundPage.tsx`.
2. **Shipments, Import & Print (10 fajlova):**
   - `ShipmentsListPage.tsx`, `ShipmentDetailsPage.tsx`, `ShipmentWizardPage.tsx`, `ShipmentEditPage.tsx`, `ShipmentDeleteButton.tsx`, `ImportReviewTable.tsx`, `ShipmentImportPanel.tsx`, `import-report.utils.ts`, `ShipmentPrintPage.tsx`, `LabelSheetPreview.tsx` (očuvanje A4 bijelog papira pod `.print-preview-scope` tokenima!).
3. **Meters, Meter Types & SIM Cards (8 fajlova):**
   - `MetersListPage.tsx`, `MeterDetailPage.tsx`, `MeterTypeUpsertPage.tsx`, `MeterTypeFieldsPage.tsx`, `SimCardsIndexPage.tsx`, `SimCardDetailsPage.tsx`, `ModeratedInstalledSimCardsPage.tsx`.
4. **Installation Records, Dashboard, Analytics, Users, Admin & Settings (10 fajlova):**
   - `InstallationRecordsListPage.tsx`, `InstallationRecordDetailPage.tsx`, `InstallationRecordCreatePage.tsx`, `InstallationRecordCreateForm.tsx`, `RecordPhotoImage.tsx`, `DashboardPage.tsx`, `AnalyticsPage.tsx`, `UsersListPage.tsx`, `BranchModeratorsPage.tsx`, `BranchEmailRecipientsPage.tsx`, `PushCampaignsPage.tsx`, `AppReleasesPage.tsx`, `ActivityLogPage.tsx`, `SettingsPage.tsx`, `EmailSettingsPage.tsx`.

---

### Faza 5 — Sveobuhvatna A11y, Dual-Theme & CI Verifikacija
1. **Prošireni `axe-core` testovi (`frontend/src/test/a11y.spec.tsx`):**
   - Testiranje ključnih komponenti i stranica (`AppLayout`, `LoginPage`, `DashboardPage`, `ShipmentsListPage`, `MetersListPage`, `SettingsPage`, `NotificationBell`, `LabelSheetPreview`, `StatusBadge`, `ThemeSwitcher`) u **oba režima (`light` i `dark`)** s uključenim WCAG AAA pravilima (uključujući `color-contrast-enhanced` gdje je primjenjivo u jsdom/browseru + `check-wcag-aaa.mjs` za matematičku garanciju).
2. **Unit testovi za nove primitivne module:**
   - `theme.store.spec.ts` (`system`/`light`/`dark` persistencija i `matchMedia` reakcija),
   - `formatters.spec.ts`, `StatusBadge.spec.tsx`, `PageErrorBoundary.spec.tsx`.
3. **CI Pipeline (`.github/workflows/ci.yml`):**
   - Frontend job izvršava: `typecheck`, `lint` (`jsx-a11y/strict`), `check:wcag`, `check:i18n`, `check:ui` (zero-hardcode), `test` (`vitest` + `axe-core`), `build`.

---

## Kriteriji završetka Opcije 1 (Definition of Done)
- [ ] `npm run check:wcag` prolazi s 0 parova ispod 7:1 (tekst) / 4.5:1 (UI) u Light i Dark temi.
- [ ] `npm run check:ui` prolazi s 0 hardkodiranih hex/rgb/rgba/legacy-Tailwind boja izvan token/print fajlova.
- [ ] `npm run check:i18n` prolazi sa 100% paritetom (`bs`/`en`) i 0 literalnih UI stringova.
- [ ] `npm run lint` (`jsx-a11y/strict`), `tsc --noEmit`, `vitest` i `vite build` prolaze lokalno i u GitHub Actions CI.
- [ ] Tema se podrazumijevano prilagođava OS-u (`system`), podržava `Light` i `Dark` prebacivanje bez FOUC-a, a `.print-preview-scope` ostaje čitljiv A4 papir.
