import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import packageJson from '../package.json';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.versionLabel || 'v' + packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
