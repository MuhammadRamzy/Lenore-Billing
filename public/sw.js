const CACHE_NAME = "lenore-pos-cache-v1";
const OFFLINE_URLS = [
  "/dashboard",
  "/login",
  "/logo.png",
  "/manifest.json"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Optimized Stale-While-Revalidate for assets, Network-First for HTML/pages)
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and skip internal firebase/firestore sockets
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("firestore.googleapis.com") ||
    event.request.url.includes("/_next/webpack-hmr") ||
    event.request.url.includes("chrome-extension://")
  ) {
    return;
  }

  const url = new URL(event.request.url);

  // Check if it is a static bundle/asset
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".css") ||
    (url.pathname.endsWith(".js") && !url.pathname.includes("sw.js"));

  if (isStaticAsset) {
    // Cache-First with Stale-While-Revalidate in background
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch fresh copy in the background to update the cache
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy);
            });
          }
          return networkResponse;
        });
      })
    );
  } else {
    // Network-First with Cache Fallback for dynamic pages
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful basic HTML page responses; skip API routes
          if (
            response &&
            response.status === 200 &&
            response.type === "basic" &&
            !url.pathname.startsWith("/api/")
          ) {
            const cacheCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (event.request.mode === "navigate") {
              return caches.match("/dashboard");
            }
          });
        })
    );
  }
});
