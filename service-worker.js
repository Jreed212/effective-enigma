const CACHE='strength-cycle-v30';
const ASSETS=['./manifest.webmanifest'];
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
        .then(r=>{
          const copy=r.clone();
          caches.open(CACHE).then(c=>c.put('./',copy));
          return r;
        })
        .catch(()=>caches.match('./'))
    );
    return;
  }
  e.respondWith(
    fetch(req).catch(()=>caches.match(req))
  );
});