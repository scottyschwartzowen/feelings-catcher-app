const STATIC_CACHE = "feelings-catcher-v1";
const APP_SHELL_CACHE = `${STATIC_CACHE}-shell`;

// Files needed for the app to load and function with no connection.
const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/css/materialize.min.css",
  "/js/materialize.min.js",
  "/js/ui.js",
  "/manifest.json",
  "/images/icons/icon-192.png",
  "/images/icons/maskable-512.png",
  "/pages/offline.html", // simple fallback page
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
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("feelings-catcher-") && key !== APP_SHELL_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response && response.status === 200) {
          const cache = await caches.open(APP_SHELL_CACHE);
          cache.put(request, response.clone()); //
        }
        return response;
      } catch (err) {
        if (request.mode === "navigate") {
          return caches.match("/pages/offline.html");
        }
      }
    })(),
  );
});
