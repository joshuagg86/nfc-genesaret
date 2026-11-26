const CACHE_NAME = 'genesaret-app-v2-preview';
const ASSETS = ["./index.html","./vendedor.html","./admin.html","./reportes.html","./style.css","./admin.js","./checkout.js","./index-inline-1.js","./login.css","./vendedor-inline-1.js","./vendedor-inline-2.js","./admin-inline-1.js","./reportes-inline-1.js","./app-ui.css","./manifest.json","./logo.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('genesaret-')&&key!==CACHE_NAME).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(request).catch(async()=>{const cached=await caches.match(request,{ignoreSearch:true});return cached||Response.error();}));
});
