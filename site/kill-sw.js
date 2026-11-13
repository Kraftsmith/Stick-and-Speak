// Served as /sw.js. Until the site appeared, the game lived at / and registered a service worker there.
// Browsers that still have it fetch this file as its update: it takes over at once and unregisters itself,
// so the site at / is plain pages again. The game's worker now lives at /play/sw.js with the scope /play/.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', ev => ev.waitUntil(self.registration.unregister()));
