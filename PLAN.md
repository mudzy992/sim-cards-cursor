# Plan izvršenja — i18n migracija do kraja

Redoslijed rada (checklist; štriklam ✅ kako završavam). Nakon SVAKE izmjene
rječnika pokrećem `validate_locales.sh` (parsira bs.ts/en.ts kao JS,
provjerava da su ključevi 1:1 identični) — ako ne prođe, popravljam odmah
prije nego nastavim dalje.

## FAZA 1 — Frontend, preostale stranice (redom, od manjih ka većim)
- [x] InstallationRecordCreateForm.tsx
- [x] ShipmentEditPage.tsx
- [x] ShipmentWizardPage.tsx
- [x] ShipmentImportPanel.tsx
- [x] ImportReviewTable.tsx
- [x] ShipmentCreatePage.tsx (legacy/neruotovana stranica — ipak migrirana)
- [x] LabelSheetPreview.tsx (print)
- [x] AnalyticsPage.tsx
- [x] PushCampaignsPage.tsx
- [x] MeterTypeUpsertPage.tsx
- [x] InstallationRecordDetailPage.tsx
- [x] app-settings.manifest.ts (labeli/opisi postavki — veliki broj kratkih stringova)
- [ ] ShipmentPrintPage.tsx
- [ ] UsersListPage.tsx
- [ ] MetersListPage.tsx
- [ ] MeterDetailPage.tsx (najveći fajl, 1257 linija)

## FAZA 2 — Frontend, ostalo
- [ ] Ponovni grep cijelog `frontend/src` za preostale bosanske string literale
      (isti heuristički audit kao do sad) — dok ne bude 0 stvarnih pogodaka
      (izuzev namjerno-nepreveden brand naziv "SIM Tracker" i tehnički
      identifikatori/enum vrijednosti).

## FAZA 3 — Mobile (Expo), ekrani i komponente
Redoslijed (manji → veći, isti obrazac: `useTranslation` iz `@/i18n/i18n.store`):
- [ ] src/features/records/MeterTypePicker.tsx
- [ ] src/features/records/PhotoCapture.tsx
- [ ] app/(app)/notifications.tsx
- [ ] src/features/tasks/WorkflowModal.tsx
- [ ] app/(app)/outbox.tsx
- [ ] src/features/tasks/DynamicMeterFields.tsx
- [ ] app/(app)/offline-inventory.tsx
- [ ] app/(app)/scan-result.tsx
- [ ] app/(app)/(tabs)/records.tsx
- [ ] src/components/ui/WorkflowSteps.tsx
- [ ] src/features/tasks/TaskCard.tsx
- [ ] app/(app)/record-details.tsx
- [ ] app/(app)/(tabs)/_layout.tsx (tab labeli)
- [ ] app/(app)/create-record.tsx
- [ ] app/(app)/create-record-replacement.tsx
- [ ] app/(app)/(tabs)/demount.tsx
- [ ] app/(app)/(tabs)/install.tsx
- [ ] app/(app)/(tabs)/home.tsx
- [ ] app/(app)/(tabs)/scan.tsx
- [ ] preostale manje UI komponente (ScreenTitleBar, Section, Skeleton,
      EmptyState, SegmentedFilter, ListRow, ActionButton — provjeriti svaku
      za hardcoded fallback tekstove/aria-label)
- [ ] Ponovni grep cijelog `mobile/` za preostale bosanske string literale.

## FAZA 4 — Backend error-code sistem
- [ ] Pregled svih `throw new *Exception(...)` poziva (170 fajlova) —
      dodati `code` polje (stabilan, jezički-neutralan identifikator) uz
      postojeći `message` (koji ostaje kao dev/log fallback).
- [ ] Pregled `class-validator` `@Is*({ message: '...' })` dekoratora u DTO
      fajlovima — isti pattern (code umjesto/uz tekst).
- [ ] Na frontendu: `errors.codes.*` namespace u bs.ts/en.ts + helper
      `translateApiError()` koji čita `errorCode` iz axios response-a i
      prevodi ga; postepeno zamijeniti direktno prikazivanje
      `err.response.data.message` tim helperom na mjestima gdje se
      backend poruka prikazuje korisniku.

## FAZA 5 — Finalna provjera
- [ ] Finalni audit (frontend + mobile) — cilj: 0 pogodaka osim
      opravdanih izuzetaka (brand, enum vrijednosti, tehnički identifikatori).
- [ ] `validate_locales.sh` prolazi (bs/en 1:1 parity).
- [ ] Ažuriran `I18N_MIGRATION_STATUS.md` sa konačnim stanjem.
- [ ] Finalni zip + audit CSV isporučeni.

---
Ovaj plan se radi striktno redom, bez preskakanja, bez međupitanja —
nastavlja se u uzastopnim porukama dok checklist ne bude kompletan.
