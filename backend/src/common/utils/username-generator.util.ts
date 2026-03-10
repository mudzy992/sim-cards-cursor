/**
 * Generates a unique username from firstName and lastName.
 * Format: ime.prezime (lowercase, diacritics removed)
 * If taken: ime.prezime1, ime.prezime2, ime.prezime3, ...
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // remove diacritics (č→c, š→s, ž→z, etc.)
    .replace(/[^a-z0-9]/g, '') // keep only alphanumeric
    .slice(0, 50);
}

export function baseUsername(firstName: string, lastName: string): string {
  const first = slugify(firstName) || 'user';
  const last = slugify(lastName) || 'name';
  return `${first}.${last}`;
}

export async function generateUniqueUsername(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  let suffix = 0;

  while (await exists(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
}
