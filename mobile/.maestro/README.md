# Maestro Mobilni E2E Testovi (`mobile/.maestro`)

Ovi flowovi pokrivaju ključne terenske scenarije Android aplikacije koristeći stabilne `testID` atribute na ekranima i komponentama.

## Preduslovi

1. Instaliran [Maestro CLI](https://maestro.mobile.dev/):
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```
2. Pokrenut Android emulator ili povezan fizički Android uređaj (`adb devices`) sa instaliranim `ba.epbih.simtracker` dev/preview buildom.
3. Dostupan backend API za login i scan provjere.

## Pokretanje svih flowova

```bash
MAESTRO_EMAIL=admin@simtracker.local \
MAESTRO_PASSWORD='CiSeedPassword!123' \
MAESTRO_TEST_ICCID=8938700000000000001 \
maestro test mobile/.maestro
```

## Pokretanje pojedinačnog flowa

```bash
maestro test mobile/.maestro/01-login-and-home.yaml
maestro test mobile/.maestro/02-language-and-theme-switch.yaml
```

## Pokriveni scenariji

- `01-login-and-home.yaml` — Prijava (`login-email-input`, `login-password-input`, `login-submit-btn`) i provjera početnog ekrana (`home-greeting`, `home-connection-pill`).
- `02-language-and-theme-switch.yaml` — Promjena teme (`system`/`light`/`dark`) i jezika (`bs`/`en`) na `ProfileScreen` uz provjeru prevedenih labela.
- `03-scan-manual-and-result.yaml` — Ručni unos ICCID barkoda na `ScanScreen` i navigacija na `ScanResultScreen`.
- `04-offline-outbox-sync.yaml` — Otvaranje `OfflineInventoryScreen` (pretraga SIM kartica) i `OutboxScreen` (`outbox-sync-now-btn`).
