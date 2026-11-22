import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works from GitHub Pages, Hostinger, or a subfolder.
export default defineConfig({
  plugins: [react()],
  base: './',
});
