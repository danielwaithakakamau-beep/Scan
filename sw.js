/* Daniel Scanner Pro – service worker
   Receives files shared from other apps (Web Share Target).
   Must intercept the POST so the host never returns 405. */

const CACHE = 'dsp-shell-v2';
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
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE && k !== SHARE_CACHE)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // ---- Web Share Target: never let this POST reach the server ----
  // Matches: /share-target  or  any POST with ?shared=
  const isSharePost =
    event.request.method === 'POST' &&
    (path.endsWith('/share-target') ||
     path.endsWith('share-target') ||
     url.searchParams.has('shared') ||
     path.endsWith('/share') ||
     path === '/' || path.endsWith('/index.html'));

  if (isSharePost) {
    event.respondWith(handleShare(event.request));
    return;
  }

  // Navigation: network first, fall back to cached app shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin assets: cache first
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request).catch(() => r))
  );
});

async function handleShare(request) {
  const base = self.registration.scope; // e.g. https://example.com/app/
  const okUrl = new URL('./?shared=1', base).href;
  const errUrl = new URL('./?shared=1&error=1', base).href;

  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);

    // Clear previous share so the page only sees the new files
    const oldKeys = await cache.keys();
    await Promise.all(oldKeys.map(k => cache.delete(k)));

    // Collect files (Chrome uses "files"; some browsers use other names)
    let files = form.getAll('files').filter(f => f && typeof f === 'object' && f.size > 0);
    if (!files.length) {
      for (const key of ['file', 'media', 'document', 'image', 'pdf']) {
        const f = form.get(key);
        if (f && typeof f === 'object' && f.size > 0) files.push(f);
      }
    }

    let i = 0;
    for (const file of files) {
      const rawName = (file.name || `shared-${++i}`).replace(/[^\w.\- ()[\]]+/g, '_');
      const headers = new Headers({
        'Content-Type': file.type || 'application/octet-stream',
        'X-Name': encodeURIComponent(rawName),
        'Content-Length': String(file.size)
      });
      const req = new Request(
        new URL(`./share-item/${Date.now()}-${i++}-${rawName}`, base).href,
        { method: 'GET', headers }
      );
      await cache.put(req, new Response(file, { headers }));
    }

    // 303 so the browser follows with a GET to the app
    return Response.redirect(okUrl, 303);
  } catch (e) {
    console.error('Share target error', e);
    return Response.redirect(errUrl, 303);
  }
}
