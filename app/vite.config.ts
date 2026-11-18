import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' so the built app works from any folder (Hostinger public_html, a subfolder).
// `--mode preview` builds everything into one HTML file for sharing a quick preview link.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'preview' ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: mode === 'preview' ? { outDir: 'preview-dist', assetsInlineLimit: 100_000_000 } : {},
}));
