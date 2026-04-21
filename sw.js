// Service Worker untuk PWA Pro-Tama Finance
const CACHE_NAME = 'protama-cache-v1';

// Install Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Aktifkan Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Strategi Network-First: Selalu ambil data terbaru dari internet, 
// biar kalau lo update codingan di GitHub, webnya langsung berubah.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
