import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager } from './SaveManager';
import type { GameSave } from './SaveManager';

interface ShopItem {
  id: string;
  name: string;
  cost: number;
  category: 'themes' | 'hands';
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private clock: Clock;
  private hands: Hands;
  private questionManager: QuestionManager;
  
  private currentHours: number = 12;
  private currentMinutes: number = 0;
  
  private targetTime!: TimeTarget;
  private currentChoices: TimeTarget[] = [];
  private saveData: GameSave;
  private errorsCount: number = 0;
  private currentLevel: number = 1;
  private currentPhase: 1 | 2 = 1; // Phase 1: Lecture, Phase 2: Placement
  private phaseSuccessCount: number = 0; // 3 réussites requises par phase
  private activeShopCategory: 'themes' | 'hands' = 'themes';

  private isDragging: boolean = false;
  private activeHand: 'hour' | 'minute' = 'minute';

  private shopItems: ShopItem[] = [
    { id: 'classic', name: 'Cadran Classique', cost: 0, category: 'themes' },
    { id: 'wood', name: 'Cadran Bois', cost: 5, category: 'themes' },
    { id: 'forest', name: '🌲 Forêt Enchantée', cost: 8, category: 'themes' },
    { id: 'ocean', name: '🌊 Océan Profond', cost: 12, category: 'themes' },
    { id: 'space', name: '🚀 Cadran Espace', cost: 18, category: 'themes' },
    { id: 'classic-hands', name: 'Aiguilles Classiques', cost: 0, category: 'hands' },
    { id: 'gold-hands', name: '✨ Aiguilles Dorées', cost: 10, category: 'hands' },
    { id: 'neon-hands', name: '💡 Aiguilles Néon', cost: 15, category: 'hands' }
  ];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    this.ctx.translate(centerX, centerY);

    this.saveData = SaveManager.load();
    this.clock = new Clock(this.ctx, radius, this.saveData.activeTheme);
    this.hands = new Hands(this.ctx, radius, this.saveData.activeHands);
    this.questionManager = new QuestionManager(1);

    this.initEvents();
    this.updateMenuUI();
    this.updateUI();
  }

  public startLevel(level: number): void {
    this.currentLevel = level;
    this.currentPhase = 1;
    this.phaseSuccessCount = 0;
    this.questionManager.setLevel(level);

    // Basculer l'affichage des vues
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    const titleDisplay = document.getElementById('level-title-display');
    if (titleDisplay) titleDisplay.textContent = `Niveau ${level} (${this.getLevelName(level)})`;

    this.initNewQuestion();
    this.render();
    this.updateUI();
  }

  private returnToMenu(): void {
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.remove('hidden');
    this.updateMenuUI();
    this.updateGearsDisplay();
  }

  private initNewQuestion(): void {
    this.targetTime = this.questionManager.generateQuestion();
    this.errorsCount = 0;
    this.hideHelp();

    if (this.currentPhase === 1) {
      this.currentHours = this.targetTime.hours;
      this.currentMinutes = this.targetTime.minutes;
      this.currentChoices = this.questionManager.generateChoices(this.targetTime);
    } else {
      this.currentHours = 12;
      this.currentMinutes = 0;
    }
  }

  private initEvents(): void {
    // Gestionnaire de sélection de niveau depuis le menu
    const levelCards = document.querySelectorAll('.level-card');
    levelCards.forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const level = parseInt(target.getAttribute('data-level') || '1', 10);
        
        if (level <= (this.saveData.maxUnlockedLevel || 1)) {
          this.startLevel(level);
        } else {
          alert("🔒 Ce niveau est verrouillé ! Termine le niveau précédent pour le débloquer.");
        }
      });
    });

    const backMenuBtn = document.getElementById('back-menu-btn');
    if (backMenuBtn) {
      backMenuBtn.addEventListener('click', () => this.returnToMenu());
    }

    const getPointerPos = (e: MouseEvent | TouchEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const x = clientX - rect.left - rect.width / 2;
      const y = clientY - rect.top - rect.height / 2;
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return { x: x * scaleX, y: y * scaleY };
    };

    const onStart = (e: MouseEvent | TouchEvent) => {
      if (this.currentPhase === 1) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      
      const angle = Math.atan2(pos.x, -pos.y);
      const minAngle = (this.currentMinutes * Math.PI) / 30;
      const hrAngle = ((this.currentHours % 12) * Math.PI) / 6 + (this.currentMinutes * Math.PI) / 360;

      const diffMin = Math.abs(this.normalizeAngle(angle - minAngle));
      const diffHr = Math.abs(this.normalizeAngle(angle - hrAngle));
      const distFromCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);

      if (diffMin < diffHr || distFromCenter > this.radius * 0.6) {
        this.activeHand = 'minute';
      } else {
        this.activeHand = 'hour';
      }

      this.isDragging = true;
      this.updateFromPointer(pos.x, pos.y);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging || this.currentPhase === 1) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      this.updateFromPointer(pos.x, pos.y);
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.snapToGrid();
    };

    this.canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => this.checkPlaceAnswer());
    }

    const choiceBtns = document.querySelectorAll('.choice-btn');
    choiceBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        if (this.currentPhase === 1) {
          this.checkReadAnswer(index);
        }
      });
    });

    // Boutique
    const shopBtn = document.getElementById('shop-btn');
    const shopModal = document.getElementById('shop-modal');
    const closeShopBtn = document.getElementById('close-shop-btn');

    if (shopBtn && shopModal) {
      shopBtn.addEventListener('click', () => {
        this.renderShopItems();
        shopModal.classList.remove('hidden');
      });
    }

    if (closeShopBtn && shopModal) {
      closeShopBtn.addEventListener('click', () => {
        shopModal.classList.add('hidden');
      });
    }

    const shopTabs = document.querySelectorAll('.shop-tab');
    shopTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        shopTabs.forEach(t => t.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.activeShopCategory = target.getAttribute('data-tab') as 'themes' | 'hands';
        this.renderShopItems();
      });
    });
  }

  private updateMenuUI(): void {
    const levelCards = document.querySelectorAll('.level-card');
    const maxUnlocked = this.saveData.maxUnlockedLevel || 1;

    levelCards.forEach(card => {
      const level = parseInt(card.getAttribute('data-level') || '1', 10);
      const statusEl = card.querySelector('.level-status');

      if (level <= maxUnlocked) {
        card.classList.remove('locked');
        if (statusEl) statusEl.textContent = 'Disponible 🟢';
      } else {
        card.classList.add('locked');
        if (statusEl) statusEl.textContent = '🔒 Verrouillé';
      }
    });
    this.updateGearsDisplay();
  }

  private updateGearsDisplay(): void {
    const gearsEl = document.getElementById('gears-count');
    if (gearsEl) gearsEl.textContent = `⚙️ ${this.saveData.gears}`;
  }

  private handleSuccessfulAnswer(): void {
    const earnedGears = this.errorsCount === 0 ? 1 : 0.5;
    this.saveData.gears += earnedGears;
    this.phaseSuccessCount++;

    SaveManager.save(this.saveData);
    this.triggerSuccessEffect();
    this.updateGearsDisplay();

    const instructionEl = document.getElementById('instruction');

    // Vérifier si la phase actuelle est terminée (3 réussites par phase)
    if (this.phaseSuccessCount >= 3) {
      if (this.currentPhase === 1) {
        // Passer à la phase 2 : Placement
        this.currentPhase = 2;
        this.phaseSuccessCount = 0;
        if (instructionEl) {
          instructionEl.innerHTML = `🎉 Étape 1 réussie ! Passons au placement des aiguilles.`;
          instructionEl.style.color = '#38a169';
        }
        setTimeout(() => {
          if (instructionEl) instructionEl.style.color = '#2d3748';
          this.initNewQuestion();
          this.updateUI();
          this.render();
        }, 2000);
        return;
      } else {
        // Niveau entièrement terminé !
        if (this.currentLevel === this.saveData.maxUnlockedLevel && this.currentLevel < 4) {
          this.saveData.maxUnlockedLevel = this.currentLevel + 1;
          SaveManager.save(this.saveData);
        }

        if (instructionEl) {
          instructionEl.innerHTML = `🏆 Niveau ${this.currentLevel} terminé avec succès ! (+${earnedGears} ⚙️)`;
          instructionEl.style.color = '#38a169';
        }

        setTimeout(() => {
          this.returnToMenu();
        }, 2500);
        return;
      }
    }

    if (instructionEl) {
      instructionEl.innerHTML = `🎉 Correct ! Encore ${3 - this.phaseSuccessCount} bonne(s) réponse(s) pour cette étape (+${earnedGears} ⚙️)`;
      instructionEl.style.color = '#38a169';
    }

    setTimeout(() => {
      if (instructionEl) instructionEl.style.color = '#2d3748';
      this.initNewQuestion();
      this.updateUI();
      this.render();
    }, 1500);
  }

  private handleFailedAttempt(): void {
    this.errorsCount++;
    this.triggerShakeEffect();
    const instructionEl = document.getElementById('instruction');

    if (this.errorsCount >= 3) {
      this.showHelp();
    } else {
      if (instructionEl) {
        if (this.currentPhase === 1) {
          instructionEl.innerHTML = `Ce n'est pas tout à fait ça. Essaie encore ! (${3 - this.errorsCount} essais avant indice)`;
        } else {
          instructionEl.innerHTML = `Presque ! Réessaie de placer les aiguilles. (${3 - this.errorsCount} essais avant indice)`;
        }
      }
    }
  }

  private showHelp(): void {
    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    if (helpBox && helpText) {
      helpBox.classList.remove('hidden');
      if (this.currentPhase === 1) {
        helpText.textContent = `Regarde l'horloge : la cible est ${this.targetTime.text}.`;
      } else {
        helpText.textContent = `Pour afficher ${this.targetTime.text}, place la petite aiguille sur le chiffre ${this.targetTime.hours % 12 || 12} et la grande sur ${this.targetTime.minutes}.`;
      }
    }
  }

  private hideHelp(): void {
    const helpBox = document.getElementById('help-box');
    if (helpBox) helpBox.classList.add('hidden');
  }

  private normalizeAngle(angle: number): number {
    while (angle <= -Math.PI) angle += 2 * Math.PI;
    while (angle > Math.PI) angle -= 2 * Math.PI;
    return angle;
  }

  private updateFromPointer(x: number, y: number): void {
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += 2 * Math.PI;

    if (this.activeHand === 'minute') {
      const totalMinutes = Math.round((angle / (2 * Math.PI)) * 60) % 60;
      this.currentMinutes = totalMinutes;
    } else {
      const totalHours = Math.round((angle / (2 * Math.PI)) * 12) % 12;
      this.currentHours = totalHours === 0 ? 12 : totalHours;
    }

    this.render();
  }

  private snapToGrid(): void {
    this.currentMinutes = Math.round(this.currentMinutes / 5) * 5;
    if (this.currentMinutes === 60) this.currentMinutes = 0;
    this.render();
  }

  private triggerShakeEffect(): void {
    const container = document.getElementById('game-container');
    if (container) {
      container.classList.add('shake');
      setTimeout(() => container.classList.remove('shake'), 400);
    }
  }

  private triggerSuccessEffect(): void {
    const container = document.getElementById('game-container');
    if (container) {
      container.classList.add('success-bounce');
      setTimeout(() => container.classList.remove('success-bounce'), 600);
    }
  }

  private checkPlaceAnswer(): void {
    const isHourCorrect = this.currentHours % 12 === this.targetTime.hours % 12;
    const isMinuteCorrect = this.currentMinutes === this.targetTime.minutes;

    if (isHourCorrect && isMinuteCorrect) {
      this.handleSuccessfulAnswer();
    } else {
      this.handleFailedAttempt();
    }
    this.updateGearsDisplay();
  }

  private checkReadAnswer(choiceIndex: number): void {
    const selectedChoice = this.currentChoices[choiceIndex];
    const isMinutesExact = selectedChoice.minutes === this.targetTime.minutes;
    const isHoursExact = selectedChoice.hours % 12 === this.targetTime.hours % 12;

    if (isHoursExact && isMinutesExact) {
      this.handleSuccessfulAnswer();
    } else {
      this.handleFailedAttempt();
    }
    this.updateGearsDisplay();
  }

  private renderShopItems(): void {
    const container = document.getElementById('shop-items-container');
    if (!container) return;
    container.innerHTML = '';

    const filteredItems = this.shopItems.filter(item => item.category === this.activeShopCategory);

    filteredItems.forEach(item => {
      const isUnlocked = item.category === 'themes' 
        ? this.saveData.unlockedItems.includes(item.id) 
        : this.saveData.unlockedHands.includes(item.id);
      
      const isActive = item.category === 'themes'
        ? this.saveData.activeTheme === item.id
        : this.saveData.activeHands === item.id;

      const itemEl = document.createElement('div');
      itemEl.className = 'shop-item';

      let buttonText = `Acheter (${item.cost} ⚙️)`;
      let buttonClass = 'shop-action-btn';

      if (isActive) {
        buttonText = 'Actif';
        buttonClass = 'shop-action-btn active';
      } else if (isUnlocked) {
        buttonText = 'Utiliser';
        buttonClass = 'shop-action-btn unlocked';
      }

      itemEl.innerHTML = `
        <div class="shop-item-info">
          <h4>${item.name}</h4>
          <span>${item.cost === 0 ? 'Gratuit' : `${item.cost} Engrenages`}</span>
        </div>
        <button class="${buttonClass}" data-id="${item.id}">${buttonText}</button>
      `;

      itemEl.querySelector('button')!.addEventListener('click', () => {
        this.handleShopAction(item);
      });

      container.appendChild(itemEl);
    });
  }

  private handleShopAction(item: ShopItem): void {
    const isUnlocked = item.category === 'themes'
      ? this.saveData.unlockedItems.includes(item.id)
      : this.saveData.unlockedHands.includes(item.id);

    if (isUnlocked) {
      if (item.category === 'themes') {
        this.saveData.activeTheme = item.id;
        this.clock.setTheme(item.id);
      } else {
        this.saveData.activeHands = item.id;
        this.hands.setStyle(item.id);
      }
    } else {
      if (this.saveData.gears >= item.cost) {
        this.saveData.gears -= item.cost;
        if (item.category === 'themes') {
          this.saveData.unlockedItems.push(item.id);
          this.saveData.activeTheme = item.id;
          this.clock.setTheme(item.id);
        } else {
          this.saveData.unlockedHands.push(item.id);
          this.saveData.activeHands = item.id;
          this.hands.setStyle(item.id);
        }
      } else {
        alert("Tu n'as pas assez d'engrenages !");
      }
    }

    SaveManager.save(this.saveData);
    this.updateGearsDisplay();
    this.renderShopItems();
    this.render();
  }

  private updateUI(): void {
    const instructionEl = document.getElementById('instruction');
    const phaseBadge = document.getElementById('phase-badge');
    const checkBtn = document.getElementById('check-btn');
    const choicesContainer = document.getElementById('choices-container');

    if (phaseBadge) {
      phaseBadge.textContent = this.currentPhase === 1 
        ? `Étape 1/2 : Lecture (${this.phaseSuccessCount}/3)` 
        : `Étape 2/2 : Placement (${this.phaseSuccessCount}/3)`;
    }

    if (this.currentPhase === 1) {
      if (checkBtn) checkBtn.classList.add('hidden');
      if (choicesContainer) choicesContainer.classList.remove('hidden');
      if (instructionEl) instructionEl.textContent = `Quelle heure est-il sur l'horloge ?`;

      const choiceBtns = document.querySelectorAll('.choice-btn');
      choiceBtns.forEach((btn, idx) => {
        if (this.currentChoices[idx]) {
          btn.textContent = this.currentChoices[idx].text;
        }
      });
    } else {
      if (checkBtn) checkBtn.classList.remove('hidden');
      if (choicesContainer) choicesContainer.classList.add('hidden');
      if (instructionEl) instructionEl.innerHTML = `Place les aiguilles sur : <strong>${this.targetTime.text}</strong>`;
    }
  }

  private getLevelName(level: number): string {
    switch(level) {
      case 1: return 'Piles';
      case 2: return '30 min';
      case 3: return 'Quarts';
      case 4: return '5 min';
      default: return '';
    }
  }

  private get radius(): number {
    const width = this.canvas.width;
    const height = this.canvas.height;
    return Math.min(width / 2, height / 2) - 20;
  }

  public render(): void {
    this.clock.draw();
    this.hands.draw(this.currentHours, this.currentMinutes);
  }
}