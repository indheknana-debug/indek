// Service worker Catatan Keuangan Indek: membuat aplikasi cepat dibuka dan bisa dipakai tanpa internet.
// Naikkan VERSION setiap kali file aplikasi diubah, supaya HP mengambil versi baru.
const VERSION = "indek-v34";
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

// Ketuk notifikasi: buka Indek di menu Rencana.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ("focus" in c) { if (c.navigate) c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});

// Pengingat di latar belakang (Chrome Android untuk aplikasi yang terpasang).
self.addEventListener("periodicsync", e => { if (e.tag === "indek-pengingat") e.waitUntil(remindFromDb()); });
function idbAll(db, store) { return new Promise(ok => { try { const r = db.transaction(store, "readonly").objectStore(store).getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); } catch (e) { ok([]); } }); }
async function remindFromDb() {
  const db = await new Promise(ok => { const r = indexedDB.open("indek"); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
  if (!db) return;
  const pj = await idbAll(db, "projects"), tx = await idbAll(db, "tx");
  const live = new Set(tx.filter(t => !t.trashedAt).map(t => String(t.id)));
  const pad = n => String(n).padStart(2, "0"), d = new Date(), today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, cur = today.slice(0, 7);
  const addD = (s, n) => { const x = new Date(s + "T00:00"); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const due = [];
  for (const p of pj.filter(p => p.kind === "plan" && p.due)) {
    let key = "once", date = p.due;
    if (p.repeat) { if (p.due.slice(0, 7) > cur) continue; const [y, m] = cur.split("-").map(Number), last = new Date(y, m, 0).getDate(); key = cur; date = `${cur}-${pad(Math.min(+p.due.slice(8, 10), last))}`; }
    const paid = (p.paid || {})[key];
    if ((paid && live.has(String(paid))) || (p.skip || {})[key]) continue;
    if (addD(date, -(p.remind || 0)) > today) continue;
    due.push({ p, key, date });
  }
  for (const o of due.slice(0, 5)) {
    const name = o.p.title || o.p.cat, late = o.date < today;
    await self.registration.showNotification((late ? "Terlambat: " : "Pengingat bayar: ") + name, {
      body: `Rp ${Number(o.p.amount).toLocaleString("id-ID")} · jatuh tempo ${o.date}`,
      tag: o.p.id + "|" + o.key, icon: "icon-192.png", badge: "favicon-32.png", data: { url: "./#rencana" }
    });
  }
}
