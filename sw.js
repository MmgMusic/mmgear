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
    // Sons de l'interface
    './assets/MMGEARIntroSFX.ogg',
    './assets/sounds/typing-forwards.ogg',
    './assets/sounds/typing-backwards.ogg',
    './assets/sounds/hover.ogg',
    './assets/sounds/back.ogg',
    './assets/sounds/select.ogg',
    './assets/sounds/switch_towhite.ogg',
    './assets/sounds/switch_toblack.ogg',
    './assets/sounds/scroll.mp3',
    './assets/sounds/shop.ogg',
    './assets/sounds/connecting.ogg',
    './assets/sounds/achievement.ogg',
    './assets/sounds/coin.ogg',
    './assets/sounds/minimize_008.ogg',
    './assets/sounds/blocked.ogg',
    './assets/sounds/maximize_008.ogg',
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
    const url = new URL(event.request.url);

    // Stratégie "Cache d'abord" pour les ressources qui ne changent pas (polices, librairies, etc.)
    if (url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://cdnjs.cloudflare.com') {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(res => {
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request.url, res.clone());
                        return res;
                    });
                });
            })
        );
        return; // Important: on arrête ici pour cette stratégie
    }

    // Stratégie "Réseau d'abord" pour le reste (data.json, images, etc.)
    event.respondWith(
        fetch(event.request).then(response => {
            // Si la requête réussit, on met à jour le cache dynamique
            const clonedResponse = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
                    cache.put(event.request.url, clonedResponse);
                }
            });
            return response;
        }).catch(() => {
            // Si le réseau échoue, on sert depuis le cache
            return caches.match(event.request);
        })
    );
});

// =================================================================================
// MEDIA SESSION HANDLING
// =================================================================================
// This makes the Service Worker handle media controls from the notification/lock screen,
// making background playback more robust, especially on Android.

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'UPDATE_MEDIA_SESSION') {
        updateMediaSession(event.data.payload);
    }
});

function updateMediaSession(payload) {
    if (!('mediaSession' in navigator)) {
        return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
        title: payload.title,
        artist: payload.artist,
        album: payload.album,
        artwork: payload.artwork
    });

    navigator.mediaSession.playbackState = payload.playbackState;
}

const postToClient = async (message) => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
        client.postMessage(message);
    });
};

// Set up the action handlers once.
if ('mediaSession' in navigator) {
    const actions = ['play', 'pause', 'previoustrack', 'nexttrack', 'stop', 'seekbackward', 'seekforward'];
    for (const action of actions) {
        try {
            navigator.mediaSession.setActionHandler(action, () => postToClient({ action }));
        } catch (error) {
            console.log(`[Service Worker] The media session action "${action}" is not supported.`);
        }
    }
}
