// Ce fichier permet à votre site de fonctionner hors ligne en mettant en cache les ressources.

const STATIC_CACHE_NAME = 'mmgear-static-v1';
const DYNAMIC_CACHE_NAME = 'mmgear-dynamic-v1';

// Fichiers essentiels de l'application à mettre en cache immédiatement.
const STATIC_ASSETS = [
    './',
    './index.html',
    './mmg-music-contents.html',
    './manifest.json',
    './css/common.css',
    './css/mobile.css',
    './css/computer.css',
    './js/mmg-music-contents.js',
    './data.json',
    // Cursors
    './assets/cursors/pointer.cur',
    './assets/cursors/link.cur',
    './assets/cursors/text.cur',
    // Son d'intro
    './assets/MMGEARIntroSFX.ogg',
    // Images UI
    './assets/mmg-music-avatar.png',
    './assets/mmg-beats-avatar.png',
    // Icônes
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    // Librairies externes
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js',
    'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@700&family=DotGothic16&family=Press+Start+2P&family=VT323&display=swap'
];

// Installation du Service Worker et mise en cache des fichiers statiques.
self.addEventListener('install', event => {
    console.log('[Service Worker] Installation...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(cache => {
            console.log('[Service Worker] Mise en cache des ressources statiques...');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting()) // Force activation of new service worker
    );
});

// Activation du Service Worker et nettoyage des anciens caches.
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activation...');
    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(keyList.map(key => {
                if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
                    console.log('[Service Worker] Suppression de l\'ancien cache.', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Interception des requêtes réseau.
self.addEventListener('fetch', event => {
    // Stratégie : Cache d'abord, puis réseau (Cache-First) pour les ressources statiques
    if (STATIC_ASSETS.some(asset => event.request.url.endsWith(asset.replace('./', '')))) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
        return;
    }

    // Stratégie : Réseau d'abord, puis cache (Network-First) pour les autres requêtes
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Si la requête réussit, on met à jour le cache dynamique
                const clonedResponse = response.clone();
                caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    if (event.request.method === 'GET' && !event.request.url.startsWith('chrome-extension://')) {
                        cache.put(event.request.url, clonedResponse);
                    }
                });
                return response;
            })
            .catch(() => {
                // Si le réseau échoue, on cherche dans le cache
                return caches.match(event.request).then(response => {
                    if (response) {
                        return response;
                    }
                    // Optionnel: retourner une page d'erreur hors ligne si rien n'est trouvé dans le cache
                });
            })
    );
});

// Ajout d'un écouteur pour les notifications (pour l'avenir)
// Cela aide à maintenir le Service Worker actif et signale à l'OS
// que l'application peut avoir des comportements en arrière-plan.
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification cliquée: ', event.notification.tag);
  event.notification.close();

  // Ouvre l'application si elle n'est pas déjà ouverte
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

    
