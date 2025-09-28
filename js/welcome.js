document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-music-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainContentWrapper = document.getElementById('main-content-wrapper');

    // Si l'un des éléments clés manque, on ne fait rien pour éviter les erreurs.
    if (!startBtn || !welcomeScreen || !mainContentWrapper) return;

    // Fonction pour démarrer l'application principale
    function startApplication() {
        // Révéler le contenu principal avec une transition
        mainContentWrapper.classList.remove('hidden');
        mainContentWrapper.style.transition = 'opacity 0.5s ease-in-out';
        mainContentWrapper.style.opacity = '1';

        // Initialiser l'application (la fonction est dans mmg-music-contents.js)
        if (typeof loadDataAndInitialize === 'function') {
            loadDataAndInitialize();
        }
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
