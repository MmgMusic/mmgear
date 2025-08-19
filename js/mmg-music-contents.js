document.addEventListener('DOMContentLoaded', () => {

    // **FIX**: Redirect to index.html if the intro hasn't been played in this session
    if (!sessionStorage.getItem('mmg-intro-completed')) {
        window.location.href = 'index.html';
        return; // Stop script execution
    }

    // =========================================================
    // GLOBAL VARIABLES & STATE
    // =========================================================
    let siteData = {}; // Object to hold all data from JSON
    let allSearchableItems = {};

    let operatingMode = 'mobile'; // 'mobile' or 'computer'
    const BASE_WIDTH = 1600;
    const BASE_HEIGHT = 900;

    let sectionHistory = ['menu-cards-section'];
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
    let currentPlaylistIndex = -1;
    let isHovering = false; // Variable to track hover state for sound

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
            
            // Populate allSearchableItems after data is loaded
            Object.values(siteData.contentData).forEach(profile => {
                Object.entries(profile.titles).forEach(([key, val]) => val.id = key);
                Object.entries(profile.gameplay).forEach(([key, val]) => val.id = key);
                Object.entries(profile.makingofs).forEach(([key, val]) => val.id = key);
                Object.assign(allSearchableItems, profile.titles, profile.gameplay, profile.makingofs);
            });

            initializeApp();

        } catch (error) {
            console.error("Could not load site data:", error);
            const body = document.querySelector('body');
            body.innerHTML = '<h1 style="text-align: center; margin-top: 50px;">Erreur de chargement des données. Veuillez réessayer.</h1>';
        }
    }

    // =========================================================
    // YOUTUBE PLAYER & MEDIA SESSION
    // =========================================================
    
    window.onYouTubeIframeAPIReady = function() {
        const playerOptions = {
            height: '100%',
            width: '100%',
            playerVars: { 'playsinline': 1, 'autoplay': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0, 'origin': window.location.origin },
            events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
        };
        largePlayer = new YT.Player('large-player-iframe', playerOptions);
        mediumPlayer = new YT.Player('medium-player-iframe', playerOptions);
        playerInitializationComplete = true;
        if (currentPlayingItem) loadAndPlayVideo(currentPlayingItem);
    }

    function onPlayerReady(event) {
        event.target.setVolume(document.getElementById('volume-slider').value);
        setInterval(updateProgressBar, 500);
    }

    function onPlayerStateChange(event) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        
        if (event.data === YT.PlayerState.ENDED) {
            if (isPlayerLooping) {
                updateAchievementProgress('loopMaster', currentPlayingItem.id);
                event.target.seekTo(0);
                event.target.playVideo();
                return;
            }
            if (currentPlaylist.length > 0) {
                changeTrack(1);
                return;
            }
            renderVideoSuggestions();
            showSection('video-suggestions-section', true, true);
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
            resetMiniPlayerUI(); 
            currentPlayingItem = null;
            if (document.getElementById('background-music-switch').checked) {
                document.getElementById('background-music').play();
            }
        } else if (event.data === YT.PlayerState.PLAYING) {
            if (playPauseBtn) playPauseBtn.className = 'fas fa-pause';
            document.getElementById('background-music').pause();

            if (isResumingFromOverlay) {
                isResumingFromOverlay = false; 
                return; 
            }
            
            if(document.getElementById('video-suggestions-section').style.display !== 'none') {
                showSection(isMusicTitle(currentPlayingItem) ? 'music-title-details-section' : 'large-player-section');
            }
        } else if (event.data === YT.PlayerState.PAUSED) {
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
        }
    }

    function playVideoWhenReady(item, playlist = [], index = -1) {
        if (!item) return;
        currentPlayingItem = item;
        currentPlaylist = playlist;
        currentPlaylistIndex = index;

        if (playerInitializationComplete) {
            loadAndPlayVideo(item);
        } else {
            showDialog("Chargement du lecteur vidéo...");
        }
    }

    function loadAndPlayVideo(item) {
        currentPlayingItem = item;
        const musicTitle = isMusicTitle(item);
    
        activePlayer = musicTitle ? mediumPlayer : largePlayer;
        const inactivePlayer = musicTitle ? largePlayer : mediumPlayer;
        if (inactivePlayer && typeof inactivePlayer.stopVideo === 'function') inactivePlayer.stopVideo();
        
        updateMp3PlayerInfo(item);
        updateLikeButtonUI(item.id);
        updateMediaSession(item);

        if (item.tags && item.tags.includes('retro')) {
            updateAchievementProgress('retroPlayer', item.id);
        }
        if (item.tags && item.tags.includes('playstation')) {
            updateAchievementProgress('psPlayer', item.id);
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
            artwork: [{ src: item.image, sizes: '512x512', type: 'image/png' }]
        });

        navigator.mediaSession.setActionHandler('play', () => { if(activePlayer) activePlayer.playVideo() });
        navigator.mediaSession.setActionHandler('pause', () => { if(activePlayer) activePlayer.pauseVideo() });
        navigator.mediaSession.setActionHandler('previoustrack', () => changeTrack(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => changeTrack(1));
    }

    function findItemById(id) {
        return allSearchableItems[id] || null;
    }

    function isMusicTitle(item) {
        return item && item.albumId && item.year;
    }

    // =========================================================
    // LIKES & ACHIEVEMENTS
    // =========================================================
    function initUserData() {
        const storedLikes = localStorage.getItem('mmg-likedSongs');
        likedSongs = storedLikes ? new Set(JSON.parse(storedLikes)) : new Set();

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

        renderAchievements();
        updateShopLocksAndSelection();
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
            achievements[id].unlocked = true;
        });
        localStorage.setItem('mmg-achievements', JSON.stringify(achievements));
        playAudio(sounds.achievementUnlocked);
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
                progressValue = Math.max(0, ...Object.values(ach.progress)) / ach.goal;
            } else if (id === 'retroPlayer' || id === 'psPlayer') {
                progressValue = ach.progress.length / ach.goal;
            } else if (id === 'patienceIsKey') {
                progressValue = ach.progress / ach.goal;
            }
            progressValue = Math.min(1, progressValue) * 100;

            const item = document.createElement('div');
            item.className = `achievement-item ${ach.unlocked ? 'unlocked' : ''}`;
            item.innerHTML = `
                <div class="achievement-icon"><i class="fas ${ach.icon}"></i></div>
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

            if (achievementId && achievements[achievementId] && !achievements[achievementId].unlocked) {
                btn.classList.add('locked');
                btn.classList.remove('selected');
                btn.innerHTML = `<i class="fas fa-lock"></i> ${achievements[achievementId]?.title || ''}`;
                btn.disabled = true;
            } else {
                btn.classList.remove('locked');
                btn.disabled = false;
                if (themeId === currentTheme) {
                    btn.innerHTML = '✔';
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
        
        const cardLikeIcon = document.querySelector(`.card[data-item-id="${itemId}"] .like-btn`);
        if (cardLikeIcon) {
            const isLiked = likedSongs.has(itemId);
            cardLikeIcon.classList.toggle('active', isLiked);
            cardLikeIcon.classList.toggle('fas', isLiked);
            cardLikeIcon.classList.toggle('far', !isLiked);
        }

        if (!document.getElementById('liked-titles-section').classList.contains('hidden')) {
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

    // =========================================================
    // UI & GENERAL FUNCTIONS
    // =========================================================
    function playAudio(audioElement) {
        if (audioElement) {
            audioElement.currentTime = 0;
            audioElement.play().catch(error => {});
        }
    }

    function updateTime() {
        document.getElementById('real-time').textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function renderCards(containerId, cardsData, cardType = 'generic') {
        const container = document.getElementById(containerId);
        if (!container) return;
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
            
            let datasetAttributes = '';
            if (cardType === 'title' || cardType === 'video' || cardType === 'search') {
                datasetAttributes = `data-youtube-id="${item.youtube_id}"`;
            } else if (cardType === 'album') {
                 datasetAttributes = `data-album-id="${item.id}"`;
            } else if (cardType === 'menu') {
                datasetAttributes = `data-link="${item.link}"`;
            }

            const imagePath = item.image || 'https://placehold.co/200x120/9E9E9E/FFFFFF?text=No+Image';
            const badgeHtml = item.loopable ? `<div class="card__badge">LOOP ME!</div>` : '';
            const isLiked = likedSongs.has(itemId);
            
            const likeButtonHtml = (cardType === 'title' || cardType === 'video' || cardType === 'search') 
                ? `<i class="like-btn ${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'active' : ''}" data-like-id="${itemId}"></i>` : '';

            let description = '';
            switch(cardType) {
                case 'title': description = item.description || 'Écouter ce titre'; break;
                case 'album': description = 'Parcourir l\'album'; break;
                case 'video': description = 'Voir la vidéo'; break;
                case 'menu': description = 'Ouvrir la section'; break;
                case 'search': description = item.year ? 'Titre musical' : 'Vidéo ou Making-of'; break;
                default: description = 'Voir le contenu';
            }
            
            if (description.length > 50) {
                description = description.substring(0, 47) + '...';
            }

            card.innerHTML = `
              <a href="#" class="card-link-wrapper" ${datasetAttributes}>
                <div class="card-inner">
                  <div class="card__liquid"></div>
                  <div class="card__shine"></div>
                  <div class="card__glow"></div>
                  ${likeButtonHtml}
                  <div class="card__content">
                    ${badgeHtml}
                    <div class="card__image" style="background-image: url('${imagePath.replace(/'/g, "\\'")}');"></div>
                    <div class="card__text">
                      <p class="card__title">${item.title}</p>
                      <p class="card__description">${description}</p>
                    </div>
                  </div>
                </div>
              </a>
            `;
            container.appendChild(card);
        });
    }

    function renderMusicTitleDetails(item) {
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        const album = siteData.contentData[activeProfile].albums[item.albumId];
        document.getElementById('details-album-art').src = item.image;
        document.getElementById('details-title').textContent = item.title;
        const albumSpan = document.getElementById('details-album');
        albumSpan.textContent = album ? album.title : 'Inconnu';
        albumSpan.parentElement.dataset.albumId = item.albumId;
        document.getElementById('details-year').textContent = item.year;
        document.getElementById('details-description').textContent = item.description;
        document.getElementById('details-tags').innerHTML = (item.tags || []).map(tag => `<span class="tag-item" data-tag="${tag}">${tag}</span>`).join('');

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
                if (platformConfig[platform] && id && id !== '#') {
                    const link = document.createElement('a');
                    link.href = platformConfig[platform].base_url + id;
                    link.target = '_blank';
                    link.title = `Écouter sur ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
                    link.innerHTML = `<i class="${platformConfig[platform].icon}"></i>`;
                    streamingContainer.appendChild(link);
                }
            }
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
        const container = document.getElementById('mp3-player-container');
        if (item && item.title) {
            container.classList.remove('hidden');
            document.getElementById('song-title').textContent = item.title;
            document.getElementById('player-album-cover').src = item.image || ''; 
            updateLikeButtonUI(item.id);
        } else {
            container.classList.add('hidden');
        }
    }
    
    function resetMiniPlayerUI() {
        document.getElementById('mp3-player-container').classList.add('hidden');
        document.getElementById('progress-fill').style.width = '0%';
    }

    function updateProgressBar() {
        if (!activePlayer || typeof activePlayer.getCurrentTime !== 'function' || !currentPlayingItem) return;
        const duration = activePlayer.getDuration();
        if (duration > 0) {
            document.getElementById('progress-fill').style.width = `${(activePlayer.getCurrentTime() / duration) * 100}%`;
        }
    }

    function showSection(sectionId, updateHistory = true, keepPlayerVisible = false) {
        if (!keepPlayerVisible) {
            document.querySelectorAll('.content-section-board .page-section').forEach(s => s.classList.add('hidden'));
        } else {
            document.querySelectorAll('.content-section-board .page-section:not(#large-player-section):not(#music-title-details-section)').forEach(s => s.classList.add('hidden'));
        }
        document.getElementById(sectionId)?.classList.remove('hidden');
        if (updateHistory && sectionHistory[sectionHistory.length - 1] !== sectionId && sectionId !== 'video-suggestions-section') {
            sectionHistory.push(sectionId);
        }
    }
    
    function updateVisibleCards() {
        const query = document.getElementById('search-input').value.toLowerCase().trim();
        const checkedTags = Array.from(document.querySelectorAll('#tags-filter-list input:checked')).map(cb => cb.value);

        if (query === '' && checkedTags.length === 0) {
            if (!document.getElementById('search-results-section').classList.contains('hidden')) {
                resetToHome(); 
            }
            return;
        }

        const filteredResults = Object.fromEntries(Object.entries(allSearchableItems).filter(([key, item]) => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const itemTags = (item.tags || []).map(t => t.toLowerCase());
            const tagsMatch = checkedTags.length === 0 || checkedTags.every(tag => itemTags.includes(tag));
            return titleMatch && tagsMatch;
        }));
        
        showSection('search-results-section');
        renderCards('search-results-cards', filteredResults, 'search');
    }

    function setupTagFilters() {
        const allTags = new Set(Object.values(allSearchableItems).flatMap(item => item.tags || []));
        const container = document.getElementById('tags-filter-list');
        container.innerHTML = '';
        Array.from(allTags).sort().forEach(tag => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.innerHTML = `<input type="checkbox" id="tag-${tag}" value="${tag.toLowerCase()}"><label for="tag-${tag}">${tag}</label>`;
            container.appendChild(checkboxDiv);
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
        if (operatingMode === 'computer') {
            document.body.classList.add('computer-mode');
        }
        const isDark = localStorage.getItem('theme') === 'dark';
        if (isDark) document.body.classList.add('dark-theme');
        if (themeName && themeName !== 'default') {
            document.body.classList.add(themeName);
        }
        localStorage.setItem('ui-theme', themeName);
        updateShopLocksAndSelection();
    }

    function resetToHome() {
        playAudio(sounds.select);
        showSection('menu-cards-section');
        sectionHistory = ['menu-cards-section'];
        const activeProject = document.querySelector('.profile-tab.active').dataset.project;
        renderCards('content-cards', siteData.projectData[activeProject], 'menu');
    }

    function scaleComputerLayout() {
        if (operatingMode !== 'computer') return;

        const mainContent = document.getElementById('main-content-wrapper');
        const { innerWidth: vw, innerHeight: vh } = window;

        const scaleX = vw / BASE_WIDTH;
        const scaleY = vh / BASE_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        mainContent.style.transform = `scale(${scale})`;
    }

    // =========================================================
    // INITIALIZATION (called after data is loaded)
    // =========================================================
    function initializeApp() {
        initUserData();
        renderCards('content-cards', siteData.projectData['mmg-music'], 'menu');
        resetMiniPlayerUI();
        setupTagFilters();
        updateTime();
        setInterval(updateTime, 30000);
        
        const savedTheme = localStorage.getItem('theme') || 'light';
        const savedUiTheme = localStorage.getItem('ui-theme') || 'default';
        document.getElementById('theme-switch').checked = savedTheme === 'dark';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');
        applyTheme(savedUiTheme);
        
        setupEventListeners();
    }

    // =========================================================
    // EVENT LISTENERS
    // =========================================================
    
    function startApplication() {
        // **FIX**: The intro is done, and the app is starting.
        // Remove the flag so a refresh will redirect to index.html as requested.
        sessionStorage.removeItem('mmg-intro-completed');

        if (document.getElementById('background-music-switch').checked) {
            document.getElementById('background-music').play().catch(()=>{});
        }
        const modeScreen = document.getElementById('mode-selection-screen');
        modeScreen.classList.add('fade-out');
        setTimeout(() => {
            modeScreen.style.display = 'none';
            document.getElementById('main-content-wrapper').classList.remove('hidden');
        }, 500);
    }
    
    function setupEventListeners() {
        document.getElementById('start-computer-btn').addEventListener('click', () => {
            operatingMode = 'computer';
            document.body.classList.add('computer-mode');
            const mainWrapper = document.getElementById('main-content-wrapper');
            mainWrapper.style.width = `${BASE_WIDTH}px`;
            mainWrapper.style.height = `${BASE_HEIGHT}px`;
            scaleComputerLayout();
            window.addEventListener('resize', scaleComputerLayout);
            startApplication();
        });

        document.getElementById('start-mobile-btn').addEventListener('click', () => {
            operatingMode = 'mobile';
            startApplication();
        });

        document.querySelector('.back-btn').addEventListener('click', (e) => {
            e.preventDefault();
            playAudio(sounds.back);
            if (sectionHistory.length > 1) {
                sectionHistory.pop();
                showSection(sectionHistory[sectionHistory.length - 1], false);
            }
        });

        document.getElementById('home-btn').addEventListener('click', (e) => {
            e.preventDefault();
            resetToHome();
        });

        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                resetToHome();
            });
        });
        
        document.querySelector('.content-section-board').addEventListener('click', (e) => {
            const likeBtn = e.target.closest('.like-btn');
            if (likeBtn) {
                e.preventDefault();
                e.stopPropagation();
                toggleLike(likeBtn.dataset.likeId);
                return;
            }
            
            const tagElement = e.target.closest('.tag-item');
            if(tagElement) {
                e.preventDefault();
                e.stopPropagation();
                const tag = tagElement.dataset.tag;
                document.getElementById('search-input').value = '';
                document.querySelectorAll('#tags-filter-list input').forEach(cb => cb.checked = false);
                const tagCheckbox = document.getElementById(`tag-${tag}`);
                if (tagCheckbox) {
                    tagCheckbox.checked = true;
                }
                updateVisibleCards();
                return;
            }

            const link = e.target.closest('a.card-link-wrapper');
            if (!link) return;
            e.preventDefault();

            const { youtubeId, link: dataLink, albumId } = link.dataset;
            const cardElement = link.closest('.card');
            const itemId = cardElement.dataset.itemId;

            if (youtubeId) {
                playAudio(sounds.select);
                const item = findItemById(itemId);
                if (!item) return;

                const parentContainer = cardElement.parentElement;
                let playlist = [];
                let startIndex = -1;

                if (parentContainer) {
                    const allCardsInContainer = Array.from(parentContainer.querySelectorAll('.card'));
                    playlist = allCardsInContainer
                        .map(card => findItemById(card.dataset.itemId))
                        .filter(Boolean);
                    startIndex = playlist.findIndex(pItem => pItem.id === item.id);
                }
                
                playVideoWhenReady(item, playlist, startIndex);

            } else if (dataLink) {
                playAudio(sounds.select);
                handleMenuNavigation(dataLink);
            } else if (albumId) {
                playAudio(sounds.select);
                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                const titlesForAlbum = Object.fromEntries(Object.entries(siteData.contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
                document.getElementById('titles-section-title').textContent = siteData.contentData[activeProfile].albums[albumId].title;
                renderCards('titles-cards', titlesForAlbum, 'title');
                showSection('titles-section');
            }
        });

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

        document.getElementById('player-album-cover').addEventListener('click', () => {
            if (currentPlayingItem) {
                playAudio(sounds.select);
                showSection(isMusicTitle(currentPlayingItem) ? 'music-title-details-section' : 'large-player-section');
            }
        });

        document.getElementById('search-input').addEventListener('input', updateVisibleCards);
        document.getElementById('tags-filter-list').addEventListener('change', updateVisibleCards);
        
        document.getElementById('theme-switch').addEventListener('change', (e) => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            playAudio(e.target.checked ? sounds.switchToBlack : sounds.switchToWhite);
            localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
        });
        
        document.getElementById('play-pause-btn').addEventListener('click', () => {
            if (!activePlayer || !currentPlayingItem) return;
            playAudio(sounds.select);
            const state = activePlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) activePlayer.pauseVideo();
            else activePlayer.playVideo();
        });

        const changeTrack = (direction) => {
            if (currentPlaylist.length === 0) {
                if (currentPlayingItem && currentPlayingItem.albumId) {
                    const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
                    const albumTitles = Object.values(siteData.contentData[activeProfile].titles).filter(t => t.albumId === currentPlayingItem.albumId);
                    const currentIndex = albumTitles.findIndex(item => item.id === currentPlayingItem.id);
                    if (currentIndex === -1) return;
                    const nextIndex = (currentIndex + direction + albumTitles.length) % albumTitles.length;
                    playVideoWhenReady(albumTitles[nextIndex], albumTitles, nextIndex);
                }
                return;
            }

            playAudio(sounds.select);
            let nextIndex;
            if (isShuffleMode) {
                nextIndex = Math.floor(Math.random() * currentPlaylist.length);
                if (currentPlaylist.length > 1 && nextIndex === currentPlaylistIndex) {
                    nextIndex = (nextIndex + 1) % currentPlaylist.length;
                }
            } else {
                nextIndex = (currentPlaylistIndex + direction + currentPlaylist.length) % currentPlaylist.length;
            }
            
            const nextItem = currentPlaylist[nextIndex];
            if (nextItem) {
                playVideoWhenReady(nextItem, currentPlaylist, nextIndex);
            }
        };

        document.getElementById('next-video-btn').addEventListener('click', () => changeTrack(1));
        document.getElementById('prev-video-btn').addEventListener('click', () => changeTrack(-1));
        
        document.getElementById('loop-btn').addEventListener('click', (e) => {
            isPlayerLooping = !isPlayerLooping;
            e.target.classList.toggle('active', isPlayerLooping);
            playAudio(sounds.select);
            if (isPlayerLooping) {
                isShuffleMode = false;
                document.getElementById('shuffle-btn').classList.remove('active');
            }
        });

        document.getElementById('shuffle-btn').addEventListener('click', (e) => {
            isShuffleMode = !isShuffleMode;
            e.target.classList.toggle('active', isShuffleMode);
            playAudio(sounds.select);
            if (isShuffleMode) {
                isPlayerLooping = false;
                document.getElementById('loop-btn').classList.remove('active');
            }
        });
        
        document.getElementById('share-btn').addEventListener('click', () => {
            if (!currentPlayingItem) return;
            const url = `https://www.youtube.com/watch?v=${currentPlayingItem.youtube_id}`;
            navigator.clipboard.writeText(url).then(() => showDialog('Lien copié !'))
                .catch(err => showDialog('Échec de la copie.'));
        });

        document.getElementById('player-like-btn').addEventListener('click', (e) => {
            if(currentPlayingItem) toggleLike(currentPlayingItem.id);
        });

        document.getElementById('progress-bar').addEventListener('click', (e) => {
            if (activePlayer && typeof activePlayer.getDuration === 'function') {
                const rect = e.currentTarget.getBoundingClientRect();
                activePlayer.seekTo(((e.clientX - rect.left) / rect.width) * activePlayer.getDuration(), true);
            }
        });

        document.getElementById('volume-slider').addEventListener('input', (e) => {
            const volume = e.target.value;
            if (largePlayer?.setVolume) largePlayer.setVolume(volume);
            if (mediumPlayer?.setVolume) mediumPlayer.setVolume(volume);
            Object.values(sounds).forEach(sound => { if (sound) sound.volume = volume / 100; });
        });

        const allOverlays = document.querySelectorAll('#settings-overlay, #shop-overlay, #wifi-overlay, #achievements-overlay, #tags-filter-overlay');
        let activeOverlay = null;

        function openOverlay(overlay, sound) {
            if (activeOverlay === overlay) return;

            if (overlay.id !== 'tags-filter-overlay') {
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

            if (pausedForOverlay) {
                if(activePlayer) {
                    isResumingFromOverlay = true;
                    activePlayer.playVideo();
                }
            } else if (document.getElementById('background-music-switch').checked && (!currentPlayingItem || (activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() !== 1))) {
                document.getElementById('background-music').play();
            }
            pausedForOverlay = false;
        }

        document.getElementById('settings-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('settings-overlay'), sounds.select); });
        document.getElementById('shop-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('shop-overlay'), sounds.shop); });
        document.getElementById('wifi-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('wifi-overlay'), null); });
        document.getElementById('achievements-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('achievements-overlay'), sounds.select); });
        document.getElementById('tags-filter-btn').addEventListener('click', (e) => { e.preventDefault(); openOverlay(document.getElementById('tags-filter-overlay'), sounds.select); });
        
        allOverlays.forEach(overlay => {
            overlay.querySelector('.close-btn').addEventListener('click', () => closeOverlay(sounds.back));
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
            if (input.value.toUpperCase() === 'GAMESHARK') {
                unlockAllAchievements();
                input.value = '';
                showDialog('Tous les succès ont été débloqués !');
            } else {
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
            if (e.target.closest('.card, .profile-tab, .top-bar-btn, .start-choice-btn, #mp3-player-container i')) {
                if (!isHovering) {
                    isHovering = true;
                    playAudio(sounds.hover);
                }
            }
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.card, .profile-tab, .top-bar-btn, .start-choice-btn, #mp3-player-container i')) {
                isHovering = false;
            }
        });


        // Tutorial Logic
        const tutorialSteps = [
            { selector: '.profile-tab[data-project="mmg-music"]', text: 'Bascule entre les profils "Mmg Music"...' },
            { selector: '.profile-tab[data-project="mmg-beats"]', text: '...et "Mmg Beats" pour découvrir différents styles.' },
            { selector: '#content-cards', text: 'Navigue à travers les différentes sections comme les albums, les clips ou les making-ofs.' },
            { selector: '.search-bar', text: 'Utilise la recherche pour trouver un titre spécifique.' },
            { selector: '#tags-filter-btn', text: 'Filtre le contenu par tags pour affiner ta recherche.' },
            { selector: '#mp3-player-container', text: 'Contrôle la musique ici. La pochette est cliquable pour revenir au lecteur !' },
            { selector: '#achievements-btn', text: 'Consulte et débloque des succès pour gagner des récompenses.' },
            { selector: '#shop-btn', text: 'Visite la boutique pour débloquer de nouveaux thèmes graphiques !' },
            { selector: '.theme-switcher-footer', text: 'Change le thème visuel de l\'application (clair/sombre).' },
            { selector: '#wifi-btn', text: 'Un peu de patience ? Clique sur le bouton Wi-Fi et attends la surprise.'}
        ];
        let currentStep = 0;
        let highlightedElement = null;

        function showTutorialStep(stepIndex) {
            if (highlightedElement) {
                highlightedElement.classList.remove('tutorial-highlight');
                highlightedElement = null;
            }

            if (stepIndex < 0 || stepIndex >= tutorialSteps.length) {
                endTutorial();
                return;
            }

            currentStep = stepIndex;
            const step = tutorialSteps[stepIndex];
            let targetElement = document.querySelector(step.selector);
            
            // If element is not visible, skip to next step
            if (!targetElement || targetElement.offsetParent === null) {
                showTutorialStep(stepIndex + (stepIndex > currentStep ? 1 : -1)); // Go in the same direction
                return;
            }

            highlightedElement = targetElement;
            targetElement.classList.add('tutorial-highlight');
            
            const tutorialBox = document.getElementById('tutorial-box');
            document.getElementById('tutorial-text').textContent = step.text;
            
            const rect = targetElement.getBoundingClientRect();
            const boxRect = tutorialBox.getBoundingClientRect();
            const viewport = { width: window.innerWidth, height: window.innerHeight };

            let top = rect.bottom + 15;
            let left = rect.left + rect.width / 2;

            // Adjust position to stay in viewport
            if (top + boxRect.height > viewport.height) {
                top = rect.top - boxRect.height - 15;
            }
            if (left + boxRect.width / 2 > viewport.width) {
                left = viewport.width - boxRect.width / 2 - 10;
            }
            if (left - boxRect.width / 2 < 0) {
                left = boxRect.width / 2 + 10;
            }

            tutorialBox.style.top = `${top}px`;
            tutorialBox.style.left = `${left}px`;
            tutorialBox.style.transform = 'translateX(-50%)';

            document.getElementById('tutorial-overlay').classList.remove('hidden');
            document.getElementById('tutorial-prev').style.display = stepIndex === 0 ? 'none' : 'flex';
            document.getElementById('tutorial-next').textContent = stepIndex === tutorialSteps.length - 1 ? 'Terminer' : 'Suivant';
        }

        function endTutorial() {
            if (highlightedElement) {
                highlightedElement.classList.remove('tutorial-highlight');
                highlightedElement = null;
            }
            document.getElementById('tutorial-overlay').classList.add('hidden');
        }

        document.getElementById('guide-btn').addEventListener('click', () => { playAudio(sounds.select); showTutorialStep(0); });
        document.getElementById('tutorial-next').addEventListener('click', () => showTutorialStep(currentStep + 1));
        document.getElementById('tutorial-prev').addEventListener('click', () => showTutorialStep(currentStep - 1));
        document.getElementById('tutorial-close').addEventListener('click', endTutorial);
    }

    function handleMenuNavigation(dataLink) {
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
        const profileContent = siteData.contentData[activeProfile];
        const sections = {
            'albums-section': { data: profileContent.albums, type: 'album', container: 'albums-cards' },
            'gameplay-section': { data: profileContent.gameplay, type: 'video', container: 'gameplay-cards' }, 
            'makingofs-section': { data: profileContent.makingofs, type: 'video', container: 'makingofs-cards' },
        };
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
        }
        showSection(dataLink);
    }
    
    // Start loading data
    loadDataAndInitialize();
});
