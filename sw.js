const STATIC_CACHE = "feelings-catcher-static-v1";
const DYNAMIC_CACHE = "feelings-catcher-dynamic-v1";
const CACHE_PREFIX = "feelings-catcher-";
const APP_SHELL_CACHE = `${STATIC_CACHE}-shell`;
const CURRENT_CACHES = [APP_SHELL_CACHE, DYNAMIC_CACHE];

// Files needed for the app to load and function with no connection.
const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/pages/offline.html", // simple fallback page
  "/manifest.json",
  "/css/styles.css",
  "/css/materialize.min.css",
  "/js/materialize.min.js",
  "/js/app.js",
  "/js/ui.js",
  "/images/icons/icon-192.png",
  "/images/icons/icon-256.png",
  "/images/icons/icon-512.png",
  "/images/icons/maskable-512.png",
];

// Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const oldCaches = keys.filter(
          (key) =>
            key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(key),
        );
        return Promise.all(oldCaches.map((key) => caches.delete(key)));
      })
      .then(() => self.clients.claim()),
  );
});

// Helper functions
function isAPIRequested(url) {
  return (
    url.origin === self.location.origin && url.pathname.startsWith("/api/")
  );
}

function isApprovedExternalAsset(url) {
  return [
    "cdnjs.cloudflare.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
  ].includes(url.hostname);
}

function shouldRuntimeCache(request, url) {
  const cacheableDestinations = new Set([
    "document",
    "style",
    "script",
    "image",
    "font",
  ]);
  if (!cacheableDestinations.has(request.destination)) {
    return false;
  }
  return url.origin === self.location.origin || isApprovedExternalAsset(url);
}

// Cache first helper function
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const url = new URL(request.url);
    if (
      shouldRuntimeCache(request, url) &&
      (response.ok || response.type === "opaque")
    ) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/pages/offline.html");
      if (offlinePage) return offlinePage;
    }
    return new Response("Resource unavailable while offline.", {
      status: 504,
      statusText: "offline",
    });
  }
}

// Fetch
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isAPIRequested(url)) {
    event.respondWith(fetch(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
