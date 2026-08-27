# MySQL migracije (BACKUP / ARHIVA)

Ovaj folder sadrži kompletnu istoriju Prisma migracija dok je projekat
koristio MySQL kao bazu (provider = "mysql" u schema.prisma).

Od migracije na PostgreSQL (avgust 2026), ove migracije se **ne koriste**
i nisu dio aktivnog `prisma/migrations` foldera — Prisma ih ignoriše jer
`migration_lock.toml` unutar ovog foldera i dalje kaže `provider = "mysql"`.

Zadržane su isključivo kao:
- istorijska referenca (kako se šema razvijala kroz 37 migracija),
- osnova za eventualni rollback na MySQL (vidi
  `docs/MIGRATION_MYSQL_TO_POSTGRES.md`, sekcija "Rollback").

Aktivne (Postgres) migracije se generišu u `prisma/migrations/` — vidi
migracioni dokument za tačan postupak (`prisma migrate dev --name init_postgres`).
