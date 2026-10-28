// Offline-Cache der installierten App. Code und Daten: erst Netz, sonst Cache. Bilder und Schriften: Cache zuerst.
const V='riftroom-20261028185535';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 if(/\/(img|fonts|icons)\//.test(r.url)){e.respondWith(caches.open(V).then(c=>c.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res;}))));return;}
 e.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(V).then(c=>c.put(r,copy));}return res;}).catch(()=>caches.match(r)));
});
