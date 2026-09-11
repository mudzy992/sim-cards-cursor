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

type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Builds the app settings manifest with labels/descriptions translated via `t`.
 * This is a function (not a static constant) because the labels are
 * user-facing text and must follow the active language — call it from
 * within a component that has `useTranslation()`.
 */
export function getAppSettingsManifest(t: TFn): AppSettingManifestEntry[] {
  const M = {
    mobile: {
      groupId: 'mobile',
      groupTitle: 'Mobile',
      groupDescription: t('appSettingsManifest.mobileGroupDescription'),
    },
    uploads: {
      groupId: 'uploads',
      groupTitle: t('appSettingsManifest.uploadsGroupTitle'),
      groupDescription: t('appSettingsManifest.uploadsGroupDescription'),
    },
  } as const;

  return [
    {
      ...M.mobile,
      key: 'mobile.offlineQueue.enabled',
      label: t('appSettingsManifest.offlineQueueEnabled.label'),
      description: t('appSettingsManifest.offlineQueueEnabled.description'),
      valueType: 'boolean',
    },
    {
      ...M.mobile,
      key: 'mobile.offlineQueue.maxItems',
      label: t('appSettingsManifest.offlineQueueMaxItems.label'),
      description: t('appSettingsManifest.offlineQueueMaxItems.description'),
      valueType: 'number',
    },
    {
      ...M.mobile,
      key: 'mobile.requireGpsForRecord',
      label: t('appSettingsManifest.requireGpsForRecord.label'),
      description: t('appSettingsManifest.requireGpsForRecord.description'),
      valueType: 'boolean',
    },
    {
      ...M.mobile,
      key: 'mobile.push.testMode',
      label: t('appSettingsManifest.pushTestMode.label'),
      description: t('appSettingsManifest.pushTestMode.description'),
      valueType: 'boolean',
    },
    {
      ...M.mobile,
      key: 'mobile.push.defaultChannel',
      label: t('appSettingsManifest.pushDefaultChannel.label'),
      description: t('appSettingsManifest.pushDefaultChannel.description'),
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
      label: t('appSettingsManifest.pushEnabledCompat.label'),
      description: t('appSettingsManifest.pushEnabledCompat.description'),
      valueType: 'boolean',
      confirmDangerousChange: {
        title: t('appSettingsManifest.pushEnabledCompat.confirmTitle'),
        content: t('appSettingsManifest.pushEnabledCompat.confirmContent'),
      },
    },
    {
      ...M.uploads,
      key: 'uploads.maxPhotoSizeMb',
      label: t('appSettingsManifest.maxPhotoSizeMb.label'),
      description: t('appSettingsManifest.maxPhotoSizeMb.description'),
      valueType: 'number',
    },
    {
      ...M.uploads,
      key: 'uploads.allowedPhotoMimeTypes',
      label: t('appSettingsManifest.allowedPhotoMimeTypes.label'),
      description: t('appSettingsManifest.allowedPhotoMimeTypes.description'),
      valueType: 'string',
    },
    {
      ...M.uploads,
      key: 'uploads.maxDocumentSizeMb',
      label: t('appSettingsManifest.maxDocumentSizeMb.label'),
      description: t('appSettingsManifest.maxDocumentSizeMb.description'),
      valueType: 'number',
    },
    {
      ...M.uploads,
      key: 'uploads.allowedDocumentMimeTypes',
      label: t('appSettingsManifest.allowedDocumentMimeTypes.label'),
      description: t('appSettingsManifest.allowedDocumentMimeTypes.description'),
      valueType: 'string',
    },
  ];
}

/** Language-independent: setting keys only, used to exclude manifest keys from the "other" table. */
export const MANIFEST_KEYS = new Set([
  'mobile.offlineQueue.enabled',
  'mobile.offlineQueue.maxItems',
  'mobile.requireGpsForRecord',
  'mobile.push.testMode',
  'mobile.push.defaultChannel',
  'mobile.push.enabled',
  'uploads.maxPhotoSizeMb',
  'uploads.allowedPhotoMimeTypes',
  'uploads.maxDocumentSizeMb',
  'uploads.allowedDocumentMimeTypes',
]);

/** Language-independent: group ids only, in display order. */
export const MANIFEST_GROUP_ORDER = ['mobile', 'uploads'] as const;

export function getManifestEntry(
  key: string,
  manifest: AppSettingManifestEntry[],
): AppSettingManifestEntry | undefined {
  return manifest.find((e) => e.key === key);
}
