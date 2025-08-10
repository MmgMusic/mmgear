document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // DATA
    // =========================================================
    const projectData = {
        'mmg-music': {
            'card1': { 'title': 'Albums', 'image': 'assets/mmg-titles.png', 'link': 'albums-section' },
            'card2': { 'title': 'Music Videos', 'image': 'assets/mmg-videos.png', 'link': 'gameplay-section' },
            'card3': { 'title': 'Music Making-Ofs', 'image': 'assets/mmg-makingofs.png', 'link': 'makingofs-section' },
            'card4': { 'title': 'About', 'image': 'assets/mmg-music-avatar.png', 'link': 'about-section' }
        },
        'mmg-beats': {
            'card1': { 'title': 'Beats Titles', 'image': 'https://via.placeholder.com/200x120/FFC107/FFFFFF?text=Beats+Titles', 'link': 'beats-titles-section' },
            'card2': { 'title': 'Beats Videos', 'image': 'https://via.placeholder.com/200x120/E91E63/FFFFFF?text=Beats+Videos', 'link': 'beats-gameplay-section' },
            'card3': { 'title': 'Beats Making-Ofs', 'image': 'https://via.placeholder.com/200x120/673AB7/FFFFFF?text=Beats+Making-Ofs', 'link': 'beats-makingofs-section' },
            'card4': { 'title': 'About', 'image': 'assets/mmg-beats-avatar.png', 'link': 'about-section' }
        }
    };

    const albumsData = {
        'album1': { 'id': 'album1', 'title': 'The Mmg Game Collection', 'image': 'assets/Pochette-TheMmgGameCollection.png' },
        'album2': { 'id': 'album2', 'title': 'The Red Drum Vol.1', 'image': 'https://via.placeholder.com/200x120/FF5252/FFFFFF?text=Coming+Soon' }
    };

    const titlesData = {
        'title1': { 'title': 'Wiikend Sports (Loop Me!)', 'image': 'assets/Pochette-WiikendSports(LoopMe!).png', 'albumId': 'album1', 'year': '2024', 'description': 'Inspiré par les thèmes joyeux et entraînants des jeux de sport Nintendo.', 'tags': ['chill'], 'youtube_id': '-fb9BIrjEl4', 'loopable': true },
        'title2': { 'title': 'Cheap Cheep Beach', 'image': 'assets/Pochette-CheapCheepBeach.png', 'albumId': 'album1', 'year': '2024', 'description': 'Une ambiance de plage ensoleillée avec des percussions latines.', 'tags': ['latin', 'chill'], 'youtube_id': 'wJrin0ElUvM' },
        // COMMENTAIRE: Le titre 'Connecting' est retiré car il est maintenant géré par un audio local via le bouton WiFi.
        'title4': { 'title': 'Shop (Loop Me!)', 'image': 'assets/Pochette-Shop(LoopMe!).png', 'albumId': 'album1', 'year': '2024', 'description': 'Un thème de magasin classique, parfait pour faire des achats virtuels.', 'tags': ['latin', 'chill'], 'youtube_id': 'NotA1u0t7CM', 'loopable': true },
        'title5': { 'title': 'Harvest', 'image': 'assets/Pochette-Harvest.png', 'albumId': 'album1', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['pop', 'chill'], 'youtube_id': 'BWNiQtR3GYk' },
        'title6': { 'title': 'Woods Of Wonder', 'image': 'assets/Pochette-WoodsOfWonder.png', 'albumId': 'album1', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['mysterious'], 'youtube_id': 'XJA2nJ2sk6g' },
        'title7': { 'title': 'Spotimon (Night Version)', 'image': 'assets/Pochette-Spotimon(NightVersion).png', 'albumId': 'album1', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['pop', 'chill'], 'youtube_id': 'SccxT_6hm-o' },
        'title8': { 'title': 'Internet Browser', 'image': 'assets/Pochette-InternetBrowser.png', 'albumId': 'album1', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['frutiger aero', 'chill'], 'youtube_id': 'NJeVQ_dRQ-I' },
        'title9': { 'title': 'Racing', 'image': 'assets/Pochette-Racing.png', 'albumId': 'album1', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['drum and bass'], 'youtube_id': 'Fda9rYjeDL0' },
        'title10': { 'title': 'Kart 1', 'image': 'assets/Pochette-Kart 1.png', 'albumId': 'album1', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['drum and bass'], 'youtube_id': 'xmTduj2PWKc' },
        'title11': { 'title': 'Kong (Loop Me!)', 'image': 'assets/Pochette-Kong(LoopMe!).png', 'albumId': 'album1', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['ethnic', 'pop'], 'youtube_id': '_UfcPulKiI4', 'loopable': true },
        'title12': { 'title': 'Spotimon (Jade Version)', 'image': 'assets/Pochette-Spotimon (JadeVersion).png', 'albumId': 'album1', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['latin', 'chill'], 'youtube_id': 'wgpJ-d1OhCk' },
        'title13': { 'title': 'Spotimon (Radiant Jade Version)', 'image': 'assets/Pochette-Spotimon(RadiantJadeVersion).png', 'albumId': 'album1', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['latin', 'chill'], 'youtube_id': 'AHuq8AF8rBc' },
        'title14': { 'title': 'Space Racer 2000', 'image': 'assets/Pochette-SpaceRacer2000.png', 'albumId': 'album1', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['drum and bass'], 'youtube_id': 'sjky3GcV7KY' },
        'title15': { 'title': 'Spooky Mansion', 'image': 'assets/Pochette-SpookyMansion.png', 'albumId': 'album1', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['mysterious'], 'youtube_id': 'gUovlLGi3uM' },
        'title16': { 'title': 'Kart World (Loop Me!)', 'image': 'assets/Pochette-KartWorld.png', 'albumId': 'album1', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['drum and bass', 'chill'], 'youtube_id': 'iXEBDQuq_jU', 'loopable': true },
        'title17': { 'title': 'Super Mmg Bros (Underwater)', 'image': 'assets/Pochette-NewSuperMmgBros(Underwater).png', 'albumId': 'album1', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['waltz', 'chill'], 'youtube_id': '9ROH6sTcnCA' },
    };

    // COMMENTAIRE: Mise à jour des miniatures pour les vidéos de gameplay
    const gameplayData = {
       'video1': { 'title': 'I made a new Mario Kart Wii Rainbow Road theme (including start + end fanfares & results !)', 'image': 'assets/Miniature-KartWorld(LoopMe!).png', 'tags': ['drum and bass', 'gameplay'], 'youtube_id': '7jtH8hy7C3c' },
        'video2': { 'title': 'I made a new Donkey Kong Country track (DKCR/DKCTF style)', 'image': 'assets/Miniature-Kong(LoopMe!).png', 'tags': ['ethnic', 'pop', 'gameplay'], 'youtube_id': 'tqCzklXDuJ8' },
        'video3': { 'title': 'I made two new pokemon city themes (DPPt & BDSP style !)', 'image': 'assets/mmg-videos.png', 'tags': ['latin', 'chill', 'gameplay'], 'youtube_id': 'QTlqJ1LsuDE' },
        'video4': { 'title': 'I made a low-poly racing game track (PS1, PS2 style (Intelligent DnB)', 'image': 'assets/Miniature-SpaceRacer2000.png', 'tags': ['drum and bass', 'gameplay'], 'youtube_id': 'sZmv4Tn8GQQ' },
        'video5': { 'title': 'I made a new Wii Sports track (Loop Me!)', 'image': 'assets/mmg-videos.png', 'tags': ['ethnic', 'pop', 'gameplay'], 'youtube_id': '2yDgfrqqmHo' },
        'video6': { 'title': "I made a new Luigi's Mansion track", 'image': 'assets/Miniature-SpookyMansion.png', 'tags': ['mysterious', 'gameplay'], 'youtube_id': 'kle9Eu40lTI' },
        'video7': { 'title': 'I made a new Mario Kart World - Main Menu Character & Kart Select theme', 'image': 'assets/Miniature-KartWorld(LoopMe!).png', 'tags': ['drum and bass', 'chill', 'gameplay'], 'youtube_id': 'rgAnklhbk1o' },
        'video8': { 'title': 'I made a new New Super Mario Bros. Wii Underwater theme !', 'image': 'assets/Miniature-SuperMmgBros(LoopMe!).png', 'tags': ['waltz', 'chill', 'gameplay'], 'youtube_id': 'BVQj_Yxj35w' },
    };

    const makingofsData = { 'makingof1': { 'title': 'Behind the scenes', 'image': 'assets/mmg-makingofs.png', 'tags': ['studio', 'making of'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_1' } };
    const beatsTitlesData = { 'beat1': { 'title': 'Beat A', 'image': 'assets/mmg-beats-avatar.png', 'tags': ['trap', 'hip-hop'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_3' } };
    const beatsGameplayData = { 'beatsVideo1': { 'title': 'Video Beat 1', 'image': 'assets/mmg-beats-avatar.png', 'tags': ['trap', 'tutorial'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_5' } };
    const beatsMakingofsData = { 'beatsMakingof1': { 'title': 'Making-Of Beat 1', 'image': 'assets/mmg-beats-avatar.png', 'tags': ['studio', 'making of'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_6' } };
    const aboutContent = { 
        'mmg-music': "Hey there, I'm Mmg, also known as music composer Mmg on the track. I've had the privilege of contributing to both well-known and emerging artists' tracks, including collaborations with Koba LaD and F430. Additionally, you might have caught my music in the film 'L'École Est à Nous'. Now, I'm set on expressing my musical identity through independently released tracks. On the \"Mmg\" profile, you can expect a diverse range of music genres : funk, jazz, disco, r&B, pop, house, DnB, videogame music, waltzes and many other genres !", 
        'mmg-beats': "Hey there, I'm Mmg, also known as music composer Mmg on the track. I've had the privilege of contributing to both well-known and emerging artists' tracks, including collaborations with Koba LaD and F430. Additionally, you might have caught my music in the film 'L'École Est à Nous'. Now, I'm set on expressing my musical identity through independently released tracks. The \"Mmg beats\" profile is specifically focused on hip-hop, featuring releases of Trap, Boombap, RnB, and Pop beats." 
    };
    const allSearchableItems = { ...titlesData, ...gameplayData, ...makingofsData, ...beatsTitlesData, ...beatsGameplayData, ...beatsMakingofsData };

    // =========================================================
    // STATE & HISTORY
    // =========================================================
    const sectionHistory = ['menu-cards-section'];
    let largePlayer, mediumPlayer;
    let activePlayer = null;
    let currentPlayingItem = null; 
    let isPlayerLooping = false;
    let isShuffleMode = false; // COMMENTAIRE: Ajout de l'état pour le mode shuffle
    let pausedForOverlay = false; 
    
    // =========================================================
    // SOUND & AUDIO ELEMENTS
    // =========================================================
    const sounds = {
        typingForward: document.getElementById('typing-forward-sound'),
        typingBackward: document.getElementById('typing-backwards-sound'),
        hover: document.getElementById('hover-sound'),
        back: document.getElementById('back-sound'),
        select: document.getElementById('select-sound'),
        switchToWhite: document.getElementById('switch-to-white-sound'),
        switchToBlack: document.getElementById('switch-to-black-sound'),
        scroll: document.getElementById('scroll-sound'),
        shop: document.getElementById('shop-sound'),
        connecting: document.getElementById('connecting-sound'), // COMMENTAIRE: Ajout du son de connexion
    };

    // =========================================================
    // YOUTUBE PLAYER LOGIC
    // =========================================================
    window.onYouTubeIframeAPIReady = function() {
        const playerOptions = {
            height: '100%',
            width: '100%',
            playerVars: { 'playsinline': 1, 'autoplay': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0 },
            events: { 
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange 
            }
        };
        largePlayer = new YT.Player('large-player-iframe', playerOptions);
        mediumPlayer = new YT.Player('medium-player-iframe', playerOptions);
    }

    function onPlayerReady(event) {
        event.target.setVolume(document.getElementById('volume-slider').value);
        setInterval(updateProgressBar, 500);
    }

    function onPlayerStateChange(event) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        
        if (event.data === YT.PlayerState.ENDED) {
            // COMMENTAIRE: Logique pour le shuffle et le loop
            if (isShuffleMode) {
                playRandomSongFromCurrentAlbum();
                return;
            }
            if (isPlayerLooping) {
                event.target.seekTo(0);
                event.target.playVideo();
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
            if(document.getElementById('video-suggestions-section').style.display !== 'none') {
                showSection(isMusicTitle(currentPlayingItem) ? 'music-title-details-section' : 'large-player-section');
            }
        } else if (event.data === YT.PlayerState.PAUSED) {
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
        }
    }

    function loadAndPlayVideo(item) {
        if (!largePlayer || !mediumPlayer || !item) return;

        currentPlayingItem = item;
        const musicTitle = isMusicTitle(item);
    
        if (musicTitle) {
            largePlayer.stopVideo();
            activePlayer = mediumPlayer;
        } else {
            mediumPlayer.stopVideo();
            activePlayer = largePlayer;
        }
        
        updateMp3PlayerInfo(item);
    
        if (musicTitle) {
            renderMusicTitleDetails(item);
            showSection('music-title-details-section');
        } else {
            showSection('large-player-section');
        }
    
        activePlayer.loadVideoById(item.youtube_id, 0);
        // COMMENTAIRE: La logique de mute pour "Connecting" a été retirée car la chanson n'est plus dans les données principales.
        activePlayer.unMute();
        activePlayer.setVolume(document.getElementById('volume-slider').value);
    }
    
    function findItemByYoutubeId(youtubeId) {
        return Object.values(allSearchableItems).find(item => item.youtube_id === youtubeId) || null;
    }

    function isMusicTitle(item) {
        return item && item.albumId && item.year;
    }

    // =========================================================
    // UI & GENERAL FUNCTIONS
    // =========================================================
    function playAudio(audioElement) {
        if (audioElement && audioElement.HAVE_ENOUGH_DATA) {
            audioElement.currentTime = 0;
            audioElement.play().catch(error => console.error("Audio playback error:", error));
        }
    }

    function updateTime() {
        const timeElement = document.getElementById('real-time');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
    }

    function renderCards(containerId, cardsData, cardType = 'generic') {
        const cardsContainer = document.getElementById(containerId);
        if (!cardsContainer) return;
        cardsContainer.innerHTML = '';

        if (Object.keys(cardsData).length === 0) {
            cardsContainer.innerHTML = '<p class="no-results">Aucun résultat trouvé.</p>';
            return;
        }
        
        let delay = 0;
        for (const cardKey in cardsData) {
            const item = cardsData[cardKey];
            const card = document.createElement('div');
            card.className = 'card';
            // COMMENTAIRE: Ajout d'un délai d'animation pour un effet décalé
            card.style.animationDelay = `${delay}s`;
            delay += 0.05;
            
            let datasetAttributes = '';
            if (cardType === 'title' || cardType === 'video' || cardType === 'search') {
                const originalKey = Object.keys(allSearchableItems).find(key => allSearchableItems[key] === item);
                datasetAttributes = `data-item-id="${originalKey}" data-youtube-id="${item.youtube_id}"`;
            } else if (cardType === 'album') {
                 datasetAttributes = `data-album-id="${item.id}"`;
            } else if (cardType === 'menu') {
                datasetAttributes = `data-link="${item.link}"`;
            }

            const imagePath = item.image || 'https://via.placeholder.com/200x120/9E9E9E/FFFFFF?text=No+Image';
            const loopButtonHtml = item.loopable ? `<div class="loop-me-button">Loop Me!</div>` : '';

            card.innerHTML = `
                <a href="#" ${datasetAttributes}>
                    ${loopButtonHtml}
                    <img src="${imagePath}" alt="${item.title}">
                    <h3>${item.title}</h3>
                </a>
            `;
            cardsContainer.appendChild(card);
        }
    }

    function renderMusicTitleDetails(item) {
        document.getElementById('details-title').textContent = item.title;
        const album = albumsData[item.albumId];
        const albumSpan = document.getElementById('details-album');
        albumSpan.textContent = album ? album.title : 'Unknown';
        albumSpan.parentElement.dataset.albumId = item.albumId;
        document.getElementById('details-year').textContent = item.year;
        document.getElementById('details-description').textContent = item.description;
        const tagsContainer = document.getElementById('details-tags');
        tagsContainer.innerHTML = '';
        item.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag-item';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }

    function renderVideoSuggestions() {
        const suggestionsContainer = document.getElementById('suggestions-cards');
        if (!suggestionsContainer) return;
        const allTitlesAndVideos = {...titlesData, ...gameplayData};
        const shuffled = Object.values(allTitlesAndVideos).sort(() => 0.5 - Math.random());
        const suggestions = shuffled.filter(item => item.youtube_id !== currentPlayingItem?.youtube_id).slice(0, 4);
        const suggestionData = {};
        suggestions.forEach((item, index) => {
            suggestionData[`suggestion${index}`] = item;
        });
        renderCards('suggestions-cards', suggestionData, 'video');
    }

    function updateMp3PlayerInfo(item) {
        const mp3PlayerContainer = document.getElementById('mp3-player-container');
        if (item && item.title) {
            mp3PlayerContainer.classList.remove('hidden');
            document.getElementById('song-title').textContent = item.title;
            const playerCover = document.getElementById('player-album-cover');
            playerCover.src = item.image || 'assets/placeholder-cover.svg';
        } else {
            mp3PlayerContainer.classList.add('hidden');
        }
    }
    
    function resetMiniPlayerUI() {
        document.getElementById('player-album-cover').src = 'assets/placeholder-cover.svg';
        document.getElementById('song-title').textContent = '';
        document.getElementById('play-pause-btn').className = 'fas fa-play';
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('mp3-player-container').classList.add('hidden');
    }

    function updateProgressBar() {
        if (!activePlayer || typeof activePlayer.getCurrentTime !== 'function' || !currentPlayingItem) return;
        const progressFill = document.getElementById('progress-fill');
        const currentTime = activePlayer.getCurrentTime();
        const duration = activePlayer.getDuration();
        if (duration > 0 && progressFill) {
            progressFill.style.width = `${(currentTime / duration) * 100}%`;
        }
    }

    function showSection(sectionId, updateHistory = true, keepPlayerVisible = false) {
        if (!keepPlayerVisible) {
            document.querySelectorAll('.content-section-board .page-section').forEach(s => s.classList.add('hidden'));
        } else {
            document.querySelectorAll('.content-section-board .page-section:not(#large-player-section):not(#music-title-details-section)').forEach(s => s.classList.add('hidden'));
        }

        const sectionToShow = document.getElementById(sectionId);
        if (sectionToShow) sectionToShow.classList.remove('hidden');

        if (updateHistory && sectionHistory[sectionHistory.length - 1] !== sectionId) {
            if (sectionId !== 'video-suggestions-section') {
                sectionHistory.push(sectionId);
            }
        }
    }
    
    function updateVisibleCards() {
        const query = document.getElementById('search-input').value.toLowerCase().trim();
        const checkedTags = Array.from(document.querySelectorAll('#tags-filter-list input:checked')).map(cb => cb.value.toLowerCase());
        
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
        const tagsContainer = document.getElementById('tags-filter-list');
        if (!tagsContainer) return;
        
        tagsContainer.innerHTML = '';
        Array.from(allTags).sort().forEach(tag => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.innerHTML = `<input type="checkbox" id="tag-${tag}" value="${tag.toLowerCase()}"><label for="tag-${tag}">${tag}</label>`;
            tagsContainer.appendChild(checkboxDiv);
        });
    }

    function showDialog(message) {
        const dialogMessage = document.getElementById('dialog-message');
        const customDialog = document.getElementById('custom-dialog');
        dialogMessage.textContent = message;
        customDialog.classList.remove('hidden');
        customDialog.style.opacity = 1;
        setTimeout(() => {
            customDialog.style.opacity = 0;
            setTimeout(() => customDialog.classList.add('hidden'), 300);
        }, 2000);
    }
    
    function applyTheme(themeName) {
        document.body.classList.remove('theme-8bit', 'theme-16bit', 'theme-vaporwave');
        if (themeName !== 'default') {
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
    renderCards('content-cards', projectData['mmg-music'], 'menu');
    resetMiniPlayerUI();
    setupTagFilters();
    updateTime();
    setInterval(updateTime, 1000);
    applyTheme(localStorage.getItem('ui-theme') || 'default');

    // =========================================================
    // EVENT LISTENERS
    // =========================================================
    document.getElementById('start-button')?.addEventListener('click', () => {
        document.getElementById('start-button').style.display = 'none';
        document.getElementById('intro-video').style.visibility = 'visible';
        document.getElementById('intro-video').play().catch(e => console.error("Intro video error:", e));
    });

    document.getElementById('intro-video')?.addEventListener('ended', () => {
        if (document.getElementById('background-music-switch').checked) document.getElementById('background-music').play();
        document.getElementById('splash-screen').classList.add('fade-out');
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            document.getElementById('main-content-wrapper').classList.remove('hidden');
            document.getElementById('main-content-wrapper').style.opacity = 1;
        }, 1000);
    });

    document.querySelector('.back-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        playAudio(sounds.back);
        if (sectionHistory.length > 1) {
            sectionHistory.pop();
            const previousSectionId = sectionHistory[sectionHistory.length - 1];
            showSection(previousSectionId, false);
        }
    });

    document.getElementById('home-btn')?.addEventListener('click', (e) => {
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
        const link = e.target.closest('a');
        if (!link) return;
        e.preventDefault();

        const { youtubeId, link: dataLink, albumId } = link.dataset;

        if (youtubeId) {
            playAudio(sounds.select);
            const item = findItemByYoutubeId(youtubeId);
            if (item) loadAndPlayVideo(item);
        } else if (dataLink) {
            playAudio(sounds.select);
            handleMenuNavigation(dataLink);
        } else if (albumId) {
            playAudio(sounds.select);
            const titlesForAlbum = Object.fromEntries(Object.entries(titlesData).filter(([_, title]) => title.albumId === albumId));
            document.getElementById('titles-section-title').textContent = albumsData[albumId].title;
            renderCards('titles-cards', titlesForAlbum, 'title');
            showSection('titles-section');
        }
    });

    function handleMenuNavigation(dataLink) {
        const sections = {
            'albums-section': { data: albumsData, type: 'album' },
            'gameplay-section': { data: gameplayData, type: 'video' }, 
            'makingofs-section': { data: makingofsData, type: 'video' },
            'beats-titles-section': { data: beatsTitlesData, type: 'title' }, 
            'beats-gameplay-section': { data: beatsGameplayData, type: 'video' }, 
            'beats-makingofs-section': { data: beatsMakingofsData, type: 'video' }
        };

        if (sections[dataLink]) {
            renderCards(dataLink.replace('-section', '-cards'), sections[dataLink].data, sections[dataLink].type);
        } else if (dataLink === 'about-section') {
            const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
            document.getElementById('about-title').textContent = `About ${activeProfile === 'mmg-music' ? 'Mmg Music' : 'Mmg Beats'}`;
            document.getElementById('about-content').innerHTML = aboutContent[activeProfile];
        }
        showSection(dataLink);
    }

    document.getElementById('details-album-link').addEventListener('click', (e) => {
        e.preventDefault();
        const albumId = e.currentTarget.dataset.albumId;
        if(albumId) {
            playAudio(sounds.select);
            const titlesForAlbum = Object.fromEntries(Object.entries(titlesData).filter(([_, title]) => title.albumId === albumId));
            document.getElementById('titles-section-title').textContent = albumsData[albumId].title;
            renderCards('titles-cards', titlesForAlbum, 'title');
            showSection('titles-section');
        }
    });

    document.getElementById('player-album-cover').addEventListener('click', () => {
        if (currentPlayingItem) {
            playAudio(sounds.select);
            const targetSection = isMusicTitle(currentPlayingItem) ? 'music-title-details-section' : 'large-player-section';
            showSection(targetSection);
        }
    });

    document.getElementById('search-input')?.addEventListener('input', updateVisibleCards);
    document.getElementById('tags-filter-list')?.addEventListener('change', updateVisibleCards);
    document.getElementById('toggle-tags-filter')?.addEventListener('click', () => {
        playAudio(sounds.select);
        document.getElementById('tags-filter-list').classList.toggle('visible');
    });

    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        themeSwitch.checked = localStorage.getItem('theme') === 'dark';
        document.body.classList.toggle('dark-theme', themeSwitch.checked);
        themeSwitch.addEventListener('change', () => {
            document.body.classList.toggle('dark-theme');
            playAudio(document.body.classList.contains('dark-theme') ? sounds.switchToBlack : sounds.switchToWhite);
            localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
        });
    }
    
    document.getElementById('play-pause-btn')?.addEventListener('click', () => {
        playAudio(sounds.select);
        if (!activePlayer || !currentPlayingItem) return;
        const state = activePlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            activePlayer.pauseVideo();
        } else {
            activePlayer.playVideo();
        }
    });

    const changeTrack = (direction) => {
        playAudio(sounds.select);
        if (!currentPlayingItem) return;
        
        const currentAlbumId = currentPlayingItem.albumId;
        if (!currentAlbumId) return;

        const albumTitles = Object.values(titlesData).filter(t => t.albumId === currentAlbumId);
        const currentIndex = albumTitles.findIndex(item => item.youtube_id === currentPlayingItem.youtube_id);
        
        if (currentIndex === -1) return;
        const nextIndex = (currentIndex + direction + albumTitles.length) % albumTitles.length;
        loadAndPlayVideo(albumTitles[nextIndex]);
    };

    document.getElementById('next-video-btn')?.addEventListener('click', () => changeTrack(1));
    document.getElementById('prev-video-btn')?.addEventListener('click', () => changeTrack(-1));
    
    document.getElementById('loop-btn')?.addEventListener('click', (e) => {
        isPlayerLooping = !isPlayerLooping;
        e.target.classList.toggle('active', isPlayerLooping);
        playAudio(sounds.select);
        if (isPlayerLooping) {
            isShuffleMode = false;
            document.getElementById('shuffle-btn').classList.remove('active');
        }
    });

    // COMMENTAIRE: Logique pour le bouton Shuffle
    document.getElementById('shuffle-btn')?.addEventListener('click', (e) => {
        isShuffleMode = !isShuffleMode;
        e.target.classList.toggle('active', isShuffleMode);
        playAudio(sounds.select);
        showDialog(`Shuffle ${isShuffleMode ? 'activated' : 'deactivated'}`);
        if (isShuffleMode) {
            isPlayerLooping = false;
            document.getElementById('loop-btn').classList.remove('active');
        }
    });
    
    function playRandomSongFromCurrentAlbum() {
        if (!currentPlayingItem || !currentPlayingItem.albumId) return;
        const albumTitles = Object.values(titlesData).filter(t => t.albumId === currentPlayingItem.albumId);
        if (albumTitles.length <= 1) {
            loadAndPlayVideo(albumTitles[0]); // S'il n'y a qu'une chanson, on la rejoue
            return;
        }
        let randomIndex;
        let nextSong;
        do {
            randomIndex = Math.floor(Math.random() * albumTitles.length);
            nextSong = albumTitles[randomIndex];
        } while (nextSong.youtube_id === currentPlayingItem.youtube_id); // Évite de rejouer la même chanson
        
        loadAndPlayVideo(nextSong);
    }


    document.getElementById('share-btn')?.addEventListener('click', () => {
        if (!currentPlayingItem) return;
        const url = `https://www.youtube.com/watch?v=${currentPlayingItem.youtube_id}`;
        navigator.clipboard.writeText(url).then(() => showDialog('Link copied to clipboard!'))
            .catch(err => showDialog('Failed to copy link.'));
    });

    document.getElementById('progress-bar')?.addEventListener('click', (e) => {
        if (activePlayer && typeof activePlayer.getDuration === 'function') {
            const rect = e.currentTarget.getBoundingClientRect();
            activePlayer.seekTo(((e.clientX - rect.left) / rect.width) * activePlayer.getDuration(), true);
        }
    });

    document.getElementById('volume-slider')?.addEventListener('input', (e) => {
        const volume = e.target.value;
        if (largePlayer && typeof largePlayer.setVolume === 'function') largePlayer.setVolume(volume);
        if (mediumPlayer && typeof mediumPlayer.setVolume === 'function') mediumPlayer.setVolume(volume);
        // Appliquer aussi aux sons locaux si besoin
        Object.values(sounds).forEach(sound => {
            if (sound) sound.volume = volume / 100;
        });
    });

    function pauseMediaForOverlay() {
        pausedForOverlay = (activePlayer && activePlayer.getPlayerState() === YT.PlayerState.PLAYING);
        document.getElementById('background-music').pause();
        if (pausedForOverlay) {
            activePlayer.pauseVideo();
        }
    }

    function resumeMediaAfterOverlay() {
        if (pausedForOverlay) {
             activePlayer.playVideo();
        } else if (document.getElementById('background-music-switch').checked) {
            const playerState = activePlayer ? activePlayer.getPlayerState() : -1;
            if (playerState !== YT.PlayerState.PLAYING && playerState !== YT.PlayerState.BUFFERING) {
                document.getElementById('background-music').play();
            }
        }
        pausedForOverlay = false;
    }

    const setupOverlay = (btnId, overlayId, closeBtnClass, openSound, closeSound) => {
        const btn = document.getElementById(btnId);
        const overlay = document.getElementById(overlayId);
        const closeBtn = overlay?.querySelector(closeBtnClass);

        btn?.addEventListener('click', (e) => {
            e.preventDefault();
            pauseMediaForOverlay();
            if (openSound) playAudio(sounds[openSound]);
            
            // COMMENTAIRE: Logique modifiée pour le bouton WiFi
            if (btnId === 'wifi-btn') {
                playAudio(sounds.connecting);
                
                const onConnectingEnd = () => {
                   closeBtn.click();
                   showDialog("Connection successful!");
                   sounds.connecting.removeEventListener('ended', onConnectingEnd);
                };
                sounds.connecting.addEventListener('ended', onConnectingEnd);
            }

            overlay.classList.remove('hidden');
            overlay.style.opacity = 1;
        });

        closeBtn?.addEventListener('click', () => {
            if (closeSound) playAudio(sounds[closeSound]);
            if (openSound === 'shop' && sounds.shop) sounds.shop.pause();
            
            if (btnId === 'wifi-btn') {
                sounds.connecting.pause();
                sounds.connecting.currentTime = 0;
            }

            overlay.style.opacity = 0;
            setTimeout(() => {
                overlay.classList.add('hidden');
                resumeMediaAfterOverlay();
            }, 500);
        });
    };

    setupOverlay('settings-btn', 'settings-overlay', '.close-settings-btn', 'select', 'back');
    setupOverlay('shop-btn', 'shop-overlay', '.close-shop-btn', 'shop', 'back');
    setupOverlay('wifi-btn', 'wifi-overlay', '.close-wifi-btn', null, 'back'); // Pas de son à l'ouverture, géré en interne

    document.querySelectorAll('.theme-buy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            applyTheme(e.target.dataset.theme);
            playAudio(sounds.select);
        });
    });

    document.getElementById('background-music-switch')?.addEventListener('change', (e) => {
        const playerState = activePlayer ? activePlayer.getPlayerState() : -1;
        if (e.target.checked && playerState !== YT.PlayerState.PLAYING) {
            document.getElementById('background-music').play();
        } else {
            document.getElementById('background-music').pause();
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest('.card, .profile-tab, .settings, #mp3-player-container i, #toggle-tags-filter, .sidebar-btn')) {
            playAudio(sounds.hover);
        }
    });

    const scaleMainBoard = () => {
        const mainBoard = document.querySelector('.main-board');
        if (!mainBoard) return;
        const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
        mainBoard.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    scaleMainBoard();
    window.addEventListener('resize', scaleMainBoard);

    // =========================================================
    // TUTORIAL LOGIC
    // =========================================================
    const tutorialSteps = [
        { selector: '.central-profiles-card', text: 'Ici, vous pouvez basculer entre les profils "Mmg Music" et "Mmg Beats" pour découvrir différents styles musicaux.' },
        { selector: '#content-cards', text: 'Naviguez à travers les différentes sections comme les albums, les clips vidéos ou les making-ofs.' },
        { selector: '.search-bar', text: 'Utilisez la barre de recherche pour trouver un titre ou une vidéo spécifique.' },
        { selector: '#tags-filter-dropdown', text: 'Filtrez le contenu par tags pour affiner votre recherche.' },
        { selector: '#mp3-player-container', text: 'Quand une musique est lancée, vous pouvez la contrôler ici. Essayez les boutons shuffle et loop !' },
        { selector: '.theme-switcher-footer', text: 'Changez le thème visuel de l\'application, du clair au sombre.' },
        { selector: '#shop-btn', text: 'Visitez la boutique pour débloquer de nouveaux thèmes graphiques !' }
    ];
    let currentStep = 0;
    let highlightedElement = null;

    function showTutorialStep(stepIndex) {
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
        }

        if (stepIndex >= tutorialSteps.length) {
            endTutorial();
            return;
        }

        currentStep = stepIndex;
        const step = tutorialSteps[stepIndex];
        const targetElement = document.querySelector(step.selector);
        
        if (!targetElement) {
            showTutorialStep(stepIndex + 1); // Skip if element not visible
            return;
        }

        highlightedElement = targetElement;
        targetElement.classList.add('tutorial-highlight');

        const tutorialBox = document.getElementById('tutorial-box');
        const tutorialText = document.getElementById('tutorial-text');
        const rect = targetElement.getBoundingClientRect();

        tutorialText.textContent = step.text;
        
        // Position the tutorial box
        tutorialBox.style.top = `${rect.bottom + 15}px`;
        tutorialBox.style.left = `${rect.left + (rect.width / 2) - (tutorialBox.offsetWidth / 2)}px`;

        // Adjust if off-screen
        if (rect.bottom + tutorialBox.offsetHeight > window.innerHeight) {
            tutorialBox.style.top = `${rect.top - tutorialBox.offsetHeight - 15}px`;
        }
        if (rect.left + (rect.width / 2) + (tutorialBox.offsetWidth / 2) > window.innerWidth) {
            tutorialBox.style.left = `${window.innerWidth - tutorialBox.offsetWidth - 15}px`;
        }
        if (tutorialBox.offsetLeft < 0){
             tutorialBox.style.left = '15px';
        }


        document.getElementById('tutorial-prev').style.display = stepIndex === 0 ? 'none' : 'inline-block';
    }

    function endTutorial() {
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
        }
        document.getElementById('tutorial-overlay').classList.add('hidden');
    }

    document.getElementById('guide-btn').addEventListener('click', () => {
        playAudio(sounds.select);
        document.getElementById('tutorial-overlay').classList.remove('hidden');
        showTutorialStep(0);
    });

    document.getElementById('tutorial-next').addEventListener('click', () => showTutorialStep(currentStep + 1));
    document.getElementById('tutorial-prev').addEventListener('click', () => showTutorialStep(currentStep - 1));
    document.getElementById('tutorial-end').addEventListener('click', endTutorial);
});

