const CACHE='strength-cycle-v34';
const ASSETS=['./manifest.webmanifest','./warmups.js'];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.mode==='navigate' || new URL(req.url).pathname.endsWith('/index.html')){
    e.respondWith(
      fetch(req,{cache:'no-store'})
        .then(async r=>{
          const text=await r.text();
          const injected=text.replace('</body>','<script src="warmups.js?v=34"></script></body>');
          const out=new Response(injected,{status:r.status,statusText:r.statusText,headers:r.headers});
          const copy=out.clone();
          caches.open(CACHE).then(c=>c.put('./',copy));
          return out;
        })
        .catch(()=>caches.match('./'))
    );
    return;
  }
  e.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));
});