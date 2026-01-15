// Ce fichier permet à votre site de fonctionner hors ligne en mettant en cache les ressources.

const STATIC_CACHE_NAME = 'mmgear-static-v3';
const DYNAMIC_CACHE_NAME = 'mmgear-dynamic-v3';

// Fichiers essentiels de l'application à mettre en cache immédiatement.
const STATIC_ASSETS = [
    './',
    './index.html',

    './manifest.json',
    './css/common.css',
    './css/mobile.css',
    './css/computer.css',
    './js/mmg-music-contents.js',

    './js/languages.js',
    './data.json',
    // Cursors
    './assets/cursors/pointer.cur',
    './assets/cursors/link.cur',
    './assets/cursors/text.cur',
    // Son d'intro
    'assets/MMGEARIntroSFX.ogg',
    // Sons UI
    './assets/sounds/back.ogg',
    './assets/sounds/select.ogg',
    './assets/sounds/hover.ogg',
    './assets/sounds/switch_towhite.ogg',
    './assets/sounds/switch_toblack.ogg',
    './assets/sounds/achievement.ogg',
    './assets/sounds/coin.ogg',
    // Images UI
    './assets/mmg-music-avatar.webp',
    './assets/mmg-beats-avatar.webp',
    // Icônes (à créer)
    './assets/icons/icon-192.webp',
    './assets/icons/icon-512.webp',
    // Polices Font Awesome locales
    './css/font-awesome.custom.min.css',
    './webfonts/fa-brands-400.woff2',
    './webfonts/fa-regular-400.woff2',
    './webfonts/fa-solid-900.woff2',
    // Librairies externes

    // Polices Google (le SW va chercher les fichiers CSS et woff2)
    'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@700&family=DotGothic16&family=Press+Start+2P&family=VT323&display=swap',
    'https://fonts.gstatic.com/s/atkinsonhyperlegible/v13/1Pt2g8L2yrPe3vYvG090MasFpAM_a29I4Q.woff2',
    'https://fonts.gstatic.com/s/dotgothic16/v19/v6-QG1d-vHw7zStNGY2Gg58i_X1K.woff2'
];

// Installation du Service Worker et mise en cache des fichiers statiques.
self.addEventListener('install', event => {
    console.log('[Service Worker] Installation...');
    // This ensures the new service worker activates immediately
    self.skipWaiting();
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
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Stratégie "Cache d'abord" pour les polices et librairies qui ne changent pas.
    if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com') {
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
    } else {
        // Stratégie "Réseau d'abord" pour le contenu de l'application (HTML, JSON, etc.)
        event.respondWith(
            caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                return fetch(event.request).then(response => {
                    if (response.status === 200) {
                        cache.put(event.request.url, response.clone());
                    }
                    return response;
                }).catch(() => caches.match(event.request));
            })
        );
    }
});
