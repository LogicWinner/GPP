// GPP — PresFlexi · service worker (v9.0). Solo guarda el programa, nunca tus datos.
// - La página (index.html): primero la red, para no quedarte nunca con una versión vieja; sin conexión, la última guardada.
// - Iconos y manifest: los guardados (cambian de versión con la app).
// - Letras de Google Fonts: se guardan la primera vez para verse igual sin conexión.
// - Todo lo demás (logotipos de los bancos, callejero, etc.) no se toca. Tu archivo de datos no pasa por aquí:
//   la app lo lee y lo guarda directamente en tu carpeta de Google Drive del ordenador.
const VERSION = 'gpp-9.16.0';
const FUENTES = 'gpp-fuentes';
const PROGRAMA = ['./', './index.html', './manifest.webmanifest', './iconos/icono-192.png', './iconos/icono-512.png',
  './iconos/icono-maskable-512.png', './iconos/apple-touch-icon.png', './iconos/favicon-32.png'];

self.addEventListener('install', (e) => {
  // uno a uno: si un archivo falla (p. ej. sin conexión a medias), se guardan los demás y el service worker se instala igual
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(PROGRAMA.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('gpp-') && k !== VERSION && k !== FUENTES).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const conTiempo = (p, ms) => new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error('tiempo')), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); }); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // letras: lo guardado al momento y se renueva por detrás
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FUENTES).then(async (c) => {
      const guardada = await c.match(req);
      const red = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => guardada);
      return guardada || red;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/firma.json')) return; // siempre a la red (versión nueva; v9.3: dirección del script de firma)

  // la página: primero la red (revalidando la caché HTTP); sin conexión o si tarda más de 6 s, la guardada
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await conTiempo(fetch(req, { cache: 'no-cache' }), 6000);
        if (r.ok) c.put('./index.html', r.clone());
        return r;
      } catch {
        return (await c.match('./index.html')) || (await caches.match(req)) || new Response('GPP necesita conexión la primera vez que se abre.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // iconos y manifest: lo guardado y, si no está, la red
  e.respondWith(caches.match(req).then((g) => g || fetch(req).then((r) => {
    if (r.ok) caches.open(VERSION).then((c) => c.put(req, r.clone()));
    return r;
  })));
});

// clic en un aviso de pagos: abre GPP (o la trae al frente si ya está abierta)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
