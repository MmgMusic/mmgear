
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
    
    // --- PWA Installation State ---
    let deferredPrompt = null;


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
    async function loadDataAndInitialize() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
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
            }
            updateMediaPositionState(); // Update one last time
            
        } else if (event.data === YT.PlayerState.PLAYING) {
            if (isReloadingForAd) {
                isReloadingForAd = false;
                return; 
            }
            if (playPauseBtn) playPauseBtn.className = 'fas fa-pause';
            backgroundMusic.pause();

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
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            if (sounds.keepAlive) {
                sounds.keepAlive.pause();
            }
            updateMediaPositionState(); // Mettre à jour l'état pour la notification
        }
    }

    function playVideoWhenReady(item, playlistIds = [], index = -1, fromPlaylistOverlay = false, forceTempPlay = false) {
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
            loadAndPlayVideo(item);
        } else {
            showDialog("Chargement du lecteur vidéo...");
        }
    }

    function loadAndPlayVideo(item) {
        document.getElementById('play-pause-box').classList.add('loading');
        currentPlayingItem = item;
        const musicTitle = isMusicTitle(item);
    
        activePlayer = musicTitle ? mediumPlayer : largePlayer;
        const inactivePlayer = musicTitle ? largePlayer : mediumPlayer;
        if (inactivePlayer && typeof inactivePlayer.stopVideo === 'function') inactivePlayer.stopVideo();
        
        updateMp3PlayerInfo(item);
        updateLikeButtonUI(item.id);
        updateMediaSession(item);
        renderPlaylist();
    
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

        if (musicTitle) {
            renderMusicTitleDetails(item);
            showSection('music-title-details-section');
            // Cacher le lecteur vidéo pour les titres musicaux pour encourager la lecture en arrière-plan
            document.getElementById('medium-player-iframe').style.display = 'none';
        } else {
            // Afficher le lecteur pour les contenus vidéo
            document.getElementById('medium-player-iframe').style.display = '';
            showSection('large-player-section');
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
                if (sounds.keepAlive) sounds.keepAlive.pause();
                navigator.mediaSession.playbackState = "none";
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
        const hasUnreadUpdate = siteData.updateLog && siteData.updateLog.some(entry => !readUpdateIds.has(entry.id));


        dot.classList.toggle('hidden', !hasUnreadUpdate);
        unlockNotification.classList.toggle('hidden', !canUnlock);
        markAsReadBtn.disabled = !hasUnreadUpdate;
        document.querySelector('.update-log').classList.toggle('has-unread', hasUnreadUpdate);
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

        if (document.getElementById('liked-titles-section').classList.contains('hidden') === false) {
            handleMenuNavigation('liked-titles-section');
        }
    }

    function updateLikeButtonUI(itemId) {
        const playerLikeBtn = document.getElementById('player-like-btn');
        if (!playerLikeBtn || !currentPlayingItem || currentPlayingItem.id !== itemId) return;
        const isLiked = likedSongs.has(itemId);
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

    function renderPlaylist() {
        const container = document.getElementById('playlist-container');
        if (!container) return;
        
        if (currentPlaylist.length === 0) {
            container.innerHTML = `<p>${getTranslation("playlistEmpty")}</p>`;
            return;
        }

        container.innerHTML = '';
        currentPlaylist.forEach((itemId, index) => {
            const item = findItemById(itemId);
            if (!item) return;

            const isCurrentlyPlaying = currentPlayingItem && currentPlayingItem.id === itemId;
            const playlistItem = document.createElement('div');
            playlistItem.className = `playlist-item ${isCurrentlyPlaying ? 'currently-playing' : ''}`;
            playlistItem.dataset.index = index;
            playlistItem.dataset.itemId = itemId; 
            playlistItem.draggable = true;
            playlistItem.innerHTML = `
                <i class="fas fa-bars playlist-drag-handle"></i>
                <img src="${getCorrectImagePath(item)}" alt="${item.title}">
                <div class="playlist-item-info">
                    <p class="playlist-item-title">${item.title}</p>
                    <p>${item.year || 'Vidéo'}</p>
                </div>
                <button class="playlist-item-delete" title="${getTranslation("deleteFromPlaylist")}"><i class="fas fa-trash-alt"></i></button>
                ${isCurrentlyPlaying ? '<span class="currently-playing-indicator"><i class="fas fa-volume-up"></i></span>' : ''}
            `;
            container.appendChild(playlistItem);
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
        document.getElementById('real-time').textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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

        // MODIFICATION: Affiche un message différent si la section est vide par design vs. pas de résultats de recherche.
        if (Object.keys(cardsData).length === 0) {
            const isSearchResult = containerId === 'search-results-cards';
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

        let delay = 0;
        Object.entries(cardsData).forEach(([key, item]) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.animationDelay = `${delay}s`;
            delay += 0.05;

            const itemId = item.id || key;
            card.dataset.itemId = itemId;
            
            const tracksInAlbum = Object.values(allSearchableItems).filter(t => t.albumId === item.id && t.isUnlockable);
            const unlockedInAlbum = tracksInAlbum.filter(t => unlockedTracks.includes(t.id));
            if (cardType === 'album' && item.isUnlockableAlbum && unlockedInAlbum.length < tracksInAlbum.length) {
                card.classList.add('locked');
                card.innerHTML = `
                  <a href="#" class="card-link-wrapper" data-unlock-album="${item.id}">
                    <div class="card-inner">
                      <div class="lock-overlay">
                        <i class="fas fa-lock"></i>
                        <span class="unlock-cost">${COIN_COST_UNLOCK}</span>
                      </div>
                      <div class="card__content">
                        <div class="card__image" style="background-image: url('${getCorrectImagePath(item)}');"></div>
                        <div class="card__text">
                          <p class="card__title">${item.title}</p>
                          <p class="card__description">${getTranslation('unlockATrack', { unlockedCount: unlockedInAlbum.length, totalCount: tracksInAlbum.length })}</p>
                        </div>
                      </div>
                    </div>
                  </a>
                `;
                container.appendChild(card);
                return;
            }

            const isLocked = item.isUnlockable && !unlockedTracks.includes(itemId);
            if (isLocked && cardType === 'title') {
                card.classList.add('locked');
                card.innerHTML = `
                  <a href="#" class="card-link-wrapper" data-youtube-id="${item.youtube_id}">
                    <div class="card-inner">
                      <div class="lock-overlay">
                        <i class="fas fa-lock"></i>
                        <span class="unlock-cost">${COIN_COST_UNLOCK} <i class="fas fa-coin"></i></span>
                      </div>
                      <div class="card__content">
                        <img class="card__image" loading="lazy" decoding="async" src="${getCorrectImagePath(item)}" alt="${item.title}">
                        <div class="card__text">
                          <p class="card__title">${item.title}</p>
                        </div>
                      </div>
                    </div>
                  </a>
                `;
                container.appendChild(card);
                return;
            }

            let datasetAttributes = '';
            if (cardType === 'title' || cardType === 'video' || cardType === 'search') {
                datasetAttributes = `data-youtube-id="${item.youtube_id}"`;
            } else if (cardType === 'album') {
                 datasetAttributes = `data-album-id="${item.id}"`;
            } else if (cardType === 'menu') {
                datasetAttributes = `data-link="${item.link}"`;
            }

            const imagePath = getCorrectImagePath(item);
            const badgeHtml = item.loopable ? `<div class="card__badge">LOOP ME!</div>` : '';
            
            let cardImageHtml;
            let cardTextHtml;

            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
            const translatedTitle = item.langKey ? getTranslation(item.langKey) : item.title;
            if (cardType === 'menu') { // S'applique maintenant aux deux profils
                const icons = {
                    'albums': { icon: 'fa-record-vinyl', bg: 'bg-albums' }, // mmg-music
                    'videoClips': { icon: 'fa-camera', bg: 'bg-clips' }, // mmg-music
                    'makingOfs': { icon: 'fa-lightbulb', bg: 'bg-makingofs' }, // commun
                    'likedTitles': { icon: 'fa-heart', bg: 'bg-liked' }, // commun
                    'albumsBeats': { icon: 'fa-compact-disc', bg: 'bg-albums-beats' }, // mmg-beats
                    'videosBeats': { icon: 'fa-video', bg: 'bg-videos-beats' } // mmg-beats
                    // 'about' est géré dans le 'else'
                };
                const iconInfo = icons[item.langKey];

                if (iconInfo) {
                    cardImageHtml = `<div class="card__image card-icon-bg ${iconInfo.bg}"><i class="fas ${iconInfo.icon}"></i></div>`;
                    cardTextHtml = `<p class="card__title">${translatedTitle}</p>`;
                } else { // "À propos"
                    cardImageHtml = `<img class="card__image" loading="lazy" decoding="async" src="${getCorrectImagePath(item)}" alt="${translatedTitle}">`;
                    cardTextHtml = `<p class="card__title">${translatedTitle}</p>`;
                }
            } else {
                cardImageHtml = `
                    <img 
                        class="card__image" 
                        loading="lazy" 
                        decoding="async"
                        src="${imagePath}"
                        alt="${translatedTitle}"
                    >
                `;
                
                const isLiked = likedSongs.has(itemId);
                const isInPlaylist = currentPlaylist.includes(itemId);
                const actionsHtml = (cardType === 'title' || cardType === 'video' || (cardType === 'search' && !item.type))
                    ? `<div class="card-actions">
                         <i class="like-btn-card ${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'active' : ''}" data-like-id="${itemId}" title="Aimer"></i>
                         <i class="fas ${isInPlaylist ? 'fa-check' : 'fa-plus'} add-playlist-btn-card ${isInPlaylist ? 'added' : ''}" data-playlist-id="${itemId}" title="${isInPlaylist ? 'Retirer de la playlist' : 'Ajouter à la playlist'}"></i>
                       </div>` 
                    : '';

                let description = '';
                if (cardType !== 'menu') {
                    switch(cardType) {
                        case 'title': 
                            description = getTranslation(`desc_${item.id}`) || item.description || getTranslation('listenToTitle'); 
                            break;
                        case 'album': 
                            const tracksInAlbum = Object.values(allSearchableItems).filter(t => t.albumId === item.id && t.isUnlockable);
                            if (tracksInAlbum.length > 0) {
                                const unlockedInAlbum = tracksInAlbum.filter(t => unlockedTracks.includes(t.id));
                                const lockedCount = tracksInAlbum.length - unlockedInAlbum.length;
                                if (lockedCount > 0) {
                                    const langKey = lockedCount === 1 ? 'trackToUnlock_one' : 'trackToUnlock_many';
                                    description = getTranslation(langKey, { count: lockedCount });
                                }
                            }
                            break;
                        case 'video': description = ''; break; // MODIFICATION: Texte superflu retiré
                        case 'search': 
                            description = item.type === 'album' 
                                ? getTranslation('viewAlbum')
                                : (item.year ? getTranslation('musicTitle') : getTranslation('videoOrMakingOf')); 
                            break;
                        default: description = getTranslation('viewContent');
                    }
                }
                
                if (description.length > 50) {
                    description = description.substring(0, 47) + '...';
                }

                const lockIconHtml = isLocked && cardType !== 'title' ? ' <i class="fas fa-lock" style="font-size: 0.8em; opacity: 0.7;"></i>' : '';
                
                cardTextHtml = `
                    <p class="card__title" title="${translatedTitle.replace(/"/g, '&quot;')}"><span>${translatedTitle}${lockIconHtml}</span></p>
                    ${description ? `<p class="card__description">${description}</p>` : ''}
                    ${actionsHtml}
                `;
            }

            card.innerHTML = `
              <a href="#" class="card-link-wrapper" ${datasetAttributes}>
                <div class="card-inner">
                  <div class="card__content">
                    ${badgeHtml}
                    ${cardImageHtml}
                    <div class="card__text">
                      ${cardTextHtml}
                    </div>
                  </div>
                </div>
              </a>
            `;
            container.appendChild(card);
        });

        const scrollableCardTypes = ['title', 'video', 'search', 'album'];
        if (scrollableCardTypes.includes(cardType)) {
            setupTitleScrollObserver(`#${containerId}`);
        }
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
            const imageSrc = isMusicTitle(item) 
                ? getCorrectImagePath(item)
                : `https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg`;
            document.getElementById('player-album-cover').src = imageSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3C/svg%3E"; 
            updateLikeButtonUI(item.id);
        }
    }
    
    function resetMiniPlayerUI() {
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('song-title').textContent = getTranslation('noTrackPlaying');
        document.getElementById('player-album-cover').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3C/svg%3E";
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
        };
    
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
            document.body.classList.remove('theme-bg-waves', 'theme-bg-sine-waves');
            stopWavesBackground(); // S'assurer que l'animation JS est arrêtée

            if (themeName === 'theme-bg-sine-waves') {
                startWavesBackground();
                document.body.classList.add(themeName);
            } else if (themeName === 'theme-bg-waves') {
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

    function resetToHome() {
        playAudio(sounds.select);
        showSection('menu-cards-section');
        const activeProject = document.querySelector('.profile-tab.active').dataset.project;
        renderCards('content-cards', siteData.projectData[activeProject], 'menu');
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
    
        requestAnimationFrame(() => {
            const isOverflown = titleSpan.scrollWidth > title.clientWidth + 1;
            if (isOverflown) {
                const overflowAmount = titleSpan.scrollWidth - title.clientWidth;
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
        
        resetMiniPlayerUI();
        setupTagFilters();
        renderUpdateLog();
        updateTime();
        setInterval(updateTime, 30000);
        
        const savedTheme = localStorage.getItem('theme') || 'light';
        const savedUiTheme = localStorage.getItem('ui-theme') || 'default';
        document.getElementById('theme-switch').checked = savedTheme === 'dark';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');
        applyTheme(savedUiTheme);
        
        setVolume(100);
        setupEventListeners();

        const initialSectionId = window.location.hash.substring(1);
        let sectionToLoad = 'menu-cards-section';
        
        if (initialSectionId && document.getElementById(initialSectionId)) {
            sectionToLoad = initialSectionId;
        }
        
        // --- HISTORY TRAP SETUP ---
        // 1. Replace the current history entry with a "trap" entry. This is the page we will prevent the user from reaching.
        history.replaceState({ section: 'menu-cards-section', fromApp: true, isTrap: true }, '', '#menu-cards-section');

        // 2. Push the actual main menu state on top of the trap. This is the page the user will see and be returned to.
        history.pushState({ section: 'menu-cards-section', fromApp: true }, '', '#menu-cards-section');

        // 3. If the user loaded a deep link (e.g., #albums-section), push that state now so they see the correct page.
        if (sectionToLoad !== 'menu-cards-section') {
            history.pushState({ section: sectionToLoad, fromApp: true }, '', '#' + sectionToLoad);
        }

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
        if (!forcePlay) playAudio(sounds.select);
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
                 playVideoWhenReady(nextItem, currentQueue, nextIndex);
            } else {
                 renderMusicTitleDetails(nextItem);
                 showSection('music-title-details-section');
            }
        }
    };
    
    function setupEventListeners() {
        document.querySelector('.back-btn').addEventListener('click', (e) => {
            e.preventDefault();
            playAudio(sounds.back);
            if (isTutorialActive) return;
        
            const menuSection = document.getElementById('menu-cards-section');
            if (menuSection && !menuSection.classList.contains('hidden')) {
                // If on the main menu, do nothing, let the browser handle it (which will trigger our trap)
                return;
            }
        
            window.history.back();
        });

        document.getElementById('home-btn').addEventListener('click', (e) => {
            e.preventDefault();
            resetToHome();
        });

        window.addEventListener('popstate', (event) => {
            // This is our trap. If the state is the one we designated as the trap,
            // immediately go forward again, effectively canceling the back button press.
            if (event.state && event.state.isTrap) {
                history.forward();
                return;
            }
    
            // If it's a regular in-app navigation, handle it.
            // If state is null, it might happen on initial load or weird browser behavior, default to menu.
            const sectionId = event.state ? event.state.section : 'menu-cards-section';
            handleMenuNavigation(sectionId, false);
        });


        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                resetToHome();
            });
        });
        
        // CORRECTION: L'écouteur est sur .main-board pour couvrir le header et le footer
        const mainBoard = document.querySelector('.main-board');
        
        mainBoard.addEventListener('click', (e) => {
            // Animation de clic pour les icônes
            const iconButton = e.target.closest('.top-bar-btn, .player-buttons > i, .controls-box, .player-right-controls > i');
            if (iconButton) {
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
                e.preventDefault();
                const itemId = associatedVideo.dataset.itemId;
                const item = findItemById(itemId);
                if (item) {
                    playAudio(sounds.select);
                    playVideoWhenReady(item);
                }
                return;
            }

            const link = e.target.closest('a.card-link-wrapper');
            if (!link) return;
            e.preventDefault();

            const { youtubeId, link: dataLink, albumId, unlockAlbum } = link.dataset;
            const cardElement = link.closest('.card');
            const itemId = cardElement.dataset.itemId;

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
                const item = findItemById(itemId);
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

                // Start the keep-alive sound directly on user interaction
                if (isBackgroundPlayEnabled && sounds.keepAlive) {
                    sounds.keepAlive.play().catch(e => console.log("Keep-alive audio failed to play on user tap."));
                }

                playAudio(sounds.select);
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

            } else if (dataLink) {
                playAudio(sounds.select);
                handleMenuNavigation(dataLink);
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

        mainBoard.addEventListener('mousedown', (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const titleSpan = card.querySelector('.card__title.scrolling > span');
                if (titleSpan) {
                    titleSpan.style.animationPlayState = 'paused';
                }
            }
        });
        mainBoard.addEventListener('touchstart', (e) => {
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

        const artworkOverlay = document.getElementById('artwork-overlay');
        document.getElementById('details-album-art').addEventListener('click', (e) => {
            document.getElementById('artwork-overlay-img').src = e.target.src;
            artworkOverlay.classList.remove('hidden');
        });
        artworkOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'artwork-overlay') {
                artworkOverlay.classList.add('hidden');
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

        document.getElementById('next-video-btn').addEventListener('click', () => playNextTrack(1, isAutoplayActive));
        document.getElementById('prev-video-btn').addEventListener('click', () => playNextTrack(-1, isAutoplayActive));
        
        document.getElementById('loop-btn').addEventListener('click', (e) => {
            isPlayerLooping = !isPlayerLooping;
            e.currentTarget.classList.toggle('active', isPlayerLooping);
            playAudio(sounds.select);
            if (isPlayerLooping) {
                isShuffleMode = false;
                document.getElementById('shuffle-btn').classList.remove('active');
            }
        });

        document.getElementById('shuffle-btn').addEventListener('click', (e) => {
            isShuffleMode = !isShuffleMode;
            e.currentTarget.classList.toggle('active', isShuffleMode);
            playAudio(sounds.select);
            if (isShuffleMode) {
                isPlayerLooping = false;
                document.getElementById('loop-btn').classList.remove('active');
            }
        });
        
        const toggleAutoplay = (e) => {
            isAutoplayActive = !isAutoplayActive;
            const buttons = document.querySelectorAll('#autoplay-toggle, #overlay-autoplay-toggle');
            buttons.forEach(btn => {
                btn.classList.toggle('active', isAutoplayActive);
                btn.title = getTranslation(isAutoplayActive ? 'autoplayOn' : 'autoplayOff');
            });
            showDialog(getTranslation(isAutoplayActive ? 'autoplayOn' : 'autoplayOff'));
            playAudio(sounds.select);
            
            if (isAutoplayActive && activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() === YT.PlayerState.ENDED) {
                playNextTrack();
            }

            updateTempPlayButtonVisibility();
        };
        document.getElementById('autoplay-toggle').addEventListener('click', toggleAutoplay);
        document.getElementById('overlay-autoplay-toggle').addEventListener('click', toggleAutoplay);


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

        const allOverlays = document.querySelectorAll('#settings-overlay, #shop-overlay, #wifi-overlay, #achievements-overlay, #tags-filter-overlay, #playlist-overlay, #player-options-overlay, #tutorial-overlay, #notifications-overlay');
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

        document.getElementById('mark-as-read-btn').addEventListener('click', () => {
            playAudio(sounds.select);
            if (siteData.updateLog && siteData.updateLog.length > 0) {
                siteData.updateLog.forEach(update => readUpdateIds.add(update.id));
                localStorage.setItem('mmg-readUpdateIds', JSON.stringify([...readUpdateIds]));
            }
            updateNotificationDot();
            renderUpdateLog(); // Re-render pour enlever le style "non lu"
        });

        
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

        const mainMenuTutorialSteps = [
            { step: 1, selector: '.back-btn', textKey: 'tutorial_main_1' },
            { step: 2, selector: '#home-btn', textKey: 'tutorial_main_2' },
            { step: 3, selector: '.search-bar', textKey: 'tutorial_main_3' },
            { step: 4, selector: '#tags-filter-btn', textKey: 'tutorial_main_4' },
            { step: 5, selector: '#shop-btn', textKey: 'tutorial_main_5' },
            { step: 6, selector: '#achievements-btn', textKey: 'tutorial_main_6' },
            { step: 7, selector: '#settings-btn', textKey: 'tutorial_main_7' },
            { step: 8, selector: '#wifi-btn', textKey: 'tutorial_main_8' },
            { step: 9, selector: '.profile-tab[data-project="mmg-music"]', textKey: 'tutorial_main_9', position: 'pos-bottom' },
            { step: 10, selector: '.profile-tab[data-project="mmg-beats"]', textKey: 'tutorial_main_10', position: 'pos-bottom' },
            { step: 11, selector: '#content-cards', textKey: 'tutorial_main_11', position: 'pos-top' },
            { step: 12, selector: '#mp3-player-container', textKey: 'tutorial_main_12' },
            { step: 13, selector: '#player-album-cover', textKey: 'tutorial_main_13' },
            { step: 14, selector: '#autoplay-toggle', textKey: 'tutorial_main_14' },
            { step: 15, selector: '#shuffle-btn', textKey: 'tutorial_main_15' },
            { step: 16, selector: '#loop-btn', textKey: 'tutorial_main_16' },
            { step: 17, selector: '.volume-control-new', textKey: 'tutorial_main_17' },
            { step: 18, selector: '#player-like-btn', textKey: 'tutorial_main_18' },
            { step: 19, selector: '#playlist-btn', textKey: 'tutorial_main_19' },
            { step: 20, selector: '#share-btn', textKey: 'tutorial_main_20' },
            { step: 21, selector: '#player-more-options-btn', textKey: 'tutorial_main_21' },
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
            main: mainMenuTutorialSteps,
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
                highlightedElements[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
            
            const tutorialBox = document.getElementById('tutorial-box');
            document.getElementById('tutorial-text').textContent = getTranslation(step.textKey);
            document.getElementById('tutorial-step-counter').textContent = `${step.step} / ${currentTutorial.length}`;
            
            tutorialBox.className = 'tutorial-box-style';
            tutorialBox.classList.add(step.position || 'pos-center');
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

        document.getElementById('tutorial-close').addEventListener('click', endTutorial);


        document.getElementById('player-toggle-handle').addEventListener('click', () => {
            const willBeHidden = !document.body.classList.contains('player-hidden');
            playAudio(willBeHidden ? sounds.minimize : sounds.maximize);
            document.body.classList.toggle('player-hidden');
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

    }

    function handleMenuNavigation(dataLink, updateHistory = true) {
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
        const profileContent = siteData.contentData[activeProfile];
        const sections = {
            'albums-section': { data: profileContent.albums, type: 'album', container: 'albums-cards' },
            'gameplay-section': { data: profileContent.gameplay, type: 'video', container: 'gameplay-cards' }, 
            'makingofs-section': { data: profileContent.makingofs, type: 'video', container: 'makingofs-cards' },
        };
        
        if (!document.getElementById(dataLink)) {
            currentViewContext = { type: 'menu', data: null };
            dataLink = 'menu-cards-section'; // Fallback to menu
        }

        if (dataLink === 'albums-section') {
            currentViewContext = { type: 'albums', data: null };
            renderCards('albums-cards', profileContent.albums, 'album');
        } else if (dataLink === 'about-section') {
            currentViewContext = { type: 'about', data: null };
            document.getElementById('about-title').textContent = getTranslation('about');
            const avatarUrl = activeProfile === 'mmg-music' ? 'assets/mmg-music-avatar.webp' : 'assets/mmg-beats-avatar.webp';
            const aboutTextKey = `about_${activeProfile.replace('-', '_')}`;
            document.getElementById('about-content').innerHTML = `<img src="${avatarUrl}" alt="Avatar"><p>${getTranslation(aboutTextKey)}</p>`;
        } else if (dataLink === 'liked-titles-section') {
            const likedItems = Object.fromEntries(
                [...likedSongs].map(id => [id, findItemById(id)]).filter(([, item]) => item)
            );
            currentViewContext = { type: 'liked', data: null };
            document.getElementById('liked-titles-section-title').textContent = getTranslation('likedTitles');
            renderCards('liked-titles-cards', likedItems, 'title');
        } else if (sections[dataLink]) { // Handle other generic sections
            renderCards(sections[dataLink].container, sections[dataLink].data, sections[dataLink].type);
        } else if (dataLink === 'menu-cards-section') {
            currentViewContext = { type: 'menu', data: null };
            renderCards('content-cards', siteData.projectData[activeProfile], 'menu');
            if (titleScrollObserver) titleScrollObserver.disconnect(); // Pas de scroll sur le menu principal
        }
        
        showSection(dataLink, updateHistory);
    
}

    function renderUpdateLog() {
        const container = document.getElementById('update-log-entries');
        if (!container || !siteData.updateLog) return;

        container.innerHTML = siteData.updateLog.map(entry => {
            const isRead = readUpdateIds.has(entry.id);
            return `
                <div class="update-log-entry ${isRead ? 'read' : 'unread'}">
                    <h5>${entry.date}</h5>
                    <p>${entry.content}</p>
                </div>
            `;
        }).join('');
    }
