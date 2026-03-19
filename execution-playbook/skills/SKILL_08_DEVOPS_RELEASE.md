# SKILL_08_DEVOPS_RELEASE

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Priprema staging/production deploy-a.
- Uvođenje CI/CD ili Docker optimizacija.

## Ulaz
- Build artefakti backend/web/mobile
- Env konfiguracija
- Test izvještaj i open issue lista

## Procedura
1. Verifikovati env var set i tajne.
2. Buildati backend, frontend i mobile artefakte.
3. Pokrenuti test pipeline i quality gate check.
4. Pripremiti i validirati docker compose/deploy manifest.
5. Deploy na staging, izvršiti smoke test.
6. Deploy na produkciju uz rollback plan.

## Izlaz
- Reproducibilan CI/CD tok.
- Stabilan release sa monitoring signalima.

## Quality gate
- Nema produkcionog deploy-a bez green test pipeline-a.
- Rollback plan je obavezan dio release paketa.
