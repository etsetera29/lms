/* Safe minimal PWA: never cache user-specific HTML, API calls, Supabase URLs, quizzes, grades, or signed private files. */
const STATIC_CACHE='fcpc-v5-public-static-1';
const OFFLINE_ASSETS=['/offline.html','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(OFFLINE_ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==STATIC_CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
   event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match('/offline.html')));
   return;
 }
 const safe=(url.pathname.startsWith('/_next/static/') || OFFLINE_ASSETS.includes(url.pathname));
 if(!safe)return;
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();caches.open(STATIC_CACHE).then(cache=>cache.put(request,copy));}return response;})));
});
