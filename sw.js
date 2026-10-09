const V='scanpro-v6';
const CDN=['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js','https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'];
const LOCAL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all([...LOCAL,...CDN].map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(r=>{
    if(r&&r.status===200){const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp))}return r
  }).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)));
});
