document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-music-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainContentWrapper = document.getElementById('main-content-wrapper');

    // Si l'un des éléments clés manque, on ne fait rien pour éviter les erreurs.
    if (!startBtn || !welcomeScreen || !mainContentWrapper) return;

    // Fonction pour charger un script dynamiquement
    function loadScript(src, callback) {
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        if (callback) {
            script.onload = callback;
        }
        document.head.appendChild(script);
    }

    // Fonction pour démarrer l'application principale
    function startApplication() {
        // Révéler le contenu principal avec une transition
        mainContentWrapper.classList.remove('hidden');
        // Appliquer une transition pour l'apparition
        mainContentWrapper.style.transition = 'opacity 0.5s ease-in-out';
        mainContentWrapper.style.opacity = '1';

        // Charger les scripts principaux
        loadScript('js/languages.js');
        loadScript('js/mmg-music-contents.js', () => {
            // Une fois le script principal chargé, on peut initialiser l'application
            if (typeof loadDataAndInitialize === 'function') {
                loadDataAndInitialize();
            }
            // L'API Youtube est chargée en dernier
            loadScript('https://www.youtube.com/iframe_api');
        });
    }

    // On met en place le listener sur le bouton "ENTRER"
    startBtn.addEventListener('click', () => {
        // Jouer la musique de fond si l'option est cochée
        if (document.getElementById('background-music-switch')?.checked) {
            document.getElementById('background-music').play().catch(() => {});
        }

        // Animer la sortie de l'écran d'accueil
        welcomeScreen.classList.add('fade-out');
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            startApplication();
        }, 500);
    });
});
