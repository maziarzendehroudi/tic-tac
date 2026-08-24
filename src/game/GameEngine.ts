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
  private gameMode: 'place' | 'read' = 'place';

  private isDragging: boolean = false;
  private activeHand: 'hour' | 'minute' = 'minute';

  private shopItems: ShopItem[] = [
    { id: 'classic', name: 'Cadran Classique', cost: 0 },
    { id: 'wood', name: 'Cadran Bois', cost: 5 },
    { id: 'space', name: 'Cadran Espace', cost: 10 }
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
    this.currentLevel = this.saveData.levelProgress || 1;

    this.clock = new Clock(this.ctx, radius, false, this.saveData.activeTheme);
    this.hands = new Hands(this.ctx, radius);
    this.questionManager = new QuestionManager(this.currentLevel);

    this.initNewQuestion();
    this.initEvents();
    this.updateLevelButtonsUI();
    this.render();
    this.updateUI();
  }

  private initNewQuestion(): void {
    this.targetTime = this.questionManager.generateQuestion();
    if (this.gameMode === 'read') {
      this.currentHours = this.targetTime.hours;
      this.currentMinutes = this.targetTime.minutes;
      this.currentChoices = this.questionManager.generateChoices(this.targetTime);
    } else {
      this.currentHours = 12;
      this.currentMinutes = 0;
    }
    this.errorsCount = 0;
  }

  private initEvents(): void {
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
      if (this.gameMode === 'read') return;
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
      if (!this.isDragging || this.gameMode === 'read') return;
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
        if (this.gameMode === 'read') {
          this.checkReadAnswer(index);
        }
      });
    });

    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.getAttribute('data-mode') as 'place' | 'read';
        this.setGameMode(mode);
      });
    });

    const levelBtns = document.querySelectorAll('.level-btn');
    levelBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const level = parseInt(target.getAttribute('data-level') || '1', 10);
        this.setNewLevel(level);
      });
    });

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
  }

  private setGameMode(mode: 'place' | 'read'): void {
    this.gameMode = mode;
    
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(b => {
      if (b.getAttribute('data-mode') === mode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    const checkBtn = document.getElementById('check-btn');
    const choicesContainer = document.getElementById('choices-container');

    if (mode === 'place') {
      if (checkBtn) checkBtn.classList.remove('hidden');
      if (choicesContainer) choicesContainer.classList.add('hidden');
    } else {
      if (checkBtn) checkBtn.classList.add('hidden');
      if (choicesContainer) choicesContainer.classList.remove('hidden');
    }

    this.initNewQuestion();
    this.render();
    this.updateUI();
  }

  private setNewLevel(level: number): void {
    this.currentLevel = level;
    this.questionManager.setLevel(level);
    this.saveData.levelProgress = this.currentLevel;
    SaveManager.save(this.saveData);

    this.updateLevelButtonsUI();
    this.initNewQuestion();
    this.render();
    this.updateUI();
  }

  private updateLevelButtonsUI(): void {
    const levelBtns = document.querySelectorAll('.level-btn');
    levelBtns.forEach(btn => {
      const level = parseInt(btn.getAttribute('data-level') || '1', 10);
      if (level === this.currentLevel) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
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
    const instructionEl = document.getElementById('instruction');

    if (isHourCorrect && isMinuteCorrect) {
      const earnedGears = this.errorsCount === 0 ? 1 : 0.5;
      this.saveData.gears += earnedGears;
      SaveManager.save(this.saveData);
      this.triggerSuccessEffect();

      if (instructionEl) {
        instructionEl.innerHTML = `🎉 Super ! Gagné (+${earnedGears} ⚙️)`;
        instructionEl.style.color = '#38a169';
      }

      setTimeout(() => {
        if (instructionEl) instructionEl.style.color = '#4a5568';
        this.initNewQuestion();
        this.updateUI();
        this.render();
      }, 1500);

    } else {
      this.errorsCount++;
      this.triggerShakeEffect();
      if (instructionEl) {
        instructionEl.innerHTML = `Presque ! Réessaie de placer les aiguilles pour : <span id="target-time">${this.targetTime.text}</span>`;
      }
    }
    this.updateUIStoreOnly();
  }

  private checkReadAnswer(choiceIndex: number): void {
    const selectedChoice = this.currentChoices[choiceIndex];
    const isCorrect = selectedChoice.hours === this.targetTime.hours && selectedChoice.minutes === this.targetTime.minutes;
    const instructionEl = document.getElementById('instruction');

    if (isCorrect) {
      const earnedGears = this.errorsCount === 0 ? 1 : 0.5;
      this.saveData.gears += earnedGears;
      SaveManager.save(this.saveData);
      this.triggerSuccessEffect();

      if (instructionEl) {
        instructionEl.innerHTML = `🎉 Bravo ! C'était bien ${this.targetTime.text} (+${earnedGears} ⚙️)`;
        instructionEl.style.color = '#38a169';
      }

      setTimeout(() => {
        if (instructionEl) instructionEl.style.color = '#4a5568';
        this.initNewQuestion();
        this.updateUI();
        this.render();
      }, 1500);

    } else {
      this.errorsCount++;
      this.triggerShakeEffect();
      if (instructionEl) {
        instructionEl.innerHTML = `Ce n'est pas tout à fait ça. Regarde bien l'horloge !`;
      }
    }
    this.updateUIStoreOnly();
  }

  private renderShopItems(): void {
    const container = document.getElementById('shop-items-container');
    if (!container) return;
    container.innerHTML = '';

    this.shopItems.forEach(item => {
      const isUnlocked = this.saveData.unlockedItems.includes(item.id);
      const isActive = this.saveData.activeTheme === item.id;

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
    const isUnlocked = this.saveData.unlockedItems.includes(item.id);

    if (isUnlocked) {
      this.saveData.activeTheme = item.id;
      this.clock.setTheme(item.id);
    } else {
      if (this.saveData.gears >= item.cost) {
        this.saveData.gears -= item.cost;
        this.saveData.unlockedItems.push(item.id);
        this.saveData.activeTheme = item.id;
        this.clock.setTheme(item.id);
      } else {
        alert("Tu n'as pas assez d'engrenages !");
      }
    }

    SaveManager.save(this.saveData);
    this.updateUI();
    this.renderShopItems();
    this.render();
  }

  private updateUI(): void {
    const instructionEl = document.getElementById('instruction');
    const gearsEl = document.getElementById('gears-count');
    
    if (gearsEl) gearsEl.textContent = `⚙️ ${this.saveData.gears}`;

    if (this.gameMode === 'place') {
      if (instructionEl) instructionEl.innerHTML = `Place les aiguilles sur : <span id="target-time">${this.targetTime.text}</span>`;
    } else {
      if (instructionEl) instructionEl.textContent = `Quelle heure est-il sur l'horloge ?`;
      const choiceBtns = document.querySelectorAll('.choice-btn');
      choiceBtns.forEach((btn, idx) => {
        if (this.currentChoices[idx]) {
          btn.textContent = this.currentChoices[idx].text;
        }
      });
    }
  }

  private updateUIStoreOnly(): void {
    const gearsEl = document.getElementById('gears-count');
    if (gearsEl) gearsEl.textContent = `⚙️ ${this.saveData.gears}`;
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