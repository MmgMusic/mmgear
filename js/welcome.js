document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-music-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const introAnimationOverlay = document.getElementById('intro-animation-overlay');
    const introSound = document.getElementById('intro-sound');

    // Si l'un des éléments clés manque, on ne fait rien pour éviter les erreurs.
    if (!startBtn || !welcomeScreen || !mainContentWrapper || !introAnimationOverlay) return;

    // Fonction pour lancer l'animation d'intro
    function playIntroAnimation(onComplete) {
        introAnimationOverlay.classList.remove('hidden');

        // CORRECTION: Rétablissement de la fonction fitElementToParent de indexBONNEINTRO.html
        function fitElementToParent(el) {
            let timeout = null;
            function resize() {
                if (timeout) clearTimeout(timeout);
                anime.set(el, {scale: 1});
                const parentEl = el.parentNode;
                const elOffsetWidth = el.offsetWidth;
                const parentOffsetWidth = parentEl.offsetWidth;
                const ratio = parentOffsetWidth / elOffsetWidth;
                timeout = setTimeout(() => anime.set(el, {scale: ratio}), 10);
            }
            resize();
            window.addEventListener('resize', resize);
        }

        // On applique la fonction à .logo-animation, comme dans la version de référence.
        fitElementToParent(document.querySelector('.logo-animation'));

        const logoAnimationTL = anime.timeline({
            autoplay: false,
            easing: 'easeOutSine',
            complete: () => {
                // Fondu de sortie de l'animation
                anime({
                    targets: introAnimationOverlay,
                    opacity: 0,
                    duration: 500,
                    easing: 'easeInOutQuad',
                    complete: () => {
                        introAnimationOverlay.classList.add('hidden');
                        if (onComplete) onComplete();
                    }
                });
            }
        });

        logoAnimationTL
            .add({
                targets: '.bounced',
                transformOrigin: ['50% 100% 0px', '50% 100% 0px'],
                translateY: [
                    {value: [150, -160], duration: 190, endDelay: 20, easing: 'cubicBezier(0.225, 1, 0.915, 0.980)'},
                    {value: 4, duration: 120, easing: 'easeInQuad'},
                    {value: 0, duration: 120, easing: 'easeOutQuad'}
                ],
                scaleX: [
                    {value: [.25, .85], duration: 190, easing: 'easeOutQuad'},
                    {value: 1.08, duration: 120, delay: 85, easing: 'easeInOutSine'},
                    {value: 1, duration: 260, delay: 25, easing: 'easeOutQuad'}
                ],
                scaleY: [
                    {value: [.3, .8], duration: 120, easing: 'easeOutSine'},
                    {value: .35, duration: 120, delay: 180, easing: 'easeInOutSine'},
                    {value: .57, duration: 180, delay: 25, easing: 'easeOutQuad'},
                    {value: .5, duration: 190, delay: 15, easing: 'easeOutQuad'}
                ],
                delay: function(el, i) {
                    const landingTimestamps = [210, 420, 640, 860, 1070, 1280];
                    const animationDuration = 450;
                    return Math.max(0, landingTimestamps[i] - animationDuration);
                }
            })
            .add({ targets: ['.logo-group-mm', '.logo-group-gear'], translateX: 0, easing: 'easeOutElastic(1, .6)', duration: 1000 }, 200)
            .add({
                targets: '.logo-letter',
                translateY: [{value: 40, duration: 150, easing: 'easeOutQuart'}, {value: 0, duration: 800, easing: 'easeOutElastic(1, .5)'}],
                delay: anime.stagger(60)
            }, 2400)
            .add({
                targets: '.bounced',
                scaleY: [{value: .4, duration: 150, easing: 'easeOutQuart'}, {value: .5, duration: 800, easing: 'easeOutElastic(1, .5)'}],
                delay: anime.stagger(60)
            }, '-=950')
            // CORRECTION: Réintégration de l'animation de coloration des lettres de indexBONNEINTRO.html
            .add({
                begin: function() {
                    const shake = () => {
                        anime({
                            // CORRECTION: La cible est maintenant le conteneur dédié au tremblement pour une isolation parfaite.
                            targets: '#shake-container',
                            translateX: [ { value: 5, duration: 40 }, { value: -5, duration: 40 }, { value: 0, duration: 40 } ],
                            translateY: [ { value: 2, duration: 40 }, { value: -2, duration: 40 }, { value: 0, duration: 40 } ],
                            easing: 'easeInOutSine'
                        });
                    };
                    const colorTimeline = anime.timeline({ easing: 'easeOutQuad' });
                    colorTimeline
                        .add({ targets: '.letter-m1 .line', fill: '#ff0000', duration: 150, begin: shake })
                        .add({ targets: '.letter-m2 .line', fill: '#ff0000', duration: 150, begin: shake }, '-=90') // Intervalle de 60ms
                        .add({ targets: '.letter-g .line', fill: '#ff0000', duration: 150, begin: shake }, '-=90'); // Intervalle de 60ms
                }
            }, 2550);

        if (introSound) introSound.play().catch(e => console.warn("La lecture du son d'intro a été bloquée."));
        logoAnimationTL.play();
    }

    // --- NOUVEAU: Gestion de la langue sur l'écran d'accueil ---
    function applyWelcomeLanguage(lang) {
        localStorage.setItem('mmg-lang', lang); // Sauvegarde la langue
        document.querySelectorAll('#welcome-screen [data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            const translation = translations[lang]?.[key] || translations['en']?.[key] || `[${key}]`;
            if (el.placeholder) el.placeholder = translation;
            else el.textContent = translation;
        });
        document.querySelectorAll('#welcome-screen .lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    }

    // Appliquer la langue sauvegardée au chargement
    const savedLang = localStorage.getItem('mmg-lang') || 'fr';
    applyWelcomeLanguage(savedLang);

    // Ajouter les écouteurs pour les boutons de langue
    document.querySelectorAll('#welcome-screen .lang-btn').forEach(btn => {
        btn.addEventListener('click', () => applyWelcomeLanguage(btn.dataset.lang));
    });

    // --- NOUVEAU: Gestion de l'interrupteur de musique de fond de l'écran d'accueil ---
    const welcomeBgMusicSwitch = document.getElementById('welcome-bg-music-switch');
    const bgMusicAudio = document.getElementById('background-music');

    if (welcomeBgMusicSwitch && bgMusicAudio) {
        welcomeBgMusicSwitch.addEventListener('change', (e) => {
            // Cette logique est simple et ne concerne que cet écran.
            // La synchronisation avec le bouton des paramètres se fera au chargement de l'app.
            if (e.target.checked) {
                bgMusicAudio.play().catch(() => {});
            } else {
                bgMusicAudio.pause();
            }
        });
    }

    // Le listener sur le bouton "ENTRER" déclenche maintenant toute la séquence.
    startBtn.addEventListener('click', () => {
        // Animer la sortie de l'écran d'accueil
        welcomeScreen.classList.add('fade-out');

        setTimeout(() => {
            welcomeScreen.style.display = 'none';

            // Lancer l'animation d'intro.
            // La fonction onComplete se chargera de révéler le contenu principal.
            playIntroAnimation(() => {
                // Révéler le contenu principal avec une transition
                mainContentWrapper.classList.remove('hidden');
                mainContentWrapper.style.transition = 'opacity 0.5s ease-in-out';
                mainContentWrapper.style.opacity = '1';

                // NOUVEAU: Révéler la barre de navigation mobile en même temps.
                const mobileNav = document.getElementById('mobile-bottom-nav');
                if (mobileNav) mobileNav.classList.remove('hidden');

                // CORRECTION: La musique de fond démarre ICI, après l'intro.
                // La musique continue de jouer si l'interrupteur est activé.
                if (welcomeBgMusicSwitch.checked) {
                    bgMusicAudio.play().catch(() => {});
                }

                // Initialiser l'application (la fonction est dans mmg-music-contents.js)
                if (typeof loadDataAndInitialize === 'function') {
                    loadDataAndInitialize();
                }
            });

        }, 500); // Durée du fondu
    });
});
