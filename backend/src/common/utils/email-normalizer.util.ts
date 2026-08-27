/**
 * Normalizes an email address for storage and lookup.
 *
 * IMPORTANT (MySQL -> PostgreSQL migration):
 * MySQL's default collation (utf8mb4_unicode_ci) made string comparisons
 * (including the unique index on `email` and WHERE lookups) case-insensitive.
 * PostgreSQL's default `text`/`citext`-less comparison is case-sensitive.
 * To keep the exact same behavior after the migration (one account per
 * email regardless of case, and login working no matter how the user
 * types their email), we normalize to lowercase on every write and on
 * every exact-match read of the `email` column.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
