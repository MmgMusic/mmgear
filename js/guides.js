/* Système de gestion des guides interactifs */

class GuideManager {
    constructor() {
        this.currentGuide = null;
        this.currentIndex = 0;
        this.overlay = null;
        this.tooltip = null;
        this.activeElement = null;

        // Initialisation au chargement
        document.addEventListener('DOMContentLoaded', () => {
            this.init();
            this.setupTriggers();

            // Gestion du redimensionnement pour repositionner le tooltip
            window.addEventListener('resize', () => {
                if (this.currentGuide && this.activeElement) {
                    this.repositionTooltip();
                }
            });
        });
    }

    init() {
        // Création de l'overlay s'il n'existe pas OU s'il est détaché du DOM
        this.overlay = document.getElementById('guide-overlay');
        if (!this.overlay || !document.body.contains(this.overlay)) {
            if (!this.overlay) {
                this.overlay = document.createElement('div');
                this.overlay.id = 'guide-overlay';
            }
            document.body.appendChild(this.overlay);
        }

        // Création du tooltip s'il n'existe pas OU s'il est détaché du DOM
        this.tooltip = document.getElementById('guide-tooltip');
        if (!this.tooltip || !document.body.contains(this.tooltip)) {
            if (!this.tooltip) {
                this.tooltip = document.createElement('div');
                this.tooltip.id = 'guide-tooltip';
                this.tooltip.innerHTML = `
                    <div class="guide-header">
                        <div class="guide-header-left">
                            <span class="guide-badge">GUIDE</span>
                            <div class="guide-progress"></div>
                        </div>
                        <button class="guide-close" title="Fermer"><i class="fas fa-times"></i></button>
                    </div>
                    <h3 class="guide-title"></h3>
                    <p class="guide-content"></p>
                    <div class="guide-footer">
                        <span></span>
                        <div class="guide-nav-buttons">
                            <button class="guide-btn guide-btn-prev" title="Précédent"><i class="fas fa-arrow-left"></i></button>
                            <button class="guide-btn guide-btn-next" title="Suivant"><i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>
                `;
            }
            document.body.appendChild(this.tooltip);

            // Listeners internes (seulement si on vient de créer le tooltip)
            this.tooltip.querySelector('.guide-close').addEventListener('click', () => this.stop());
            this.tooltip.querySelector('.guide-btn-prev').addEventListener('click', () => this.prevStep());
            this.tooltip.querySelector('.guide-btn-next').addEventListener('click', () => this.nextStep());
        }
        // Création du marqueur HUD
        this.marker = document.getElementById('guide-marker');
        if (!this.marker || !document.body.contains(this.marker)) {
            if (!this.marker) {
                this.marker = document.createElement('div');
                this.marker.id = 'guide-marker';
                this.marker.innerHTML = `
                    <div class="corner corner-tl"></div>
                    <div class="corner corner-tr"></div>
                    <div class="corner corner-bl"></div>
                    <div class="corner corner-br"></div>
                `;
            }
            document.body.appendChild(this.marker);
        }
    }

    setupTriggers() {
        // Délégation d'événements pour les boutons avec data-guide
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-guide]');
            if (btn) {
                const guideKey = btn.getAttribute('data-guide');
                // Fermer l'overlay de sélection si ouvert
                const selectionOverlay = document.getElementById('guide-selection-overlay');
                if (selectionOverlay && !selectionOverlay.classList.contains('hidden')) {
                    selectionOverlay.classList.add('hidden');
                }

                this.start(guideKey);
            }
        });
    }

    start(guideKey) {
        // CORRECTION: Ensure init has been called AND elements are in DOM
        if (!this.tooltip || !document.body.contains(this.tooltip)) {
            this.init();
        }

        const isMobile = window.innerWidth <= 952 || document.body.classList.contains('is-mobile');
        const guideToLoad = (isMobile && GUIDE_STEPS[guideKey + '_mobile']) ? guideKey + '_mobile' : guideKey;

        if (typeof GUIDE_STEPS === 'undefined' || !GUIDE_STEPS[guideToLoad]) {
            console.error("Guide introuvable:", guideToLoad);
            return;
        }

        this.currentGuide = GUIDE_STEPS[guideToLoad];
        this.currentIndex = 0;

        this.overlay.classList.add('active');
        this.tooltip.classList.add('visible');

        this.showStep(0);

        // NOUVEAU: Intervalle de synchronisation permanente
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            if (this.activeElement && this.currentGuide) {
                this.syncPositions();
            }
        }, 16);
    }

    stop() {
        this.overlay.classList.remove('active');
        this.tooltip.classList.remove('visible');
        if (this.marker) this.marker.classList.remove('active');
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.removeHighlight();
        this.resetOverlayMask();
        this.currentGuide = null;
        this.currentIndex = 0;
    }

    showStep(index) {
        if (!this.currentGuide || index < 0 || index >= this.currentGuide.length) {
            this.stop();
            return;
        }

        this.currentIndex = index;
        const step = this.currentGuide[index];
        const lang = this.getCurrentLanguage();

        // 1. Mise à jour du contenu
        this.tooltip.querySelector('.guide-title').textContent = step.title[lang] || step.title['fr'];
        this.tooltip.querySelector('.guide-content').textContent = step.content[lang] || step.content['fr'];

        // 2. Gestion des boutons
        const prevBtn = this.tooltip.querySelector('.guide-btn-prev');
        const nextBtn = this.tooltip.querySelector('.guide-btn-next');

        prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';

        const isLastStep = index === this.currentGuide.length - 1;

        if (isLastStep) {
            nextBtn.innerHTML = '<i class="fas fa-check"></i>';
            nextBtn.classList.add('finish-btn');
            nextBtn.setAttribute('title', lang === 'fr' ? 'Terminer' : 'Finish');
        } else {
            nextBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
            nextBtn.classList.remove('finish-btn');
            nextBtn.setAttribute('title', lang === 'fr' ? 'Suivant' : 'Next');
        }

        prevBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';

        // 3. Mise à jour des points de progression
        const progressContainer = this.tooltip.querySelector('.guide-progress');
        progressContainer.innerHTML = '';
        this.currentGuide.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = `guide-dot ${i === index ? 'active' : ''}`;
            progressContainer.appendChild(dot);
        });

        // 4. Exécution du callback onEnter si présent
        if (step.onEnter && typeof step.onEnter === 'function') {
            try {
                step.onEnter();
            } catch (e) {
                console.error('Erreur dans onEnter:', e);
            }
        }

        // 5. Ciblage et Positionnement (avec délai pour laisser le temps aux transitions)
        this.removeHighlight();

        const delay = step.delay || 500; // Augmenté à 500ms par défaut pour plus de sécurité

        setTimeout(() => {
            this.findAndHighlightTarget(step);
        }, delay);
    }

    findAndHighlightTarget(step) {
        this.removeHighlight();
        const visibleElements = [];

        for (const selector of step.targets) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const isVisible = el.offsetParent !== null || el.classList.contains('fixed') || getComputedStyle(el).display !== 'none';
                if (el && isVisible && rect.width > 0) {
                    visibleElements.push(el);
                }
            });
        }

        if (visibleElements.length > 0) {
            visibleElements.forEach(el => el.classList.add('guide-highlighted'));

            // Calculer l'enveloppe globale
            let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
            visibleElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                minTop = Math.min(minTop, rect.top);
                minLeft = Math.min(minLeft, rect.left);
                maxRight = Math.max(maxRight, rect.right);
                maxBottom = Math.max(maxBottom, rect.bottom);
            });

            const unionRect = {
                top: minTop,
                left: minLeft,
                width: maxRight - minLeft,
                height: maxBottom - minTop
            };

            const primaryTarget = visibleElements[0];
            this.activeElement = primaryTarget;

            // Scroll vers la cible principale
            primaryTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

            // On positionne immédiatement pour éviter le flash, puis on laisse le syncInterval gérer le mouvement
            this.syncPositions();

            setTimeout(() => {
                this.positionTooltip(primaryTarget, step.position);
                this.syncPositions();
            }, 600); // Délai après scroll pour stabiliser le tooltip

        } else {
            this.tooltip.style.top = '50%';
            this.tooltip.style.left = '50%';
            this.tooltip.style.transform = 'translate(-50%, -50%)';
            this.activeElement = null;
        }
    }

    highlightElement(el) {
        el.classList.add('guide-highlighted');
    }

    removeHighlight() {
        document.querySelectorAll('.guide-highlighted').forEach(el => {
            el.classList.remove('guide-highlighted');
        });
        if (this.marker) this.marker.classList.remove('active');
        this.activeElement = null;
    }

    updateMarker(el) {
        if (!el) return;
        this.updateMarkerFromRect(el.getBoundingClientRect());
    }

    // NOUVEAU: Calcule l'enveloppe de toutes les cibles actuelles
    syncPositions() {
        if (!this.activeElement || !this.currentGuide) return;

        const step = this.currentGuide[this.currentIndex];
        const visibleElements = [];

        for (const selector of step.targets) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const isVisible = el.offsetParent !== null || el.className.includes('fixed') || getComputedStyle(el).display !== 'none';
                if (isVisible && rect.width > 0) visibleElements.push(el);
            });
        }

        if (visibleElements.length > 0) {
            let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
            visibleElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                minTop = Math.min(minTop, rect.top);
                minLeft = Math.min(minLeft, rect.left);
                maxRight = Math.max(maxRight, rect.right);
                maxBottom = Math.max(maxBottom, rect.bottom);
            });

            this.updateMarkerFromRect({
                top: minTop,
                left: minLeft,
                width: maxRight - minLeft,
                height: maxBottom - minTop
            });

            // On repositionne aussi le tooltip pour qu'il suive le mouvement (scroll, etc)
            this.positionTooltip(visibleElements[0], step.position);
        }
    }

    updateMarkerFromRect(rect) {
        if (!this.marker || !rect) return;

        const offset = 8;
        this.marker.style.width = `${rect.width + (offset * 2)}px`;
        this.marker.style.height = `${rect.height + (offset * 2)}px`;
        this.marker.style.top = `${rect.top - offset}px`;
        this.marker.style.left = `${rect.left - offset}px`;

        this.marker.classList.add('active');
    }

    updateOverlayMask(rect) {
        // Désactivé car le flou est retiré
        return;
    }

    resetOverlayMask() {
    }

    positionTooltip(target, positionPreference) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const margin = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top, left;

        // Pour les très grands éléments (plus de 50% de la hauteur de l'écran),
        // on centre le tooltip à l'écran plutôt que de le positionner par rapport à l'élément
        if (rect.height > viewportHeight * 0.5) {
            // Centrer verticalement dans le viewport
            top = (viewportHeight - tooltipRect.height) / 2;
            left = (viewportWidth - tooltipRect.width) / 2;
        } else {
            // Position par défaut: en dessous de l'élément
            top = rect.bottom + margin;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

            // Si ça sort en bas du viewport, mettre au-dessus
            if (top + tooltipRect.height > viewportHeight - margin) {
                top = rect.top - tooltipRect.height - margin;
            }

            // Si ça sort encore en haut (élément en haut de page), forcer dans le viewport
            if (top < margin) {
                // Positionner à côté de l'élément si possible
                if (rect.right + tooltipRect.width + margin < viewportWidth) {
                    // À droite
                    left = rect.right + margin;
                    top = Math.max(margin, Math.min(rect.top, viewportHeight - tooltipRect.height - margin));
                } else if (rect.left - tooltipRect.width - margin > 0) {
                    // À gauche
                    left = rect.left - tooltipRect.width - margin;
                    top = Math.max(margin, Math.min(rect.top, viewportHeight - tooltipRect.height - margin));
                } else {
                    // Dernier recours: centrer dans le viewport
                    top = margin;
                    left = (viewportWidth - tooltipRect.width) / 2;
                }
            }

            // Ajustements latéraux pour ne pas sortir du viewport
            if (left < margin) left = margin;
            if (left + tooltipRect.width > viewportWidth - margin) {
                left = viewportWidth - tooltipRect.width - margin;
            }
        }

        // S'assurer que le tooltip est toujours dans le viewport
        top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
        left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.transform = 'none';
    }

    repositionTooltip() {
        // Désormais géré en quasi-temps réel par syncPositions/syncInterval
        if (this.activeElement && this.currentGuide) {
            this.syncPositions();
        }
    }

    nextStep() {
        this.showStep(this.currentIndex + 1);
    }

    prevStep() {
        this.showStep(this.currentIndex - 1);
    }

    getCurrentLanguage() {
        return localStorage.getItem('userLanguage') || 'fr';
    }
}

// Instance globale
window.guideManager = new GuideManager();
