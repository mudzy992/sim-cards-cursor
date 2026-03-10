import { useEffect, useState } from 'react';
import { Image } from 'antd';
import { installationRecordsApi } from '@/api/installation-records.api';

type RecordPhotoImageProps = {
  path: string;
  alt?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export function RecordPhotoImage({
  path,
  alt = 'Fotografija',
  width = 120,
  height = 120,
  style,
}: RecordPhotoImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    installationRecordsApi
      .getPhotoBlob(path)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setError(false);
      })
      .catch(() => {
        setError(true);
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (error) {
    return (
      <div
        style={{
          width,
          height,
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          color: '#999',
          fontSize: 12,
        }}
      >
        Greška učitavanja
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div
        style={{
          width,
          height,
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          color: '#999',
        }}
      >
        …
      </div>
    );
  }

  return (
    <Image
      src={objectUrl}
      alt={alt}
      width={width}
      height={height}
      style={{ objectFit: 'cover', borderRadius: 8, ...style }}
    />
  );
}
