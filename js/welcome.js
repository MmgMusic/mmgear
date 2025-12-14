document.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const bgMusicAudio = document.getElementById('background-music');
    const startBtn = document.getElementById('start-music-btn');
    const selectSound = document.getElementById('select-sound');

    // Si l'un des éléments clés de l'écran d'accueil manque, on arrête.
    if (!welcomeScreen || !mainContentWrapper || !bgMusicAudio || !startBtn) {
        // Fallback: si l'écran d'accueil n'existe pas, on charge le site directement.
        if (typeof loadDataAndInitialize === 'function') {
            loadDataAndInitialize();
        }
        return;
    }

    // Afficher l'écran d'accueil
    welcomeScreen.classList.remove('hidden');

    // --- Gestion de la musique de fond ---
    // On essaie de la lancer discrètement. Si ça marche, tant mieux.
    // Si le navigateur bloque, l'utilisateur pourra la lancer avec le switch.
    // La musique de fond sera gérée par le script principal après l'intro.

    // --- Démarrage de l'application ---
    startBtn.addEventListener('click', () => {
        // Cacher l'écran d'accueil avec une animation
        welcomeScreen.classList.add('fade-out');
        setTimeout(() => {
            welcomeScreen.classList.add('hidden');
        }, 500); // Durée de l'animation de fondu

        // Lancer l'introduction et le chargement du site
        if (typeof showIntroAndLoad === 'function') {
            showIntroAndLoad();
        } else if (typeof loadDataAndInitialize === 'function') {
            // Fallback si la fonction d'intro n'existe pas
            loadDataAndInitialize();
        }

        // Jouer le son de sélection
        if (selectSound) selectSound.play();
    });
});
