// Script pour afficher l'heure en temps réel
function updateTime() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();

    minutes = minutes < 10 ? '0' + minutes : minutes;
    hours = hours < 10 ? '0' + hours : hours;

    const timeString = `${hours}:${minutes}`;
    const timeElement = document.getElementById('real-time');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

updateTime();
setInterval(updateTime, 1000);

// Fonction pour jouer un son
function playSound(audioId) {
    const sound = document.getElementById(audioId);
    if (sound) {
        sound.currentTime = 0;
        sound.play();
    }
}

// Bouton "Back"
const backButton = document.querySelector('.back-btn');
if (backButton) {
    backButton.addEventListener('click', () => {
        playSound('back-sound');
        // Redirige vers la page précédente
        // window.history.back();
    });
}

// Clic sur les cartes
const cards = document.querySelectorAll('.card a'); // Cibler les liens pour une meilleure UX
cards.forEach(card => {
    card.addEventListener('click', (e) => {
        e.preventDefault(); // Empêcher la redirection immédiate
        playSound('select-sound');
        setTimeout(() => {
            window.location.href = card.href;
        }, 300); // Laisse le temps au son de jouer avant de changer de page
    });
});

// Changement de thème (commutateur)
const themeSwitch = document.getElementById('theme-switch');

if (themeSwitch) {
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeSwitch.checked = true;
    }

    themeSwitch.addEventListener('change', () => {
        const body = document.body;
        body.classList.toggle('dark-theme');

        if (body.classList.contains('dark-theme')) {
            playSound('switch-to-black-sound');
            localStorage.setItem('theme', 'dark');
        } else {
            playSound('switch-to-white-sound');
            localStorage.setItem('theme', 'light');
        }
    });
}

// Lancement de la musique de fond
const backgroundMusic = document.getElementById('background-music');
const startButton = document.querySelector('.start-btn');
if (backgroundMusic && startButton) {
    startButton.addEventListener('click', () => {
        backgroundMusic.play();
    });
}