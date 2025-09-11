document.addEventListener('DOMContentLoaded', () => {

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
    let currentNavigationContext = { playlist: [], index: -1 };
    
    // --- NOUVEAUX ÉTATS ---
    let isBackgroundPlayEnabled = true; // Activé par défaut
    const keepAliveAudio = document.getElementById('keep-alive-audio');
    
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
            
            injectExclusiveContent();

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
    
    function injectExclusiveContent() {
        siteData.contentData['mmg-music'].albums['dream-season'] = { 
            id: 'dream-season', 
            title: 'Dream Season', 
            image: 'assets/pochettes/Pochette-DreamSeason.jpg'
        };
        const exclusiveTracks = {
            'ds-track1': { id: 'ds-track1', title: 'Rêve Lucide', albumId: 'dream-season', year: '2025', description: 'Premier extrait exclusif de Dream Season.', image: 'assets/pochettes/dream_season_t1.png', youtube_id: 'dQw4w9WgXcQ', isUnlockable: true, tags: ['exclusif', 'dream'] },
            'ds-track2': { id: 'ds-track2', title: 'Sommeil Paradoxal', albumId: 'dream-season', year: '2025', description: 'Deuxième extrait exclusif.', image: 'assets/pochettes/dream_season_t2.png', youtube_id: 'y6120QOlsfU', isUnlockable: true, tags: ['exclusif', 'dream'] },
            'ds-track3': { id: 'ds-track3', title: 'Nuit Blanche', albumId: 'dream-season', year: '2025', description: 'Troisième extrait exclusif.', image: 'assets/pochettes/dream_season_t3.png', youtube_id: '34Na4j8AVgA', isUnlockable: true, tags: ['exclusif', 'dream'] },
        };
        Object.assign(siteData.contentData['mmg-music'].titles, exclusiveTracks);
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
        setInterval(updateProgressBar, 250);
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
            if (isBackgroundPlayEnabled) keepAliveAudio.pause();
            
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
                event.target.seekTo(0);
                event.target.playVideo();
                return;
            }
            
            if (isAutoplayActive) {
                playNextTrack();
            } else {
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
            if (isBackgroundPlayEnabled) keepAliveAudio.play();

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
            updateMediaPositionState();

        } else if (event.data === YT.PlayerState.PAUSED) {
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            if (isBackgroundPlayEnabled) keepAliveAudio.pause();
            updateMediaPositionState();
        }
    }

    function playVideoWhenReady(item, playlistIds = [], index = -1, fromPlaylistOverlay = false, forceTempPlay = false) {
        if (!item) return;
        
        if (!isAutoplayActive && !fromPlaylistOverlay && !forceTempPlay) {
            if (isMusicTitle(item)) {
                renderMusicTitleDetails(item);
                showSection('music-title-details-section');
            }
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
        } else {
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
            if(activePlayer) activePlayer.seekTo(Math.max(0, activePlayer.getCurrentTime() - skipTime), true);
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            if(activePlayer) activePlayer.seekTo(Math.min(activePlayer.getDuration(), activePlayer.getCurrentTime() + skipTime), true);
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.fastSeek && 'fastSeek' in activePlayer) {
              activePlayer.fastSeek(details.seekTime);
              return;
            }
            if(activePlayer) activePlayer.seekTo(details.seekTime, true);
        });

        updateMediaPositionState(); // Initialisation de la barre de progression
    }

    /**
     * Met à jour la position et la durée dans l'API Media Session pour la notification.
     */
    function updateMediaPositionState() {
        if (!('mediaSession' in navigator) || !activePlayer || typeof activePlayer.getDuration !== 'function') {
            return;
        }

        const duration = activePlayer.getDuration() || 0;
        const position = activePlayer.getCurrentTime() || 0;
        
        if (!isNaN(duration) && isFinite(duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackRate: activePlayer.getPlaybackRate(),
                    position: position
                });
            } catch (error) {
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
        
        const storedBackgroundPlay = localStorage.getItem('mmg-backgroundPlayEnabled');
        isBackgroundPlayEnabled = storedBackgroundPlay !== null ? JSON.parse(storedBackgroundPlay) : true;
        document.getElementById('background-play-switch').checked = isBackgroundPlayEnabled;

        const storedAchievements = localStorage.getItem('mmg-achievements');
        const defaultAchievements = {
            loopMaster: { unlocked: false, progress: {}, goal: 3, title: "Loop Master", desc: "Écouter 3 fois la même chanson en boucle.", icon: "fa-sync-alt" },
            retroPlayer: { unlocked: false, progress: [], goal: 3, title: "Retro Player", desc: "Écouter 3 chansons 'rétro'.", icon: "fa-gamepad" },
            patienceIsKey: { unlocked: false, progress: 0, goal: 2, title: "La patience est une vertu", desc: "Attendre 2 fois la fin de l'easter egg du WiFi.", icon: "fa-hourglass-end" },
            psPlayer: { unlocked: false, progress: [], goal: 2, title: "PS Player", desc: "Écouter 2 chansons 'playstation'.", icon: "fab fa-playstation" }
        };
        achievements = storedAchievements ? JSON.parse(storedAchievements) : defaultAchievements;
        
        Object.keys(defaultAchievements).forEach(key => {
            if (!achievements[key]) {
                achievements[key] = defaultAchievements[key];
            }
        });
        
        const storedCoins = localStorage.getItem('mmg-userCoins');
        userCoins = storedCoins ? JSON.parse(storedCoins) : 0;
        const storedUnlocked = localStorage.getItem('mmg-unlockedDreamSeason');
        unlockedDreamSeasonTracks = storedUnlocked ? JSON.parse(storedUnlocked) : [];
        updateCoinDisplay();

        renderAchievements();
        updateShopLocksAndSelection();
    }
    
    function updateCoinDisplay() {
        const coinElement = document.getElementById('coin-count');
        if(coinElement) coinElement.textContent = userCoins;
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
        showDialog(`Succès débloqué : ${achievements[id].title} !`);
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
                    <h4>${ach.title}</h4>
                    <p>${ach.desc}</p>
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
        const currentTheme = localStorage.getItem('ui-theme') || 'default';
        document.querySelectorAll('.theme-buy-btn').forEach(btn => {
            const achievementId = btn.dataset.achievement;
            const themeId = btn.dataset.theme;

            btn.disabled = false;
            if (achievementId && achievements[achievementId] && !achievements[achievementId].unlocked) {
                btn.classList.add('locked');
                btn.classList.remove('selected');
                btn.innerHTML = `<i class="fas fa-lock"></i> Débloquer`;
                btn.disabled = true;
            } else {
                btn.classList.remove('locked');
                if (themeId === currentTheme) {
                    btn.innerHTML = 'Sélectionné';
                    btn.classList.add('selected');
                    btn.disabled = true;
                } else {
                    btn.innerHTML = 'Sélectionner';
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
    
    function addToPlaylist(itemId) {
        if (currentPlaylist.includes(itemId)) {
            showDialog("Ce titre est déjà dans la playlist.");
            return;
        }
        currentPlaylist.push(itemId);
        localStorage.setItem('mmg-playlist', JSON.stringify(currentPlaylist));
        showDialog("Titre ajouté à la playlist !");
        playAudio(sounds.select);
        renderPlaylist();
        updateDetailsPlaylistButtonState();
    }

    function renderPlaylist() {
        const container = document.getElementById('playlist-container');
        if (!container) return;
        
        if (currentPlaylist.length === 0) {
            container.innerHTML = '<p>La playlist est vide. Cliquez sur l\'icône \'+\' sur un titre pour l\'ajouter.</p>';
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
                <button class="playlist-item-delete" title="Supprimer de la playlist"><i class="fas fa-trash-alt"></i></button>
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
    function playAudio(audioElement) {
        if (!sfxEnabled || !audioElement) return;
        
        audioElement.currentTime = 0;
        audioElement.play().catch(error => {});
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

        if (titleScrollObserver) titleScrollObserver.disconnect();
        if (titleResizeObserver) titleResizeObserver.disconnect();

        container.innerHTML = '';
        if (Object.keys(cardsData).length === 0) {
            container.innerHTML = '<p style="text-align: center; width: 100%;">Aucun résultat.</p>';
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
            
            if (cardType === 'album' && item.id === 'dream-season' && unlockedDreamSeasonTracks.length < 3) {
                card.classList.add('locked');
                card.innerHTML = `
                  <a href="#" class="card-link-wrapper" data-unlock-album="dream-season">
                    <div class="card-inner">
                      <div class="lock-overlay">
                        <i class="fas fa-lock"></i>
                        <span class="unlock-cost">${COIN_COST_UNLOCK} <i class="fa-solid fa-coin-front"></i></span>
                      </div>
                      <div class="card__content">
                        <div class="card__image" style="background-image: url('${getCorrectImagePath(item)}');"></div>
                        <div class="card__text">
                          <p class="card__title">${item.title}</p>
                          <p class="card__description">Débloquer un morceau (${unlockedDreamSeasonTracks.length}/3)</p>
                        </div>
                      </div>
                    </div>
                  </a>
                `;
                container.appendChild(card);
                return;
            }

            const isLocked = item.isUnlockable && !unlockedDreamSeasonTracks.includes(itemId);
            if (isLocked) {
                card.classList.add('locked');
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
            if (cardType === 'menu' && activeProfile === 'mmg-music') {
                const icons = {
                    'Albums': { icon: 'fa-record-vinyl', bg: 'bg-albums' },
                    'Clips Vidéos': { icon: 'fa-camera', bg: 'bg-clips' },
                    'Making-Ofs': { icon: 'fa-lightbulb', bg: 'bg-makingofs' },
                    'Titres likés': { icon: 'fa-heart', bg: 'bg-liked' }
                };
                const iconInfo = icons[item.title];

                if (iconInfo) {
                    cardImageHtml = `<div class="card__image card-icon-bg ${iconInfo.bg}"><i class="fas ${iconInfo.icon}"></i></div>`;
                    cardTextHtml = `<p class="card__description">${item.title}</p>`;
                } else { // "À propos"
                    cardImageHtml = `<div class="card__image" style="background-image: url('${imagePath.replace(/'/g, "\\'")}');"></div>`;
                    cardTextHtml = `<p class="card__title">${item.title}</p>`;
                }
            } else {
                cardImageHtml = `<div class="card__image" style="background-image: url('${imagePath.replace(/'/g, "\\'")}');"></div>`;
                
                const isLiked = likedSongs.has(itemId);
                const actionsHtml = (cardType === 'title' || cardType === 'video' || (cardType === 'search' && !item.type))
                    ? `<div class="card-actions">
                         <i class="like-btn-card ${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'active' : ''}" data-like-id="${itemId}" title="Aimer"></i>
                         <i class="fas fa-plus add-playlist-btn-card" data-playlist-id="${itemId}" title="Ajouter à la playlist"></i>
                       </div>` 
                    : '';

                let description = '';
                if (cardType === 'menu' && activeProfile === 'mmg-beats') {
                    description = '';
                } else {
                    switch(cardType) {
                        case 'title': description = item.description || 'Écouter ce titre'; break;
                        case 'album': description = ''; break;
                        case 'video': description = 'Voir la vidéo'; break;
                        case 'search': 
                            description = item.type === 'album' 
                                ? 'Voir l\'album' 
                                : (item.year ? 'Titre musical' : 'Vidéo ou Making-of'); 
                            break;
                        default: description = 'Voir le contenu';
                    }
                }
                
                if (description.length > 50) {
                    description = description.substring(0, 47) + '...';
                }

                const lockIconHtml = isLocked ? ' <i class="fas fa-lock" style="font-size: 0.8em; opacity: 0.7;"></i>' : '';
                
                cardTextHtml = `
                    <p class="card__title" title="${item.title.replace(/"/g, '&quot;')}"><span>${item.title}${lockIconHtml}</span></p>
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
    
    function updateDetailsPlaylistButtonState() {
        const detailsSection = document.getElementById('music-title-details-section');
        const btn = document.getElementById('details-add-to-playlist-btn');
        if (!detailsSection || !btn) return;

        const currentItemId = detailsSection.dataset.currentItemId;
        if (!currentItemId) return;

        const isInPlaylist = currentPlaylist.includes(currentItemId);

        if (isInPlaylist) {
            btn.innerHTML = `<i class="fas fa-check"></i> Ajouté à la playlist`;
            btn.classList.add('added');
        } else {
            btn.innerHTML = `<i class="fas fa-plus"></i> Ajouter à la playlist`;
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
        albumSpan.textContent = album ? album.title : 'Inconnu';
        albumSpan.parentElement.dataset.albumId = item.albumId;
        document.getElementById('details-year').textContent = item.year;
        document.getElementById('details-description').textContent = item.description;
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
        gameplayContainer.innerHTML = '<h4>Gameplay video</h4>';
        makingofContainer.innerHTML = '<h4>Making of video</h4>';

        const createVideoCard = (video) => {
            const card = document.createElement('a');
            card.href = '#';
            card.className = 'associated-video-card';
            card.dataset.youtubeId = video.youtube_id;
            card.dataset.itemId = video.id;
            card.innerHTML = `
                <img src="${getCorrectImagePath(video)}" alt="${video.title}" onerror="this.src='https://placehold.co/100x56/000/fff?text=Error';">
                <p>${video.title}</p>
            `;
            return card;
        };
        
        const musicTitleLower = musicItem.title.toLowerCase().split(' (')[0];
        
        const associatedGameplay = Object.values(siteData.contentData[activeProfile].gameplay)
            .find(video => video.title.toLowerCase().includes(musicTitleLower));
        if (associatedGameplay) {
            gameplayContainer.appendChild(createVideoCard(associatedGameplay));
        } else {
            gameplayContainer.innerHTML += '<p>Aucune vidéo associée.</p>';
        }
        
        const associatedMakingOf = Object.values(siteData.contentData[activeProfile].makingofs)
            .find(video => video.title.toLowerCase().includes(musicTitleLower));
        if (associatedMakingOf) {
            makingofContainer.appendChild(createVideoCard(associatedMakingOf));
        } else {
            makingofContainer.innerHTML += '<p>Aucune vidéo associée.</p>';
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
        document.getElementById('song-title').textContent = 'Aucun titre en lecture';
        document.getElementById('player-album-cover').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3C/svg%3E";
    }

    function updateProgressBar() {
        if (!activePlayer || typeof activePlayer.getDuration !== 'function' || !currentPlayingItem) return;
        
        const duration = activePlayer.getDuration();
        if (duration > 0) {
            const currentTime = activePlayer.getCurrentTime();
            listenProgress = currentTime / duration;
            document.getElementById('progress-fill').style.width = `${listenProgress * 100}%`;

            if (previousListenProgress > 0) {
                const progressDifference = listenProgress - previousListenProgress;
                const seekThreshold = 2 / duration; 
                if (duration > 2 && Math.abs(progressDifference) > seekThreshold) {
                    seekDetectedInCurrentPlay = true;
                }
            }
            previousListenProgress = listenProgress;
        }
        updateMediaPositionState();
    }

    function showSection(sectionId, updateHistory = true, keepPlayerVisible = false) {
        if (!keepPlayerVisible) {
            document.querySelectorAll('.content-section-board .page-section').forEach(s => s.classList.add('hidden'));
        } else {
            document.querySelectorAll('.content-section-board .page-section:not(#large-player-section):not(#music-title-details-section)').forEach(s => s.classList.add('hidden'));
        }
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.remove('hidden');
            if (updateHistory) {
                // Only push a new state if it's different from the current one.
                // This prevents creating duplicate history entries when a link is clicked multiple times.
                if (!history.state || history.state.section !== sectionId) {
                    history.pushState({ section: sectionId, fromApp: true }, '', '#' + sectionId);
                }
            }
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

    function updateVisibleCards() {
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

        showSection('search-results-section', true, false);
        renderCards('search-results-cards', filteredResults, 'search');
    }

    function setupTagFilters() {
        const allTags = new Set(Object.values(allSearchableItems).flatMap(item => item.tags || []));
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
        document.body.className = ''; 
        const isDark = localStorage.getItem('theme') === 'dark';
        if (isDark) document.body.classList.add('dark-theme');
        if (document.body.classList.contains('tutorial-active-body')) {
            document.body.classList.add('tutorial-active-body');
        }
        if (themeName && themeName !== 'default') {
            document.body.classList.add(themeName);
        }
        localStorage.setItem('ui-theme', themeName);
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

        handleMenuNavigation(sectionToLoad, false); // This will show the correct section without adding to history.
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
    
    function startApplication() {
        if (document.getElementById('background-music-switch').checked) {
            document.getElementById('background-music').play().catch(()=>{});
        }
        const welcomeScreen = document.getElementById('welcome-screen');
        welcomeScreen.classList.add('fade-out');
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            document.getElementById('main-content-wrapper').classList.remove('hidden');
            // Show the PWA install prompt after a short delay
            setTimeout(showPwaInstallPrompt, 1000);
        }, 500);
    }
    
    function setupEventListeners() {
        document.getElementById('start-music-btn').addEventListener('click', startApplication);

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
        
        const contentBoard = document.querySelector('.content-section-board');
        
        contentBoard.addEventListener('click', (e) => {
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
                addToPlaylist(playlistBtn.dataset.playlistId);
                return;
            }
            
            const detailsPlaylistBtn = e.target.closest('#details-add-to-playlist-btn');
            if (detailsPlaylistBtn) {
                e.preventDefault();
                e.stopPropagation();
                const currentItemId = document.getElementById('music-title-details-section').dataset.currentItemId;
                if(currentItemId) {
                    addToPlaylist(currentItemId);
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
                    userCoins -= COIN_COST_UNLOCK;
                    const allDreamSeasonTracks = Object.values(allSearchableItems).filter(t => t.albumId === 'dream-season');
                    const nextTrackToUnlock = allDreamSeasonTracks.find(t => !unlockedDreamSeasonTracks.includes(t.id));
                    
                    if (nextTrackToUnlock) {
                        unlockedDreamSeasonTracks.push(nextTrackToUnlock.id);
                        localStorage.setItem('mmg-unlockedDreamSeason', JSON.stringify(unlockedDreamSeasonTracks));
                        localStorage.setItem('mmg-userCoins', JSON.stringify(userCoins));
                        updateCoinDisplay();
                        showDialog(`Vous avez débloqué "${nextTrackToUnlock.title}" !`);
                        handleMenuNavigation('albums-section');
                    } else {
                        showDialog("Tous les titres de cet album sont déjà débloqués !");
                    }
                } else {
                    showDialog(`Il vous faut ${COIN_COST_UNLOCK} pièces pour débloquer un titre.`);
                }
                return;
            }


            if (youtubeId) {
                const item = findItemById(itemId);
                if (!item) return;

                if (item.isUnlockable && !unlockedDreamSeasonTracks.includes(item.id)) {
                    showDialog("Ce titre est verrouillé. Débloquez-le depuis l'album 'Dream Season'.");
                    playAudio(sounds.back);
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
                playVideoWhenReady(item, playlistIds, startIndex);

            } else if (dataLink) {
                playAudio(sounds.select);
                handleMenuNavigation(dataLink);
            } else if (albumId) {
                playAudio(sounds.select);
                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                
                let titlesForAlbum;
                if (albumId === 'dream-season') {
                    titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId && unlockedDreamSeasonTracks.includes(title.id)));
                } else {
                    titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
                }

                document.getElementById('titles-section-title').textContent = siteData.contentData[activeProfile].albums[albumId].title;
                renderCards('titles-cards', titlesForAlbum, 'title');
                showSection('titles-section');
            }
        });

        contentBoard.addEventListener('mousedown', (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const titleSpan = card.querySelector('.card__title.scrolling > span');
                if (titleSpan) {
                    titleSpan.style.animationPlayState = 'paused';
                }
            }
        });
        contentBoard.addEventListener('touchstart', (e) => {
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
        
        document.getElementById('background-play-switch').addEventListener('change', (e) => {
            isBackgroundPlayEnabled = e.target.checked;
            localStorage.setItem('mmg-backgroundPlayEnabled', JSON.stringify(isBackgroundPlayEnabled));
            if (!isBackgroundPlayEnabled) {
                keepAliveAudio.pause();
            }
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
                btn.title = isAutoplayActive ? "Autoplay activé" : "Autoplay désactivé";
            });
            showDialog(isAutoplayActive ? "Lecture automatique activée" : "Lecture automatique désactivée");
            playAudio(sounds.select);
            
            if (isAutoplayActive && activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() === YT.PlayerState.ENDED) {
                playNextTrack();
            }

            updateTempPlayButtonVisibility();
        };
        document.getElementById('autoplay-toggle').addEventListener('click', toggleAutoplay);
        document.getElementById('overlay-autoplay-toggle').addEventListener('click', toggleAutoplay);


        const shareFunction = () => {
            if (!currentPlayingItem) return;
            const url = `https://www.youtube.com/watch?v=${currentPlayingItem.youtube_id}`;
            navigator.clipboard.writeText(url).then(() => showDialog('Lien copié !'))
                .catch(err => showDialog('Échec de la copie.'));
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

        const allOverlays = document.querySelectorAll('#settings-overlay, #shop-overlay, #wifi-overlay, #achievements-overlay, #tags-filter-overlay, #playlist-overlay, #player-options-overlay, #tutorial-overlay');
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
                playAudio(sounds.connecting);
                sounds.connecting.onended = () => {
                   if(activeOverlay && activeOverlay.id === 'wifi-overlay') {
                       closeOverlay(sounds.back);
                       updateAchievementProgress('patienceIsKey');
                       showDialog("Connexion réussie !");
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

        document.getElementById('settings-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('settings-overlay'), sounds.select); });
        document.getElementById('shop-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('shop-overlay'), sounds.shop); });
        document.getElementById('wifi-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('wifi-overlay'), null); });
        document.getElementById('achievements-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('achievements-overlay'), sounds.select); });
        document.getElementById('tags-filter-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('tags-filter-overlay'), sounds.select, true); });
        document.getElementById('playlist-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('playlist-overlay'), sounds.select, true); });
        document.getElementById('player-more-options-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('player-options-overlay'), sounds.select, true); });

        
        document.querySelectorAll('#settings-overlay, #shop-overlay, #wifi-overlay, #achievements-overlay, #tags-filter-overlay, #playlist-overlay, #player-options-overlay, #tutorial-overlay').forEach(overlay => {
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
                showDialog('Tous les succès ont été débloqués !');
                playAudio(sounds.achievementUnlocked);
            } else if (code === 'musicleaks') {
                const allDreamSeasonTracks = Object.values(allSearchableItems).filter(t => t.albumId === 'dream-season');
                unlockedDreamSeasonTracks = allDreamSeasonTracks.map(t => t.id);
                localStorage.setItem('mmg-unlockedDreamSeason', JSON.stringify(unlockedDreamSeasonTracks));
                input.value = '';
                showDialog('Toutes les chansons exclusives ont été débloquées !');
                playAudio(sounds.achievementUnlocked);
                if(document.getElementById('albums-section').classList.contains('hidden') === false) {
                    handleMenuNavigation('albums-section');
                }
            }
            else {
                showDialog('Code incorrect.');
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

        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('.card, .profile-tab, .top-bar-btn, #start-music-btn, #mp3-player-container i, .volume-adjust-btn, .guide-choice-btn')) {
                if (!isHovering) {
                    isHovering = true;
                    playAudio(sounds.hover);
                }
            }
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.card, .profile-tab, .top-bar-btn, #start-music-btn, #mp3-player-container i, .volume-adjust-btn, .guide-choice-btn')) {
                isHovering = false;
            }
        });

        let draggedItem = null;
        const playlistContainer = document.getElementById('playlist-container');

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
            showDialog("Playlist vidée !");
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
            { step: 1, selector: '.back-btn', text: 'Utilisez ce bouton pour revenir à l\'écran précédent.' },
            { step: 2, selector: '#home-btn', text: 'Ce bouton vous ramène à l\'accueil principal à tout moment.' },
            { step: 3, selector: '.search-bar', text: 'Recherchez un titre, un artiste, un tag, une vidéo ou un album ici.' },
            { step: 4, selector: '#tags-filter-btn', text: 'Appuyez ici pour filtrer le contenu par tags (ex: retro, pop...).' },
            { step: 5, selector: '#shop-btn', text: 'Visitez la boutique pour sélectionner des thèmes visuels que vous pouvez débloquer en remplissant les succès.' },
            { step: 6, selector: '#achievements-btn', text: 'Consultez vos succès. Gagnez des pièces en écoutant des morceaux pour débloquer du contenu exclusif !' },
            { step: 7, selector: '#settings-btn', text: "Gérez les paramètres du site, comme la musique de fond ou les effets sonores." },
            { step: 8, selector: '#wifi-btn', text: 'Un petit easter egg se cache ici... soyez patient !' },
            { step: 9, selector: '.profile-tab[data-project="mmg-music"]', text: 'Basculez entre les profils "Mmg Music"...', position: 'pos-bottom' },
            { step: 10, selector: '.profile-tab[data-project="mmg-beats"]', text: '...et "Mmg Beats" pour découvrir différents univers musicaux.', position: 'pos-bottom' },
            { step: 11, selector: '#content-cards', text: 'Naviguez à travers les différentes catégories : albums, clips, making-ofs, etc.', position: 'pos-top' },
            { step: 12, selector: '#mp3-player-container', text: 'Voici le mini-lecteur. Il apparaît dès qu\'un média (musique ou vidéo) est lancé.' },
            { step: 13, selector: '#player-album-cover', text: 'La pochette est cliquable et permet de revenir instantanément au média qui joue (musique ou vidéo) !' },
            { step: 14, selector: '#autoplay-toggle', text: 'Activez l\'autoplay pour enchaîner les médias automatiquement. Désactivez-le pour explorer le site sans interrompre la lecture en cours. (sur mobile : voir les 3 points verticaux).' },
            { step: 15, selector: '#shuffle-btn', text: 'Activez la lecture aléatoire pour mélanger les titres.' },
            { step: 16, selector: '#loop-btn', text: 'Répétez la chanson en cours avec ce bouton.' },
            { step: 17, selector: '.volume-control-new', text: 'Ajustez le volume ici (sur mobile : voir les 3 points verticaux).' },
            { step: 18, selector: '#player-like-btn', text: 'Aimez un titre pour le retrouver facilement plus tard.' },
            { step: 19, selector: '#playlist-btn', text: 'Gérez votre playlist actuelle. La playlist est activée uniquement si vous lancez un titre depuis celle-ci !' },
            { step: 20, selector: '#share-btn', text: 'Partagez le lien du média en cours (sur mobile : voir les 3 points verticaux).' },
            { step: 21, selector: '#player-more-options-btn', text: 'Sur mobile, un menu regroupe le volume, le partage et l\'autoplay pour gagner de la place.' },
        ];

        const musicTitlesTutorialSteps = [
            {
                step: 1,
                text: "Sur ordinateur, le défilement du titre s'arrête lorsque vous survolez une carte. Sur mobile, il s'arrête lorsque vous maintenez votre doigt appuyé dessus.",
                selector: () => document.querySelector('#titles-cards .card'),
                position: 'pos-bottom'
            },
            {
                step: 2,
                selector: () => document.querySelector('#titles-cards .card .like-btn-card'),
                text: "Sur chaque titre, vous pouvez utiliser ce bouton pour l'ajouter à vos favoris...",
                position: 'pos-top'
            },
            {
                step: 3,
                selector: () => document.querySelector('#titles-cards .card .add-playlist-btn-card'),
                text: "...et celui-ci pour l'ajouter à votre playlist en cours.",
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
                text: "Pour voir la pochette en grand, cliquez dessus ! (fonction désactivée au cours du guide).",
                position: 'pos-top',
                reverseAction: () => { 
                    showSection('titles-section', false);
                    document.getElementById('temp-play-btn').classList.remove('hidden');
                }
            },
            {
                step: 5,
                selector: ['#details-album-link', '#details-tags'], 
                text: "Le titre de l'album et les tags sont aussi cliquables pour naviguer vers du contenu similaire.",
                position: 'pos-top'
            },
             {
                step: 6,
                selector: '#details-add-to-playlist-btn',
                text: "Ce bouton vous permet d'ajouter directement le titre à votre playlist actuelle, sans quitter cette page.",
                position: 'pos-top'
            },
            {
                step: 7,
                selector: '#streaming-links',
                text: "Retrouvez ici tous les liens pour écouter le morceau sur vos plateformes de streaming préférées.",
                position: 'pos-top'
            },
            {
                step: 8,
                selector: '.associated-videos-panel',
                text: "Trouvez ici les contenus visuels associés, comme le clip ou le making-of.",
                position: 'pos-top'
            },
            {
                step: 9,
                selector: '#temp-play-btn',
                text: "Ce bouton apparaît uniquement quand la lecture automatique (Autoplay) est désactivée. Il vous permet de lancer directement le morceau que vous êtes en train de consulter, sans avoir à réactiver la lecture automatique puis à retourner à la liste des titres pour le sélectionner.",
                position: 'pos-top'
            },
            {
                step: 10,
                selector: ['#prev-video-btn', '#next-video-btn'], 
                text: "Quand l'Autoplay est désactivé (voir guide 1), vous pouvez changer de page en utilisant les boutons 'précédent' et 'suivant' du mini-lecteur, ou en utilisant les contrôles classiques. La musique en cours ne s'arrêtera et ne changera pas.",
                position: 'pos-top'
            },
            {
                step: 11,
                text: "Le guide est terminé. Vous pouvez le fermer, vous serez redirigé vers l'accueil.",
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
            document.getElementById('tutorial-text').textContent = step.text;
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
            dataLink = 'menu-cards-section';
        }

        if (sections[dataLink]) {
            renderCards(sections[dataLink].container, sections[dataLink].data, sections[dataLink].type);
        } else if (dataLink === 'about-section') {
            document.getElementById('about-title').textContent = `À propos de ${activeProfile === 'mmg-music' ? 'Mmg Music' : 'Mmg Beats'}`;
            const avatarUrl = activeProfile === 'mmg-music' ? 'assets/mmg-music-avatar.png' : 'assets/mmg-beats-avatar.png';
            document.getElementById('about-content').innerHTML = `<img src="${avatarUrl}" alt="Avatar"><p>${siteData.aboutContent[activeProfile]}</p>`;
        } else if (dataLink === 'liked-titles-section') {
            const likedItems = Object.fromEntries(
                [...likedSongs].map(id => [id, findItemById(id)]).filter(([, item]) => item)
            );
            document.getElementById('liked-titles-section-title').textContent = 'Titres Likés';
            renderCards('liked-titles-cards', likedItems, 'title');
        } else if (dataLink === 'menu-cards-section') {
            renderCards('content-cards', siteData.projectData[activeProfile], 'menu');
        }
        
        showSection(dataLink, updateHistory);
    }
    
    loadDataAndInitialize();
});
