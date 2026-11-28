/* TournamentsNP service worker: lets the site be installed as an app. It does not cache anything, so updates always show immediately. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
