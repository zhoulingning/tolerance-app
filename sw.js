// SW.JS - the "service worker": a small helper the phone keeps running in the
// background. It saves a copy of every app file on the phone, so the app opens and
// works with no network at all.
//
// How updates reach the phones: the app always opens instantly from the saved copy,
// and at the same time quietly downloads the newest files. So after you upload new
// files, a phone shows them the NEXT time the app is opened (with internet).
//
// If you ever add a new file to the app, add it to FILES and raise VERSION by one.

const VERSION = 1;
const CACHE = "tolerance-app-v" + VERSION;
const FILES = [
  "./",
  "./index.html",
  "./assembly.html",
  "./stackup.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// 1. Install: save every file on the phone.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate: delete copies saved by older versions.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// 3. Every file request: answer from the saved copy right away, and refresh that
//    copy from the internet in the background ("stale-while-revalidate").
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const saved = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then(response => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);   // offline: that's fine, we have the saved copy
      if (saved) {
        event.waitUntil(fresh);   // let the refresh finish in the background
        return saved;
      }
      // Not saved yet (first visit): wait for the network, or fall back to the start page.
      return (await fresh) || (await cache.match("./index.html")) || Response.error();
    })
  );
});
