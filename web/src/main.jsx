import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import { AppProvider } from './lib.jsx';
import App from './App.jsx';
import './styles.css';

// Portfolio photos are hotlinked; if one fails to load, show a branded placeholder instead.
const FALLBACK = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b2347"/><stop offset="1" stop-color="#b7613f"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><g transform="translate(176 126) scale(.9)" fill="#f6d3c2" opacity=".55"><circle cx="27" cy="27" r="9"/><circle cx="27" cy="27" r="22" fill="none" stroke="#f6d3c2" stroke-width="4"/></g></svg>'
);
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && !img.dataset.fallback && !img.closest('.leaflet-container')) {
    img.dataset.fallback = '1';
    img.src = FALLBACK;
  }
}, true);

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <App />
  </AppProvider>
);
