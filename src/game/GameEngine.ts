import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager } from './SaveManager';
import type { GameSave } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { TimeMath } from './TimeMath';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private clock: Clock;
  private hands: Hands;
  private questionManager: QuestionManager;
  private soundEngine: SoundEngine;

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
  private isTransitioning: boolean = false;
  private activeHand: 'hour' | 'minute' = 'hour';

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

    this.initEvents();
    this.updateSoundButtonUI();
    this.updateDevButtonUI();
    this.updateMenuUI();
    this.applySkyTheme(true);
  }

  public startLevel(level: number): void {
    this.currentLevel = level;
    this.currentPhase = 1;
    this.phaseSuccessCount = 0;
    this.isTransitioning = false;
    this.questionManager.setLevel(level);

    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    const titleDisplay = document.getElementById('level-title-display');
    if (titleDisplay) titleDisplay.textContent = `Niveau ${level}`;

    this.initNewQuestion();
    this.render();
    this.updateUI();
  }

  private returnToMenu(): void {
    this.isTransitioning = false;
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.remove('hidden');
    this.applySkyTheme(true);
    this.updateDevButtonUI();
    this.updateMenuUI();
  }

  private applySkyTheme(isDay: boolean): void {
    document.body.classList.toggle('theme-day', isDay);
    document.body.classList.toggle('theme-night', !isDay);
  }

  private initNewQuestion(): void {
    this.targetTime = this.questionManager.generateQuestion();
    this.errorsCount = 0;
    this.isTransitioning = false;
    this.hideHelp();
    this.applySkyTheme(this.targetTime.isDay);

    if (this.currentPhase === 1) {
      this.currentHours = this.targetTime.hours;
      this.currentMinutes = this.targetTime.minutes;
      this.currentChoices = this.questionManager.generateChoices(this.targetTime);
    } else {
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
        this.soundEngine.playSnap();
      } else {
        this.saveData = SaveManager.unlockAll(currentMuted);
        this.soundEngine.playLevelComplete();
      }
      this.updateDevButtonUI();
      this.updateMenuUI();
    });

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

      if (distFromCenter > this.radius * 0.66 && diffHr > 0.25) {
        this.activeHand = 'minute';
      } else if (distFromCenter < this.radius * 0.48 && diffMin > 0.25) {
        this.activeHand = 'hour';
      } else if (diffMin < 0.38 && diffMin < diffHr) {
        this.activeHand = 'minute';
      } else if (diffHr < 0.38 && diffHr <= diffMin) {
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

    if (document.activeElement instanceof HTMLElement) { document.activeElement.blur(); }
      const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
    choiceBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        if (!this.isTransitioning && this.currentPhase === 1) {
          (btn as HTMLElement).blur();
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

    levelRects.forEach(rect => {
      const level = parseInt(rect.getAttribute('data-level') || '1', 10);
      const checkMark = rect.querySelector('.lvl-check');
      const isCompleted = this.saveData.completedLevels.includes(level);

      if (level <= maxUnlocked) {
        rect.classList.remove('locked');
        if (isCompleted || level < maxUnlocked) {
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
        if (instructionEl) {
          instructionEl.innerHTML = `🎉 <strong>Bravo !</strong> À toi de placer les aiguilles !`;
        }
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

        const levelBadges: Record<number, string> = {
          1: '🥉 Niveau 1 terminé !',
          2: '🥈 Niveau 2 terminé !',
          3: '🥇 Niveau 3 terminé !',
          4: '🏅 Niveau 4 terminé !',
          5: '🌟 Niveau 5 terminé !',
          6: '👑 Bravo ! Tu es Maître du Temps !'
        };

        const rewardText = `🏆 <strong>${levelBadges[this.currentLevel] || 'Niveau terminé !'}</strong>`;
        if (instructionEl) instructionEl.innerHTML = rewardText;
        setTimeout(() => { this.returnToMenu(); }, 2000);
        return;
      }
    }

    this.soundEngine.playSuccess();
    if (instructionEl) {
      instructionEl.innerHTML = `✅ <strong>Bravo ! Il est bien ${this.targetTime.text} !</strong>`;
    }
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
        helpText.innerHTML = `${baseExplanation} ➔ Il est <strong>${this.targetTime.text}</strong>.`;
      }
    } else {
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
          helpText.innerHTML = `👍 Les heures sont justes ! Place maintenant la grande aiguille bleue sur <strong>${this.targetTime.minutes} min</strong>.`;
        } else {
          const minStr = this.targetTime.minutes < 10 ? `0${this.targetTime.minutes}` : `${this.targetTime.minutes}`;
          helpText.innerHTML = `👍 Les heures sont justes ! Place la grande aiguille bleue sur <strong>${minStr}</strong> (en face du ${targetDialMinNum}).`;
        }
      } else if (!isHourCorrect && isMinuteCorrect) {
        this.activeHand = 'hour';
        this.updateHandSelectorUI();
        this.render();
        helpText.innerHTML = `👍 Les minutes sont justes ! Place la petite aiguille orange sur le <strong>${targetDialHour}</strong>.`;
      } else {
        const minStr = this.targetTime.minutes < 10 ? `0${this.targetTime.minutes}` : `${this.targetTime.minutes}`;
        helpText.innerHTML = `Place la petite aiguille orange sur le <strong>${targetDialHour}</strong> et la grande aiguille bleue sur <strong>${minStr}</strong>.`;
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
    const isHoursExact =
      this.currentLevel >= 5
        ? selectedChoice.hours === this.targetTime.hours
        : (selectedChoice.hours % 12) === (this.targetTime.hours % 12);

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
    const placementTools = document.getElementById('placement-tools');
    const checkBtn = document.getElementById('check-btn');
    const choicesContainer = document.getElementById('choices-container');

    if (phaseBadge) {
      phaseBadge.textContent = this.currentPhase === 1
        ? `Étape 1/2 : Lecture (${this.phaseSuccessCount}/3)`
        : `Étape 2/2 : Placement (${this.phaseSuccessCount}/3)`;
    }

    if (this.currentPhase === 1) {
      checkBtn?.classList.add('hidden');
      placementTools?.classList.add('hidden');
      choicesContainer?.classList.remove('hidden');
      if (instructionEl) {
        instructionEl.textContent = `Quelle heure est-il ?`;
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
        instructionEl.innerHTML = `Place les aiguilles sur ${this.formatColoredTargetHTML(this.targetTime)}`;
      }
    }
  }

  private get radius(): number {
    return Math.min(this.canvas.width / 2, this.canvas.height / 2) - 10;
  }

  public render(): void {
    const isDay = this.targetTime ? this.targetTime.isDay : true;
    this.clock.draw(this.currentLevel, isDay);
    this.hands.draw(
      this.currentHours,
      this.currentMinutes,
      this.currentPhase === 2 ? this.activeHand : undefined
    );
  }
}
