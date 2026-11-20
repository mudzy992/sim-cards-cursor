import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import packageJson from './package.json';

const appVersion = packageJson.version;
const appBuildDate = process.env.APP_BUILD_DATE ?? new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_DATE__: JSON.stringify(appBuildDate),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3004,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3003',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const normalized = id.replace(/\\/g, '/');
          if (
            /\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run\/router)\//.test(
              normalized,
            )
          ) {
            return 'vendor-react';
          }
          if (
            /\/node_modules\/(antd|@ant-design\/|rc-[^/]+|@rc-component\/|@babel\/runtime|classnames|@emotion\/)/.test(
              normalized,
            )
          ) {
            return 'vendor-antd';
          }
          if (
            /\/node_modules\/(@tanstack\/react-query|axios|zustand|immer|use-sync-external-store)\//.test(
              normalized,
            )
          ) {
            return 'vendor-data';
          }
          if (
            /\/node_modules\/(socket\.io-client|engine\.io-client|socket\.io-parser|@socket\.io\/)/.test(
              normalized,
            )
          ) {
            return 'vendor-realtime';
          }
          if (/\/node_modules\/dayjs\//.test(normalized)) {
            return 'vendor-dayjs';
          }
          return undefined;
        },
      },
    },
  },
});
