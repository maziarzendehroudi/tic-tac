import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager } from './SaveManager';
import type { GameSave } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { TimeMath } from './TimeMath';

interface CelebrationParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
}

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
  private levelTotalErrors: number = 0;
  private currentQuestionAssisted: boolean = false;
  private highlightHourSector: number | undefined = undefined;

  private currentLevel: number = 1;
  private currentPhase: 1 | 2 = 1;
  private phaseSuccessCount: number = 0;

  private isDragging: boolean = false;
  private isTransitioning: boolean = false;
  private celebrationAnimId: number = 0;
  private activeHand: 'hour' | 'minute' = 'hour';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 14;

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
    cancelAnimationFrame(this.celebrationAnimId);
    this.currentLevel = level;
    this.currentPhase = 1;
    this.phaseSuccessCount = 0;
    this.levelTotalErrors = 0;
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
    cancelAnimationFrame(this.celebrationAnimId);
    this.isTransitioning = false;
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.remove('hidden');
    this.applySkyTheme(true);
    this.updateDevButtonUI();
    this.updateMenuUI();
  }

  private applySkyTheme(isDay: boolean): void {
    document.documentElement.classList.toggle('theme-day', isDay);
    document.documentElement.classList.toggle('theme-night', !isDay);
    document.body.classList.toggle('theme-day', isDay);
    document.body.classList.toggle('theme-night', !isDay);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDay ? '#38bdf8' : '#060b19');
    }
  }

  private initNewQuestion(): void {
    this.targetTime = this.questionManager.generateQuestion();
    this.errorsCount = 0;
    this.currentQuestionAssisted = false;
    this.highlightHourSector = undefined;
    this.isTransitioning = false;
    this.hideHelp();
    this.resetButtonsState();

    const showDaySky = this.currentLevel < 5 ? true : this.targetTime.isDay;
    this.applySkyTheme(showDaySky);

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

    document.getElementById('instruction')?.addEventListener('click', (e) => {
      if (this.currentPhase !== 2) return;
      const target = e.target as HTMLElement;
      if (target.classList.contains('hr-badge')) {
        this.activeHand = 'hour';
        this.soundEngine.playSnap();
        this.updateHandSelectorUI();
        this.render();
      } else if (target.classList.contains('min-badge')) {
        this.activeHand = 'minute';
        this.soundEngine.playSnap();
        this.updateHandSelectorUI();
        this.render();
      }
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

      this.activeHand = TimeMath.pickHandFromPointer(
        pos.x,
        pos.y,
        this.currentHours,
        this.currentMinutes,
        this.radius,
        this.currentLevel,
        this.activeHand
      );
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

    if (minBtn) {
      minBtn.style.display = this.currentLevel === 1 ? 'none' : '';
    }

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
      btn.textContent = this.saveData.muted ? '🔇 Muet' : '🔊 Son';
      btn.setAttribute('aria-pressed', String(!this.saveData.muted));
    }
  }

  private updateDevButtonUI(): void {
    const btn = document.getElementById('dev-unlock-btn');
    if (!btn) return;
    if (SaveManager.isFullyUnlocked(this.saveData)) {
      btn.textContent = '🔄 Réinitialiser';
      btn.classList.add('unlocked-mode');
    } else {
      btn.textContent = '🔓 Mode Test';
      btn.classList.remove('unlocked-mode');
    }
  }

  /**
   * Chantier B : Met à jour la barre de grade (/ 18 ⭐) et les 3 étoiles de maîtrise sur chaque niveau
   */
  private updateMenuUI(): void {
    const levelRects = document.querySelectorAll('.level-rect');
    const maxUnlocked = this.saveData.maxUnlockedLevel || 1;

    const totalStars = SaveManager.getTotalStars(this.saveData);
    const rankTitle = SaveManager.getRankTitle(totalStars);
    const rankEl = document.getElementById('player-rank-title');
    const starsCountEl = document.getElementById('player-stars-count');
    if (rankEl) rankEl.textContent = rankTitle;
    if (starsCountEl) starsCountEl.textContent = `⭐ ${totalStars} / 18`;

    levelRects.forEach(rect => {
      const level = parseInt(rect.getAttribute('data-level') || '1', 10);
      const statusEl = rect.querySelector('.lvl-status');
      const starsEarned = this.saveData.levelStars[level] || 0;

      if (level <= maxUnlocked) {
        rect.classList.remove('locked');
        if (statusEl) {
          if (starsEarned > 0) {
            const starsHtml = [1, 2, 3]
              .map(s => (s <= starsEarned ? '<span class="lvl-star-on">★</span>' : '<span class="lvl-star-off">☆</span>'))
              .join('');
            statusEl.innerHTML = starsHtml;
            statusEl.className = 'lvl-status stars-badge';
          } else {
            statusEl.textContent = '▶';
            statusEl.className = 'lvl-status play';
          }
        }
      } else {
        rect.classList.add('locked');
        if (statusEl) {
          statusEl.textContent = '🔒';
          statusEl.className = 'lvl-status locked-icon';
        }
      }
    });
  }

  private showFeedback(html: string, type: 'success' | 'error'): void {
    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    if (!helpBox || !helpText) return;

    helpText.innerHTML = html;
    helpBox.classList.remove('invisible-feedback', 'hidden', 'feedback-success', 'feedback-error');
    helpBox.classList.add(type === 'success' ? 'feedback-success' : 'feedback-error');
  }

  private hideHelp(): void {
    const helpBox = document.getElementById('help-box');
    if (!helpBox) return;
    helpBox.classList.add('invisible-feedback');
    helpBox.classList.remove('feedback-success', 'feedback-error');
  }

  /**
   * Chantier A (Maîtrise Active) & Chantier B (Notation 1..3 étoiles + Pluie d'étoiles en fin de niveau)
   */
  private handleSuccessfulAnswer(): void {
    this.isTransitioning = true;
    this.triggerSuccessEffect();

    // Chantier A : Si la réponse finale avait été dévoilée après >= 2 erreurs,
    // on félicite l'enfant d'avoir appliqué l'aide, mais il doit réussir une nouvelle question seul pour gagner l'étoile !
    if (this.currentQuestionAssisted) {
      this.soundEngine.playSuccess();
      this.showFeedback(
        `👍 <strong>Bien vu avec l'indice !</strong> Essaie la suivante tout seul pour gagner ton étoile ★`,
        'success'
      );
      setTimeout(() => {
        this.initNewQuestion();
        this.updateUI();
        this.render();
      }, 1500);
      return;
    }

    this.phaseSuccessCount++;
    this.updatePhaseStarsUI();

    if (this.phaseSuccessCount >= 3) {
      if (this.currentPhase === 1) {
        this.soundEngine.playSuccess();
        this.currentPhase = 2;
        this.phaseSuccessCount = 0;
        this.showFeedback('🎉 <strong>Bravo !</strong> Étape 2 : à toi de placer les aiguilles !', 'success');
        setTimeout(() => {
          this.initNewQuestion();
          this.updateUI();
          this.render();
        }, 1500);
        return;
      } else {
        this.soundEngine.playLevelComplete();
        const earnedStars = SaveManager.computeStarsForErrors(this.levelTotalErrors);
        SaveManager.applyLevelRewards(this.saveData, this.currentLevel, earnedStars);
        SaveManager.save(this.saveData);
        this.updateDevButtonUI();
        this.updateMenuUI();

        const starsStr = '★'.repeat(earnedStars) + '☆'.repeat(3 - earnedStars);
        const msg =
          earnedStars === 3
            ? `🏆 <strong>Niveau ${this.currentLevel} parfait (${starsStr}) !</strong> Aucun piège ne te résiste !`
            : `🏆 <strong>Niveau ${this.currentLevel} validé (${starsStr}) !</strong> Rejoue-le pour viser les 3 étoiles !`;

        this.showFeedback(msg, 'success');
        this.playCelebrationAnimation(earnedStars);
        setTimeout(() => { this.returnToMenu(); }, 2300);
        return;
      }
    }

    this.soundEngine.playSuccess();
    const spokenSuffix = this.targetTime.spokenText ? ` (<em>${this.targetTime.spokenText}</em>)` : '';
    this.showFeedback(`✨ <strong>Bravo ! Il est bien ${this.targetTime.text}${spokenSuffix} !</strong>`, 'success');
    setTimeout(() => {
      this.initNewQuestion();
      this.updateUI();
      this.render();
    }, 1250);
  }

  /**
   * Chantier B : Pluie d'étoiles et de confettis dorés sur le Canvas en fin de niveau
   */
  private playCelebrationAnimation(earnedStars: 1 | 2 | 3): void {
    const colors = ['#fbbf24', '#38bdf8', '#34d399', '#f43f5e', '#a855f7'];
    const particles: CelebrationParticle[] = [];
    for (let i = 0; i < 42; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 2.5 + Math.random() * 5.5;
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 6 + Math.random() * 7,
        color: colors[i % colors.length],
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2
      });
    }

    const animate = () => {
      this.render();
      const ctx = this.ctx;
      ctx.save();

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16; // Gravité douce
        p.rotation += p.vRot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      });

      // Badge central des étoiles gagnées
      ctx.beginPath();
      ctx.roundRect(-115, -34, 230, 68, 22);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();

      ctx.font = '700 36px "Fredoka", sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const starsDisplay = '★ '.repeat(earnedStars) + '☆ '.repeat(3 - earnedStars);
      ctx.fillText(starsDisplay.trim(), 0, 2);

      ctx.restore();
      this.celebrationAnimId = requestAnimationFrame(animate);
    };

    this.celebrationAnimId = requestAnimationFrame(animate);
  }

  private handleFailedAttempt(): void {
    this.errorsCount++;
    this.levelTotalErrors++;
    // Chantier C : Affichage immédiat du secteur "Territoire de l'Heure" sur le cadran !
    this.highlightHourSector = this.targetTime.hours;

    // Chantier A : Si l'enfant fait une 2e erreur sur la même question, la solution est révélée (question assistée)
    if (this.errorsCount >= 2) {
      this.currentQuestionAssisted = true;
    }

    this.soundEngine.playError();
    this.triggerShakeEffect();
    this.render();
    this.showDiagnosticHelp();
  }

  private showDiagnosticHelp(): void {
    const baseExplanation = TimeMath.buildPedagogicalHint(
      this.targetTime.hours,
      this.targetTime.minutes,
      this.currentLevel
    );

    if (this.currentPhase === 1) {
      if (this.errorsCount === 1) {
        this.showFeedback(`💡 ${baseExplanation}`, 'error');
      } else {
        this.showFeedback(`💡 ${baseExplanation} ➔ Clique sur <strong>${this.targetTime.text}</strong>.`, 'error');
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
          this.showFeedback(`💡 Les heures sont justes ! Place la grande aiguille bleue sur <strong>${this.targetTime.minutes} min</strong> (avec − / +).`, 'error');
        } else {
          const minStr = this.targetTime.minutes < 10 ? `0${this.targetTime.minutes}` : `${this.targetTime.minutes}`;
          this.showFeedback(`💡 Les heures sont justes ! Place la grande aiguille bleue sur <strong>${minStr}</strong> (en face du ${targetDialMinNum}).`, 'error');
        }
      } else if (!isHourCorrect && isMinuteCorrect) {
        this.activeHand = 'hour';
        this.updateHandSelectorUI();
        this.render();
        this.showFeedback(`💡 Les minutes sont justes ! Place la petite aiguille orange dans la zone dorée du <strong>${targetDialHour}</strong>.`, 'error');
      } else {
        const minStr = this.targetTime.minutes < 10 ? `0${this.targetTime.minutes}` : `${this.targetTime.minutes}`;
        this.showFeedback(`💡 Place la petite aiguille orange sur le <strong>${targetDialHour}</strong> et la grande aiguille bleue sur <strong>${minStr}</strong>.`, 'error');
      }
    }
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

  private animateButtonFeedback(btn: HTMLElement | null, isCorrect: boolean): void {
    if (!btn) return;
    btn.classList.remove('btn-correct', 'btn-wrong');
    void btn.offsetWidth;

    if (isCorrect) {
      btn.classList.add('btn-correct');
    } else {
      btn.classList.add('btn-wrong');
      setTimeout(() => {
        btn.classList.remove('btn-wrong');
      }, 460);
    }
  }

  private resetButtonsState(): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const allBtns = document.querySelectorAll('#choices-container .choice-btn, #check-btn');
    allBtns.forEach(btn => btn.classList.remove('btn-correct', 'btn-wrong'));
  }

  private checkPlaceAnswer(): void {
    const checkBtn = document.getElementById('check-btn');
    const isCorrect = TimeMath.isPlacementCorrect(
      this.currentHours,
      this.currentMinutes,
      this.targetTime.hours,
      this.targetTime.minutes,
      this.currentLevel
    );

    this.animateButtonFeedback(checkBtn, isCorrect);
    if (isCorrect) this.handleSuccessfulAnswer();
    else this.handleFailedAttempt();
  }

  private checkReadAnswer(choiceIndex: number): void {
    const selectedChoice = this.currentChoices[choiceIndex];
    if (!selectedChoice) return;

    const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
    const clickedBtn = (choiceBtns[choiceIndex] as HTMLElement) || null;

    const isMinutesExact = selectedChoice.minutes === this.targetTime.minutes;
    const isHoursExact =
      this.currentLevel >= 5
        ? selectedChoice.hours === this.targetTime.hours
        : (selectedChoice.hours % 12) === (this.targetTime.hours % 12);

    const isCorrect = isHoursExact && isMinutesExact;
    this.animateButtonFeedback(clickedBtn, isCorrect);

    if (isCorrect) this.handleSuccessfulAnswer();
    else this.handleFailedAttempt();
  }

  private formatColoredTargetHTML(target: TimeTarget): string {
    const [hPart, mPart] = target.text.split('h');
    const spokenChip = target.spokenText ? `<span class="spoken-chip">« ${target.spokenText} »</span>` : '';
    return `<span class="hr-badge" title="Toucher pour régler les heures">${hPart}h</span><span class="min-badge" title="Toucher pour régler les minutes">${mPart}</span>${spokenChip}`;
  }

  private updatePhaseStarsUI(): void {
    const phaseBadge = document.getElementById('phase-badge');
    if (!phaseBadge) return;
    const totalEarned = (this.currentPhase === 1 ? 0 : 3) + this.phaseSuccessCount;
    const stars = [0, 1, 2, 3, 4, 5]
      .map(i => (i < totalEarned ? '<span class="star-on">★</span>' : '<span class="star-off">☆</span>'))
      .join('');
    phaseBadge.innerHTML = stars;
  }

  private updateUI(): void {
    const instructionEl = document.getElementById('instruction');
    const placementTools = document.getElementById('placement-tools');
    const checkBtn = document.getElementById('check-btn');
    const choicesContainer = document.getElementById('choices-container');

    this.updatePhaseStarsUI();

    const periodChip =
      this.currentLevel >= 5 && this.targetTime?.periodLabel
        ? `<span class="period-chip">${this.targetTime.periodLabel}</span>`
        : '';

    if (this.currentPhase === 1) {
      checkBtn?.classList.add('hidden');
      placementTools?.classList.add('hidden');
      choicesContainer?.classList.remove('hidden');
      if (instructionEl) {
        instructionEl.innerHTML = `${periodChip}<span>Quelle heure est-il ?</span>`;
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
        instructionEl.innerHTML = `${periodChip}<span>Place</span> ${this.formatColoredTargetHTML(this.targetTime)}`;
      }
    }
  }

  private get radius(): number {
    return Math.min(this.canvas.width / 2, this.canvas.height / 2) - 14;
  }

  public render(): void {
    const isDay = this.currentLevel < 5 ? true : (this.targetTime ? this.targetTime.isDay : true);
    const is24HourTarget = this.targetTime ? TimeMath.is24HourRingTarget(this.targetTime.hours) : false;
    this.clock.draw(this.currentLevel, isDay, is24HourTarget, this.highlightHourSector);
    this.hands.draw(
      this.currentHours,
      this.currentMinutes,
      this.currentLevel,
      this.currentPhase === 2 ? this.activeHand : undefined
    );
  }
}
