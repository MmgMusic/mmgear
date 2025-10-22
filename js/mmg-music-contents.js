
    // =========================================================
    // GLOBAL VARIABLES & STATE
    // =========================================================
    let siteData = {}; 
    let allSearchableItems = {};

    let largePlayer, mediumPlayer;
    let activePlayer = null;
    let currentPlayingItem = null; 
    let isPlayerLooping = false;
    let isShuffleMode = false;
    let pausedForOverlay = false; 
    let isResumingFromOverlay = false; 
    let playerInitializationComplete = false;
    let likedSongs = new Set();
    let achievements = {};
    let savedPlaylists = {};
    let currentPlaylist = [];
    let contextPlaybackQueue = []; // File de lecture "cachée" basée sur le contexte (album, recherche...)
    let userQueue = []; // File d'attente "visible" et gérée par l'utilisateur
    let currentQueueIndex = -1; // Index dans la file de lecture de CONTEXTE
    let isHovering = false;
    let isAutoplayActive = true;
    let currentVolume = 100;
    let sfxEnabled = true;
    let currentLang = 'en'; // MODIFICATION: Langue par défaut
    let currentNavigationContext = { playlist: [], index: -1 };
    let currentViewContext = { type: 'menu', data: null }; // Pour re-render lors du changement de langue
    let currentPlaybackContext = { type: 'none', name: '' }; // NOUVEAU: Pour suivre la source de la lecture
    
    // --- NOUVEAUX ÉTATS ---
    let isBackgroundPlayEnabled = true; // Activé par défaut
    let listenProgress = 0;
    let previousListenProgress = 0; 
    let seekDetectedInCurrentPlay = false;
    let isReloadingForAd = false;

    let userCoins = 0;
    const COIN_COST_UNLOCK = 10;
    let unlockedDreamSeasonTracks = [];
    let purchasedShopItems = new Set(); // NOUVEAU: Pour suivre les thèmes/fonds achetés

    // --- State for Tutorial ---
    let isTutorialActive = false;
    let tutorialSuppressAutoplay = false;
    let tutorialSavedPlayerState = null;
    let originalAutoplayState = true; 

    let titleScrollObserver = null;
    let titleResizeObserver = null;
    let readUpdateIds = new Set();
    
    // --- PWA Installation State ---
    let deferredPrompt = null;

    let carouselInterval = null; // AJOUT: Variable globale pour le minuteur du carrousel

    // =========================================================
    // SOUND & AUDIO ELEMENTS
    // =========================================================
    const sounds = {
        select: document.getElementById('select-sound'),
        back: document.getElementById('back-sound'),
        hover: document.getElementById('hover-sound'),
        switchToWhite: document.getElementById('switch-to-white-sound'),
        switchToBlack: document.getElementById('switch-to-black-sound'),
        shop: document.getElementById('shop-sound'),
        connecting: document.getElementById('connecting-sound'),
        achievementUnlocked: document.getElementById('achievement-unlocked-sound'),
        minimize: document.getElementById('minimize-sound'),
        maximize: document.getElementById('maximize-sound'),
        coin: document.getElementById('coin-sound'),
        keepAlive: document.getElementById('keep-alive-sound'),
        blocked: document.getElementById('blocked-sound'),
    };

    // =========================================================
    // DATA LOADING
    // =========================================================
    // MODIFICATION: La fonction est maintenant appelée par welcome.js
    async function loadDataAndInitialize() { 
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                // CORRECTION: Affiche une erreur plus visible si data.json ne charge pas
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            siteData = await response.json();
            
            Object.values(siteData.contentData).forEach(profile => {
                // CORRECTION: Vérifie que les sections existent avant d'essayer de les parcourir.
                // Utilise les nouveaux noms 'videos' et 'bonus'.
                if (profile.titles) Object.entries(profile.titles).forEach(([key, val]) => val.id = key);
                if (profile.videos) Object.entries(profile.videos).forEach(([key, val]) => val.id = key);
                if (profile.bonus) Object.entries(profile.bonus).forEach(([key, val]) => val.id = key);
                if (profile.albums) Object.entries(profile.albums).forEach(([key, val]) => {
                    val.id = key;
                    val.type = 'album';
                });
                Object.assign(allSearchableItems, profile.titles, profile.videos, profile.bonus, profile.albums);
            });

            initializeApp();

        } catch (error) {
            console.error("Could not load site data:", error);
            document.body.innerHTML = '<h1 style="text-align: center; margin-top: 50px;">Erreur de chargement des données. Veuillez réessayer.</h1>';
        }
    }


    // =========================================================
    // YOUTUBE PLAYER & MEDIA SESSION
    // =========================================================
    
    window.onYouTubeIframeAPIReady = function() {
        const playerOptions = {
            height: '100%',
            width: '100%',
            playerVars: { 'playsinline': 1, 'autoplay': 0, 'controls': 0, 'modestbranding': 1, 'rel': 0, 'origin': window.location.origin },
            events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
        };
        largePlayer = new YT.Player('large-player-iframe', playerOptions);
        mediumPlayer = new YT.Player('medium-player-iframe', playerOptions);
        playerInitializationComplete = true;
        if (currentPlayingItem) loadAndPlayVideo(currentPlayingItem);
    }
    
    function onPlayerReady(event) {
        setVolume(currentVolume);
        setInterval(updateProgressBar, 1000);
    }

    function onPlayerStateChange(event) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const playPauseBox = document.getElementById('play-pause-box');
        const backgroundMusic = document.getElementById('background-music');
        // NOUVEAU: Contrôles du mini-lecteur mobile
        const miniPlayerPlayPauseBtn = document.getElementById('mini-player-play-pause-btn');
        const mobilePlayerPlayPauseBtn = document.getElementById('mobile-player-play-pause-btn');

        
        if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
            playPauseBox.classList.remove('loading');
        } else if (event.data === YT.PlayerState.BUFFERING) {
            playPauseBox.classList.add('loading');
        }

        if (event.data === YT.PlayerState.ENDED) {
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            const itemId = currentPlayingItem?.id; // CORRECTION: Définir itemId ici
            
            const finalProgress = activePlayer.getDuration() > 0 ? activePlayer.getCurrentTime() / activePlayer.getDuration() : 0;
            
            if (currentPlayingItem && isMusicTitle(currentPlayingItem) && !seekDetectedInCurrentPlay && finalProgress >= 0.95) {
                userCoins++;
                localStorage.setItem('mmg-userCoins', JSON.stringify(userCoins));
                updateCoinDisplay();
                showDialog(`+1 pièce ! Total : ${userCoins}`);
                playAudio(sounds.coin);

                if (isPlayerLooping) updateAchievementProgress('loopMaster', itemId);
                if (currentPlayingItem.tags?.includes('retro')) updateAchievementProgress('retroPlayer', itemId);
                if (currentPlayingItem.tags?.includes('playstation')) updateAchievementProgress('psPlayer', itemId);
                // CORRECTION: La logique pour la mission Spotimon est maintenant ici et utilise un tag.
                if (currentPlayingItem.tags?.includes('spotimon')) updateAchievementProgress('spotimonFan', itemId);
            }

            if (isPlayerLooping) {
                if (isBackgroundPlayEnabled && sounds.keepAlive) {
                    sounds.keepAlive.play().catch(e => console.log("Keep-alive audio failed to play on loop."));
                }
                event.target.seekTo(0);
                event.target.playVideo();
                return;
            }
            
            if (isAutoplayActive) {
                playNextTrack();
            } else {
                 if (sounds.keepAlive) {
                    sounds.keepAlive.pause();
                 }
                 if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
                 if (miniPlayerPlayPauseBtn) miniPlayerPlayPauseBtn.className = 'fas fa-play';
                 if (mobilePlayerPlayPauseBtn) mobilePlayerPlayPauseBtn.className = 'fas fa-play';
            }
            updateMediaPositionState(); // Update one last time
            
        } else if (event.data === YT.PlayerState.PLAYING) {
            if (isReloadingForAd) {
                isReloadingForAd = false;
                return; 
            }
            if (playPauseBtn) playPauseBtn.className = 'fas fa-pause';
            backgroundMusic.pause();
            if (miniPlayerPlayPauseBtn) miniPlayerPlayPauseBtn.className = 'fas fa-pause';
            if (mobilePlayerPlayPauseBtn) mobilePlayerPlayPauseBtn.className = 'fas fa-pause';

            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";

            if (isResumingFromOverlay) {
                isResumingFromOverlay = false; 
                return; 
            }
            
            if(document.getElementById('video-suggestions-section').classList.contains('hidden') === false) {
                showSection(isMusicTitle(currentPlayingItem) ? 'music-title-details-section' : 'large-player-section');
            }

            // Ad detection logic
            if (isMusicTitle(currentPlayingItem)) {
                setTimeout(() => {
                    if (!backgroundMusic.paused && !isReloadingForAd && activePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                        console.log("Ad detected (background music still playing). Reloading video.");
                        isReloadingForAd = true;
                        loadAndPlayVideo(currentPlayingItem);
                    }
                }, 500);
            }
            updateMediaPositionState(); // Mettre à jour l'état pour la notification

        } else if (event.data === YT.PlayerState.PAUSED) {
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
            if (miniPlayerPlayPauseBtn) miniPlayerPlayPauseBtn.className = 'fas fa-play';
            if (mobilePlayerPlayPauseBtn) mobilePlayerPlayPauseBtn.className = 'fas fa-play';
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            if (sounds.keepAlive) {
                sounds.keepAlive.pause();
            }
            updateMediaPositionState(); // Mettre à jour l'état pour la notification
        }
    }

    function playVideoWhenReady(item, playlistIds = [], index = -1, playbackOriginType = 'titles', forceTempPlay = false, fromAutoplay = false, isSwipe = false) {
        if (!item) return;
        // CORRECTION: Ne pas définir currentPlayingItem ici.
        // On le définit uniquement si la lecture est confirmée, pour éviter les faux positifs visuels quand l'autoplay est OFF.
        // La logique de la file d'attente est aussi déplacée plus bas.

        // CORRECTION: Si l'autoplay est OFF, on n'affiche que la page de détails pour les titres musicaux, mais on laisse les vidéos se lancer.
        if (!isAutoplayActive && !forceTempPlay && isMusicTitle(item)) {
            // On ne met PAS à jour currentPlayingItem, on affiche juste les détails.
            renderMusicTitleDetails(item);
            showSection('music-title-details-section');
            updateTempPlayButtonVisibility(); // CORRECTION: Assure que le bouton "Play" s'affiche correctement.
            return;
        }
        
        // --- La lecture est confirmée, on met à jour l'état ---
        currentPlayingItem = item;

        // MODIFICATION: Si le titre vient de la file d'attente utilisateur, on le retire.
        const itemIndexInUserQueue = userQueue.indexOf(item.id);
        if (itemIndexInUserQueue > -1) {
            userQueue.splice(itemIndexInUserQueue, 1);
            updateAllQueueViews();
        }

        // Determine contextPlaybackQueue and currentQueueIndex
        if (forceTempPlay) {
            // This is typically a single track play from its details page.
            contextPlaybackQueue = [item.id];
            currentQueueIndex = 0;
        } else if (playlistIds && playlistIds.length > 0) {
            contextPlaybackQueue = playlistIds;
            currentQueueIndex = index;
        } else { // Fallback for single track play not from a specific list
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
            const albumId = item.albumId;
            if (albumId) {
                contextPlaybackQueue = Object.values(siteData.contentData[activeProfile].titles).filter(title => title.albumId === albumId).map(title => title.id);
                currentQueueIndex = contextPlaybackQueue.findIndex(id => id === item.id);
            } else {
                activePlaybackQueue = [item.id];
                currentQueueIndex = 0;
            }
        }

        // --- Determine currentPlaybackContext based on playbackOriginType ---
        // Prioritize specific origins, then fall back to more general ones.
        if (playbackOriginType === 'myPlaylist') {
            currentPlaybackContext = { type: 'playlist', name: 'Ma Playlist' };
        } else if (playbackOriginType === 'liked') {
            currentPlaybackContext = { type: 'liked', name: 'Titres Likés' };
        } else if (playbackOriginType === 'queue') {
            currentPlaybackContext = { type: 'selection', name: 'File d\'attente' };
        } else if (playbackOriginType === 'mmgPlaylist') {
            currentPlaybackContext = { type: 'mmgPlaylist', name: 'Mmg Playlists' };
        } else if (playbackOriginType === 'video') {
            currentPlaybackContext = { type: 'video', name: 'Vidéos' };
        } else if (item.albumId && (playbackOriginType === 'titles' || playbackOriginType === 'search' || playbackOriginType === 'album')) {
            // If it's an album track, and not from a more specific origin (like playlist/liked/video)
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
            const album = item.albumId ? siteData.contentData[document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'].albums[item.albumId] : null;
            currentPlaybackContext = album ? { type: 'album', name: album.title } : { type: 'track', name: 'Titres' };
        } else if (playbackOriginType === 'search') {
            currentPlaybackContext = { type: 'search', name: 'Recherche' };
        } else { // Default to 'titles' for generic lists or single tracks
            currentPlaybackContext = { type: 'track', name: 'Titres' };
        }

        seekDetectedInCurrentPlay = false;
        previousListenProgress = 0;

        if (!playerInitializationComplete) {
            showDialog("Chargement du lecteur vidéo...");
            return;
        }
        loadAndPlayVideo(item, fromAutoplay, isSwipe); // isSwipe is the 3rd argument, not fromAutoplay
    }

    function loadAndPlayVideo(item, fromAutoplay = false) {
        document.getElementById('play-pause-box').classList.add('loading');
        // CORRECTION: S'assurer que tout ancien surlignage (d'un clic sans autoplay) est retiré.
        unhighlightPlayingCard();

        currentPlayingItem = item;
        const musicTitle = isMusicTitle(item);
    
        activePlayer = musicTitle ? mediumPlayer : largePlayer;
        const inactivePlayer = musicTitle ? largePlayer : mediumPlayer;
        if (inactivePlayer && typeof inactivePlayer.stopVideo === 'function') inactivePlayer.stopVideo(); // Stop the other player
        
        // CORRECTION: On affiche la bonne section (lecteur ou détails) uniquement si ce n'est PAS l'autoplay,
        // SAUF si c'est un swipe, auquel cas on veut toujours afficher la nouvelle page.
        const isSwipe = arguments[2] || false; // Récupère le 3ème argument (isSwipe)
        const musicDetailsVisible = !document.getElementById('music-title-details-section').classList.contains('hidden');

        // CORRECTION: Mettre à jour la page de détails si elle est visible, ou l'afficher si on navigue manuellement.
        if (musicTitle) {
            renderMusicTitleDetails(item); // Toujours mettre à jour les données
        }

        if (!fromAutoplay || isSwipe || musicDetailsVisible) {
            showSection(musicTitle ? 'music-title-details-section' : 'large-player-section');
        }

        updateMp3PlayerInfo(item);
        updateLikeButtonUI(item.id);
        updateMediaSession(item);
        // NOUVEAU: Surligne la carte correspondante si elle est visible
        highlightPlayingCard(item);

        renderPlaylist();

        // NOUVEAU: Afficher le mini-lecteur mobile
        const miniPlayer = document.getElementById('mobile-mini-player');
        if (miniPlayer) miniPlayer.classList.remove('hidden');
        // NOUVEAU: Afficher la poignée du lecteur mobile
        const miniPlayerHandle = document.getElementById('mobile-player-toggle-handle');
        if (miniPlayerHandle) miniPlayerHandle.classList.remove('hidden');

        // CORRECTION: Si le lecteur était masqué par l'utilisateur, on le réaffiche
        // pour éviter les bugs de layout.
        const body = document.body;
        body.classList.remove('mobile-player-hidden');

        // NOUVEAU: Définir la hauteur du lecteur pour que le CSS s'adapte
        document.documentElement.style.setProperty('--mobile-player-height', '66px');
    
        if (tutorialSuppressAutoplay) {
            tutorialSuppressAutoplay = false; 
            if (musicTitle) {
                renderMusicTitleDetails(item);
                showSection('music-title-details-section');
            } else {
                showSection('large-player-section');
            }
            return;
        }

        if (activePlayer && typeof activePlayer.loadVideoById === 'function') {
            activePlayer.loadVideoById(item.youtube_id, 0);
        }
    }

    /**
     * Mets à jour les métadonnées et les contrôles pour l'API Media Session.
     */
    function updateMediaSession(item) {
        if (!('mediaSession' in navigator)) {
            return;
        }
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        const album = siteData.contentData[activeProfile].albums[item.albumId];

        navigator.mediaSession.metadata = new MediaMetadata({
            title: item.title,
            artist: activeProfile === 'mmg-music' ? 'Mmg Music' : 'Mmg Beats',
            album: album ? album.title : 'Single',
            artwork: [{ src: getCorrectImagePath(item), sizes: '512x512', type: 'image/png' }]
        });
        
        navigator.mediaSession.playbackState = "playing";

        navigator.mediaSession.setActionHandler('play', () => { if(activePlayer) activePlayer.playVideo() });
        navigator.mediaSession.setActionHandler('pause', () => { if(activePlayer) activePlayer.pauseVideo() }); // Pause the active player
        
        navigator.mediaSession.setActionHandler('previoustrack', () => playNextTrack(-1, true));
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack(1, true));

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const skipTime = details.seekOffset || 10;
            if(activePlayer) activePlayer.seekTo(Math.max(0, activePlayer.getCurrentTime() - skipTime), true); // Correction pour ne pas aller en négatif
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            if(activePlayer) activePlayer.seekTo(Math.min(activePlayer.getDuration(), activePlayer.getCurrentTime() + skipTime), true); // Correction pour ne pas dépasser la durée
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.fastSeek && 'fastSeek' in activePlayer) {
              activePlayer.fastSeek(details.seekTime);
              return;
            }
            if(activePlayer) activePlayer.seekTo(details.seekTime, true);
        });

        navigator.mediaSession.setActionHandler('stop', () => {
            if (activePlayer && typeof activePlayer.stopVideo === 'function') {
                activePlayer.stopVideo();
                currentPlayingItem = null;
                resetMiniPlayerUI();
                // NOUVEAU: Restaure les titres de section originaux (assuming this function exists elsewhere)
                // restoreOriginalSectionTitles();
            }
        });

        updateMediaPositionState(); // Initialisation
    }

    /**
     * Met à jour la position et la durée dans l'API Media Session pour la notification.
     * C'est crucial pour que l'OS considère le média comme actif.
     * @returns 
     * Met à jour la position et la durée dans l'API Media Session pour la notification.
     */
    function updateMediaPositionState() {
        if (!('mediaSession' in navigator) || !activePlayer || typeof activePlayer.getDuration !== 'function') {
            return;
        }

        const duration = activePlayer.getDuration() || 0;
        const position = activePlayer.getCurrentTime() || 0;

        if (navigator.mediaSession.playbackState === 'playing' && !isNaN(duration) && isFinite(duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackRate: activePlayer.getPlaybackRate(),
                    position: position
                });
            } catch(error) {
                console.error('Erreur lors de la mise à jour de setPositionState:', error);
            }
        }
    }

    // NOUVEAU: Fonctions pour surligner la carte en cours de lecture
    function highlightPlayingCard(item) {
        unhighlightPlayingCard(); // Retire l'ancien surlignage
        if (!item) return;

        const visibleSection = document.querySelector('.page-section:not(.hidden)');
        if (!visibleSection) return;

        // Cible la carte uniquement si elle est dans la section visible
        const cardElement = visibleSection.querySelector(`.card[data-item-id="${item.id}"]`);
        if (cardElement) {
            cardElement.classList.add('now-playing-card');
        }
    }

    function unhighlightPlayingCard() {
        const highlightedCard = document.querySelector('.card.now-playing-card');
        if (highlightedCard) {
            highlightedCard.classList.remove('now-playing-card');
        }
    }

    function findItemById(id) {
        return allSearchableItems[id] || null;
    }

    function isMusicTitle(item) {
        return item && item.albumId && item.year;
    }

    // =========================================================
    // LIKES, PLAYLIST & ACHIEVEMENTS
    // =========================================================
    function initUserData() {
        const storedLikes = localStorage.getItem('mmg-likedSongs');
        likedSongs = storedLikes ? new Set(JSON.parse(storedLikes)) : new Set();
        
        const storedPlaylist = localStorage.getItem('mmg-playlist');
        currentPlaylist = storedPlaylist ? JSON.parse(storedPlaylist) : [];

        const storedSavedPlaylists = localStorage.getItem('mmg-savedPlaylists');
        savedPlaylists = storedSavedPlaylists ? JSON.parse(storedSavedPlaylists) : {};
        
        const storedSfx = localStorage.getItem('mmg-sfxEnabled');
        sfxEnabled = storedSfx !== null ? JSON.parse(storedSfx) : true;
        document.getElementById('sfx-switch').checked = sfxEnabled;

        const storedLang = localStorage.getItem('mmg-lang');
        currentLang = storedLang || 'en'; // Default to English
        applyLanguage(currentLang);
        
        const storedBackgroundPlay = localStorage.getItem('mmg-backgroundPlayEnabled');
        isBackgroundPlayEnabled = storedBackgroundPlay !== null ? JSON.parse(storedBackgroundPlay) : true;
        document.getElementById('background-play-switch').checked = isBackgroundPlayEnabled;
    
        const storedReadUpdates = localStorage.getItem('mmg-readUpdateIds');
        readUpdateIds = storedReadUpdates ? new Set(JSON.parse(storedReadUpdates)) : new Set();

        const storedAchievements = localStorage.getItem('mmg-achievements');
        const defaultAchievements = {
            loopMaster: { unlocked: false, progress: {}, goal: 3, icon: "fa-sync-alt" },
            retroPlayer: { unlocked: false, progress: [], goal: 3, icon: "fa-gamepad" },
            patienceIsKey: { unlocked: false, progress: 0, goal: 2, icon: "fa-hourglass-end" },
            psPlayer: { unlocked: false, progress: [], goal: 2, icon: "fab fa-playstation" },
            spotimonFan: { unlocked: false, progress: [], goal: 7, icon: "fa-compact-disc" } // NOUVEAU: Mission Spotimon
        };
        achievements = storedAchievements ? JSON.parse(storedAchievements) : defaultAchievements;

        Object.keys(defaultAchievements).forEach(key => {
            if (!achievements[key]) {
                achievements[key] = defaultAchievements[key];
            }
        });
        
        const storedCoins = localStorage.getItem('mmg-userCoins');
        userCoins = storedCoins ? JSON.parse(storedCoins) : 0;
        
        const storedUnlocked = localStorage.getItem('mmg-unlockedTracks');
        try {
            unlockedDreamSeasonTracks = storedUnlocked ? JSON.parse(storedUnlocked) : [];
            if (!Array.isArray(unlockedDreamSeasonTracks)) {
                unlockedDreamSeasonTracks = [];
            }
        } catch (e) {
            console.error('Failed to parse unlocked tracks, resetting.', e);
            unlockedDreamSeasonTracks = [];
        }

        // NOUVEAU: Charger les articles de boutique achetés
        const storedPurchasedItems = localStorage.getItem('mmg-purchasedItems');
        try {
            const parsedItems = storedPurchasedItems ? JSON.parse(storedPurchasedItems) : [];
            purchasedShopItems = new Set(parsedItems);
        } catch (e) {
            console.error('Failed to parse purchased items, resetting.', e);
            purchasedShopItems = new Set();
        }
    
        renderShopPage();
    }
    
    // ... (le reste de la fonction initUserData)
    
    
    function updateCoinDisplay() {
        const coinElement = document.getElementById('coin-count');
        if(coinElement) coinElement.textContent = userCoins;
    }

    function updateNotificationDot() {
        const dots = document.querySelectorAll('.notification-dot');
        const markAsReadBtn = document.getElementById('mark-as-read-btn');
        const unlockNotification = document.getElementById('unlock-notification-item');
        if (dots.length === 0 || !unlockNotification || !markAsReadBtn) return;

        // Condition 1: L'utilisateur peut débloquer un titre
        const allUnlockableTracks = Object.values(allSearchableItems).filter(t => t.isUnlockable);
        const hasLockedTracks = allUnlockableTracks.some(t => !unlockedDreamSeasonTracks.includes(t.id));
        const canUnlock = userCoins >= COIN_COST_UNLOCK && hasLockedTracks;

        // Condition 2: Il y a un message non lu
        const hasUnreadUpdateLog = siteData.updateLog && siteData.updateLog.some(entry => !readUpdateIds.has(entry.id));
        const hasUnreadDevMessage = siteData.devMessages && siteData.devMessages.some(entry => !readUpdateIds.has(entry.id));
        const hasUnreadMessages = hasUnreadUpdateLog || hasUnreadDevMessage;


        // MODIFICATION: Le point rouge ne s'affiche que s'il y a des messages non lus.
        dots.forEach(dot => dot.classList.toggle('hidden', !hasUnreadMessages));
        unlockNotification.classList.toggle('hidden', !canUnlock);
        markAsReadBtn.disabled = false;
        document.querySelector('.update-log').classList.toggle('has-unread', hasUnreadMessages);
    }

    function updateAchievementProgress(id, value) {
        if (achievements[id].unlocked) return;
        const ach = achievements[id];
        let progressChanged = false;

        if (id === 'loopMaster') {
             ach.progress[value] = (ach.progress[value] || 0) + 1;
             if (ach.progress[value] >= ach.goal) { 
                 unlockAchievement(id);
             }
             progressChanged = true;
        } else if (id === 'retroPlayer' || id === 'psPlayer') {
            if (!ach.progress.includes(value)) {
                ach.progress.push(value); // Ajoute l'ID unique du titre
                if (ach.progress.length >= ach.goal) {
                    unlockAchievement(id);
                }
                progressChanged = true;
            }
        } else if (id === 'patienceIsKey') {
            ach.progress++;
            if (ach.progress >= ach.goal) {
                unlockAchievement(id);
            }
            progressChanged = true;
        } else if (id === 'spotimonFan') {
            // CORRECTION: La logique pour la mission Spotimon est maintenant correcte.
            if (!ach.progress.includes(value)) {
                ach.progress.push(value);
                if (ach.progress.length >= ach.goal) {
                    unlockAchievement(id);
                }
                // La progression n'est marquée comme changée que si un nouveau titre a été ajouté.
                progressChanged = true;
            }
        }
    
        if (progressChanged) {
            localStorage.setItem('mmg-achievements', JSON.stringify(achievements));
            renderShopMissions();
        }
    }

    function unlockAchievement(id) {
        if (achievements[id].unlocked) return;
        achievements[id].unlocked = true;
        localStorage.setItem('mmg-achievements', JSON.stringify(achievements));
        playAudio(sounds.achievementUnlocked, true);
        showDialog(`${getTranslation('achievementUnlocked')}: ${getTranslation(`achievement_${id}_title`)}!`);
        renderShopMissions();
        updateShopLocksAndSelection();
    }
    
    function unlockAllAchievements() {
        Object.keys(achievements).forEach(id => {
            if (!achievements[id].unlocked) {
               achievements[id].unlocked = true;
            }
        });
        localStorage.setItem('mmg-achievements', JSON.stringify(achievements));
        renderAchievements();
        updateShopLocksAndSelection();
    }

    function renderAchievements() {
        const container = document.getElementById('achievements-list');
        if (!container) return;
        container.innerHTML = '';
        Object.entries(achievements).forEach(([id, ach]) => {
            let progressValue = 0;
            if (id === 'loopMaster') {
                progressValue = Math.max(0, ...Object.values(ach.progress).map(Number)) / ach.goal;
            } else if (id === 'retroPlayer' || id === 'psPlayer' || id === 'spotimonFan') { // NOUVEAU: Ajout de spotimonFan
                progressValue = ach.progress.length / ach.goal;
            } else if (id === 'patienceIsKey') {
                progressValue = ach.progress / ach.goal;
            }
            progressValue = Math.min(1, progressValue) * 100;

            const iconHtml = ach.icon.startsWith('fab') 
                ? `<i class="${ach.icon}"></i>` 
                : `<i class="fas ${ach.icon}"></i>`;

            const item = document.createElement('div');
            item.className = `achievement-item ${ach.unlocked ? 'unlocked' : ''}`;
            item.innerHTML = `
                <div class="achievement-icon">${iconHtml}</div>
                <div class="achievement-details">
                    <h4>${getTranslation(`achievement_${id}_title`)}</h4>
                    <p>${getTranslation(`achievement_${id}_desc`)}</p>
                    ${!ach.unlocked ? `
                    <div class="achievement-progress-bar">
                        <div class="achievement-progress-fill" style="width: ${progressValue}%"></div>
                    </div>` : ''}
                </div>
            `;
            container.appendChild(item);
        });
    }



    function toggleLike(itemId) {
        playAudio(sounds.select);
        if (likedSongs.has(itemId)) {
            likedSongs.delete(itemId);
        } else {
            likedSongs.add(itemId);
        }
        localStorage.setItem('mmg-likedSongs', JSON.stringify([...likedSongs]));
        updateLikeButtonUI(itemId);
        
        const cardLikeIcon = document.querySelector(`.card[data-item-id="${itemId}"] .like-btn-card`);
        if (cardLikeIcon) {
            const isLiked = likedSongs.has(itemId);
            cardLikeIcon.classList.toggle('active', isLiked);
            cardLikeIcon.classList.toggle('fas', isLiked);
            cardLikeIcon.classList.toggle('far', !isLiked);
        }

        // CORRECTION: Si on est dans la bibliothèque, on la met à jour
        // au lieu de toujours rediriger vers l'onglet "Likes".
        if (document.getElementById('library-section').classList.contains('hidden') === false) {
            // On trouve l'onglet actuellement actif et on le rafraîchit.
            const activeTab = document.querySelector('#library-tabs-container .playlist-tab-btn.active');
            renderLibraryPage(activeTab ? activeTab.dataset.tabId : 'liked');
        }
        // Mettre à jour dynamiquement les cartes du tableau de bord
        renderUserActivity();
        renderLikedSongsPreview();
    }

    function updateLikeButtonUI(itemId) {
        const playerLikeBtn = document.getElementById('player-like-btn');
        if (!playerLikeBtn || !currentPlayingItem || currentPlayingItem.id !== itemId) return;
        const isLiked = likedSongs.has(itemId);
    
        // NOUVEAU: Mettre à jour le bouton like du lecteur mobile
        const mobilePlayerLikeBtn = document.getElementById('mobile-player-like-btn');
        mobilePlayerLikeBtn.classList.toggle('active', isLiked);
        mobilePlayerLikeBtn.classList.toggle('fas', isLiked);
        mobilePlayerLikeBtn.classList.toggle('far', !isLiked);
        const miniPlayerLikeBtn = document.getElementById('mini-player-like-btn');
        miniPlayerLikeBtn.classList.toggle('active', isLiked);
        miniPlayerLikeBtn.classList.toggle('fas', isLiked);
        miniPlayerLikeBtn.classList.toggle('far', !isLiked); // Toggle 'far' for empty heart

        playerLikeBtn.classList.toggle('active', isLiked);
        playerLikeBtn.classList.toggle('fas', isLiked);
        playerLikeBtn.classList.toggle('far', !isLiked);
    }
    
    function togglePlaylistItem(itemId) {
        const itemIndex = currentPlaylist.indexOf(itemId);

        if (itemIndex > -1) {
            currentPlaylist.splice(itemIndex, 1);
            showDialog(getTranslation("titleRemovedPlaylist"));
            playAudio(sounds.back);
        } else {
            currentPlaylist.push(itemId);
            showDialog(getTranslation("titleAddedPlaylist"));
            playAudio(sounds.select);
        }
        
        localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist));
        renderPlaylist();
        updateDetailsPlaylistButtonState();

        // CORRECTION : Si la bibliothèque est ouverte sur l'onglet "Ma playlist", on la rafraîchit.
        const librarySectionVisible = !document.getElementById('library-section').classList.contains('hidden');
        const myPlaylistTabActive = document.querySelector('#library-tabs-container .playlist-tab-btn[data-tab-id="current"]')?.classList.contains('active');
        if (librarySectionVisible && myPlaylistTabActive) {
            renderLibraryPage('current');
        }

        updatePlayerPlaylistButtonUI(itemId); // NOUVEAU: Mettre à jour l'icône du lecteur
        updateCardPlaylistButtonState(itemId);
    }

    // NOUVEAU: Logique pour la file d'attente
    function addToQueue(itemId) {
        if (!userQueue.includes(itemId)) {
            userQueue.push(itemId);
            showDialog(`"${findItemById(itemId).title}" ${getTranslation('addedToQueue')}`);
            updateAllQueueViews(); // CORRECTION: Met à jour toutes les vues de la file d'attente
            playAudio(sounds.select);
        }
    }

    function playNext(itemId) {
        // Si rien ne joue, on lance la lecture depuis la file utilisateur
        if (!currentPlayingItem) { 
            playVideoWhenReady(findItemById(itemId), [], -1, 'queue'); // Explicitly from queue
            return;
        }

        // Retire le titre s'il est déjà dans la file d'attente pour éviter les doublons
        const existingIndex = userQueue.indexOf(itemId);
        if (existingIndex > -1) {
            userQueue.splice(existingIndex, 1);
        }

        // Si le titre actuel est dans la file utilisateur, on insère après.
        const currentPlayingIndexInUserQueue = userQueue.indexOf(currentPlayingItem.id);
        if (currentPlayingIndexInUserQueue > -1) {
            userQueue.splice(currentPlayingIndexInUserQueue + 1, 0, itemId);
        } else {
            // Sinon, on l'ajoute simplement au début de la file d'attente à venir.
            // Cela signifie qu'il sera le prochain titre joué après celui en cours.
            userQueue.unshift(itemId);
        }

        showDialog(`"${findItemById(itemId).title}" ${getTranslation('playNext')}.`);
        updateAllQueueViews(); // CORRECTION: Met à jour toutes les vues de la file d'attente
        playAudio(sounds.select);
    }

    // NOUVEAU: Fonction pour afficher la file d'attente
    function renderQueue() {
        const container = document.getElementById('queue-container');
        const subtitle = document.getElementById('queue-context-subtitle');
        if (!container || !subtitle) return;

        // La file d'attente visible est TOUJOURS la userQueue.
        // On affiche les titres qui viennent après celui en cours s'il est dans la userQueue,
        // sinon on affiche toute la userQueue.
        const currentPlayingIndexInUserQueue = currentPlayingItem ? userQueue.indexOf(currentPlayingItem.id) : -1;
        let upcomingTracks = [];

        if (currentPlayingIndexInUserQueue > -1) {
            // Si le titre en cours est dans la file utilisateur, on affiche ce qui suit
            upcomingTracks = userQueue.slice(currentPlayingIndexInUserQueue + 1);
        } else {
            // Sinon, on affiche toute la file utilisateur comme "à venir"
            upcomingTracks = userQueue;
        }

        // Mettre à jour le sous-titre de contexte
        let contextText = '';
        if (currentPlayingItem) {
            switch (currentPlaybackContext.type) { // Use currentPlaybackContext to show where the current track is from
                case 'album':
                    contextText = `Lecture depuis l'album : <strong>${currentPlaybackContext.name}</strong>`;
                    break;
                case 'playlist':
                    contextText = `Lecture depuis la playlist : <strong>${currentPlaybackContext.name}</strong>`;
                    break;
                // On peut ajouter d'autres cas si besoin (ex: 'track', 'selection')
            }
        }
        subtitle.innerHTML = contextText;

        if (upcomingTracks.length === 0) {
            container.innerHTML = `<p style="text-align: center; padding: 20px 0;">Aucun titre à venir.</p>`;
            return;
        }

        container.innerHTML = '';
        upcomingTracks.forEach((itemId, index) => {
            const item = findItemById(itemId);
            if (!item) return;

            const queueItem = document.createElement('div');
            queueItem.className = 'playlist-item queue-item'; // Réutilise le style de playlist-item
            queueItem.dataset.itemId = itemId;
            queueItem.draggable = true;
            // NOUVEAU: Ajout d'un index pour faciliter la réorganisation
            queueItem.dataset.index = index;

            const isCurrentlyPlaying = currentPlayingItem && currentPlayingItem.id === itemId;
            if (isCurrentlyPlaying) {
                queueItem.classList.add('currently-playing');
            }

            queueItem.innerHTML = `
                <i class="fas fa-bars playlist-drag-handle" title="Réorganiser"></i>
                <img src="${getCorrectImagePath(item)}" alt="${item.title}">
                <div class="playlist-item-info">
                    <p class="playlist-item-title">${item.title}</p>
                    <p class="playlist-item-subtitle">${item.year || 'Vidéo'}</p>
                </div>
                ${isCurrentlyPlaying ? '<span class="currently-playing-indicator"><i class="fas fa-volume-up"></i></span>' : ''}
            `;

            // Gestion du clic pour sauter à ce titre (facultatif mais pratique)
            queueItem.addEventListener('click', (e) => {
                if (!e.target.closest('.playlist-drag-handle')) {
                    const newIndex = activePlaybackQueue.findIndex(id => id === itemId);
                    // On joue directement depuis la userQueue
                    const itemToPlay = findItemById(itemId);
                    const startIndex = userQueue.indexOf(itemId);
                    playVideoWhenReady(itemToPlay, userQueue, startIndex, 'queue');
                }
            });
            container.appendChild(queueItem);
        });
    }

    function renderPlaylist(options = {}) {
        const { openRecommendedPlaylist = null } = options;

        const overlay = document.getElementById('playlist-overlay');
        if (!overlay || overlay.classList.contains('hidden')) return;

        const tabsContainer = document.getElementById('playlist-tabs-container');
        const headerActions = document.getElementById('playlist-header-actions');
        const listContainer = document.getElementById('playlist-container');
        const titleElement = document.getElementById('playlist-overlay-title');
        const clearBtn = document.getElementById('clear-playlist-btn');
        // CORRECTION: Ensure elements exist before continuing
        if (!overlay || !tabsContainer || !listContainer || !titleElement || !clearBtn) return;

        // 1. Rendre les onglets
        let tabsHtml = `<button class="playlist-tab-btn active" data-playlist-id="custom">Ma Playlist</button>`;
        tabsHtml += Object.keys(savedPlaylists).map(name => 
            `<button class="playlist-tab-btn" data-playlist-id="${name}">${name}</button>`
        ).join('');
        tabsContainer.innerHTML = tabsHtml;

        // 2. Déterminer la playlist active
        const activeTab = tabsContainer.querySelector('.playlist-tab-btn.active');
        const activePlaylistId = activeTab.dataset.playlistId;

        let itemsToShow = [];
        let isCustomPlaylist = false;

        if (activePlaylistId === 'custom') {
            itemsToShow = currentPlaylist;
            titleElement.textContent = "Ma Playlist";
            isCustomPlaylist = true;
        } else {
            itemsToShow = savedPlaylists[activePlaylistId] || [];
            titleElement.textContent = activePlaylistId;
            isCustomPlaylist = false;
        }

        // 3. Afficher/cacher le bouton de suppression
        clearBtn.style.display = isCustomPlaylist ? 'flex' : 'none';

        // 4. Rendre la liste des titres
        if (itemsToShow.length === 0) {
            listContainer.innerHTML = `<p>${getTranslation("playlistEmpty")}</p>`;
            return;
        }

        listContainer.innerHTML = '';
        itemsToShow.forEach((itemId, index) => {
            const item = findItemById(itemId);
            if (!item) return;

            const isCurrentlyPlaying = currentPlayingItem && currentPlayingItem.id === itemId;
            const playlistItem = document.createElement('div');
            playlistItem.className = `playlist-item ${isCurrentlyPlaying ? 'currently-playing' : ''}`;
            playlistItem.dataset.itemId = itemId; 
            playlistItem.draggable = isCustomPlaylist; // Draggable only if it's the custom playlist

            const dragHandle = isCustomPlaylist ? '<i class="fas fa-bars playlist-drag-handle"></i>' : '<span class="playlist-drag-handle-placeholder"></span>';
            const deleteButton = isCustomPlaylist ? `<button class="playlist-item-delete" title="${getTranslation("deleteFromPlaylist")}"><i class="fas fa-trash-alt"></i></button>` : '';

            playlistItem.innerHTML = `
                ${dragHandle}
                <img src="${getCorrectImagePath(item)}" alt="${item.title}">
                <div class="playlist-item-info">
                    <p class="playlist-item-title">${item.title}</p>
                    <p class="playlist-item-subtitle">${item.year || 'Vidéo'}</p>
                </div>
                ${deleteButton}
                ${isCurrentlyPlaying ? '<span class="currently-playing-indicator"><i class="fas fa-volume-up"></i></span>' : ''}
            `;
            listContainer.appendChild(playlistItem);
        });
    }

    // =========================================================
    // PWA INSTALLATION LOGIC
    // =========================================================

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        console.log('`beforeinstallprompt` event was fired.');
    });

    function showPwaInstallPrompt() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (deferredPrompt && !isStandalone) {
            console.log('Showing PWA install prompt.');
            const pwaOverlay = document.getElementById('pwa-install-overlay');
            if (pwaOverlay) {
                pwaOverlay.classList.remove('hidden');
            }
        } else {
            console.log('PWA prompt not shown:', { deferredPrompt: !!deferredPrompt, isStandalone });
        }
    }


    // =========================================================
    // UI & GENERAL FUNCTIONS
    // =========================================================
    function playAudio(audioElement, force = false) {
        if ((!sfxEnabled && !force) || !audioElement) return;
        
        audioElement.currentTime = 0;
        audioElement.play().catch(error => {});
    }

    function getTranslation(key, replacements = {}) {
        let translation = translations[currentLang][key] || translations['en'][key] || `[${key}]`;
        for (const placeholder in replacements) {
            translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return translation;
    }

    function applyLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('mmg-lang', lang);

        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            const translation = getTranslation(key);
            if (el.placeholder) el.placeholder = translation;
            else el.textContent = translation;
        });

        document.querySelectorAll('[data-lang-title]').forEach(el => {
            const key = el.dataset.langTitle;
            el.title = getTranslation(key);
        });

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        // Re-render dynamic parts
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
        if (activeProfile) {
            const menuSection = document.getElementById('menu-cards-section');
            if (menuSection && !menuSection.classList.contains('hidden')) {
                renderCards('content-cards', siteData.projectData[activeProfile], 'menu'); // CORRECTION: Utilisation de la bonne variable
            }
        }
        if (currentPlayingItem) {
            updateMp3PlayerInfo(currentPlayingItem);
        } else {
            resetMiniPlayerUI();
        }

        // Re-render la vue actuelle
        if (currentViewContext.type) {
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
            const profileContent = siteData.contentData[activeProfile]; // Use profileContent
            switch (currentViewContext.type) {
                case 'titles':
                    const titlesForAlbum = Object.fromEntries(Object.entries(profileContent.titles).filter(([_, title]) => title.albumId === currentViewContext.data));
                    renderCards('titles-cards', titlesForAlbum, 'title');
                    break;
                // NOUVEAU: Gère la traduction de la page de détails d'un titre.
                case 'music-details':
                    const item = findItemById(currentViewContext.data);
                    if (item) renderMusicTitleDetails(item);
                    break;
                case 'liked':
                    handleMenuNavigation('liked-titles-section', false); // La fonction gère déjà la traduction
                    break;
                // NOUVEAU: Ajout du cas manquant pour la bibliothèque
                case 'library':
                    handleMenuNavigation('library-section', false, currentViewContext.data); // Restaure l'onglet actif
                    break;
                case 'about':
                    handleMenuNavigation('about-section', false); // La fonction gère déjà la traduction
                    break;
                case 'search':
                    updateVisibleCards(currentViewContext.data); // La fonction gère déjà la traduction
                    break;
                case 'albums':
                    handleMenuNavigation('albums-section', false); // La fonction gère déjà la traduction
                    break;
                // Ajouter d'autres cas si nécessaire
            }
        }

        // Re-render les overlays ouverts qui nécessitent une traduction
        const shopSection = document.getElementById('shop-section');
        if (shopSection && !shopSection.classList.contains('hidden')) {
            renderShopPage();
        }
        // Ajouter d'autres overlays si nécessaire
    }

    function renderShopPage() { // Render shop page
        // Initialise les icônes Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        updateCoinDisplay();
        renderShopMissions();
        renderShopItems();
        // NOUVEAU: Applique la logique de défilement aux titres des produits de la boutique.
        setupTitleScrollObserver('.shop-product-title > span');

    }

    function renderShopMissions() {
        const container = document.getElementById('missions-container');
        if (!container) return;

        container.innerHTML = Object.entries(achievements).map(([id, ach]) => {
            const { unlocked, progress, goal } = ach;
            let statusHtml = '';
            let cardClasses = 'mission-card';
            let iconHtml = `<i class="fas ${ach.icon}"></i>`;
            let progressText = '';

            let currentProgress = 0;
            if (id === 'loopMaster') {
                currentProgress = Math.max(0, ...Object.values(progress).map(Number));
            } else if (id === 'retroPlayer' || id === 'psPlayer') {
                currentProgress = progress.length;
            } else if (id === 'patienceIsKey') {
                currentProgress = progress; // Direct progress value
            }

            if (unlocked) {
                cardClasses += ' completed';
                statusHtml = `<span class="mission-card-status completed">Terminé</span>`;
                progressText = getTranslation(`achievement_${id}_desc`);
            } else {
                const percentage = Math.floor((currentProgress / goal) * 100);
                statusHtml = `<span class="mission-card-status progress">${percentage}%</span>`;
                progressText = `${getTranslation(`achievement_${id}_desc`)} (${currentProgress}/${goal})`;
            }

            return `
                <div class="${cardClasses}" data-mission-id="${id}">
                    <div class="mission-card-content">
                        <div class="mission-card-icon">${iconHtml}</div>
                        <div class="mission-card-info">
                            <h3>${getTranslation(`achievement_${id}_title`)}</h3>
                            <p>${progressText}</p>
                        </div>
                    </div>
                    ${statusHtml}
                </div>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons(); // Re-initialize icons if needed
        }
    }

    function renderShopItems() {
        const themesContainer = document.getElementById('themes-container');
        const backgroundsContainer = document.getElementById('backgrounds-container');
        if (!themesContainer || !backgroundsContainer || !siteData.shopItems) return;

        const { backgrounds, themes } = siteData.shopItems;

        // --- Rendu des Fonds d'écran ---
        backgroundsContainer.innerHTML = backgrounds.map(item => {
            const isPurchased = item.id === 'bg-default-theme' || purchasedShopItems.has(item.id) || item.cost === 0;
            // CORRECTION: La valeur par défaut pour la sélection est maintenant 'bg-default-theme'.
            const selectedBg = localStorage.getItem('bg-theme') || 'bg-default-theme';
            const isSelected = selectedBg === item.id;


            const circleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle"><circle cx="12" cy="12" r="10"/></svg>`;

            let buttonHtml;
            if (isSelected) {
                buttonHtml = `<button class="theme-buy-btn selected" disabled><i class="fas fa-check"></i></button>`;
            } else if (isPurchased) {
                buttonHtml = `<button class="theme-buy-btn" data-theme="${item.id}">${circleIcon}</button>`;
            } else {
                const coinIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>`;
                buttonHtml = `<button class="shop-buy-btn" data-item-id="${item.id}">${coinIconSvg} <span>${item.cost}</span></button>`;
            }

            // Utilise la clé de langue si elle existe, sinon le nom direct
            const itemName = item.nameKey ? getTranslation(item.nameKey) : item.name;

            return `
                <div class="shop-product-card card ${!isPurchased ? 'locked' : ''}" data-item-id="${item.id}">
                    <div class="card-image-container">
                        
                        <img src="${item.image}" alt="Aperçu de ${itemName}" class="card__image">
                    </div>
                    <div class="card-info-container">
                        <div class="card__text">
                            <p class="card__title shop-product-title"><span>${itemName}</span></p>
                        </div>
                        ${buttonHtml}
                    </div>
                </div>`;
        }).join('');

        // --- Rendu des Thèmes ---
        themesContainer.innerHTML = themes.map(item => {
            const isUnlocked = !item.missionId || (achievements[item.missionId] && achievements[item.missionId].unlocked);
            const isSelected = (localStorage.getItem('ui-theme') || 'default') === item.id;

            const circleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle"><circle cx="12" cy="12" r="10"/></svg>`;

            let actionHtml;
            if (isSelected) {
                actionHtml = `<button class="theme-buy-btn selected" disabled><i class="fas fa-check"></i></button>`;
            } else if (isUnlocked) {
                actionHtml = `<button class="theme-buy-btn" data-theme="${item.id}">${circleIcon}</button>`;
            } else {
                const lockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
                actionHtml = `<button class="theme-buy-btn locked" data-achievement="${item.missionId}">${lockIcon}</button>`;
            }

            // Utilise la clé de langue si elle existe, sinon le nom direct
            const itemName = item.nameKey ? getTranslation(item.nameKey) : item.name;

            return `
                <div class="shop-list-item card ${!isUnlocked ? 'locked' : ''}" data-item-id="${item.id}">
                    <div class="shop-list-item-icon-container">
                        <i data-lucide="palette"></i>
                    </div>
                    <div class="list-view-title">
                        <span class="font-medium text-sm sm:text-base text-text-color"><span>${itemName}</span></span>
                        <p class="shop-item-description">${isUnlocked ? getTranslation('themeUnlocked') : item.missionDescription}</p>
                    </div>
                    <div class="shop-list-item-action">
                        ${actionHtml}
                    </div>
                </div>`;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }


    // NOUVEAU: Met à jour la couleur de la barre de statut/navigation d'Android
    function updateThemeColorMeta() {
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            const isDark = document.body.classList.contains('dark-theme');
            // #ffffff pour le thème clair (couleur de la top-bar), #1f2937 pour le thème sombre.
            themeColorMeta.setAttribute('content', isDark ? '#1f2937' : '#ffffff');
        }
    }

    let activeOverlay = null;

    function openOverlay(overlay, sound, keepMusicPlaying = false) {
        if (activeOverlay === overlay) return;

        if (!keepMusicPlaying) {
            pausedForOverlay = (activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() === YT.PlayerState.PLAYING);
            if (pausedForOverlay) {
                activePlayer.pauseVideo();
            }
            document.getElementById('background-music').pause();
        }

        if (activeOverlay) { // If there's an active overlay, hide it
            activeOverlay.classList.add('hidden');
        }
        
        activeOverlay = overlay;
        activeOverlay.classList.remove('hidden');
        if (sound) playAudio(sound);

        if (overlay.id === 'playlist-overlay') {
            renderPlaylist();
        }

        if (overlay.id === 'queue-overlay') {
            renderQueue();
        }

        if (overlay.id === 'wifi-overlay') {
            playAudio(sounds.connecting, true);
            sounds.connecting.onended = () => {
                if(activeOverlay && activeOverlay.id === 'wifi-overlay') { // If wifi overlay is active
                    closeOverlay(sounds.back);
                    updateAchievementProgress('patienceIsKey');
                    showDialog(getTranslation("connectionSuccess"));
                }
            };
        }
    }

    function closeOverlay(sound) {
        if (!activeOverlay) return;
        
        const wasPlayerOptionsOverlay = activeOverlay.id === 'player-options-overlay';
        const keepMusicPlaying = activeOverlay.id === 'tags-filter-overlay' || (activeOverlay.id === 'tutorial-overlay' && !isTutorialActive); // Keep music playing for certain overlays
        if (activeOverlay.id === 'wifi-overlay' && sounds.connecting) {
            sounds.connecting.pause();
            sounds.connecting.currentTime = 0;
            sounds.connecting.onended = null;
        }

        activeOverlay.classList.add('hidden'); // Hide active overlay
        activeOverlay = null;
        if (sound) playAudio(sound);

        if (!keepMusicPlaying) {
            if (pausedForOverlay) {
                if(activePlayer) {
                    isResumingFromOverlay = true;
                    activePlayer.playVideo();
                }
            } else if (document.getElementById('settings-bg-music-switch').checked && (!currentPlayingItem || (activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() !== 1))) {
                document.getElementById('background-music').play();
            }
        }
        pausedForOverlay = false;
    }

    function handleShopClick(e) {
        const buyButton = e.target.closest('.shop-buy-btn');
    }

    function updateTime() {
        const timeString = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const desktopTime = document.getElementById('real-time');
        if (desktopTime) desktopTime.textContent = timeString;
        const mobileTime = document.getElementById('mobile-real-time');
        if (mobileTime) mobileTime.textContent = timeString;
    }
    
    /**
     * Récupère le chemin de l'image pour un élément, en choisissant la taille appropriée.
     * @param {object} item - L'objet de l'élément (titre, album, etc.).
     * @param {'thumb' | 'full'} size - La taille de l'image souhaitée ('thumb' pour la vignette, 'full' pour la taille réelle).
     * @returns {string} Le chemin de l'image.
     */
    function getCorrectImagePath(item, size = 'full') {
        if (!item) {
            return 'https://placehold.co/200x120/9E9E9E/FFFFFF?text=No+Image';
        }

                if (size === 'thumb') {
            // Construit le chemin de la vignette à partir de l'image principale.
            // "path/image.webp" devient "path/image_thumb.webp"
            const lastDotIndex = item.image.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                return `${item.image.substring(0, lastDotIndex)}_thumb${item.image.substring(lastDotIndex)}`;
            }
        }
        return item.image; // Retourne l'image principale pour 'full' ou en cas d'échec
    }

    function renderCards(containerId, cardsData, cardType = 'generic') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        // Réinitialiser les styles qui pourraient être ajoutés pour le message vide
        container.style.display = '';
        container.style.alignItems = '';
        container.style.justifyContent = '';
        container.style.height = '';

        // CORRECTION: Utiliser un DocumentFragment pour améliorer les performances de rendu et éviter les bugs d'affichage.
        const fragment = document.createDocumentFragment();

        // MODIFICATION: Affiche un message différent si la section est vide par design vs. pas de résultats de recherche.
        if (Object.keys(cardsData).length === 0) {
            const isSearchResult = containerId === 'search-results-cards';
            // CORRECTION: Vider les en-têtes de liste s'il n'y a pas de résultats
            const header = document.querySelector(`[data-header-for="${containerId}"]`);
            if (header) {
                header.innerHTML = '';
                header.classList.add('hidden');
            }

            const isLikedEmpty = containerId === 'liked-titles-cards';
            const emptyMessageKey = (isSearchResult || isLikedEmpty) ? 'noResults' : 'workInProgress';

            // Modifier le conteneur pour centrer le message
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.height = '100%';
            container.innerHTML = `<p style="font-size: 1.2em; opacity: 0.7; white-space: nowrap;">${getTranslation(emptyMessageKey)}</p>`;
            return;
        }

        // CORRECTION: On détermine la vue à utiliser en se basant sur le localStorage.
        // C'est la source de vérité unique pour le rendu.
        const globalView = localStorage.getItem('mmg-global-view') || 'grid';
        // CORRECTION: La vue "album" est toujours en grille.
        const isListView = cardType === 'album' ? false : globalView === 'list';

        // NOUVEAU: Gérer l'affichage de l'en-tête de la liste
        // On applique la traduction directement ici pour éviter les boucles d'appel.
        const header = document.querySelector(`[data-header-for="${containerId}"]`);
        if (header) {
            if (isListView) {
                header.classList.remove('hidden');
                header.innerHTML = `
                    <div class="whitespace-nowrap">#</div>
                    <div></div> <!-- CORRECTION: Ajout d'un div vide pour la colonne de l'image -->
                    <div class="whitespace-nowrap" data-lang-key="titles">${getTranslation('titles')}</div> 
                    <div class="whitespace-nowrap list-view-artist-col">${getTranslation('titleAndArtist').split(' & ')[1] || 'Artiste'}</div>
                    <div class="tags-column whitespace-nowrap list-view-tags-col" data-lang-key="tags">${getTranslation('tags')}</div>
                    <div class="hidden sm:block"></div>
                    <div class="hidden sm:block"></div>`;
            } else {
                header.innerHTML = '';
                header.classList.add('hidden');
            }
        }

        // Maintenant on applique la classe au conteneur en se basant sur la vue qu'on a décidé de rendre.
        container.classList.toggle('list-view', isListView);
        container.classList.toggle('titles-grid', !isListView);

        const toggleBtn = document.querySelector(`.view-toggle-btn[data-target-container="${containerId}"]`);
        if (toggleBtn) {
            const svgIcon = toggleBtn.querySelector('svg');
            if (globalView === 'list' && cardType !== 'album') {
                // CORRECTION: Si on est en liste, on montre l'icône pour passer en GRILLE
                svgIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>`;
            } else {
                // CORRECTION: If in grid view (default), show list icon
                svgIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"></path>`;
            }
        }

        let delay = 0;
        Object.entries(cardsData).forEach(([key, item], index) => {
            const card = document.createElement('div');
            // MODIFICATION: Ajout de la classe 'card-menu' pour le ciblage CSS
            card.className = cardType === 'menu' ? 'card card-menu' : 'card';
            card.style.animationDelay = `${delay}s`;
            delay += 0.05;

            const itemId = item.id || key;
            card.dataset.itemId = itemId;
            
            const isUnlockableAlbum = cardType === 'album' && item.isUnlockableAlbum;
            const tracksInAlbum = isUnlockableAlbum ? Object.values(allSearchableItems).filter(t => t.albumId === item.id && t.isUnlockable) : [];
            const unlockedInAlbum = isUnlockableAlbum ? tracksInAlbum.filter(t => unlockedDreamSeasonTracks.includes(t.id)) : [];
            
            const isTrackLocked = item.isUnlockable && !unlockedDreamSeasonTracks.includes(itemId);
            const isAlbumLocked = isUnlockableAlbum && unlockedInAlbum.length < tracksInAlbum.length;
            const isLocked = isTrackLocked || isAlbumLocked;

            if (isLocked) {
                card.classList.add('locked');
            }

            // CORRECTION: Assigne une image de remplacement si l'image est nulle ou manquante (cas des playlists recommandées vides).
            // La fonction getCorrectImagePath est appelée uniquement si une image existe.
            // MODIFICATION: On charge la vignette par défaut pour les cartes.
            const imagePath = getCorrectImagePath(item, 'thumb');
            const fullImagePath = getCorrectImagePath(item, 'full');
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
            const translatedTitle = item.langKey ? getTranslation(item.langKey) : item.title;
            const isActionable = (cardType === 'title' || cardType === 'video' || (cardType === 'search' && item.type !== 'album')); // Actionable if it's a playable item
            const isLiked = likedSongs.has(itemId);
            const isInPlaylist = currentPlaylist.includes(itemId);
            const tagsSubtitle = (item.tags && item.tags.length > 0) ? `<p class="card__description">${item.tags.join(', ')}</p>` : '';
            const lockIconHtml = isLocked && cardType !== 'title' && !isAlbumLocked ? ' <i class="fas fa-lock" style="font-size: 0.8em; opacity: 0.7;"></i>' : '';
            const cardTextHtml = `<p class="card__title" title="${translatedTitle.replace(/"/g, '&quot;')}"><span>${translatedTitle}${lockIconHtml}</span></p>${tagsSubtitle}`;
            const actionsHtml = isActionable ? `
                <div class="card-actions">
                    <i class="like-btn-card ${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'active' : ''}" data-like-id="${itemId}" title="${getTranslation('like')}"></i>
                    <i class="fas ${isInPlaylist ? 'fa-check' : 'fa-plus'} add-playlist-btn-card ${isInPlaylist ? 'added' : ''}" data-playlist-id="${itemId}" title="${getTranslation('removePlaylist') || 'Retirer'}"></i>
                </div>` : '';

            let datasetAttributes = ''; // Dataset attributes for the link
            if (cardType === 'title' || cardType === 'video' || cardType === 'search') {
                datasetAttributes = `data-youtube-id="${item.youtube_id}"`;
            } else if (cardType === 'album') {
                datasetAttributes = `data-album-id="${item.id}"`;
            } else if (cardType === 'menu') {
                datasetAttributes = `data-link="${item.link}"`;
            }

            if (isListView && (cardType === 'title' || cardType === 'video' || cardType === 'search')) { // If it's a list view and a playable item
                // NOUVEAU: Structure HTML pour la vue en liste
                const activeProfileData = siteData.contentData[document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'];
                const artistName = activeProfileData === siteData.contentData['mmg-music'] ? 'Mmg Music' : 'Mmg Beats'; // CORRECTION: Utilisation du nom de l'artiste pour le filtre
                const tagsHtml = (item.tags && item.tags.length > 0) 
                    ? `<span class="tag-item" data-action="filter-tag" data-tag="${item.tags[0]}">${item.tags[0]}</span>`
                    : '';

                // NOUVEAU: Ajout de l'icône de cadenas pour les titres bloqués en mode liste
                const lockIconHtmlList = isLocked ? '<div class="list-view-lock-overlay"><i class="fas fa-lock"></i></div>' : '';

                // CORRECTION: Retour à une structure HTML unique et stable pour la vue en liste.
                card.innerHTML = `
                    <div class="list-view-index-container">
                        <span class="list-view-index text-sub-text-color text-sm">${index + 1}</span>
                        <div class="list-view-equalizer">
                            <div class="bar"></div><div class="bar"></div><div class="bar"></div>
                        </div>
                    </div>
                    <div class="list-view-image-container">
                        <img src="${imagePath}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${fullImagePath}'" alt="Pochette de ${translatedTitle}" class="list-view-item-image"/>
                        ${lockIconHtmlList}
                    </div>
                    <div class="list-view-title">
                        <span class="font-medium text-sm sm:text-base text-text-color">${translatedTitle}</span>
                        ${isAlbumLocked ? `
                            <span class="list-view-unlock-text">
                                ${getTranslation(unlockedInAlbum.length > 1 ? 'trackToUnlock_many' : 'trackToUnlock_one', { count: tracksInAlbum.length - unlockedInAlbum.length })}
                            </span>
                        ` : ''}
                    </div> 
                    <div class="text-sub-text-color text-xs truncate items-center list-view-artist-col"><span>${artistName}</span></div>
                    <div class="tags-column text-sub-text-color text-xs items-center min-w-0 list-view-tags-col">${tagsHtml}</div>
                    <div class="flex items-center justify-center"><i class="like-btn-card ${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'active' : ''}" data-like-id="${itemId}" title="${getTranslation('like')}"></i></div>
                    <div class="flex items-center justify-center"><i class="fas ${isInPlaylist ? 'fa-check' : 'fa-plus'} add-playlist-btn-card ${isInPlaylist ? 'added' : ''}" data-playlist-id="${itemId}" title="${isInPlaylist ? getTranslation('removePlaylist') : getTranslation('addPlaylist')}"></i></div>
                `;

                // CORRECTION: La gestion des clics est maintenant plus précise pour éviter les conflits.
                card.addEventListener('click', (e) => {
                    const likeBtn = e.target.closest('.like-btn-card');
                    const addBtn = e.target.closest('.add-playlist-btn-card');
                    const filterAction = e.target.closest('[data-action="filter-tag"]');

                    // CORRECTION: Gère le clic sur un élément bloqué en mode liste
                    if (isTrackLocked && !likeBtn && !addBtn && !filterAction) {
                        playAudio(sounds.blocked);
                        showDialog(getTranslation('trackLocked')); // Affiche la boîte de dialogue
                        return; // Empêche toute autre action, comme la lecture.
                    } else if (isAlbumLocked && !likeBtn && !addBtn && !filterAction) {
                        playAudio(sounds.blocked);
                        return; // Empêche toute autre action, comme la lecture.
                    }

                    if (likeBtn) {
                        e.stopPropagation(); // Empêche le clic de se propager à la carte
                        toggleLike(itemId);
                    } else if (addBtn) {
                        e.stopPropagation(); // Empêche le clic de se propager à la carte
                        togglePlaylistItem(itemId);
                    } else if (filterAction) {
                        e.stopPropagation(); // Empêche le clic de se propager à la carte
                        const tag = filterAction.dataset.tag;
                        document.getElementById('search-input').value = ''; // Vide la recherche
                        // Coche le bon tag dans le filtre
                        document.querySelectorAll('#tags-filter-list input').forEach(cb => cb.checked = cb.value === tag.toLowerCase());
                        // Met à jour les cartes affichées
                        updateVisibleCards();
                    } else {
                        // Si on ne clique sur aucune action, on lance la lecture.
                        let originType = 'titles'; // Default
                        const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id;
                        if (currentSectionId === 'library-section') {
                            const activeLibraryTab = document.querySelector('#library-tabs-container .playlist-tab-btn.active');
                            if (activeLibraryTab && activeLibraryTab.dataset.tabId === 'liked') {
                                originType = 'liked';
                            } else if (activeLibraryTab && (savedPlaylists[activeLibraryTab.dataset.tabId])) {
                                // NOUVEAU: Si c'est une playlist sauvegardée (qui peut être une playlist Mmg)
                                originType = 'mmgPlaylist';
                            } else if (activeLibraryTab && activeLibraryTab.dataset.tabId === 'current' ) {
                                // C'est la playlist personnalisée de l'utilisateur
                                originType = 'myPlaylist';
                            } // Saved playlists are also 'myPlaylist'
                        } else if (currentSectionId === 'search-results-section') {
                            originType = 'search';
                        }
                        playVideoWhenReady(item, [], -1, originType); // Pass originType
                    }
                });

            } else {
                // Structure HTML existante pour la vue en grille
                const badgeHtml = item.loopable ? `<div class="card__badge">LOOP ME!</div>` : '';
                let cardImageHtml;
                let gridCardTextHtml;

                if (cardType === 'menu') {
                    // ... (logique pour les cartes du menu, inchangée)
                } else {
                    cardImageHtml = `<img class="card__image" loading="lazy" decoding="async" src="${imagePath}" onerror="this.onerror=null;this.src='${fullImagePath}'" alt="${translatedTitle.replace(/"/g, '&quot;')}">`;
                    
                    // CORRECTION: La logique de description est réorganisée pour éviter les écrasements et utiliser le fallback.
                    let description = getTranslation('viewContent'); // Valeur par défaut
                    switch (cardType) {
                        case 'title':
                            // CORRECTION: Si la traduction n'existe pas, on utilise la description de data.json.
                            const translatedDesc = getTranslation(`desc_${item.id}`); // ex: [desc_title1] si non trouvé
                            description = (translatedDesc.startsWith('[')) ? (item.description || getTranslation('listenToTitle')) : translatedDesc;
                            break;
                        case 'album':
                            if (isUnlockableAlbum) {
                                const lockedCount = tracksInAlbum.length - unlockedInAlbum.length;
                                if (lockedCount > 0) {
                                    const langKey = lockedCount === 1 ? 'trackToUnlock_one' : 'trackToUnlock_many';
                                    card.classList.add('has-unlockable-text');
                                    description = getTranslation(langKey, { count: lockedCount });
                                } else {
                                    description = getTranslation('viewAlbum');
                                }
                            } else {
                                description = getTranslation('viewAlbum');
                            }
                            break;
                        case 'video': description = getTranslation('videoOrMakingOf'); break;
                        case 'search': // Search results can be albums, titles, or videos
                            description = item.type === 'album' ? getTranslation('viewAlbum') : (item.year ? getTranslation('musicTitle') : getTranslation('videoOrMakingOf')); 
                            break;
                    }
                    gridCardTextHtml = `
                        <p class="card__title" title="${translatedTitle.replace(/"/g, '&quot;')}">
                        <span>${translatedTitle}</span>
                        </p>
                        <p class="card__description">${description}</p>
                    `;                
                }

                let lockOverlayHtml = '';
                if (isTrackLocked) { // If track is locked
                    lockOverlayHtml = `
                    <div class="lock-overlay">
                        <i class="fas fa-lock"></i>
                        <span class="unlock-cost">${COIN_COST_UNLOCK}</span>
                    </div>`;
                } else if (isAlbumLocked) {
                    datasetAttributes = `data-unlock-album="${item.id}"`;
                    lockOverlayHtml = `<div class="lock-overlay"><i class="fas fa-lock"></i></div>`;
                }

                card.innerHTML = `
                    <a href="#" class="card-link-wrapper" ${datasetAttributes}>
                        <div class="card-image-container">
                            ${lockOverlayHtml}
                            ${badgeHtml}
                            ${cardImageHtml}
                        </div>
                    </a>
                    <div class="card-info-container">
                        <div class="card__text">${gridCardTextHtml}</div>
                        ${isActionable ? actionsHtml : ''}
                    </div>`;
            }

            // NOUVEAU: Logique pour le menu contextuel (clic droit / appui long)
            if (isActionable) {
                // Clic droit sur ordinateur
                card.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    openCardContextMenu(e, itemId);
                });

                // Appui long sur mobile
                let longPressTimer;
                let touchStartX = 0;
                let touchStartY = 0;

                card.addEventListener('touchstart', (e) => {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    longPressTimer = setTimeout(() => {
                        openCardContextMenu(e, itemId);
                    }, 500); // 500ms pour un appui long
                }, { passive: true });

                const clearLongPress = () => clearTimeout(longPressTimer);
                card.addEventListener('touchend', clearLongPress);
                card.addEventListener('touchcancel', clearLongPress);
                card.addEventListener('touchmove', (e) => {
                    const touchEndX = e.touches[0].clientX;
                    const touchEndY = e.touches[0].clientY;
                    // Annule l'appui long si l'utilisateur commence à faire défiler
                    if (Math.abs(touchEndX - touchStartX) > 10 || Math.abs(touchEndY - touchStartY) > 10) {
                        clearLongPress();
                    }
                });
            }
            
            container.appendChild(card);
            fragment.appendChild(card); // Add to fragment
        });

        container.appendChild(fragment); // On ajoute toutes les cartes en une seule fois.

        // CORRECTION: La logique de défilement est maintenant unifiée et appelée pour TOUTES les vues (grille et liste)
        // directement depuis renderCards, ce qui garantit son application à chaque fois que des cartes sont affichées.
        if (isListView) {
            // En mode liste, on cible les <span> à l'intérieur des colonnes qui peuvent déborder.
            const listSelectors = `#${containerId} .list-view-title > span, #${containerId} .list-view-artist-col > span, #${containerId} .recent-video-item-info .video-title > span`;
            setupTitleScrollObserver(listSelectors);
        } else {
            // En mode grille, on cible les <span> à l'intérieur des titres de carte standards.
            const gridSelector = `#${containerId} .card__title > span, #${containerId} .carousel-item-info h3 > span, #${containerId} .recent-video-item-info .video-title > span`;
            setupTitleScrollObserver(gridSelector);
        }
    }
    
    // NOUVEAU: Fonctions pour générer les icônes SVG de la liste
    function getLikeSvg(isLiked) {
        const likedClass = isLiked ? 'liked' : '';
        const heartFill = isLiked ? 'red' : 'none';
        const heartStroke = isLiked ? 'red' : 'currentColor';
        return `
            <svg class="action-icon ${likedClass}" viewBox="0 0 24 24" stroke="${heartStroke}" stroke-linecap="round" stroke-linejoin="round" fill="${heartFill}">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
        `;
    }

    function getAddSvg() {
        return `
            <svg class="action-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <path d="M12 5v14M5 12h14" />
            </svg>
        `;
    }

    // NOUVEAU: Fonctions pour gérer les clics sur les icônes de la liste
    function handleLikeClick(event, trackId) {
        event.stopPropagation();
        toggleLike(trackId);
    }

    function handleAddClick(event, trackId) {
        event.stopPropagation();
        togglePlaylistItem(trackId);
    }

    function updateCardPlaylistButtonState(itemId) {
        // CORRECTION: Utiliser querySelectorAll pour mettre à jour toutes les instances de la carte
        const cardPlaylistBtns = document.querySelectorAll(`.card[data-item-id="${itemId}"] .add-playlist-btn-card`);
        if (cardPlaylistBtns.length === 0) return;
    
        const isInPlaylist = currentPlaylist.includes(itemId);
        cardPlaylistBtns.forEach(btn => {
            btn.classList.toggle('fa-check', isInPlaylist);
            btn.classList.toggle('fa-plus', !isInPlaylist);
            btn.classList.toggle('added', isInPlaylist);
            btn.title = isInPlaylist ? getTranslation("removePlaylist") : getTranslation("addPlaylist");
        });

        // NOUVEAU: Mettre à jour l'icône dans la nouvelle vue en liste
        const listLikeBtn = document.querySelector(`.card[data-item-id="${itemId}"] .action-btn-like svg`);
        if (listLikeBtn) {
            const isLiked = likedSongs.has(itemId);
            listLikeBtn.classList.toggle('liked', isLiked);
            listLikeBtn.setAttribute('fill', isLiked ? 'red' : 'none');
            listLikeBtn.setAttribute('stroke', isLiked ? 'red' : 'currentColor');
        }
    }

    function updateDetailsPlaylistButtonState() {
        const detailsSection = document.getElementById('music-title-details-section');
        const btn = document.getElementById('details-add-to-playlist-btn');
        if (!detailsSection || !btn) return;

        const currentItemId = detailsSection.dataset.currentItemId;
        if (!currentItemId) return;

        const isInPlaylist = currentPlaylist.includes(currentItemId);

        if (isInPlaylist) {
            btn.innerHTML = `<i class="fas fa-check"></i> <span data-lang-key="addedToPlaylist">${getTranslation("addedToPlaylist")}</span>`;
            btn.classList.add('added');
        } else {
            btn.innerHTML = `<i class="fas fa-plus"></i> <span data-lang-key="addToPlaylist">${getTranslation("addToPlaylist")}</span>`;
            btn.classList.remove('added');
        }
    }

    function renderMusicTitleDetails(item) {
        currentViewContext = { type: 'music-details', data: item.id }; // NOUVEAU: Définit le contexte de la vue actuelle.
        document.getElementById('music-title-details-section').dataset.currentItemId = item.id;
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        const album = siteData.contentData[activeProfile].albums[item.albumId];
        // MODIFICATION: Charger l'image en pleine résolution ici.
        document.getElementById('details-album-art').src = getCorrectImagePath(item, 'full');
        document.getElementById('details-title').textContent = item.title;
        const albumSpan = document.getElementById('details-album');
        albumSpan.textContent = album ? album.title : getTranslation('unknown');
        albumSpan.parentElement.dataset.albumId = item.albumId;
        const yearSpan = document.getElementById('details-year');
        yearSpan.textContent = item.year || getTranslation('unknown');
        yearSpan.parentElement.dataset.year = item.year || ''; 
        // CORRECTION: La logique est la même que pour les cartes. On vérifie si la traduction existe.
        const translatedDesc = getTranslation(`desc_${item.id}`);
        document.getElementById('details-description').textContent = (translatedDesc.startsWith('[')) ? (item.description || '') : translatedDesc;

        document.getElementById('details-tags').innerHTML = (item.tags || []).map(tag => `<span class="tag-item" data-action="filter-tag" data-tag="${tag}">${tag}</span>`).join('');

        const streamingContainer = document.getElementById('streaming-links');
        streamingContainer.innerHTML = '';
        if (item.streaming) {
            const platformConfig = {
                spotify: { icon: 'fab fa-spotify', base_url: 'https://open.spotify.com/album/' },
                appleMusic: { icon: 'fab fa-apple', base_url: 'https://music.apple.com/fr/album/' },
                youtube: { icon: 'fab fa-youtube', base_url: 'https://www.youtube.com/watch?v=' },
                deezer: { icon: 'fab fa-deezer', base_url: 'https://www.deezer.com/album/' },
                amazonMusic: { icon: 'fab fa-amazon', base_url: 'https://amazon.fr/music/player/albums/' },
                tidal: { icon: 'fas fa-record-vinyl', base_url: 'https://tidal.com/browse/album/' }
            };

            for (const [platform, id] of Object.entries(item.streaming)) {
                if (platformConfig[platform] && id && id.trim() !== '') {
                    const link = document.createElement('a');
                    link.href = platformConfig[platform].base_url + id;
                    link.target = '_blank'; 
                    link.title = `Écouter sur ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
                    link.innerHTML = `<i class="${platformConfig[platform].icon}"></i>`;
                    streamingContainer.appendChild(link);
                }
            }
        }
        renderAssociatedVideos(item);
        updateTempPlayButtonVisibility();
        updateDetailsPlaylistButtonState();
    }

    function renderAssociatedVideos(musicItem) {
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
        const gameplayContainer = document.getElementById('gameplay-video-container');
        const makingofContainer = document.getElementById('makingof-video-container');
        gameplayContainer.innerHTML = `<h4 data-lang-key="gameplayVideo">${getTranslation('gameplayVideo')}</h4>`;
        makingofContainer.innerHTML = `<h4 data-lang-key="makingOfVideo">${getTranslation('makingOfVideo')}</h4>`;

        const createVideoCard = (video) => {
            const card = document.createElement('div'); // Changed to div to avoid nested <a>
            card.className = 'associated-video-card card-link-wrapper'; // Added card-link-wrapper for consistent behavior
            card.dataset.youtubeId = video.youtube_id; // Keep for click handling
            card.dataset.itemId = video.id;
            card.innerHTML = `
                <img src="${getCorrectImagePath(video)}" alt="${video.title}" onerror="this.src='https://placehold.co/100x56/000/fff?text=Error';">
                <p>${video.title}</p>
            `;
            return card;
        };
        
        let foundGameplay = false;
        let foundMakingOf = false;
        
        if (musicItem.associatedVideos && musicItem.associatedVideos.length > 0) {
            musicItem.associatedVideos.forEach(videoId => {
                const video = findItemById(videoId);
                if (video) {
                    // This logic assumes videos in 'gameplay' are gameplay and others are making-of.
                    // This could be improved by adding a 'type' to video items in data.json.
                    if (siteData.contentData[activeProfile].videos[videoId]) {
                        gameplayContainer.appendChild(createVideoCard(video));
                        foundGameplay = true;
                    } else if (siteData.contentData[activeProfile].bonus[videoId]) {
                        makingofContainer.appendChild(createVideoCard(video));
                        foundMakingOf = true;
                    }
                }
            });
        }
        
        if (!foundGameplay) {
            gameplayContainer.innerHTML += `<p>${getTranslation('noAssociatedVideo')}</p>`;
        }
        if (!foundMakingOf) {
            makingofContainer.innerHTML += `<p>${getTranslation('noAssociatedVideo')}</p>`;
        }
    }


    function renderVideoSuggestions() {
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        const allContent = {...siteData.contentData[activeProfile].titles, ...siteData.contentData[activeProfile].gameplay};
        const suggestions = Object.values(allContent)
            .filter(item => item.id !== currentPlayingItem?.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 4);
        renderCards('suggestions-cards', suggestions, 'video');
    }

    function updateMp3PlayerInfo(item) {
        if (item && item.title) {
            document.getElementById('song-title').textContent = item.title;
            // CORRECTION: Mettre à jour le lecteur mobile avec la logique de défilement
            const mobilePlayerTitle = document.getElementById('mobile-player-title');
            const mobilePlayerArtist = document.getElementById('mobile-player-artist');
            mobilePlayerTitle.querySelector('span').textContent = item.title;
            checkTitleOverflow(mobilePlayerTitle);

            const activeProfileData = siteData.contentData[document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'];
            const artistName = activeProfileData === siteData.contentData['mmg-music'] ? 'Mmg Music' : 'Mmg Beats';
            mobilePlayerArtist.querySelector('span').textContent = artistName;
            checkTitleOverflow(mobilePlayerArtist);

            // MODIFICATION: Utiliser l'image pleine résolution pour tous les lecteurs.
            const imageSrc = isMusicTitle(item)
                ? getCorrectImagePath(item, 'full') // On charge la grande image
                : `https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg`; // Pour les vidéos, on garde l'image de YT
            document.getElementById('player-album-cover').src = imageSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3C/svg%3E"; 
            document.getElementById('mobile-player-album-art').src = imageSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3C/svg%3E";
            const miniPlayerTitle = document.getElementById('mini-player-title');
            const miniPlayerContext = document.getElementById('mini-player-context'); // Pour mobile
            const desktopPlayerContext = document.getElementById('desktop-player-context'); // Pour ordinateur
    
            if (miniPlayerTitle) {
                miniPlayerTitle.querySelector('span').textContent = item.title;
                miniPlayerTitle.parentElement.classList.remove('no-track'); // CORRECTION: Retire la classe de centrage
                checkTitleOverflow(miniPlayerTitle); // CORRECTION: Applique la logique de défilement
            }

            // CORRECTION: Le mini-lecteur utilise la vignette pour un chargement plus rapide, avec un fallback vers l'image complète.
            const miniPlayerArt = document.getElementById('mini-player-album-art');
            miniPlayerArt.src = isMusicTitle(item) ? getCorrectImagePath(item, 'thumb') : imageSrc;
            miniPlayerArt.onerror = () => { miniPlayerArt.onerror = null; miniPlayerArt.src = imageSrc; };
            // CORRECTION: Mettre à jour le contexte dans le mini-lecteur avec la nouvelle logique
            if (miniPlayerContext || desktopPlayerContext) {
                let contextText = ''; // Initialize contextText
                switch (currentPlaybackContext.type) {
                    case 'album':
                    case 'search':
                    case 'track':
                        contextText = getTranslation('fromTitles');
                        break;
                    case 'selection':
                        contextText = getTranslation('fromPlaybackQueue');
                        break;
                    case 'playlist':
                        contextText = getTranslation('fromMyPlaylist'); // Utilise la clé spécifique pour "Ma Playlist"
                        break;
                    case 'video':
                        contextText = getTranslation('fromVideos');
                        break;
                    case 'liked':
                        contextText = getTranslation('fromLiked');
                        break;
                    case 'mmgPlaylist':
                        contextText = getTranslation('fromMmgPlaylists');
                        break;
                }
                if (miniPlayerContext) miniPlayerContext.textContent = contextText;
                if (desktopPlayerContext) desktopPlayerContext.textContent = contextText;
            }
    
            // On s'assure que la pochette est de nouveau visible et opaque
            const miniAlbumArt = document.getElementById('mini-player-album-art');
            if(miniAlbumArt) miniAlbumArt.style.opacity = '1';
            updatePlayerPlaylistButtonUI(item.id); // NOUVEAU: Mettre à jour le bouton playlist du lecteur
            
            // NOUVEAU: S'assurer que les contrôles et l'image sont visibles
            const miniPlayerControls = document.getElementById('mini-player-controls');
            if (miniPlayerControls) miniPlayerControls.style.display = 'flex';
            const miniPlayerAlbumArt = document.getElementById('mini-player-album-art');
            if (miniPlayerAlbumArt) miniPlayerAlbumArt.style.display = 'block';

            updateLikeButtonUI(item.id);
        }
    }

    // NOUVEAU: Met à jour l'icône "Ajouter à la playlist" sur les lecteurs
    function updatePlayerPlaylistButtonUI(itemId) {
        const desktopBtn = document.getElementById('player-add-to-playlist-btn');
        const mobileBtn = document.getElementById('mobile-player-add-to-playlist-btn');
        const buttons = [desktopBtn, mobileBtn].filter(Boolean); // Filtre les éléments non trouvés

        if (buttons.length === 0 || !currentPlayingItem || currentPlayingItem.id !== itemId) return;
    
        const isInPlaylist = currentPlaylist.includes(itemId);

        buttons.forEach(btn => {
            btn.classList.toggle('fa-plus', !isInPlaylist);
            btn.classList.toggle('fa-check', isInPlaylist);
            btn.classList.toggle('added', isInPlaylist); // 'added' peut avoir un style spécifique (ex: couleur)
            btn.title = getTranslation(isInPlaylist ? 'removePlaylist' : 'addPlaylist');
        });
    }
    
    function resetMiniPlayerUI() {
        // MODIFICATION: Le mini-lecteur se masque (se baisse) lorsqu'il n'y a pas de titre.
        const miniPlayer = document.getElementById('mobile-mini-player');
    
        if (miniPlayer) {
            // CORRECTION: On ne cache plus le lecteur, on le met en position repliée.
            // La classe 'mobile-player-hidden' sur le body gère l'animation de descente.
            document.body.classList.add('mobile-player-hidden');
            document.documentElement.style.setProperty('--mobile-player-height', '0px');
        }

        // Réinitialisation du lecteur de bureau
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('song-title').textContent = getTranslation('noTrackPlaying');
        document.getElementById('player-album-cover').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3C/svg%3E";

        // CORRECTION: Réinitialise le contenu du mini-lecteur mobile sans le cacher.
        const miniPlayerTitle = document.getElementById('mini-player-title');
        if (miniPlayerTitle) {
            miniPlayerTitle.querySelector('span').textContent = '';
            miniPlayerTitle.parentElement.classList.add('no-track');
        }
        document.getElementById('mini-player-album-art').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3C/svg%3E";
        document.getElementById('mini-player-progress-fill').style.width = '0%';

        const mobilePlayerTitle = document.getElementById('mobile-player-title');
        const mobilePlayerArtist = document.getElementById('mobile-player-artist');
        mobilePlayerTitle.querySelector('span').textContent = getTranslation('noTrackPlaying');
        mobilePlayerArtist.querySelector('span').textContent = ''; // CORRECTION: Affiche une chaîne vide au lieu de "..."
        mobilePlayerTitle.classList.remove('scrolling');
        mobilePlayerArtist.classList.remove('scrolling');

        document.getElementById('mobile-player-album-art').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3C/svg%3E";
        document.getElementById('mobile-player-progress-fill').style.width = '0%';
        document.getElementById('mobile-player-current-time').textContent = '0:00';
        document.getElementById('mobile-player-duration').textContent = '0:00';
        // Ensure buttons are in their default state
        document.getElementById('mobile-player-play-pause-btn').className = 'fas fa-play';
        // NOUVEAU: Retire le surlignage de la carte
        unhighlightPlayingCard();
    }

    function updateProgressBar() {
        if (!activePlayer || typeof activePlayer.getDuration !== 'function' || !currentPlayingItem) return;
        
        const duration = activePlayer.getDuration();
        if (duration > 0) { // If duration is valid
            const currentTime = activePlayer.getCurrentTime();
            listenProgress = currentTime / duration;

            // MISE À JOUR: Affichage des temps
            document.getElementById('progress-fill').style.width = `${listenProgress * 100}%`;
            document.getElementById('current-time-display').textContent = formatTime(currentTime);
            document.getElementById('duration-display').textContent = formatTime(duration);

            if (previousListenProgress > 0) { // If there was previous progress
            // NOUVEAU: Mettre à jour la barre de progression mobile
            const mobileProgressBar = document.getElementById('mobile-player-progress-fill');
            if (mobileProgressBar) {
                mobileProgressBar.style.width = `${listenProgress * 100}%`;
            }
            const miniPlayerProgressBar = document.getElementById('mini-player-progress-fill');
            if (miniPlayerProgressBar) {
                miniPlayerProgressBar.style.width = `${listenProgress * 100}%`;
            }
            const mobileCurrentTime = document.getElementById('mobile-player-current-time');
            if (mobileCurrentTime) {
                mobileCurrentTime.textContent = formatTime(currentTime);
            }
            const mobileDuration = document.getElementById('mobile-player-duration');
            if (mobileDuration) {
                mobileDuration.textContent = formatTime(duration);
            }
    

                const progressDifference = listenProgress - previousListenProgress;
                const seekThreshold = 2 / duration; 
                if (duration > 2 && Math.abs(progressDifference) > seekThreshold) {
                    seekDetectedInCurrentPlay = true;
                }
            }
            previousListenProgress = listenProgress; // Update previous progress
        }
        updateMediaPositionState(); // Crucial pour la lecture en arrière-plan
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function scaleToShowSection(sectionId) {
        const sectionsContainer = document.querySelector('.content-section-board');
        const currentSection = sectionsContainer.querySelector('.page-section:not(.hidden)');
        const nextSection = document.getElementById(sectionId);

        if (!nextSection || (currentSection && currentSection.id === sectionId)) {
            return; // No change or invalid section
        }

        const animationDuration = 400;

        if (currentSection) {
            currentSection.classList.add('is-scaling-out');
        }

        nextSection.style.animation = 'scale-in-fade 0.4s ease-out forwards';

        setTimeout(() => {
            if (currentSection) {
                currentSection.classList.add('hidden');
                currentSection.classList.remove('is-scaling-out');
            }
            nextSection.classList.remove('hidden');

            if (!history.state || history.state.section !== sectionId) {
                history.pushState({ section: sectionId, fromApp: true }, '', '#' + sectionId);
            }
        }, animationDuration); // Wait for animation to complete
    } 

    function showSection(sectionId, updateHistory = true) {
        const sectionsContainer = document.querySelector('.content-section-board');
        const currentSection = sectionsContainer.querySelector('.page-section:not(.hidden)');
        const nextSection = document.getElementById(sectionId);
    
        if (!nextSection || (currentSection && currentSection.id === sectionId)) {
            // CORRECTION: Même si la section ne change pas, on remonte en haut.
            // Useful if clicking the same menu link twice.
            const contentBoard = document.querySelector('.content-section-board');
            if (contentBoard) {
                contentBoard.scrollTop = 0;
            }
            return;
        }
    
        const animationDuration = 300; // Durée de l'animation de sortie en ms
    
        // Fonction pour effectuer le changement de section
        const switchSections = () => { // Function to switch sections
            // CORRECTION: Remonte en haut de la zone de contenu à chaque changement de section.
            const contentBoard = document.querySelector('.content-section-board');
            if (contentBoard) {
                contentBoard.scrollTop = 0;
            }

            document.querySelectorAll('.content-section-board .page-section').forEach(s => {
                s.classList.add('hidden');
                s.classList.remove('is-hiding');
            });
            nextSection.classList.remove('hidden');
    
            if (updateHistory && (!history.state || history.state.section !== sectionId)) {
                // CORRECTION: S'assurer que le contexte de la vue actuelle est à jour avant de le sauvegarder.
                // C'est crucial lorsque l'on quitte la bibliothèque.
                if (currentSection && currentSection.id === 'library-section') {
                    const activeTab = document.querySelector('#library-tabs-container .playlist-tab-btn.active');
                    if (activeTab) {
                        currentViewContext = { type: 'library', data: activeTab.dataset.tabId };
                    }
                }
    
                history.replaceState({ ...history.state, context: currentViewContext }, '', window.location.hash);
                const stateToPush = { section: sectionId, fromApp: true, context: null };
                history.pushState(stateToPush, '', '#' + sectionId);
            }
            // CORRECTION : Mettre à jour la visibilité du bouton APRÈS que la section soit réellement visible.
            updateTempPlayButtonVisibility();

            // NOUVEAU: Apply highlighting AFTER the new section is visible.
            highlightPlayingCard(currentPlayingItem);

            // CORRECTION: Mettre à jour la sidebar APRÈS que la section a changé
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
            if (activeProfile) {
                renderSidebarNav(activeProfile);
            }
        };
    
        // NOUVEAU: Retire le surlignage de la carte avant de naviguer
        unhighlightPlayingCard(); // Remove highlight before navigating
        if (currentSection) {
            currentSection.classList.add('is-hiding');
            setTimeout(switchSections, animationDuration);
        } else {
            switchSections(); // Pas de section actuelle, on affiche directement la nouvelle
        }
    }
    
    function updateTempPlayButtonVisibility() {
        const btn = document.getElementById('temp-play-btn');
        if (!btn) return;

        const musicDetailsVisible = !document.getElementById('music-title-details-section').classList.contains('hidden');
        
        if (!isAutoplayActive && musicDetailsVisible) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }

    function updateVisibleCards(customTitle = null) {
        const query = document.getElementById('search-input').value.toLowerCase().trim();
        const checkedTags = Array.from(document.querySelectorAll('#tags-filter-list input:checked')).map(cb => cb.value);

        // NOUVEAU: Mettre à jour le badge de filtre
        const filterBadge = document.getElementById('tags-filter-count');
        if (filterBadge) {
            filterBadge.textContent = checkedTags.length > 0 ? checkedTags.length : '';
            filterBadge.classList.toggle('hidden', checkedTags.length === 0);
        }
    
        if (query === '' && checkedTags.length === 0) {
            if (document.getElementById('tags-filter-overlay').classList.contains('hidden') && document.getElementById('search-results-section').classList.contains('hidden') === false) {
                 resetToHome(); 
            }
            return;
        }

        const filteredResults = Object.fromEntries(Object.entries(allSearchableItems).filter(([key, item]) => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const tagTextMatch = (item.tags || []).some(tag => tag.toLowerCase().includes(query));
            let albumTitleMatch = false; // Check for album title match
            if(item.albumId && siteData.contentData['mmg-music'].albums[item.albumId]) {
                 albumTitleMatch = siteData.contentData['mmg-music'].albums[item.albumId].title.toLowerCase().includes(query);
            }

            const itemTags = (item.tags || []).map(t => t.toLowerCase());
            const tagsMatch = checkedTags.length === 0 || checkedTags.every(tag => itemTags.includes(tag));
            
            return (titleMatch || tagTextMatch || albumTitleMatch) && tagsMatch;
        })); // Filter items based on query and tags
        
        const isPlaying = currentPlayingItem && activePlayer && typeof activePlayer.getPlayerState === 'function' && 
                          (activePlayer.getPlayerState() === YT.PlayerState.PLAYING || activePlayer.getPlayerState() === YT.PlayerState.PAUSED);

        // NOUVEAU: Logique pour un titre de recherche plus descriptif
        let titleParts = [];
        if (query) {
            titleParts.push(`${getTranslation('searchFor')}: "${query}"`);
        }
        if (checkedTags.length > 0) {
            const tagsString = checkedTags.map(t => `"${t}"`).join(', ');
            titleParts.push(`${getTranslation('contentWithTag')}: ${tagsString}`);
        }

        let titleToSet = titleParts.join(' & ');
        if (!titleToSet) titleToSet = getTranslation('searchResults');

        document.getElementById('search-results-title').innerHTML = titleToSet; // Use innerHTML for quotes
        currentViewContext = { type: 'search', data: customTitle };
        showSection('search-results-section', true, false);
        renderCards('search-results-cards', filteredResults, 'search');
    }

    function setupTagFilters() {
        const tagsToExclude = new Set(['snow', 'western', 'desert', 'dream']);
        const allTags = new Set(Object.values(allSearchableItems).flatMap(item => item.tags || []).filter(tag => !tagsToExclude.has(tag)));

        const container = document.getElementById('tags-filter-list');
        container.innerHTML = '';
        Array.from(allTags).sort().forEach(tag => {
            const tagId = `tag-${tag.toLowerCase().replace(/\s/g, '-')}`;
            const tagDiv = document.createElement('div');
            tagDiv.className = 'tag-filter-item';
            tagDiv.innerHTML = `<input type="checkbox" id="${tagId}" value="${tag.toLowerCase()}"><label for="${tagId}">${tag}</label>`;
            container.appendChild(tagDiv);
        });
    }

    function showDialog(message) {
        const dialog = document.getElementById('custom-dialog');
        dialog.querySelector('p').textContent = message;
        dialog.classList.remove('hidden');
        setTimeout(() => dialog.classList.add('hidden'), 2500);
    }
    
    function showBigDialog(message) {
        const dialog = document.getElementById('big-dialog');
        if (!dialog) return;
        dialog.querySelector('p').textContent = message;
        dialog.classList.remove('hidden');
        dialog.classList.remove('fade-out');
        
        setTimeout(() => {
            dialog.classList.add('fade-out');
            // Cache l'élément après la fin de l'animation de fondu
            setTimeout(() => dialog.classList.add('hidden'), 500);
        }, 10000); // Le message reste 10 secondes
    }

    // CORRECTION: La logique d'application des thèmes est entièrement revue pour être plus robuste.
    function applyTheme(themeName) {
        const isBgTheme = siteData.shopItems.backgrounds.some(bg => bg.id === themeName) || themeName === 'bg-default-theme';
        const { themes, backgrounds } = siteData.shopItems;

        if (isBgTheme) {
            // 1. Sauvegarder la préférence de l'utilisateur
            localStorage.setItem('bg-theme', themeName);

            // 2. Retirer tous les anciens thèmes d'arrière-plan pour repartir de zéro
            backgrounds.forEach(bg => document.body.classList.remove(bg.id));

            // 3. Appliquer le nouveau thème SEULEMENT si ce n'est PAS le thème par défaut.
            // Si c'est 'bg-default-theme', on ne fait rien, ce qui laisse le CSS du thème d'UI
            // (ex: le quadrillage de Spotimon) s'appliquer.
            // On vérifie aussi que ce n'est pas 'bg-1' pour éviter d'ajouter une classe inutile,
            // car c'est l'état de base sans classe.
            if (themeName !== 'bg-default-theme' && themeName !== 'bg-1') {
                document.body.classList.add(themeName);
            }

        } else { // C'est un thème d'interface
            // 1. Retirer tous les anciens thèmes d'interface
            themes.forEach(theme => document.body.classList.remove(theme.id));
            // 2. Ajouter le nouveau thème (sauf si c'est le défaut)
            if (themeName !== 'default') {
                document.body.classList.add(themeName);
            }
            // 3. Sauvegarder la préférence
            localStorage.setItem('ui-theme', themeName);
        }

        // 4. Mettre à jour l'état visuel des boutons dans la boutique
        // CORRECTION: On redessine toute la boutique pour garantir que l'ancien élément est bien désélectionné visuellement.
        renderShopItems();
    }

    function updateShopLocksAndSelection() {
        const currentUiTheme = localStorage.getItem('ui-theme') || 'default';
        // CORRECTION: La valeur par défaut pour le fond est maintenant 'bg-default-theme'.
        const currentBgTheme = localStorage.getItem('bg-theme') || 'bg-default-theme';
    
        // CORRECTION: Cible tous les boutons d'action des thèmes et arrière-plans
        document.querySelectorAll('.shop-list-item-action .theme-buy-btn, .shop-product-card .theme-buy-btn, .shop-product-card .shop-buy-btn').forEach(btn => {
            const achievementId = btn.dataset.achievement;
            const themeId = btn.dataset.theme;

            if (!themeId) {
                return; // Skip this button if it doesn't have a theme id.
            }
    
            btn.disabled = false;
            btn.classList.remove('locked', 'selected');

            if (achievementId && achievements[achievementId] && !achievements[achievementId].unlocked) {
                btn.classList.add('locked');
                // CORRECTION: Utilisation du SVG du cadenas pour une taille de bouton cohérente.
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
                btn.disabled = true;
            } else {
                // CORRECTION: La logique est unifiée pour utiliser des icônes SVG pour tous les états, garantissant une taille de bouton cohérente.
                // La détection de la sélection est plus fiable.
                const isSelected = (siteData.shopItems.backgrounds.some(bg => bg.id === themeId) && themeId === currentBgTheme) || (siteData.shopItems.themes.some(t => t.id === themeId) && themeId === currentUiTheme);
                const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`;
                const circleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle"><circle cx="12" cy="12" r="10"/></svg>`;
                
                if (isSelected) {
                    btn.classList.add('selected');
                    btn.innerHTML = checkIcon;
                    btn.disabled = true;
                } else if (!btn.classList.contains('shop-buy-btn')) {
                    // Pour un thème débloqué mais non sélectionné, on affiche un cercle.
                    btn.innerHTML = circleIcon;
                }
            }
        });
    }
    // CORRECTION: Définition de la fonction manquante
    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('mmg-theme') || 'light';
        const savedUiTheme = localStorage.getItem('ui-theme') || 'default';
        const savedBgTheme = localStorage.getItem('bg-theme') || 'bg-default-theme';
    
        document.getElementById('theme-switch').checked = savedTheme === 'dark';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');

        // Appliquer le thème d'UI
        if (savedUiTheme !== 'default') document.body.classList.add(savedUiTheme);
        
        // Appliquer le thème de fond
        if (savedBgTheme !== 'bg-default-theme') {
            document.body.classList.add(savedBgTheme);
        }
        updateThemeColorMeta(); // NOUVEAU: Applique la couleur de thème au chargement
    } // Apply background theme as well

    function resetToHome(playSelectSound = true) {
        if (playSelectSound) playAudio(sounds.select);
        handleMenuNavigation('home-dashboard-section');
    }
    
    function renderSidebarNav(activeProfile) {
        const navContainer = document.getElementById('sidebar-main-nav');
        if (!navContainer) return;

        const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id || 'home-dashboard-section'; // Get current section ID

        // CORRECTION: Utilisation des icônes Lucide pour la cohérence avec la version mobile.
        const iconMap = {
            'albums': 'disc-album',
            'videos': 'tv',
            'about': 'info',
            'library': 'library',
            'shop': 'shopping-bag'
        };

        // Séparer les liens du profil et le lien "À propos"
        const profileData = Object.values(siteData.projectData[activeProfile] || {});
        const aboutItem = profileData.find(item => item.langKey === 'about');
        const otherProfileItems = profileData.filter(item => item.langKey !== 'about');

        const profileLinks = otherProfileItems.map(item => { // Map other profile items to links
            const isActive = item.link === currentSectionId;
            return `
                <a href="#" class="sidebar-nav-link ${isActive ? 'active' : ''}" data-link="${item.link}">
                    <i data-lucide="${iconMap[item.langKey] || 'help-circle'}"></i>
                    <span data-lang-key="${item.langKey}">${getTranslation(item.langKey) || item.title}</span>
                </a>`;
        }).join('');

        // Création des liens statiques (Bibliothèque, Boutique, À propos)
        const libraryIsActive = currentSectionId === 'library-section';
        const libraryLink = `
            <a href="#" class="sidebar-nav-link ${libraryIsActive ? 'active' : ''}" data-link="library-section">
                <i data-lucide="${iconMap['library']}"></i>
                <span data-lang-key="library">${getTranslation('library')}</span>
            </a>`;

        const shopIsActive = currentSectionId === 'shop-section';
        const shopLink = `
            <a href="#" class="sidebar-nav-link ${shopIsActive ? 'active' : ''}" data-link="shop-section">
                <i data-lucide="${iconMap['shop']}"></i>
                <span data-lang-key="shop">${getTranslation('shop')}</span>
            </a>`;

        // Création du lien "À propos"
        const aboutIsActive = aboutItem && aboutItem.link === currentSectionId;
        const aboutLink = aboutItem ? `
            <a href="#" class="sidebar-nav-link ${aboutIsActive ? 'active' : ''}" data-link="${aboutItem.link}">
                <i data-lucide="${iconMap[aboutItem.langKey] || 'info'}"></i>
                <span data-lang-key="${aboutItem.langKey}">${getTranslation(aboutItem.langKey)}</span>
            </a>` : '';

        // Assemble in correct order
        navContainer.innerHTML = profileLinks + libraryLink + shopLink + aboutLink;

        // CORRECTION: Ré-initialise les icônes Lucide après avoir mis à jour le HTML.
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function setVolume(volume, fromUI = false) {
        currentVolume = Math.max(0, Math.min(100, volume));
        document.querySelectorAll('#volume-level-display').forEach(el => el.textContent = currentVolume);
        
        const volumeFraction = currentVolume / 100;
        if (largePlayer?.setVolume) largePlayer.setVolume(currentVolume);
        if (mediumPlayer?.setVolume) mediumPlayer.setVolume(currentVolume);

        // NOUVEAU: Mettre à jour le curseur de volume mobile
        const mobileVolumeLevel = document.getElementById('mobile-volume-level');
        if (mobileVolumeLevel) {
            mobileVolumeLevel.style.width = `${currentVolume}%`;
            mobileVolumeLevel.parentElement.setAttribute('aria-valuenow', currentVolume); // Pour l'accessibilité
        }
        Object.values(sounds).forEach(sound => { if (sound) sound.volume = volumeFraction; }); // Set volume for all sounds

        if(fromUI) playAudio(sounds.hover);
    }

    function checkTitleOverflow(titleSpan) {
        // L'élément observé est maintenant le <span> lui-même.
        const container = titleSpan.parentElement; // Le conteneur est le parent du span (ex: .list-view-title ou .card__title)
        if (!container) return;

        container.classList.remove('scrolling');
        container.style.setProperty('--overflow-width', '0px');

        requestAnimationFrame(() => {
            const isOverflown = titleSpan.scrollWidth > container.clientWidth + 1;
            if (isOverflown) {
                const overflowAmount = titleSpan.scrollWidth - container.clientWidth; // Calculate overflow amount
                const duration = Math.max(3, (overflowAmount / 40) + 1); 
                container.style.setProperty('--overflow-width', `-${overflowAmount + 10}px`);
                container.style.setProperty('--scroll-duration', `${duration}s`);
                container.classList.add('scrolling');
            }
        });
    }

    function setupTitleScrollObserver(containerSelector) {
        if (titleScrollObserver) titleScrollObserver.disconnect();
        const options = { root: document.querySelector('.content-section-board'), rootMargin: '0px', threshold: 0.8 };

        titleScrollObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    checkTitleOverflow(entry.target);
                } else {
                    entry.target.classList.remove('scrolling');
                }
            });
        }, options);
    
        if (titleResizeObserver) titleResizeObserver.disconnect();
        titleResizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                checkTitleOverflow(entry.target); // Re-check overflow on resize
            }
        });
    
        const titlesToObserve = document.querySelectorAll(containerSelector);
        titlesToObserve.forEach(title => {
            titleScrollObserver.observe(title);
            titleResizeObserver.observe(title);
        });
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================
    function initializeApp() {
        document.body.style.cursor = '';

        initUserData();

        // CORRECTION: Rendre la sidebar immédiatement pour éviter le flash de contenu vide.
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'; // Get active profile
        renderSidebarNav(activeProfile);
        
        resetMiniPlayerUI();
        setupTagFilters();
        renderUpdateLog();
        updateTime();
        setInterval(updateTime, 30000);

        applyInitialTheme();
        
        setVolume(100);
        setupEventListeners();

        const initialSectionId = window.location.hash.substring(1);
        let sectionToLoad = 'home-dashboard-section';
        
        // --- HISTORY TRAP SETUP --- // Setup history trap
        // 1. Replace the current history entry with a "trap" entry. This is the page we will prevent the user from reaching.
        // CORRECTION: Toujours rediriger vers le tableau de bord au rechargement.
        history.replaceState({ section: 'home-dashboard-section', fromApp: true, isTrap: true }, '', '#home-dashboard-section');

        // 2. Push the actual main menu state on top of the trap. This is the page the user will see and be returned to.
        history.pushState({ section: 'home-dashboard-section', fromApp: true }, '', '#home-dashboard-section');

        sectionToLoad = 'home-dashboard-section';

        // Final and unique call to update notifications
        updateNotificationDot();

        // CORRECTION: Affiche l'invite d'installation PWA après un court délai
        // pour ne pas être intrusive dès le départ.
        setTimeout(showPwaInstallPrompt, 5000);

        handleMenuNavigation(sectionToLoad, false); // This will show the correct section without adding to history.

        // PWA Service Worker Registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Listener for messages from the Service Worker // Add message listener
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data && event.data.action) {
                        console.log(`Action received from SW: ${event.data.action}`);
                        switch (event.data.action) {
                            case 'play':
                                if (activePlayer) activePlayer.playVideo();
                                break;
                            case 'pause':
                                if (activePlayer) activePlayer.pauseVideo();
                                break;
                            case 'nexttrack':
                                playNextTrack(1, true);
                                break;
                            case 'previoustrack':
                                playNextTrack(-1, true);
                                break;
                            case 'stop':
                                if (activePlayer) activePlayer.stopVideo();
                        }
                    }
                });
            });
        }
    }

    // =========================================================
    // EVENT LISTENERS & NAVIGATION LOGIC
    // =========================================================
    const playNextTrack = (direction = 1, forcePlay = false, isSwipe = false) => {
        if (!forcePlay && !isAutoplayActive) playAudio(sounds.select); // Ne joue pas de son si c'est l'autoplay
        let nextItem; // Next item to play
        let nextIndex;
        let nextItemId;
        let playbackSource = 'context'; // Par défaut, on utilise la file de contexte

        // 1. Priorité à la file d'attente utilisateur (userQueue)
        const currentPlayingIndexInUserQueue = currentPlayingItem ? userQueue.indexOf(currentPlayingItem.id) : -1;

        if (currentPlayingIndexInUserQueue > -1 && userQueue.length > 1) {
            // Le titre actuel est dans la file utilisateur, on joue le suivant de cette file
            nextIndex = (currentPlayingIndexInUserQueue + direction + userQueue.length) % userQueue.length;
            nextItemId = userQueue[nextIndex];
            playbackSource = 'user';
        } else if (userQueue.length > 0) {
            // Le titre actuel n'est PAS dans la file utilisateur, mais la file utilisateur n'est pas vide.
            // On joue le premier titre de la file utilisateur.
            nextItemId = userQueue[0];
            nextIndex = 0;
            playbackSource = 'user';
        } else {
            // 2. Fallback: la file de lecture de contexte (contextPlaybackQueue)
            if (contextPlaybackQueue.length === 0 || currentQueueIndex === -1) {
                renderVideoSuggestions();
                showSection('video-suggestions-section', true, true);
                return;
            }
            nextIndex = (currentQueueIndex + direction + contextPlaybackQueue.length) % contextPlaybackQueue.length;
            nextItemId = contextPlaybackQueue[nextIndex];
        }

        const currentQueue = playbackSource === 'user' ? userQueue : contextPlaybackQueue;

        // Logique de lecture aléatoire (s'applique à la file en cours d'utilisation)
        if (isShuffleMode && (forcePlay || isAutoplayActive)) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * currentQueue.length);
            } while (currentQueue.length > 1 && randomIndex === (playbackSource === 'user' ? currentPlayingIndexInUserQueue : currentQueueIndex));
            nextIndex = randomIndex;
            nextItemId = currentQueue[nextIndex];
        }

        nextItem = findItemById(nextItemId);
        
        if (nextItem) {
            if (isAutoplayActive || forcePlay) {
                // Si on joue depuis la userQueue, le type de contexte est 'queue'
                const originType = playbackSource === 'user' ? 'queue' : currentPlaybackContext.type;
                playVideoWhenReady(nextItem, currentQueue, nextIndex, originType, false, true, isSwipe);
            } else {
                 renderMusicTitleDetails(nextItem);
                 showSection('music-title-details-section');
             updateTempPlayButtonVisibility(); // CORRECTION: Assure que le bouton "Play" réapparaît
            }
        }
    };
    
    function setupEventListeners() {
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                playAudio(sounds.back); // Play back sound
                if (isTutorialActive || document.getElementById('home-dashboard-section').classList.contains('hidden') === false) return;

                // NOUVEAU: Si on est dans la bibliothèque, on retourne à l'accueil.
                const librarySection = document.getElementById('library-section');
                if (librarySection && !librarySection.classList.contains('hidden')) {
                    resetToHome(false); // false pour ne pas jouer le son 'select' en plus
                    return;
                }
            
                const menuSection = document.getElementById('menu-cards-section');
                // NOUVEAU: Gère la fermeture de l'overlay de la pochette avec le bouton retour
                if (!document.getElementById('artwork-overlay').classList.contains('hidden')) {
                    document.getElementById('artwork-overlay').classList.add('hidden');
                    // L'événement popstate qui suit va nettoyer l'historique
                    return;
                }

                if (menuSection && !menuSection.classList.contains('hidden')) {
                    // If on the main menu, do nothing, let the browser handle it (which will trigger our trap) // Handle main menu
                    return;
                }
            
                window.history.back();
            });
        }

        // NOUVEAU: Gestionnaire pour le switch de profil mobile
        const mobileProfileSwitch = document.getElementById('mobile-profile-switch');
        if (mobileProfileSwitch) {
            mobileProfileSwitch.addEventListener('click', (e) => {
                const button = e.target.closest('.profile-switch-btn'); // Get the clicked button
                if (!button || button.classList.contains('active')) return;
    
                // Simule un clic sur l'onglet de profil correspondant dans la sidebar (qui est cachée)
                const targetProfile = button.dataset.project;
                const desktopTab = document.querySelector(`.profile-tab[data-project="${targetProfile}"]`);
                if (desktopTab) {
                    desktopTab.click();
                    // Mettre à jour l'état visuel du switch mobile
                    document.querySelectorAll('#mobile-profile-switch .profile-switch-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                }
            });
        }

        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default link behavior
                resetToHome();
            });
        }

        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.isTrap) {
                history.forward();
                return; // If it's a trap, go forward
            }
            // NOUVEAU: Gère la fermeture de l'overlay de la pochette via le bouton retour du navigateur/téléphone
            if (event.state && event.state.overlay === 'artwork') {
                document.getElementById('artwork-overlay').classList.add('hidden');
                return;
            }

            // CORRECTION: La logique est simplifiée. On passe l'état complet à handleMenuNavigation.
            const sectionId = event.state?.section || 'home-dashboard-section';
            const context = event.state?.context || null;
            handleMenuNavigation(sectionId, false, context);
        });


        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const previousProfile = document.querySelector('.profile-tab.active')?.dataset.project;

                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const activeProfile = tab.dataset.project;

                if (!previousProfile || previousProfile === activeProfile) { // If no change or error
                    return; // Pas de changement ou erreur, on ne fait rien.
                }

                // Logique de navigation intelligente
                const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id || 'home-dashboard-section';
                let sectionToLoad = 'home-dashboard-section'; // Par défaut, on retourne à l'accueil.
                const commonSections = ['library-section']; // CORRECTION: La bibliothèque est une section commune.

                if (commonSections.includes(currentSectionId)) { // If on a common section, stay there.
                    sectionToLoad = currentSectionId;
                }

                if (currentSectionId !== 'home-dashboard-section') {
                    const prevItem = Object.values(siteData.projectData[previousProfile]).find(p => p.link === currentSectionId);
                    if (prevItem) {
                        const equivalentSection = Object.values(siteData.projectData[activeProfile]).find(item => {
                            // Compare par langKey pour trouver l'équivalent (ex: 'videoClips') ou par le lien pour les sections communes
                            return item.langKey === prevItem.langKey || item.link === prevItem.link;
                        });

                        if (equivalentSection) {
                            sectionToLoad = equivalentSection.link;
                        }
                    }
                }
                renderSidebarNav(activeProfile); // Update sidebar immediately
                handleMenuNavigation(sectionToLoad); // Navigue vers la section équivalente ou l'accueil
            });
        });
        
        // CORRECTION: L'écouteur est sur .main-board pour couvrir le header et le footer
        const mainWrapper = document.getElementById('main-content-wrapper');
        
        mainWrapper.addEventListener('click', (e) => { // Add click listener to main wrapper
            // ... (le reste du code de l'animation de clic)

            // CORRECTION: Ajout de TOUS les boutons du lecteur mobile (mini, plein écran, header) et de la barre de navigation à la liste des sélecteurs pour l'animation.
            const iconButton = e.target.closest('.top-bar-btn, .player-buttons > i, .controls-box, .player-right-controls > i, .mobile-player-controls > i, .mobile-player-play-box, .mobile-player-secondary-controls > i, .mobile-player-header-btn, .mini-player-controls > i, .mobile-nav-link, #mobile-player-autoplay-btn');
            if (iconButton) {
                // Si c'est le bouton play/pause mobile, on anime l'icône à l'intérieur
                const targetForAnimation = iconButton.id === 'mobile-player-play-pause-box' ? iconButton.querySelector('i') : iconButton;

                iconButton.classList.remove('icon-pop'); // Reset animation class
                void iconButton.offsetWidth; // Trigger reflow
                iconButton.classList.add('icon-pop');
            }
            
            // CORRECTION: Gestion du clic sur les boutons de guide du tableau de bord pour un lancement direct.
            const guideButton = e.target.closest('.guide-choice-btn[data-guide]');
            if (guideButton) {
                e.preventDefault();
                const guideKey = guideButton.dataset.guide;

                if (guideKey === 'main') {
                    resetToHome(false); // Retour à l'accueil sans son
                } else if (guideKey === 'music') {
                    // Prépare la vue pour le guide musical, comme si on cliquait depuis le menu
                    const musicProfileTab = document.querySelector('.profile-tab[data-project="mmg-music"]');
                    if (musicProfileTab && !musicProfileTab.classList.contains('active')) {
                        musicProfileTab.click();
                    }
                    const firstAlbumId = Object.keys(siteData.contentData['mmg-music'].albums)[0];
                    const titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData['mmg-music'].titles).filter(([_, title]) => title.albumId === firstAlbumId));
                    renderCards('titles-cards', titlesForAlbum, 'title');
                    showSection('titles-section');
                }
                startTutorial(guideKey); // Lance le guide directement
                return; // On arrête ici pour ne pas traiter d'autres clics
            }

            // CORRECTION: Gère le clic sur le bouton de changement de vue pour l'isoler de la navigation.
            const viewToggleBtn = e.target.closest('.view-toggle-btn');
            if (viewToggleBtn) {
                // CORRECTION : La logique est maintenant gérée ici directement pour éviter les pertes d'écouteurs.
                e.preventDefault();
                e.stopPropagation();
                playAudio(sounds.select);
                const targetContainerId = viewToggleBtn.dataset.targetContainer;
                if (!targetContainerId) return;

                const currentView = localStorage.getItem('mmg-global-view') || 'grid';
                const newView = currentView === 'grid' ? 'list' : 'grid';
                localStorage.setItem('mmg-global-view', newView);

                if (targetContainerId === 'library-container') {
                    const activeTab = document.querySelector('#library-tabs-container .playlist-tab-btn.active');
                    renderLibraryPage(activeTab ? activeTab.dataset.tabId : 'liked');
                } else if (targetContainerId === 'titles-cards' && currentViewContext.type === 'titles' && currentViewContext.data) {
                    const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                    const albumId = currentViewContext.data;
                    const titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
                    renderCards('titles-cards', titlesForAlbum, 'title');
                } else {
                    const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                    const dataKey = targetContainerId.replace('-cards', '');
                    const sectionData = siteData.contentData[activeProfile][dataKey] || siteData.contentData[activeProfile][dataKey.replace('s', '')];
                    const cardType = (dataKey === 'albums') ? 'album' : 'video';
                    renderCards(targetContainerId, sectionData, cardType);
                }

                highlightPlayingCard(currentPlayingItem);
                return;
            }

            // CORRECTION: Ajout de la logique manquante pour le bouton "like" des cartes en mode grille.
            const likeBtn = e.target.closest('.like-btn-card');
            if (likeBtn) {
                e.preventDefault();
                e.stopPropagation();
                toggleLike(likeBtn.dataset.likeId);
                return;
            }

            const playlistBtn = e.target.closest('.add-playlist-btn-card');
            if (playlistBtn) {
                e.preventDefault();
                e.stopPropagation(); // Stop event propagation
                togglePlaylistItem(playlistBtn.dataset.playlistId);
                return;
            }
            
            const detailsPlaylistBtn = e.target.closest('#details-add-to-playlist-btn');
            if (detailsPlaylistBtn) {
                e.preventDefault();
                e.stopPropagation(); // Stop event propagation
                const currentItemId = document.getElementById('music-title-details-section').dataset.currentItemId;
                if(currentItemId) {
                    togglePlaylistItem(currentItemId);
                }
                return;
            }

            const filterTagAction = e.target.closest('[data-action="filter-tag"]');
            if(filterTagAction) {
                e.preventDefault();
                e.stopPropagation(); // Stop event propagation
                const tag = filterTagAction.dataset.tag;
                document.getElementById('search-input').value = '';
                document.querySelectorAll('#tags-filter-list input').forEach(cb => cb.checked = false);
                const tagCheckbox = document.querySelector(`#tags-filter-list input[value="${tag.toLowerCase()}"]`);
                if (tagCheckbox) {
                    tagCheckbox.checked = true;
                }
                updateVisibleCards();
                return;
            }
            
            const yearLink = e.target.closest('#details-year-link');
            if (yearLink) {
                e.preventDefault();
                e.stopPropagation(); // Stop event propagation
                const year = yearLink.dataset.year;
                if (year) {
                    playAudio(sounds.select);
                    document.getElementById('search-input').value = '';
                    document.querySelectorAll('#tags-filter-list input').forEach(cb => cb.checked = false);
                    
                    const yearResults = Object.fromEntries(Object.entries(allSearchableItems).filter(([_, item]) => item.year === year));
                    document.getElementById('search-results-title').textContent = year;
                    renderCards('search-results-cards', yearResults, 'search');
                    showSection('search-results-section');
                }
            }

            const associatedVideo = e.target.closest('.associated-video-card');
            if (associatedVideo) {
                e.preventDefault(); // CORRECTION: Moved here to be more specific
                const itemId = associatedVideo.dataset.itemId;
                const item = findItemById(itemId);
                if (item) {
                    playAudio(sounds.select);
                    playVideoWhenReady(item, [], -1, 'video'); // Explicitly from video

            // NOUVEAU: Afficher le bouton du lecteur mobile
            const playerToggleBtn = document.getElementById('mobile-player-toggle-btn');
            if (playerToggleBtn) playerToggleBtn.style.display = 'flex';

                }
                return;
            }

            const link = e.target.closest('a.card-link-wrapper, .sidebar-nav-link, .dashboard-card-button, .carousel-item, .recent-video-item, .dashboard-about-card');
            if (!link) return; // If no link, return
            e.preventDefault();
            const { youtubeId, link: dataLink, albumId, unlockAlbum, itemId: linkItemId } = link.dataset || {};
            const cardElement = link.closest('.card, .carousel-item'); // CORRECTION: Inclut .carousel-item pour trouver l'ID
            let itemId = cardElement ? cardElement.dataset.itemId : linkItemId; // CORRECTION: Logique améliorée pour trouver l'ID

            if (unlockAlbum) {
                if (userCoins >= COIN_COST_UNLOCK) {
                    const allUnlockableTracksInAlbum = Object.values(allSearchableItems).filter(t => t.albumId === unlockAlbum && t.isUnlockable);
                    const nextTrackToUnlock = allUnlockableTracksInAlbum.find(t => !unlockedDreamSeasonTracks.includes(t.id));
                    
                    if (nextTrackToUnlock) {
                        userCoins -= COIN_COST_UNLOCK;
                        unlockedDreamSeasonTracks.push(nextTrackToUnlock.id);
                        localStorage.setItem('mmg-userCoins', JSON.stringify(userCoins));
                        localStorage.setItem('mmg-unlockedTracks', JSON.stringify(unlockedDreamSeasonTracks));
                        updateCoinDisplay();
                        showDialog(`${getTranslation('youUnlocked')} "${nextTrackToUnlock.title}"!`);
                        handleMenuNavigation('albums-section');
                    } else {
                        showDialog(getTranslation('allTracksUnlocked'));
                    }
                } else {
                    showDialog(getTranslation('needCoinsToUnlock', { COIN_COST_UNLOCK }));
                    playAudio(sounds.blocked); // Joue le son de blocage
                }
                return;
            }

            // If it's a playable item (youtubeId)
            if (youtubeId) {
                const item = findItemById(itemId); // CORRECTION: Utilise la variable itemId fiabilisée
                if (!item) return;

                if (item.isUnlockable && !unlockedDreamSeasonTracks.includes(item.id)) {
                    showDialog(getTranslation('trackLocked'));
                    playAudio(sounds.blocked);
                    return;
                }

                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                let playlistIds = [];
                let startIndex = -1;

                if (isMusicTitle(item) && item.albumId) {
                    const allAlbumTracks = Object.values(siteData.contentData[activeProfile].titles)
                        .filter(title => title.albumId === item.albumId);
                    
                    playlistIds = allAlbumTracks
                        .filter(track => !track.isUnlockable || unlockedDreamSeasonTracks.includes(track.id))
                        .map(title => title.id);

                    startIndex = playlistIds.findIndex(id => id === item.id);

                } else {
                    const parentContainer = cardElement?.parentElement;
                    if (parentContainer) {
                        const allCardsInContainer = Array.from(parentContainer.querySelectorAll('.card:not(.locked)'));
                        playlistIds = allCardsInContainer
                            .map(card => card.dataset.itemId)
                    .filter(Boolean); // Filtre les IDs vides
                        startIndex = playlistIds.findIndex(pId => pId === item.id);
                    }
                }
                
                currentNavigationContext = { playlist: playlistIds, index: startIndex };

                playAudio(sounds.select);
                
                // Determine playbackOriginType based on the current section and item type
                let playbackOriginType = 'titles'; // Default to 'titles'
                const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id;
                if (currentSectionId === 'library-section' && document.querySelector('#library-tabs-container .playlist-tab-btn[data-tab-id="liked"]')?.classList.contains('active')) {
                    playbackOriginType = 'liked';
                } else if (item.type === 'video' || item.type === 'bonus') {
                    playbackOriginType = 'video';
                } else if (currentSectionId === 'search-results-section') {
                    playbackOriginType = 'search';
                } else if (item.albumId) {
                    playbackOriginType = 'album'; // If it's an album track, and not from a more specific origin
                }
                playVideoWhenReady(item, playlistIds, startIndex, playbackOriginType);
        // NOUVEAU: Afficher le bouton du lecteur mobile
        const playerToggleBtn = document.getElementById('mobile-player-toggle-btn');
        if (playerToggleBtn) playerToggleBtn.style.display = 'flex';


            } else if (dataLink) {
                playAudio(sounds.select);
                // Si le clic vient de la sidebar, on gère la navigation
                if (e.target.closest('.sidebar-nav-link')) {
                    handleMenuNavigation(dataLink);
                } else { // Sinon (clic sur une carte du menu principal), on navigue aussi
                    handleMenuNavigation(dataLink);
                }
                // NOUVEAU: Si on clique sur la carte guide, on ouvre l'overlay du guide
                if (dataLink === 'guide-overlay') {
                    document.getElementById('guide-btn').click();
                    return; // On arrête ici pour ne pas changer de section
                }
                // Mettre à jour la classe active dans la sidebar
                const activeProfile = document.querySelector('.profile-tab.active').dataset.project;
                renderSidebarNav(activeProfile);
            } else if (albumId) {
                playAudio(sounds.select);
                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                const titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));

                document.getElementById('titles-section-title').textContent = siteData.contentData[activeProfile].albums[albumId].title;
                currentViewContext = { type: 'titles', data: albumId }; // Set current view context
                renderCards('titles-cards', titlesForAlbum, 'title');
                showSection('titles-section');
            }
        });

        mainWrapper.addEventListener('mousedown', (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const titleSpan = card.querySelector('.card__title.scrolling > span'); // Get scrolling title span
                if (titleSpan) {
                    titleSpan.style.animationPlayState = 'paused';
                }
            }
        });
        mainWrapper.addEventListener('touchstart', (e) => {
             const card = e.target.closest('.card');
            if (card) { // If card exists
                const titleSpan = card.querySelector('.card__title.scrolling > span');
                if (titleSpan) {
                    titleSpan.style.animationPlayState = 'paused';
                }
            }
        }, { passive: true });

        const resumeScrolling = () => {
             document.querySelectorAll('.card__title.scrolling > span[style*="animation-play-state: paused"]').forEach(span => {
                span.style.animationPlayState = 'running';
            });
        };

        window.addEventListener('mouseup', resumeScrolling);
        window.addEventListener('touchend', resumeScrolling);

        document.getElementById('details-album-link').addEventListener('click', (e) => {
            e.preventDefault();
            const albumId = e.currentTarget.dataset.albumId;
            if(albumId) {
                playAudio(sounds.select);
                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project; // Get active profile
                const titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
                document.getElementById('titles-section-title').textContent = siteData.contentData[activeProfile].albums[albumId].title;
                currentViewContext = { type: 'titles', data: albumId };
                renderCards('titles-cards', titlesForAlbum, 'title');
                showSection('titles-section'); // Affiche la section
                setupTitleScrollObserver('titles-cards'); // Active le défilement pour cette section
            }
        });

        // NOUVEAU: Agrandir la pochette depuis le lecteur mobile
        document.getElementById('mobile-player-album-art').addEventListener('click', (e) => {
            if (document.getElementById('mobile-full-player').classList.contains('active')) {
                document.getElementById('artwork-overlay-img').src = e.target.src;
                artworkOverlay.classList.remove('hidden'); // Show artwork overlay
                // Ajoute un état à l'historique pour capturer le bouton retour
                history.pushState({ overlay: 'artwork' }, '');
            }
        });

        const artworkOverlay = document.getElementById('artwork-overlay');
        document.getElementById('details-album-art').addEventListener('click', (e) => {
            document.getElementById('artwork-overlay-img').src = e.target.src;
            artworkOverlay.classList.remove('hidden'); // Show artwork overlay
            // Ajoute un état à l'historique pour capturer le bouton retour
            history.pushState({ overlay: 'artwork' }, '');
        });
        artworkOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'artwork-overlay') {
                artworkOverlay.classList.add('hidden');
                // Si l'état de l'historique est celui de l'overlay, on revient en arrière pour le nettoyer
                if (history.state && history.state.overlay === 'artwork') {
                    history.back();
                }
            }
        });

        document.getElementById('player-album-cover').addEventListener('click', () => {
            if (currentPlayingItem) {
                playAudio(sounds.select);
                const sectionToShow = isMusicTitle(currentPlayingItem) ? 'music-title-details-section' : 'large-player-section'; // Determine section to show
                showSection(sectionToShow);
                if (isMusicTitle(currentPlayingItem)) {
                    renderMusicTitleDetails(currentPlayingItem);
                }
            }
        });

        // NOUVEAU: Logique pour le bouton d'effacement de la recherche
        const searchInput = document.getElementById('search-input');
        const searchClearBtn = document.getElementById('search-clear-btn');

        searchInput.addEventListener('input', () => {
            searchClearBtn.classList.toggle('hidden', searchInput.value === '');
            updateVisibleCards();
        });

        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchClearBtn.classList.add('hidden');
            updateVisibleCards();
            searchInput.focus(); // Redonne le focus à la barre de recherche
        });

        document.getElementById('tags-filter-list').addEventListener('change', updateVisibleCards);
        
        document.getElementById('theme-switch').addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            playAudio(e.target.checked ? sounds.switchToBlack : sounds.switchToWhite);
            localStorage.setItem('mmg-theme', e.target.checked ? 'dark' : 'light'); // CORRECTION: Utilisation de la clé de stockage correcte.
            applyTheme(localStorage.getItem('ui-theme') || 'default');
            updateThemeColorMeta(); // NOUVEAU: Met à jour la couleur de thème au changement
        });
        
        // NOUVEAU: Logique pour le sélecteur de thème mobile
        const mobileThemeSwitch = document.getElementById('mobile-theme-switch');
        if (mobileThemeSwitch) {
            mobileThemeSwitch.checked = document.getElementById('theme-switch').checked;
            mobileThemeSwitch.addEventListener('change', (e) => {
                document.getElementById('theme-switch').checked = e.target.checked;
                document.getElementById('theme-switch').dispatchEvent(new Event('change'));
            });
        }
        // NOUVEAU: Logique pour le bouton du guide mobile
        const mobileGuideBtn = document.getElementById('mobile-guide-btn');
        if (mobileGuideBtn) {
            mobileGuideBtn.addEventListener('click', () => document.getElementById('guide-btn').click());
        }

        document.getElementById('sfx-switch').addEventListener('change', (e) => {
            sfxEnabled = e.target.checked;
            localStorage.setItem('mmg-sfxEnabled', JSON.stringify(sfxEnabled));
        });

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                applyLanguage(e.target.dataset.lang);
                playAudio(sounds.select);
            });
        });
        
        document.getElementById('background-play-switch').addEventListener('change', (e) => {
            isBackgroundPlayEnabled = e.target.checked;
            localStorage.setItem('mmg-backgroundPlayEnabled', JSON.stringify(isBackgroundPlayEnabled)); // Save background play preference
            
        });


        document.getElementById('play-pause-box').addEventListener('click', () => {
            if (!activePlayer || !currentPlayingItem) {
                if (currentPlaylist.length > 0) {
                    const firstItem = findItemById(currentPlaylist[0]);
                    if (firstItem) {
                        playVideoWhenReady(firstItem, currentPlaylist, 0, 'myPlaylist'); // Explicitly from my playlist
                    }
                }
                return;
            }
            playAudio(sounds.select);
            const state = activePlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) activePlayer.pauseVideo();
            else activePlayer.playVideo(); // Play or pause video
        });
        // NOUVEAU: Contrôles du mini-lecteur mobile
        document.getElementById('mini-player-play-pause-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('play-pause-box').click();
        });
        document.getElementById('mini-player-like-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('player-like-btn').click();
        });
        document.getElementById('mini-player-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (activePlayer) activePlayer.stopVideo();
            currentPlayingItem = null; // Clear current playing item
            resetMiniPlayerUI(); // Doit être appelé AVANT de cacher le lecteur
            // NOUVEAU: Réinitialiser la hauteur du lecteur pour que le contenu reprenne sa place
            document.documentElement.style.setProperty('--mobile-player-height', '0px');
        });

        // NOUVEAU: Contrôles du lecteur mobile
        document.getElementById('mobile-player-play-pause-box').addEventListener('click', () => {
            playAudio(sounds.select);
            const state = activePlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) activePlayer.pauseVideo(); else activePlayer.playVideo(); // Play or pause video
        });

        document.getElementById('next-video-btn').addEventListener('click', () => playNextTrack(1, isAutoplayActive));
        document.getElementById('prev-video-btn').addEventListener('click', () => playNextTrack(-1, isAutoplayActive));
        
        // CORRECTION: Logique centralisée pour le bouton Loop
        document.getElementById('loop-btn').addEventListener('click', (e) => {
            isPlayerLooping = !isPlayerLooping;
            playAudio(sounds.select);
            if (isPlayerLooping) { // If looping, disable shuffle
                isShuffleMode = false;
            }
            updateLoopShuffleUI();
        });

        // CORRECTION: Logique centralisée pour le bouton Shuffle
        document.getElementById('shuffle-btn').addEventListener('click', (e) => {
            isShuffleMode = !isShuffleMode;
            playAudio(sounds.select);
            if (isShuffleMode) { // If shuffling, disable loop
                isPlayerLooping = false;
            }
            updateLoopShuffleUI();
        });

        // NOUVEAU: Écouteurs pour les boutons du lecteur mobile
        document.getElementById('mobile-player-next-btn').addEventListener('click', () => playNextTrack(1, true));
        document.getElementById('mobile-player-prev-btn').addEventListener('click', () => playNextTrack(-1, true));
        // CORRECTION: Mobile buttons now directly call centralized logic
        document.getElementById('mobile-player-loop-btn').addEventListener('click', () => {
            isPlayerLooping = !isPlayerLooping;
            if (isPlayerLooping) isShuffleMode = false; // If looping, disable shuffle
            playAudio(sounds.select);
            updateLoopShuffleUI();
        });
        document.getElementById('mobile-player-shuffle-btn').addEventListener('click', () => {
            isShuffleMode = !isShuffleMode;
            if (isShuffleMode) isPlayerLooping = false; // If shuffling, disable loop
            playAudio(sounds.select);
            updateLoopShuffleUI();
        });
        document.getElementById('mobile-player-like-btn').addEventListener('click', () => document.getElementById('player-like-btn').click());
        // CORRECTION: The playlist button on the large mobile player now directly opens the overlay.
        document.getElementById('mobile-player-add-to-playlist-btn').addEventListener('click', (e) => {
            // NOUVEAU: Logique pour ajouter/retirer de la playlist
            if (currentPlayingItem) {
                togglePlaylistItem(currentPlayingItem.id);
            }
        });
        // CORRECTION: Le bouton 'options' a été retiré, on attache l'événement au bouton 'share'
        document.getElementById('mobile-player-queue-btn').addEventListener('click', (e) => {
            e.preventDefault();
            openMobileQueuePanel();
        });

        // NOUVEAU: Logique pour le panneau de file d'attente mobile
        const mobileQueuePanel = document.getElementById('mobile-queue-panel');
        const mobileQueueBackdrop = document.getElementById('mobile-queue-panel-backdrop');

        function openMobileQueuePanel() {
            renderMobileQueue();
            mobileQueuePanel.classList.remove('hidden');
            mobileQueueBackdrop.classList.remove('hidden');
            playAudio(sounds.select);
        }

        function closeMobileQueuePanel() {
            mobileQueuePanel.classList.add('hidden');
            mobileQueueBackdrop.classList.add('hidden');
            playAudio(sounds.back);
        }

        mobileQueueBackdrop.addEventListener('click', closeMobileQueuePanel);

        // NOUVEAU: Gestion du swipe vers le bas pour fermer le panneau
        let queuePanelTouchStartY = 0;
        mobileQueuePanel.addEventListener('touchstart', e => { queuePanelTouchStartY = e.touches[0].clientY; }, { passive: true });
        mobileQueuePanel.addEventListener('touchend', e => {
            const touchEndY = e.changedTouches[0].clientY;
            if (touchEndY > queuePanelTouchStartY + 75) { // Swipe vers le bas de 75px
                closeMobileQueuePanel();
            }
        });

        // NOUVEAU: Logique pour le swipe-to-delete dans la file d'attente mobile
        let queueTouchStartX = 0;
        let queueTouchCurrentX = 0;
        let swipedItem = null;
        const SWIPE_THRESHOLD = -80; // Distance en px pour révéler le bouton

        document.getElementById('mobile-queue-list').addEventListener('touchstart', (e) => {
            const itemContent = e.target.closest('.playlist-item-content');
            if (itemContent && !itemContent.closest('.currently-playing')) {
                // Réinitialiser tout autre élément ouvert
                const currentlySwiped = document.querySelector('.playlist-item-content[style*="transform"]');
                if (currentlySwiped && currentlySwiped !== itemContent) {
                    currentlySwiped.style.transform = 'translateX(0)';
                }
                
                swipedItem = itemContent;
                queueTouchStartX = e.touches[0].clientX;
                swipedItem.style.transition = 'none'; // Désactive la transition pendant le swipe
            }
        }, { passive: true });

        document.getElementById('mobile-queue-list').addEventListener('touchmove', (e) => {
            if (!swipedItem) return;
            queueTouchCurrentX = e.touches[0].clientX;
            const diffX = queueTouchCurrentX - queueTouchStartX;
            // On ne swipe que vers la gauche, et pas plus que la taille du bouton
            if (diffX < 0 && diffX > SWIPE_THRESHOLD - 20) {
                swipedItem.style.transform = `translateX(${diffX}px)`;
            }
        }, { passive: true });

        document.getElementById('mobile-queue-list').addEventListener('touchend', (e) => {
            if (!swipedItem) return;
            const diffX = queueTouchCurrentX - queueTouchStartX;
            swipedItem.style.transition = 'transform 0.3s ease-out'; // Réactive la transition

            if (diffX < SWIPE_THRESHOLD / 2) { // Si on a dépassé la moitié du chemin
                swipedItem.style.transform = `translateX(${SWIPE_THRESHOLD}px)`;
            } else { // Sinon, on revient à la position initiale
                swipedItem.style.transform = 'translateX(0)';
            }
            swipedItem = null; // Réinitialise pour le prochain swipe
            queueTouchStartX = 0;
            queueTouchCurrentX = 0;
        });

        document.getElementById('mobile-player-share-btn').addEventListener('click', () => document.getElementById('share-btn').click());
        
        const toggleAutoplay = (e) => {
            isAutoplayActive = !isAutoplayActive;
            const buttons = document.querySelectorAll('#autoplay-toggle, #overlay-autoplay-toggle, #mobile-player-autoplay-btn');
            buttons.forEach(btn => {
                btn.classList.toggle('active', isAutoplayActive);
                btn.title = getTranslation(isAutoplayActive ? 'autoplayOn' : 'autoplayOff');
            });
            showDialog(getTranslation(isAutoplayActive ? 'autoplayOn' : 'autoplayOff')); // MODIFICATION: Show notification
            playAudio(sounds.select);
            
            if (isAutoplayActive && activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() === YT.PlayerState.ENDED) {
                playNextTrack();
            }

            updateTempPlayButtonVisibility();
        };
        document.getElementById('autoplay-toggle').addEventListener('click', toggleAutoplay);
        document.getElementById('overlay-autoplay-toggle').addEventListener('click', toggleAutoplay);
        document.getElementById('mobile-player-autoplay-btn').addEventListener('click', toggleAutoplay);


        const shareFunction = async () => {
            if (!currentPlayingItem) return;

            const shareData = {
                title: `MMGEAR - ${currentPlayingItem.title}`,
                text: `Écoute "${currentPlayingItem.title}" sur la MMGEAR !`, // Share text
                url: window.location.href // Partage l'URL actuelle de l'application
            };

            // Utilise l'API de partage native si disponible (mobile)
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    console.error('Erreur de partage:', err);
                }
            } else { // Fallback for desktop browsers
                navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${currentPlayingItem.youtube_id}`).then(() => showDialog(getTranslation('linkCopied')))
                    .catch(err => showDialog(getTranslation('copyFailed')));
            }
        };
        document.getElementById('share-btn').addEventListener('click', shareFunction);
        document.getElementById('overlay-share-btn').addEventListener('click', shareFunction);


        document.getElementById('player-like-btn').addEventListener('click', (e) => {
            if(currentPlayingItem) toggleLike(currentPlayingItem.id);
        }); // Toggle like for current playing item
        // NOUVEAU: Barre de progression mobile
        document.getElementById('mobile-player-progress-bar').addEventListener('click', (e) => {
            if (activePlayer && typeof activePlayer.getDuration === 'function') {
                const rect = e.currentTarget.getBoundingClientRect();
                activePlayer.seekTo(((e.clientX - rect.left) / rect.width) * activePlayer.getDuration(), true);
            }
        });

        document.getElementById('progress-bar').addEventListener('click', (e) => {
            if (activePlayer && typeof activePlayer.getDuration === 'function') {
                const rect = e.currentTarget.getBoundingClientRect();
                activePlayer.seekTo(((e.clientX - rect.left) / rect.width) * activePlayer.getDuration(), true);
                seekDetectedInCurrentPlay = true;
            }
        }); // Seek in progress bar

        // CORRECTION: Vérifier l'existence des éléments avant d'ajouter des écouteurs.
        // Ces éléments n'existent pas sur mobile et causaient une erreur.
        const volumeUpBtn = document.getElementById('volume-up-btn');
        if (volumeUpBtn) volumeUpBtn.addEventListener('click', () => setVolume(currentVolume + 10, true));
        const volumeDownBtn = document.getElementById('volume-down-btn');
        if (volumeDownBtn) volumeDownBtn.addEventListener('click', () => setVolume(currentVolume - 10, true));

        // CORRECTION: Logique simplifiée pour les boutons de volume du lecteur mobile
        document.getElementById('mobile-volume-up-btn').addEventListener('click', () => setVolume(currentVolume + 10, true));
        document.getElementById('mobile-volume-down-btn').addEventListener('click', () => setVolume(currentVolume - 10, true));

        document.getElementById('temp-play-btn')?.addEventListener('click', () => {
            const musicSection = document.getElementById('music-title-details-section');
            const currentItemId = musicSection.dataset.currentItemId;
            if (currentItemId) {
                const itemToPlay = findItemById(currentItemId);
                if (itemToPlay) {
                    playAudio(sounds.select);
                    playVideoWhenReady(itemToPlay, [], -1, 'titles', true); // Explicitly from titles
                }
            }
        });

        const allOverlays = document.querySelectorAll('#settings-overlay, #wifi-overlay, #tags-filter-overlay, #playlist-overlay, #player-options-overlay, #tutorial-overlay, #notifications-overlay, #reco-playlist-options-overlay, #queue-overlay, #mobile-queue-panel-backdrop, #purchase-confirm-overlay');


        document.getElementById('settings-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('settings-overlay'), sounds.select, true); });
        document.getElementById('wifi-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('wifi-overlay'), null); });
        document.getElementById('tags-filter-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('tags-filter-overlay'), sounds.select, true); });        
        // NOUVEAU: Le bouton playlist du lecteur de bureau ajoute/retire le titre
        document.getElementById('player-add-to-playlist-btn').addEventListener('click', (e) => {
            if (currentPlayingItem) {
                togglePlaylistItem(currentPlayingItem.id);
            }
        });
        document.getElementById('queue-btn').addEventListener('click', (e) => { // Open queue overlay
            e.preventDefault();
            openOverlay(document.getElementById('queue-overlay'), sounds.select, true);
        });
        document.getElementById('notifications-btn').addEventListener('click', (e) => { 
            e.preventDefault(); 
            openOverlay(document.getElementById('notifications-overlay'), sounds.select, true); 
        });
        document.getElementById('mobile-notifications-btn').addEventListener('click', (e) => {
            e.preventDefault(); openOverlay(document.getElementById('notifications-overlay'), sounds.select, true);
        });
        const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
        if (mobileSettingsBtn) mobileSettingsBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('settings-btn').click(); });
        const mobileWifiBtn = document.getElementById('mobile-wifi-btn');
        if (mobileWifiBtn) mobileWifiBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('wifi-btn').click(); });
    
        
        allOverlays.forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    if (overlay.id === 'tutorial-overlay' && isTutorialActive) {
                        return;
                    } else {
                       closeOverlay(sounds.back);
                    }
                }
            }); // Close overlay on click outside
            overlay.querySelector('.close-btn')?.addEventListener('click', () => {
                 if (overlay.id === 'tutorial-overlay') {
                    endTutorial();
                } else {
                    closeOverlay(sounds.back);
                }
            });
        });

        document.getElementById('mark-as-read-btn').addEventListener('click', () => {
            playAudio(sounds.select);

            // Marque tous les messages (logs et dev) comme lus
            const allMessageIds = [
                ...(siteData.updateLog || []).map(m => m.id),
                ...(siteData.devMessages || []).map(m => m.id)
            ];
            allMessageIds.forEach(id => readUpdateIds.add(id));
            localStorage.setItem('mmg-readUpdateIds', JSON.stringify([...readUpdateIds]));

            updateNotificationDot();
            renderUpdateLog(); // Re-render pour enlever le style "non lu"
        });


        
        document.getElementById('cheat-code-btn').addEventListener('click', () => {
            const input = document.getElementById('cheat-code-input');
            const code = input.value.toLowerCase();
            let shopNeedsUpdate = false;

            if (code === 'gameshark') { // If cheat code is gameshark
                unlockAllAchievements();
                input.value = '';
                showDialog(getTranslation('allAchievementsUnlocked'));
                playAudio(sounds.select);
                shopNeedsUpdate = true;
            } else if (code === 'musicleaks') {
                const allUnlockableTracks = Object.values(allSearchableItems).filter(t => t.isUnlockable);
                unlockedDreamSeasonTracks = allUnlockableTracks.map(t => t.id);
                localStorage.setItem('mmg-unlockedTracks', JSON.stringify(unlockedDreamSeasonTracks));
                input.value = '';
                showDialog(getTranslation('allSongsUnlocked'));
                playAudio(sounds.achievementUnlocked);
            }
            else {
                showDialog(getTranslation('incorrectCode'));
                playAudio(sounds.blocked);
            }

            // CORRECTION: Met à jour la boutique si elle est ouverte après une action.
            if (shopNeedsUpdate && !document.getElementById('shop-section').classList.contains('hidden')) {
                renderShopPage();
            }
        });

        // CORRECTION: La logique de l'interrupteur de l'écran d'accueil a été déplacée dans welcome.js.
        // Cet écouteur ne gère plus que l'interrupteur des paramètres. // This listener only handles the settings switch now.
        const settingsBgMusicSwitch = document.getElementById('settings-bg-music-switch'); // Get settings background music switch
        if (settingsBgMusicSwitch) {
            // Au démarrage, on synchronise l'état de l'interrupteur des paramètres
            // avec celui de l'écran d'accueil (qui est la source de vérité initiale).
            const welcomeSwitch = document.getElementById('welcome-bg-music-switch');
            if (welcomeSwitch) {
                settingsBgMusicSwitch.checked = welcomeSwitch.checked;
            }

            settingsBgMusicSwitch.addEventListener('change', (e) => {
            const playerState = (activePlayer && typeof activePlayer.getPlayerState === 'function') ? activePlayer.getPlayerState() : -1;
            const isChecked = e.target.checked;

            if (isChecked && playerState !== YT.PlayerState.PLAYING) {
                document.getElementById('background-music').play();
            } else {
                document.getElementById('background-music').pause();
            }
        });
        }

        let draggedItem = null;
        const playlistContainer = document.getElementById('playlist-container');


        // CORRECTION: Utilisation de mouseenter/mouseleave pour un son de survol propre
        const hoverableSelectors = '.card, .profile-tab, .top-bar-btn, #start-music-btn, #mp3-player-container i, .volume-adjust-btn, .guide-choice-btn';
        
        document.body.addEventListener('mouseenter', (e) => {
            const target = e.target.closest(hoverableSelectors);
            if (target) { // If target exists
                playAudio(sounds.hover);
            }
        }, true); // Utilise la phase de capture pour gérer les éléments ajoutés dynamiquement

        document.body.addEventListener('mouseleave', (e) => {
            const target = e.target.closest(hoverableSelectors);
            // Pas d'action nécessaire à la sortie, mais le listener est là pour la symétrie
            // et si un comportement à la sortie est nécessaire plus tard.
        }, true);

        playlistContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.playlist-item-delete');
            if (deleteBtn) {
                const itemElement = deleteBtn.closest('.playlist-item'); // Get the item element
                const itemId = itemElement.dataset.itemId;
                const index = currentPlaylist.findIndex(id => id === itemId);
                if (index > -1) {
                    currentPlaylist.splice(index, 1);
                    localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist));
                    renderPlaylist();
                    updateCardPlaylistButtonState(itemId); // CORRECTION: Met à jour l'icône sur la carte
                    playAudio(sounds.back);
                }
            } else {
                const itemElement = e.target.closest('.playlist-item');
                if (itemElement) {
                    const item = findItemById(itemElement.dataset.itemId);
                    if (item) { // If item exists
                        playVideoWhenReady(item, [], -1, true);
                    }
                }
            }
        });

        document.getElementById('playlist-tabs-container').addEventListener('click', e => {
            const tab = e.target.closest('.playlist-tab-btn');
            if (tab) {
                document.querySelectorAll('.playlist-tab-btn').forEach(t => t.classList.remove('active')); // Remove active class from all tabs
                tab.classList.add('active');
                playAudio(sounds.hover);
                renderPlaylist();
            }
        });

        // MODIFICATION: Gestion du clic sur les playlists recommandées pour ouvrir un menu d'options
        document.getElementById('playlist-reco-list').addEventListener('click', handleRecoPlaylistClick);


        document.querySelector('#reco-playlist-options-overlay .playlist-options-actions')?.addEventListener('click', e => {
            const button = e.target.closest('.playlist-action-btn');
            if (button) {
                const action = button.dataset.action;
                const { name: playlistName, ids: itemIds } = JSON.parse(e.currentTarget.dataset.recoPlaylist || '{}');

                closeOverlay(sounds.select); // Close options overlay

                if (action === 'play') {
                    const firstItem = findItemById(itemIds[0]);
                    if (firstItem) playVideoWhenReady(firstItem, itemIds, 0);
                } else if (action === 'save') {
                    if (savedPlaylists[playlistName]) {
                        showDialog(`La playlist "${playlistName}" existe déjà.`);
                        return;
                    }
                    savedPlaylists[playlistName] = itemIds;
                    localStorage.setItem('mmg-savedPlaylists', JSON.stringify(savedPlaylists));
                    showDialog(getTranslation('playlistSaved'));
                    if (!document.getElementById('library-section').classList.contains('hidden')) renderLibraryPage('current'); // If library section is visible, render current playlist
                }
            }
        });

        playlistContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('playlist-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0);
            } // If item is a playlist item, set it as dragged item
        });

        playlistContainer.addEventListener('dragend', (e) => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
            }
        });

        playlistContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(playlistContainer, e.clientY);
            if (draggedItem) { // If there's a dragged item
                 if (afterElement == null) {
                    playlistContainer.appendChild(draggedItem);
                } else {
                    playlistContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });

        playlistContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!draggedItem) return;

            const newPlaylistOrder = Array.from(playlistContainer.querySelectorAll('.playlist-item'))
                .map(item => item.dataset.itemId);

            currentPlaylist = newPlaylistOrder;

            if(currentPlayingItem) {
                currentQueueIndex = currentPlaylist.findIndex(id => id === currentPlayingItem.id);
            }

            localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist)); // Save new playlist order
            renderPlaylist(); 
        });

        document.getElementById('clear-playlist-btn').addEventListener('click', () => {
            currentPlaylist = [];
            currentQueueIndex = -1;
            localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist));
            renderPlaylist();
            showDialog(getTranslation("playlistCleared")); // Show playlist cleared dialog
            playAudio(sounds.back);
        });

        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.playlist-item:not(.dragging)')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect(); // Get bounding box of child
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        // =========================================================
        // TUTORIAL LOGIC
        // =========================================================
        let currentTutorial = null;
        let currentStepIndex = 0;
        let highlightedElements = [];

        // MODIFICATION: Mise à jour complète du guide du menu principal
        const mainMenuTutorialSteps = [
            { step: 1, selector: '.sidebar', textKey: 'tutorial_main_new_1', position: 'pos-right' },
            { step: 2, selector: '.sidebar-header-buttons', textKey: 'tutorial_main_1' },
            { step: 3, selector: '#notifications-btn', textKey: 'tutorial_main_new_2' }, // Notifications button
            { step: 4, selector: '.central-profiles-card', textKey: 'tutorial_main_9', position: 'pos-bottom' },
            { step: 5, selector: '#sidebar-main-nav', textKey: 'tutorial_main_new_3' },
            { step: 6, selector: '.sidebar-footer', textKey: 'tutorial_main_new_4' },
            { step: 7, selector: '.top-bar', textKey: 'tutorial_main_new_5', position: 'pos-bottom' },
            { step: 8, selector: '.search-bar', textKey: 'tutorial_main_3' },
            { step: 9, selector: '.top-bar-right', textKey: 'tutorial_main_new_6' },
            { step: 10, selector: '#home-dashboard-section', textKey: 'tutorial_main_new_7', position: 'pos-top' },
            { step: 11, selector: '.carousel-card', textKey: 'tutorial_main_new_8' }, // Carousel card
            { step: 12, selector: '.liked-preview-card', textKey: 'tutorial_main_new_9' },
            { step: 13, selector: '.activity-card', textKey: 'tutorial_main_new_10' },
            { step: 14, selector: '#mp3-player-container', textKey: 'tutorial_main_12', position: 'pos-center' },
            { step: 15, selector: '#player-album-cover', textKey: 'tutorial_main_13', position: 'pos-top' },
            { step: 16, selector: '.player-buttons', textKey: 'tutorial_main_new_11', position: 'pos-top' },
            { step: 17, selector: '.player-right-controls', textKey: 'tutorial_main_new_12', position: 'pos-top' },
            { step: 18, selector: '#player-toggle-handle', textKey: 'tutorial_main_new_13', position: 'pos-top' }
        ];

        // NOUVEAU: Étapes du guide spécifiques au mobile
        const mobileMainMenuTutorialSteps = [
            { step: 1, selector: '.top-bar', textKey: 'tutorial_main_new_5', position: 'pos-bottom' },
            { step: 2, selector: '.mobile-header-icons', textKey: 'tutorial_main_new_6' }, // Mobile header icons
            { step: 3, selector: '.search-bar', textKey: 'tutorial_main_3' },
            { step: 4, selector: '#mobile-profile-switch', textKey: 'tutorial_main_9', position: 'pos-bottom' },
            { step: 5, selector: '#home-dashboard-section', textKey: 'tutorial_main_new_7', position: 'pos-top' },
            { step: 6, selector: '.carousel-card', textKey: 'tutorial_main_new_8' },
            { step: 7, selector: '.liked-preview-card', textKey: 'tutorial_main_new_9' },
            { step: 8, selector: '.activity-card', textKey: 'tutorial_main_new_10' },
            { step: 9, selector: '#mobile-mini-player', textKey: 'tutorial_main_12', position: 'pos-center' },
            { step: 10, selector: '#mini-player-album-art', textKey: 'tutorial_main_13', position: 'pos-top' }, // Mini player album art
            { step: 11, selector: '#mobile-bottom-nav', textKey: 'tutorial_main_new_3', position: 'pos-top' },
            { step: 12, selector: '#mobile-player-toggle-handle', textKey: 'tutorial_main_new_13', position: 'pos-top' }
        ];

        const musicTitlesTutorialSteps = [
            {
                step: 1,
                textKey: "tutorial_music_1",
                selector: () => document.querySelector('#titles-cards .card'),
                position: 'pos-bottom'
            },
            {
                step: 2,
                selector: () => document.querySelector('#titles-cards .card .like-btn-card'),
                textKey: "tutorial_music_2",
                position: 'pos-top'
            },
            {
                step: 3,
                selector: () => document.querySelector('#titles-cards .card .add-playlist-btn-card'),
                textKey: "tutorial_music_3", // Add to playlist button
                position: 'pos-top',
                action: () => {
                    const firstCardLink = document.querySelector('#titles-cards .card a.card-link-wrapper');
                    if (firstCardLink) {
                        tutorialSuppressAutoplay = true; 
                        firstCardLink.click();
                    }
                },
            },
            {
                step: 4, // Album art
                selector: '#details-album-art',
                textKey: "tutorial_music_4",
                position: 'pos-top',
                reverseAction: () => { 
                    showSection('titles-section', false);
                    document.getElementById('temp-play-btn').classList.remove('hidden');
                }
            },
            {
                step: 5, // Album link and tags
                selector: ['#details-album-link', '#details-tags'], 
                textKey: "tutorial_music_5",
                position: 'pos-top'
            },
             {
                step: 6,
                selector: '#details-add-to-playlist-btn',
                textKey: "tutorial_music_6", // Add to playlist button
                position: 'pos-top'
            },
            {
                step: 7,
                selector: '#streaming-links',
                textKey: "tutorial_music_7",
                position: 'pos-top'
            }, // Streaming links
            {
                step: 8,
                selector: '.associated-videos-panel',
                textKey: "tutorial_music_8",
                position: 'pos-top'
            },
            {
                step: 9, // Temp play button
                selector: '#temp-play-btn',
                textKey: "tutorial_music_9",
                position: 'pos-top'
            },
            {
                step: 10,
                selector: ['#prev-video-btn', '#next-video-btn'], 
                textKey: "tutorial_music_10", // Previous/next buttons
                position: 'pos-top'
            },
            {
                step: 11, 
                textKey: "tutorial_music_11",
                position: 'pos-top'
            }
        ];

        const tutorials = { // Tutorial steps
            // CORRECTION: Le guide principal dépend maintenant de la taille de l'écran
            main: window.innerWidth <= 952 ? mobileMainMenuTutorialSteps : mainMenuTutorialSteps,
            // Pour l'instant, le guide musical reste le même, mais on pourrait le spécialiser aussi
            music: musicTitlesTutorialSteps 
        };

        function showTutorialStep(stepIndex) {
            if (highlightedElements.length > 0) {
                highlightedElements.forEach(el => {
                    el.classList.remove('tutorial-highlight'); // Remove highlight
                    if (el.classList.contains('card')) {
                        el.style.opacity = '';
                    }
                });
                highlightedElements = [];
            }

            if (stepIndex < 0 || stepIndex >= currentTutorial.length) {
                endTutorial();
                return;
            } // End tutorial if out of bounds

            document.getElementById('tutorial-prev').style.visibility = stepIndex === 0 ? 'hidden' : 'visible';

            currentStepIndex = stepIndex;
            const step = currentTutorial[stepIndex];
            
            let targetElements = [];
            if (typeof step.selector === 'function') {
                const result = step.selector();
                targetElements = Array.isArray(result) ? result.filter(Boolean) : (result ? [result] : []);
            } else if (typeof step.selector === 'string') {
                const el = document.querySelector(step.selector);
                if (el) targetElements.push(el);
            } else if (Array.isArray(step.selector)) {
                step.selector.forEach(sel => {
                    const el = document.querySelector(sel);
                    if (el) targetElements.push(el);
                });
            } else {
                targetElements = [document.body];
            }
            
            if (targetElements.length === 0) {
                 console.warn(`Tutorial element(s) not found for step ${step.step}:`, step.selector);
            } else {
                highlightedElements = targetElements;
                highlightedElements.forEach(el => {
                    el.classList.add('tutorial-highlight');
                    if (el.classList.contains('card')) {
                        el.style.opacity = 1;
                    }
                });
            }
            
            const tutorialBox = document.getElementById('tutorial-box');
            document.getElementById('tutorial-text').textContent = getTranslation(step.textKey);
            document.getElementById('tutorial-step-counter').textContent = `${step.step} / ${currentTutorial.length}`; // Update step counter
            
            // CORRECTION: Positionnement dynamique de la boîte de dialogue
            positionTutorialBox(tutorialBox, highlightedElements[0], step.position);
        }

        function startTutorial(guideKey) {
            playAudio(sounds.select);
            currentTutorial = tutorials[guideKey];
            if (!currentTutorial) return;

            isTutorialActive = true;
            // CORRECTION: S'assure que l'overlay principal du tutoriel est visible
            // pour que la boîte de dialogue puisse s'afficher par-dessus.
            document.getElementById('tutorial-overlay').classList.remove('hidden');
            document.body.classList.add('tutorial-active-body');
            currentStepIndex = 0;

            if (guideKey === 'music') {
                originalAutoplayState = isAutoplayActive;
                isAutoplayActive = false;
                // CORRECTION: Force display of "Play song" button for guide
                updateTempPlayButtonVisibility();
                document.getElementById('temp-play-btn').classList.remove('hidden');
            }

            if (currentPlayingItem && activePlayer && typeof activePlayer.getPlayerState === 'function') {
                const playerState = activePlayer.getPlayerState();
                if (playerState === YT.PlayerState.PLAYING || playerState === YT.PlayerState.PAUSED) {
                    tutorialSavedPlayerState = {
                        item: currentPlayingItem,
                        time: activePlayer.getCurrentTime(),
                        state: playerState,
                        queue: [...activePlaybackQueue],
                        queueIndex: currentQueueIndex
                    };
                    activePlayer.pauseVideo();
                }
            } else {
                tutorialSavedPlayerState = null;
            }

            const showFirstStep = () => {
                showTutorialStep(0);
                document.getElementById('tutorial-box').classList.remove('hidden');
            };

            if (guideKey === 'music') {
                setTimeout(showFirstStep, 600);
            } else {
                showFirstStep();
            }
        }

        function endTutorial() {
            // Hide the tutorial overlay and box first to prevent visual glitches (like blur).
            document.getElementById('tutorial-overlay').classList.add('hidden');
            document.getElementById('tutorial-box').classList.add('hidden');
            playAudio(sounds.back);

            if (highlightedElements.length > 0) {
                highlightedElements.forEach(el => {
                    el.classList.remove('tutorial-highlight');
                    if (el.classList.contains('card')) {
                        el.style.opacity = '';
                    }
                });
                highlightedElements = [];
            }
            
            isTutorialActive = false;
            document.body.classList.remove('tutorial-active-body');
            currentStepIndex = 0;
            
            if (tutorialSavedPlayerState) {
                const { item, time, state, queue, queueIndex } = tutorialSavedPlayerState;
                
                currentPlayingItem = item;
                contextPlaybackQueue = queue;
                currentQueueIndex = queueIndex;
                
                activePlayer.cueVideoById({videoId: item.youtube_id, startSeconds: time});
                
                updateMp3PlayerInfo(item);
                renderPlaylist();
                
                setTimeout(() => {
                    if (state === YT.PlayerState.PLAYING) {
                        activePlayer.playVideo();
                    }
                    updateProgressBar(); 
                }, 500);

                tutorialSavedPlayerState = null;
            } else if (currentPlayingItem && currentTutorial === musicTitlesTutorialSteps) {
                 currentPlayingItem = null;
                 resetMiniPlayerUI();
                 activePlayer.stopVideo();
            }

            if (currentTutorial === musicTitlesTutorialSteps) {
                isAutoplayActive = originalAutoplayState;
                const buttons = document.querySelectorAll('#autoplay-toggle, #overlay-autoplay-toggle');
                buttons.forEach(btn => {
                    btn.classList.toggle('active', isAutoplayActive);
                    btn.title = isAutoplayActive ? "Autoplay activé" : "Autoplay désactivé";
                });
                resetToHome();
            }
            
            updateTempPlayButtonVisibility();
            currentTutorial = null;
        }

        // NOUVEAU: Fonction pour positionner intelligemment la boîte du tutoriel
        function positionTutorialBox(box, targetElement, position) {
            if (!box) return;

            const margin = 15; // Margin from the edges of the screen

            // Center the box horizontally and reset vertical positioning
            box.style.left = '50%';
            box.style.top = 'auto';
            box.style.bottom = 'auto';
            box.style.transform = 'translateX(-50%)';
            box.className = 'tutorial-box'; // Reset position classes

            if (!targetElement) {
                // If no target, just center it vertically
                box.style.top = '50%';
                box.style.transform = 'translate(-50%, -50%)';
                return;
            }

            const targetRect = targetElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Decide whether to place the box at the top or bottom
            if (targetRect.top > viewportHeight / 2) {
                // Element is in the bottom half, so place box at the top
                box.style.top = `${margin}px`;
                box.classList.add('pos-top'); // For the arrow
            } else {
                // Element is in the top half, so place box at the bottom
                box.style.bottom = `${margin}px`;
                box.classList.add('pos-bottom'); // For the arrow
            }
        }



        document.getElementById('tutorial-next').addEventListener('click', async () => {
            const currentStep = currentTutorial[currentStepIndex];
            if (currentStep && currentStep.action) { // If current step has an action
                await currentStep.action();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            showTutorialStep(currentStepIndex + 1);
        });
        
        document.getElementById('tutorial-prev').addEventListener('click', async () => {
            const currentStep = currentTutorial[currentStepIndex];
            if (currentStep && currentStep.reverseAction) { // If current step has a reverse action
                await currentStep.reverseAction();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            showTutorialStep(currentStepIndex - 1);
        });




        document.getElementById('tutorial-close').addEventListener('click', endTutorial);


        document.getElementById('player-toggle-handle').addEventListener('click', () => {
            const mainArea = document.querySelector('.main-area');
            const willBeHidden = !mainArea.classList.contains('player-hidden');
            playAudio(willBeHidden ? sounds.minimize : sounds.maximize);
            mainArea.classList.toggle('player-hidden'); // Toggle player hidden class
        });

                // NOUVEAU: Logique pour la poignée du lecteur mobile
        document.getElementById('mobile-player-toggle-handle').addEventListener('click', () => {
            const body = document.body;
            const willBeHidden = !body.classList.contains('mobile-player-hidden');
            playAudio(willBeHidden ? sounds.minimize : sounds.maximize);
            body.classList.toggle('mobile-player-hidden');
            // NOUVEAU: Ajuster la variable de hauteur en fonction de l'état
            document.documentElement.style.setProperty('--mobile-player-height', willBeHidden ? '0px' : '66px');
            if (!willBeHidden) adjustScrollAfterPlayerToggle(); // CORRECTION: Ajuste le scroll si on montre le lecteur
        });

                // NOUVEAU: Gestion du swipe pour la bibliothèque mobile
        const librarySection = document.getElementById('library-section');
        if (librarySection) {
            let libraryTouchStartX = 0;
            let libraryTouchStartY = 0;
            librarySection.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    libraryTouchStartX = e.touches[0].clientX; // Get touch start X
                    libraryTouchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            librarySection.addEventListener('touchend', (e) => {
                if (e.changedTouches.length === 1) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const swipeDistance = touchEndX - libraryTouchStartX;
                    const swipeVerticalDistance = Math.abs(touchEndY - libraryTouchStartY);
                    const swipeThreshold = 50; // 50px de swipe pour changer d'onglet
    
                    // CORRECTION: Ignore le swipe s'il est principalement vertical (pour permettre le scroll)
                    if (swipeVerticalDistance > Math.abs(swipeDistance)) {
                        return;
                    }

                    if (Math.abs(swipeDistance) > swipeThreshold) {
                        const tabs = Array.from(document.querySelectorAll('#library-tabs-container .playlist-tab-btn'));
                        const activeIndex = tabs.findIndex(tab => tab.classList.contains('active')); // Find active tab index
                        let newIndex = activeIndex;

                        if (swipeDistance < 0) { // Swipe vers la gauche
                            newIndex = Math.min(tabs.length - 1, activeIndex + 1);
                        } else { // Swipe vers la droite
                            newIndex = Math.max(0, activeIndex - 1);
                        }

                        if (newIndex !== activeIndex) {
                            playAudio(sounds.hover);
                            renderLibraryPage(tabs[newIndex].dataset.tabId);
    
                            // NOUVEAU: Ajoute une animation de transition
                            const listContainer = document.getElementById('library-container');
                            if (listContainer) {
                                listContainer.classList.remove('fade-in-right', 'fade-in-left');
                                // Force le reflow pour que l'animation puisse se rejouer
                                void listContainer.offsetWidth; 
                                if (swipeDistance < 0) { // Swipe vers la gauche
                                    listContainer.classList.add('fade-in-right');
                                } else { // Swipe vers la droite
                                    listContainer.classList.add('fade-in-left');
                                }
                            }
                        }
                    }
                }
            }, { passive: true });
        }

        // NOUVEAU: Gestion du swipe pour la section Vidéos (Clips / Making-ofs)
        const videosSection = document.getElementById('videos-section');
        if (videosSection) {
            let videosTouchStartX = 0;
            let videosTouchStartY = 0;
            videosSection.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    videosTouchStartX = e.touches[0].clientX;
                    videosTouchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            videosSection.addEventListener('touchend', (e) => {
                if (e.changedTouches.length === 1) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const swipeDistance = touchEndX - videosTouchStartX;
                    const swipeVerticalDistance = Math.abs(touchEndY - videosTouchStartY);
                    const swipeThreshold = 50;

                    if (swipeVerticalDistance > Math.abs(swipeDistance)) return;

                    if (Math.abs(swipeDistance) > swipeThreshold) {
                        const tabs = Array.from(document.querySelectorAll('#videos-tabs-container .playlist-tab-btn'));
                        const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
                        let newIndex = activeIndex;

                        if (swipeDistance < 0) newIndex = Math.min(tabs.length - 1, activeIndex + 1);
                        else newIndex = Math.max(0, activeIndex - 1);

                        if (newIndex !== activeIndex) {
                            playAudio(sounds.hover);
                            renderVideosPage(tabs[newIndex].dataset.tabId);

                            const listContainer = document.getElementById('videos-cards');
                            if (listContainer) {
                                listContainer.classList.remove('fade-in-right', 'fade-in-left');
                                void listContainer.offsetWidth;
                                listContainer.classList.add(swipeDistance < 0 ? 'fade-in-right' : 'fade-in-left');
                            }
                        }
                    }
                }
            }, { passive: true });
        }

        // MODIFICATION: Mobile switch click logic is now handled by desktop tab click
        document.querySelectorAll('#mobile-profile-switch .profile-switch-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const targetProfile = button.dataset.project;
                const desktopTab = document.querySelector(`.profile-tab[data-project="${targetProfile}"]`);
                if (desktopTab && !desktopTab.classList.contains('active')) {
                    desktopTab.click();
                }
            });
        });

        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const previousProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                const activeProfile = tab.dataset.project;

                // Mettre à jour l'état visuel des onglets (bureau et mobile)
                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active')); // Remove active class from all tabs
                tab.classList.add('active');
                document.querySelectorAll('#mobile-profile-switch .profile-switch-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.project === activeProfile);
                });

                if (!previousProfile || previousProfile === activeProfile) {
                    return; // Pas de changement ou erreur, on ne fait rien.
                }

                // Logique de navigation intelligente
                const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id || 'home-dashboard-section';
                let sectionToLoad = 'home-dashboard-section';
                const commonSections = ['library-section']; // Sections qui existent pour les deux profils

                if (commonSections.includes(currentSectionId)) {
                    sectionToLoad = currentSectionId;
                } else if (currentSectionId !== 'home-dashboard-section') {
                    const prevItem = Object.values(siteData.projectData[previousProfile]).find(p => p.link === currentSectionId);
                    if (prevItem) {
                        const equivalentSection = Object.values(siteData.projectData[activeProfile]).find(item => {
                            return item.langKey === prevItem.langKey || item.link === prevItem.link; // Find equivalent section
                        });
                        if (equivalentSection) sectionToLoad = equivalentSection.link;
                    }
                }
                renderSidebarNav(activeProfile);
                handleMenuNavigation(sectionToLoad);
                renderSocials(); // NOUVEAU: Mettre à jour les réseaux sociaux lors du changement de profil
            });
        });

        // NOUVEAU: Logique pour le lecteur mobile
        const mobilePlayer = document.getElementById('mobile-full-player');

        // MODIFICATION: Logique de swipe pour le lecteur mobile (horizontal et vertical)
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        
        // MODIFICATION: Fonction générique pour ajouter le swipe HORIZONTAL (changement de titre)
        function addSwipeListeners(element) {
            if (!element) return;
            element.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, { passive: true, capture: true }); // Use capture to potentially stop propagation
    
            element.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
                handleSwipe(element); // Handle swipe on touchend
            }, { passive: true });
        }

        // CORRECTION: Le swipe HORIZONTAL pour changer de titre est maintenant uniquement sur les pochettes.
        addSwipeListeners(document.getElementById('mobile-player-album-art'));
        addSwipeListeners(document.getElementById('details-album-art'));

        // CORRECTION: Le swipe VERTICAL pour fermer le lecteur est géré séparément sur le conteneur principal.
        let playerCloseTouchStartY = 0;
        mobilePlayer.addEventListener('touchstart', (e) => {
            // On ne démarre le swipe que si on ne touche pas un slider
            if (!e.target.closest('.mobile-player-volume-wrapper')) {
                playerCloseTouchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        mobilePlayer.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            if (playerCloseTouchStartY > 0 && touchEndY > playerCloseTouchStartY + 75) { // Swipe vers le bas de 75px
                mobilePlayer.classList.remove('active');
                playAudio(sounds.back);
            }
            playerCloseTouchStartY = 0; // Réinitialise
        });

        function handleSwipe(swipedElement) {
            const swipeThreshold = 50; // Distance minimale en pixels pour un swipe
            const swipeDownThreshold = 75; // Seuil plus grand pour le swipe vertical

            if (touchEndX < touchStartX - swipeThreshold) {
                // NOUVEAU: Animation de swipe avec transition
                swipedElement.style.transition = 'transform 0.3s ease-out'; // Add transition
                swipedElement.style.transform = 'translateX(-30px) scale(0.95) rotate(-3deg)';
                setTimeout(() => {
                    swipedElement.style.transition = 'none'; // On retire la transition pour le retour instantané
                    swipedElement.style.transform = '';
                }, 300);
                // Swipe vers la gauche (titre suivant)
                playNextTrack(1, true, true);
            }

            if (touchEndX > touchStartX + swipeThreshold) {
                // NOUVEAU: Animation de swipe avec transition (vers la droite)
                swipedElement.style.transition = 'transform 0.3s ease-out'; // Add transition
                swipedElement.style.transform = 'translateX(30px) scale(0.95) rotate(3deg)';
                setTimeout(() => {
                    swipedElement.style.transition = 'none';
                    swipedElement.style.transform = '';
                }, 300);
                // Swipe vers la droite (titre précédent)
                playNextTrack(-1, true, true);
            }
        }

        // NOUVEAU: Gestion du swipe vers le bas pour fermer l'overlay de la pochette
        let artworkTouchStartY = 0; // Artwork touch start Y
        artworkOverlay.addEventListener('touchstart', (e) => {
            artworkTouchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        artworkOverlay.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].screenY;
            if (touchEndY > artworkTouchStartY + 50) { // Swipe vers le bas de 50px
                artworkOverlay.classList.add('hidden'); // Hide artwork overlay
                playAudio(sounds.back);
                // Si l'état de l'historique est celui de l'overlay, on revient en arrière pour le nettoyer
                if (history.state && history.state.overlay === 'artwork') {
                    history.back();
                }
            }
        }, { passive: true });

        // NOUVEAU: Ouvrir le lecteur plein écran en cliquant sur le mini-lecteur
        // CORRECTION: La logique dépend maintenant de la zone cliquée (pochette ou reste).
        document.getElementById('mobile-mini-player').addEventListener('click', (e) => {
            if (!currentPlayingItem) return;
            
            const clickedOnArt = e.target.closest('#mini-player-album-art');

            if (clickedOnArt) {
                // Clic sur la pochette : on va vers les détails du titre ou le lecteur vidéo
                playAudio(sounds.select);
                if (isMusicTitle(currentPlayingItem)) {
                    renderMusicTitleDetails(currentPlayingItem);
                    showSection('music-title-details-section');
                } else {
                    showSection('large-player-section');
                }
            } else {
                // Clic sur le reste du mini-lecteur (hors contrôles) : on ouvre le grand lecteur mobile ou le lecteur vidéo
                if (isMusicTitle(currentPlayingItem)) {
                    if (!mobilePlayer.classList.contains('active')) {
                        mobilePlayer.classList.add('active');
                        setTimeout(() => {
                            checkTitleOverflow(document.getElementById('mobile-player-title'));
                            checkTitleOverflow(document.getElementById('mobile-player-artist'));
                        }, 450);
                    }
                } else {
                    // Si c'est une vidéo, on affiche la section du lecteur vidéo.
                    showSection('large-player-section');
                }
            }
        });

        // NOUVEAU: Gestion des liens de la barre de nav mobile
        document.getElementById('mobile-bottom-nav').addEventListener('click', (e) => {
            const navLink = e.target.closest('.mobile-nav-link[data-link]');
            if (navLink) {
                e.preventDefault();
                handleMenuNavigation(navLink.dataset.link);
            }
        });

        function toggleFullScreen(element) {
            if (!document.fullscreenElement) {
                if (element.requestFullscreen) { // Request fullscreen
                    element.requestFullscreen();
                } else if (element.mozRequestFullScreen) {
                    element.mozRequestFullScreen();
                } else if (element.webkitRequestFullscreen) {
                    element.webkitRequestFullscreen();
                } else if (element.msRequestFullscreen) {
                    element.msRequestFullscreen();
                }
            } else { // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }

        // NOUVEAU: Logique pour le bouton de sortie du plein écran
        document.getElementById('exit-fullscreen-btn').addEventListener('click', () => {
            if (document.fullscreenElement) toggleFullScreen();
        });

        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            const iframe = document.getElementById('large-player-iframe');
            if (iframe) toggleFullScreen(iframe); // Toggle fullscreen for iframe
        });

        // CORRECTION: Logique de swipe vers le bas pour quitter le plein écran sur mobile.
        // Cette logique est plus robuste car elle s'attache à l'élément qui est réellement en plein écran.
        let swipeDownTouchStartY = 0; // Variable pour stocker la position Y de départ du toucher

        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                swipeDownTouchStartY = e.touches[0].clientY;
            }
        };
        
        const handleTouchEnd = (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            const swipeDistance = touchEndY - swipeDownTouchStartY;
            const swipeThreshold = 75; // Seuil de 75px pour valider le swipe
        
            if (swipeDistance > swipeThreshold) {
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        };
        
        document.addEventListener('fullscreenchange', () => {
            const fullscreenElement = document.fullscreenElement;
            const exitBtn = document.getElementById('exit-fullscreen-btn');

            // Gère la visibilité du bouton de sortie
            if (exitBtn) {
                exitBtn.classList.toggle('visible', !!fullscreenElement);
            }

            if (fullscreenElement) {
                // On est entré en plein écran, on attache les écouteurs.
                fullscreenElement.addEventListener('touchstart', handleTouchStart, { passive: true });
                fullscreenElement.addEventListener('touchend', handleTouchEnd, { passive: true });
            } else {
                // On a quitté le plein écran, on nettoie les écouteurs pour éviter les problèmes.
                // (On ne peut pas cibler l'ancien élément, mais ce n'est pas grave car il n'est plus en plein écran)
            }
        });
        
        // PWA Install Button Listeners
        const pwaInstallBtn = document.getElementById('pwa-install-btn');
        const pwaDismissBtn = document.getElementById('pwa-dismiss-btn');
        const pwaOverlay = document.getElementById('pwa-install-overlay');

        pwaInstallBtn.addEventListener('click', async () => {
            if (!deferredPrompt) {
                return;
            } // If no deferred prompt, return
            pwaOverlay.classList.add('hidden');
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt & can't use it again.
            deferredPrompt = null;
        });

        pwaDismissBtn.addEventListener('click', () => {
            pwaOverlay.classList.add('hidden'); // Hide PWA overlay
        });

        // NOUVEAU: Gestion des clics dans le menu contextuel
        document.getElementById('card-context-menu').addEventListener('click', (e) => {
            const button = e.target.closest('.context-menu-btn');
            if (button) {
                e.stopPropagation(); // Empêche la fermeture immédiate du menu
                const action = button.dataset.action; // Get action from button
                const itemId = button.parentElement.parentElement.dataset.itemId;
                if (action === 'play-next') {
                    playNext(itemId);
                } else if (action === 'add-to-queue') {
                    addToQueue(itemId);
                } else if (action === 'remove-from-queue') {
                    // NOUVEAU: Logique pour retirer de la file d'attente
                    removeFromQueue(itemId);
                    // La fonction removeFromQueue s'occupe déjà de rafraîchir l'UI
                    playAudio(sounds.back);
                }
                closeCardContextMenu();
            }
        });
        // NOUVEAU: Gestion du swipe pour retour en arrière sur mobile (style iOS)
        const mainContent = document.getElementById('main-content-wrapper'); // Get main content wrapper
        let swipeBackTouchStartX = 0;
        let swipeBackTouchStartY = 0;
        let isSwipingBack = false;
        const swipeTriggerArea = 50; // Zone de déclenchement en pixels depuis le bord gauche
        const swipeThreshold = 100; // Distance minimale pour valider le swipe

        mainContent.addEventListener('touchstart', (e) => {
            // On ne déclenche que si le toucher commence sur le bord gauche et qu'il n'y a qu'un seul doigt
            if (e.touches[0].clientX < swipeTriggerArea && e.touches.length === 1) {
                swipeBackTouchStartX = e.touches[0].clientX; // Get touch start X
                swipeBackTouchStartY = e.touches[0].clientY;
                isSwipingBack = true;
                // On désactive la transition pour un suivi direct du doigt
                mainContent.style.transition = 'none';
            }
        }, { passive: true });

        mainContent.addEventListener('touchmove', (e) => {
            if (!isSwipingBack) return;

            const touchMoveX = e.touches[0].clientX; // Get touch move X
            const diffX = touchMoveX - swipeBackTouchStartX;

            // On ne bouge que si le swipe est vers la droite
            if (diffX > 0) {
                // Applique une transformation pour le feedback visuel, avec une résistance pour un effet naturel
                mainContent.style.transform = `translateX(${Math.pow(diffX, 0.85)}px)`;
            }
        }, { passive: true });

        mainContent.addEventListener('touchend', (e) => {
            if (!isSwipingBack) return;

            const diffX = e.changedTouches[0].clientX - swipeBackTouchStartX;
            const diffY = Math.abs(e.changedTouches[0].clientY - swipeBackTouchStartY); // Calculate vertical difference

            mainContent.style.transition = 'transform 0.3s ease-out';
            
            if (diffX > swipeThreshold && diffY < swipeThreshold) { // Swipe vers la droite validé
                window.history.back();
            }
            mainContent.style.transform = 'translateX(0)';
            isSwipingBack = false;
        });
    }

    // CORRECTION: La logique de la boutique est dans un écouteur global pour garantir qu'elle fonctionne partout.
    // Elle est placée ici, en dehors de `setupEventListeners` pour éviter les conflits.
    document.body.addEventListener('click', (e) => {
        const card = e.target.closest('.shop-product-card');
        const selectBtn = e.target.closest('.theme-buy-btn');
        const buyBtn = e.target.closest('.shop-buy-btn');

        // Détermine l'action en fonction de ce qui a été cliqué
        let actionTarget = null;
        if (selectBtn) {
            actionTarget = selectBtn;
        } else if (card && !buyBtn && !card.classList.contains('locked')) {
            // Si on clique sur la carte (et pas sur le bouton acheter) et qu'elle est débloquée
            actionTarget = card.querySelector('.theme-buy-btn');
        }

        // Gère le clic sur un thème verrouillé (soit le bouton, soit la carte)
        if ((selectBtn && selectBtn.classList.contains('locked')) || (card && card.classList.contains('locked') && !buyBtn)) {
            e.preventDefault();
            e.stopPropagation();
            const achievementId = selectBtn?.dataset.achievement;
            if (achievementId) {
                const missionName = getTranslation(`achievement_${achievementId}_title`);
                showDialog(`${getTranslation('unlockThemeMission')} "${missionName}"`);
            }
            playAudio(sounds.blocked);
            return;
        }
        if (buyBtn) {
            // CORRECTION: Logique d'achat simplifiée au maximum.
            e.preventDefault();
            e.stopPropagation();
            const itemId = buyBtn.dataset.itemId;
            const item = siteData.shopItems.backgrounds.find(b => b.id === itemId);
            if (!item) return;

            // 1. Vérifier si l'utilisateur a assez de pièces.
            if (userCoins >= item.cost) {
                // 2. Si oui, effectuer l'achat.
                userCoins -= item.cost;
                purchasedShopItems.add(item.id);
                localStorage.setItem('mmg-userCoins', JSON.stringify(userCoins));
                localStorage.setItem('mmg-purchasedItems', JSON.stringify([...purchasedShopItems]));
                
                updateCoinDisplay();
                renderShopItems();
                playAudio(sounds.coin);
                showDialog(getTranslation('purchaseSuccess'));
            } else {
                // 3. Si non, afficher un message d'erreur.
                showDialog(getTranslation('notEnoughCoins'));
                playAudio(sounds.blocked);
            }
            return;
        }

        // Gère la sélection d'un thème ou d'un arrière-plan débloqué/acheté
        if (actionTarget && !actionTarget.classList.contains('locked') && !actionTarget.classList.contains('selected')) {
            e.preventDefault();
            e.stopPropagation();
            const themeToApply = actionTarget.dataset.theme;
            applyTheme(themeToApply);

            playAudio(sounds.select);
        }
    });

    // NOUVEAU: Logique pour le menu contextuel des cartes
    function openCardContextMenu(event, itemId) {
        const menu = document.getElementById('card-context-menu');
        menu.dataset.itemId = itemId; // Set item ID
        menu.classList.remove('hidden');

        // Positionnement du menu
        // CORRECTION: Utilise les coordonnées du toucher sur mobile, sinon celles de la souris.
        const clickX = event.touches ? event.touches[0].clientX : event.clientX;
        const clickY = event.touches ? event.touches[0].clientY : event.clientY;

        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        let left = clickX; // Set left position
        let top = clickY;

        if (clickX + menuWidth > screenWidth) {
            left = screenWidth - menuWidth - 10;
        }
        if (clickY + menuHeight > screenHeight) {
            top = screenHeight - menuHeight - 10;
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    
        // Fermer le menu si on clique ailleurs
        setTimeout(() => { // Pour ne pas qu'il se ferme instantanément
            document.addEventListener('click', closeCardContextMenu, { once: true });
        }, 0);
    }

    function closeCardContextMenu() {
        const menu = document.getElementById('card-context-menu');
        if (menu) {
            menu.classList.add('hidden'); // Hide menu
        }
        document.removeEventListener('click', closeCardContextMenu);
    }

    // NOUVEAU: Fonction pour ajuster le scroll après un changement de hauteur du lecteur
    function adjustScrollAfterPlayerToggle() {
        const contentBoard = document.querySelector('.content-section-board');
        if (!contentBoard) return;

        // On vérifie si l'utilisateur est "proche" du bas de la page
        const isAtBottom = contentBoard.scrollHeight - contentBoard.scrollTop - contentBoard.clientHeight < 100;

        if (isAtBottom) {
            // On force le défilement tout en bas pour compenser le changement de padding
            setTimeout(() => {
                contentBoard.scrollTop = contentBoard.scrollHeight;
            }, 50); // Petit délai pour laisser le temps au DOM de se mettre à jour
        }
    }
    // NOUVEAU: Fonction pour retirer un titre de la file d'attente
    function removeFromQueue(itemId) {
        const itemIndex = userQueue.indexOf(itemId);
        if (itemIndex > -1) {
            userQueue.splice(itemIndex, 1);
            updateAllQueueViews(); // CORRECTION: Met à jour toutes les vues de la file d'attente
        }
    }

    // NOUVEAU: Fonction centralisée pour mettre à jour toutes les vues de la file d'attente
    function updateAllQueueViews() {
        // 1. File d'attente du tableau de bord (desktop)
        renderDashboardQueue();

        // 2. Overlay de la file d'attente (desktop)
        const queueOverlay = document.getElementById('queue-overlay');
        if (queueOverlay && !queueOverlay.classList.contains('hidden')) {
            renderQueue();
        }

        // 3. Panneau de la file d'attente (mobile)
        const mobileQueuePanel = document.getElementById('mobile-queue-panel');
        if (mobileQueuePanel && !mobileQueuePanel.classList.contains('hidden')) {
            renderMobileQueue();
        }
    }

    function handleMenuNavigation(dataLink, updateHistory = true, context = null) {
        // CORRECTION DÉFINITIVE: La source de vérité pour l'onglet actif est le `context` passé en argument.
        // S'il n'y a pas de contexte, on affiche l'onglet par défaut ('liked').
        const activeTabForLibrary = (dataLink === 'library-section' && context?.type === 'library')
            ? context.data
            : 'liked'; // Fallback par défaut

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
    
        // NOUVEAU: Réinitialise la position de défilement en haut de la page à chaque navigation.
        const contentBoard = document.querySelector('.content-section-board');
        if (contentBoard) {
            contentBoard.scrollTop = 0;
        }

        const profileContent = siteData.contentData[activeProfile];

        // CORRECTION: Détermine dynamiquement la source des données en fonction du profil actif.
        const getSectionData = (link) => {
            const profileMenu = siteData.projectData[activeProfile];
            const menuItem = Object.values(profileMenu).find(item => item.link === link);
            if (!menuItem) return null;
            // La langKey (ex: 'albums', 'albumsBeats') correspond à la clé dans contentData.
            return profileContent[menuItem.langKey];
        };

        // CORRECTION: La fonction est déplacée ici pour être accessible globalement dans le script.
        const renderVideosPage = (activeTabId = 'clips') => {
            const tabsContainer = document.getElementById('videos-tabs-container');
            const titleElement = document.getElementById('videos-section-title');
            if (!tabsContainer || !titleElement) return;

            // Récupère le profil actif à chaque appel pour être toujours à jour.
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
            const profileContent = siteData.contentData[activeProfile];

            const tabs = [
                { id: 'clips', title: getTranslation('videos'), data: profileContent.videos },
                { id: 'makingofs', title: getTranslation('bonus'), data: profileContent.bonus }
            ];

            tabsContainer.innerHTML = tabs.map(tab => 
                `<button class="playlist-tab-btn ${tab.id === activeTabId ? 'active' : ''}" data-tab-id="${tab.id}">${tab.title}</button>`
            ).join('');

            const activeTabData = tabs.find(tab => tab.id === activeTabId)?.data || {};
            titleElement.textContent = tabs.find(tab => tab.id === activeTabId)?.title || getTranslation('videos');

            renderCards('videos-cards', activeTabData, 'video');

            tabsContainer.querySelectorAll('.playlist-tab-btn').forEach(tab => {
                tab.addEventListener('click', () => {
                    playAudio(sounds.select);
                    renderVideosPage(tab.dataset.tabId);
                });
            });

            currentViewContext = { type: 'videos', data: activeTabId };
        };

        // CORRECTION: La section 'bonus' est fusionnée dans 'videos'.
        const sections = {
            'albums-section': { data: getSectionData('albums-section') || profileContent.albums, type: 'album', container: 'albums-cards' }
        };

        if (!document.getElementById(dataLink)) {
            currentViewContext = { type: 'home', data: null };
            dataLink = 'home-dashboard-section'; // Fallback to home
        }

        // Réinitialiser le fond de la section "À propos" si on la quitte
        // MODIFICATION: On s'assure de nettoyer le style en quittant la section
        document.getElementById('about-content').style.backgroundImage = ''; // Clear background image

        if (dataLink === 'home-dashboard-section') {
            currentViewContext = { type: 'home', data: null };
            // Le HTML est déjà dans la page, on a juste besoin de le mettre à jour.
            renderDashboard();
        } else if (dataLink === 'about-section') {
            currentViewContext = { type: 'about', data: null };
            document.getElementById('about-title').textContent = getTranslation('about'); // Set about title

            // CORRECTION: La variable avatarUrl n'était pas définie dans cette portée.
            const avatarUrl = activeProfile === 'mmg-music' ? 'assets/mmg-music-avatar.webp' : 'assets/mmg-beats-avatar.webp';

            const aboutTextKey = `about_${activeProfile.replace('-', '_')}`;
            document.getElementById('about-content').innerHTML = `<img src="${avatarUrl}" alt="Avatar"><p>${getTranslation(aboutTextKey)}</p>`;
        } else if (dataLink === 'liked-titles-section') {
            // CORRECTION: Redirige l'ancien lien "liked-titles-section" vers la nouvelle bibliothèque
            handleMenuNavigation('library-section', updateHistory);
            return; // Arrêter l'exécution ici
        } else if (dataLink === 'library-section') {
            // CORRECTION DÉFINITIVE : On met à jour le contexte de la vue actuelle AVANT d'appeler render/show. C'est cet état qui sera sauvegardé dans l'historique.
            currentViewContext = { type: 'library', data: activeTabForLibrary }; 
            renderLibraryPage(activeTabForLibrary); // Affiche la bibliothèque avec l'onglet spécifié
        // NOUVEAU: Ajout de la gestion de la page boutique
        const shopSection = document.getElementById('shop-section');
        if (shopSection && !shopSection.classList.contains('hidden')) {
            renderShopPage();
        }

        } else if (dataLink === 'shop-section') {
            currentViewContext = { type: 'shop', data: null };
            renderShopPage();
        } else if (dataLink === 'videos-section') {
            // CORRECTION: Gère la navigation vers la section vidéo unifiée.
            // Si un contexte d'onglet est fourni (ex: retour en arrière), on l'utilise, sinon on affiche l'onglet par défaut.
            const activeTabForVideos = (context?.type === 'videos') ? context.data : 'clips';
            renderVideosPage(activeTabForVideos);
        } else if (sections[dataLink]) { // Handle other generic sections
            currentViewContext = { type: sections[dataLink].type, data: null };
            const cardType = sections[dataLink].type;
            const containerId = sections[dataLink].container;
            renderCards(containerId, sections[dataLink].data, cardType);
            // CORRECTION: L'appel à setupTitleScrollObserver est maintenant géré directement dans renderCards.
        }
        
        // NOUVEAU: Retire le surlignage de la carte avant de naviguer
        unhighlightPlayingCard();
        showSection(dataLink, updateHistory);

        // NOUVEAU: Mettre à jour l'état actif de la barre de nav mobile
        document.querySelectorAll('#mobile-bottom-nav .mobile-nav-link, #sidebar-main-nav .sidebar-nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.link === dataLink);
        });
    
    }

    function renderLibraryPage(activeTabId = 'liked') {
        const tabsContainer = document.getElementById('library-tabs-container');
        const titleElement = document.getElementById('library-section-title');
        const clearBtn = document.getElementById('library-clear-playlist-btn');

        if (!tabsContainer || !titleElement || !clearBtn) return;
    
        const tabs = [
            { id: 'liked', title: getTranslation('likedTitles') },
            { id: 'current', title: getTranslation('currentPlaylist') }
        ];
        const savedPlaylistTabs = Object.keys(savedPlaylists).map(name => ({ id: name, title: name }));
        tabsContainer.innerHTML = [...tabs, ...savedPlaylistTabs].map(tab => 
            `<button class="playlist-tab-btn ${tab.id === activeTabId ? 'active' : ''}" data-tab-id="${tab.id}" title="${tab.title}">${tab.title}</button>`
        ).join('');
    
        let itemsToShow = [];
        let isCustomPlaylist = false;

        if (activeTabId === 'liked') {
            itemsToShow = [...likedSongs].map(id => findItemById(id)).filter(Boolean);
            titleElement.textContent = getTranslation('likedTitles'); // Titre de la section
            isCustomPlaylist = false;
        } else if (activeTabId === 'current') {
            itemsToShow = currentPlaylist.map(id => findItemById(id)).filter(Boolean);
            titleElement.textContent = getTranslation('currentPlaylist'); // Titre de la section
            isCustomPlaylist = true;
        } else { // C'est une playlist sauvegardée
            itemsToShow = (savedPlaylists[activeTabId] || []).map(id => findItemById(id)).filter(Boolean);
            titleElement.textContent = activeTabId; // Set title element text
            isCustomPlaylist = false; // On ne peut pas éditer les playlists sauvegardées pour l'instant
        }

        if (clearBtn) clearBtn.style.display = isCustomPlaylist ? 'flex' : 'none';

        const itemsAsObject = itemsToShow.reduce((acc, item) => {
            if (item) acc[item.id] = item;
            return acc;
        }, {});

        renderCards('library-container', itemsAsObject, 'title'); // The 'title' type displays title cards

        // CORRECTION : S'assure que le conteneur de la bibliothèque a les bonnes classes pour la vue grille/liste.
        const libraryContainer = document.getElementById('library-container');
        const globalView = localStorage.getItem('mmg-global-view') || 'grid';
        const isListView = globalView === 'list';
        libraryContainer.classList.toggle('titles-grid', !isListView);
        libraryContainer.classList.toggle('list-view', isListView);

        if (currentPlayingItem) highlightPlayingCard(currentPlayingItem);

        if (itemsToShow.length === 0) {
            const listContainer = document.getElementById('library-container');
            let emptyMessageKey = 'noResults';
            if (activeTabId === 'liked') {
                emptyMessageKey = 'noLikedTitles';
            } else if (activeTabId === 'current') {
                emptyMessageKey = 'playlistEmpty';
            }
            listContainer.innerHTML = `<p style="font-size: 1.2em; opacity: 0.7; text-align: center; padding: 40px 20px;">${getTranslation(emptyMessageKey)}</p>`;
            listContainer.style.display = 'flex';
            listContainer.style.alignItems = 'center';
        }
    
        tabsContainer.querySelectorAll('.playlist-tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                renderLibraryPage(tab.dataset.tabId);
            });
        });

        clearBtn.onclick = () => {
            currentPlaylist = [];
            currentQueueIndex = -1;
            localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist));
            renderLibraryPage('current'); // Re-render l'onglet de la playlist actuelle
            showDialog(getTranslation("playlistCleared")); // Show playlist cleared dialog
            playAudio(sounds.back);
        };
    }

    // CORRECTION: Déplacée ici pour être dans la portée globale
    function updateLoopShuffleUI() {
        const loopButtons = [document.getElementById('loop-btn'), document.getElementById('mobile-player-loop-btn')];
        const shuffleButtons = [document.getElementById('shuffle-btn'), document.getElementById('mobile-player-shuffle-btn')];

        loopButtons.forEach(btn => btn?.classList.toggle('active', isPlayerLooping));
        shuffleButtons.forEach(btn => btn?.classList.toggle('active', isShuffleMode));
    }

        // NOUVEAU: Fonction pour afficher les liens des réseaux sociaux dynamiquement
    function renderSocials() {
        const container = document.getElementById('socials-list-container');
        if (!container) return;

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        const socialLinks = siteData.projectData[activeProfile]?.socialLinks;

        if (!socialLinks) {
            container.innerHTML = ''; // Vide le conteneur s'il n'y a pas de liens
            return;
        }

        // NOUVEAU: Configuration des icônes SVG et des noms pour chaque plateforme
        const platformConfig = {
            instagram:  { name: 'Instagram',   icon: 'fab fa-instagram' },
            spotify:    { name: 'Spotify',     icon: 'fab fa-spotify' },
            appleMusic: { name: 'Apple Music', icon: 'fab fa-apple' },
            deezer:     { name: 'Deezer',      icon: 'fab fa-deezer' }
        };

        container.innerHTML = Object.entries(socialLinks).map(([key, linkData]) => {
            const config = platformConfig[key];
            if (!config) return '';
            // MODIFICATION: Utilise une icône Font Awesome au lieu d'un SVG inline
            return `
                <a href="${linkData.url}" target="_blank" class="Btn ${key}" title="${config.name}">
                    <i class="${config.icon}"></i>
                    <span class="text">${linkData.user}</span>
                </a>
            `;
        }).join('');
    }

    function renderDashboard() { // Render dashboard sections
        renderDashboardCarousel(); // Carrousel des nouveautés
        renderRecommendedPlaylists();
        renderDashboardGuide(); // NOUVEAU: Affiche les boutons du guide
        renderDashboardQueue(); // NOUVEAU: File d'attente
        renderSocials(); // CORRECTION: Appel manquant pour afficher les réseaux sociaux

        // CORRECTION: S'assure que l'image de la carte "À propos" est chargée avec le dashboard.
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        const avatarUrl = activeProfile === 'mmg-music' ? 'assets/mmg-music-avatar.webp' : 'assets/mmg-beats-avatar.webp';
        const aboutCard = document.querySelector('.dashboard-about-card');
        if (aboutCard) {
            aboutCard.style.backgroundImage = `url('${avatarUrl}')`;
        }
    }

    // NOUVEAU: Fonction pour afficher les boutons du guide sur le tableau de bord
    function renderDashboardGuide() {
        const container = document.getElementById('dashboard-guide-buttons');
        if (!container) return;

        container.innerHTML = `
            <button class="guide-choice-btn" data-guide="main" data-lang-key="guideMain">1. Menu Principal</button>
            <button class="guide-choice-btn" data-guide="music" data-lang-key="guideMusic">2. Titres Musicaux</button>
        `;
    }

    function renderDashboardCarousel() {
        const container = document.getElementById('dashboard-carousel-container');
        const dotsContainer = document.getElementById('dashboard-carousel-dots');
        if (!container || !dotsContainer) return;

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'; // Get active profile
        const allTitles = Object.values(siteData.contentData[activeProfile].titles);
        const latestItems = allTitles.sort((a, b) => new Date(b.year, 0, 1) - new Date(a.year, 0, 1)).slice(0, 3);

        container.innerHTML = latestItems.map(item => {
            // CORRECTION: Utilisation de la même logique que pour les autres cartes pour afficher la description.
            const translatedDesc = getTranslation(`desc_${item.id}`);
            let description = (translatedDesc.startsWith('[')) ? (item.description || '') : translatedDesc;
            // MODIFICATION: Tronque la description pour qu'elle soit courte.
            if (description.length > 50) {
                description = description.substring(0, 50) + '...';
            }
            return `
            <div class="carousel-item" data-item-id="${item.id}">
                <img src="${getCorrectImagePath(item, 'thumb')}" alt="${item.title}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${getCorrectImagePath(item, 'full')}'" />
                <div class="carousel-item-info">
                    <h3 class="card__title"><span>${item.title}</span></h3>
                    <p>${description}</p>
                    <button class="dashboard-card-button" data-youtube-id="${item.youtube_id}" data-item-id="${item.id}">${getTranslation('listenNow')}</button>
                </div>
            </div>
        `}).join('');

        dotsContainer.innerHTML = latestItems.map((_, index) => `<button data-slide-index="${index}" class="${index === 0 ? 'active' : ''}"></button>`).join(''); // Render carousel dots
        setupCarousel();
        // CORRECTION: Cible spécifiquement les spans des titres dans le carrousel pour le défilement.
        setupTitleScrollObserver('#dashboard-carousel-container .carousel-item-info .card__title > span');
    }

    // NOUVEAU: Gestionnaire de clic pour les playlists recommandées
    function handleRecoPlaylistClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const card = e.target.closest('.card');
        if (!card) return;

        const playlistId = card.dataset.itemId; // L'ID de la playlist est stocké dans itemId
        const playlistName = card.querySelector('.card__title span').textContent; // Le nom est dans le titre de la carte

        // Si la playlist n'est pas déjà sauvegardée, on la sauvegarde d'abord.
        if (!savedPlaylists[playlistName]) {
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
            const allTitles = Object.values(siteData.contentData[activeProfile].titles);
            const chillVibesIds = ['title1', 'title2', 'title3', 'title4', 'title5', 'title7', 'title8', 'title12', 'title13', 'title16', 'title17', 'title20', 'title21'];
            const items = (playlistId === 'chill') ? allTitles.filter(title => chillVibesIds.includes(title.id)) : allTitles.filter(title => ['title3', 'title4', 'title8'].includes(title.id));
            savedPlaylists[playlistName] = items.map(item => item.id);
            localStorage.setItem('mmg-savedPlaylists', JSON.stringify(savedPlaylists));
            showDialog(getTranslation('playlistSaved'));
        }

        playAudio(sounds.select);
        handleMenuNavigation('library-section', true, { type: 'library', data: playlistName });
    }

    function renderRecommendedPlaylists() {
        const container = document.getElementById('playlist-reco-list'); // Le conteneur a changé d'ID
        if (!container) return;

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'; // Get active profile
        const allTitles = Object.values(siteData.contentData[activeProfile].titles);

        // MODIFICATION: La playlist "Chill Vibes" utilise maintenant une liste d'IDs spécifique.
        const chillVibesIds = ['title1', 'title2', 'title3', 'title4', 'title5', 'title7', 'title8', 'title12', 'title13', 'title16', 'title17', 'title20', 'title21'];
        const playlists = [
            {
                id: 'chill',
                name: 'Chill Vibes', // Nom de la playlist
                icon: 'fa-music',
                items: allTitles.filter(title => chillVibesIds.includes(title.id))
            },
            {
                id: 'frutiger',
                name: 'Frutiger Aero',
                icon: 'fa-bolt', // Icône pour l'énergie/numérique
                items: allTitles.filter(title => ['title3', 'title4', 'title8'].includes(title.id))
            }
        ];

        if (playlists.every(p => p.items.length === 0)) { // If all playlists are empty
            container.innerHTML = `<p class="no-content-message">Aucune playlist recommandée.</p>`;
            return;
        }

        // CORRECTION: On revient à la génération de cartes colorées spécifiques pour les playlists recommandées.
        container.innerHTML = playlists.map(playlist => {
            // On ajoute une classe spécifique pour la couleur (ex: reco-playlist-chill)
            return `
                <div class="card card-reco-playlist" data-item-id="${playlist.id}">
                    <a href="#" class="card-link-wrapper" data-album-id="${playlist.id}">
                        <div class="card-image-container">
                            <div class="card__image card-icon-bg reco-playlist-${playlist.id}">
                                <i class="fas ${playlist.icon}"></i>
                            </div>
                        </div>
                    </a>
                    <div class="card-info-container">
                        <div class="card__text">
                            <p class="card__title" title="${playlist.name}"><span>${playlist.name}</span></p>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    // NOUVEAU: Fonction pour afficher la file d'attente sur le tableau de bord
    function renderDashboardQueue() {
        const container = document.getElementById('dashboard-queue-list');
        if (!container) return;

        // MODIFICATION: On ne montre que les 4 premiers titres sur le tableau de bord
        const tracksToShow = userQueue.slice(0, 4);
        const hasMoreTracks = userQueue.length > 4;

        if (userQueue.length === 0) {
            // MODIFICATION: Message plus explicite quand la file d'attente est vide.
            container.innerHTML = `<p style="font-size: 0.9em; opacity: 0.7; text-align: center; padding: 20px; line-height: 1.5;">${getTranslation('queueEmpty')}</p>`;
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            // Cache l'en-tête s'il n'y a rien
            const header = document.querySelector(`[data-header-for="dashboard-queue-list"]`);
            if (header) header.classList.add('hidden');
            return;
        }

        // MODIFICATION: On réutilise renderCards avec le type 'title' pour avoir la vue en liste
        const itemsAsObject = tracksToShow.reduce((acc, itemId) => {
            const item = findItemById(itemId);
            if (item) acc[item.id] = item;
            return acc;
        }, {});

        // On force la vue en liste pour la file d'attente
        const originalView = localStorage.getItem('mmg-global-view');
        localStorage.setItem('mmg-global-view', 'list');

        renderCards('dashboard-queue-list', itemsAsObject, 'title');

        // On restaure la préférence de vue de l'utilisateur
        if (originalView) {
            localStorage.setItem('mmg-global-view', originalView);
        } else {
            localStorage.removeItem('mmg-global-view');
        }

        // NOUVEAU: Ajouter le bouton "Voir plus" si nécessaire
        if (hasMoreTracks) {
            const seeMoreButton = document.createElement('button');
            seeMoreButton.textContent = getTranslation('viewMore');
            seeMoreButton.className = 'dashboard-see-more-btn'; // Classe pour le style
            seeMoreButton.addEventListener('click', () => {
                openOverlay(document.getElementById('queue-overlay'), sounds.select, true);
            });
                // On l'ajoute DANS le conteneur de la liste, après les titres.
                container.appendChild(seeMoreButton);
        }
    }

    // NOUVEAU: Gestionnaire de clic pour les playlists recommandées
    function handleRecoPlaylistClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const card = e.target.closest('.card');
        if (!card) return;

        const playlistId = card.dataset.itemId; // L'ID de la playlist est stocké dans itemId
        const playlistName = card.querySelector('.card__title span').textContent; // Le nom est dans le titre de la carte

        // Si la playlist n'est pas déjà sauvegardée, on la sauvegarde d'abord.
        if (!savedPlaylists[playlistName]) {
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
            const allTitles = Object.values(siteData.contentData[activeProfile].titles);
            let items = [];
            if (playlistId === 'chill') {
                items = allTitles.filter(title => title.tags?.includes('chill'));
            } else if (playlistId === 'frutiger') {
                items = allTitles.filter(title => ['title3', 'title4', 'title8'].includes(title.id));
            }
            savedPlaylists[playlistName] = items.map(item => item.id);
            localStorage.setItem('mmg-savedPlaylists', JSON.stringify(savedPlaylists));
            showDialog(getTranslation('playlistSaved'));
        }

        // Navigue vers la bibliothèque et affiche la playlist.
        playAudio(sounds.select);
        handleMenuNavigation('library-section', true, { type: 'library', data: playlistName });
    }

    function setupCarousel() {
        const container = document.getElementById('dashboard-carousel-container');
        const dotsContainer = document.getElementById('dashboard-carousel-dots');
        if (!container || !dotsContainer) return;

        let currentSlide = 0;
        const slides = container.querySelectorAll('.carousel-item');
        const dots = dotsContainer.querySelectorAll('button');
        const totalSlides = slides.length;

        if (totalSlides <= 1) return; // No need for carousel if 1 or less slides

        // CORRECTION: Nettoyer l'ancien minuteur avant d'en créer un nouveau
        if (carouselInterval) {
            clearInterval(carouselInterval);
        }
        carouselInterval = setInterval(nextSlide, 5000);

        function showSlide(index) {
            currentSlide = (index + totalSlides) % totalSlides;
            const scrollPosition = currentSlide * container.offsetWidth; // Calculate scroll position
            container.scrollLeft = scrollPosition;
            updateDots();
        }

        function nextSlide() {
            showSlide(currentSlide + 1);
        }

        function updateDots() {
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentSlide); // Toggle active class for dot
            });
        }

        function resetInterval() {
            clearInterval(carouselInterval);
            carouselInterval = setInterval(nextSlide, 5000);
        }

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                showSlide(index);
                resetInterval();
            });
        });

        // NOUVEAU: Handle dot updates on manual swipe on mobile.
        let scrollTimeout;
        container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const newSlideIndex = Math.round(container.scrollLeft / container.offsetWidth);
                if (newSlideIndex !== currentSlide) {
                    showSlide(newSlideIndex);
                    resetInterval(); // Reset interval
                }
            }, 100); // Délai pour ne pas surcharger le navigateur pendant le scroll
        });
    }

    // NOUVEAU: Fonction dédiée pour rendre la file d'attente dans le panneau mobile
    function renderMobileQueue() {
        const container = document.getElementById('mobile-queue-list');
        const contextNameEl = document.getElementById('mobile-queue-context-name');
        if (!container || !contextNameEl) return;

        // CORRECTION: La logique de file d'attente est simplifiée.
        // On affiche le titre en cours, puis TOUTE la userQueue.
        const currentPlayingIndexInUserQueue = currentPlayingItem ? userQueue.indexOf(currentPlayingItem.id) : -1;
        
        // CORRECTION: La liste "à venir" est simplement la userQueue. Le titre en cours est affiché
        // séparément et n'est pas dans la userQueue, donc pas besoin de filtrer.
        // La fonction playVideoWhenReady retire le titre de la userQueue avant de le jouer.
        const upcomingTracks = userQueue;

        // Mettre à jour le contexte
        let contextText = '';
        if (currentPlayingItem) {
            switch (currentPlaybackContext.type) {
                case 'album': contextText = `Album : ${currentPlaybackContext.name}`; break;
                case 'playlist': contextText = `Playlist : ${currentPlaybackContext.name}`; break;
                case 'mmgPlaylist': contextText = `Playlist : ${currentPlaybackContext.name}`; break;
                case 'liked': contextText = getTranslation('fromLiked'); break;
                case 'search': contextText = getTranslation('fromSearch'); break;
                default: contextText = getTranslation('fromTitles'); break;
            }
        }
        contextNameEl.textContent = contextText;

        // Construire la liste
        let html = '';
        const nowPlayingItemHtml = currentPlayingItem ? `
            <div class="playlist-item-wrapper">
                <div class="playlist-item-content">
                    <div class="playlist-item currently-playing" data-item-id="${currentPlayingItem.id}">
                        <span class="mobile-queue-drag-handle-placeholder"></span> <!-- CORRECTION: Le titre en cours n'a pas de poignée -->
                        <img src="${getCorrectImagePath(currentPlayingItem)}" alt="${currentPlayingItem.title}">
                        <div class="playlist-item-info">
                            <p class="playlist-item-title">${currentPlayingItem.title}</p>
                            <p class="playlist-item-subtitle">${currentPlayingItem.year || 'Vidéo'}</p>
                        </div>
                        <span class="currently-playing-indicator"><i class="fas fa-volume-up"></i></span>
                    </div>
                </div>
            </div>
        ` : '';

        const upcomingItemsHtml = upcomingTracks.map(itemId => {
            const item = findItemById(itemId);
            if (!item) return '';
            // NOUVEAU: Structure avec wrapper pour le swipe
            return `
                <div class="playlist-item-wrapper">
                    <div class="playlist-item-delete-action" data-delete-id="${itemId}">
                        <i class="fas fa-trash-alt"></i>
                    </div>
                    <div class="playlist-item-content">
                        <div class="playlist-item" data-item-id="${itemId}">
                            <i class="fas fa-bars mobile-queue-drag-handle"></i>
                            <img src="${getCorrectImagePath(item)}" alt="${item.title}">
                            <div class="playlist-item-info">
                                <p class="playlist-item-title">${item.title}</p>
                                <p class="playlist-item-subtitle">${item.year || 'Vidéo'}</p>
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        container.innerHTML = nowPlayingItemHtml + upcomingItemsHtml;

        // NOUVEAU: Ajouter les écouteurs pour les boutons supprimer
        container.querySelectorAll('.playlist-item-delete-action').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemIdToDelete = button.dataset.deleteId;
                const itemWrapper = button.closest('.playlist-item-wrapper');
                
                // Animation de suppression
                if (itemWrapper) {
                    itemWrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease, max-height 0.3s ease';
                    itemWrapper.style.transform = 'translateX(20px)';
                    itemWrapper.style.opacity = '0';
                    itemWrapper.style.maxHeight = '0px';
                    setTimeout(() => removeFromQueue(itemIdToDelete), 300); // Supprime après l'animation
                } else {
                    removeFromQueue(itemIdToDelete);
                }
                playAudio(sounds.back);
            });
        });
    }

    function renderUpdateLog() {
        const container = document.getElementById('update-log-entries');
        if (!container || !siteData.updateLog) return;

        const allMessages = [
            ...(siteData.devMessages || []),
            ...(siteData.updateLog || [])
        ];

        container.innerHTML = allMessages.map(entry => { // Map messages to HTML
            const isRead = readUpdateIds.has(entry.id);
            const isDevMessage = !!entry.content.includes('développeur'); // Simple check
            return `
                <div class="update-log-entry ${isRead ? 'read' : 'unread'}">
                    <h5>${entry.date || 'Message du développeur'}</h5>
                    <p>${entry.content}</p>
                </div>
            `;
        }).join('');
    }
