// Doing — the smallest service worker that lets older Android Chrome versions install the app
// ("Add to home screen" as a real app). It caches nothing: every request goes to the network as usual.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') e.respondWith(fetch(e.request));
});
