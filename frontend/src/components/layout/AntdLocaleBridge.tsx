import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { antdTheme } from '@/styles/theme';
import { getAntdLocale, useTranslation } from '@/i18n';

export function AntdLocaleBridge({ children }: { children: ReactNode }) {
  const { language } = useTranslation();
  return (
    <ConfigProvider theme={antdTheme} locale={getAntdLocale(language)}>
      {children}
    </ConfigProvider>
  );
}
