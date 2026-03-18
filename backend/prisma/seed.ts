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

type SeedSetting = {
  key: string;
  value: string;
  description: string;
};

const DEFAULT_APP_SETTINGS: SeedSetting[] = [
  // Notifications
  {
    key: 'notifications.enabled',
    value: 'true',
    description:
      'Globalni master toggle za notifikacije (web + mobile). Ako je isključeno, server ne bi trebao slati niti emitovati notifikacije.',
  },
  {
    key: 'notifications.websocket.enabled',
    value: 'true',
    description:
      'Kontroliše da li je WebSocket (Socket.IO) kanal za real-time notifikacije aktivan. Ako je isključeno, klijent treba preći na polling.',
  },
  {
    key: 'notifications.pollingIntervalSeconds',
    value: '30',
    description:
      'Fallback interval (u sekundama) za REST polling notifikacija kada WebSocket nije dostupan ili je isključen.',
  },
  {
    key: 'notifications.showBadgeCount',
    value: 'true',
    description:
      'Da li prikazivati badge broj nepročitanih notifikacija u UI-u (npr. zvono).',
  },
  {
    key: 'notifications.mobile.enabled',
    value: 'true',
    description:
      'Da li je notifikacijski sistem aktivan za mobilnu aplikaciju (generisanje i slanje mobile notifikacija).',
  },
  {
    key: 'notifications.mobile.pushEnabled',
    value: 'true',
    description:
      'Da li su push notifikacije dozvoljene za mobilnu aplikaciju (Expo/FCM/APNs). Ako je isključeno, klijent ne treba slati push tokene.',
  },

  // Email
  {
    key: 'email.enabled',
    value: 'true',
    description:
      'Globalni master toggle za slanje emailova. Ako je isključeno, server neće slati nikakve outbound emailove.',
  },
  // SMTP transport (replaces .env SMTP_* on production)
  {
    key: 'smtp.provider',
    value: 'custom',
    description:
      'Izbor SMTP providera. Vrijednosti: google, office365, custom, disabled. Provider postavlja preporučene default-e za host/port/secure.',
  },
  {
    key: 'smtp.host',
    value: '',
    description:
      'SMTP host. Ako je prazno, koristi se default za izabrani provider (google/office365) ili localhost za custom.',
  },
  {
    key: 'smtp.port',
    value: '587',
    description:
      'SMTP port. Za Google tipično 465 (secure), za Office365 587 (STARTTLS).',
  },
  {
    key: 'smtp.secure',
    value: 'false',
    description:
      'Da li koristiti SMTP preko TLS-a (true=SMTPS, npr. port 465). Za STARTTLS (port 587) obično je false uz requireTLS=true.',
  },
  {
    key: 'smtp.requireTLS',
    value: 'true',
    description:
      'Da li forsirati STARTTLS/requireTLS. Preporučeno true za Office365 i većinu modernih SMTP servera.',
  },
  {
    key: 'smtp.user',
    value: '',
    description:
      'SMTP username (najčešće email adresa). Za Google obično mora odgovarati From adresi.',
  },
  {
    key: 'smtp.pass',
    value: '',
    description:
      'SMTP password (ili App Password). Sigurnost: ova vrijednost se čuva u bazi; ograniči pristup SYSTEM_ADMIN i koristi app-password gdje je moguće.',
  },
  {
    key: 'smtp.fromName',
    value: 'SIM Tracker',
    description:
      'Display name za From header. Ako je provider Google i smtp.user postoji, sistem može koristiti smtp.user kao From radi kompatibilnosti.',
  },
  {
    key: 'smtp.fromAddress',
    value: 'no-reply@example.com',
    description:
      'From email adresa. Mora biti dozvoljena na SMTP serveru (SPF/DKIM) i često mora odgovarati smtp.user (posebno Gmail).',
  },
  {
    key: 'smtp.replyTo',
    value: '',
    description:
      'Opcionalni Reply-To email. Ako je prazno, ne postavlja se.',
  },
  {
    key: 'email.fromName',
    value: 'SIM Tracker',
    description:
      'Naziv pošiljaoca (display name) koji se prikazuje u email klijentima.',
  },
  {
    key: 'email.fromAddress',
    value: 'no-reply@example.com',
    description:
      'Email adresa pošiljaoca. Mora biti usklađena sa SMTP konfiguracijom i SPF/DKIM pravilima domene.',
  },
  {
    key: 'email.replyTo',
    value: '',
    description:
      'Opcionalni Reply-To. Ako je prazno, koristi se fromAddress ili default mailer konfiguracija.',
  },
  {
    key: 'email.sendOnApprove',
    value: 'false',
    description:
      'Ako je uključeno, sistem automatski šalje email obavijest kada zapisnik bude odobren.',
  },
  {
    key: 'email.sendOnActivateSep',
    value: 'false',
    description:
      'Ako je uključeno, sistem automatski šalje email obavijest kada zapisnik pređe u status aktivacije u SEP.',
  },

  // Installation records
  {
    key: 'installationRecords.autoSubmitForApproval',
    value: 'false',
    description:
      'Ako je uključeno, novi zapisnik se automatski šalje na odobrenje odmah nakon kreiranja.',
  },
  {
    key: 'installationRecords.allowSelfApproval',
    value: 'true',
    description:
      'Da li korisnik koji je kreirao zapisnik smije odobriti isti zapisnik ako je u approval grupi. Preporuka: true za manja okruženja, false za strožije kontrole.',
  },
  {
    key: 'installationRecords.maxPhotosPerRecord',
    value: '5',
    description:
      'Maksimalan broj fotografija koje se mogu attachovati na jedan zapisnik.',
  },
  {
    key: 'installationRecords.requirePhotoForApproval',
    value: 'false',
    description:
      'Ako je uključeno, zapisnik ne može biti odobren bez minimalno jedne fotografije.',
  },

  // Uploads
  {
    key: 'uploads.maxPhotoSizeMb',
    value: '5',
    description:
      'Maksimalna veličina jedne fotografije (MB). Vrijednost treba biti usklađena sa backend upload limitima i reverse proxy limitima.',
  },
  {
    key: 'uploads.allowedPhotoMimeTypes',
    value: 'image/jpeg,image/png',
    description:
      'Lista dozvoljenih MIME tipova za fotografije, odvojeno zarezom. Sve ostalo se odbija.',
  },
  {
    key: 'uploads.maxDocumentSizeMb',
    value: '10',
    description:
      'Maksimalna veličina jednog dokumenta (MB) za upload (PDF/Word/Excel).',
  },
  {
    key: 'uploads.allowedDocumentMimeTypes',
    value:
      'application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description:
      'Lista dozvoljenih MIME tipova za dokumente, odvojeno zarezom.',
  },

  // Security / rate limiting
  {
    key: 'security.rateLimit.enabled',
    value: 'true',
    description:
      'Uključuje globalni rate limiting (throttling). Preporučeno: true u produkciji.',
  },
  {
    key: 'security.rateLimit.windowSeconds',
    value: '60',
    description:
      'Trajanje rate limit prozora u sekundama (npr. 60s).',
  },
  {
    key: 'security.rateLimit.maxRequests',
    value: '100',
    description:
      'Maksimalan broj zahtjeva po prozoru (windowSeconds) po klijentu.',
  },

  // Dashboard
  {
    key: 'dashboard.defaultTimeRange',
    value: '7_DAYS',
    description:
      'Podrazumijevani vremenski opseg za dashboard (npr. TODAY, 7_DAYS, 30_DAYS).',
  },
  {
    key: 'dashboard.showDemountTasksWidget',
    value: 'true',
    description:
      'Ako je uključeno, prikazuje se widget za demontažne zadatke na dashboardu.',
  },

  // Tours
  {
    key: 'tour.web.enabled',
    value: 'true',
    description:
      'Uključuje onboarding tour u web aplikaciji.',
  },
  {
    key: 'tour.mobile.enabled',
    value: 'true',
    description:
      'Uključuje mini-tour / onboarding u mobilnoj aplikaciji.',
  },

  // Mobile
  {
    key: 'mobile.offlineQueue.enabled',
    value: 'true',
    description:
      'Uključuje offline queue mehanizam na mobilnoj aplikaciji (akcije se čuvaju i šalju kada se vrati konekcija).',
  },
  {
    key: 'mobile.offlineQueue.maxItems',
    value: '50',
    description:
      'Maksimalan broj queued akcija u offline modu prije nego aplikacija počne odbijati nove ili tražiti sync.',
  },
  {
    key: 'mobile.requireGpsForRecord',
    value: 'false',
    description:
      'Ako je uključeno, mobilna aplikacija mora imati GPS koordinate prije kreiranja zapisnika.',
  },
  {
    key: 'mobile.push.testMode',
    value: 'false',
    description:
      'Ako je uključeno, push se tretira kao test režim (namijenjeno za QA).',
  },
  {
    key: 'mobile.push.defaultChannel',
    value: 'records',
    description:
      'Podrazumijevani “kanal”/topic za push poruke (approval/records/system).',
  },

  // Compatibility with backend endpoint /settings/mobile-push
  {
    key: 'mobile.push.enabled',
    value: 'true',
    description:
      'Kompatibilnost: globalni toggle koji koristi backend endpoint /settings/mobile-push. Ako je isključeno, mobilni klijenti ne bi trebali registrovati push tokene.',
  },
];

async function main() {
  console.log(`[seed] DATABASE_URL=${process.env.DATABASE_URL ?? '(missing)'}`);

  let createdSettings = 0;
  let updatedDescriptions = 0;
  for (const s of DEFAULT_APP_SETTINGS) {
    const existing = await prisma.appSetting.findUnique({
      where: { key: s.key },
      select: { key: true, description: true },
    });
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.appSetting.create({
        data: { key: s.key, value: s.value, description: s.description },
      });
      createdSettings += 1;
      // eslint-disable-next-line no-continue
      continue;
    }
    if ((existing.description ?? '').trim() !== s.description.trim()) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.appSetting.update({
        where: { key: s.key },
        data: { description: s.description },
      });
      updatedDescriptions += 1;
    }
  }
  console.log(
    `Seeded app settings: created=${createdSettings}, updated_descriptions=${updatedDescriptions}, total_defaults=${DEFAULT_APP_SETTINGS.length}`,
  );
  const settingsCount = await prisma.appSetting.count();
  console.log(`[seed] app_settings count after seed: ${settingsCount}`);

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
