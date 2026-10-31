import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager, ALL_PARTS, ALL_THEMES, ALL_HANDS } from './SaveManager';
import type { GameSave, DialTheme, HandsStyle } from './SaveManager';
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
  private activeHand: 'hour' | 'minute' = 'minute';
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
    this.clock = new Clock(this.ctx, radius, this.saveData.selectedTheme);
    this.hands = new Hands(this.ctx, radius, this.saveData.selectedHands);
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
      this.watchMechanism.setTheme(this.saveData.selectedTheme);
    }

    this.initEvents();
    this.updateSoundButtonUI();
    this.updateDevButtonUI();
    this.updateMenuUI();
    this.renderThemeSelector();
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
    this.renderThemeSelector();
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

    if (placed.length === 0) {
      banner.textContent = '🛠️ Touche les boutons en bas (de 1 à 5) pour construire ta montre !';
    } else if (!hasCrown || !hasSpring) {
      banner.textContent = '⚙️ Monte la Molette (1) à gauche et le Ressort (2) pour donner de la force à la montre.';
    } else if (this.isWinding) {
      banner.textContent =
        powerPct >= 100
          ? '✅ Le ressort est plein d’énergie (100%) ! Tu peux relâcher.'
          : '🔄 Bravo ! La molette resserre le ressort orange pour faire le plein d’énergie...';
    } else if (powerPct === 0) {
      banner.textContent = '⚡ Le ressort est fatigué ! Maintiens la Molette à gauche ou le bouton « Remonter ».';
    } else if (!hasHours || !hasMinutes || !hasSeconds) {
      banner.textContent = '⏱️ Empile les 3 roues au milieu : Grande Jaune (Heures), Moyenne Bleue (Minutes), Petite Rouge (Secondes) !';
    } else {
      banner.textContent = '✨ Regarde : la petite roue rouge tourne vite, la bleue plus doucement, et la grande jaune lentement !';
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
        this.clock.setTheme(this.saveData.selectedTheme);
        this.hands.setStyle(this.saveData.selectedHands);
        this.watchMechanism?.setTheme(this.saveData.selectedTheme);
        if (this.watchMechanism) this.watchMechanism.power = 0;
        this.soundEngine.playSnap();
      } else {
        this.saveData = SaveManager.unlockAll(currentMuted);
        if (this.watchMechanism) this.watchMechanism.power = 80;
        this.soundEngine.playLevelComplete();
      }
      this.updateDevButtonUI();
      this.updateMenuUI();
      this.renderThemeSelector();
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

    // --- ÉVÉNEMENTS DE L'ÉCRAN D'APPRENTISSAGE ---
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

      if (diffMin < diffHr || distFromCenter > this.radius * 0.6) this.activeHand = 'minute';
      else this.activeHand = 'hour';

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
    const isLevel6Master = this.saveData.unlockedHands.includes('neon-hands');

    levelRects.forEach(rect => {
      const level = parseInt(rect.getAttribute('data-level') || '1', 10);
      const checkMark = rect.querySelector('.lvl-check');

      if (level <= maxUnlocked) {
        rect.classList.remove('locked');
        if (level < maxUnlocked || (level === 6 && isLevel6Master)) {
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

  private renderThemeSelector(): void {
    const dialsContainer = document.getElementById('dial-themes-list');
    const handsContainer = document.getElementById('hands-styles-list');
    if (!dialsContainer || !handsContainer) return;

    const dialMeta: Record<DialTheme, { label: string; icon: string; unlockHint: string }> = {
      classic: { label: 'Classique', icon: '⌚', unlockHint: 'Débloqué' },
      wood: { label: 'Bois', icon: '🪵', unlockHint: 'Niv. 1' },
      forest: { label: 'Forêt', icon: '🌲', unlockHint: 'Niv. 2' },
      ocean: { label: 'Océan', icon: '🌊', unlockHint: 'Niv. 3' },
      space: { label: 'Espace', icon: '🌌', unlockHint: 'Niv. 4' }
    };

    const handsMeta: Record<HandsStyle, { label: string; icon: string; unlockHint: string }> = {
      'classic-hands': { label: 'Acier & Bleu', icon: '🔹', unlockHint: 'Débloqué' },
      'gold-hands': { label: 'Or Horloger', icon: '✨', unlockHint: 'Niv. 5' },
      'neon-hands': { label: 'Néon Maître', icon: '⚡', unlockHint: 'Niv. 6' }
    };

    dialsContainer.innerHTML = '';
    ALL_THEMES.forEach(theme => {
      const isUnlocked = this.saveData.unlockedThemes.includes(theme);
      const isSelected = this.saveData.selectedTheme === theme;
      const meta = dialMeta[theme];

      const btn = document.createElement('button');
      btn.className = `theme-pill${isSelected ? ' active' : ''}${!isUnlocked ? ' locked' : ''}`;
      btn.innerHTML = isUnlocked
        ? `${meta.icon} <span>${meta.label}</span>`
        : `🔒 <span>${meta.label} (${meta.unlockHint})</span>`;

      btn.addEventListener('click', () => {
        if (!isUnlocked) {
          this.soundEngine.playError();
          return;
        }
        this.saveData.selectedTheme = theme;
        this.clock.setTheme(theme);
        this.watchMechanism?.setTheme(theme);
        SaveManager.save(this.saveData);
        this.soundEngine.playSnap();
        this.renderThemeSelector();
        this.render();
      });

      dialsContainer.appendChild(btn);
    });

    handsContainer.innerHTML = '';
    ALL_HANDS.forEach(style => {
      const isUnlocked = this.saveData.unlockedHands.includes(style);
      const isSelected = this.saveData.selectedHands === style;
      const meta = handsMeta[style];

      const btn = document.createElement('button');
      btn.className = `theme-pill${isSelected ? ' active' : ''}${!isUnlocked ? ' locked' : ''}`;
      btn.innerHTML = isUnlocked
        ? `${meta.icon} <span>${meta.label}</span>`
        : `🔒 <span>${meta.label} (${meta.unlockHint})</span>`;

      btn.addEventListener('click', () => {
        if (!isUnlocked) {
          this.soundEngine.playError();
          return;
        }
        this.saveData.selectedHands = style;
        this.hands.setStyle(style);
        SaveManager.save(this.saveData);
        this.soundEngine.playSnap();
        this.renderThemeSelector();
        this.render();
      });

      handsContainer.appendChild(btn);
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
      emptyMsg.textContent = 'Termine les niveaux (ou clique sur « Tout débloquer ») pour forger tes pièces !';
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
      default: return '🔧';
    }
  }

  private getPartName(partId: string): string {
    switch (partId) {
      case 'crown': return 'Molette';
      case 'spring': return 'Ressort';
      case 'hours': return 'Roue Heures';
      case 'minutes': return 'Roue Minutes';
      case 'seconds': return 'Roue Secondes';
      default: return partId;
    }
  }

  private handleSuccessfulAnswer(): void {
    this.isTransitioning = true;
    this.phaseSuccessCount++;
    this.triggerSuccessEffect();

    const instructionEl = document.getElementById('instruction');

    if (this.phaseSuccessCount >= 3) {
      if (this.currentPhase === 1) {
        this.soundEngine.playSuccess();
        this.currentPhase = 2;
        this.phaseSuccessCount = 0;
        if (instructionEl) instructionEl.innerHTML = `<span style="font-size: 2.5rem;">👍</span>`;
        setTimeout(() => {
          this.initNewQuestion();
          this.updateUI();
          this.render();
        }, 1500);
        return;
      } else {
        this.soundEngine.playLevelComplete();
        SaveManager.applyLevelRewards(this.saveData, this.currentLevel);
        SaveManager.save(this.saveData);
        this.updateDevButtonUI();
        this.updateMenuUI();
        this.renderThemeSelector();

        const rewardText =
          this.currentLevel === 6
            ? `🏆 <span style="font-size: 2rem;">⚡</span> Coffret Maître Horloger débloqué !`
            : `🏆 <span style="font-size: 2rem;">👍</span> Pièce & Habillage forgés !`;

        if (instructionEl) instructionEl.innerHTML = rewardText;
        setTimeout(() => { this.returnToMenu(); }, 2200);
        return;
      }
    }

    this.soundEngine.playSuccess();
    if (instructionEl) instructionEl.innerHTML = `<span style="font-size: 2.5rem;">👍</span>`;
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
    const instructionEl = document.getElementById('instruction');

    if (this.errorsCount >= 3) {
      this.showHelp();
    } else {
      this.isTransitioning = true;
      if (instructionEl) instructionEl.innerHTML = `<span style="font-size: 2.5rem;">❌</span>`;
      setTimeout(() => {
        this.isTransitioning = false;
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
      const nextHours = TimeMath.pointerToHours(x, y);
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

      const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
      choiceBtns.forEach((btn, idx) => {
        if (this.currentChoices[idx]) btn.textContent = this.currentChoices[idx].text;
      });
    } else {
      if (checkBtn) checkBtn.classList.remove('hidden');
      if (choicesContainer) choicesContainer.classList.add('hidden');
      if (instructionEl) instructionEl.innerHTML = `Place les aiguilles sur : <strong>${this.targetTime.text}</strong>`;
    }
  }

  private get radius(): number {
    return Math.min(this.canvas.width / 2, this.canvas.height / 2) - 10;
  }

  public render(): void {
    this.clock.draw(this.currentLevel);
    this.hands.draw(this.currentHours, this.currentMinutes);
  }
}
