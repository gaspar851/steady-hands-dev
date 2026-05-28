// Minimal pass-through service worker. Exists only to satisfy PWA install
// criteria. Does NOT intercept responses on failure — let the browser show
// its own trusted error UI instead of an opaque Response.error().
const VERSION = "v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up any caches from older SW versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle same-origin GETs; let everything else go straight to network.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Pass through. No catch — browser handles network errors with trusted UI.
  event.respondWith(fetch(req));
});
