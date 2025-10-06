
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
    let activePlaybackQueue = [];
    let currentQueueIndex = -1;
    let isHovering = false;
    let isAutoplayActive = true;
    let currentVolume = 100;
    let sfxEnabled = true;
    let currentLang = 'en'; // MODIFICATION: Langue par défaut
    let currentNavigationContext = { playlist: [], index: -1 };
    let currentViewContext = { type: 'menu', data: null }; // Pour re-render lors du changement de langue
    
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

    function playVideoWhenReady(item, playlistIds = [], index = -1, fromPlaylistOverlay = false, forceTempPlay = false, fromAutoplay = false) {
        if (!item) return;
        
        // Si l'autoplay est OFF, on n'affiche que la page de détails pour les titres musicaux, mais on laisse les vidéos se lancer.
        if (!isAutoplayActive && !fromPlaylistOverlay && !forceTempPlay && isMusicTitle(item)) {
            renderMusicTitleDetails(item);
            showSection('music-title-details-section');
            return;
        }
        
        if (forceTempPlay) {
            if (currentNavigationContext && currentNavigationContext.playlist.length > 0) {
                activePlaybackQueue = currentNavigationContext.playlist;
                currentQueueIndex = activePlaybackQueue.findIndex(id => id === item.id);
                if (currentQueueIndex === -1) { 
                    activePlaybackQueue = [item.id];
                    currentQueueIndex = 0;
                }
            } else {
                activePlaybackQueue = [item.id];
                currentQueueIndex = 0;
            }
        } else if (fromPlaylistOverlay) {
            activePlaybackQueue = [...currentPlaylist];
            currentQueueIndex = currentPlaylist.findIndex(id => id === item.id);
        } else if (playlistIds && playlistIds.length > 0) {
            activePlaybackQueue = playlistIds;
            currentQueueIndex = index;
        } else {
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
            const albumId = item.albumId;
            if (albumId) {
                activePlaybackQueue = Object.values(siteData.contentData[activeProfile].titles)
                    .filter(title => title.albumId === albumId)
                    .map(title => title.id);
                currentQueueIndex = activePlaybackQueue.findIndex(id => id === item.id);
            } else {
                activePlaybackQueue = [item.id];
                currentQueueIndex = 0;
            }
        }

        currentPlayingItem = item;
        seekDetectedInCurrentPlay = false;
        previousListenProgress = 0;

        if (playerInitializationComplete) {
            loadAndPlayVideo(item, fromAutoplay); // CORRECTION: On passe le drapeau 'fromAutoplay' ici.
        } else {
            showDialog("Chargement du lecteur vidéo...");
        }
    }

    function loadAndPlayVideo(item, fromAutoplay = false) {
        document.getElementById('play-pause-box').classList.add('loading');
        currentPlayingItem = item;
        const musicTitle = isMusicTitle(item);
    
        activePlayer = musicTitle ? mediumPlayer : largePlayer;
        const inactivePlayer = musicTitle ? largePlayer : mediumPlayer;
        if (inactivePlayer && typeof inactivePlayer.stopVideo === 'function') inactivePlayer.stopVideo();
        
        // CORRECTION: On affiche la bonne section (lecteur ou détails) uniquement si ce n'est PAS l'autoplay.
        if (!fromAutoplay) {
            // CORRECTION: Si c'est un titre musical, on doit d'abord Remplir la page de détails avant de l'afficher.
            if (musicTitle) {
                renderMusicTitleDetails(item);
            }
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
        navigator.mediaSession.setActionHandler('pause', () => { if(activePlayer) activePlayer.pauseVideo() });
        
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
        // NOUVEAU: Restaure les titres de section originaux
        restoreOriginalSectionTitles();
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
        if (document.getElementById('library-section').classList.contains('hidden') === false) {
            renderLibraryPage('liked');
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
        miniPlayerLikeBtn.classList.toggle('far', !isLiked);

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
        updateCardPlaylistButtonState(itemId);
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
        // CORRECTION: S'assurer que les éléments existent avant de continuer
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
            playlistItem.draggable = isCustomPlaylist; // Draggable seulement si c'est la playlist custom

            const dragHandle = isCustomPlaylist ? '<i class="fas fa-bars playlist-drag-handle"></i>' : '<span class="playlist-drag-handle-placeholder"></span>';
            const deleteButton = isCustomPlaylist ? `<button class="playlist-item-delete" title="${getTranslation("deleteFromPlaylist")}"><i class="fas fa-trash-alt"></i></button>` : '';

            playlistItem.innerHTML = `
                ${dragHandle}
                <img src="${getCorrectImagePath(item)}" alt="${item.title}">
                <div class="playlist-item-info">
                    <p class="playlist-item-title">${item.title}</p>
                    <p>${item.year || 'Vidéo'}</p>
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
            const profileContent = siteData.contentData[activeProfile];
            switch (currentViewContext.type) {
                case 'titles':
                    const titlesForAlbum = Object.fromEntries(Object.entries(profileContent.titles).filter(([_, title]) => title.albumId === currentViewContext.data));
                    renderCards('titles-cards', titlesForAlbum, 'title');
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
                    <div class="whitespace-nowrap hidden sm:block">${getTranslation('titleAndArtist').split(' & ')[1] || 'Artiste'}</div>
                    <div class="tags-column hidden sm:block whitespace-nowrap" data-lang-key="tags">${getTranslation('tags')}</div>
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
                // CORRECTION: Si on est en grille (par défaut), on montre l'icône pour passer en LISTE
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
            const isActionable = (cardType === 'title' || cardType === 'video' || (cardType === 'search' && item.type !== 'album'));
            const isLiked = likedSongs.has(itemId);
            const isInPlaylist = currentPlaylist.includes(itemId);
            const tagsSubtitle = (item.tags && item.tags.length > 0) ? `<p class="card__description">${item.tags.join(', ')}</p>` : '';
            const lockIconHtml = isLocked && cardType !== 'title' && !isAlbumLocked ? ' <i class="fas fa-lock" style="font-size: 0.8em; opacity: 0.7;"></i>' : '';
            const cardTextHtml = `<p class="card__title" title="${translatedTitle.replace(/"/g, '&quot;')}"><span>${translatedTitle}${lockIconHtml}</span></p>${tagsSubtitle}`;
            const actionsHtml = isActionable ? `
                <div class="card-actions">
                    <i class="like-btn-card ${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'active' : ''}" data-like-id="${itemId}" title="${getTranslation('like')}"></i>
                    <i class="fas ${isInPlaylist ? 'fa-check' : 'fa-plus'} add-playlist-btn-card ${isInPlaylist ? 'added' : ''}" data-playlist-id="${itemId}" title="${isInPlaylist ? getTranslation('removePlaylist') : getTranslation('addPlaylist')}"></i>
                </div>` : '';

            let datasetAttributes = '';
            if (cardType === 'title' || cardType === 'video' || cardType === 'search') {
                datasetAttributes = `data-youtube-id="${item.youtube_id}"`;
            } else if (cardType === 'album') {
                datasetAttributes = `data-album-id="${item.id}"`;
            } else if (cardType === 'menu') {
                datasetAttributes = `data-link="${item.link}"`;
            }

            if (isListView && (cardType === 'title' || cardType === 'video' || cardType === 'search')) {
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
                    <div class="text-sub-text-color text-sm">${index + 1}</div>
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
                    <div class="text-sub-text-color text-xs truncate hidden sm:flex items-center tag-link list-view-artist-col" data-action="filter-tag" data-tag="${artistName}"><span>${artistName}</span></div>
                    <div class="tags-column text-sub-text-color text-xs hidden sm:flex items-center min-w-0 tag-link list-view-tags-col"><span>${tagsHtml}</span></div>
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
                        playVideoWhenReady(item);
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
                        cardImageHtml = `<div class="card__image card-icon-bg"><i class="fas ${iconInfo.icon}"></i></div>`;
                    } else {
                        card.classList.add('card-menu-about');
                        cardImageHtml = `<img class="card__image" loading="lazy" decoding="async" src="${getCorrectImagePath(item)}" alt="${translatedTitle}">`;
                    }
                } else {
                    cardImageHtml = `<img class="card__image" loading="lazy" decoding="async" src="${imagePath}" alt="${translatedTitle.replace(/"/g, '&quot;')}">`;
                    
                    let description = '';
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
                        case 'search': 
                            description = item.type === 'album' ? getTranslation('viewAlbum') : (item.year ? getTranslation('musicTitle') : getTranslation('videoOrMakingOf')); 
                        default: description = getTranslation('viewContent');
                    }
                    // CORRECTION: Ajoute le texte "à débloquer" sous le titre de l'album en mode grille.
                    gridCardTextHtml = `
                        <p class="card__title" title="${translatedTitle.replace(/"/g, '&quot;')}">
                            <span>${translatedTitle}${lockIconHtml}</span>
                        </p>
                        <p class="card__description">${description}</p>
                    `;                
                }

                let lockOverlayHtml = '';
                if (isTrackLocked) {
                    lockOverlayHtml = `
                    <div class="lock-overlay">
                        <i class="fas fa-lock"></i>
                        <span class="unlock-cost">${COIN_COST_UNLOCK} <i class="fas fa-coin"></i></span>
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
                        ${actionsHtml}
                    </div>`;
            }
            container.appendChild(card);
            fragment.appendChild(card); // On les ajoute au fragment
        });

        container.appendChild(fragment); // On ajoute toutes les cartes en une seule fois.

        // CORRECTION: La vue en liste est maintenant gérée par le même observateur.
        const scrollableCardTypes = ['title', 'video', 'search', 'album', 'list'];
        if (scrollableCardTypes.includes(cardType)) {
            setupTitleScrollObserver(`#${containerId}`);
        }
        // CORRECTION: Si on est en mode liste, on observe aussi les colonnes.
        if (isListView) {
            setupTitleScrollObserver(`#${containerId} .list-view-title, #${containerId} .list-view-artist-col, #${containerId} .list-view-tags-col`);
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
            if (miniPlayerTitle) {
                miniPlayerTitle.querySelector('span').textContent = item.title;
                miniPlayerTitle.parentElement.classList.remove('no-track'); // CORRECTION: Retire la classe de centrage
                checkTitleOverflow(miniPlayerTitle); // CORRECTION: Applique la logique de défilement
            }
            // On s'assure que la pochette est de nouveau visible et opaque
            const miniAlbumArt = document.getElementById('mini-player-album-art');
            if(miniAlbumArt) miniAlbumArt.style.opacity = '1';
            
            // NOUVEAU: S'assurer que les contrôles et l'image sont visibles
            const miniPlayerControls = document.getElementById('mini-player-controls');
            if (miniPlayerControls) miniPlayerControls.style.display = 'flex';
            const miniPlayerAlbumArt = document.getElementById('mini-player-album-art');
            if (miniPlayerAlbumArt) miniPlayerAlbumArt.style.display = 'block';

            updateLikeButtonUI(item.id);
        }
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
                miniPlayerTitle.parentElement.classList.add('no-track'); // CORRECTION: Ajoute la classe pour centrer
                miniPlayerTitle.classList.remove('scrolling'); // Arrête le défilement
            }
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
        // On s'assure que les boutons sont dans leur état par défaut
        document.getElementById('mobile-player-play-pause-btn').className = 'fas fa-play';
        // NOUVEAU: Retire le surlignage de la carte
        unhighlightPlayingCard();
    }

    function updateProgressBar() {
        if (!activePlayer || typeof activePlayer.getDuration !== 'function' || !currentPlayingItem) return;
        
        const duration = activePlayer.getDuration();
        if (duration > 0) {
            const currentTime = activePlayer.getCurrentTime();
            listenProgress = currentTime / duration;

            // MISE À JOUR: Affichage des temps
            document.getElementById('progress-fill').style.width = `${listenProgress * 100}%`;
            document.getElementById('current-time-display').textContent = formatTime(currentTime);
            document.getElementById('duration-display').textContent = formatTime(duration);

            if (previousListenProgress > 0) {
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
            previousListenProgress = listenProgress;
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
            return;
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
        }, animationDuration);
    } 

    function showSection(sectionId, updateHistory = true) {
        const sectionsContainer = document.querySelector('.content-section-board');
        const currentSection = sectionsContainer.querySelector('.page-section:not(.hidden)');
        const nextSection = document.getElementById(sectionId);
    
        if (!nextSection || (currentSection && currentSection.id === sectionId)) {
            return;
        }
    
        const animationDuration = 300; // Durée de l'animation de sortie en ms
    
        // Fonction pour effectuer le changement de section
        const switchSections = () => {
            document.querySelectorAll('.content-section-board .page-section').forEach(s => {
                s.classList.add('hidden');
                s.classList.remove('is-hiding');
            });
            nextSection.classList.remove('hidden');
    
            if (updateHistory && (!history.state || history.state.section !== sectionId)) {
                history.pushState({ section: sectionId, fromApp: true }, '', '#' + sectionId);
            }
            // NOUVEAU: Applique le surlignage APRÈS que la nouvelle section est visible.
            highlightPlayingCard(currentPlayingItem);

            // CORRECTION: Mettre à jour la sidebar APRÈS que la section a changé
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
            if (activeProfile) {
                renderSidebarNav(activeProfile);
            }
        };
    
        // NOUVEAU: Retire le surlignage de la carte avant de naviguer
        unhighlightPlayingCard();
        if (currentSection) {
            currentSection.classList.add('is-hiding');
            setTimeout(switchSections, animationDuration);
        } else {
            switchSections(); // Pas de section actuelle, on affiche directement la nouvelle
        }
        updateTempPlayButtonVisibility();
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

        if (query === '' && checkedTags.length === 0) {
            if (document.getElementById('tags-filter-overlay').classList.contains('hidden') && document.getElementById('search-results-section').classList.contains('hidden') === false) {
                 resetToHome(); 
            }
            return;
        }

        const filteredResults = Object.fromEntries(Object.entries(allSearchableItems).filter(([key, item]) => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const tagTextMatch = (item.tags || []).some(tag => tag.toLowerCase().includes(query));
            let albumTitleMatch = false;
            if(item.albumId && siteData.contentData['mmg-music'].albums[item.albumId]) {
                 albumTitleMatch = siteData.contentData['mmg-music'].albums[item.albumId].title.toLowerCase().includes(query);
            }

            const itemTags = (item.tags || []).map(t => t.toLowerCase());
            const tagsMatch = checkedTags.length === 0 || checkedTags.every(tag => itemTags.includes(tag));
            
            return (titleMatch || tagTextMatch || albumTitleMatch) && tagsMatch;
        }));
        
        const isPlaying = currentPlayingItem && activePlayer && typeof activePlayer.getPlayerState === 'function' && 
                          (activePlayer.getPlayerState() === YT.PlayerState.PLAYING || activePlayer.getPlayerState() === YT.PlayerState.PAUSED);

        const titleToSet = (typeof customTitle === 'string' && customTitle) ? customTitle : getTranslation('searchResults');
        document.getElementById('search-results-title').textContent = titleToSet;
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
            const bgClasses = ['theme-bg-waves', 'theme-bg-gentle-waves', 'theme-bg-gray'];
            document.body.classList.remove(...bgClasses);
            
            if (themeName === 'theme-bg-waves' || themeName === 'theme-bg-gentle-waves' || themeName === 'theme-bg-gray') {
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
    }

    function resetToHome(playSelectSound = true) {
        if (playSelectSound) playAudio(sounds.select);
        handleMenuNavigation('home-dashboard-section');
    }
    
    function renderSidebarNav(activeProfile) {
        const navContainer = document.getElementById('sidebar-main-nav');
        if (!navContainer) return;

        const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id || 'home-dashboard-section';

        const iconMap = {
            'albums': 'fa-compact-disc', 'videoClips': 'fa-video', 'makingOfs': 'fa-lightbulb', // icône pour making-of
            'about': 'fa-info-circle', 'albumsBeats': 'fa-compact-disc',
            'videosBeats': 'fa-video' // CORRECTION: Utilisation de la même icône que pour les clips vidéos
        };

        // Séparer les liens du profil et le lien "À propos"
        const profileData = Object.values(siteData.projectData[activeProfile]);
        const aboutItem = profileData.find(item => item.langKey === 'about');
        const otherProfileItems = profileData.filter(item => item.langKey !== 'about');

        const profileLinks = otherProfileItems.map(item => {
            const isActive = item.link === currentSectionId;
            return `
                <a href="#" class="sidebar-nav-link ${isActive ? 'active' : ''}" data-link="${item.link}">
                    <i class="fas ${iconMap[item.langKey] || 'fa-question-circle'}"></i>
                    <span data-lang-key="${item.langKey}">${getTranslation(item.langKey)}</span>
                </a>`;
        }).join('');

        // CORRECTION: Création du lien "Bibliothèque" qui remplace "Titres Likés"
        const libraryIsActive = currentSectionId === 'library-section';
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

        // Assemblage dans le bon ordre
        navContainer.innerHTML = profileLinks + libraryLink + aboutLink;
    }

    function setVolume(volume, fromUI = false) {
        currentVolume = Math.max(0, Math.min(100, volume));
        document.querySelectorAll('#volume-level-display').forEach(el => el.textContent = currentVolume);
        
        const volumeFraction = currentVolume / 100;
        if (largePlayer?.setVolume) largePlayer.setVolume(currentVolume);
        if (mediumPlayer?.setVolume) mediumPlayer.setVolume(currentVolume);
        Object.values(sounds).forEach(sound => { if (sound) sound.volume = volumeFraction; });

        if(fromUI) playAudio(sounds.hover);
    }

    function checkTitleOverflow(title) {
        const titleSpan = title.querySelector('span');
        if (!titleSpan) return;
    
        title.classList.remove('scrolling');
        title.style.setProperty('--overflow-width', '0px');
        title.style.setProperty('--scroll-duration', '0s');
    
        // CORRECTION: On compare la largeur du span à celle de son conteneur direct (.mini-player-info ou .card__text)
        const container = title.parentElement;

        requestAnimationFrame(() => {
            const isOverflown = titleSpan.scrollWidth > container.clientWidth + 1;
            if (isOverflown) {
                const overflowAmount = titleSpan.scrollWidth - container.clientWidth;
                const duration = Math.max(3, (overflowAmount / 40) + 1); 
                title.style.setProperty('--overflow-width', `-${overflowAmount + 10}px`);
                title.style.setProperty('--scroll-duration', `${duration}s`);
                title.classList.add('scrolling');
            }
        });
    }

    function setupTitleScrollObserver(containerSelector) {
        const options = {
            root: document.querySelector('.content-section-board'),
            rootMargin: '0px',
            threshold: 0.8 
        };
    
        if (titleScrollObserver) titleScrollObserver.disconnect();
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
                checkTitleOverflow(entry.target);
            }
        });
    
        const titlesToObserve = document.querySelectorAll(`${containerSelector} .card__title`);
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
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
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
        
        // --- HISTORY TRAP SETUP ---
        // 1. Replace the current history entry with a "trap" entry. This is the page we will prevent the user from reaching.
        // CORRECTION: Toujours rediriger vers le tableau de bord au rechargement.
        history.replaceState({ section: 'home-dashboard-section', fromApp: true, isTrap: true }, '', '#home-dashboard-section');

        // 2. Push the actual main menu state on top of the trap. This is the page the user will see and be returned to.
        history.pushState({ section: 'home-dashboard-section', fromApp: true }, '', '#home-dashboard-section');

        sectionToLoad = 'home-dashboard-section';

        // Appel final et unique pour la mise à jour des notifications
        updateNotificationDot();

        handleMenuNavigation(sectionToLoad, false); // This will show the correct section without adding to history.

        // PWA Service Worker Registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Listener for messages from the Service Worker
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
    const playNextTrack = (direction = 1, forcePlay = false) => {
        if (!forcePlay && !isAutoplayActive) playAudio(sounds.select); // Ne joue pas de son si c'est l'autoplay
        let nextItem;
    
        let currentQueue;
        let currentIndex;
    
        const detailsSection = document.getElementById('music-title-details-section');
        const currentItemIdOnPage = detailsSection.dataset.currentItemId;

        if (activePlaybackQueue.length > 0) {
            currentQueue = activePlaybackQueue;
            currentIndex = currentQueue.findIndex(id => id === currentItemIdOnPage);
            if (currentIndex === -1) currentIndex = currentQueueIndex;
        } else if (currentNavigationContext && currentNavigationContext.playlist.length > 0) {
            currentQueue = currentNavigationContext.playlist;
            currentIndex = currentQueue.findIndex(id => id === currentItemIdOnPage);
        } else {
            renderVideoSuggestions();
            showSection('video-suggestions-section', true, true);
            return;
        }
    
        if (currentIndex === -1 || currentQueue.length === 0) return;
    
        let nextIndex;
        if (isShuffleMode && (forcePlay || isAutoplayActive)) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * currentQueue.length);
            } while (currentQueue.length > 1 && randomIndex === currentIndex);
            nextIndex = randomIndex;
        } else {
            nextIndex = (currentIndex + direction + currentQueue.length) % currentQueue.length;
        }
        
        const nextItemId = currentQueue[nextIndex];
        nextItem = findItemById(nextItemId);
        
        if (nextItem) {
            if (isAutoplayActive || forcePlay) {
                 playVideoWhenReady(nextItem, currentQueue, nextIndex, false, false, true);
            } else {
                 renderMusicTitleDetails(nextItem);
                 showSection('music-title-details-section');
            }
        }
    };
    
    function setupEventListeners() {
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                playAudio(sounds.back);
                if (isTutorialActive || document.getElementById('home-dashboard-section').classList.contains('hidden') === false) return;
            
                const menuSection = document.getElementById('menu-cards-section');
                // NOUVEAU: Gère la fermeture de l'overlay de la pochette avec le bouton retour
                if (!document.getElementById('artwork-overlay').classList.contains('hidden')) {
                    document.getElementById('artwork-overlay').classList.add('hidden');
                    // L'événement popstate qui suit va nettoyer l'historique
                    return;
                }

                if (menuSection && !menuSection.classList.contains('hidden')) {
                    // If on the main menu, do nothing, let the browser handle it (which will trigger our trap)
                    return;
                }
            
                window.history.back();
            });
        }

        // NOUVEAU: Gestionnaire pour le switch de profil mobile
        const mobileProfileSwitch = document.getElementById('mobile-profile-switch');
        if (mobileProfileSwitch) {
            mobileProfileSwitch.addEventListener('click', (e) => {
                const button = e.target.closest('.profile-switch-btn');
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
                e.preventDefault();
                resetToHome();
            });
        }

        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.isTrap) {
                history.forward();
                return;
            }
            // NOUVEAU: Gère la fermeture de l'overlay de la pochette via le bouton retour du navigateur/téléphone
            if (event.state && event.state.overlay === 'artwork') {
                document.getElementById('artwork-overlay').classList.add('hidden');
                return;
            }

            // CORRECTION: Le fallback est le menu
            const sectionId = event.state ? event.state.section : 'home-dashboard-section';
            handleMenuNavigation(sectionId, false);
        });


        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const previousProfile = document.querySelector('.profile-tab.active')?.dataset.project;

                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const activeProfile = tab.dataset.project;

                if (!previousProfile || previousProfile === activeProfile) {
                    return; // Pas de changement ou erreur, on ne fait rien.
                }

                // Logique de navigation intelligente
                const currentSectionId = document.querySelector('.page-section:not(.hidden)')?.id || 'home-dashboard-section';
                let sectionToLoad = 'home-dashboard-section';
                const commonSections = ['liked-titles-section']; // Sections qui existent pour les deux profils mais ne sont pas dans projectData

                if (commonSections.includes(currentSectionId)) {
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
                renderSidebarNav(activeProfile); // Met à jour la sidebar immédiatement
                handleMenuNavigation(sectionToLoad); // Navigue vers la section équivalente ou l'accueil
            });
        });
        
        // CORRECTION: L'écouteur est sur .main-board pour couvrir le header et le footer
        const mainWrapper = document.getElementById('main-content-wrapper');
        
        mainWrapper.addEventListener('click', (e) => {
            // Animation de clic pour les icônes
            // CORRECTION: Ajout de TOUS les boutons du lecteur mobile (mini, plein écran, header) et de la barre de navigation à la liste des sélecteurs pour l'animation.
            const iconButton = e.target.closest('.top-bar-btn, .player-buttons > i, .controls-box, .player-right-controls > i, .mobile-player-controls > i, .mobile-player-play-box, .mobile-player-secondary-controls > i, .mobile-player-header-btn, .mini-player-controls > i, .mobile-nav-link, #mobile-player-autoplay-btn');
            if (iconButton) {
                // Si c'est le bouton play/pause mobile, on anime l'icône à l'intérieur
                const targetForAnimation = iconButton.id === 'mobile-player-play-pause-box' ? iconButton.querySelector('i') : iconButton;

                iconButton.classList.remove('icon-pop'); // Reset animation
                void iconButton.offsetWidth; // Trigger reflow
                iconButton.classList.add('icon-pop');
            }
            
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
                e.stopPropagation();
                togglePlaylistItem(playlistBtn.dataset.playlistId);
                return;
            }
            
            const detailsPlaylistBtn = e.target.closest('#details-add-to-playlist-btn');
            if (detailsPlaylistBtn) {
                e.preventDefault();
                e.stopPropagation();
                const currentItemId = document.getElementById('music-title-details-section').dataset.currentItemId;
                if(currentItemId) {
                    togglePlaylistItem(currentItemId);
                }
                return;
            }

            const filterTagAction = e.target.closest('[data-action="filter-tag"]');
            if(filterTagAction) {
                e.preventDefault();
                e.stopPropagation();
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
                e.stopPropagation();
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
                e.preventDefault(); // CORRECTION: Déplacé ici pour être plus spécifique
                const itemId = associatedVideo.dataset.itemId;
                const item = findItemById(itemId);
                if (item) {
                    playAudio(sounds.select);
                    playVideoWhenReady(item);

            // NOUVEAU: Afficher le bouton du lecteur mobile
            const playerToggleBtn = document.getElementById('mobile-player-toggle-btn');
            if (playerToggleBtn) playerToggleBtn.style.display = 'flex';

                }
                return;
            }

            const link = e.target.closest('a.card-link-wrapper, .sidebar-nav-link, .dashboard-card-button, .carousel-item, .recent-video-item');
            if (!link) return;
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
                            .filter(Boolean);
                        startIndex = playlistIds.findIndex(pId => pId === item.id);
                    }
                }
                
                currentNavigationContext = { playlist: playlistIds, index: startIndex };

                playAudio(sounds.select);
                // CORRECTION: La logique est maintenant centralisée.
                // On appelle toujours playVideoWhenReady, qui se chargera de lancer la lecture
                // et d'afficher la bonne page (détails pour la musique, lecteur pour la vidéo).
                playVideoWhenReady(item, playlistIds, startIndex);

                /* ANCIENNE LOGIQUE SUPPRIMÉE
                if (isMusicTitle(item)) {
                    renderMusicTitleDetails(item);
                    scaleToShowSection('music-title-details-section'); // Utilise la nouvelle animation
                    if (isAutoplayActive) {
                        playVideoWhenReady(item, playlistIds, startIndex);
                    }
                } else {
                    // Pour les vidéos, on joue directement.
                    playVideoWhenReady(item, playlistIds, startIndex);
                }
                */

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
                currentViewContext = { type: 'titles', data: albumId };
                renderCards('titles-cards', titlesForAlbum, 'title');
                showSection('titles-section');
            }
        });

        mainWrapper.addEventListener('mousedown', (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const titleSpan = card.querySelector('.card__title.scrolling > span');
                if (titleSpan) {
                    titleSpan.style.animationPlayState = 'paused';
                }
            }
        });
        mainWrapper.addEventListener('touchstart', (e) => {
             const card = e.target.closest('.card');
            if (card) {
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
                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                const titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
                document.getElementById('titles-section-title').textContent = siteData.contentData[activeProfile].albums[albumId].title;
                currentViewContext = { type: 'titles', data: albumId };
                renderCards('titles-cards', titlesForAlbum, 'title');
                showSection('titles-section');
            }
        });

        // NOUVEAU: Agrandir la pochette depuis le lecteur mobile
        document.getElementById('mobile-player-album-art').addEventListener('click', (e) => {
            if (document.getElementById('mobile-full-player').classList.contains('active')) {
                document.getElementById('artwork-overlay-img').src = e.target.src;
                artworkOverlay.classList.remove('hidden');
                // Ajoute un état à l'historique pour capturer le bouton retour
                history.pushState({ overlay: 'artwork' }, '');
            }
        });

        const artworkOverlay = document.getElementById('artwork-overlay');
        document.getElementById('details-album-art').addEventListener('click', (e) => {
            document.getElementById('artwork-overlay-img').src = e.target.src;
            artworkOverlay.classList.remove('hidden');
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
                const sectionToShow = isMusicTitle(currentPlayingItem) ? 'music-title-details-section' : 'large-player-section';
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
            localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
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
            localStorage.setItem('mmg-backgroundPlayEnabled', JSON.stringify(isBackgroundPlayEnabled));
            
        });


        document.getElementById('play-pause-box').addEventListener('click', () => {
            if (!activePlayer || !currentPlayingItem) {
                if (currentPlaylist.length > 0) {
                    const firstItem = findItemById(currentPlaylist[0]);
                    if (firstItem) {
                        playVideoWhenReady(firstItem, currentPlaylist, 0, true);
                    }
                }
                return;
            }
            playAudio(sounds.select);
            const state = activePlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) activePlayer.pauseVideo();
            else activePlayer.playVideo();
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
            currentPlayingItem = null;
            resetMiniPlayerUI();
        });

        // NOUVEAU: Contrôles du lecteur mobile
        document.getElementById('mobile-player-play-pause-box').addEventListener('click', () => {
            playAudio(sounds.select);
            const state = activePlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) activePlayer.pauseVideo(); else activePlayer.playVideo();
        });

        document.getElementById('next-video-btn').addEventListener('click', () => playNextTrack(1, isAutoplayActive));
        document.getElementById('prev-video-btn').addEventListener('click', () => playNextTrack(-1, isAutoplayActive));
        
        // CORRECTION: Logique centralisée pour le bouton Loop
        document.getElementById('loop-btn').addEventListener('click', (e) => {
            isPlayerLooping = !isPlayerLooping;
            playAudio(sounds.select);
            if (isPlayerLooping) {
                isShuffleMode = false;
            }
            updateLoopShuffleUI();
        });

        // CORRECTION: Logique centralisée pour le bouton Shuffle
        document.getElementById('shuffle-btn').addEventListener('click', (e) => {
            isShuffleMode = !isShuffleMode;
            playAudio(sounds.select);
            if (isShuffleMode) {
                isPlayerLooping = false;
            }
            updateLoopShuffleUI();
        });

        // NOUVEAU: Écouteurs pour les boutons du lecteur mobile
        document.getElementById('mobile-player-next-btn').addEventListener('click', () => playNextTrack(1, true));
        document.getElementById('mobile-player-prev-btn').addEventListener('click', () => playNextTrack(-1, true));
        // CORRECTION: Les boutons mobiles appellent maintenant directement la logique centralisée
        document.getElementById('mobile-player-loop-btn').addEventListener('click', () => {
            isPlayerLooping = !isPlayerLooping;
            if (isPlayerLooping) isShuffleMode = false;
            playAudio(sounds.select);
            updateLoopShuffleUI();
        });
        document.getElementById('mobile-player-shuffle-btn').addEventListener('click', () => {
            isShuffleMode = !isShuffleMode;
            if (isShuffleMode) isPlayerLooping = false;
            playAudio(sounds.select);
            updateLoopShuffleUI();
        });
        document.getElementById('mobile-player-like-btn').addEventListener('click', () => document.getElementById('player-like-btn').click());
        // CORRECTION: Le bouton playlist du grand lecteur mobile ouvre maintenant directement l'overlay.
        document.getElementById('mobile-player-playlist-btn').addEventListener('click', (e) => {
            e.preventDefault();
            openOverlay(document.getElementById('playlist-overlay'), sounds.select, true);
        });
        // CORRECTION: Le bouton 'options' a été retiré, on attache l'événement au bouton 'share'
        document.getElementById('mobile-player-share-btn').addEventListener('click', () => document.getElementById('share-btn').click());
        
        const toggleAutoplay = (e) => {
            isAutoplayActive = !isAutoplayActive;
            const buttons = document.querySelectorAll('#autoplay-toggle, #overlay-autoplay-toggle, #mobile-player-autoplay-btn');
            buttons.forEach(btn => {
                btn.classList.toggle('active', isAutoplayActive);
                btn.title = getTranslation(isAutoplayActive ? 'autoplayOn' : 'autoplayOff');
            });
            showDialog(getTranslation(isAutoplayActive ? 'autoplayOn' : 'autoplayOff')); // MODIFICATION: Affiche la notification
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
                text: `Écoute "${currentPlayingItem.title}" sur la MMGEAR !`,
                url: window.location.href // Partage l'URL actuelle de l'application
            };

            // Utilise l'API de partage native si disponible (mobile)
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    console.error('Erreur de partage:', err);
                }
            } else { // Fallback pour les navigateurs de bureau
                navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${currentPlayingItem.youtube_id}`).then(() => showDialog(getTranslation('linkCopied')))
                    .catch(err => showDialog(getTranslation('copyFailed')));
            }
        };
        document.getElementById('share-btn').addEventListener('click', shareFunction);
        document.getElementById('overlay-share-btn').addEventListener('click', shareFunction);


        document.getElementById('player-like-btn').addEventListener('click', (e) => {
            if(currentPlayingItem) toggleLike(currentPlayingItem.id);
        });
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
        });

        document.getElementById('volume-up-btn').addEventListener('click', () => setVolume(currentVolume + 10, true));
        document.getElementById('volume-down-btn').addEventListener('click', () => setVolume(currentVolume - 10, true));

        document.getElementById('temp-play-btn').addEventListener('click', () => {
            const musicSection = document.getElementById('music-title-details-section');
            const currentItemId = musicSection.dataset.currentItemId;
            if (currentItemId) {
                const itemToPlay = findItemById(currentItemId);
                if (itemToPlay) {
                    playAudio(sounds.select);
                    playVideoWhenReady(itemToPlay, [], -1, false, true);
                }
            }
        });

        const allOverlays = document.querySelectorAll('#settings-overlay, #shop-overlay, #wifi-overlay, #achievements-overlay, #tags-filter-overlay, #playlist-overlay, #player-options-overlay, #tutorial-overlay, #notifications-overlay, #reco-playlist-options-overlay');
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

            if (activeOverlay) {
                activeOverlay.classList.add('hidden');
            }
            
            activeOverlay = overlay;
            activeOverlay.classList.remove('hidden');
            if (sound) playAudio(sound);

            if (overlay.id === 'player-options-overlay') {
                const volumeControl = document.querySelector('.player-right-controls .volume-control-new');
                const overlayVolumeContainer = document.getElementById('overlay-volume-container');
                if(volumeControl && overlayVolumeContainer) {
                    overlayVolumeContainer.appendChild(volumeControl);
                }
            }

            if (overlay.id === 'playlist-overlay') {
                renderPlaylist();
            }

            if (overlay.id === 'wifi-overlay') {
                playAudio(sounds.connecting, true);
                sounds.connecting.onended = () => {
                   if(activeOverlay && activeOverlay.id === 'wifi-overlay') {
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
            const keepMusicPlaying = activeOverlay.id === 'tags-filter-overlay' || (activeOverlay.id === 'tutorial-overlay' && !isTutorialActive);

            if (wasPlayerOptionsOverlay) {
                const volumeControl = document.querySelector('#overlay-volume-container .volume-control-new');
                const playerRightControls = document.querySelector('.player-right-controls');
                if(volumeControl && playerRightControls) {
                    playerRightControls.insertBefore(volumeControl, document.getElementById('player-like-btn'));
                }
            }

            if (activeOverlay.id === 'shop-overlay' && sounds.shop) {
                sounds.shop.pause();
                sounds.shop.currentTime = 0;
            }
            if (activeOverlay.id === 'wifi-overlay' && sounds.connecting) {
                sounds.connecting.pause();
                sounds.connecting.currentTime = 0;
                sounds.connecting.onended = null;
            }

            activeOverlay.classList.add('hidden');
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
        document.getElementById('achievements-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('achievements-overlay'), sounds.select); });
        document.getElementById('tags-filter-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('tags-filter-overlay'), sounds.select, true); });
        document.getElementById('playlist-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('playlist-overlay'), sounds.select, true); });
        document.getElementById('player-more-options-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('player-options-overlay'), sounds.select, true); });
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
            });
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
            button.addEventListener('click', (e) => {
                const targetContainerId = button.dataset.targetContainer;
                if (!targetContainerId) return;

                // 1. Déterminer la nouvelle vue souhaitée
                const currentView = localStorage.getItem('mmg-global-view') || 'grid';
                const newView = currentView === 'grid' ? 'list' : 'grid';

                // 2. Sauvegarder l'intention
                localStorage.setItem('mmg-global-view', newView);

                // 3. Demander à renderCards de tout redessiner avec la nouvelle préférence
                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                const profileContent = siteData.contentData[activeProfile];
                
                // CORRECTION: Gérer correctement les noms singuliers/pluriels pour trouver les données.
                let cardType = targetContainerId.replace('-cards', ''); // ex: 'titles', 'gameplay', 'makingofs'
                let dataKey = cardType;
                if (cardType.endsWith('s') && !['makingofs', 'albums'].includes(cardType)) {
                    cardType = cardType.slice(0, -1); // 'titles' -> 'title'
                }

                // CORRECTION: Assurer que les sections 'gameplay' et 'makingofs' sont traitées comme des vidéos.
                // Et que 'albums' est traité comme 'album'.
                if (dataKey === 'gameplay' || dataKey === 'makingofs' || dataKey === 'videosBeats') {
                    cardType = 'video';
                } else if (dataKey === 'albums' || dataKey === 'albumsBeats') {
                    cardType = 'album';
                }
                
                // CORRECTION: Gérer le cas spécifique de la bibliothèque qui ne se re-render pas avec renderCards
                if (targetContainerId === 'library-container') {
                    const activeTab = document.querySelector('#library-tabs-container .playlist-tab-btn.active');
                    const activeTabId = activeTab ? activeTab.dataset.tabId : 'liked';
                    renderLibraryPage(activeTabId);
                } else {
                    renderCards(targetContainerId, profileContent[dataKey], cardType);
                }
                // NOUVEAU: Réappliquer le surlignage après avoir changé de vue.
                highlightPlayingCard(currentPlayingItem);

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
                applyTheme(e.target.dataset.theme);
                playAudio(sounds.select);
            });
        });
        
        document.getElementById('cheat-code-btn').addEventListener('click', () => {
            const input = document.getElementById('cheat-code-input');
            const code = input.value.toLowerCase();
            if (code === 'gameshark') {
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
                if(document.getElementById('albums-section').classList.contains('hidden') === false) {
                    handleMenuNavigation('albums-section');
                }
            }
            else {
                showDialog(getTranslation('incorrectCode'));
                playAudio(sounds.blocked);
            }
        });

        document.getElementById('background-music-switch').addEventListener('change', (e) => {
            const playerState = (activePlayer && typeof activePlayer.getPlayerState === 'function') ? activePlayer.getPlayerState() : -1;
            if (e.target.checked && playerState !== YT.PlayerState.PLAYING) {
                document.getElementById('background-music').play();
            } else {
                document.getElementById('background-music').pause();
            }
        });

        let draggedItem = null;
        const playlistContainer = document.getElementById('playlist-container');

        // CORRECTION: Utilisation de mouseenter/mouseleave pour un son de survol propre
        const hoverableSelectors = '.card, .profile-tab, .top-bar-btn, #start-music-btn, #mp3-player-container i, .volume-adjust-btn, .guide-choice-btn';
        
        document.body.addEventListener('mouseenter', (e) => {
            const target = e.target.closest(hoverableSelectors);
            if (target) {
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
                const itemElement = deleteBtn.closest('.playlist-item');
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
                    if (item) {
                        playVideoWhenReady(item, [], -1, true);
                    }
                }
            }
        });

        document.getElementById('playlist-tabs-container').addEventListener('click', e => {
            const tab = e.target.closest('.playlist-tab-btn');
            if (tab) {
                document.querySelectorAll('.playlist-tab-btn').forEach(t => t.classList.remove('active'));
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

                closeOverlay(sounds.select); // Ferme l'overlay d'options

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
                    if (!document.getElementById('library-section').classList.contains('hidden')) renderLibraryPage('current');
                }
            }
        });

        playlistContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('playlist-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0);
            }
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
            if (draggedItem) {
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

            localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist));
            renderPlaylist(); 
        });

        document.getElementById('clear-playlist-btn').addEventListener('click', () => {
            currentPlaylist = [];
            currentQueueIndex = -1;
            localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist));
            renderPlaylist();
            showDialog(getTranslation("playlistCleared"));
            playAudio(sounds.back);
        });

        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.playlist-item:not(.dragging)')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
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
            { step: 3, selector: '#notifications-btn', textKey: 'tutorial_main_new_2' },
            { step: 4, selector: '.central-profiles-card', textKey: 'tutorial_main_9', position: 'pos-bottom' },
            { step: 5, selector: '#sidebar-main-nav', textKey: 'tutorial_main_new_3' },
            { step: 6, selector: '.sidebar-footer', textKey: 'tutorial_main_new_4' },
            { step: 7, selector: '.top-bar', textKey: 'tutorial_main_new_5', position: 'pos-bottom' },
            { step: 8, selector: '.search-bar', textKey: 'tutorial_main_3' },
            { step: 9, selector: '.top-bar-right', textKey: 'tutorial_main_new_6' },
            { step: 10, selector: '#home-dashboard-section', textKey: 'tutorial_main_new_7', position: 'pos-top' },
            { step: 11, selector: '.carousel-card', textKey: 'tutorial_main_new_8' },
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
            { step: 2, selector: '.mobile-header-icons', textKey: 'tutorial_main_new_6' },
            { step: 3, selector: '.search-bar', textKey: 'tutorial_main_3' },
            { step: 4, selector: '#mobile-profile-switch', textKey: 'tutorial_main_9', position: 'pos-bottom' },
            { step: 5, selector: '#home-dashboard-section', textKey: 'tutorial_main_new_7', position: 'pos-top' },
            { step: 6, selector: '.carousel-card', textKey: 'tutorial_main_new_8' },
            { step: 7, selector: '.liked-preview-card', textKey: 'tutorial_main_new_9' },
            { step: 8, selector: '.activity-card', textKey: 'tutorial_main_new_10' },
            { step: 9, selector: '#mobile-mini-player', textKey: 'tutorial_main_12', position: 'pos-center' },
            { step: 10, selector: '#mini-player-album-art', textKey: 'tutorial_main_13', position: 'pos-top' },
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
                textKey: "tutorial_music_3",
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
                step: 4,
                selector: '#details-album-art',
                textKey: "tutorial_music_4",
                position: 'pos-top',
                reverseAction: () => { 
                    showSection('titles-section', false);
                    document.getElementById('temp-play-btn').classList.remove('hidden');
                }
            },
            {
                step: 5,
                selector: ['#details-album-link', '#details-tags'], 
                textKey: "tutorial_music_5",
                position: 'pos-top'
            },
             {
                step: 6,
                selector: '#details-add-to-playlist-btn',
                textKey: "tutorial_music_6",
                position: 'pos-top'
            },
            {
                step: 7,
                selector: '#streaming-links',
                textKey: "tutorial_music_7",
                position: 'pos-top'
            },
            {
                step: 8,
                selector: '.associated-videos-panel',
                textKey: "tutorial_music_8",
                position: 'pos-top'
            },
            {
                step: 9,
                selector: '#temp-play-btn',
                textKey: "tutorial_music_9",
                position: 'pos-top'
            },
            {
                step: 10,
                selector: ['#prev-video-btn', '#next-video-btn'], 
                textKey: "tutorial_music_10",
                position: 'pos-top'
            },
            {
                step: 11, 
                textKey: "tutorial_music_11",
                position: 'pos-top'
            }
        ];

        const tutorials = {
            // CORRECTION: Le guide principal dépend maintenant de la taille de l'écran
            main: window.innerWidth <= 952 ? mobileMainMenuTutorialSteps : mainMenuTutorialSteps,
            // Pour l'instant, le guide musical reste le même, mais on pourrait le spécialiser aussi
            music: musicTitlesTutorialSteps 
        };

        function showTutorialStep(stepIndex) {
            if (highlightedElements.length > 0) {
                highlightedElements.forEach(el => {
                    el.classList.remove('tutorial-highlight');
                    if (el.classList.contains('card')) {
                        el.style.opacity = '';
                    }
                });
                highlightedElements = [];
            }

            if (stepIndex < 0 || stepIndex >= currentTutorial.length) {
                endTutorial();
                return;
            }

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
            document.getElementById('tutorial-step-counter').textContent = `${step.step} / ${currentTutorial.length}`;
            
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
                // CORRECTION: Force l'affichage du bouton "Lancer la chanson" pour le guide
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
            
            closeOverlay(sounds.back);
            
            setTimeout(() => {
                document.getElementById('tutorial-box').classList.add('hidden');
                document.getElementById('guide-selection-overlay').style.display = '';
            }, 500);
            
            if (tutorialSavedPlayerState) {
                const { item, time, state, queue, queueIndex } = tutorialSavedPlayerState;
                
                currentPlayingItem = item;
                activePlaybackQueue = queue;
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

        document.getElementById('guide-btn').addEventListener('click', () => {
             playAudio(sounds.select);
             // CORRECTION: S'assure que la boîte de dialogue du guide est cachée lors de l'ouverture du menu
             document.getElementById('tutorial-box').classList.add('hidden');
             openOverlay(document.getElementById('tutorial-overlay'), null, true);
        });

        document.querySelectorAll('.guide-choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const guideKey = e.target.dataset.guide;
                
                if (guideKey === 'main') {
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
                        document.getElementById('titles-section-title').textContent = siteData.contentData[activeProfile].albums[firstAlbumId].title;
                        renderCards('titles-cards', titlesForAlbum, 'title');
                        showSection('titles-section');
                    }
                }
                startTutorial(guideKey);
            });
        });

        document.getElementById('tutorial-next').addEventListener('click', async () => {
            const currentStep = currentTutorial[currentStepIndex];
            if (currentStep && currentStep.action) {
                await currentStep.action();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            showTutorialStep(currentStepIndex + 1);
        });
        
        document.getElementById('tutorial-prev').addEventListener('click', async () => {
            const currentStep = currentTutorial[currentStepIndex];
            if (currentStep && currentStep.reverseAction) {
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

            // Si une position est forcée et qu'il y a assez de place
            if (preferredPosition === 'pos-top' && spaceAbove > boxHeight + 20) {
                box.classList.add('pos-top');
                box.style.bottom = `${window.innerHeight - targetRect.top + 10}px`;
                box.style.top = 'auto';
            } else if (preferredPosition === 'pos-bottom' && spaceBelow > boxHeight + 20) {
                box.classList.add('pos-bottom');
                box.style.top = `${targetRect.bottom + 10}px`;
                box.style.bottom = 'auto';
            } else { // Sinon, on choisit automatiquement le meilleur emplacement
                box.classList.add(spaceBelow > spaceAbove ? 'pos-bottom' : 'pos-top');
            }
        }


        document.getElementById('tutorial-close').addEventListener('click', endTutorial);


        document.getElementById('player-toggle-handle').addEventListener('click', () => {
            const mainArea = document.querySelector('.main-area');
            const willBeHidden = !mainArea.classList.contains('player-hidden');
            playAudio(willBeHidden ? sounds.minimize : sounds.maximize);
            mainArea.classList.toggle('player-hidden');
        });

                // NOUVEAU: Logique pour la poignée du lecteur mobile
        document.getElementById('mobile-player-toggle-handle').addEventListener('click', () => {
            const body = document.body;
            const willBeHidden = !body.classList.contains('mobile-player-hidden');
            playAudio(willBeHidden ? sounds.minimize : sounds.maximize);
            body.classList.toggle('mobile-player-hidden');
        });
        
                // NOUVEAU: Gestion du swipe pour la bibliothèque mobile
        const librarySection = document.getElementById('library-section');
        if (librarySection) {
            let libraryTouchStartX = 0;
            let libraryTouchStartY = 0;
            librarySection.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    libraryTouchStartX = e.touches[0].clientX;
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
                        const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
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
                if (document.querySelector('.settings-card:not(.hidden)') || document.getElementById('mobile-full-player').classList.contains('active')) return;
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
                    const swipeVerticalDistance = Math.abs(touchEndY - touchStartY);
                    const swipeThreshold = 75; // Seuil un peu plus grand pour éviter les conflits

                    if (swipeVerticalDistance > Math.abs(swipeDistance) || e.target.closest('#library-tabs-container, #dashboard-carousel-container')) {
                        return;
                    }

                    if (Math.abs(swipeDistance) > swipeThreshold) {
                        const currentActiveProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                        let targetProfile;

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

        // MODIFICATION: La logique de clic sur le switch mobile est maintenant gérée par le clic sur l'onglet de bureau
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
                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
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
                            return item.langKey === prevItem.langKey || item.link === prevItem.link;
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
        const mobilePlayerClose = document.getElementById('mobile-player-close-btn');
        
        // MODIFICATION: Logique de swipe pour le lecteur mobile (horizontal et vertical)
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        
        // MODIFICATION: Fonction générique pour ajouter le swipe à un élément
        function addSwipeListeners(element) {
            if (!element) return;
            element.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });
    
            element.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
                handleSwipe(element);
            }, { passive: true });
        }

        // Applique le swipe au lecteur plein écran ET à la page de détails
        addSwipeListeners(document.getElementById('mobile-player-album-art'));
        addSwipeListeners(document.getElementById('details-album-art'));

        function handleSwipe(swipedElement) {
            const swipeThreshold = 50; // Distance minimale en pixels pour un swipe
            const swipeDownThreshold = 75; // Seuil plus grand pour le swipe vertical

            // NOUVEAU: Gérer le swipe vers le bas pour fermer
            if (swipedElement === mobilePlayer && touchEndY > touchStartY + swipeDownThreshold) {
                mobilePlayer.classList.remove('active');
                return; // On ne traite pas le swipe horizontal si on a swipé vers le bas
            }

            if (touchEndX < touchStartX - swipeThreshold) {
                // NOUVEAU: Animation de swipe avec transition
                swipedElement.style.transition = 'transform 0.3s ease-out';
                swipedElement.style.transform = 'translateX(-30px) scale(0.95) rotate(-3deg)';
                setTimeout(() => {
                    swipedElement.style.transition = 'none'; // On retire la transition pour le retour instantané
                    swipedElement.style.transform = '';
                }, 300);
                // Swipe vers la gauche (titre suivant)
                playNextTrack(1, true);
            }

            if (touchEndX > touchStartX + swipeThreshold) {
                // NOUVEAU: Animation de swipe avec transition
                swipedElement.style.transition = 'transform 0.3s ease-out';
                swipedElement.style.transform = 'translateX(30px) scale(0.95) rotate(3deg)';
                setTimeout(() => {
                    swipedElement.style.transition = 'none';
                    swipedElement.style.transform = '';
                }, 300);
                // Swipe vers la droite (titre précédent)
                playNextTrack(-1, true);
            }
        }

        // NOUVEAU: Appliquer le listener de swipe au conteneur principal du lecteur plein écran
        addSwipeListeners(mobilePlayer);

        // NOUVEAU: Gestion du swipe vers le bas pour fermer l'overlay de la pochette
        let artworkTouchStartY = 0;
        artworkOverlay.addEventListener('touchstart', (e) => {
            artworkTouchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        artworkOverlay.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].screenY;
            if (touchEndY > artworkTouchStartY + 50) { // Swipe vers le bas de 50px
                artworkOverlay.classList.add('hidden');
                playAudio(sounds.back);
                // Si l'état de l'historique est celui de l'overlay, on revient en arrière pour le nettoyer
                if (history.state && history.state.overlay === 'artwork') {
                    history.back();
                }
            }
        }, { passive: true });

        // NOUVEAU: Ouvrir le lecteur plein écran en cliquant sur le mini-lecteur
        document.getElementById('mobile-mini-player').addEventListener('click', () => {
            if (!mobilePlayer.classList.contains('active')) {
                mobilePlayer.classList.add('active');
                // CORRECTION: Attendre la fin de l'animation d'ouverture pour vérifier le défilement
                setTimeout(() => {
                    const mobilePlayerTitle = document.getElementById('mobile-player-title');
                    const mobilePlayerArtist = document.getElementById('mobile-player-artist');
                    if (mobilePlayerTitle) checkTitleOverflow(mobilePlayerTitle);
                    if (mobilePlayerArtist) checkTitleOverflow(mobilePlayerArtist);
                }, 450); // La transition dure 400ms, on attend un peu plus.
            }
        });

        mobilePlayerClose.addEventListener('click', () => {
            mobilePlayer.classList.remove('active');
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
                if (element.requestFullscreen) {
                    element.requestFullscreen();
                } else if (element.mozRequestFullScreen) {
                    element.mozRequestFullScreen();
                } else if (element.webkitRequestFullscreen) {
                    element.webkitRequestFullscreen();
                } else if (element.msRequestFullscreen) {
                    element.msRequestFullscreen();
                }
            } else {
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

        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            const iframe = document.getElementById('large-player-iframe');
            if (iframe) toggleFullScreen(iframe);
        });
        
        const playerContainer = document.getElementById('large-player-section');
        let lastTap = 0;

        playerContainer.addEventListener('dblclick', () => {
            const iframe = document.getElementById('large-player-iframe');
            if(iframe) toggleFullScreen(iframe);
        });

        playerContainer.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                e.preventDefault();
                const iframe = document.getElementById('large-player-iframe');
                if(iframe) toggleFullScreen(iframe);
            }
            lastTap = currentTime;
        });
        
        // PWA Install Button Listeners
        const pwaInstallBtn = document.getElementById('pwa-install-btn');
        const pwaDismissBtn = document.getElementById('pwa-dismiss-btn');
        const pwaOverlay = document.getElementById('pwa-install-overlay');

        pwaInstallBtn.addEventListener('click', async () => {
            if (!deferredPrompt) {
                return;
            }
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
            pwaOverlay.classList.add('hidden');
        });

        // NOUVEAU: Gestion du swipe pour retour en arrière sur mobile (style iOS)
        const mainContent = document.getElementById('main-content-wrapper');
        let swipeBackTouchStartX = 0;
        let swipeBackTouchStartY = 0;
        let isSwipingBack = false;
        const swipeTriggerArea = 50; // Zone de déclenchement en pixels depuis le bord gauche
        const swipeThreshold = 100; // Distance minimale pour valider le swipe

        mainContent.addEventListener('touchstart', (e) => {
            // On ne déclenche que si le toucher commence sur le bord gauche et qu'il n'y a qu'un seul doigt
            if (e.touches[0].clientX < swipeTriggerArea && e.touches.length === 1) {
                swipeBackTouchStartX = e.touches[0].clientX;
                swipeBackTouchStartY = e.touches[0].clientY;
                isSwipingBack = true;
                // On désactive la transition pour un suivi direct du doigt
                mainContent.style.transition = 'none';
            }
        }, { passive: true });

        mainContent.addEventListener('touchmove', (e) => {
            if (!isSwipingBack) return;

            const touchMoveX = e.touches[0].clientX;
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
            const diffY = Math.abs(e.changedTouches[0].clientY - swipeBackTouchStartY);

            mainContent.style.transition = 'transform 0.3s ease-out';
            
            if (diffX > swipeThreshold && diffY < swipeThreshold) { // Swipe vers la droite validé
                window.history.back();
            }
            mainContent.style.transform = 'translateX(0)';
            isSwipingBack = false;
        });
    }

    function handleMenuNavigation(dataLink, updateHistory = true) {
        const activeTabForLibrary = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'liked';
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
        document.getElementById('about-content').style.backgroundImage = '';

        if (dataLink === 'home-dashboard-section') {
            currentViewContext = { type: 'home', data: null };
            // Le HTML est déjà dans la page, on a juste besoin de le mettre à jour.
            renderDashboard();
        } else if (dataLink === 'about-section') {
            currentViewContext = { type: 'about', data: null };
            document.getElementById('about-title').textContent = getTranslation('about');
            const avatarUrl = activeProfile === 'mmg-music' ? 'assets/mmg-music-avatar.webp' : 'assets/mmg-beats-avatar.webp';
            const aboutTextKey = `about_${activeProfile.replace('-', '_')}`;
            document.getElementById('about-content').innerHTML = `<img src="${avatarUrl}" alt="Avatar"><p>${getTranslation(aboutTextKey)}</p>`;
        } else if (dataLink === 'liked-titles-section') {
            // CORRECTION: Redirige l'ancien lien "liked-titles-section" vers la nouvelle bibliothèque
            handleMenuNavigation('library-section', updateHistory);
            return; // Arrêter l'exécution ici
        } else if (dataLink === 'library-section') {
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
            titleElement.textContent = activeTabId;
            isCustomPlaylist = false; // On ne peut pas éditer les playlists sauvegardées pour l'instant
        }

        clearBtn.style.display = isCustomPlaylist ? 'flex' : 'none';

        const itemsAsObject = itemsToShow.reduce((acc, item) => {
            if (item) acc[item.id] = item;
            return acc;
        }, {});

        renderCards('library-container', itemsAsObject, 'title'); // Le type 'title' affiche les cartes de titre

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
            showDialog(getTranslation("playlistCleared"));
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
    
    function renderDashboard() {
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

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
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

        dotsContainer.innerHTML = latestItems.map((_, index) => `<button data-slide-index="${index}" class="${index === 0 ? 'active' : ''}"></button>`).join('');
        setupCarousel();
    }

    function renderLikedSongsPreview() {
        const container = document.getElementById('liked-songs-preview');
        if (!container) return;
        const card = container.closest('.liked-preview-card');
        const button = card.querySelector('.dashboard-card-button');
        const noContentMessage = card.querySelector('.no-content-message');

        const likedArray = Array.from(likedSongs);
        const totalLikes = likedArray.length;

        card.classList.toggle('is-empty', totalLikes === 0);

        if (totalLikes === 0) {
            container.innerHTML = '';
            button.style.display = 'none';
            noContentMessage.textContent = getTranslation('noLikedTitles');
            noContentMessage.style.display = 'block';
            return;
        }

        // Affiche jusqu'à 3 pochettes
        const itemsToDisplay = likedArray.slice(-3).reverse();
        let html = itemsToDisplay.map(id => {
            const item = findItemById(id);
            return item ? `<img src="${getCorrectImagePath(item)}" alt="${item.title}" title="${item.title}" data-item-id="${id}">` : '';
        }).join('');

        // Si plus de 4 titres sont likés, affiche un indicateur "+X" dans la 4ème case
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
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
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
                </div>
            </div>
        `).join('');

        // Ré-attacher les écouteurs de survol pour le défilement du titre
        container.querySelectorAll('.recent-video-item-info .video-title').forEach(title => {
            title.addEventListener('mouseenter', () => checkTitleOverflow(title));
            title.addEventListener('mouseleave', () => {
                // Optionnel: arrêter le défilement quand on quitte
            });
        });
    }

    function renderSocialsCard() {
        // La carte est principalement en HTML/CSS, cette fonction est un placeholder
        // si on veut la rendre plus dynamique à l'avenir.
        // On s'assure que le titre est bien retiré au cas où il serait ajouté par JS ailleurs.
        document.querySelector('.socials-hover-content .dashboard-card-title')?.remove();
    }

    function renderUserActivity() {
        const container = document.getElementById('user-activity-list');
        if (!container) return;
        const unlockedCount = Object.values(achievements).filter(a => a.unlocked).length;
        container.innerHTML = `
            <div class="activity-item"><i class="fas fa-trophy"></i><p>${getTranslation('achievements')}: <span class="activity-value">${unlockedCount} / ${Object.keys(achievements).length}</span></p></div>
            <div class="activity-item"><i class="fas fa-heart"></i><p>${getTranslation('likedTitles')}: <span class="activity-value">${likedSongs.size}</span></p></div>
            <div class="activity-item"><i class="fas fa-list-ul"></i><p>${getTranslation('playlist')}: <span class="activity-value">${currentPlaylist.length} ${getTranslation('titles')}</span></p></div>
        `;
    }

    function renderRecommendedPlaylists() {
        const container = document.getElementById('playlist-reco-list');
        if (!container) return;

        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
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

        if (playlists.every(p => p.items.length === 0)) {
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
                    </div>
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

        if (totalSlides <= 1) return; // Pas besoin de carrousel s'il y a 1 slide ou moins

        // CORRECTION: Nettoyer l'ancien minuteur avant d'en créer un nouveau
        if (carouselInterval) {
            clearInterval(carouselInterval);
        }
        carouselInterval = setInterval(nextSlide, 5000);

        function showSlide(index) {
            currentSlide = (index + totalSlides) % totalSlides;
            const scrollPosition = currentSlide * container.offsetWidth;
            container.scrollLeft = scrollPosition;
            updateDots();
        }

        function nextSlide() {
            showSlide(currentSlide + 1);
        }

        function updateDots() {
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentSlide);
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

        // NOUVEAU: Gère la mise à jour des points lors du swipe manuel sur mobile.
        let scrollTimeout;
        container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const newSlideIndex = Math.round(container.scrollLeft / container.offsetWidth);
                if (newSlideIndex !== currentSlide) {
                    showSlide(newSlideIndex);
                    resetInterval();
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

        container.innerHTML = allMessages.map(entry => {
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
