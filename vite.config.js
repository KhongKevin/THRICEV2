import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // This single-page app has no client-side routes. Keep every asset relative.
  base: './',
});
