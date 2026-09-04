import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// One-time cleanup: unregister old PWA service workers and clear stale caches
// Uses sessionStorage so it only runs once per browser session
if ('serviceWorker' in navigator) {
  if (!sessionStorage.getItem('sw_cleaned')) {
    sessionStorage.setItem('sw_cleaned', '1');

    // Unregister ALL old service workers
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });

    // Clear ALL caches (old PWA workbox caches)
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
