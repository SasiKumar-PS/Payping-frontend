self.addEventListener('install', (event) => {
    // Skip waiting so the service worker activates immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Claim clients to immediately control the page
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Respond to all fetch events to satisfy PWA installability criteria
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('PayPing is currently offline.');
        })
    );
});
