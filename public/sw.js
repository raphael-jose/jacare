// CLEANUP SERVICE WORKER (v2)
// Replaces the old vite-plugin-pwa workbox service worker.
// Job: delete every cache, unregister itself, and reload all open tabs
// so the browser fetches fresh files from the server.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
  );
});

// Do not intercept any network requests — cleanup only.
self.addEventListener('fetch', () => {});
