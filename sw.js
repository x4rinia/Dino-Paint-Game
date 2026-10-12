// Dino Draw Your Game – Standalone Offline Service Worker (v2.17)
const CACHE_NAME = "dino-draw-cache-v2-17";

// Grundlegende statische Ressourcen, die beim Installieren vorgeladen werden
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[ServiceWorker] Pre-caching Core-Ressourcen...");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[ServiceWorker] Pre-cache fehlgeschlagen (wird zur Laufzeit gecacht):", err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log("[ServiceWorker] Lösche veralteten Cache:", name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nur GET-Anfragen cachen; Browser-Erweiterungen (chrome-extension://) ignorieren
  if (req.method !== "GET" || !req.url.startsWith("http")) {
    return;
  }

  // 1. Navigation (HTML-Seitenaufruf): Network-First mit Cache-Fallback (Sofortiger Offline-Start!)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
          }
          return networkRes;
        })
        .catch(async () => {
          // Offline-Modus: Lade gecachtes index.html
          const cached = await caches.match("./index.html");
          if (cached) return cached;
          return caches.match("./");
        })
    );
    return;
  }

  // 2. Statische Assets (JS, CSS, Bilder, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        // Hintergrund-Update für zukünftige Starts
        fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
            }
          })
          .catch(() => {});
        return cachedRes;
      }

      // Nicht im Cache: Vom Netzwerk laden und im Cache ablegen
      return fetch(req)
        .then((networkRes) => {
          if (!networkRes || networkRes.status !== 200) {
            return networkRes;
          }
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return networkRes;
        })
        .catch(() => {
          // Wenn Offline und Datei nicht im Cache ist, gib leere oder Standard-Antwort zurück
          return new Response("", { status: 408, statusText: "Offline" });
        });
    })
  );
});
