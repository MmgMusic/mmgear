
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
                Object.entries(profile.titles).forEach(([key, val]) => val.id = key);
                Object.entries(profile.gameplay).forEach(([key, val]) => val.id = key);
                Object.entries(profile.makingofs).forEach(([key, val]) => val.id = key);
                Object.entries(profile.albums).forEach(([key, val]) => {
                    val.id = key;
                    val.type = 'album';
                });
                Object.assign(allSearchableItems, profile.titles, profile.gameplay, profile.makingofs, profile.albums);
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
            
            const finalProgress = activePlayer.getDuration() > 0 ? activePlayer.getCurrentTime() / activePlayer.getDuration() : 0;
            
            if (currentPlayingItem && isMusicTitle(currentPlayingItem) && !seekDetectedInCurrentPlay && finalProgress >= 0.95) {
                userCoins++;
                localStorage.setItem('mmg-userCoins', JSON.stringify(userCoins));
                updateCoinDisplay();
                showDialog(`+1 pièce ! Total : ${userCoins}`);
                playAudio(sounds.coin);

                const itemId = currentPlayingItem.id;
                if (isPlayerLooping) updateAchievementProgress('loopMaster', itemId);
                if (currentPlayingItem.tags?.includes('retro')) updateAchievementProgress('retroPlayer', itemId);
                if (currentPlayingItem.tags?.includes('playstation')) updateAchievementProgress('psPlayer', itemId);
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
        
        currentPlayingItem = item; // CORRECTION : Toujours définir le titre en cours, même si on ne le lance pas.

        // CORRECTION: Si l'autoplay est OFF, on n'affiche que la page de détails pour les titres musicaux, mais on laisse les vidéos se lancer.
        if (!isAutoplayActive && !forceTempPlay && isMusicTitle(item)) {
            renderMusicTitleDetails(item);
            showSection('music-title-details-section');
            updateTempPlayButtonVisibility(); // CORRECTION: Assure que le bouton "Play" s'affiche correctement.
            return;
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
            psPlayer: { unlocked: false, progress: [], goal: 2, icon: "fab fa-playstation" }
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
        unlockedTracks = storedUnlocked ? JSON.parse(storedUnlocked) : [];
    
        renderAchievements();
        updateShopLocksAndSelection();
    }
    
    // ... (le reste de la fonction initUserData)
    
    
    function updateCoinDisplay() {
        const coinElement = document.getElementById('coin-count');
        if(coinElement) coinElement.textContent = userCoins;
    }

    function updateNotificationDot() {
        const dot = document.querySelector('.notification-dot');
        const markAsReadBtn = document.getElementById('mark-as-read-btn');
        const unlockNotification = document.getElementById('unlock-notification-item');
        if (!dot || !unlockNotification || !markAsReadBtn) return;

        // Condition 1: L'utilisateur peut débloquer un titre
        const allUnlockableTracks = Object.values(allSearchableItems).filter(t => t.isUnlockable);
        const hasLockedTracks = allUnlockableTracks.some(t => !unlockedTracks.includes(t.id));
        const canUnlock = userCoins >= COIN_COST_UNLOCK && hasLockedTracks;

        // Condition 2: Il y a un message non lu
        const hasUnreadUpdateLog = siteData.updateLog && siteData.updateLog.some(entry => !readUpdateIds.has(entry.id));
        const hasUnreadDevMessage = siteData.devMessages && siteData.devMessages.some(entry => !readUpdateIds.has(entry.id));
        const hasUnreadMessages = hasUnreadUpdateLog || hasUnreadDevMessage;


        // MODIFICATION: Le point rouge ne s'affiche que s'il y a des messages non lus.
        dot.classList.toggle('hidden', !hasUnreadMessages);
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
                ach.progress.push(value);
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
        }
    
        if (progressChanged) {
            localStorage.setItem('mmg-achievements', JSON.stringify(achievements));
            renderAchievements();
        }
    }

    function unlockAchievement(id) {
        if (achievements[id].unlocked) return;
        achievements[id].unlocked = true;
        localStorage.setItem('mmg-achievements', JSON.stringify(achievements));
        playAudio(sounds.achievementUnlocked);
        showDialog(`${getTranslation('achievementUnlocked')}: ${getTranslation(`achievement_${id}_title`)}!`);
        renderAchievements();
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
            } else if (id === 'retroPlayer' || id === 'psPlayer') {
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

    function updateShopLocksAndSelection() {
        const currentUiTheme = localStorage.getItem('ui-theme') || 'default';
        const currentBgTheme = localStorage.getItem('bg-theme') || 'default-bg';

        document.querySelectorAll('.theme-buy-btn').forEach(btn => {
            const achievementId = btn.dataset.achievement;
            const themeId = btn.dataset.theme; 

            btn.disabled = false;
            if (achievementId && achievements[achievementId] && !achievements[achievementId].unlocked) {
                btn.classList.add('locked');
                btn.classList.remove('selected');
                btn.innerHTML = getTranslation('unlockWithLockIcon');
                btn.disabled = true;
            } else {
                btn.classList.remove('locked');
                if (themeId === currentUiTheme || themeId === currentBgTheme) {
                    btn.innerHTML = `<i class="fas fa-check"></i> ${getTranslation('selected')}`;
                    btn.classList.add('selected');
                    btn.disabled = true;
                } else {
                    btn.innerHTML = getTranslation('select');
                    btn.classList.remove('selected');
                }
            }
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
            showDialog(`"${findItemById(itemId).title}" ${getTranslation('addedToQueue')}.`);
            playAudio(sounds.select);
        }
    }

    function playNext(itemId) {
        // Si rien ne joue, on lance la lecture depuis la file utilisateur
        if (!currentPlayingItem) { 
            playVideoWhenReady(findItemById(itemId), [], -1, 'queue'); // Explicitly from queue
            return;
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

        // Retire le titre s'il est déjà dans la file d'attente pour éviter les doublons
        userQueue = userQueue.filter((id, index) => userQueue.indexOf(id) === index);

        showDialog(`"${findItemById(itemId).title}" ${getTranslation('playNext')}.`);
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

            queueItem.innerHTML = `
                <i class="fas fa-bars playlist-drag-handle" title="Réorganiser"></i>
                <img src="${getCorrectImagePath(item)}" alt="${item.title}">
                <div class="playlist-item-info">
                    <p class="playlist-item-title">${item.title}</p>
                    <p class="playlist-item-subtitle">${item.year || 'Vidéo'}</p>
                </div>
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
        const achievementsOverlay = document.getElementById('achievements-overlay');
        if (achievementsOverlay && !achievementsOverlay.classList.contains('hidden')) {
            updateAchievementsOverlayText();
        }
        // Ajouter d'autres overlays si nécessaire
    }

    function updateAchievementsOverlayText() {
        const overlay = document.getElementById('achievements-overlay');
        if (!overlay) return;
        overlay.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            const translation = getTranslation(key);
            if (el.placeholder) {
                el.placeholder = translation;
            } else {
                el.textContent = translation;
            }
        });
        renderAchievements(); // Re-render la liste qui contient aussi des traductions
    }

    function updateTime() {
        const timeString = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const desktopTime = document.getElementById('real-time');
        if (desktopTime) desktopTime.textContent = timeString;
        const mobileTime = document.getElementById('mobile-real-time');
        if (mobileTime) mobileTime.textContent = timeString;
    }
    
    function getCorrectImagePath(item) {
        if (!item || !item.image) {
            return 'https://placehold.co/200x120/9E9E9E/FFFFFF?text=No+Image';
        }
        if (item.image.startsWith('assets/')) {
            return item.image;
        }
        return item.image;
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
            const unlockedInAlbum = isUnlockableAlbum ? tracksInAlbum.filter(t => unlockedTracks.includes(t.id)) : [];

            const isTrackLocked = item.isUnlockable && !unlockedTracks.includes(itemId);
            const isAlbumLocked = isUnlockableAlbum && unlockedInAlbum.length < tracksInAlbum.length;
            const isLocked = isTrackLocked || isAlbumLocked;

            if (isLocked) {
                card.classList.add('locked');
            }

            const imagePath = getCorrectImagePath(item);
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
                        <img src="${imagePath}" onerror="this.onerror=null;this.src='https://placehold.co/48x48/e0e0e5/6a6a6f?text=CD'" alt="Pochette de ${translatedTitle}" class="list-view-item-image"/>
                        ${lockIconHtmlList}
                    </div>
                    <div class="list-view-title">
                        <span class="font-medium text-sm sm:text-base text-text-color"><span>${translatedTitle}</span></span>
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
                    const icons = {
                        'albums': { icon: 'fa-record-vinyl' }, 'videoClips': { icon: 'fa-camera' }, 'makingOfs': { icon: 'fa-lightbulb' },
                        'likedTitles': { icon: 'fa-heart' }, 'albumsBeats': { icon: 'fa-record-vinyl' }, 'videosBeats': { icon: 'fa-camera' }
                    };
                    const iconInfo = icons[item.langKey];
                    if (iconInfo) {
                        card.classList.add(`card-menu-${item.langKey}`);
                        cardImageHtml = `<div class="card__image card-icon-bg"><i class="fas ${iconInfo.icon}"></i></div>`; // Icon with background
                    } else {
                        card.classList.add('card-menu-about');
                        cardImageHtml = `<img class="card__image" loading="lazy" decoding="async" src="${getCorrectImagePath(item)}" alt="${translatedTitle}">`;
                    }
                } else {
                    cardImageHtml = `<img class="card__image" loading="lazy" decoding="async" src="${imagePath}" alt="${translatedTitle.replace(/"/g, '&quot;')}">`;
                    
                    let description = ''; // Description for the card
                    switch (cardType) {
                        case 'title': description = getTranslation(`desc_${item.id}`) || item.description || getTranslation('listenToTitle'); break;
                        case 'album':
                            if (isUnlockableAlbum) {
                                const lockedCount = tracksInAlbum.length - unlockedInAlbum.length;
                                if (lockedCount > 0) {
                                    const langKey = lockedCount === 1 ? 'trackToUnlock_one' : 'trackToUnlock_many';
                                    card.classList.add('has-unlockable-text');
                                    description = getTranslation(langKey, { count: lockedCount });
                                }
                            }
                            break;
                        case 'video': description = ''; break;
                        case 'search': // Search results can be albums, titles, or videos
                            description = item.type === 'album' ? getTranslation('viewAlbum') : (item.year ? getTranslation('musicTitle') : getTranslation('videoOrMakingOf')); 
                        default: description = getTranslation('viewContent');
                    }
                    // CORRECTION: Ajoute le texte "à débloquer" sous le titre de l'album en mode grille.
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

        // CORRECTION: Logique de défilement unifiée et corrigée pour TOUTES les vues.
        if (isListView) {
            // En mode liste, on cible les <span> à l'intérieur des colonnes qui peuvent déborder.
            const listSelectors = `#${containerId} .list-view-title > span, #${containerId} .list-view-artist-col > span, #${containerId} .recent-video-item-info .video-title > span`;
            setupTitleScrollObserver(listSelectors);
        } else {
            // En mode grille, on cible les <span> à l'intérieur des titres de carte standards.
            const gridSelector = `#${containerId} .card__title > span, #${containerId} .recent-video-item-info .video-title > span`;
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
        document.getElementById('details-album-art').src = getCorrectImagePath(item);
        document.getElementById('details-title').textContent = item.title;
        const albumSpan = document.getElementById('details-album');
        albumSpan.textContent = album ? album.title : getTranslation('unknown');
        albumSpan.parentElement.dataset.albumId = item.albumId;
        const yearSpan = document.getElementById('details-year');
        yearSpan.textContent = item.year || getTranslation('unknown');
        yearSpan.parentElement.dataset.year = item.year || '';
        document.getElementById('details-description').textContent = getTranslation(`desc_${item.id}`) || item.description;
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
                    if (siteData.contentData[activeProfile].gameplay[videoId]) {
                        gameplayContainer.appendChild(createVideoCard(video));
                        foundGameplay = true;
                    } else if (siteData.contentData[activeProfile].makingofs[videoId]) {
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

            const imageSrc = isMusicTitle(item) 
                ? getCorrectImagePath(item)
                : `https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg`;
            document.getElementById('player-album-cover').src = imageSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3C/svg%3E"; 
            document.getElementById('mobile-player-album-art').src = imageSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3C/svg%3E";
            document.getElementById('mini-player-album-art').src = imageSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3C/svg%3E";
            const miniPlayerTitle = document.getElementById('mini-player-title');
            const miniPlayerContext = document.getElementById('mini-player-context'); // Pour mobile
            const desktopPlayerContext = document.getElementById('desktop-player-context'); // Pour ordinateur
    
            if (miniPlayerTitle) {
                miniPlayerTitle.querySelector('span').textContent = item.title;
                miniPlayerTitle.parentElement.classList.remove('no-track'); // CORRECTION: Retire la classe de centrage
                checkTitleOverflow(miniPlayerTitle); // CORRECTION: Applique la logique de défilement
            }

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
        // MODIFICATION: Le mini-lecteur reste visible mais affiche un état vide.
        const miniPlayer = document.getElementById('mobile-mini-player');
        const miniPlayerHandle = document.getElementById('mobile-player-toggle-handle');
    
        if (miniPlayer) {
            miniPlayer.classList.remove('hidden'); // Assure qu'il est visible
            const albumArt = document.getElementById('mini-player-album-art');
            if (albumArt) {
                // On rend l'image invisible mais on garde sa place pour conserver la hauteur
                albumArt.style.opacity = '0';
                albumArt.style.display = 'block'; // Assure qu'elle occupe l'espace
            }
            const miniPlayerTitle = document.getElementById('mini-player-title');
            if (miniPlayerTitle) {
                miniPlayerTitle.querySelector('span').textContent = getTranslation('noTrackPlaying');
                miniPlayerTitle.parentElement.classList.add('no-track'); // Add class for centering
                miniPlayerTitle.classList.remove('scrolling'); // Arrête le défilement
            }
            // NOUVEAU: Vider le texte de contexte
            const miniPlayerContext = document.getElementById('mini-player-context');
            if (miniPlayerContext) {
                miniPlayerContext.textContent = '';
            }
            // NOUVEAU: Vider le texte de contexte sur le lecteur de bureau
            const desktopPlayerContext = document.getElementById('desktop-player-context');
            if (desktopPlayerContext) {
                desktopPlayerContext.textContent = '';
            } // Clear desktop player context
            if (document.getElementById('mini-player-controls')) document.getElementById('mini-player-controls').style.display = 'none';
            if (document.getElementById('mini-player-progress-fill')) document.getElementById('mini-player-progress-fill').style.width = '0%';
        }
        if (miniPlayerHandle) {
            miniPlayerHandle.classList.remove('hidden');
        }
    
        // Réinitialisation du lecteur de bureau
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('song-title').textContent = getTranslation('noTrackPlaying');
        document.getElementById('player-album-cover').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3C/svg%3E";

        // NOUVEAU: Réinitialisation du lecteur plein écran mobile
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
            const currentVisibleSection = document.querySelector('.page-section:not(.hidden)');
            if (currentVisibleSection && currentVisibleSection.id === 'library-section') {
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
    
    function applyTheme(themeName) {
        // Gérer les thèmes d'arrière-plan
        if (themeName.startsWith('theme-bg-') || themeName === 'default-bg') {
            // Nettoyer tous les thèmes de fond précédents
            const bgClasses = ['theme-bg-waves', 'theme-bg-gray'];
            document.body.classList.remove(...bgClasses);
            
            if (themeName === 'theme-bg-waves' || themeName === 'theme-bg-gray') {
                document.body.classList.add(themeName);
            }

            // Si c'est 'default-bg', on ne fait rien de plus, les bulles s'affichent par défaut.
            localStorage.setItem('bg-theme', themeName);
        } 
        // Gérer les thèmes d'interface
        else {
            const currentBgTheme = localStorage.getItem('bg-theme') || 'default-bg';
            document.body.className = ''; // Réinitialise tout
            if (currentBgTheme !== 'default') {
                document.body.classList.add(currentBgTheme);
            }
            if (themeName && themeName !== 'default') {
                document.body.classList.add(themeName);
            }
            localStorage.setItem('ui-theme', themeName);
        }

        const isDark = localStorage.getItem('theme') === 'dark';
        if (isDark) document.body.classList.add('dark-theme');
        if (document.body.classList.contains('tutorial-active-body')) {
            document.body.classList.add('tutorial-active-body');
        }
        updateShopLocksAndSelection();
    }

    // CORRECTION: Définition de la fonction manquante
    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const savedUiTheme = localStorage.getItem('ui-theme') || 'default';
        const savedBgTheme = localStorage.getItem('bg-theme') || 'default-bg';

        document.getElementById('theme-switch').checked = savedTheme === 'dark';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');
        applyTheme(savedUiTheme);
        applyTheme(savedBgTheme); // Applique aussi le thème de fond
    } // Apply background theme as well

    function resetToHome(playSelectSound = true) {
        if (playSelectSound) playAudio(sounds.select);
        handleMenuNavigation('home-dashboard-section');
    }
    
    function renderSidebarNav(activeProfile) {
        const navContainer = document.getElementById('sidebar-main-nav');
        if (!navContainer) return;

        const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id || 'home-dashboard-section'; // Get current section ID

        const iconMap = {
            'albums': 'fa-compact-disc', 'videoClips': 'fa-video', 'makingOfs': 'fa-lightbulb', // icône pour making-of
            'about': 'fa-info-circle', 'albumsBeats': 'fa-compact-disc',
            'videosBeats': 'fa-video' // CORRECTION: Utilisation de la même icône que pour les clips vidéos
        };

        // Séparer les liens du profil et le lien "À propos"
        const profileData = Object.values(siteData.projectData[activeProfile]);
        const aboutItem = profileData.find(item => item.langKey === 'about');
        const otherProfileItems = profileData.filter(item => item.langKey !== 'about');

        const profileLinks = otherProfileItems.map(item => { // Map other profile items to links
            const isActive = item.link === currentSectionId;
            return `
                <a href="#" class="sidebar-nav-link ${isActive ? 'active' : ''}" data-link="${item.link}">
                    <i class="fas ${iconMap[item.langKey] || 'fa-question-circle'}"></i>
                    <span data-lang-key="${item.langKey}">${getTranslation(item.langKey)}</span>
                </a>`;
        }).join('');

        // CORRECTION: Création du lien "Bibliothèque" qui remplace "Titres Likés"
        const libraryIsActive = currentSectionId === 'library-section'; // Check if library is active
        const libraryLink = `
            <a href="#" class="sidebar-nav-link ${libraryIsActive ? 'active' : ''}" data-link="library-section">
                <i class="fas fa-book"></i>
                <span data-lang-key="library">${getTranslation('library')}</span>
            </a>`;

        // Création du lien "À propos"
        const aboutIsActive = aboutItem && aboutItem.link === currentSectionId;
        const aboutLink = aboutItem ? `
            <a href="#" class="sidebar-nav-link ${aboutIsActive ? 'active' : ''}" data-link="${aboutItem.link}">
                <i class="fas ${iconMap[aboutItem.langKey] || 'fa-info-circle'}"></i>
                <span data-lang-key="${aboutItem.langKey}">${getTranslation(aboutItem.langKey)}</span>
            </a>` : '';

        // Assemble in correct order
        navContainer.innerHTML = profileLinks + libraryLink + aboutLink;
    }

    function setVolume(volume, fromUI = false) {
        currentVolume = Math.max(0, Math.min(100, volume));
        document.querySelectorAll('#volume-level-display').forEach(el => el.textContent = currentVolume);
        
        const volumeFraction = currentVolume / 100;
        if (largePlayer?.setVolume) largePlayer.setVolume(currentVolume);
        if (mediumPlayer?.setVolume) mediumPlayer.setVolume(currentVolume);
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
            // Animation de clic pour les icônes
            // CORRECTION: Ajout de TOUS les boutons du lecteur mobile (mini, plein écran, header) et de la barre de navigation à la liste des sélecteurs pour l'animation.
            const iconButton = e.target.closest('.top-bar-btn, .player-buttons > i, .controls-box, .player-right-controls > i, .mobile-player-controls > i, .mobile-player-play-box, .mobile-player-secondary-controls > i, .mobile-player-header-btn, .mini-player-controls > i, .mobile-nav-link, #mobile-player-autoplay-btn');
            if (iconButton) {
                // Si c'est le bouton play/pause mobile, on anime l'icône à l'intérieur
                const targetForAnimation = iconButton.id === 'mobile-player-play-pause-box' ? iconButton.querySelector('i') : iconButton;

                iconButton.classList.remove('icon-pop'); // Reset animation class
                void iconButton.offsetWidth; // Trigger reflow
                iconButton.classList.add('icon-pop');
            }
            
            const likeBtn = e.target.closest('.like-btn-card');
            if (likeBtn) {
                e.preventDefault();
                e.stopPropagation(); // Stop event propagation
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

            const link = e.target.closest('a.card-link-wrapper, .sidebar-nav-link, .dashboard-card-button, .carousel-item, .recent-video-item');
            if (!link) return; // If no link, return
            e.preventDefault();
            const { youtubeId, link: dataLink, albumId, unlockAlbum } = link.dataset || {};
            const cardElement = link.closest('.card'); // Peut être null pour les liens de la sidebar/dashboard
            const itemId = cardElement ? cardElement.dataset.itemId : link.dataset.itemId; // On prend l'ID du lien lui-même si la carte n'existe pas

            if (unlockAlbum) {
                if (userCoins >= COIN_COST_UNLOCK) {
                    const allUnlockableTracksInAlbum = Object.values(allSearchableItems).filter(t => t.albumId === unlockAlbum && t.isUnlockable);
                    const nextTrackToUnlock = allUnlockableTracksInAlbum.find(t => !unlockedTracks.includes(t.id));
                    
                    if (nextTrackToUnlock) {
                        userCoins -= COIN_COST_UNLOCK;
                        unlockedTracks.push(nextTrackToUnlock.id);
                        localStorage.setItem('mmg-userCoins', JSON.stringify(userCoins));
                        localStorage.setItem('mmg-unlockedTracks', JSON.stringify(unlockedTracks));
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
                const item = findItemById(itemId || link.dataset.itemId);
                if (!item) return;

                if (item.isUnlockable && !unlockedTracks.includes(item.id)) {
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
                        .filter(track => !track.isUnlockable || unlockedTracks.includes(track.id))
                        .map(title => title.id);

                    startIndex = playlistIds.findIndex(id => id === item.id);

                } else {
                    const parentContainer = cardElement.parentElement;
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
                } else if (item.type === 'gameplay' || item.type === 'makingof') {
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

        document.getElementById('search-input').addEventListener('input', updateVisibleCards);
        document.getElementById('tags-filter-list').addEventListener('change', updateVisibleCards);
        
        document.getElementById('theme-switch').addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            playAudio(e.target.checked ? sounds.switchToBlack : sounds.switchToWhite);
            localStorage.setItem('theme', e.target.checked ? 'dark' : 'light'); // Save theme preference
            applyTheme(localStorage.getItem('ui-theme') || 'default');
        });
        
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
        document.getElementById('mobile-player-queue-btn').addEventListener('click', (e) => { // Add click listener to queue button
            e.preventDefault();
            openOverlay(document.getElementById('queue-overlay'), sounds.select, true);
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

        document.getElementById('volume-up-btn').addEventListener('click', () => setVolume(currentVolume + 10, true));
        document.getElementById('volume-down-btn').addEventListener('click', () => setVolume(currentVolume - 10, true));

        document.getElementById('temp-play-btn').addEventListener('click', () => {
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

        const allOverlays = document.querySelectorAll('#settings-overlay, #shop-overlay, #wifi-overlay, #achievements-overlay, #tags-filter-overlay, #playlist-overlay, #player-options-overlay, #tutorial-overlay, #notifications-overlay, #reco-playlist-options-overlay, #queue-overlay');
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

            if (overlay.id === 'player-options-overlay') {
                const volumeControl = document.querySelector('.player-right-controls .volume-control-new');
                const overlayVolumeContainer = document.getElementById('overlay-volume-container');
                if(volumeControl && overlayVolumeContainer) { // Move volume control to overlay
                    overlayVolumeContainer.appendChild(volumeControl);
                }
            }

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

            if (wasPlayerOptionsOverlay) {
                const volumeControl = document.querySelector('#overlay-volume-container .volume-control-new');
                const playerRightControls = document.querySelector('.player-right-controls');
                if(volumeControl && playerRightControls) {
                    playerRightControls.insertBefore(volumeControl, document.getElementById('player-like-btn'));
                }
            }

            if (activeOverlay.id === 'shop-overlay' && sounds.shop) { // If shop overlay, stop shop sound
                sounds.shop.pause();
                sounds.shop.currentTime = 0;
            }
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
                } else if (document.getElementById('background-music-switch').checked && (!currentPlayingItem || (activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() !== 1))) {
                    document.getElementById('background-music').play();
                }
            }
            pausedForOverlay = false;
        }

        document.getElementById('settings-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('settings-overlay'), sounds.select, true); });
        document.getElementById('shop-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('shop-overlay'), sounds.shop); });
        document.getElementById('wifi-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('wifi-overlay'), null); });
        document.getElementById('achievements-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('achievements-overlay'), sounds.select); }); // Open achievements overlay
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
        // NOUVEAU: Liens pour les boutons mobiles
        const mobileShopBtn = document.getElementById('mobile-shop-btn');
        if (mobileShopBtn) mobileShopBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('shop-btn').click(); });
        const mobileAchievementsBtn = document.getElementById('mobile-achievements-btn');
        if (mobileAchievementsBtn) mobileAchievementsBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('achievements-btn').click(); });
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

        // CORRECTION: La logique du bouton est simplifiée. Il met à jour la préférence et demande un nouveau rendu.
        document.querySelectorAll('.view-toggle-btn').forEach(button => {
            button.addEventListener('click', (e) => { // Add click listener to view toggle button
                const targetContainerId = button.dataset.targetContainer;
                if (!targetContainerId) return;

                // 1. Déterminer la nouvelle vue souhaitée et la sauvegarder
                const currentView = localStorage.getItem('mmg-global-view') || 'grid';
                const newView = currentView === 'grid' ? 'list' : 'grid';
                localStorage.setItem('mmg-global-view', newView); // Sauvegarde la préférence

                // 3. Redessiner la vue actuelle avec la nouvelle préférence
                if (targetContainerId === 'library-container') {
                    const activeTab = document.querySelector('#library-tabs-container .playlist-tab-btn.active');
                    const activeTabId = activeTab ? activeTab.dataset.tabId : 'liked';
                    renderLibraryPage(activeTabId);
                } else if (targetContainerId === 'titles-cards') {
                    // CORRECTION: Pour la vue des titres d'un album, on réutilise les données déjà chargées en se basant sur le contexte.
                    const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                    if (currentViewContext.type === 'titles' && currentViewContext.data) {
                        const albumId = currentViewContext.data; // Récupère l'ID de l'album depuis le contexte
                        const titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
                        renderCards('titles-cards', titlesForAlbum, 'title');
                    }
                } else {
                    // Logique existante pour les autres sections (gameplay, making-ofs, etc.)
                    const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                    const dataKey = targetContainerId.replace('-cards', '');
                    const sectionData = siteData.contentData[activeProfile][dataKey];
                    let cardType = 'generic'; // Default
                    if (dataKey === 'albums') {
                        cardType = 'album';
                    } else if (dataKey === 'gameplay' || dataKey === 'makingofs') {
                        cardType = 'video';
                    }
                    renderCards(targetContainerId, sectionData, cardType);
                }
                // NOUVEAU: Réappliquer le surlignage après avoir changé de vue.
                highlightPlayingCard(currentPlayingItem); // Reapply highlight

                playAudio(sounds.select);
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
        document.querySelectorAll('.theme-buy-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                if (e.target.classList.contains('locked') || e.target.classList.contains('selected')) return;
                applyTheme(e.target.dataset.theme); // Apply theme
                playAudio(sounds.select);
            });
        });
        
        document.getElementById('cheat-code-btn').addEventListener('click', () => {
            const input = document.getElementById('cheat-code-input');
            const code = input.value.toLowerCase();
            if (code === 'gameshark') { // If cheat code is gameshark
                unlockAllAchievements();
                input.value = '';
                showDialog(getTranslation('allAchievementsUnlocked'));
                playAudio(sounds.achievementUnlocked);
            } else if (code === 'musicleaks') {
                const allUnlockableTracks = Object.values(allSearchableItems).filter(t => t.isUnlockable);
                unlockedTracks = allUnlockableTracks.map(t => t.id);
                localStorage.setItem('mmg-unlockedTracks', JSON.stringify(unlockedTracks));
                input.value = '';
                showDialog(getTranslation('allSongsUnlocked'));
                playAudio(sounds.achievementUnlocked);
                if(document.getElementById('albums-section').classList.contains('hidden') === false) { // If albums section is visible
                    handleMenuNavigation('albums-section');
                }
            }
            else {
                showDialog(getTranslation('incorrectCode'));
                playAudio(sounds.blocked);
            }
        });

        // CORRECTION: La logique de l'interrupteur de l'écran d'accueil a été déplacée dans welcome.js.
        // Cet écouteur ne gère plus que l'interrupteur des paramètres.
        const settingsBgMusicSwitch = document.getElementById('settings-bg-music-switch');
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
        document.getElementById('playlist-reco-list').addEventListener('click', e => {
            e.stopPropagation(); 

            const recoCard = e.target.closest('.reco-playlist-card');
            if (recoCard) {
                const playlistId = recoCard.dataset.playlistId;
                const playlistName = recoCard.dataset.playlistName;
    
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
                    const itemIds = items.map(item => item.id);
                    savedPlaylists[playlistName] = itemIds;
                    localStorage.setItem('mmg-savedPlaylists', JSON.stringify(savedPlaylists));
                    showDialog(getTranslation('playlistSaved'));
                }
    
                // Navigue vers la bibliothèque et affiche la playlist.
                playAudio(sounds.select);
                handleMenuNavigation('library-section', true, playlistName);
            }
        });

        document.querySelector('#reco-playlist-options-overlay .playlist-options-actions').addEventListener('click', e => {
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

            document.getElementById('guide-selection-overlay').style.display = 'none';
            
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
            if (highlightedElements.length > 0) {
                highlightedElements.forEach(el => {
                    el.classList.remove('tutorial-highlight'); // Remove highlight
                    if (el.classList.contains('card')) {
                        el.style.opacity = '';
                    }
                });
                highlightedElements = [];
            }
            
            isTutorialActive = false;
            document.body.classList.remove('tutorial-active-body');
            currentStepIndex = 0; // Reset step index
            
            closeOverlay(sounds.back);
            
            setTimeout(() => {
                document.getElementById('tutorial-box').classList.add('hidden');
                document.getElementById('guide-selection-overlay').style.display = '';
            }, 500);
            
            if (tutorialSavedPlayerState) {
                const { item, time, state, queue, queueIndex } = tutorialSavedPlayerState; // Destructure saved state
                
                currentPlayingItem = item;
                contextPlaybackQueue = queue; // C'était la file de contexte
                currentQueueIndex = queueIndex; // L'index dans la file de contexte
                
                activePlayer.cueVideoById({videoId: item.youtube_id, startSeconds: time});
                
                updateMp3PlayerInfo(item);
                renderPlaylist();
                
                setTimeout(() => {
                    if (state === YT.PlayerState.PLAYING) {
                        activePlayer.playVideo(); // Resume video playback
                    }
                    updateProgressBar(); 
                }, 500);

                tutorialSavedPlayerState = null;
            } else if (currentPlayingItem && currentTutorial === musicTitlesTutorialSteps) {
                 currentPlayingItem = null;
                 resetMiniPlayerUI(); // Reset mini player UI
                 activePlayer.stopVideo();
            }

            if (currentTutorial === musicTitlesTutorialSteps) {
                isAutoplayActive = originalAutoplayState;
                const buttons = document.querySelectorAll('#autoplay-toggle, #overlay-autoplay-toggle');
                buttons.forEach(btn => {
                    btn.classList.toggle('active', isAutoplayActive);
                    btn.title = isAutoplayActive ? "Autoplay activé" : "Autoplay désactivé";
                });
                resetToHome(); // Reset to home
            }
            
            updateTempPlayButtonVisibility();
            currentTutorial = null;
        }

        document.getElementById('guide-btn').addEventListener('click', () => {
             playAudio(sounds.select);
             // CORRECTION: Ensure guide dialog is hidden when opening menu
             document.getElementById('tutorial-box').classList.add('hidden');
             openOverlay(document.getElementById('tutorial-overlay'), null, true);
        });

        document.querySelectorAll('.guide-choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const guideKey = e.target.dataset.guide;
                
                if (guideKey === 'main') { // If main guide
                    resetToHome();
                } else if (guideKey === 'music') {
                    const musicProfileTab = document.querySelector('.profile-tab[data-project="mmg-music"]');
                    if (musicProfileTab && !musicProfileTab.classList.contains('active')) {
                        musicProfileTab.click();
                    }
                    const firstAlbumId = Object.keys(siteData.contentData['mmg-music'].albums)[0];
                    if (firstAlbumId) {
                        const activeProfile = 'mmg-music';
                        const profileContent = siteData.contentData[activeProfile];
                        const titlesForAlbum = Object.fromEntries(Object.entries(profileContent.titles).filter(([_, title]) => title.albumId === firstAlbumId));
                        document.getElementById('titles-section-title').textContent = siteData.contentData[activeProfile].albums[firstAlbumId].title; // Set titles section title
                        renderCards('titles-cards', titlesForAlbum, 'title');
                        showSection('titles-section');
                    }
                }
                startTutorial(guideKey);
            });
        });

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

        // NOUVEAU: Fonction pour positionner intelligemment la boîte du tutoriel
        function positionTutorialBox(box, targetElement, preferredPosition) {
            box.className = 'tutorial-box'; // Réinitialise les classes de position
    
            if (!targetElement) {
                box.classList.add('pos-center');
                return;
            }

            const targetRect = targetElement.getBoundingClientRect();
            const boxHeight = box.offsetHeight;
            const spaceAbove = targetRect.top;
            const spaceBelow = window.innerHeight - targetRect.bottom;

            // If a position is forced and there is enough space
            if (preferredPosition === 'pos-top' && spaceAbove > boxHeight + 20) {
                box.classList.add('pos-top');
                box.style.bottom = `${window.innerHeight - targetRect.top + 10}px`;
                box.style.top = 'auto';
            } else if (preferredPosition === 'pos-bottom' && spaceBelow > boxHeight + 20) {
                box.classList.add('pos-bottom');
                box.style.top = `${targetRect.bottom + 10}px`;
                box.style.bottom = 'auto'; // Set bottom to auto
            } else { // Sinon, on choisit automatiquement le meilleur emplacement
                box.classList.add(spaceBelow > spaceAbove ? 'pos-bottom' : 'pos-top');
            }
        }


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

        // MODIFICATION: Gestion du swipe pour changer de profil sur TOUTES les sections
        const mainContentArea = document.querySelector('.main-content');
        if (mainContentArea) {
            let touchStartX = 0;
            let touchStartY = 0;
            mainContentArea.addEventListener('touchstart', (e) => {
                if (document.querySelector('.settings-card:not(.hidden)') || document.getElementById('mobile-full-player').classList.contains('active')) return; // If settings card or mobile player is active, return
                if (e.target.closest('#library-tabs-container, #dashboard-carousel-container')) return;

                if (e.touches.length === 1) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            mainContentArea.addEventListener('touchend', (e) => {
                if (e.changedTouches.length === 1) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const swipeDistance = touchEndX - touchStartX;
                    const swipeVerticalDistance = Math.abs(touchEndY - touchStartY); // Calculate vertical swipe distance
                    const swipeThreshold = 75; // Seuil un peu plus grand pour éviter les conflits

                    if (swipeVerticalDistance > Math.abs(swipeDistance) || e.target.closest('#library-tabs-container, #dashboard-carousel-container')) {
                        return;
                    }

                    if (Math.abs(swipeDistance) > swipeThreshold) {
                        const currentActiveProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                        let targetProfile; // Target profile

                        if (swipeDistance < 0 && currentActiveProfile === 'mmg-music') targetProfile = 'mmg-beats';
                        else if (swipeDistance > 0 && currentActiveProfile === 'mmg-beats') targetProfile = 'mmg-music';

                        if (targetProfile) {
                            const targetTab = document.querySelector(`.profile-tab[data-project="${targetProfile}"]`);
                            if (targetTab) {
                                targetTab.click();
                                const visibleSection = document.querySelector('.page-section:not(.hidden)');
                                if (visibleSection) {
                                    visibleSection.classList.remove('fade-in-right', 'fade-in-left');
                                    void visibleSection.offsetWidth;
                                    visibleSection.classList.add(swipeDistance < 0 ? 'fade-in-right' : 'fade-in-left');
                                }
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
            });
        });

        // NOUVEAU: Logique pour le lecteur mobile
        const mobilePlayer = document.getElementById('mobile-full-player');

        // MODIFICATION: Logique de swipe pour le lecteur mobile (horizontal et vertical)
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        
        // MODIFICATION: Fonction générique pour ajouter le swipe à un élément
        function addSwipeListeners(element) {
            if (!element) return;
            element.addEventListener('touchstart', (e) => { // Add touchstart listener
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });
    
            element.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
                handleSwipe(element); // Handle swipe on touchend
            }, { passive: true });
        }

        // Applique le swipe au lecteur plein écran ET à la page de détails
        addSwipeListeners(document.getElementById('mobile-player-album-art'));
        addSwipeListeners(document.getElementById('details-album-art'));

        function handleSwipe(swipedElement) {
            const swipeThreshold = 50; // Distance minimale en pixels pour un swipe
            const swipeDownThreshold = 75; // Seuil plus grand pour le swipe vertical

            // NOUVEAU: Handle swipe down to close
            if (swipedElement === mobilePlayer && touchEndY > touchStartY + swipeDownThreshold) {
                mobilePlayer.classList.remove('active');
                return; // On ne traite pas le swipe horizontal si on a swipé vers le bas
            }

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

        // NOUVEAU: Appliquer le listener de swipe au conteneur principal du lecteur plein écran
        addSwipeListeners(mobilePlayer);

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

    // NOUVEAU: Logique pour le menu contextuel des cartes
    function openCardContextMenu(event, itemId) {
        const menu = document.getElementById('card-context-menu');
        menu.dataset.itemId = itemId; // Set item ID
        menu.classList.remove('hidden');

        // Positionnement du menu
        const clickX = event.clientX;
        const clickY = event.clientY;
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

        const sections = {
            'gameplay-section': { data: getSectionData('gameplay-section') || profileContent.gameplay, type: 'video', container: 'gameplay-cards' },
            'makingofs-section': { data: getSectionData('makingofs-section') || profileContent.makingofs, type: 'video', container: 'makingofs-cards' },
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
        } else if (sections[dataLink]) { // Handle other generic sections
            currentViewContext = { type: sections[dataLink].type, data: null };
            renderCards(sections[dataLink].container, sections[dataLink].data, sections[dataLink].type);
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
    
    function renderDashboard() { // Render dashboard sections
        renderDashboardCarousel();
        renderLikedSongsPreview();
        renderRecentVideos();
        renderRecommendedPlaylists();
        renderSocialsCard();
        renderUserActivity();
    }

    function renderDashboardCarousel() {
        const container = document.getElementById('dashboard-carousel-container');
        const dotsContainer = document.getElementById('dashboard-carousel-dots');
        if (!container || !dotsContainer) return;

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'; // Get active profile
        const allTitles = Object.values(siteData.contentData[activeProfile].titles);
        const latestItems = allTitles.sort((a, b) => new Date(b.year, 0, 1) - new Date(a.year, 0, 1)).slice(0, 3);

        container.innerHTML = latestItems.map(item => `
            <div class="carousel-item" data-item-id="${item.id}">
                <img src="${getCorrectImagePath(item)}" alt="${item.title}" loading="lazy">
                <div class="carousel-item-info">
                    <h3>${item.title}</h3>
                    <p>${getTranslation(`desc_${item.id}`) || item.description}</p>
                    <button class="dashboard-card-button" data-youtube-id="${item.youtube_id}" data-item-id="${item.id}">${getTranslation('listenNow')}</button>
                </div>
            </div>
        `).join('');

        dotsContainer.innerHTML = latestItems.map((_, index) => `<button data-slide-index="${index}" class="${index === 0 ? 'active' : ''}"></button>`).join(''); // Render carousel dots
        setupCarousel();
        setupTitleScrollObserver('dashboard-carousel-container'); // Active le défilement pour les titres du carrousel
    }

    function renderLikedSongsPreview() {
        const container = document.getElementById('liked-songs-preview');
        if (!container) return;
        const card = container.closest('.liked-preview-card');
        const button = card.querySelector('.dashboard-card-button');
        const noContentMessage = card.querySelector('.no-content-message');

        const likedArray = Array.from(likedSongs); // Convert likedSongs Set to Array
        const totalLikes = likedArray.length;

        card.classList.toggle('is-empty', totalLikes === 0);

        if (totalLikes === 0) {
            container.innerHTML = '';
            button.style.display = 'none';
            noContentMessage.textContent = getTranslation('noLikedTitles'); // Set no content message
            noContentMessage.style.display = 'block';
            return;
        }

        // Affiche jusqu'à 3 pochettes
        const itemsToDisplay = likedArray.slice(-3).reverse();
        let html = itemsToDisplay.map(id => {
            const item = findItemById(id);
            return item ? `<img src="${getCorrectImagePath(item)}" alt="${item.title}" title="${item.title}" data-item-id="${id}">` : '';
        }).join('');

        // If more than 4 titles are liked, display a "+X" indicator in the 4th slot
        if (totalLikes > 4) {
            html += `<div class="liked-preview-more"><span>+${totalLikes - 3}</span></div>`;
        }

        container.innerHTML = html;
        button.style.display = 'block';
        noContentMessage.style.display = 'none';
    }

    function renderRecentVideos() {
        const container = document.getElementById('recent-videos-list');
        if (!container) return;
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'; // Get active profile
        const recentVideos = Object.values(siteData.contentData[activeProfile].gameplay).slice(0, 4); // Affiche plus de clips

        if (recentVideos.length === 0) {
            container.innerHTML = `<p class="no-content-message">${getTranslation('noRecentVideos') || 'Aucun clip récent.'}</p>`;
            return;
        }
        container.innerHTML = recentVideos.map(video => `
            <div class="recent-video-item" data-item-id="${video.id}" data-youtube-id="${video.youtube_id}">
                <img src="${getCorrectImagePath(video)}" alt="${video.title}" loading="lazy">
                <div class="recent-video-item-info">
                    <p class="video-title scrolling" title="${video.title.replace(/"/g, '&quot;')}"><span>${video.title}</span></p>
                    <p class="video-year">${video.tags.join(', ')}</p>
                </div> // Video info
            </div>
        `).join('');

        setupTitleScrollObserver('recent-videos-list'); // Active le défilement pour les titres des vidéos récentes
    }

    function renderSocialsCard() {
        // La carte est principalement en HTML/CSS, cette fonction est un placeholder
        // if we want to make it more dynamic in the future.
        // On s'assure que le titre est bien retiré au cas où il serait ajouté par JS ailleurs.
        document.querySelector('.socials-hover-content .dashboard-card-title')?.remove();
    }

    function renderUserActivity() {
        const container = document.getElementById('user-activity-list');
        if (!container) return;
        const unlockedCount = Object.values(achievements).filter(a => a.unlocked).length;
        container.innerHTML = ` // Render user activity
            <div class="activity-item"><i class="fas fa-trophy"></i><p>${getTranslation('achievements')}: <span class="activity-value">${unlockedCount} / ${Object.keys(achievements).length}</span></p></div>
            <div class="activity-item"><i class="fas fa-heart"></i><p>${getTranslation('likedTitles')}: <span class="activity-value">${likedSongs.size}</span></p></div>
            <div class="activity-item"><i class="fas fa-list-ul"></i><p>${getTranslation('playlist')}: <span class="activity-value">${currentPlaylist.length} ${getTranslation('titles')}</span></p></div>
        `;
    }

    function renderRecommendedPlaylists() {
        const container = document.getElementById('playlist-reco-list');
        if (!container) return;

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music'; // Get active profile
        const allTitles = Object.values(siteData.contentData[activeProfile].titles);

        // Création de la playlist "Chill"
        const playlists = [
            {
                id: 'chill',
                name: 'Chill Vibes',
                icon: 'fa-music', // Icône simple et efficace
                items: allTitles.filter(title => title.tags?.includes('chill'))
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

        container.innerHTML = playlists.filter(p => p.items.length > 0).map(playlist => `
            <div class="reco-playlist-card" data-playlist-id="${playlist.id}" data-playlist-name="${playlist.name}">
                <div class="reco-playlist-card-inner reco-playlist-${playlist.id}">
                    <i class="fas ${playlist.icon}"></i>
                    <div class="reco-playlist-info">
                        <h4>${playlist.name}</h4>
                        <p>${playlist.items.length} titres</p>
                    </div> // Playlist info
                </div>
            </div>
        `).join('');
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
