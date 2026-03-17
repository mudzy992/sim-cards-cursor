import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50);
}

function baseUsername(firstName: string, lastName: string): string {
  const first = slugify(firstName) || 'user';
  const last = slugify(lastName) || 'name';
  return `${first}.${last}`;
}

async function generateUniqueUsername(
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

async function main() {
  const defaultDist = await prisma.distribution.upsert({
    where: { code: 'EDZ' },
    update: {},
    create: { name: 'ED Zenica', code: 'EDZ' },
  });
  await prisma.branch.upsert({
    where: {
      distributionId_code: { distributionId: defaultDist.id, code: 'ZEN' },
    },
    update: {},
    create: {
      distributionId: defaultDist.id,
      name: 'Zenica',
      code: 'ZEN',
    },
  });

  const email = process.env.ADMIN_EMAIL ?? 'admin@simtracker.local';
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const firstName = process.env.ADMIN_FIRST_NAME ?? 'System';
  const lastName = process.env.ADMIN_LAST_NAME ?? 'Admin';
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const base = baseUsername(firstName, lastName);
  const username = await generateUniqueUsername(base, async (candidate: string) => {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    return !!exists;
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      username: username,
      role: UserRole.SYSTEM_ADMIN,
      status: UserStatus.ACTIVE,
      password: passwordHash,
    },
    create: {
      email,
      username,
      password: passwordHash,
      firstName,
      lastName,
      role: UserRole.SYSTEM_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Seeded admin user: ${email} (username: ${username})`);

  const usersWithoutUsername = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, firstName: true, lastName: true },
  });
  for (const u of usersWithoutUsername) {
    const base = baseUsername(u.firstName, u.lastName);
    const newUsername = await generateUniqueUsername(base, async (candidate: string) => {
      const exists = await prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      return !!exists;
    });
    await prisma.user.update({
      where: { id: u.id },
      data: { username: newUsername },
    });
    console.log(`Backfilled username for user ${u.id}: ${newUsername}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
