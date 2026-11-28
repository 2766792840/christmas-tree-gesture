import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 8782, host: '127.0.0.1' },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1600
  }
});
