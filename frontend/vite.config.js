var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import packageJson from './package.json';
var appVersion = packageJson.version;
var appBuildDate = (_a = process.env.APP_BUILD_DATE) !== null && _a !== void 0 ? _a : new Date().toISOString();
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
});
