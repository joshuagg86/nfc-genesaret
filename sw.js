const CACHE_NAME = 'genesaret-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './vendedor.html',
  './reportes.html',
  './config.js',
  './manifest.json',
  './logo.png'
];

// Instalar el Service Worker y guardar archivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Guardando archivos en caché...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activar y limpiar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});

// Interceptar peticiones (Modo Offline)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si está en caché, lo devuelve (Offline first)
        return response || fetch(event.request);
      })
  );
});