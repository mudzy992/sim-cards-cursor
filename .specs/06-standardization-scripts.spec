# SPEC 06 — Automated Standardization, Quality, A11y & i18n Scripts
**Prioritet:** P2 (High) & P3 (Low)
**Opseg:** `backend/`, `frontend/`, `scripts/qa/` (ili npm skripte u oba paketa)

---

## 1. ESLint + Prettier + Strict TypeScript

### 1.1 Backend (`backend/`)
- **Trenutno stanje:** `backend/package.json` ima `"lint": "tsc --noEmit"` i NEMA instaliran `eslint`, `prettier` niti konfiguracijske fajlove.
- **Standardizacija:**
  - Dodati `eslint` (v9 flat config `eslint.config.mjs`), `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `prettier`, `eslint-config-prettier`.
  - Pravila:
    - `@typescript-eslint/no-explicit-any: 'error'` (eliminisati `any` iz `pdf-generator.service.ts` i DTO-a)
    - `@typescript-eslint/no-floating-promises: 'error'` (hvata fire-and-forget async bugove poput `autoSendRecordEmail`)
    - `@typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_' }]`
  - Skripte u `backend/package.json`: `"lint"`, `"format:check"`, `"format:write"`, `"typecheck"`.

### 1.2 Frontend (`frontend/`)
- **Trenutno stanje:** `frontend/package.json` NEMA ESLint, Prettier, niti a11y provjere.
- **Standardizacija:**
  - Dodati `eslint` (`eslint.config.mjs`), `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`, `prettier`, `eslint-config-prettier`.
  - Pravila:
    - `react-hooks/rules-of-hooks: 'error'` (odmah bi uhvatio P1 bug u `PushCampaignsPage.tsx`!)
    - `react-hooks/exhaustive-deps: 'warn'` (hvata propuštene `[t]` zavisnosti u `useMemo`)
    - `@typescript-eslint/no-explicit-any: 'error'` (uklanja svih 12 `as any` u frontendu)
    - `jsx-a11y/recommended` pravila (hvata `<div onClick>` bez keyboard handlera, dugmad bez `aria-label`, iframe bez `title`, itd.)
  - Skripte u `frontend/package.json`: `"lint"`, `"format:check"`, `"typecheck"`.

---

## 2. i18n Consistency & Hardcoded String Detection
- **Trenutno stanje:** `check_used_keys.sh` u root-u ima hardkodiranu putanju `/home/claude/work/sim-cards-cursor-main/frontend/src` i nije uvezan u `package.json`/CI.
- **Standardizacija (`scripts/check-i18n.mjs` ili nadograđeni `frontend/scripts/check-i18n.mjs`):**
  1. **Key Parity Check:** Verifikuje 1:1 podudaranje svih nested ključeva između `bs.ts` i `en.ts` (uključujući interpolacione parametre `{{param}}`!).
  2. **Used Key Resolution Check:** Skenira sve `t('...')` literale u `frontend/src` (ignorišući komentare/JSDoc primjere poput `t('a.b')`) i potvrđuje da svaki postoji u oba rječnika.
  3. **Unused Key Report (warning):** Ispisuje ključeve koji postoje u `bs.ts`/`en.ts`, a nigdje se ne koriste.
  4. **Hardcoded UI String Scanner:** AST/regex provjera za bosanske dijakritike (`[čćžšđČĆŽŠĐ]`) i neprevedene stringove u JSX atributima (`title=`, `placeholder=`, `label=`, `alt=`, `message=`) izvan `src/i18n/` i komentara.

---

## 3. Tailwind & Component Consistency Check
- **Skripta (`scripts/check-ui-consistency.mjs`):**
  1. Detektuje upotrebu deprecated Ant Design v5 props-a (`bodyStyle`, `destroyOnClose`, `bordered={false}` -> `variant="borderless"`, `Space direction=` -> `orientation=`) u `frontend/src`.
  2. Detektuje direktne `<a href="/...">` ili `<Button href="/...">` linkove za interne rute (koji uzrokuju full-page reload umjesto React Router `Link`/`navigate`).
  3. Detektuje `<iframe>` bez `title` ili `srcDoc` bez `sandbox`.
  4. Detektuje neispravne light-only Tailwind boje van `.print-preview-scope` (npr. hardcoded `bg-white` ili inline `#f5f5f5` na tamnoj temi).

---

## 4. WCAG / Accessibility (a11y) Automated Checks (`axe-core`)
- Pored statičkog `eslint-plugin-jsx-a11y`, uvesti lagani `@axe-core/react` (dev-only) ili Vitest + `jest-axe` / `axe-core` test suite za ključne komponente (`LoginPage`, `AppLayout`, `Header`, `NotificationBell`, `MetersListPage`) koji se izvršava u CI.
- Osigurati:
  - Sva ikona-dugmad (`NotificationBell`, `LanguageSwitcher`, itd.) imaju `aria-label`.
  - Svi interaktivni elementi su `<button>` / `<a>` (ne `<div>` ili `<List.Item>` sa `onClick` bez `role`/`tabIndex`).
  - Kontrast teksta i fokus prsten (`:focus-visible`) ispunjavaju WCAG 2.1 AA.
