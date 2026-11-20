import { useEffect, useState } from 'react';
import { Image } from 'antd';
import { installationRecordsApi } from '@/api/installation-records.api';
import { useTranslation } from '@/i18n';

type RecordPhotoImageProps = {
  path: string;
  alt?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export function RecordPhotoImage({
  path,
  alt,
  width = 120,
  height = 120,
  style,
}: RecordPhotoImageProps) {
  const { t } = useTranslation();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setObjectUrl(null);
    setError(false);

    installationRecordsApi
      .getPhotoBlob(path)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(url);
          url = null;
          return;
        }
        setObjectUrl(url);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-slate-800/70 text-slate-400 text-xs border border-slate-700"
        style={{ width, height }}
      >
        {t('common.states.error')}
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-slate-800/70 text-slate-400 text-xs border border-slate-700"
        style={{ width, height }}
      >
        …
      </div>
    );
  }

  return (
    <Image
      src={objectUrl}
      alt={alt ?? t('meters.detail.photoLabel')}
      width={width}
      height={height}
      style={{ objectFit: 'cover', borderRadius: 8, ...style }}
    />
  );
}
