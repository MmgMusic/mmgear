document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // DATA
    // =========================================================
    const projectData = {
        'mmg-music': {
            'card1': { 'title': 'Albums', 'image': 'assets/mmg-titles.png', 'link': 'albums-section' },
            'card2': { 'title': 'Clips Vidéos', 'image': 'assets/mmg-videos.png', 'link': 'gameplay-section' },
            'card3': { 'title': 'Making-Ofs', 'image': 'assets/mmg-makingofs.png', 'link': 'makingofs-section' },
            'card4': { 'title': 'Titres Likés', 'image': 'https://via.placeholder.com/240x300/E91E63/FFFFFF?text=♥', 'link': 'liked-titles-section' },
            'card5': { 'title': 'À Propos', 'image': 'assets/mmg-music-avatar.png', 'link': 'about-section' }
        },
        'mmg-beats': {
            'card1': { 'title': 'Albums Beats', 'image': 'https://via.placeholder.com/200x120/FFC107/FFFFFF?text=Beats+Albums', 'link': 'albums-section' },
            'card2': { 'title': 'Vidéos Beats', 'image': 'https://via.placeholder.com/200x120/E91E63/FFFFFF?text=Beats+Videos', 'link': 'gameplay-section' },
            'card3': { 'title': 'Making-Ofs Beats', 'image': 'https://via.placeholder.com/200x120/673AB7/FFFFFF?text=Beats+Making-Ofs', 'link': 'makingofs-section' },
            'card4': { 'title': 'À Propos', 'image': 'assets/mmg-beats-avatar.png', 'link': 'about-section' }
        }
    };

    const contentData = {
        'mmg-music': {
            albums: {
                'album1': { 'id': 'album1', 'title': 'The Mmg Game Collection', 'image': 'assets/Pochette-TheMmgGameCollection.jpg' },
                'album2': { 'id': 'album2', 'title': 'The Red Drum Vol.1', 'image': 'assets/Pochette-TheRedDrumVol1.jpg' }
            },
            titles: {
                'title1': { 'id': 'title1', 'title': 'Wiikend Sports (Loop Me!)', 'image': 'assets/Pochette-WiikendSports(LoopMe!).jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Inspiré par les thèmes joyeux et entraînants des jeux de sport Nintendo.', 'tags': ['chill', 'retro'], 'youtube_id': '-fb9BIrjEl4', 'loopable': true },
                'title2': { 'id': 'title2', 'title': 'Cheap Cheep Beach', 'image': 'assets/Pochette-CheapCheepBeach.jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Une ambiance de plage ensoleillée avec des percussions latines.', 'tags': ['latin', 'chill'], 'youtube_id': 'wJrin0ElUvM' },
                'title4': { 'id': 'title4', 'title': 'Shop (Loop Me!)', 'image': 'assets/Pochette-Shop(LoopMe!).jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Un thème de magasin classique, parfait pour faire des achats virtuels.', 'tags': ['latin', 'chill'], 'youtube_id': 'NotA1u0t7CM', 'loopable': true },
                'title5': { 'id': 'title5', 'title': 'Harvest', 'image': 'assets/Pochette-Harvest.jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Une mélodie douce et apaisante qui rappelle les joies simples de la campagne.', 'tags': ['pop', 'chill'], 'youtube_id': 'BWNiQtR3GYk' },
                'title6': { 'id': 'title6', 'title': 'Woods Of Wonder', 'image': 'assets/Pochette-WoodsOfWonder.jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Une track mystérieuse pour des forêts enchantées.', 'tags': ['mysterious'], 'youtube_id': 'XJA2nJ2sk6g' },
                'title7': { 'id': 'title7', 'title': 'Spotimon (Night Version)', 'image': 'assets/Pochette-Spotimon(NightVersion).jpg', 'albumId': 'album1', 'year': '2024', 'description': 'La version nocturne et relaxante du thème de Spotimon.', 'tags': ['pop', 'chill'], 'youtube_id': 'SccxT_6hm-o' },
                'title8': { 'id': 'title8', 'title': 'Internet Browser', 'image': 'assets/Pochette-InternetBrowser.jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Un son nostalgique qui capture l\'ère de l\'exploration web des années 2000.', 'tags': ['frutiger aero', 'chill', 'retro'], 'youtube_id': 'NJeVQ_dRQ-I' },
                'title9': { 'id': 'title9', 'title': 'Racing', 'image': 'assets/Pochette-Racing.jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Un son DnB rapide pour une course effrénée.', 'tags': ['drum and bass'], 'youtube_id': 'Fda9rYjeDL0' },
                'title10': { 'id': 'title10', 'title': 'Kart 1', 'image': 'assets/Pochette-Kart 1.jpg', 'albumId': 'album1', 'year': '2024', 'description': 'La première track pour un jeu de karting.', 'tags': ['drum and bass'], 'youtube_id': 'xmTduj2PWKc' },
                'title11': { 'id': 'title11', 'title': 'Kong (Loop Me!)', 'image': 'assets/Pochette-Kong(LoopMe!).jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Une ambiance de jungle entrainante inspirée de Donkey Kong.', 'tags': ['ethnic', 'pop'], 'youtube_id': '_UfcPulKiI4', 'loopable': true },
                'title12': { 'id': 'title12', 'title': 'Spotimon (Jade Version)', 'image': 'assets/Pochette-Spotimon(JadeVersion).jpg', 'albumId': 'album1', 'year': '2025', 'description': 'La version Jade du thème de Spotimon.', 'tags': ['latin', 'chill'], 'youtube_id': 'wgpJ-d1OhCk' },
                'title13': { 'id': 'title13', 'title': 'Spotimon (Radiant Jade Version)', 'image': 'assets/Pochette-Spotimon(RadiantJadeVersion).jpg', 'albumId': 'album1', 'year': '2025', 'description': 'La version alternative et radieuse du thème de Spotimon Jade.', 'tags': ['latin', 'chill'], 'youtube_id': 'AHuq8AF8rBc' },
                'title14': { 'id': 'title14', 'title': 'Space Racer 2000', 'image': 'assets/Pochette-SpaceRacer2000.jpg', 'albumId': 'album1', 'year': '2025', 'description': 'Un son DnB intelligent pour les courses futuristes.', 'tags': ['drum and bass', 'retro'], 'youtube_id': 'sjky3GcV7KY' },
                'title15': { 'id': 'title15', 'title': 'Spooky Mansion', 'image': 'assets/Pochette-SpookyMansion.jpg', 'albumId': 'album1', 'year': '2025', 'description': 'Une ambiance de manoir hanté, à la Luigi\'s Mansion.', 'tags': ['mysterious'], 'youtube_id': 'gUovlLGi3uM' },
                'title16': { 'id': 'title16', 'title': 'Kart World (Loop Me!)', 'image': 'assets/Pochette-KartWorld.jpg', 'albumId': 'album1', 'year': '2025', 'description': 'Le thème principal d\'un jeu de karting.', 'tags': ['drum and bass', 'chill'], 'youtube_id': 'iXEBDQuq_jU', 'loopable': true },
                'title17': { 'id': 'title17', 'title': 'Super Mmg Bros (Underwater)', 'image': 'assets/Pochette-NewSuperMmgBros(Underwater).jpg', 'albumId': 'album1', 'year': '2025', 'description': 'Une valse aquatique inspirée de Mario.', 'tags': ['waltz', 'chill'], 'youtube_id': '9ROH6sTcnCA' },
                'title18': { 'id': 'title18', 'title': 'La Rencontre', 'image': 'assets/Pochette-TheRedDrumVol1.jpg', 'albumId': 'album2', 'year': '2023', 'description': 'Une composition jazz mystérieuse, comme la bande-son d\'un film noir.', 'tags': ['jazz', 'mysterious', 'movie', 'chill'], 'youtube_id': '6LQ0bV8EcxM' },
            },
            gameplay: {
                'video1': { 'id': 'video1', 'title': 'I made a new Mario Kart Wii Rainbow Road theme (including start + end fanfares & results !)', 'image': 'assets/Miniature-KartWorld(LoopMe!).jpg', 'tags': ['drum and bass', 'gameplay'], 'youtube_id': '7jtH8hy7C3c' },
                'video2': { 'id': 'video2', 'title': 'I made a new Donkey Kong Country track (DKCR/DKCTF style)', 'image': 'assets/Miniature-Kong(LoopMe!).jpg', 'tags': ['ethnic', 'pop', 'gameplay'], 'youtube_id': 'tqCzklXDuJ8' },
                'video3': { 'id': 'video3', 'title': 'I made two new pokemon city themes (DPPt & BDSP style !)', 'image': 'assets/mmg-videos.jpg', 'tags': ['latin', 'chill', 'gameplay'], 'youtube_id': 'QTlqJ1LsuDE' },
                'video4': { 'id': 'video4', 'title': 'I made a low-poly racing game track (PS1, PS2 style (Intelligent DnB)', 'image': 'assets/Miniature-SpaceRacer2000.jpg', 'tags': ['drum and bass', 'gameplay', 'retro'], 'youtube_id': 'sZmv4Tn8GQQ' },
                'video5': { 'id': 'video5', 'title': 'I made a new Wii Sports track (Loop Me!)', 'image': 'assets/mmg-videos.jpg', 'tags': ['ethnic', 'pop', 'gameplay', 'retro'], 'youtube_id': '2yDgfrqqmHo' },
                'video6': { 'id': 'video6', 'title': "I made a new Luigi's Mansion track", 'image': 'assets/Miniature-SpookyMansion.jpg', 'tags': ['mysterious', 'gameplay'], 'youtube_id': 'kle9Eu40lTI' },
                'video7': { 'id': 'video7', 'title': 'I made a new Mario Kart World - Main Menu Character & Kart Select theme', 'image': 'assets/Miniature-KartWorld(LoopMe!).jpg', 'tags': ['drum and bass', 'chill', 'gameplay'], 'youtube_id': 'rgAnklhbk1o' },
                'video8': { 'id': 'video8', 'title': 'I made a new New Super Mario Bros. Wii Underwater theme !', 'image': 'assets/Miniature-SuperMmgBros(LoopMe!).jpg', 'tags': ['waltz', 'chill', 'gameplay'], 'youtube_id': 'BVQj_Yxj35w' },
                'video9': { 'id': 'video9', 'title': 'The Red Drum Vol. 1 (Full EP)', 'image': 'assets/Miniature-TheRedDrumVol1(FullEP).jpg', 'tags': ['Full EP'], 'youtube_id': 'xyL27CKckmI' },
            },
            makingofs: { 
                'makingof1': { 'id': 'makingof1', 'title': 'Behind the scenes', 'image': 'assets/mmg-makingofs.png', 'tags': ['studio', 'making of'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_1' } 
            }
        },
        'mmg-beats': {
            albums: {
                'album1': { 'id': 'album1', 'title': 'The Aventador Files', 'image': 'assets/Pochette-TheAventadorFiles.jpg' }
            },
            titles: { 
                'beat1': { 'id': 'beat1', 'title': 'Aventador 2', 'image': 'assets/Pochette-TheAventadorFiles.jpg', 'albumId': 'album1', 'year': '2024', 'description': 'Une prod trap puissante dans le style de Zaytoven.', 'tags': ['trap', 'zaytoven'], 'youtube_id': 'G-kU42sCmso' },
            },
            gameplay: {},
            makingofs: {}
        }
    };

    const aboutContent = { 
        'mmg-music': "Salut, c'est Mmg. J'ai eu la chance de travailler avec des artistes comme Koba LaD et F430, et même pour le film 'L'École Est à Nous'. Maintenant, je sors mes propres morceaux. Sur ce profil, attends-toi à de la funk, du jazz, de la pop, de la musique de jeu vidéo, et bien plus !", 
        'mmg-beats': "Salut, c'est Mmg. Sur ce profil, je me concentre sur le hip-hop : Trap, Boombap, RnB, et Pop. Découvre mes prods et n'hésite pas à me contacter pour une collaboration." 
    };
    
    const allSearchableItems = {};
    Object.values(contentData).forEach(profile => {
        Object.assign(allSearchableItems, profile.titles, profile.gameplay, profile.makingofs);
    });

    // =========================================================
    // STATE & HISTORY
    // =========================================================
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
        // MODIFIED: Added PS Style achievement tracking
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
        const album = contentData[activeProfile].albums[item.albumId];

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
            // MODIFIED: Added PS Style achievement
            psPlayer: { unlocked: false, progress: [], goal: 2, title: "PS Player", desc: "Écouter 2 chansons 'playstation'.", icon: "fab fa-playstation" }
        };
        achievements = storedAchievements ? JSON.parse(storedAchievements) : defaultAchievements;
        
        Object.keys(defaultAchievements).forEach(key => {
            if (!achievements[key]) {
                achievements[key] = defaultAchievements[key];
            }
        });

        renderAchievements();
        updateShopLocks();
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
        } else if (id === 'retroPlayer' || id === 'psPlayer') { // MODIFIED: Grouped similar logic
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
        updateShopLocks();
    }

    function renderAchievements() {
        const container = document.getElementById('achievements-list');
        if (!container) return;
        container.innerHTML = '';
        Object.entries(achievements).forEach(([id, ach]) => {
            let progressValue = 0;
            if (id === 'loopMaster') {
                progressValue = Math.max(0, ...Object.values(ach.progress)) / ach.goal;
            } else if (id === 'retroPlayer' || id === 'psPlayer') { // MODIFIED: Grouped similar logic
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

    function updateShopLocks() {
        document.querySelectorAll('.theme-buy-btn[data-achievement]').forEach(btn => {
            const achievementId = btn.dataset.achievement;
            if (achievements[achievementId] && achievements[achievementId].unlocked) {
                btn.classList.remove('locked');
                btn.innerHTML = 'Sélectionner';
                btn.disabled = false;
            } else {
                btn.classList.add('locked');
                btn.innerHTML = `<i class="fas fa-lock"></i> ${achievements[achievementId]?.title || ''}`;
                btn.disabled = true;
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

            const imagePath = item.image || 'https://via.placeholder.com/200x120/9E9E9E/FFFFFF?text=No+Image';
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
        const album = contentData[activeProfile].albums[item.albumId];
        document.getElementById('details-album-art').src = item.image;
        document.getElementById('details-title').textContent = item.title;
        const albumSpan = document.getElementById('details-album');
        albumSpan.textContent = album ? album.title : 'Inconnu';
        albumSpan.parentElement.dataset.albumId = item.albumId;
        document.getElementById('details-year').textContent = item.year;
        document.getElementById('details-description').textContent = item.description;
        document.getElementById('details-tags').innerHTML = item.tags.map(tag => `<span class="tag-item">${tag}</span>`).join('');
    }

    function renderVideoSuggestions() {
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        const allContent = {...contentData[activeProfile].titles, ...contentData[activeProfile].gameplay};
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
            document.getElementById('player-album-cover').src = item.image || 'assets/placeholder-cover.svg';
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
        const isDark = localStorage.getItem('theme') === 'dark';
        if (isDark) document.body.classList.add('dark-theme');
        if (themeName && themeName !== 'default') {
            document.body.classList.add(themeName);
        }
        localStorage.setItem('ui-theme', themeName);
    }

    function resetToHome() {
        playAudio(sounds.select);
        showSection('menu-cards-section');
        sectionHistory = ['menu-cards-section'];
        const activeProject = document.querySelector('.profile-tab.active').dataset.project;
        renderCards('content-cards', projectData[activeProject], 'menu');
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================
    initUserData();
    renderCards('content-cards', projectData['mmg-music'], 'menu');
    resetMiniPlayerUI();
    setupTagFilters();
    updateTime();
    setInterval(updateTime, 30000);
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedUiTheme = localStorage.getItem('ui-theme') || 'default';
    document.getElementById('theme-switch').checked = savedTheme === 'dark';
    document.body.classList.toggle('dark-theme', savedTheme === 'dark');
    applyTheme(savedUiTheme);

    // =========================================================
    // EVENT LISTENERS
    // =========================================================
    document.getElementById('start-button').addEventListener('click', () => {
        document.getElementById('start-button').style.display = 'none';
        const video = document.getElementById('intro-video');
        video.style.visibility = 'visible';
        video.play().catch(e => {
            video.dispatchEvent(new Event('ended'));
        });
    });

    document.getElementById('intro-video').addEventListener('ended', () => {
        if (document.getElementById('background-music-switch').checked) {
            document.getElementById('background-music').play().catch(()=>{});
        }
        const splash = document.getElementById('splash-screen');
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.style.display = 'none';
            document.getElementById('main-content-wrapper').classList.remove('hidden');
        }, 1000);
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
            const titlesForAlbum = Object.fromEntries(Object.entries(contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
            document.getElementById('titles-section-title').textContent = contentData[activeProfile].albums[albumId].title;
            renderCards('titles-cards', titlesForAlbum, 'title');
            showSection('titles-section');
        }
    });

    function handleMenuNavigation(dataLink) {
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
        const profileContent = contentData[activeProfile];
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
            document.getElementById('about-content').innerHTML = `<img src="${avatarUrl}" alt="Avatar"><p>${aboutContent[activeProfile]}</p>`;
        } else if (dataLink === 'liked-titles-section') {
            const likedItems = Object.fromEntries(
                [...likedSongs].map(id => [id, findItemById(id)]).filter(([, item]) => item)
            );
            document.getElementById('liked-titles-section-title').textContent = 'Titres Likés';
            renderCards('liked-titles-cards', likedItems, 'title');
        }
        showSection(dataLink);
    }

    document.getElementById('details-album-link').addEventListener('click', (e) => {
        e.preventDefault();
        const albumId = e.currentTarget.dataset.albumId;
        if(albumId) {
            playAudio(sounds.select);
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project;
            const titlesForAlbum = Object.fromEntries(Object.entries(contentData[activeProfile].titles).filter(([_, title]) => title.albumId === albumId));
            document.getElementById('titles-section-title').textContent = contentData[activeProfile].albums[albumId].title;
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
                const albumTitles = Object.values(contentData[activeProfile].titles).filter(t => t.albumId === currentPlayingItem.albumId);
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

        // BUG FIX: Check if activePlayer is not null and has the function before calling it
        pausedForOverlay = (activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() === YT.PlayerState.PLAYING);
        if (pausedForOverlay) {
            activePlayer.pauseVideo();
        }
        document.getElementById('background-music').pause();

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

        // BUG FIX: Stop shop sound on close
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
            if (e.target.classList.contains('locked')) return;
            applyTheme(e.target.dataset.theme);
            playAudio(sounds.select);
        });
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
        if (e.target.closest('.card, .profile-tab, .top-bar-btn, #mp3-player-container i')) {
            playAudio(sounds.hover);
        }
    });

    // Tutorial Logic
    const tutorialSteps = [
        { selector: '.central-profiles-card', text: 'Bascule entre les profils "Mmg Music" et "Mmg Beats" pour découvrir différents styles.' },
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
        if (highlightedElement) highlightedElement.classList.remove('tutorial-highlight');
        if (stepIndex >= tutorialSteps.length) { endTutorial(); return; }
        currentStep = stepIndex;
        const step = tutorialSteps[stepIndex];
        let targetElement = document.querySelector(step.selector);
        if (!targetElement || targetElement.offsetParent === null) { showTutorialStep(stepIndex + 1); return; }
        highlightedElement = targetElement;
        targetElement.classList.add('tutorial-highlight');
        const tutorialBox = document.getElementById('tutorial-box');
        document.getElementById('tutorial-text').textContent = step.text;
        const rect = targetElement.getBoundingClientRect();
        tutorialBox.style.top = `${rect.bottom + 15}px`;
        tutorialBox.style.left = `${rect.left + (rect.width / 2)}px`;
        tutorialBox.style.transform = 'translateX(-50%)';
        document.getElementById('tutorial-overlay').classList.remove('hidden');
    }
    function endTutorial() {
        if (highlightedElement) highlightedElement.classList.remove('tutorial-highlight');
        document.getElementById('tutorial-overlay').classList.add('hidden');
    }
    document.getElementById('guide-btn').addEventListener('click', () => { playAudio(sounds.select); showTutorialStep(0); });
    document.getElementById('tutorial-next').addEventListener('click', () => showTutorialStep(currentStep + 1));
    document.getElementById('tutorial-prev').addEventListener('click', () => showTutorialStep(currentStep - 1));
    document.getElementById('tutorial-end').addEventListener('click', endTutorial);
});
