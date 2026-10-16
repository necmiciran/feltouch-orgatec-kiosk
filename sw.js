// Offline cache: everything (code + 5 recordings) is stored on first load, then served from the cache.
const CACHE = "feltouch-kiosk-20261014s";
const FILES = [
  "./", "index.html", "styles.css", "app.js", "calc.js", "dsp.js", "fon.js", "qr.js", "room3d.js",
  "data/i18n.js", "data/catalog.js", "data/scenarios.js", "manifest.webmanifest",
  "assets/icon-180.png", "assets/icon-512.png",
  "assets/audio/airport.wav", "assets/audio/classroom.wav", "assets/audio/office.wav",
  "assets/audio/restaurant.wav", "assets/audio/waiting-area.wav"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).catch(() => caches.match("index.html"))));
});
