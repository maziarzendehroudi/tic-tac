import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager, ALL_PARTS } from './SaveManager';
import type { GameSave } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { TimeMath } from './TimeMath';
import { WatchMechanism } from './WatchMechanism';

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

const PART_INFO: Record<string, { label: string; desc: string }> = {
  crown: {
    label: '1. Molette',
    desc: 'La molette et sa tige filetée permettent de remonter la montre !'
  },
  spring: {
    label: '2. Ressort',
    desc: 'Le ressort de barillet stocke l’énergie quand tu tournes la molette !'
  },
  hours: {
    label: '3. Heures',
    desc: 'La roue dorée des heures fait tourner la petite aiguille !'
  },
  minutes: {
    label: '4. Minutes',
    desc: 'L’engrenage bleu démultiplie le mouvement pour la grande aiguille des minutes !'
  },
  seconds: {
    label: '5. Secondes',
    desc: 'L’engrenage rouge rapide entraîne la trotteuse des secondes !'
  },
  escapement: {
    label: '6. Tic-Tac',
    desc: 'L’échappement à ancre régule les engrenages dent par dent en faisant Tic-Tac !'
  }
};

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private clock: Clock;
  private hands: Hands;
  private questionManager: QuestionManager;
  private soundEngine: SoundEngine;

  private workshopCanvas: HTMLCanvasElement | null = null;
  private watchMechanism: WatchMechanism | null = null;
  private workshopAnimId: number = 0;
  private lastWorkshopTime: number = 0;
  private isWinding: boolean = false;

  private currentHours: number = 12;
  private currentMinutes: number = 0;

  private targetTime!: TimeTarget;
  private currentChoices: TimeTarget[] = [];
  private saveData: GameSave;
  private errorsCount: number = 0;
  private levelTotalErrors: number = 0;
  private currentQuestionAssisted: boolean = false;
  private showGhostGuide: boolean = false;

  private currentLevel: number = 1;
  private currentPhase: 1 | 2 = 1;
  private phaseSuccessCount: number = 0;

  private isDragging: boolean = false;
  private isWaitingNext: boolean = false;
  private nextActionCallback: (() => void) | null = null;
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

    this.workshopCanvas = document.getElementById('workshopCanvas') as HTMLCanvasElement | null;
    if (this.workshopCanvas) {
      const wCtx = this.workshopCanvas.getContext('2d')!;
      this.watchMechanism = new WatchMechanism(
        wCtx,
        this.workshopCanvas.width,
        this.workshopCanvas.height,
        (isTic) => this.soundEngine.playTick(isTic),
        () => this.soundEngine.playSnap()
      );
    }

    this.initEvents();
    this.updateSoundButtonUI();
    this.updateDevButtonUI();
    this.updateMenuUI();
    this.applySkyTheme(true);
  }

  private clearPendingAnimations(): void {
    cancelAnimationFrame(this.celebrationAnimId);
    cancelAnimationFrame(this.workshopAnimId);
    this.isWinding = false;
    this.isWaitingNext = false;
    this.nextActionCallback = null;
  }

  public startLevel(level: number): void {
    this.clearPendingAnimations();
    this.currentLevel = level;
    this.currentPhase = 1;
    this.phaseSuccessCount = 0;
    this.levelTotalErrors = 0;
    this.questionManager.setLevel(level);

    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('workshop-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    const titleDisplay = document.getElementById('level-title-display');
    if (titleDisplay) titleDisplay.textContent = `Niveau ${level}`;

    this.initNewQuestion();
    this.render();
    this.updateUI();
  }

  private openWorkshop(): void {
    this.clearPendingAnimations();
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('workshop-screen')?.classList.remove('hidden');
    this.applySkyTheme(false);

    if (this.saveData.unlockedParts.length < ALL_PARTS.length) {
      this.saveData.unlockedParts = [...ALL_PARTS];
      SaveManager.save(this.saveData);
    }

    this.renderWorkshopUI();
    this.lastWorkshopTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - this.lastWorkshopTime);
      this.lastWorkshopTime = now;
      if (this.watchMechanism) {
        this.watchMechanism.update(dt, this.saveData.placedParts, this.isWinding);
        this.watchMechanism.draw(
          this.saveData.placedParts,
          this.saveData.unlockedParts,
          this.isWinding
        );
        this.updatePowerMeterUI(this.watchMechanism.power);
      }
      this.workshopAnimId = requestAnimationFrame(loop);
    };
    this.workshopAnimId = requestAnimationFrame(loop);
  }

  private updatePowerMeterUI(power: number): void {
    const fillEl = document.getElementById('power-bar-fill');
    const textEl = document.getElementById('power-bar-text');
    const pct = Math.round(power);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (textEl) textEl.textContent = `🔋 Énergie : ${pct}%`;
  }

  private renderWorkshopUI(): void {
    const tray = document.getElementById('workshop-parts-tray');
    const instr = document.getElementById('workshop-instruction');
    const dialBtn = document.getElementById('toggle-dial-btn');
    if (!tray || !this.watchMechanism) return;

    if (dialBtn) {
      dialBtn.textContent = this.watchMechanism.showDial ? '👁️ Cadran : Oui' : '👁️ Cadran : Non';
    }

    tray.innerHTML = '';
    ALL_PARTS.forEach(partId => {
      const info = PART_INFO[partId];
      const isPlaced = this.saveData.placedParts.includes(partId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `workshop-part-btn${isPlaced ? ' placed' : ''}`;
      btn.textContent = isPlaced ? `✓ ${info.label}` : `+ ${info.label}`;
      btn.addEventListener('click', () => {
        const idx = this.saveData.placedParts.indexOf(partId);
        if (idx === -1) {
          this.saveData.placedParts.push(partId);
          this.soundEngine.playSuccess();
          if (instr) instr.innerHTML = `✨ <strong>${info.label}</strong> : ${info.desc}`;
        } else {
          this.saveData.placedParts.splice(idx, 1);
          this.soundEngine.playSnap();
          if (instr) instr.textContent = `${info.label} retirée du mécanisme.`;
        }
        SaveManager.save(this.saveData);
        this.renderWorkshopUI();
      });
      tray.appendChild(btn);
    });

    if (instr && !instr.innerHTML) {
      instr.textContent =
        this.saveData.placedParts.length === ALL_PARTS.length
          ? '👑 Toutes les pièces sont en place ! Maintiens la molette à gauche pour remonter le ressort !'
          : 'Touche les 6 pièces en bas pour assembler le mécanisme de ta montre !';
    }
  }

  private returnToMenu(): void {
    this.clearPendingAnimations();
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('workshop-screen')?.classList.add('hidden');
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
      metaTheme.setAttribute('content', isDay ? '#38bdf8' : '#0b132b');
    }
  }

  private initNewQuestion(): void {
    cancelAnimationFrame(this.celebrationAnimId);
    this.targetTime = this.questionManager.generateQuestion();
    this.errorsCount = 0;
    this.currentQuestionAssisted = false;
    this.showGhostGuide = false;
    this.isWaitingNext = false;
    this.nextActionCallback = null;
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
      this.currentMinutes =
        this.currentLevel >= 2 && this.targetTime.minutes === 0 ? 30 : 0;
      this.activeHand = 'hour';
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

    document.getElementById('workshop-btn')?.addEventListener('click', () => {
      if (SaveManager.isWorkshopUnlocked(this.saveData)) {
        this.soundEngine.playSnap();
        this.openWorkshop();
      } else {
        this.soundEngine.playError();
      }
    });

    document.getElementById('workshop-back-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.returnToMenu();
    });

    document.getElementById('toggle-dial-btn')?.addEventListener('click', () => {
      if (!this.watchMechanism) return;
      this.watchMechanism.showDial = !this.watchMechanism.showDial;
      this.soundEngine.playSnap();
      this.renderWorkshopUI();
    });

    // Remontage par le bouton "🔄 Remonter" ou directement sur la molette (crown) du Canvas
    const windBtn = document.getElementById('wind-crown-btn');
    const startWinding = (e: Event) => {
      e.preventDefault();
      this.isWinding = true;
    };
    const stopWinding = () => {
      this.isWinding = false;
    };
    windBtn?.addEventListener('mousedown', startWinding);
    windBtn?.addEventListener('touchstart', startWinding, { passive: false });
    window.addEventListener('mouseup', stopWinding);
    window.addEventListener('touchend', stopWinding);

    if (this.workshopCanvas) {
      const onWorkshopPointerDown = (e: MouseEvent | TouchEvent) => {
        if (!this.watchMechanism || !this.workshopCanvas) return;
        const rect = this.workshopCanvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const canvasX = (clientX - rect.left) * (this.workshopCanvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (this.workshopCanvas.height / rect.height);
        if (this.watchMechanism.isPointInCrown(canvasX, canvasY)) {
          e.preventDefault();
          this.isWinding = true;
        }
      };
      this.workshopCanvas.addEventListener('mousedown', onWorkshopPointerDown);
      this.workshopCanvas.addEventListener('touchstart', onWorkshopPointerDown, { passive: false });
    }

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

    const forceRefreshBtn = document.getElementById('force-refresh-btn');
    forceRefreshBtn?.addEventListener('click', async () => {
      forceRefreshBtn.textContent = '⏳...';
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }
      } catch {
        // Poursuit le rechargement forcé même en cas de restriction navigateur
      }
      const url = new URL(window.location.href);
      url.searchParams.set('t', String(Date.now()));
      window.location.replace(url.toString());
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

    document.getElementById('profile-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.openProfileModal();
    });

    document.getElementById('profile-close-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      document.getElementById('profile-modal')?.classList.add('hidden');
    });

    const addProfileForm = document.getElementById('add-profile-form') as HTMLFormElement | null;
    addProfileForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('new-profile-input') as HTMLInputElement | null;
      const name = input?.value.trim() || '';
      if (!name) return;
      const created = SaveManager.createProfile(name, this.saveData.muted);
      this.saveData = created.save;
      if (input) input.value = '';
      this.soundEngine.playSuccess();
      this.renderProfilesList();
      this.updateDevButtonUI();
      this.updateMenuUI();
      document.getElementById('profile-modal')?.classList.add('hidden');
    });

    document.getElementById('next-question-btn')?.addEventListener('click', () => {
      if (this.isWaitingNext && this.nextActionCallback) {
        this.soundEngine.playSnap();
        const cb = this.nextActionCallback;
        this.nextActionCallback = null;
        this.isWaitingNext = false;
        cb();
      }
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
      if (this.currentPhase === 1 || this.isWaitingNext) return;
      e.preventDefault();
      const pos = getPointerPos(e);

      this.activeHand = TimeMath.pickHandFromPointer(
        pos.x,
        pos.y,
        this.currentHours,
        this.currentMinutes,
        this.radius,
        this.currentLevel,
        this.activeHand,
        this.targetTime.hours,
        this.targetTime.minutes
      );

      this.isDragging = true;
      this.updateFromPointer(pos.x, pos.y);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging || this.currentPhase === 1 || this.isWaitingNext) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      this.updateFromPointer(pos.x, pos.y);
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.snapToGrid();
      this.soundEngine.playSnap();
      this.render();
    };

    this.canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    document.getElementById('check-btn')?.addEventListener('click', () => {
      if (this.isWaitingNext && this.nextActionCallback) {
        this.soundEngine.playSnap();
        const cb = this.nextActionCallback;
        this.nextActionCallback = null;
        this.isWaitingNext = false;
        cb();
        return;
      }
      if (!this.isWaitingNext && this.currentPhase === 2) {
        this.checkPlaceAnswer();
      }
    });

    const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
    choiceBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        if (!this.isWaitingNext && this.currentPhase === 1) {
          (btn as HTMLElement).blur();
          this.checkReadAnswer(index);
        }
      });
    });
  }

  private openProfileModal(): void {
    this.renderProfilesList();
    document.getElementById('profile-modal')?.classList.remove('hidden');
  }

  private renderProfilesList(): void {
    const listEl = document.getElementById('profiles-list');
    if (!listEl) return;
    const profiles = SaveManager.getProfiles();
    const active = SaveManager.getActiveProfile();

    listEl.innerHTML = '';
    profiles.forEach(profile => {
      const stars = SaveManager.getTotalStars(profile.save);
      const row = document.createElement('div');
      row.className = `profile-item${profile.id === active.id ? ' active-profile' : ''}`;

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'profile-select-btn';
      selectBtn.innerHTML = `<span class="prof-name">👤 ${profile.name}</span><span class="prof-stars">⭐ ${stars}/${SaveManager.MAX_STARS}</span>`;
      selectBtn.addEventListener('click', () => {
        this.saveData = SaveManager.switchProfile(profile.id);
        this.soundEngine.setMuted(this.saveData.muted);
        this.soundEngine.playSnap();
        this.updateSoundButtonUI();
        this.updateDevButtonUI();
        this.updateMenuUI();
        document.getElementById('profile-modal')?.classList.add('hidden');
      });

      row.appendChild(selectBtn);

      if (profiles.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'profile-del-btn';
        delBtn.title = `Supprimer ${profile.name}`;
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const updatedActive = SaveManager.deleteProfile(profile.id);
          this.saveData = updatedActive.save;
          this.soundEngine.playSnap();
          this.renderProfilesList();
          this.updateDevButtonUI();
          this.updateMenuUI();
        });
        row.appendChild(delBtn);
      }

      listEl.appendChild(row);
    });
  }

  private updateSoundButtonUI(): void {
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.classList.toggle('is-muted', this.saveData.muted);
      btn.setAttribute('aria-pressed', String(!this.saveData.muted));
      btn.setAttribute('title', this.saveData.muted ? 'Son coupé' : 'Son actif');
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

  private updateMenuUI(): void {
    const levelRects = document.querySelectorAll('.level-rect');
    const maxUnlocked = this.saveData.maxUnlockedLevel || 1;
    const activeProfile = SaveManager.getActiveProfile();

    const profileLabel = document.getElementById('current-profile-name');
    if (profileLabel) profileLabel.textContent = activeProfile.name;

    const totalStars = SaveManager.getTotalStars(this.saveData);
    const rankTitle = SaveManager.getRankTitle(totalStars);
    const rankEl = document.getElementById('player-rank-title');
    const starsCountEl = document.getElementById('player-stars-count');
    if (rankEl) rankEl.textContent = rankTitle;
    if (starsCountEl) starsCountEl.textContent = `⭐ ${totalStars} / ${SaveManager.MAX_STARS}`;

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

    const workshopBtn = document.getElementById('workshop-btn');
    const workshopStatus = document.getElementById('workshop-status');
    const workshopUnlocked = SaveManager.isWorkshopUnlocked(this.saveData);
    if (workshopBtn && workshopStatus) {
      if (workshopUnlocked) {
        workshopBtn.classList.remove('locked');
        workshopStatus.textContent = `${this.saveData.placedParts.length}/6 ⚙️`;
        workshopStatus.className = 'lvl-status stars-badge';
      } else {
        workshopBtn.classList.add('locked');
        workshopStatus.textContent = '🔒';
        workshopStatus.className = 'lvl-status locked-icon';
      }
    }
  }

  private showFeedback(
    html: string,
    type: 'success' | 'error',
    nextCallback?: () => void,
    nextBtnLabel: string = 'Suivant ➔'
  ): void {
    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    const nextBtn = document.getElementById('next-question-btn');
    if (!helpBox || !helpText) return;

    helpText.innerHTML = html;
    helpBox.classList.remove('invisible-feedback', 'hidden', 'feedback-success', 'feedback-error');
    helpBox.classList.add(type === 'success' ? 'feedback-success' : 'feedback-error');

    if (nextBtn) {
      if (nextCallback) {
        nextBtn.textContent = nextBtnLabel;
        nextBtn.classList.remove('hidden');
        this.isWaitingNext = true;
        this.nextActionCallback = nextCallback;
      } else {
        nextBtn.classList.add('hidden');
      }
    }
  }

  private hideHelp(): void {
    const helpBox = document.getElementById('help-box');
    const nextBtn = document.getElementById('next-question-btn');
    if (!helpBox) return;
    helpBox.classList.add('invisible-feedback');
    helpBox.classList.remove('feedback-success', 'feedback-error');
    nextBtn?.classList.add('hidden');
  }

  private handleSuccessfulAnswer(): void {
    this.triggerSuccessEffect();

    if (this.currentQuestionAssisted) {
      this.soundEngine.playSuccess();
      this.showFeedback(
        `👍 <strong>Bien vu !</strong> Réussis la suivante du premier coup pour gagner ton étoile ★`,
        'success',
        () => {
          this.initNewQuestion();
          this.updateUI();
          this.render();
        }
      );
      return;
    }

    this.phaseSuccessCount++;
    this.updatePhaseStarsUI();

    if (this.phaseSuccessCount >= 3) {
      if (this.currentPhase === 1) {
        this.soundEngine.playSuccess();
        this.showFeedback(
          '🎉 <strong>Bravo !</strong> Étape 2 : à toi de placer les aiguilles avec ton doigt !',
          'success',
          () => {
            this.currentPhase = 2;
            this.phaseSuccessCount = 0;
            this.initNewQuestion();
            this.updateUI();
            this.render();
          },
          'Étape 2 ➔'
        );
        return;
      } else {
        this.soundEngine.playLevelComplete();
        const earnedStars = SaveManager.computeStarsForErrors(this.levelTotalErrors);
        SaveManager.applyLevelRewards(this.saveData, this.currentLevel, earnedStars);
        SaveManager.save(this.saveData);
        this.updateDevButtonUI();
        this.updateMenuUI();

        const starsStr = '★'.repeat(earnedStars) + '☆'.repeat(3 - earnedStars);
        this.playCelebrationAnimation(earnedStars);

        if (this.currentLevel === SaveManager.MAX_LEVEL) {
          this.showFeedback(
            `👑 <strong>Niveau 7 validé (${starsStr}) !</strong> L’Atelier de l’Horloger est débloqué !`,
            'success',
            () => {
              this.openWorkshop();
            },
            'Atelier ⚙️'
          );
          return;
        }

        const msg =
          earnedStars === 3
            ? `🏆 <strong>Niveau ${this.currentLevel} parfait (${starsStr}) !</strong>`
            : `🏆 <strong>Niveau ${this.currentLevel} validé (${starsStr}) !</strong>`;

        this.showFeedback(
          msg,
          'success',
          () => {
            this.returnToMenu();
          },
          'Menu 🏆'
        );
        return;
      }
    }

    this.soundEngine.playSuccess();
    const spokenSuffix = this.targetTime.spokenText ? ` (<em>${this.targetTime.spokenText}</em>)` : '';
    this.showFeedback(
      `✨ <strong>Bravo ! Il est bien ${this.targetTime.text}${spokenSuffix} !</strong>`,
      'success',
      () => {
        this.initNewQuestion();
        this.updateUI();
        this.render();
      }
    );
  }

  private playCelebrationAnimation(earnedStars: 1 | 2 | 3): void {
    const colors = ['#fbbf24', '#38bdf8', '#34d399', '#f43f5e', '#a855f7'];
    const particles: CelebrationParticle[] = [];
    for (let i = 0; i < 42; i++) {
      const angle = Math.random() * Math.PI * 2;
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
        p.vy += 0.16;
        p.rotation += p.vRot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      });

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

  private handleFailedReadAttempt(selectedChoice: TimeTarget): void {
    this.errorsCount++;
    this.levelTotalErrors++;

    if (this.errorsCount >= 2) {
      this.currentQuestionAssisted = true;
    }

    this.soundEngine.playError();
    this.triggerShakeEffect();

    const diagnosticHint = TimeMath.buildReadDiagnosticHint(
      this.targetTime.hours,
      this.targetTime.minutes,
      selectedChoice.hours,
      selectedChoice.minutes,
      this.currentLevel
    );

    this.showFeedback(`💡 ${diagnosticHint}`, 'error');
  }

  private handleFailedPlaceAttempt(): void {
    this.errorsCount++;
    this.levelTotalErrors++;

    if (this.errorsCount >= 3) {
      this.currentQuestionAssisted = true;
      this.showGhostGuide = true;
    }

    this.soundEngine.playError();
    this.triggerShakeEffect();
    this.render();

    if (this.showGhostGuide) {
      this.showFeedback(
        '💡 Aide-toi du modèle en pointillés sur l’horloge, puis clique sur <strong>✓ Vérifier</strong> !',
        'error'
      );
    } else {
      const placeHint = TimeMath.buildPlacementDiagnosticHint(
        this.currentHours,
        this.currentMinutes,
        this.targetTime.hours,
        this.targetTime.minutes,
        this.currentLevel
      );
      this.showFeedback(`💡 ${placeHint}`, 'error');
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
    else this.handleFailedPlaceAttempt();
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
    else this.handleFailedReadAttempt(selectedChoice);
  }

  private formatNeutralTargetHTML(target: TimeTarget): string {
    return `<span class="target-time-badge">${target.text}</span>`;
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
    const periodChipEl = document.getElementById('period-chip-el');
    const instructionEl = document.getElementById('instruction');
    const placementTools = document.getElementById('placement-tools');
    const choicesContainer = document.getElementById('choices-container');

    this.updatePhaseStarsUI();

    if (periodChipEl) {
      if (this.currentLevel >= 5 && this.targetTime?.periodLabel) {
        periodChipEl.textContent = this.targetTime.periodLabel;
        periodChipEl.classList.remove('invisible-chip');
      } else {
        periodChipEl.classList.add('invisible-chip');
      }
    }

    if (this.currentPhase === 1) {
      placementTools?.classList.add('hidden');
      choicesContainer?.classList.remove('hidden');
      if (instructionEl) {
        instructionEl.innerHTML = `<span>Quelle heure est-il ?</span>`;
      }

      const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
      choiceBtns.forEach((btn, idx) => {
        if (this.currentChoices[idx]) btn.textContent = this.currentChoices[idx].text;
      });
    } else {
      placementTools?.classList.remove('hidden');
      choicesContainer?.classList.add('hidden');
      if (instructionEl) {
        instructionEl.innerHTML = `<span>Place les aiguilles sur</span> ${this.formatNeutralTargetHTML(this.targetTime)}`;
      }
    }
  }

  private get radius(): number {
    return Math.min(this.canvas.width / 2, this.canvas.height / 2) - 14;
  }

  public render(): void {
    const isDay = this.currentLevel < 5 ? true : (this.targetTime ? this.targetTime.isDay : true);
    const is24HourTarget = this.targetTime ? TimeMath.is24HourRingTarget(this.targetTime.hours) : false;

    this.clock.draw(this.currentLevel, isDay, is24HourTarget);

    const ghostTarget =
      this.currentPhase === 2 && this.showGhostGuide && this.targetTime
        ? { hours: this.targetTime.hours, minutes: this.targetTime.minutes }
        : undefined;

    this.hands.draw(
      this.currentHours,
      this.currentMinutes,
      this.currentLevel,
      this.currentPhase === 2 && this.isDragging ? this.activeHand : undefined,
      ghostTarget
    );
  }
}
