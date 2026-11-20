import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import App from './App';
import { I18nProvider } from './i18n';
import { AntdLocaleBridge } from './components/layout/AntdLocaleBridge';
import './styles/index.css';
import './styles/antd-overrides.css';

const queryClient = new QueryClient();

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
