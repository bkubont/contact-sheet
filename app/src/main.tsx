import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline + Home Screen install (only on a real web address, not in previews or dev).
if ('serviceWorker' in navigator && location.protocol === 'https:' && !import.meta.env.DEV) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
