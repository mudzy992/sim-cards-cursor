# SKILL_02_BACKEND_API_IMPLEMENTATION

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Novi backend endpoint.
- Izmjena poslovne logike u NestJS modulu.

## Ulaz
- Task ID
- DTO zahtjevi
- RBAC očekivanja

## Procedura
1. Definisati DTO input/output i validaciju.
2. Uvesti/izmijeniti service metodu sa čistom poslovnom logikom.
3. Dodati controller rutu sa guard-ovima i role pravilima.
4. Dodati audit log na kritične mutacije.
5. Ažurirati Swagger opis i primjere.
6. Pokriti unit/integration testovima.

## Izlaz
- Endpoint koji poštuje REST semantiku.
- Testovi za success i failure path.
- Ažuriran API contract.

## Quality gate
- Nema endpointa bez validacije inputa.
- Nema status transition promjene bez centralne provjere pravila.
