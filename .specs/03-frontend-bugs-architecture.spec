# SPEC 03 — Web Frontend Bugs, Architecture, Performance & UX/i18n Fixes
**Prioritet:** P1 (Critical), P2 (High), P3 (Low)
**Opseg:** `frontend/src/**`

---

## 1. P1 — Runtime Crashes, Hooks Violations & Auth Race Conditions

### 1.1 `PushCampaignsPage.tsx` — React Rules of Hooks Violation
- **Fajl:** `frontend/src/pages/push-campaigns/PushCampaignsPage.tsx` (linije 21–37)
- **Problem:** `if (!pushEnabled) return <Alert .../>;` stoji PRIJE `useQueryClient()`, `useState()`, `useQuery()`, `useMutation()`, `useMemo()`, `useCallback()`. Kad `featuresQuery.data` pređe iz `undefined`/`false` u `true` ili obrnuto, React baca fatalnu runtime grešku (`Rendered more hooks than during the previous render`).
- **Rješenje:** Premjestiti sve hookove iznad ranog `return` bloka (koristiti `enabled: pushEnabled` na `useQuery`), a uslovni `<Alert>` renderovati tek nakon svih hookova.

### 1.2 `InstallationRecordDetailPage.tsx` — Unreachable Error State & Render-Time Blob Leak
- **Fajl:** `frontend/src/pages/installation-records/InstallationRecordDetailPage.tsx` (linije 141–144, 166–198)
- **Problemi:**
  1. Linije 141–144 pozivaju `URL.createObjectURL(pdfQuery.data)` i `setPdfObjectUrl(url)` direktno u tijelu render funkcije (pored `useEffect`-a na linijama 89–94), što uzrokuje ekstra re-render i trajni memory leak ne-revokovanih Blob URL-ova.
  2. Linija 166 `if (recordQuery.isLoading || !record)` hvata slučaj kad je `recordQuery.isError === true` (jer je tada `record === undefined`), čineći `if (recordQuery.isError)` na liniji 191 potpuno nedostižnim — stranica zauvijek prikazuje `"Učitavanje..."` umjesto greške.
- **Rješenje:** Ukloniti render-body `if (pdfQuery.data && !pdfObjectUrl)` blok; pomjeriti `if (recordQuery.isError)` IZNAD `if (recordQuery.isLoading || !record)`.

### 1.3 `axios.instance.ts` — Concurrent 401 Refresh Token Race Condition
- **Fajl:** `frontend/src/api/axios.instance.ts` (linije 69–108)
- **Problem:** Više paralelnih HTTP zahtjeva koji istovremeno dobiju `401` nezavisno pokreću `POST /auth/refresh` sa istim `refreshToken`. Prvi uspije i rotira token u bazi; ostali dobiju 401 i pozovu `authState.clearSession()`, neočekivano izbacujući korisnika na login. Također, poziv `/auth/refresh` koristi istu instancu bez flaga da preskoči ponovni interceptor.
- **Rješenje:** Implementirati singleton `refreshPromise: Promise<string> | null` mutex tako da svi paralelni 401 zahtjevi čekaju jedan refresh poziv, te koristiti čist `axios.post` (ili označiti `_retry = true` na refresh config-u) kako sam `/auth/refresh` ne bi ponovo ulazio u refresh granu.

### 1.4 `useNotificationSocket.ts` — Broken Socket.IO Namespace Behind `/backend/api` Proxy
- **Fajl:** `frontend/src/hooks/useNotificationSocket.ts` (linije 9–67)
- **Problem:** `baseUrls.map((base) => base.replace(/\/api\/?$/, ''))` za `VITE_API_BASE_URL=/backend/api` daje `'/backend'`, pa klijent otvara Socket.IO namespace `'/backend/notifications'` umjesto `'/notifications'` (dok je `path: '/api/socket.io'`). U produkciji/VM-u iza Traefika real-time notifikacije ne stižu preko namespace mismatch-a, a fallback `connect_error` handler ne veže `connect_error` na novi socket.
- **Rješenje:** Ekstrahovati origin (ili prazan string `''` za same-origin relativne URL-ove) odvojeno od namespace-a `'/notifications'` i postaviti `path` ispravno prema prefixu (`/backend/api/socket.io` ili `/api/socket.io` kako Traefik rutira).

---

## 2. P2 — Functional Bugs, Memory Leaks, Missing Pagination & Dead Code

### 2.1 `RecordPhotoImage.tsx` — Unmount Blob URL Leak & Hardcoded Strings
- **Fajl:** `frontend/src/components/installation-records/RecordPhotoImage.tsx`
- **Rješenje:** Dodati `let cancelled = false;` u `useEffect` i u `.then()` odmah pozvati `URL.revokeObjectURL` ako je `cancelled === true`; zamijeniti `'Fotografija'` i `'Greška učitavanja'` sa `t(...)` i dark-theme klasama.

### 2.2 `MeterDetailPage.tsx` & `MetersListPage.tsx` & `MeterTypeUpsertPage.tsx`
- **`MeterDetailPage.tsx`:** `createInstallMutation.onSuccess` mora invalidirati `['meters', 'detail', id]` i `['meters']`.
- **`MetersListPage.tsx`:**
  - Ukloniti nekorišteni `isQuickDetail` state i neiskorišteni `recordsByMeterQuery` / `recordsForMeter`.
  - Resetovati `pagination.page` na `1` pri promjeni `filterTypeId`.
  - Filtrirati operatore po `branchId` kada zadatak kreira branch moderator (uskladiti sa `MeterDetailPage.tsx`).
  - Dodati validacione poruke na `installDrawer`/`demountDrawer` umjesto tihog `return`.
- **`MeterTypeUpsertPage.tsx`:** Zamijeniti kontrolisani `fields={...}` prop na `<Form>` sa `useEffect` + `typeForm.setFieldsValue(...)` da refetch ne briše korisnikove izmjene u formi.

### 2.3 `UsersListPage.tsx` — Missing Pagination & Moderator Sync Race
- **Fajl:** `frontend/src/pages/users/UsersListPage.tsx`
- **Problemi:** Tabela korisnika ima `pagination={false}` dok backend `/users` vraća po defaultu max 20 korisnika -> korisnici preko 20 nisu vidljivi niti dostupni! Također `pendingModeratorSync` state u `updateMutation` ne čisti se na `onError`, a `role` Select ostaje aktivan za `DIST_ADMIN`.
- **Rješenje:** Dodati server-side paginaciju (`page`, `limit`, `search`) na `UsersListPage`, ukloniti race-prone `pendingModeratorSync` state (proslijediti direktno kroz `mutationFn` argument), i zaključati `role` Select kad je rola `DIST_ADMIN`.

### 2.4 `ActivityLogPage.tsx`, `PushCampaignsPage.tsx`, `ShipmentsListPage.tsx`
- `ActivityLogPage.tsx`: Resetovati `page` na `1` kad se mijenja `actionFilter` ili `entityFilter`.
- `PushCampaignsPage.tsx`: Proslijediti `userSearch` u `usersApi.list` (ili podržati server `search` parametar) i dodati `t` u dependency nizove `useMemo`.
- `ShipmentsListPage.tsx`: Prikazati stvarnu backend grešku u `assignMutation` / `unassignMutation` `onError`.

### 2.5 `error.utils.ts` — Array Validation Messages & i18n
- **Fajl:** `frontend/src/utils/error.utils.ts`
- **Problem:** Ignoriše `message: string[]` od NestJS `ValidationPipe` i ima hardkodirane bosanske stringove.
- **Rješenje:** Podržati `Array.isArray(data.message)` + `errorCode` lookup iz `t('errors.codes.<CODE>')` sa fallback-om na prevedene generičke poruke.

---

## 3. P3 — Code Splitting, ErrorBoundary, Dead Code & Print Performance

### 3.1 Lazy Loading, ErrorBoundary & Full-Page Reload Links
- **`frontend/src/router/index.tsx`:** Ukloniti neiskorišteni import `ShipmentCreatePage` (mrtav kod) i prebaciti stranice na `React.lazy` + `Suspense` sa fallback spinnerom kako se smanji početni JS bundle.
- **`frontend/src/components/layout/AppLayout.tsx`:** Dodati React `ErrorBoundary` oko `<Outlet />` i pristupačan skip-to-content link.
- **`SettingsPage.tsx` & `EmailSettingsPage.tsx`:** Zamijeniti `<Button href="...">` sa SPA navigacijom (`onClick={() => navigate(...)}`) da se izbjegne puni reload stranice i gubitak React Query cache-a.
- **`SettingsPage.tsx`:** Ukloniti mrtav poziv `useAuthStore((s) => s.user);`.
- **`Sidebar.tsx` & `SettingsPage.tsx` & `UsersListPage.tsx`:** Zamijeniti deprecated AntD v5 props (`bodyStyle` -> `styles={{ body: ... }}`, `destroyOnClose` -> `destroyOnHidden`).
- **`frontend/src/main.tsx`:** Konfigurisati razumne `QueryClient` defaulte (`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`).
- **`ShipmentPrintPage.tsx`:** Dodati paginaciju/virtualizaciju pregleda listova kada je broj A4 listova velik (>10) radi očuvanja odzivnosti UI-a.
