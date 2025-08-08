document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // DATA
    // =========================================================
    const projectData = {
        'mmg-music': {
            'card1': { 'title': 'Music Titles', 'image': 'assets/mmg-titles.png', 'link': 'titles-section' },
            'card2': { 'title': 'Music Videos', 'image': 'assets/mmg-videos.png', 'link': 'gameplay-section' },
            'card3': { 'title': 'Music Making-Ofs', 'image': 'assets/mmg-makingofs.png', 'link': 'makingofs-section' },
            'card4': { 'title': 'About', 'image': 'https://via.placeholder.com/200x120/9E9E9E/FFFFFF?text=About', 'link': 'about-section' }
        },
        'mmg-beats': {
            'card1': { 'title': 'Beats Titles', 'image': 'https://via.placeholder.com/200x120/FFC107/FFFFFF?text=Beats+Titles', 'link': 'beats-titles-section' },
            'card2': { 'title': 'Beats Videos', 'image': 'https://via.placeholder.com/200x120/E91E63/FFFFFF?text=Beats+Videos', 'link': 'beats-gameplay-section' },
            'card3': { 'title': 'Beats Making-Ofs', 'image': 'https://via.placeholder.com/200x120/673AB7/FFFFFF?text=Beats+Making-Ofs', 'link': 'beats-makingofs-section' },
            'card4': { 'title': 'About', 'image': 'https://via.placeholder.com/200x120/00BCD4/FFFFFF?text=About', 'link': 'about-section' }
        }
    };

     const titlesData = {
        'title1': { 'title': 'Wiikend Sports (Loop Me!)', 'image': 'assets/Pochette-WiikendSports(LoopMe!).png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'Inspiré par les thèmes joyeux et entraînants des jeux de sport Nintendo.', 'tags': ['chill', 'loopable'], 'youtube_id': '-fb9BIrjEl4', 'loopable': true },
        'title2': { 'title': 'Cheap Cheep Beach', 'image': 'assets/Pochette-CheapCheepBeach.png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'Une ambiance de plage ensoleillée avec des percussions latines.', 'tags': ['latin', 'chill'], 'youtube_id': 'wJrin0ElUvM' },
        'title3': { 'title': 'Connecting (Loop Me!)', 'image': 'assets/Pochette-Connecting(LoopMe!).png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'Évoque le son des menus et des écrans de connexion du début des années 2000.', 'tags': ['frutiger aero', 'chill', 'loopable'], 'youtube_id': '4UePlHWHxFo', 'loopable': true },
        'title4': { 'title': 'Shop (Loop Me!)', 'image': 'assets/Pochette-Shop(LoopMe!).png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'Un thème de magasin classique, parfait pour faire des achats virtuels.', 'tags': ['latin', 'chill', 'loopable'], 'youtube_id': 'NotA1u0t7CM', 'loopable': true },
        'title5': { 'title': 'Harvest', 'image': 'assets/Pochette-Harvest.png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['pop', 'chill'], 'youtube_id': 'BWNiQtR3GYk' },
        'title6': { 'title': 'Woods Of Wonder', 'image': 'assets/Pochette-WoodsOfWonder.png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['mysterious'], 'youtube_id': 'XJA2nJ2sk6g' },
        'title7': { 'title': 'Spotimon (Night Version)', 'image': 'assets/Pochette-Spotimon(NightVersion).png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['pop', 'chill'], 'youtube_id': 'SccxT_6hm-o' },
        'title8': { 'title': 'Internet Browser', 'image': 'assets/Pochette-InternetBrowser.png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['frutiger aero', 'chill'], 'youtube_id': 'NJeVQ_dRQ-I' },
        'title9': { 'title': 'Racing', 'image': 'assets/Pochette-Racing.png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['drum and bass'], 'youtube_id': 'Fda9rYjeDL0' },
        'title10': { 'title': 'Kart 1', 'image': 'assets/Pochette-Kart 1.png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['drum and bass'], 'youtube_id': 'xmTduj2PWKc' },
        'title11': { 'title': 'Kong (Loop Me!)', 'image': 'assets/Pochette-Kong(LoopMe!).png', 'album': 'The Mmg Game Collection', 'year': '2024', 'description': 'TROUVER ICI', 'tags': ['ethnic', 'pop'], 'youtube_id': '_UfcPulKiI4', 'loopable': true },
        'title12': { 'title': 'Spotimon (Jade Version)', 'image': 'assets/Pochette-Spotimon (JadeVersion).png', 'album': 'The Mmg Game Collection', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['latin', 'chill'], 'youtube_id': 'wgpJ-d1OhCk' },
        'title13': { 'title': 'Spotimon (Radiant Jade Version)', 'image': 'assets/Pochette-Spotimon(RadiantJadeVersion).png', 'album': 'The Mmg Game Collection', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['latin', 'chill'], 'youtube_id': 'AHuq8AF8rBc' },
        'title14': { 'title': 'Space Racer 2000', 'image': 'assets/Pochette-SpaceRacer2000.png', 'album': 'The Mmg Game Collection', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['drum and bass'], 'youtube_id': 'sjky3GcV7KY' },
        'title15': { 'title': 'Spooky Mansion', 'image': 'assets/Pochette-SpookyMansion.png', 'album': 'The Mmg Game Collection', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['mysterious'], 'youtube_id': 'gUovlLGi3uM' },
        'title16': { 'title': 'Kart World (Loop Me!)', 'image': 'assets/Pochette-KartWorld.png', 'album': 'The Mmg Game Collection', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['drum and bass', 'chill'], 'youtube_id': 'iXEBDQuq_jU', 'loopable': true },
        'title17': { 'title': 'Super Mmg Bros (Underwater)', 'image': 'assets/Pochette-NewSuperMmgBros(Underwater).png', 'album': 'The Mmg Game Collection', 'year': '2025', 'description': 'TROUVER ICI', 'tags': ['waltz', 'chill'], 'youtube_id': '9ROH6sTcnCA' },
     };

    const gameplayData = {
       'video1': { 'title': 'I made a new Mario Kart Wii Rainbow Road theme (including start + end fanfares & results !)', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['drum and bass', 'gameplay'], 'youtube_id': '7jtH8hy7C3c' },
        'video2': { 'title': 'I made a new Donkey Kong Country track (DKCR/DKCTF style)', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['ethnic', 'pop', 'gameplay'], 'youtube_id': 'tqCzklXDuJ8' },
        'video3': { 'title': 'I made two new pokemon city themes (DPPt & BDSP style !)', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['latin', 'chill', 'gameplay'], 'youtube_id': 'QTlqJ1LsuDE' },
        'video4': { 'title': 'I made a low-poly racing game track (PS1, PS2 style (Intelligent DnB)', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['drum and bass', 'gameplay'], 'youtube_id': 'sZmv4Tn8GQQ' },
        'video5': { 'title': 'I made a new Wii Sports track (Loop Me!)', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['ethnic', 'pop', 'gameplay'], 'youtube_id': '2yDgfrqqmHo' },
        'video6': { 'title': "I made a new Luigi's Mansion track", 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['mysterious', 'gameplay'], 'youtube_id': 'kle9Eu40lTI' },
        'video7': { 'title': 'I made a new Mario Kart World - Main Menu Character & Kart Select theme', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['drum and bass', 'chill', 'gameplay'], 'youtube_id': 'rgAnklhbk1o' },
        'video8': { 'title': 'I made a new New Super Mario Bros. Wii Underwater theme !', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['waltz', 'chill', 'gameplay'], 'youtube_id': 'BVQj_Yxj35w' },
    };

    const makingofsData = { 'makingof1': { 'title': 'Behind the scenes', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['studio', 'making of'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_1' } };
    const beatsTitlesData = { 'beat1': { 'title': 'Beat A', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['trap', 'hip-hop'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_3' } };
    const beatsGameplayData = { 'beatsVideo1': { 'title': 'Video Beat 1', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['trap', 'tutorial'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_5' } };
    const beatsMakingofsData = { 'beatsMakingof1': { 'title': 'Making-Of Beat 1', 'image': 'assets/ASSETS_PATH_HERE.png', 'tags': ['studio', 'making of'], 'youtube_id': 'YOUR_YOUTUBE_ID_HERE_6' } };
    const aboutContent = { 'mmg-music': 'Texte de présentation de Mmg Music...', 'mmg-beats': 'Texte de présentation de Mmg Beats...' };
    const allSearchableItems = { ...titlesData, ...gameplayData, ...makingofsData, ...beatsTitlesData, ...beatsGameplayData, ...beatsMakingofsData };

    // =========================================================
    // STATE & HISTORY
    // =========================================================
    const sectionHistory = ['menu-cards-section'];
    let largePlayer, mediumPlayer;
    let activePlayer = null;
    let currentVideoId = null;
    let isPlayerLooping = false;
    let pausedForOverlay = { playerState: null, videoId: null, time: 0 };
    let isOverlayMusicPlaying = false;

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
    };

    // =========================================================
    // YOUTUBE PLAYER LOGIC
    // =========================================================
    window.onYouTubeIframeAPIReady = function() {
        const playerOptions = {
            height: '100%',
            width: '100%',
            playerVars: { 'playsinline': 1, 'autoplay': 0, 'controls': 0, 'modestbranding': 1, 'rel': 0 },
            events: { 'onStateChange': onPlayerStateChange }
        };
        largePlayer = new YT.Player('large-player-iframe', playerOptions);
        mediumPlayer = new YT.Player('medium-player-iframe', playerOptions);
        setInterval(updateProgressBar, 500);
    }

    function onPlayerStateChange(event) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const backgroundMusic = document.getElementById('background-music');
        const backgroundMusicSwitch = document.getElementById('background-music-switch');
        
        activePlayer = event.target; // Keep track of which player fired the event
    
        if (event.data === YT.PlayerState.PLAYING) {
            if (playPauseBtn) playPauseBtn.className = 'fas fa-pause';
            if (backgroundMusic) backgroundMusic.pause();
            if(activePlayer === largePlayer) showSection('large-player-section');
            else showSection('music-title-details-section');
            document.getElementById('video-suggestions-section').classList.add('hidden');
        } else if (event.data === YT.PlayerState.ENDED) {
            if (isPlayerLooping) {
                activePlayer.seekTo(0);
                activePlayer.playVideo();
                return;
            }
            if (!isOverlayMusicPlaying) {
                renderVideoSuggestions();
                showSection('video-suggestions-section');
            }
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
            if (backgroundMusic && backgroundMusicSwitch.checked) backgroundMusic.play();
        } else if (event.data === YT.PlayerState.PAUSED) {
            if (!isOverlayMusicPlaying) {
                renderVideoSuggestions();
                showSection('video-suggestions-section');
            }
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
        } else {
            if (playPauseBtn) playPauseBtn.className = 'fas fa-play';
        }
    
        if (activePlayer && activePlayer.getVideoData) {
            const videoData = activePlayer.getVideoData();
            if (videoData && videoData.video_id) {
                 currentVideoId = videoData.video_id;
            }
        }
    }

    function loadAndPlayVideo(item) {
        if (!largePlayer || !mediumPlayer) return;
    
        const isMusicTitle = item.album && item.year; // Heuristic to detect a music title
    
        // Stop the other player
        (isMusicTitle ? largePlayer : mediumPlayer).stopVideo();
    
        activePlayer = isMusicTitle ? mediumPlayer : largePlayer;
        
        updateMp3PlayerInfo(item);
    
        if (isMusicTitle) {
            renderMusicTitleDetails(item);
            showSection('music-title-details-section');
        } else {
            showSection('large-player-section');
        }
    
        currentVideoId = item.youtube_id;
        activePlayer.loadVideoById(currentVideoId, 0);
        activePlayer.playVideo();
    }
    
    function findItemByYoutubeId(youtubeId) {
        return Object.values(allSearchableItems).find(item => item.youtube_id === youtubeId) || null;
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

    function renderCards(containerId, cardsData) {
        const cardsContainer = document.getElementById(containerId);
        if (!cardsContainer) return;
        cardsContainer.innerHTML = '';

        if (Object.keys(cardsData).length === 0) {
            cardsContainer.innerHTML = '<p class="no-results">Aucun résultat trouvé.</p>';
            return;
        }

        for (const cardKey in cardsData) {
            const item = cardsData[cardKey];
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.itemId = cardKey; 
            card.dataset.itemType = containerId.includes('titles') ? 'title' : 'video';

            const imagePath = item.image || 'https://via.placeholder.com/200x120/9E9E9E/FFFFFF?text=No+Image';
            const loopButtonHtml = item.loopable ? `<div class="loop-me-button">Loop Me!</div>` : '';

            card.innerHTML = `
                ${loopButtonHtml}
                <a href="#" data-video-id="${item.youtube_id}">
                    <img src="${imagePath}" alt="${item.title}">
                    <h3>${item.title}</h3>
                </a>
            `;
            cardsContainer.appendChild(card);
        }
    }

    function renderProjectCards(containerId, cardsData) {
        const cardsContainer = document.getElementById(containerId);
        if (!cardsContainer) return;
        cardsContainer.innerHTML = '';

        for (const cardKey in cardsData) {
            const item = cardsData[cardKey];
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<a href="#" data-link="${item.link}"><img src="${item.image}" alt="${item.title}"><h3>${item.title}</h3></a>`;
            cardsContainer.appendChild(card);
        }
    }

    function renderMusicTitleDetails(item) {
        document.getElementById('details-title').textContent = item.title;
        document.getElementById('details-album').textContent = item.album;
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
        const allTitles = Object.values(titlesData);
        const shuffled = allTitles.sort(() => 0.5 - Math.random());
        const suggestions = shuffled.slice(0, 4);
        const suggestionData = {};
        suggestions.forEach((item, index) => {
            suggestionData[`suggestion${index}`] = item;
        });
        renderCards('suggestions-cards', suggestionData);
    }

    function updateMp3PlayerInfo(item) {
        const mp3PlayerContainer = document.getElementById('mp3-player-container');
        if (item && item.title) {
            mp3PlayerContainer.classList.remove('hidden');
            document.getElementById('song-title').textContent = item.title;
            const playerCover = document.getElementById('player-album-cover');
            const isMedia = (item.tags || []).some(tag => ['gameplay', 'making of'].includes(tag));
            playerCover.style.display = isMedia ? 'none' : 'block';
            playerCover.src = item.image || 'https://via.placeholder.com/120';
        } else {
            mp3PlayerContainer.classList.add('hidden');
            document.getElementById('song-title').textContent = '';
        }
    }
    
    function updateProgressBar() {
        if (!activePlayer || typeof activePlayer.getCurrentTime !== 'function') return;
        const progressFill = document.getElementById('progress-fill');
        const currentTime = activePlayer.getCurrentTime();
        const duration = activePlayer.getDuration();
        if (duration > 0 && progressFill) {
            progressFill.style.width = `${(currentTime / duration) * 100}%`;
        }
    }

    function showSection(sectionId, updateHistory = true) {
        document.querySelectorAll('.content-section-board .page-section').forEach(s => s.classList.add('hidden'));
        const sectionToShow = document.getElementById(sectionId);
        if (sectionToShow) sectionToShow.classList.remove('hidden');
        if (updateHistory && sectionHistory[sectionHistory.length - 1] !== sectionId) {
            sectionHistory.push(sectionId);
        }
    }
    
    function updateVisibleCards() {
        const query = document.getElementById('search-input').value.toLowerCase().trim();
        const checkedTags = Array.from(document.querySelectorAll('#tags-filter-list input:checked')).map(cb => cb.value.toLowerCase());
        const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
        
        let sourceData = (activeProfile === 'mmg-music') 
            ? { ...titlesData, ...gameplayData, ...makingofsData }
            : { ...beatsTitlesData, ...beatsGameplayData, ...beatsMakingofsData };

        const filteredResults = Object.fromEntries(Object.entries(sourceData).filter(([key, item]) => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const itemTags = (item.tags || []).map(t => t.toLowerCase());
            const tagsMatch = checkedTags.length === 0 || checkedTags.every(tag => itemTags.includes(tag));
            return titleMatch && tagsMatch;
        }));

        showSection('search-results-section');
        renderCards('search-results-cards', filteredResults);
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
        if (activePlayer && typeof activePlayer.stopVideo === 'function') activePlayer.stopVideo();
        activePlayer = null;
        updateMp3PlayerInfo(null);
        renderProjectCards('content-cards', projectData['mmg-music']);
        showSection('menu-cards-section');
        sectionHistory = ['menu-cards-section'];
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================
    renderProjectCards('content-cards', projectData['mmg-music']);
    updateMp3PlayerInfo(null);
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
            if(previousSectionId === 'menu-cards-section') {
                 if (activePlayer && typeof activePlayer.stopVideo === 'function') activePlayer.stopVideo();
                 updateMp3PlayerInfo(null);
            }
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
            renderProjectCards('content-cards', projectData[tab.dataset.project]);
        });
    });
    
    // CORRECTED: Main click listener on the document
    document.addEventListener('click', (e) => {
        const cardLink = e.target.closest('.card a');
        if (!cardLink) return; // Exit if the click was not on a card link

        e.preventDefault();
        playAudio(sounds.select);

        const videoId = cardLink.dataset.videoId;
        const dataLink = cardLink.dataset.link;

        if (videoId) {
            const item = findItemByYoutubeId(videoId);
            if (item) {
                loadAndPlayVideo(item);
            }
        } else if (dataLink) {
            // Handle clicks on main menu cards (like "Music Titles")
            const sections = {
                'titles-section': titlesData, 'gameplay-section': gameplayData, 'makingofs-section': makingofsData,
                'beats-titles-section': beatsTitlesData, 'beats-gameplay-section': beatsGameplayData, 'beats-makingofs-section': beatsMakingofsData
            };
            if (sections[dataLink]) {
                renderCards(dataLink.replace('-section', '-cards'), sections[dataLink]);
            } else if (dataLink === 'about-section') {
                const activeProfile = document.querySelector('.profile-tab.active')?.dataset.project || 'mmg-music';
                document.getElementById('about-title').textContent = `About ${activeProfile === 'mmg-music' ? 'Mmg Music' : 'Mmg Beats'}`;
                document.getElementById('about-content').innerHTML = aboutContent[activeProfile];
            }
            showSection(dataLink);
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
        if (!activePlayer) return;
        const state = activePlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) activePlayer.pauseVideo();
        else activePlayer.playVideo();
    });

    const changeTrack = (direction) => {
        playAudio(sounds.select);
        if (!activePlayer || !currentVideoId) return;
        const allItems = Object.values(allSearchableItems);
        let currentIndex = allItems.findIndex(item => item.youtube_id === currentVideoId);
        if (currentIndex === -1) return;
        currentIndex = (currentIndex + direction + allItems.length) % allItems.length;
        loadAndPlayVideo(allItems[currentIndex]);
    };

    document.getElementById('next-video-btn')?.addEventListener('click', () => changeTrack(1));
    document.getElementById('prev-video-btn')?.addEventListener('click', () => changeTrack(-1));
    
    document.getElementById('loop-btn')?.addEventListener('click', (e) => {
        isPlayerLooping = !isPlayerLooping;
        e.target.classList.toggle('active', isPlayerLooping);
        playAudio(sounds.select);
    });

    document.getElementById('share-btn')?.addEventListener('click', () => {
        if (!currentVideoId) return;
        const url = `https://www.youtube.com/watch?v=${currentVideoId}`;
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
        if (largePlayer && typeof largePlayer.setVolume === 'function') largePlayer.setVolume(e.target.value);
        if (mediumPlayer && typeof mediumPlayer.setVolume === 'function') mediumPlayer.setVolume(e.target.value);
    });

    function pauseMediaForOverlay() {
        isOverlayMusicPlaying = true;
        document.getElementById('background-music').pause();
        if (activePlayer && typeof activePlayer.getPlayerState === 'function' && activePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
            pausedForOverlay.playerState = activePlayer.getPlayerState();
            pausedForOverlay.videoId = currentVideoId;
            pausedForOverlay.time = activePlayer.getCurrentTime();
            activePlayer.pauseVideo();
        } else {
            pausedForOverlay.playerState = null;
        }
    }

    function resumeMediaAfterOverlay() {
        isOverlayMusicPlaying = false;
        if (pausedForOverlay.playerState === YT.PlayerState.PLAYING) {
            if(activePlayer && activePlayer.getVideoUrl().includes(pausedForOverlay.videoId)) {
                activePlayer.playVideo();
            } else if (activePlayer) {
                activePlayer.loadVideoById(pausedForOverlay.videoId, pausedForOverlay.time);
                activePlayer.playVideo();
            }
        } else {
             if (document.getElementById('background-music-switch').checked) {
                document.getElementById('background-music').play();
             }
        }
        pausedForOverlay.playerState = null;
    }

    const setupOverlay = (btnId, overlayId, closeBtnClass, openSound, closeSound) => {
        const btn = document.getElementById(btnId);
        const overlay = document.getElementById(overlayId);
        const closeBtn = overlay?.querySelector(closeBtnClass);

        btn?.addEventListener('click', (e) => {
            e.preventDefault();
            pauseMediaForOverlay();
            if (openSound) playAudio(sounds[openSound]);
            
            if (btnId === 'wifi-btn') {
                const connectingVideoId = '4UePlHWHxFo';
                const tempPlayer = activePlayer || largePlayer;
                tempPlayer.loadVideoById(connectingVideoId);
                tempPlayer.playVideo();
                
                const wifiEndListener = (event) => {
                    if(event.data === YT.PlayerState.ENDED && event.target.getVideoUrl().includes(connectingVideoId)) {
                       closeBtn.click(); // Simulate a click on the close button
                       event.target.removeEventListener('onStateChange', wifiEndListener);
                       showDialog("Connection successful!");
                    }
                };
                tempPlayer.addEventListener('onStateChange', wifiEndListener);
            }

            overlay.classList.remove('hidden');
            overlay.style.opacity = 1;
        });

        closeBtn?.addEventListener('click', () => {
            if (closeSound) playAudio(sounds[closeSound]);
            if (openSound === 'shop') sounds.shop.pause();

            if (btnId === 'wifi-btn' && (activePlayer || largePlayer).getVideoUrl().includes('4UePlHWHxFo')) {
                 (activePlayer || largePlayer).stopVideo();
            }
            
            overlay.style.opacity = 0;
            setTimeout(() => overlay.classList.add('hidden'), 500);
            resumeMediaAfterOverlay();
        });
    };

    setupOverlay('settings-btn', 'settings-overlay', '.close-settings-btn', 'select', 'back');
    setupOverlay('shop-btn', 'shop-overlay', '.close-shop-btn', 'shop', 'back');
    setupOverlay('wifi-btn', 'wifi-overlay', '.close-wifi-btn', 'select', 'back');

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
        if (e.target.closest('.card, .profile-tab, .settings, #mp3-player-container i, #toggle-tags-filter')) {
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
});
