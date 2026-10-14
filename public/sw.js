// Service Worker pour Jangora PWA
const CACHE_NAME = "jangora-v4";
const STATIC_ASSETS = [
  "/",
  "/chat",
  "/favicon.ico",
  "/emblem-light-square.png",
  "/emblem-dark-square.png",
  "/emblem-light-trans.png",
  "/emblem-dark-trans.png",
  "/icon.png",
  "/icon-192.png",
  "/apple-icon.png",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Network first, fallback cache for static resources
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
