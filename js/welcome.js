document.addEventListener('DOMContentLoaded', () => {
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const bgMusicAudio = document.getElementById('background-music');
    const mobileNav = document.getElementById('mobile-bottom-nav');

    // Si l'un des éléments clés manque, on arrête pour éviter les erreurs.
    if (!mainContentWrapper || !bgMusicAudio || !mobileNav) return;

    // On révèle directement le contenu principal de l'application.
    mainContentWrapper.style.transition = 'none'; // Pas de transition pour un affichage instantané
    mainContentWrapper.style.opacity = '1';
    mainContentWrapper.classList.remove('hidden');

    // On affiche la barre de navigation mobile
    mobileNav.classList.remove('hidden');

    // On lance la musique de fond par défaut
    bgMusicAudio.play().catch(() => {});

    // On initialise l'application principale
    if (typeof loadDataAndInitialize === 'function') {
        loadDataAndInitialize();
    }
});
