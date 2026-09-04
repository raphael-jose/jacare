// registerSW.js — replaced by cleanup service worker logic.
// Old cached builds of this PWA referenced this file; keep it around so the
// cleanup service worker (sw.js) gets registered one final time.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
