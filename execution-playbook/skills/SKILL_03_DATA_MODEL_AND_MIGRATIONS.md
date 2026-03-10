# SKILL_03_DATA_MODEL_AND_MIGRATIONS

Povratna referenca: [../SOURCE_OF_TRUTH.md](../SOURCE_OF_TRUTH.md)

## Trigger
- Nova tabela/relacija/indeks.
- Promjena enum statusa ili validacione logike.

## Ulaz
- Poslovno pravilo koje zahtijeva model promjenu.
- Query pattern koji treba optimizovati.

## Procedura
1. Predložiti promjenu Prisma modela.
2. Provjeriti uticaj na postojeće relacije i unikate.
3. Kreirati migraciju sa jasnim nazivom.
4. Dodati seed/update skriptu ako je potrebna.
5. Verifikovati backward compatibility i rollback plan.
6. Ažurirati servise koji zavise od izmjene.

## Izlaz
- Migracija + ažurirana schema.
- Dokumentovan uticaj na module i API.

## Quality gate
- Nema schema promjene bez migracije.
- Nema migracije bez provjere indeksa za ključne query-je.
