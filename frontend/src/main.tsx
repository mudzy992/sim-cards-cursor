import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import App from './App';
import { antdTheme } from './styles/theme';
import { I18nProvider, useTranslation, getAntdLocale } from './i18n';
import './styles/index.css';
import './styles/antd-overrides.css';

const queryClient = new QueryClient();

/** Bridges the active app language into Ant Design's ConfigProvider locale. */
function AntdLocaleBridge({ children }: { children: React.ReactNode }) {
  const { language } = useTranslation();
  return (
    <ConfigProvider theme={antdTheme} locale={getAntdLocale(language)}>
      {children}
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <AntdLocaleBridge>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AntdLocaleBridge>
    </I18nProvider>
  </React.StrictMode>,
);
