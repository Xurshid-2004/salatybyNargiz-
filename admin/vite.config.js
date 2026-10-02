import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://127.0.0.1:3000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Serverda Admin Panel https://domen/admin/ manzilida ochiladi
  base: command === 'build' ? '/admin/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: backend, xfwd: true },
      '/uploads': { target: backend, xfwd: true },
    },
  },
}));
