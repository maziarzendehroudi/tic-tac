import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager } from './SaveManager';
import type { GameSave } from './SaveManager';

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
  private currentPhase: 1 | 2 = 1;
  private phaseSuccessCount: number = 0;

  private isDragging: boolean = false;
  private activeHand: 'hour' | 'minute' = 'minute';

  // Mapping des niveaux vers les pièces de montre débloquées
  private levelPartsMap: { [key: number]: string } = {
    1: 'spring',
    2: 'gears',
    3: 'escapement',
    4: 'balance',
    5: 'hands'
  };

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
    this.clock = new Clock(this.ctx, radius, 'classic');
    this.hands = new Hands(this.ctx, radius, 'classic-hands');
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

    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('atelier-view')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    const titleDisplay = document.getElementById('level-title-display');
    if (titleDisplay) titleDisplay.textContent = `Niveau ${level}`;

    this.initNewQuestion();
    this.render();
    this.updateUI();
  }

  private returnToMenu(): void {
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('atelier-view')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.remove('hidden');
    this.updateMenuUI();
  }

  private openAtelier(): void {
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('atelier-view')?.classList.remove('hidden');
    this.renderAtelier();
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
    const levelRects = document.querySelectorAll('.level-rect');
    levelRects.forEach(rect => {
      rect.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const level = parseInt(target.getAttribute('data-level') || '1', 10);
        
        if (level <= (this.saveData.maxUnlockedLevel || 1)) {
          this.startLevel(level);
        } else {
          alert("🔒 Ce niveau est verrouillé ! Termine le niveau précédent.");
        }
      });
    });

    const atelierBtn = document.getElementById('open-atelier-btn');
    atelierBtn?.addEventListener('click', () => this.openAtelier());

    const atelierBackBtn = document.getElementById('atelier-back-btn');
    atelierBackBtn?.addEventListener('click', () => this.returnToMenu());

    const backMenuBtn = document.getElementById('back-menu-btn');
    if (backMenuBtn) {
      backMenuBtn.addEventListener('click', () => this.returnToMenu());
    }

    // Gestion du tactile/souris pour l'horloge
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
  }

  private updateMenuUI(): void {
    const levelRects = document.querySelectorAll('.level-rect');
    const maxUnlocked = this.saveData.maxUnlockedLevel || 1;

    levelRects.forEach(rect => {
      const level = parseInt(rect.getAttribute('data-level') || '1', 10);
      const checkMark = rect.querySelector('.lvl-check');
      
      if (level <= maxUnlocked) {
        rect.classList.remove('locked');
        if (level < maxUnlocked) {
          checkMark?.classList.remove('hidden');
        } else {
          checkMark?.classList.add('hidden');
        }
      } else {
        rect.classList.add('locked');
        checkMark?.classList.add('hidden');
      }
    });
  }

  private renderAtelier(): void {
    const inventoryContainer = document.getElementById('inventory-items');
    if (!inventoryContainer) return;
    inventoryContainer.innerHTML = '';

    // Afficher les pièces débloquées non encore placées
    this.saveData.unlockedParts.forEach(partId => {
      if (!this.saveData.placedParts.includes(partId)) {
        const partEl = document.createElement('div');
        partEl.className = 'inventory-part';
        partEl.textContent = this.getPartName(partId);
        partEl.setAttribute('data-part', partId);

        // Permettre le clic pour placer directement dans son slot
        partEl.addEventListener('click', () => {
          if (!this.saveData.placedParts.includes(partId)) {
            this.saveData.placedParts.push(partId);
            SaveManager.save(this.saveData);
            this.renderAtelier();
          }
        });

        inventoryContainer.appendChild(partEl);
      }
    });

    if (inventoryContainer.children.length === 0) {
      inventoryContainer.innerHTML = '<span style="font-size:0.85rem; color:#64748b;">Toutes tes pièces sont assemblées ! 🎉</span>';
    }

    // Mettre à jour l'affichage des slots sur le plan
    const slots = document.querySelectorAll('.slot');
    slots.forEach(slot => {
      const partId = slot.getAttribute('data-part');
      if (partId && this.saveData.placedParts.includes(partId)) {
        slot.classList.add('filled');
        slot.textContent = `✅ ${this.getPartName(partId)}`;
      } else {
        slot.classList.remove('filled');
      }
    });
  }

  private getPartName(partId: string): string {
    switch(partId) {
      case 'spring': return '🔋 Ressort';
      case 'gears': return '⚙️ Rouages';
      case 'escapement': return '🫀 Tic-Tac';
      case 'balance': return '⚖️ Balancier';
      case 'hands': return '🧭 Cadran';
      default: return partId;
    }
  }

  private handleSuccessfulAnswer(): void {
    this.phaseSuccessCount++;

    const partToUnlock = this.levelPartsMap[this.currentLevel];
    if (partToUnlock && !this.saveData.unlockedParts.includes(partToUnlock)) {
      this.saveData.unlockedParts.push(partToUnlock);
    }

    SaveManager.save(this.saveData);
    this.updateMenuUI();

    const instructionEl = document.getElementById('instruction');

    if (this.phaseSuccessCount >= 3) {
      if (this.currentPhase === 1) {
        this.currentPhase = 2;
        this.phaseSuccessCount = 0;
        if (instructionEl) {
          instructionEl.innerHTML = `<span style="font-size: 2.5rem;">👍</span>`;
        }
        setTimeout(() => {
          this.initNewQuestion();
          this.updateUI();
          this.render();
        }, 1500);
        return;
      } else {
        if (this.currentLevel === this.saveData.maxUnlockedLevel && this.currentLevel < 6) {
          this.saveData.maxUnlockedLevel = this.currentLevel + 1;
          SaveManager.save(this.saveData);
        }

        if (instructionEl) {
          instructionEl.innerHTML = `🏆 <span style="font-size: 2.5rem;">👍</span> Pièce débloquée !`;
        }

        setTimeout(() => {
          this.returnToMenu();
        }, 2000);
        return;
      }
    }

    if (instructionEl) {
      instructionEl.innerHTML = `<span style="font-size: 2.5rem;">👍</span>`;
    }

    setTimeout(() => {
      this.initNewQuestion();
      this.updateUI();
      this.render();
    }, 1200);
  }

  private handleFailedAttempt(): void {
    this.errorsCount++;
    const instructionEl = document.getElementById('instruction');

    if (this.errorsCount >= 3) {
      this.showHelp();
    } else {
      if (instructionEl) {
        instructionEl.innerHTML = `<span style="font-size: 2.5rem;">❌</span>`;
      }
      setTimeout(() => {
        this.updateUI();
      }, 1000);
    }
  }

  private showHelp(): void {
    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    if (helpBox && helpText) {
      helpBox.classList.remove('hidden');
      if (this.currentPhase === 1) {
        helpText.textContent = `La bonne réponse est ${this.targetTime.text}.`;
      } else {
        helpText.textContent = `Pour ${this.targetTime.text}, place la petite aiguille sur ${this.targetTime.hours % 12 || 12} et la grande sur ${this.targetTime.minutes}.`;
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
    if (this.currentLevel === 6) {
      this.render();
      return;
    }
    this.currentMinutes = Math.round(this.currentMinutes / 5) * 5;
    if (this.currentMinutes === 60) this.currentMinutes = 0;
    this.render();
  }

  private checkPlaceAnswer(): void {
    const isHourCorrect = this.currentHours % 12 === this.targetTime.hours % 12;
    const isMinuteCorrect = this.currentLevel === 6 
      ? Math.abs(this.currentMinutes - this.targetTime.minutes) <= 2
      : this.currentMinutes === this.targetTime.minutes;

    if (isHourCorrect && isMinuteCorrect) {
      this.handleSuccessfulAnswer();
    } else {
      this.handleFailedAttempt();
    }
  }

  private checkReadAnswer(choiceIndex: number): void {
    const selectedChoice = this.currentChoices[choiceIndex];
    const isMinutesExact = selectedChoice.minutes === this.targetTime.minutes;
    const isHoursExact = selectedChoice.hours === this.targetTime.hours;

    if (isHoursExact && isMinutesExact) {
      this.handleSuccessfulAnswer();
    } else {
      this.handleFailedAttempt();
    }
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

  private get radius(): number {
    const width = this.canvas.width;
    const height = this.canvas.height;
    return Math.min(width / 2, height / 2) - 10;
  }

  public render(): void {
    this.clock.draw(this.currentLevel);
    this.hands.draw(this.currentHours, this.currentMinutes);
  }
}