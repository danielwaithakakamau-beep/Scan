const V='scanpro-v9';
const CDN=['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js','https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'];
const LOCAL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all([...LOCAL,...CDN].map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!=='scanpro-share').map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method==='POST'&&u.pathname.endsWith('/share-target')){
    e.respondWith((async()=>{
      try{
        const fd=await e.request.formData(),files=fd.getAll('media').filter(f=>f&&f.size);
        const c=await caches.open('scanpro-share');
        for(const k of await c.keys())await c.delete(k);
        await Promise.all(files.map((f,i)=>c.put(new URL('shared-'+i,self.registration.scope).href,new Response(f,{headers:{'Content-Type':f.type||'image/jpeg'}}))));
        return Response.redirect(new URL('./index.html?shared='+files.length,self.registration.scope).href,303);
      }catch(err){return Response.redirect(new URL('./index.html',self.registration.scope).href,303)}
    })());
    return;
  }
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(r=>{
    if(r&&r.status===200){const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp))}return r
  }).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)));
});
