import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager, ALL_PARTS } from './SaveManager';
import type { GameSave } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { TimeMath } from './TimeMath';
import { WatchMechanism } from './WatchMechanism';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private clock: Clock;
  private hands: Hands;
  private questionManager: QuestionManager;
  private soundEngine: SoundEngine;
  private watchMechanism!: WatchMechanism;

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
  private isWinding: boolean = false;
  private isTransitioning: boolean = false;
  private activeHand: 'hour' | 'minute' = 'hour';
  private animFrameId: number = 0;
  private lastTime: number = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    this.ctx.translate(centerX, centerY);

    this.saveData = SaveManager.load();
    this.soundEngine = new SoundEngine(this.saveData.muted);
    this.clock = new Clock(this.ctx, radius);
    this.hands = new Hands(this.ctx, radius);
    this.questionManager = new QuestionManager(1);

    const atelierCanvas = document.getElementById('atelierCanvas') as HTMLCanvasElement | null;
    if (atelierCanvas) {
      const atelierCtx = atelierCanvas.getContext('2d')!;
      this.watchMechanism = new WatchMechanism(
        atelierCtx,
        atelierCanvas.width,
        atelierCanvas.height,
        (isTic) => this.soundEngine.playTick(isTic),
        () => this.soundEngine.playWindingClick()
      );
    }

    this.initEvents();
    this.updateSoundButtonUI();
    this.updateDevButtonUI();
    this.updateMenuUI();
    this.updateUI();
  }

  public startLevel(level: number): void {
    this.currentLevel = level;
    this.currentPhase = 1;
    this.phaseSuccessCount = 0;
    this.isTransitioning = false;
    this.questionManager.setLevel(level);

    this.stopAnimation();

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
    this.stopAnimation();
    this.isTransitioning = false;
    this.isWinding = false;
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('atelier-view')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.remove('hidden');
    this.updateDevButtonUI();
    this.updateMenuUI();
  }

  private openAtelier(): void {
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('atelier-view')?.classList.remove('hidden');
    if (this.watchMechanism && this.saveData.placedParts.includes('spring') && this.watchMechanism.power < 15) {
      this.watchMechanism.power = 75;
    }
    this.renderAtelier();
    this.startAnimation();
  }

  private startAnimation(): void {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const deltaTime = Math.min(time - this.lastTime, 100);
      this.lastTime = time;

      if (this.watchMechanism) {
        this.watchMechanism.update(deltaTime, this.saveData.placedParts, this.isWinding);
        this.watchMechanism.draw(this.saveData.placedParts, this.saveData.unlockedParts, this.isWinding);

        const hasSpring = this.saveData.placedParts.includes('spring');
        const powerPct = hasSpring ? Math.round(this.watchMechanism.power) : 0;
        const powerBar = document.getElementById('power-bar');
        const powerLabel = document.getElementById('power-label');
        if (powerBar) powerBar.style.width = `${powerPct}%`;
        if (powerLabel) powerLabel.textContent = `🔋 Énergie du ressort : ${powerPct}%`;

        this.updateAtelierStatusBanner(powerPct);
      }

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private updateAtelierStatusBanner(powerPct: number): void {
    const banner = document.getElementById('atelier-status');
    if (!banner) return;

    const placed = this.saveData.placedParts;
    const hasCrown = placed.includes('crown');
    const hasSpring = placed.includes('spring');
    const hasHours = placed.includes('hours');
    const hasMinutes = placed.includes('minutes');
    const hasSeconds = placed.includes('seconds');
    const hasEscapement = placed.includes('escapement');

    if (placed.length === 0) {
      banner.textContent = '🛠️ Ajoute les pièces de 1 à 6 pour voir chaque aiguille s’animer l’une après l’autre !';
    } else if (!hasSpring) {
      banner.textContent = '🔋 Monte le Ressort (2) à gauche : c’est lui qui donne la force de faire tourner la montre !';
    } else if (this.isWinding) {
      banner.textContent =
        powerPct >= 100
          ? '✅ Ressort rechargé à 100% ! Tu peux relâcher la Molette.'
          : '🔄 La Molette (1) resserre le Ressort orange (2)...';
    } else if (powerPct === 0) {
      banner.textContent =
        hasCrown
          ? '⚡ Le Ressort est vide ! Maintiens la Molette (1) ou le bouton « Remonter ».'
          : '⚙️ Monte la Molette (1) à gauche pour pouvoir remonter le Ressort !';
    } else if (!hasHours) {
      banner.textContent = '🟡 Monte la Roue des Heures (3) : le Ressort va faire tourner la petite aiguille dorée !';
    } else if (!hasMinutes) {
      banner.textContent = '🟡 La petite aiguille dorée tourne ! Ajoute les Minutes (4) pour voir le Relais Bleu en haut.';
    } else if (!hasSeconds) {
      banner.textContent = '🔵 Le Relais Bleu accélère la grande aiguille bleue ! Ajoute les Secondes (5) à droite.';
    } else if (!hasEscapement) {
      banner.textContent = '🔴 Les 3 aiguilles tournent ! Ajoute le Balancier Tic-Tac (6) en bas pour activer le son Tic-Tac.';
    } else {
      banner.textContent = '🏆 Horloge complète : Ressort ➔ Heures ➔ Relais Minutes ➔ Relais Secondes ➔ Balancier Tic-Tac !';
    }
  }

  private stopAnimation(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  private initNewQuestion(): void {
    this.targetTime = this.questionManager.generateQuestion();
    this.errorsCount = 0;
    this.isTransitioning = false;
    this.hideHelp();

    if (this.currentPhase === 1) {
      this.currentHours = this.targetTime.hours;
      this.currentMinutes = this.targetTime.minutes;
      this.currentChoices = this.questionManager.generateChoices(this.targetTime);
    } else {
      // Phase 2 : Départ avec les aiguilles séparées (ex: 9h00 ou 6h00) et jamais déjà posées sur la réponse cible !
      const targetH12 = this.targetTime.hours % 12 || 12;
      this.currentHours = targetH12 === 9 ? 6 : 9;
      this.currentMinutes = 0;
      this.activeHand = 'hour';
      this.updateHandSelectorUI();
    }
  }

  private initEvents(): void {
    const levelRects = document.querySelectorAll('.level-rect');
    levelRects.forEach(rect => {
      rect.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const level = parseInt(target.getAttribute('data-level') || '1', 10);
        if (level <= (this.saveData.maxUnlockedLevel || 1)) {
          this.soundEngine.playSnap();
          this.startLevel(level);
        } else {
          this.soundEngine.playError();
        }
      });
    });

    document.getElementById('open-atelier-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.openAtelier();
    });
    document.getElementById('atelier-back-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.returnToMenu();
    });
    document.getElementById('back-menu-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.returnToMenu();
    });

    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    soundToggleBtn?.addEventListener('click', () => {
      this.saveData.muted = !this.saveData.muted;
      this.soundEngine.setMuted(this.saveData.muted);
      SaveManager.save(this.saveData);
      this.updateSoundButtonUI();
      if (!this.saveData.muted) {
        this.soundEngine.playSnap();
      }
    });

    const devUnlockBtn = document.getElementById('dev-unlock-btn');
    devUnlockBtn?.addEventListener('click', () => {
      const currentMuted = this.saveData.muted;
      if (SaveManager.isFullyUnlocked(this.saveData)) {
        this.saveData = SaveManager.reset();
        this.saveData.muted = currentMuted;
        SaveManager.save(this.saveData);
        if (this.watchMechanism) this.watchMechanism.power = 0;
        this.soundEngine.playSnap();
      } else {
        this.saveData = SaveManager.unlockAll(currentMuted);
        if (this.watchMechanism) this.watchMechanism.power = 85;
        this.soundEngine.playLevelComplete();
      }
      this.updateDevButtonUI();
      this.updateMenuUI();
      this.renderAtelier();
      this.render();
    });

    // --- CONTRÔLES DE REMONTAGE & CADRAN DE L'ATELIER ---
    const startWinding = (e: Event) => {
      e.preventDefault();
      if (this.saveData.placedParts.includes('crown')) {
        this.isWinding = true;
      } else {
        this.soundEngine.playError();
      }
    };
    const stopWinding = () => {
      this.isWinding = false;
    };

    const crownHitbox = document.getElementById('crown-hitbox');
    const windBtn = document.getElementById('wind-watch-btn');
    [crownHitbox, windBtn].forEach(el => {
      if (!el) return;
      el.addEventListener('mousedown', startWinding);
      el.addEventListener('touchstart', startWinding, { passive: false });
      el.addEventListener('mouseleave', stopWinding);
    });
    window.addEventListener('mouseup', stopWinding);
    window.addEventListener('touchend', stopWinding);

    const atelierCanvas = document.getElementById('atelierCanvas') as HTMLCanvasElement | null;
    if (atelierCanvas) {
      const handleAtelierPointerDown = (e: MouseEvent | TouchEvent) => {
        if (!this.watchMechanism) return;
        const rect = atelierCanvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const canvasX = ((clientX - rect.left) / rect.width) * atelierCanvas.width;
        const canvasY = ((clientY - rect.top) / rect.height) * atelierCanvas.height;

        if (this.watchMechanism.isPointInCrown(canvasX, canvasY)) {
          e.preventDefault();
          if (this.saveData.placedParts.includes('crown')) {
            this.isWinding = true;
          } else {
            this.soundEngine.playError();
          }
        }
      };
      atelierCanvas.addEventListener('mousedown', handleAtelierPointerDown);
      atelierCanvas.addEventListener('touchstart', handleAtelierPointerDown, { passive: false });
    }

    const toggleDialBtn = document.getElementById('toggle-dial-btn');
    toggleDialBtn?.addEventListener('click', () => {
      if (this.watchMechanism) {
        this.watchMechanism.showDial = !this.watchMechanism.showDial;
        toggleDialBtn.textContent = this.watchMechanism.showDial ? '👁️ Chiffres : Oui' : '👁️ Chiffres : Non';
        this.soundEngine.playSnap();
      }
    });

    // --- OUTILS PÉDAGOGIQUES DE PLACEMENT (Sélection d'aiguille & Pas-à-pas) ---
    document.getElementById('select-hour-btn')?.addEventListener('click', () => {
      this.activeHand = 'hour';
      this.soundEngine.playSnap();
      this.updateHandSelectorUI();
      this.render();
    });

    document.getElementById('select-minute-btn')?.addEventListener('click', () => {
      this.activeHand = 'minute';
      this.soundEngine.playSnap();
      this.updateHandSelectorUI();
      this.render();
    });

    document.getElementById('step-minus-btn')?.addEventListener('click', () => {
      if (this.currentPhase !== 2 || this.isTransitioning) return;
      this.nudgeActiveHand(-1);
    });

    document.getElementById('step-plus-btn')?.addEventListener('click', () => {
      if (this.currentPhase !== 2 || this.isTransitioning) return;
      this.nudgeActiveHand(1);
    });

    // --- ÉVÉNEMENTS TACTILES / SOURIS DU CADRAN D'APPRENTISSAGE ---
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
      if (this.currentPhase === 1 || this.isTransitioning) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      const angle = Math.atan2(pos.x, -pos.y);
      const minAngle = (this.currentMinutes * Math.PI) / 30;
      const hrAngle = ((this.currentHours % 12) * Math.PI) / 6 + (this.currentMinutes * Math.PI) / 360;

      const diffMin = Math.abs(TimeMath.normalizeAngle(angle - minAngle));
      const diffHr = Math.abs(TimeMath.normalizeAngle(angle - hrAngle));
      const distFromCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);

      // Si l'enfant touche clairement l'une des deux aiguilles (à moins de 25°), on la sélectionne automatiquement
      if (diffMin < 0.42 && diffMin < diffHr && distFromCenter > this.radius * 0.48) {
        this.activeHand = 'minute';
      } else if (diffHr < 0.42 && diffHr <= diffMin && distFromCenter <= this.radius * 0.62) {
        this.activeHand = 'hour';
      }
      this.updateHandSelectorUI();

      this.isDragging = true;
      this.updateFromPointer(pos.x, pos.y);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging || this.currentPhase === 1 || this.isTransitioning) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      this.updateFromPointer(pos.x, pos.y);
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.snapToGrid();
      this.soundEngine.playSnap();
    };

    this.canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    document.getElementById('check-btn')?.addEventListener('click', () => {
      if (!this.isTransitioning && this.currentPhase === 2) {
        this.checkPlaceAnswer();
      }
    });

    const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
    choiceBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        if (!this.isTransitioning && this.currentPhase === 1) {
          this.checkReadAnswer(index);
        }
      });
    });
  }

  private nudgeActiveHand(direction: -1 | 1): void {
    if (this.activeHand === 'hour') {
      const nextH = ((this.currentHours - 1 + direction + 12) % 12) + 1;
      this.currentHours = nextH;
      this.soundEngine.playTick(true);
    } else {
      const step = this.currentLevel === 6 ? 1 : 5;
      this.currentMinutes = (this.currentMinutes + direction * step + 60) % 60;
      this.soundEngine.playTick(this.currentMinutes % 2 === 0);
    }
    this.render();
  }

  private updateHandSelectorUI(): void {
    const hrBtn = document.getElementById('select-hour-btn');
    const minBtn = document.getElementById('select-minute-btn');
    if (this.activeHand === 'hour') {
      hrBtn?.classList.add('active-hand-btn');
      minBtn?.classList.remove('active-hand-btn');
    } else {
      minBtn?.classList.add('active-hand-btn');
      hrBtn?.classList.remove('active-hand-btn');
    }
  }

  private updateSoundButtonUI(): void {
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.textContent = this.saveData.muted ? '🔇 Son coupé' : '🔊 Son actif';
      btn.setAttribute('aria-pressed', String(!this.saveData.muted));
    }
  }

  private updateDevButtonUI(): void {
    const btn = document.getElementById('dev-unlock-btn');
    if (!btn) return;
    if (SaveManager.isFullyUnlocked(this.saveData)) {
      btn.textContent = '🔄 Réinitialiser (Test)';
      btn.classList.add('unlocked-mode');
    } else {
      btn.textContent = '🔓 Tout débloquer (Test)';
      btn.classList.remove('unlocked-mode');
    }
  }

  private updateMenuUI(): void {
    const levelRects = document.querySelectorAll('.level-rect');
    const maxUnlocked = this.saveData.maxUnlockedLevel || 1;
    const isLevel6Done = this.saveData.unlockedParts.includes('escapement');

    levelRects.forEach(rect => {
      const level = parseInt(rect.getAttribute('data-level') || '1', 10);
      const checkMark = rect.querySelector('.lvl-check');

      if (level <= maxUnlocked) {
        rect.classList.remove('locked');
        if (level < maxUnlocked || (level === 6 && isLevel6Done)) {
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
    const crownHitbox = document.getElementById('crown-hitbox');
    const windBtn = document.getElementById('wind-watch-btn') as HTMLButtonElement | null;

    if (!inventoryContainer) return;
    inventoryContainer.innerHTML = '';

    if (this.saveData.unlockedParts.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.color = '#94a3b8';
      emptyMsg.style.fontSize = '0.9rem';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.textContent = 'Gagne les niveaux 1 à 6 (ou clique sur « Tout débloquer ») pour obtenir tes pièces une par une !';
      inventoryContainer.appendChild(emptyMsg);
    }

    ALL_PARTS.forEach((partId, idx) => {
      if (!this.saveData.unlockedParts.includes(partId)) return;

      const isPlaced = this.saveData.placedParts.includes(partId);
      const partEl = document.createElement('button');
      partEl.type = 'button';
      partEl.className = 'inventory-part' + (isPlaced ? ' placed' : '');

      const statusText = isPlaced ? ' (Enlever)' : ' (Monter)';
      partEl.innerHTML = `${this.getPartIcon(partId)} <span>${idx + 1}. ${this.getPartName(partId)}${statusText}</span>`;

      partEl.addEventListener('click', () => {
        if (isPlaced) {
          this.saveData.placedParts = this.saveData.placedParts.filter(p => p !== partId);
        } else {
          this.saveData.placedParts.push(partId);
          if (partId === 'spring' && this.watchMechanism && this.watchMechanism.power < 25) {
            this.watchMechanism.power = 75;
          }
        }
        this.soundEngine.playSnap();
        SaveManager.save(this.saveData);
        this.renderAtelier();
      });
      inventoryContainer.appendChild(partEl);
    });

    const canWind = this.saveData.placedParts.includes('crown');
    if (canWind) {
      crownHitbox?.classList.remove('hidden');
      if (windBtn) windBtn.disabled = false;
    } else {
      crownHitbox?.classList.add('hidden');
      if (windBtn) windBtn.disabled = true;
    }
  }

  private getPartIcon(partId: string): string {
    switch (partId) {
      case 'crown': return '⚙️';
      case 'spring': return '🔋';
      case 'hours': return '🟡';
      case 'minutes': return '🔵';
      case 'seconds': return '🔴';
      case 'escapement': return '🔔';
      default: return '🔧';
    }
  }

  private getPartName(partId: string): string {
    switch (partId) {
      case 'crown': return 'Molette';
      case 'spring': return 'Ressort';
      case 'hours': return 'Heures';
      case 'minutes': return 'Minutes';
      case 'seconds': return 'Secondes';
      case 'escapement': return 'Tic-Tac';
      default: return partId;
    }
  }

  private handleSuccessfulAnswer(): void {
    this.isTransitioning = true;
    this.phaseSuccessCount++;
    this.triggerSuccessEffect();
    this.hideHelp();

    const instructionEl = document.getElementById('instruction');

    if (this.phaseSuccessCount >= 3) {
      if (this.currentPhase === 1) {
        this.soundEngine.playSuccess();
        this.currentPhase = 2;
        this.phaseSuccessCount = 0;
        if (instructionEl) instructionEl.innerHTML = `🎉 <strong>Bravo !</strong> Passons à l’étape 2 : à toi de placer les aiguilles !`;
        setTimeout(() => {
          this.initNewQuestion();
          this.updateUI();
          this.render();
        }, 1600);
        return;
      } else {
        this.soundEngine.playLevelComplete();
        SaveManager.applyLevelRewards(this.saveData, this.currentLevel);
        SaveManager.save(this.saveData);
        this.updateDevButtonUI();
        this.updateMenuUI();

        const levelRewardsLabels: Record<number, string> = {
          1: '⚙️ Pièce 1 gagnée : La Molette !',
          2: '🔋 Pièce 2 gagnée : Le Ressort !',
          3: '🟡 Pièce 3 gagnée : Roue & Aiguille des Heures !',
          4: '🔵 Pièce 4 gagnée : Relais & Aiguille des Minutes !',
          5: '🔴 Pièce 5 gagnée : Relais & Aiguille des Secondes !',
          6: '🔔 Pièce 6 gagnée : Le Balancier Tic-Tac ! Tu es Maître Horloger !'
        };

        const rewardText = `🏆 <strong>${levelRewardsLabels[this.currentLevel] || 'Niveau terminé !'}</strong>`;
        if (instructionEl) instructionEl.innerHTML = rewardText;
        setTimeout(() => { this.returnToMenu(); }, 2200);
        return;
      }
    }

    this.soundEngine.playSuccess();
    if (instructionEl) instructionEl.innerHTML = `✅ <strong>Bravo ! C’est exactement ${this.targetTime.text} !</strong>`;
    setTimeout(() => {
      this.initNewQuestion();
      this.updateUI();
      this.render();
    }, 1200);
  }

  private handleFailedAttempt(): void {
    this.errorsCount++;
    this.soundEngine.playError();
    this.triggerShakeEffect();
    this.showDiagnosticHelp();
  }

  /**
   * Aide pédagogique progressive et diagnostique dès la 1re erreur
   */
  private showDiagnosticHelp(): void {
    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    if (!helpBox || !helpText) return;

    helpBox.classList.remove('hidden');

    const baseExplanation = TimeMath.buildPedagogicalHint(
      this.targetTime.hours,
      this.targetTime.minutes,
      this.currentLevel
    );

    if (this.currentPhase === 1) {
      if (this.errorsCount === 1) {
        helpText.innerHTML = baseExplanation;
      } else {
        helpText.innerHTML = `${baseExplanation} ➔ Il est donc <strong>${this.targetTime.text}</strong>.`;
      }
    } else {
      // Phase 2 : Diagnostic précis de l'aiguille déjà juste vs l'aiguille à corriger
      const isHourCorrect = (this.currentHours % 12) === (this.targetTime.hours % 12);
      const isMinuteCorrect =
        this.currentLevel === 6
          ? TimeMath.circularMinuteDiff(this.currentMinutes, this.targetTime.minutes) <= 1
          : this.currentMinutes === this.targetTime.minutes;

      const targetDialHour = this.targetTime.hours % 12 || 12;
      const targetDialMinNum = TimeMath.minuteToDialNumber(this.targetTime.minutes);

      if (isHourCorrect && !isMinuteCorrect) {
        this.activeHand = 'minute';
        this.updateHandSelectorUI();
        this.render();
        if (this.currentLevel === 6) {
          helpText.innerHTML = `👍 La <strong>petite aiguille dorée (heures)</strong> est bien placée ! Maintenant, place la <strong>grande aiguille bleue</strong> exactement sur <strong>${this.targetTime.minutes} minutes</strong> (aide-toi des boutons ➖ / ➕).`;
        } else {
          helpText.innerHTML = `👍 La <strong>petite aiguille dorée (heures)</strong> est bien placée ! Maintenant, déplace la <strong>grande aiguille bleue</strong> sur le <strong>${targetDialMinNum}</strong> pour faire <strong>${this.targetTime.minutes === 0 ? '00 minute' : this.targetTime.minutes + ' minutes'}</strong>.`;
        }
      } else if (!isHourCorrect && isMinuteCorrect) {
        this.activeHand = 'hour';
        this.updateHandSelectorUI();
        this.render();
        helpText.innerHTML = `👍 La <strong>grande aiguille bleue (minutes)</strong> est bien placée ! Maintenant, déplace la <strong>petite aiguille dorée</strong> sur le <strong>${targetDialHour}</strong>.`;
      } else {
        helpText.innerHTML = `Commence par placer la <strong>petite aiguille dorée</strong> sur le <strong>${targetDialHour}</strong>, puis la <strong>grande aiguille bleue</strong> sur le <strong>${targetDialMinNum}</strong> (${this.targetTime.minutes === 0 ? '00 minute' : this.targetTime.minutes + ' minutes'}).`;
      }
    }
  }

  private hideHelp(): void {
    document.getElementById('help-box')?.classList.add('hidden');
  }

  private updateFromPointer(x: number, y: number): void {
    if (this.activeHand === 'minute') {
      const nextMinutes = TimeMath.pointerToMinutes(x, y);
      if (nextMinutes !== this.currentMinutes) {
        this.currentMinutes = nextMinutes;
        this.soundEngine.playTick(nextMinutes % 2 === 0);
      }
    } else {
      const nextHours = TimeMath.pointerToHours(x, y, this.currentMinutes);
      if (nextHours !== this.currentHours) {
        this.currentHours = nextHours;
        this.soundEngine.playTick(true);
      }
    }
    this.render();
  }

  private snapToGrid(): void {
    this.currentMinutes = TimeMath.snapMinutes(this.currentMinutes, this.currentLevel);
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
    const isCorrect = TimeMath.isPlacementCorrect(
      this.currentHours,
      this.currentMinutes,
      this.targetTime.hours,
      this.targetTime.minutes,
      this.currentLevel
    );

    if (isCorrect) this.handleSuccessfulAnswer();
    else this.handleFailedAttempt();
  }

  private checkReadAnswer(choiceIndex: number): void {
    const selectedChoice = this.currentChoices[choiceIndex];
    if (!selectedChoice) return;

    const isMinutesExact = selectedChoice.minutes === this.targetTime.minutes;
    const isHoursExact = selectedChoice.hours === this.targetTime.hours;

    if (isHoursExact && isMinutesExact) this.handleSuccessfulAnswer();
    else this.handleFailedAttempt();
  }

  private formatColoredTargetHTML(target: TimeTarget): string {
    const [hPart, mPart] = target.text.split('h');
    return `<span class="hr-badge">${hPart}h</span><span class="min-badge">${mPart}</span>`;
  }

  private updateUI(): void {
    const instructionEl = document.getElementById('instruction');
    const phaseBadge = document.getElementById('phase-badge');
    const periodBadge = document.getElementById('day-period-badge');
    const placementTools = document.getElementById('placement-tools');
    const checkBtn = document.getElementById('check-btn');
    const choicesContainer = document.getElementById('choices-container');

    if (phaseBadge) {
      phaseBadge.textContent = this.currentPhase === 1
        ? `Étape 1/2 : Lecture (${this.phaseSuccessCount}/3)`
        : `Étape 2/2 : Placement (${this.phaseSuccessCount}/3)`;
    }

    // Affichage du moment de la journée aux Niveaux 5 et 6 (24h)
    if (periodBadge) {
      if (this.targetTime?.periodLabel) {
        periodBadge.textContent = this.targetTime.periodLabel;
        periodBadge.classList.remove('hidden');
      } else {
        periodBadge.classList.add('hidden');
      }
    }

    if (this.currentPhase === 1) {
      checkBtn?.classList.add('hidden');
      placementTools?.classList.add('hidden');
      choicesContainer?.classList.remove('hidden');
      if (instructionEl) {
        instructionEl.innerHTML = `Quelle heure est-il ? <small style="display:block;font-size:0.8rem;color:#94a3b8;font-weight:500;">(🟡 Petite = Heures · 🔵 Grande = Minutes)</small>`;
      }

      const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
      choiceBtns.forEach((btn, idx) => {
        if (this.currentChoices[idx]) btn.textContent = this.currentChoices[idx].text;
      });
    } else {
      checkBtn?.classList.remove('hidden');
      placementTools?.classList.remove('hidden');
      choicesContainer?.classList.add('hidden');
      this.updateHandSelectorUI();
      if (instructionEl) {
        instructionEl.innerHTML = `Place les aiguilles sur : ${this.formatColoredTargetHTML(this.targetTime)}`;
      }
    }
  }

  private get radius(): number {
    return Math.min(this.canvas.width / 2, this.canvas.height / 2) - 10;
  }

  public render(): void {
    this.clock.draw(this.currentLevel);
    this.hands.draw(
      this.currentHours,
      this.currentMinutes,
      this.currentPhase === 2 ? this.activeHand : undefined
    );
  }
}
