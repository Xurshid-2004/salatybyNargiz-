import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: true, // ngrok manzili uchun
    // Bitta ngrok tunnel yetadi: /api va /uploads so'rovlari backendga uzatiladi
    proxy: {
      '/api': { target: backend, xfwd: true },
      '/uploads': { target: backend, xfwd: true },
    },
  },
});
