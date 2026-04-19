export type AppSettingValueType = 'boolean' | 'number' | 'enum' | 'string' | 'secret';

export type AppSettingManifestEntry = {
  key: string;
  groupId: string;
  groupTitle: string;
  groupDescription?: string;
  label: string;
  description: string;
  valueType: AppSettingValueType;
  enumOptions?: { value: string; label: string }[];
  confirmDangerousChange?: { title: string; content: string };
};

const M = {
  mobile: {
    groupId: 'mobile',
    groupTitle: 'Mobile',
    groupDescription:
      'Postavke za mobilnu aplikaciju (queue, GPS, push kanal). Globalni push on/off je u sekciji Notifikacije; ovdje je kompatibilnost `mobile.push.enabled` za `/settings/mobile-push`.',
  },
  uploads: {
    groupId: 'uploads',
    groupTitle: 'Upload',
    groupDescription:
      'Limiti i MIME tipovi za fotografije i dokumente. Backend `PhotoUploadService` koristi `uploads.maxPhotoSizeMb` i `uploads.allowedPhotoMimeTypes` za slike zapisnika.',
  },
} as const;

export const APP_SETTINGS_MANIFEST: AppSettingManifestEntry[] = [
  {
    ...M.mobile,
    key: 'mobile.offlineQueue.enabled',
    label: 'Offline queue',
    description:
      'Uključuje lokalni red čekanja akcija kada nema mreže (kad klijent to podrži).',
    valueType: 'boolean',
  },
  {
    ...M.mobile,
    key: 'mobile.offlineQueue.maxItems',
    label: 'Maks. stavki u offline redu',
    description: 'Gornja granica broja akcija u redu prije odbijanja ili forsiranog sync-a.',
    valueType: 'number',
  },
  {
    ...M.mobile,
    key: 'mobile.requireGpsForRecord',
    label: 'Obavezan GPS za zapisnik',
    description: 'Ako je uključeno, klijent bi trebao zahtijevati koordinate prije kreiranja zapisa.',
    valueType: 'boolean',
  },
  {
    ...M.mobile,
    key: 'mobile.push.testMode',
    label: 'Push test režim',
    description: 'Namjena za QA: označava test push poruke (kad klijent to koristi).',
    valueType: 'boolean',
  },
  {
    ...M.mobile,
    key: 'mobile.push.defaultChannel',
    label: 'Podrazumijevani push kanal',
    description: 'Tema/topic za push (approval / records / system).',
    valueType: 'enum',
    enumOptions: [
      { value: 'approval', label: 'Approval' },
      { value: 'records', label: 'Records' },
      { value: 'system', label: 'System' },
    ],
  },
  {
    ...M.mobile,
    key: 'mobile.push.enabled',
    label: 'Mobile push (kompatibilnost)',
    description:
      'Mora biti uključeno zajedno s globalnim pushom u Notifikacijama da bi mobilni klijenti registrovali tokene.',
    valueType: 'boolean',
    confirmDangerousChange: {
      title: 'Isključiti mobile push?',
      content:
        'Mobilne aplikacije neće registrovati push tokene dok ovo ne bude ponovo uključeno. Nastaviti?',
    },
  },
  {
    ...M.uploads,
    key: 'uploads.maxPhotoSizeMb',
    label: 'Maks. veličina fotografije (MB)',
    description: 'Backend validacija uploada fotografija zapisnika (uz usklađivanje s reverse proxy limitima).',
    valueType: 'number',
  },
  {
    ...M.uploads,
    key: 'uploads.allowedPhotoMimeTypes',
    label: 'Dozvoljeni MIME tipovi za slike',
    description: 'Lista odvojena zarezom, npr. image/jpeg,image/png.',
    valueType: 'string',
  },
  {
    ...M.uploads,
    key: 'uploads.maxDocumentSizeMb',
    label: 'Maks. veličina dokumenta (MB)',
    description: 'Za PDF/Word/Excel upload (kad se koristi u aplikaciji).',
    valueType: 'number',
  },
  {
    ...M.uploads,
    key: 'uploads.allowedDocumentMimeTypes',
    label: 'Dozvoljeni MIME tipovi za dokumente',
    description: 'Lista odvojena zarezom (PDF, Office…).',
    valueType: 'string',
  },
];

export const MANIFEST_KEYS = new Set(APP_SETTINGS_MANIFEST.map((e) => e.key));

export const MANIFEST_GROUP_ORDER = ['mobile', 'uploads'] as const;

export function getManifestEntry(key: string): AppSettingManifestEntry | undefined {
  return APP_SETTINGS_MANIFEST.find((e) => e.key === key);
}
