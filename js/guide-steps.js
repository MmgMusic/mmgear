/* Données structurées pour le système de guides interactifs */

window.GUIDE_STEPS = {
    // GUIDE 1 : Navigation et Interface
    navigation: [
        {
            id: 'nav_switch',
            targets: ['#mmg-branding', '#spotimon-profile-switch'],
            title: { fr: "Le Switch d'Univers", en: "Universe Switch" },
            content: {
                fr: "Passez instantanément de MMG MUSIC (albums, clips) à MMG BEATS (instruments) en cliquant ici.",
                en: "Switch instantly between MMG MUSIC (albums, videos) and MMG BEATS (instrumentals) by clicking here."
            },
            position: 'right'
        },
        {
            id: 'nav_sidebar',
            targets: ['#sidebar-main-nav'],
            title: { fr: "Onglets Sidebar", en: "Sidebar Tabs" },
            content: {
                fr: "Explorez l'univers : Accueil, Albums, Vidéos, Boutique et Bibliothèque sont à portée de clic.",
                en: "Explore the universe: Home, Albums, Videos, Shop, and Library are just a click away."
            },
            position: 'right'
        },
        {
            id: 'nav_search_tags',
            targets: ['.search-bar'],
            title: { fr: "Recherche et Tags", en: "Search and Tags" },
            content: {
                fr: "Cherchez un titre ou utilisez les tags pour filtrer par style (Vibe, Instrument, etc.). Toute la barre est à votre disposition.",
                en: "Search for a track or use tags to filter by style (Vibe, Instrument, etc.). The entire bar is at your service."
            },
            position: 'bottom'
        },
        {
            id: 'nav_notifs',
            targets: ['#notifications-btn'],
            title: { fr: "Notifications", en: "Notifications" },
            content: {
                fr: "Ici s'affichent vos récompenses, nouveautés et messages importants.",
                en: "Your rewards, latest updates, and important messages appear here."
            },
            position: 'bottom'
        },
        {
            id: 'nav_settings',
            targets: ['#top-bar-settings-btn'],
            title: { fr: "Paramètres", en: "Settings" },
            content: {
                fr: "Changez de thème (Clair/Sombre), gérez les sons et personnalisez votre expérience.",
                en: "Change themes (Light/Dark), manage sounds, and personalize your experience."
            },
            position: 'bottom'
        },

        {
            id: 'nav_player_controls',
            targets: ['.player-buttons'],
            title: { fr: "Contrôles Musicaux", en: "Music Controls" },
            content: {
                fr: "Gérez votre lecture : Aléatoire, Précédent, Play/Pause, Suivant et Répétition.",
                en: "Manage your playback: Shuffle, Previous, Play/Pause, Next, and Repeat."
            },
            position: 'top'
        },
        {
            id: 'nav_player_cover',
            targets: ['#player-album-cover'],
            title: { fr: "Pochette & Détails", en: "Cover & Details" },
            content: {
                fr: "Cette zone affiche la pochette du titre. Cliquez dessus pour ouvrir la vue détaillée.",
                en: "This area shows the track cover. Click it to open the detailed view."
            },
            position: 'top',
            onEnter: () => {
                const cover = document.getElementById('player-album-cover');
                if (cover && (!cover.src || cover.src.includes('data:image/svg+xml'))) {
                    cover.src = 'assets/mmg-music-avatar.webp'; // Placeholder temporaire
                }
            }
        },
        {
            id: 'nav_player_actions',
            targets: ['#player-like-btn', '#player-add-to-playlist-btn'],
            title: { fr: "Favoris & Playlists", en: "Favorites & Playlists" },
            content: {
                fr: "Utilisez ces icônes pour liker le titre ou l'ajouter à vos playlists personnelles.",
                en: "Use these icons to like the track or add it to your personal playlists."
            },
            position: 'top'
        },
        {
            id: 'nav_autoplay',
            targets: ['#autoplay-toggle'],
            title: { fr: "Autoplay", en: "Autoplay" },
            content: {
                fr: "Activez l'autoplay pour que MMGEAR vous propose automatiquement la suite après chaque titre.",
                en: "Enable autoplay so MMGEAR automatically suggests what to play next after each track."
            },
            position: 'top'
        },
        {
            id: 'nav_player_secondary',
            targets: ['.player-right-controls'],
            title: { fr: "Options avancées", en: "Advanced Options" },
            content: {
                fr: "Ici vous trouvez le partage, la file d'attente et le contrôle du volume.",
                en: "Here you'll find share, queue, and volume controls."
            },
            position: 'top'
        }
    ],

    navigation_mobile: [
        {
            id: 'nav_switch_mobile',
            targets: ['#mobile-header-logo-container', '#mobile-profile-switch'],
            title: { fr: "Le Switch", en: "The Switch" },
            content: {
                fr: "Passez de MMG MUSIC à MMG BEATS en cliquant sur le logo ou le sélecteur.",
                en: "Switch between MMG MUSIC and MMG BEATS by clicking the logo or the selector."
            },
            position: 'bottom'
        },
        {
            id: 'nav_bottom_mobile',
            targets: ['#mobile-bottom-nav'],
            title: { fr: "Navigation Bas", en: "Bottom Navigation" },
            content: {
                fr: "La barre principale : Accueil, Albums, Vidéos, Boutique et Bibliothèque.",
                en: "The main bar: Home, Albums, Videos, Shop, and Library."
            },
            position: 'top'
        },
        {
            id: 'nav_search_mobile',
            targets: ['#mobile-search-btn'],
            title: { fr: "Recherche et Tags", en: "Search and Tags" },
            content: {
                fr: "Ouvrez la recherche globale et accédez aux filtres par tags ici.",
                en: "Open global search and access tag filters here."
            },
            position: 'bottom'
        },
        {
            id: 'nav_notifs_mobile',
            targets: ['#mobile-notifications-btn'],
            title: { fr: "Notifications", en: "Notifications" },
            content: {
                fr: "Gardez un œil sur les récompenses et nouveautés débloquées.",
                en: "Keep an eye on unlocked rewards and news."
            },
            position: 'bottom'
        },
        {
            id: 'nav_settings_mobile',
            targets: ['#mobile-settings-btn'],
            title: { fr: "Paramètres", en: "Settings" },
            content: {
                fr: "Tout pour personnaliser votre expérience et changer de thème sur mobile.",
                en: "Everything to customize your experience and change themes on mobile."
            },
            position: 'bottom'
        },
        {
            id: 'nav_mini_player_mobile',
            targets: ['#mobile-mini-player'],
            title: { fr: "Le Mini Player", en: "The Mini Player" },
            content: {
                fr: "Contrôlez votre musique de partout. Cliquez ou balayez vers le haut pour le voir en grand !",
                en: "Control your music from anywhere. Click or swipe up to see it in full!"
            },
            position: 'top',
            onEnter: () => {
                // Assurer que le mini player est visible pour l'étape suivante
                const miniPlayer = document.getElementById('mobile-mini-player');
                if (miniPlayer) miniPlayer.classList.remove('hidden');
            }
        },
        {
            id: 'nav_controls_mobile',
            targets: ['.mobile-player-controls'],
            title: { fr: "Contrôles Musicaux", en: "Music Controls" },
            content: {
                fr: "Les contrôles essentiels : Aléatoire, Précédent, Play, Suivant et Répétition.",
                en: "Essential controls: Shuffle, Previous, Play, Next, and Repeat."
            },
            position: 'top',
            onEnter: () => {
                // Ouvrir le plein écran pour montrer les contrôles
                if (window.showMobileFullPlayer) window.showMobileFullPlayer();
            }
        },
        {
            id: 'nav_cover_mobile',
            targets: ['#mobile-player-album-art'],
            title: { fr: "Pochette Progressive", en: "Progressive Cover" },
            content: {
                fr: "La pochette centrale vous montre l'univers graphique du titre actuel.",
                en: "The central cover shows you the graphic universe of the current track."
            },
            position: 'bottom'
        },
        {
            id: 'nav_actions_mobile',
            targets: ['.mobile-player-secondary-controls'],
            title: { fr: "Like & Playlist", en: "Like & Playlist" },
            content: {
                fr: "Aimez le titre ou créez vos playlists directement depuis le lecteur.",
                en: "Like the track or create your playlists directly from the player."
            },
            position: 'top'
        },
        {
            id: 'nav_autoplay_mobile',
            targets: ['#mobile-player-autoplay-btn'],
            title: { fr: "Autoplay Mobile", en: "Mobile Autoplay" },
            content: {
                fr: "Ne laissez jamais le silence s'installer grâce à la lecture automatique.",
                en: "Never let silence settle in thanks to auto-playback."
            },
            position: 'top'
        },
        {
            id: 'nav_secondary_mobile',
            targets: ['.mobile-player-bottom-actions'],
            title: { fr: "Sons, File & Volume", en: "Sounds, Queue & Volume" },
            content: {
                fr: "Partage, file d'attente et gestion du volume sont regroupés ici.",
                en: "Sharing, queue, and volume management are grouped here."
            },
            position: 'top'
        },
        {
            id: 'nav_artwork_click',
            targets: ['.mobile-player-art-wrapper'],
            title: { fr: "Vue Artwork", en: "Artwork View" },
            content: {
                fr: "Cliquez sur la pochette en plein écran pour l'admirer sans les contrôles.",
                en: "Click the full-screen cover to admire it without the controls."
            },
            position: 'bottom'
        }
    ],

    // GUIDE 2 : Sections du Site
    pages: [
        {
            id: 'guide2_carousel',
            targets: ['.carousel-card'],
            title: { fr: "Carrousel d'accueil", en: "Home Carousel" },
            content: {
                fr: "Les sorties majeures et les actualités brûlantes s'affichent ici en boucle.",
                en: "Major releases and hot news are displayed here in a loop."
            },
            position: 'bottom',
            onEnter: () => {
                if (window.handleMenuNavigation) {
                    window.handleMenuNavigation('home-dashboard-section');
                } else {
                    const homeLink = document.querySelector('#sidebar-main-nav .sidebar-nav-link[data-link="home-dashboard-section"]');
                    if (homeLink) homeLink.click();
                }
            }
        },
        {
            id: 'guide2_bonus',
            targets: ['#daily-bonus-section'],
            title: { fr: "Daily Bonus", en: "Daily Bonus" },
            content: {
                fr: "N'oubliez pas de réclamer vos pièces quotidiennes pour débloquer du contenu !",
                en: "Don't forget to claim your daily coins to unlock content!"
            },
            position: 'left'
        },
        {
            id: 'guide2_upcoming',
            targets: ['.upcoming-release-card'],
            title: { fr: "Prochaine sortie", en: "Upcoming Release" },
            content: {
                fr: "Un aperçu de ce qui arrive très bientôt dans l'univers MMGEAR.",
                en: "A preview of what's coming very soon to the MMGEAR universe."
            },
            position: 'left'
        },
        {
            id: 'guide2_playlists',
            targets: ['#playlist-reco-list'],
            title: { fr: "Playlists recommandées", en: "Recommended Playlists" },
            content: {
                fr: "Une sélection de playlists pour découvrir de nouveaux horizons musicaux.",
                en: "A selection of playlists to discover new musical horizons."
            },
            position: 'top'
        },
        {
            id: 'guide2_news',
            targets: ['.news-card-container'],
            title: { fr: "News", en: "News" },
            content: {
                fr: "Restez informé des dernières mises à jour et annonces du projet.",
                en: "Stay informed about the project's latest updates and announcements."
            },
            position: 'top'
        },
        {
            id: 'guide2_guide',
            targets: ['.dashboard-guide-section'],
            title: { fr: "Guide", en: "Guide" },
            content: {
                fr: "D'ici, vous pouvez relancer les différents guides interactifs à tout moment.",
                en: "From here, you can relaunch the different interactive guides at any time."
            },
            position: 'top'
        },
        {
            id: 'guide2_about',
            targets: ['.dashboard-about-section'],
            title: { fr: "À propos", en: "About" },
            content: {
                fr: "Apprenez-en plus sur MMG et l'histoire derrière cette interface.",
                en: "Learn more about MMG and the story behind this interface."
            },
            position: 'top'
        },
        {
            id: 'guide2_albums_section',
            targets: ['#albums-section'],
            title: { fr: "Section Albums", en: "Albums Section" },
            content: {
                fr: "Explorez toute la discographie classée par albums et singles.",
                en: "Explore the entire discography sorted by albums and singles."
            },
            position: 'right',
            delay: 800,
            onEnter: () => {
                if (window.handleMenuNavigation) {
                    window.handleMenuNavigation('albums-section');
                } else {
                    const albumsLink = document.querySelector('#sidebar-main-nav .sidebar-nav-link[data-link="albums-section"]');
                    if (albumsLink) albumsLink.click();
                }
            }
        },
        {
            id: 'guide2_videos_section',
            targets: ['#videos-section'],
            title: { fr: "Section Vidéos", en: "Videos Section" },
            content: {
                fr: "Retrouvez les clips officiels et les contenus vidéos exclusifs.",
                en: "Find official music videos and exclusive video content."
            },
            position: 'right',
            delay: 800,
            onEnter: () => {
                if (window.handleMenuNavigation) {
                    window.handleMenuNavigation('videos-section');
                } else {
                    const videosLink = document.querySelector('#sidebar-main-nav .sidebar-nav-link[data-link="videos-section"]');
                    if (videosLink) videosLink.click();
                }
            }
        },
        {
            id: 'guide2_library_section',
            targets: ['#library-section'],
            title: { fr: "Section Bibliothèque", en: "Library Section" },
            content: {
                fr: "C'est ici que vivent vos favoris et vos propres playlists.",
                en: "This is where your favorites and your own playlists live."
            },
            position: 'right',
            delay: 800,
            onEnter: () => {
                if (window.handleMenuNavigation) {
                    window.handleMenuNavigation('library-section');
                } else {
                    const libraryLink = document.querySelector('#sidebar-main-nav .sidebar-nav-link[data-link="library-section"]');
                    if (libraryLink) libraryLink.click();
                }
            }
        },
        {
            id: 'guide2_shop_themes',
            targets: ['#themes-container'],
            title: { fr: "Shop - Thèmes", en: "Shop - Themes" },
            content: {
                fr: "Personnalisez l'apparence de votre interface avec des thèmes uniques.",
                en: "Customize your interface's look with unique themes."
            },
            position: 'top',
            delay: 800,
            onEnter: () => {
                if (window.handleMenuNavigation) {
                    window.handleMenuNavigation('shop-section');
                } else {
                    const shopLink = document.querySelector('#sidebar-main-nav .sidebar-nav-link[data-link="shop-section"]');
                    if (shopLink) shopLink.click();
                }
                setTimeout(() => {
                    const themesTab = document.querySelector('#shop-tabs-container button[data-tab-id="themes"]');
                    if (themesTab) themesTab.click();
                }, 500);
            }
        },
        {
            id: 'guide2_shop_bgs',
            targets: ['#backgrounds-container'],
            title: { fr: "Shop - Fonds d'écran", en: "Shop - Backgrounds" },
            content: {
                fr: "Changez l'ambiance visuelle en choisissant parmi nos fonds d'écran.",
                en: "Change the visual vibe by choosing from our wallpapers."
            },
            position: 'top',
            delay: 600,
            onEnter: () => {
                const bgsTab = document.querySelector('#shop-tabs-container button[data-tab-id="backgrounds"]');
                if (bgsTab) bgsTab.click();
            }
        },
        {
            id: 'guide2_shop_tracks',
            targets: ['#shop-tracks-container'],
            title: { fr: "Shop - Titres Bonus", en: "Shop - Bonus Tracks" },
            content: {
                fr: "Débloquez des morceaux exclusifs avec vos pièces durement gagnées !",
                en: "Unlock exclusive tracks with your hard-earned coins!"
            },
            position: 'top',
            delay: 600,
            onEnter: () => {
                const tracksTab = document.querySelector('#shop-tabs-container button[data-tab-id="tracks"]');
                if (tracksTab) tracksTab.click();
            }
        }
    ],

    pages_mobile: [
        {
            id: 'page_home_mobile',
            targets: ['#mobile-bottom-nav a[data-link="home-dashboard-section"]', '.dashboard-grid'],
            title: { fr: "🏠 Accueil", en: "🏠 Home" },
            content: {
                fr: "Votre tableau de bord avec les dernières sorties, votre bonus quotidien et les news.",
                en: "Your dashboard with latest releases, your daily bonus, and news."
            },
            position: 'top',
            delay: 400,
            onEnter: () => {
                const homeLink = document.querySelector('#mobile-bottom-nav a[data-link="home-dashboard-section"]');
                if (homeLink) homeLink.click();
            }
        },
        {
            id: 'page_albums_mobile',
            targets: ['#mobile-bottom-nav a[data-link="albums-section"]', '#albums-cards .card:first-child'],
            title: { fr: "💿 Albums", en: "💿 Albums" },
            content: {
                fr: "Toute la discographie. Cliquez sur un album pour explorer ses titres.",
                en: "The entire discography. Click an album to explore its tracks."
            },
            position: 'top',
            delay: 400,
            onEnter: () => {
                const albumsLink = document.querySelector('#mobile-bottom-nav a[data-link="albums-section"]');
                if (albumsLink) albumsLink.click();
            }
        },
        {
            id: 'page_videos_mobile',
            targets: ['#mobile-bottom-nav a[data-link="videos-section"]', '#videos-cards .card:first-child'],
            title: { fr: "🎬 Vidéos", en: "🎬 Videos" },
            content: {
                fr: "Clips et Making-ofs. Une immersion visuelle complète.",
                en: "Music Videos and Making-ofs. A complete visual immersion."
            },
            position: 'top',
            delay: 400,
            onEnter: () => {
                const videosLink = document.querySelector('#mobile-bottom-nav a[data-link="videos-section"]');
                if (videosLink) videosLink.click();
            }
        },
        {
            id: 'page_shop_mobile',
            targets: ['#mobile-bottom-nav a[data-link="shop-section"]', '.shop-product-card:first-child'],
            title: { fr: "🛒 Boutique", en: "🛒 Shop" },
            content: {
                fr: "Utilisez vos pièces pour débloquer thèmes et cadeaux !",
                en: "Use your coins to unlock themes and gifts!"
            },
            position: 'top',
            delay: 400,
            onEnter: () => {
                const shopLink = document.querySelector('#mobile-bottom-nav a[data-link="shop-section"]');
                if (shopLink) shopLink.click();
            }
        },
        {
            id: 'page_library_mobile',
            targets: ['#mobile-bottom-nav a[data-link="library-section"]', '#library-tabs-container'],
            title: { fr: "📚 Bibliothèque", en: "📚 Library" },
            content: {
                fr: "Retrouvez vos favoris et vos playlists personnelles.",
                en: "Find your favorites and personal playlists."
            },
            position: 'top',
            delay: 400,
            onEnter: () => {
                const libraryLink = document.querySelector('#mobile-bottom-nav a[data-link="library-section"]');
                if (libraryLink) libraryLink.click();
            }
        },
        {
            id: 'guide_complete_mobile',
            targets: ['#mobile-bottom-nav'],
            title: { fr: "🎉 Prêt !", en: "🎉 Ready!" },
            content: {
                fr: "Vous êtes prêt à explorer l'univers MMGEAR sur mobile. Amusez-vous bien !",
                en: "You're ready to explore segments of the MMGEAR universe on mobile. Have fun!"
            },
            position: 'top'
        }
    ]
};
