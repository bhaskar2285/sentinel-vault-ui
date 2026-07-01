import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // loadEnv reads .env / .env.local files (process.env alone does NOT pick them up).
  const env = loadEnv(mode, __dirname, '');
  const apiTarget = env.VITE_API_TARGET ?? process.env.VITE_API_TARGET ?? 'http://localhost:8090';
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5175,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
