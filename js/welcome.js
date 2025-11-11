(function() {
  // Ce script s'exécute immédiatement pour afficher la structure de l'application le plus vite possible.
  const mainContentWrapper = document.getElementById('main-content-wrapper');
  const bgMusicAudio = document.getElementById('background-music');
  const mobileNav = document.getElementById('mobile-bottom-nav');

  // Si les éléments clés manquent, on arrête.
  if (!mainContentWrapper || !bgMusicAudio || !mobileNav) {
    console.error("Éléments UI principaux manquants, l'initialisation rapide est annulée.");
    return;
  }

  // 1. Révéler IMMÉDIATEMENT la structure de l'application ("coquille").
  //    Ceci améliore considérablement le First Contentful Paint (FCP) et le Largest Contentful Paint (LCP).
  mainContentWrapper.style.transition = 'none'; // Pas de transition pour un affichage instantané
  mainContentWrapper.style.opacity = '1';
  mainContentWrapper.classList.remove('hidden');

  // 2. Afficher la barre de navigation mobile.
  mobileNav.classList.remove('hidden');

  // 3. Lancer la musique de fond.
  bgMusicAudio.play().catch(() => {});

  // 4. Attendre que la page soit complètement chargée pour lancer l'initialisation lourde des données.
  //    Cela garantit que le rendu initial n'est pas bloqué par le traitement du JSON et des autres scripts.
  window.addEventListener('load', () => {
    if (typeof loadDataAndInitialize === 'function') {
      loadDataAndInitialize();
    }
  });

})();
