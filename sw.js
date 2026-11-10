/* Daniel Scanner Pro – service worker
   Caches the app shell and receives files shared from other apps
   (Web Share Target) into the "scanpro-share" cache that index.html reads. */

const CACHE = 'dsp-shell-v1';
const SHARE_CACHE = 'scanpro-share';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== SHARE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Web Share Target: POST with multipart files
  if (event.request.method === 'POST' && url.searchParams.has('shared')) {
    event.respondWith(handleShare(event.request));
    return;
  }

  // Network-first for navigations; cache-first for same-origin assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request).catch(() => r))
  );
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);

    // Clear previous share batch so the page only sees the new files
    const old = await cache.keys();
    await Promise.all(old.map(k => cache.delete(k)));

    const files = form.getAll('files').filter(f => f && f.size);
    // Some browsers also put a single file under other names
    if (!files.length) {
      for (const key of ['file', 'media', 'document', 'image']) {
        const f = form.get(key);
        if (f && f.size) files.push(f);
      }
    }

    let i = 0;
    for (const file of files) {
      const name = (file.name || `shared-${++i}`).replace(/[^\w.\- ()[\]]+/g, '_');
      const headers = new Headers({
        'Content-Type': file.type || 'application/octet-stream',
        'X-Name': encodeURIComponent(name),
        'Content-Length': String(file.size)
      });
      // Unique request URL so multiple files don't overwrite each other
      const req = new Request(`./share-item/${Date.now()}-${i++}-${name}`, {
        method: 'GET',
        headers
      });
      await cache.put(req, new Response(file, { headers }));
    }

    // Redirect the share request to the app so takeShared() runs
    return Response.redirect('./?shared=1', 303);
  } catch (e) {
    return Response.redirect('./?shared=1&error=1', 303);
  }
}
