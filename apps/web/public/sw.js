// Change this version whenever any offline asset changes. Never cache runtime data.
const CACHE = "aarili-offline-v1";
const ASSETS = [
  "/offline.html",
  "/pwa/offline.css",
  "/pwa/latin.woff2",
  "/pwa/tamil.woff2",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        for (const path of ASSETS) {
          const response = await fetch(path, {
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
          });
          if (!response.ok) throw new Error("Offline asset unavailable");
          await cache.put(path, response);
        }
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("aarili-offline-") && name !== CACHE)
          await caches.delete(name);
      }
      const cache = await caches.open(CACHE);
      const allowed = new Set(
        ASSETS.map((path) => new URL(path, self.location.origin).href),
      );
      for (const request of await cache.keys()) {
        if (!allowed.has(request.url)) await cache.delete(request);
      }
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Explicit public document routes only. API, files, signed URLs, RSC and
  // arbitrary navigations never receive HTML masquerading as a private response.
  const documentRoute = [
    "/",
    "/owner",
    "/connections",
    "/setup",
    "/sign-in",
    "/recovery",
    "/reset-password",
    "/reauthenticate",
  ].includes(url.pathname);
  if (request.mode === "navigate" && documentRoute && !url.search) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match("/offline.html")) ?? Response.error();
      }),
    );
  } else if (!url.search && ASSETS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (
          (await cache.match(url.pathname)) ??
          fetch(request, { cache: "no-store" })
        );
      })(),
    );
  }
});
