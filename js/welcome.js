document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-music-btn');
    if (!startBtn) return;

    // Fonction pour charger un script dynamiquement
    function loadScript(src, callback) {
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.onload = callback;
        document.head.appendChild(script);
    }

    startBtn.addEventListener('click', () => {
        // Jouer la musique de fond si cochée
        if (document.getElementById('background-music-switch').checked) {
            document.getElementById('background-music').play().catch(() => {});
        }

        // Animer la sortie de l'écran d'accueil
        const welcomeScreen = document.getElementById('welcome-screen');
        welcomeScreen.classList.add('fade-out');
        
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            document.getElementById('main-content-wrapper').classList.remove('hidden');

            // Charger les scripts principaux SEULEMENT MAINTENANT
            loadScript('js/languages.js');
            loadScript('js/mmg-music-contents.js', () => {
                // Une fois mmg-music-contents.js chargé, on peut appeler sa fonction d'initialisation
                if (typeof loadDataAndInitialize === 'function') {
                    loadDataAndInitialize();
                }
                // L'API Youtube est chargée en dernier car elle dépend de la présence des iframes créées par l'initialisation
                loadScript('https://www.youtube.com/iframe_api');
            });

        }, 500);
    });
});
