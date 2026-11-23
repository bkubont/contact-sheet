import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/outfit/wght.css';
import '@fontsource-variable/fraunces/wght.css';
import './styles.css';
import App from './App';
import { Sync } from './lib/sync';
import { applyAppearance } from './lib/theme';
import { installPaletteCss } from './lib/palette';

applyAppearance();
installPaletteCss();

Sync.startSync();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW register failed', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
