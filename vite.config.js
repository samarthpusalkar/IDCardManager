import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawAllowedHosts = (env.ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  // Vite accepts ".example.com" to allow all subdomains.
  const allowedHosts = rawAllowedHosts.map((host) =>
    host.startsWith('*.') ? `.${host.slice(2)}` : host
  );

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 9901,
      ...(allowedHosts.length ? { allowedHosts } : {}),
      proxy: {
        '/api': {
          target: 'http://localhost:9902',
          changeOrigin: true,
        },
      },
    },
  };
});
