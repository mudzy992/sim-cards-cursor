import { useEffect, useMemo, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { createAntdTheme } from '@/styles/theme';
import { getAntdLocale, useTranslation } from '@/i18n';
import { initSystemThemeListener, useThemeStore } from '@/store/theme.store';

export function AntdLocaleBridge({ children }: { children: ReactNode }) {
  const { language } = useTranslation();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const density = useThemeStore((s) => s.density);

  useEffect(() => {
    initSystemThemeListener();
  }, []);

  const themeConfig = useMemo(
    () => createAntdTheme(resolvedTheme, density),
    [resolvedTheme, density],
  );

  return (
    <ConfigProvider theme={themeConfig} locale={getAntdLocale(language)}>
      {children}
    </ConfigProvider>
  );
}
