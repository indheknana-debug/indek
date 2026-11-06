// Service worker Catatan Keuangan Indek: membuat aplikasi cepat dibuka dan bisa dipakai tanpa internet.
// Naikkan VERSION setiap kali file aplikasi diubah, supaya HP mengambil versi baru.
const VERSION = "indek-v29";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png"];
const CDN = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  // Versi baru disiapkan di belakang layar; aplikasi yang sedang dibuka tidak diganggu.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "indek-cdn").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Halaman meminta versi baru dipakai saat pengguna mengetuk "Perbarui".
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pustaka dan font dari CDN: ambil dari cache dulu, versinya sudah dikunci.
  if (CDN.includes(url.hostname)) {
    e.respondWith(caches.open("indek-cdn").then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // File aplikasi: tampilkan langsung dari cache (cepat), lalu perbarui cache di belakang layar.
  if (url.origin === self.location.origin) {
    const key = req.mode === "navigate" ? "./index.html" : req;
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(key, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || (await c.match("./index.html")) || Response.error();
    }));
  }
  // Permintaan ke Supabase tidak disentuh: data dikelola oleh aplikasi sendiri.
});
