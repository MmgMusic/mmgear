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
    'assets/MMGEARIntroSFX.ogg',
    // Images UI
    './assets/mmg-music-avatar.jpg',
    './assets/mmg-beats-avatar.jpg',
    // Icônes (à créer)
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
        })
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
// Stratégie : Réseau d'abord, puis cache en cas d'échec.
// Les ressources consultées sont ajoutées au cache dynamique pour un accès hors ligne futur.
self.addEventListener('fetch', event => {
    // Pour les polices Google, on privilégie le cache.
    if (event.request.url.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(res => {
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request.url, res.clone());
                        return res;
                    })
                });
            })
        );
    } else {
        // Pour le reste, on privilégie le réseau pour avoir les données à jour.
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clonedResponse = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        // Ne mettre en cache que les requêtes http/https
                        if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
                            if (response.status === 200) cache.put(event.request.url, clonedResponse);
                        }
                    });
                    return response;
                })
                .catch(err => {
                    // Si le réseau échoue, on cherche dans le cache.
                    return caches.match(event.request);
                })
        );
    }
});

// =================================================================================
// MEDIA SESSION HANDLING
// =================================================================================
// This makes the Service Worker handle media controls from the notification/lock screen,
// making background playback more robust.

const sendMediaControlAction = (action) => {
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        if (clients && clients.length) {
            // Send message to the most recently focused client
            clients[0].postMessage({ action: action });
        }
    });
};

try {
    self.addEventListener('install', () => {
        // This ensures the new service worker activates immediately
        self.skipWaiting();
    });

    navigator.mediaSession.setActionHandler('play', () => {
        sendMediaControlAction('play');
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        sendMediaControlAction('pause');
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        sendMediaControlAction('previoustrack');
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        sendMediaControlAction('nexttrack');
    });
    navigator.mediaSession.setActionHandler('stop', () => {
        sendMediaControlAction('stop');
    });
} catch (error) {
    console.log('[Service Worker] Media Session API not fully supported here.', error);
}
