const CACHE_NAME = "img-cache-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.hostname !== "img.xar.sh") return;

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
      )
    )
  );
});
