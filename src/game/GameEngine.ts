import { Clock } from './Clock';
import { Hands } from './Hands';
import { QuestionManager } from './QuestionManager';
import type { TimeTarget } from './QuestionManager';
import { SaveManager } from './SaveManager';
import type { GameSave } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { TimeMath } from './TimeMath';
import { TutorialOverlay } from './TutorialOverlay';
import { WatchMechanism } from './WatchMechanism';
import type { WorkshopZoom } from './WatchMechanism';

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

const ZOOM_LABELS: Record<Exclude<WorkshopZoom, 'overview'>, string> = {
  spring: '⚙️ Ressort',
  hours: '🟠 Heures',
  minutes: '🔵 Minutes'
};

const THREE_ZOOM_BUTTONS: Array<Exclude<WorkshopZoom, 'overview'>> = [
  'spring',
  'hours',
  'minutes'
];

const LEVEL_TITLES: Record<number, string> = {
  1: '1 · Les Heures (12h)',
  2: '2 · Les 24 Heures',
  3: '3 · Les Minutes',
  4: '4 · Les Demi-Heures',
  5: '5 · Les Quarts d’Heure',
  6: '6 · À la Minute près',
  7: '7 · Défi Jour & Nuit',
  8: '8 · L’Horloge des Grands'
};

const AVATAR_COLORS = [
  'linear-gradient(135deg, #f97316, #ea580c)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #0284c7, #0369a1)',
  'linear-gradient(135deg, #10b981, #047857)',
  'linear-gradient(135deg, #e11d48, #be123c)'
];

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
  private autoNextTimerId: number = 0;
  private celebrationAnimId: number = 0;
  private isTutorialActive: boolean = false;
  private tutorialAnimId: number = 0;
  private tutorialStartTime: number = 0;
  private activeHand: 'hour' | 'minute' = 'hour';

  private editingProfileId: string | null = null;
  private confirmingDeleteId: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
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
        () => this.soundEngine.playWindingClick()
      );
    }

    this.initEvents();
    this.updateSoundButtonUI();
    this.updateMenuUI();
    this.applySkyTheme(true);
  }

  private clearPendingAnimations(): void {
    cancelAnimationFrame(this.celebrationAnimId);
    cancelAnimationFrame(this.workshopAnimId);
    cancelAnimationFrame(this.tutorialAnimId);
    clearTimeout(this.autoNextTimerId);
    this.isTutorialActive = false;
    this.isWinding = false;
    this.isWaitingNext = false;
  }

  public startLevel(level: number): void {
    this.clearPendingAnimations();
    this.currentLevel = level;
    this.currentPhase = 1;
    this.phaseSuccessCount = 0;
    this.levelTotalErrors = 0;
    this.questionManager.setLevel(level);
    this.questionManager.resetHistory();

    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('workshop-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    const headerPill = document.getElementById('level-header-pill');
    if (headerPill) {
      headerPill.className = `lvl-${level}`;
    }

    const titleDisplay = document.getElementById('level-title-display');
    if (titleDisplay) {
      titleDisplay.textContent = LEVEL_TITLES[level] || `Niveau ${level}`;
    }

    this.initNewQuestion();
    this.openTutorial();
  }

  private openTutorial(): void {
    cancelAnimationFrame(this.tutorialAnimId);
    clearTimeout(this.autoNextTimerId);
    this.isTutorialActive = true;
    this.tutorialStartTime = performance.now();

    const info = TutorialOverlay.getInfo(this.currentLevel);
    this.applySkyTheme(info.isDay);

    const periodChipEl = document.getElementById('period-chip-el');
    if (periodChipEl) {
      if (info.periodLabel) {
        periodChipEl.textContent = info.periodLabel;
        periodChipEl.classList.remove('invisible-chip');
      } else {
        periodChipEl.classList.add('invisible-chip');
      }
    }

    const instructionEl = document.getElementById('instruction');
    if (instructionEl) {
      instructionEl.classList.add('hidden');
    }

    const calloutRow = document.getElementById('tutorial-callout-row');
    const calloutPill = document.getElementById('tutorial-callout-pill');
    calloutRow?.classList.remove('hidden');

    document.getElementById('choices-container')?.classList.add('hidden');
    document.getElementById('placement-tools')?.classList.add('hidden');
    document.getElementById('tutorial-tools')?.classList.remove('hidden');

    const startBtn = document.getElementById('tutorial-start-btn');
    if (startBtn) {
      startBtn.textContent = "C'est parti ! ▶";
    }

    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    if (helpBox && helpText) {
      helpText.innerHTML = info.ruleHtml;
      helpBox.classList.remove(
        'invisible-feedback',
        'hidden',
        'feedback-success',
        'feedback-step2',
        'feedback-error'
      );
      helpBox.classList.add('feedback-tutorial');
    }

    const loop = (now: number) => {
      if (!this.isTutorialActive) return;
      const elapsed = now - this.tutorialStartTime;
      const dyn = TutorialOverlay.getDynamicFrameState(this.currentLevel, elapsed);
      const frameDay = dyn ? dyn.isDay : info.isDay;
      this.applySkyTheme(frameDay);
      if (dyn && periodChipEl) {
        periodChipEl.textContent = dyn.periodLabel;
      }

      if (calloutPill) {
        const callout = TutorialOverlay.getCallout(this.currentLevel, elapsed);
        calloutPill.textContent = callout.text;
        calloutPill.style.borderColor = callout.color;
      }

      this.clock.draw(this.currentLevel, frameDay);
      TutorialOverlay.draw(this.ctx, this.hands, this.radius, this.currentLevel, elapsed);
      this.tutorialAnimId = requestAnimationFrame(loop);
    };
    this.tutorialAnimId = requestAnimationFrame(loop);
  }

  private closeTutorial(): void {
    if (!this.isTutorialActive) return;
    cancelAnimationFrame(this.tutorialAnimId);
    this.isTutorialActive = false;
    document.getElementById('tutorial-tools')?.classList.add('hidden');
    document.getElementById('tutorial-callout-row')?.classList.add('hidden');
    const showDaySky = TimeMath.is24HourLevel(this.currentLevel) ? this.targetTime.isDay : true;
    this.applySkyTheme(showDaySky);
    this.hideHelp();
    this.updateUI();
    this.render();
  }

  private openWorkshop(): void {
    this.clearPendingAnimations();
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('workshop-screen')?.classList.remove('hidden');
    this.applySkyTheme(false);

    if (this.watchMechanism) {
      this.watchMechanism.setZoomMode('overview');
    }

    this.renderWorkshopUI();
    this.lastWorkshopTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - this.lastWorkshopTime);
      this.lastWorkshopTime = now;
      if (this.watchMechanism) {
        this.watchMechanism.update(dt, this.isWinding);
        this.watchMechanism.draw(this.isWinding);
      }
      this.workshopAnimId = requestAnimationFrame(loop);
    };
    this.workshopAnimId = requestAnimationFrame(loop);
  }

  private renderWorkshopUI(): void {
    const tray = document.getElementById('workshop-parts-tray');
    if (!tray || !this.watchMechanism) return;

    const activeZoom = this.watchMechanism.zoomMode;
    tray.innerHTML = '';

    THREE_ZOOM_BUTTONS.forEach(mode => {
      const isSelected = activeZoom === mode;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `workshop-part-btn${isSelected ? ' active-zoom-btn' : ''}`;
      btn.textContent = ZOOM_LABELS[mode];
      btn.addEventListener('click', () => {
        if (!this.watchMechanism) return;
        const nextMode: WorkshopZoom = this.watchMechanism.zoomMode === mode ? 'overview' : mode;
        this.watchMechanism.setZoomMode(nextMode);
        this.soundEngine.playSnap();
        this.renderWorkshopUI();
      });
      tray.appendChild(btn);
    });
  }

  private returnToMenu(): void {
    this.clearPendingAnimations();
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('workshop-screen')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.remove('hidden');
    this.applySkyTheme(true);
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
    clearTimeout(this.autoNextTimerId);
    this.targetTime = this.questionManager.generateQuestion();
    this.errorsCount = 0;
    this.currentQuestionAssisted = false;
    this.showGhostGuide = false;
    this.isWaitingNext = false;
    this.hideHelp();
    this.resetButtonsState();

    const showDaySky = TimeMath.is24HourLevel(this.currentLevel) ? this.targetTime.isDay : true;
    this.applySkyTheme(showDaySky);

    if (this.currentPhase === 1) {
      this.currentHours = this.targetTime.hours;
      this.currentMinutes = this.targetTime.minutes;
      this.currentChoices = this.questionManager.generateChoices(this.targetTime);
    } else if (this.currentLevel <= 2) {
      const targetH12 = this.targetTime.hours % 12 || 12;
      this.currentHours = targetH12 === 9 ? 6 : 9;
      this.currentMinutes = 0;
      this.activeHand = 'hour';
    } else if (this.currentLevel === 3) {
      this.currentHours = 12;
      this.currentMinutes = this.targetTime.minutes === 0 ? 30 : 0;
      this.activeHand = 'minute';
    } else {
      const targetH12 = this.targetTime.hours % 12 || 12;
      this.currentHours = targetH12 === 9 ? 6 : 9;
      this.currentMinutes = this.targetTime.minutes === 0 ? 30 : 0;
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

    const stopWinding = () => {
      this.isWinding = false;
    };
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
          return;
        }

        if (this.watchMechanism.zoomMode !== 'overview') {
          e.preventDefault();
          this.watchMechanism.setZoomMode('overview');
          this.soundEngine.playSnap();
          this.renderWorkshopUI();
        }
      };
      this.workshopCanvas.addEventListener('mousedown', onWorkshopPointerDown);
      this.workshopCanvas.addEventListener('touchstart', onWorkshopPointerDown, { passive: false });
    }

    document.getElementById('back-menu-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.returnToMenu();
    });

    document.getElementById('tutorial-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      if (this.isTutorialActive) {
        this.closeTutorial();
      } else {
        this.openTutorial();
      }
    });

    document.getElementById('tutorial-start-btn')?.addEventListener('click', () => {
      this.soundEngine.playSuccess();
      this.closeTutorial();
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
        // Poursuit le rechargement forcé
      }
      const url = new URL(window.location.href);
      url.searchParams.set('t', String(Date.now()));
      window.location.replace(url.toString());
    });

    document.getElementById('profile-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.openProfileModal();
    });

    const closeProfileModal = () => {
      this.editingProfileId = null;
      this.confirmingDeleteId = null;
      this.soundEngine.playSnap();
      document.getElementById('profile-modal')?.classList.add('hidden');
    };

    document.getElementById('profile-close-top-btn')?.addEventListener('click', closeProfileModal);
    document.getElementById('profile-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeProfileModal();
      }
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
      this.editingProfileId = null;
      this.confirmingDeleteId = null;
      this.soundEngine.playSuccess();
      this.renderProfilesList();
      this.updateMenuUI();
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
      if (this.isTutorialActive || this.currentPhase === 1 || this.isWaitingNext) return;
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
    this.editingProfileId = null;
    this.confirmingDeleteId = null;
    this.renderProfilesList();
    document.getElementById('profile-modal')?.classList.remove('hidden');
  }

  private renderProfilesList(): void {
    const listEl = document.getElementById('profiles-list');
    if (!listEl) return;
    const profiles = SaveManager.getProfiles();
    const active = SaveManager.getActiveProfile();

    listEl.innerHTML = '';
    profiles.forEach((profile, index) => {
      const isActive = profile.id === active.id;
      const stars = SaveManager.getTotalStars(profile.save);
      const displayName = profile.name === 'Test' ? 'Menu' : profile.name;
      const initial = (displayName.trim()[0] || 'J').toUpperCase();
      const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length];

      const row = document.createElement('div');
      row.className = `profile-item${isActive ? ' active-profile' : ''}`;

      if (this.editingProfileId === profile.id) {
        const editForm = document.createElement('form');
        editForm.className = 'profile-rename-form';

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 16;
        input.value = displayName;
        input.className = 'profile-rename-input';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'profile-action-btn save-rename-btn';
        saveBtn.textContent = '✓';
        saveBtn.title = 'Valider le prénom';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'profile-action-btn';
        cancelBtn.textContent = '✕';
        cancelBtn.title = 'Annuler';
        cancelBtn.addEventListener('click', () => {
          this.editingProfileId = null;
          this.renderProfilesList();
        });

        editForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const newName = input.value.trim();
          if (newName) {
            SaveManager.renameProfile(profile.id, newName);
            this.soundEngine.playSuccess();
          }
          this.editingProfileId = null;
          this.renderProfilesList();
          this.updateMenuUI();
        });

        editForm.appendChild(input);
        editForm.appendChild(saveBtn);
        editForm.appendChild(cancelBtn);
        row.appendChild(editForm);
        listEl.appendChild(row);
        setTimeout(() => input.focus(), 10);
        return;
      }

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'profile-select-btn';
      selectBtn.innerHTML = `
        <div class="prof-name-line">
          <span class="prof-avatar" style="background: ${avatarBg}">${initial}</span>
          <span class="prof-name">${displayName}</span>
        </div>
        <span class="prof-stars"><span class="prof-star-icon">★</span> ${stars} / ${SaveManager.MAX_STARS}</span>
      `;
      selectBtn.addEventListener('click', () => {
        this.saveData = SaveManager.switchProfile(profile.id);
        this.soundEngine.setMuted(this.saveData.muted);
        this.soundEngine.playSnap();
        this.confirmingDeleteId = null;
        this.renderProfilesList();
        this.updateSoundButtonUI();
        this.updateMenuUI();
      });

      row.appendChild(selectBtn);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'profile-action-btn';
      editBtn.title = `Renommer ${displayName}`;
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      `;
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmingDeleteId = null;
        this.editingProfileId = profile.id;
        this.soundEngine.playSnap();
        this.renderProfilesList();
      });
      row.appendChild(editBtn);

      if (profiles.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        const isConfirming = this.confirmingDeleteId === profile.id;
        delBtn.className = `profile-del-btn${isConfirming ? ' confirm-del' : ''}`;
        delBtn.title = isConfirming ? `Confirmer la suppression` : `Supprimer ${displayName}`;
        delBtn.innerHTML = isConfirming
          ? 'Oui ?'
          : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <polyline points="3 6 5 6 21 6"></polyline>
               <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
             </svg>`;
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.confirmingDeleteId !== profile.id) {
            this.confirmingDeleteId = profile.id;
            this.soundEngine.playSnap();
            this.renderProfilesList();
            return;
          }
          this.confirmingDeleteId = null;
          const updatedActive = SaveManager.deleteProfile(profile.id);
          this.saveData = updatedActive.save;
          this.soundEngine.playSnap();
          this.renderProfilesList();
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

  private updateMenuUI(): void {
    const levelRects = document.querySelectorAll('.level-rect');
    const maxUnlocked = this.saveData.maxUnlockedLevel || 1;
    const activeProfile = SaveManager.getActiveProfile();

    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      const displayName = activeProfile.name === 'Test' ? 'Menu' : activeProfile.name;
      profileBtn.setAttribute('title', `Joueur actif : ${displayName}`);
    }

    const totalStars = SaveManager.getTotalStars(this.saveData);
    const rankTitle = SaveManager.getRankTitle(totalStars);
    const rankEl = document.getElementById('player-rank-title');
    const starsCountEl = document.getElementById('player-stars-count');
    if (rankEl) rankEl.textContent = rankTitle;
    if (starsCountEl) starsCountEl.textContent = `★ ${totalStars} / ${SaveManager.MAX_STARS}`;

    levelRects.forEach(rect => {
      const level = parseInt(rect.getAttribute('data-level') || '1', 10);
      const statusEl = rect.querySelector('.lvl-status');
      const starsEarned = this.saveData.levelStars[level] || 0;

      if (level <= maxUnlocked) {
        rect.classList.remove('locked');
        if (statusEl) {
          if (starsEarned > 0) {
            const starsHtml = [1, 2, 3]
              .map(s => (s <= starsEarned ? '<span class="lvl-star-on">★</span>' : '<span class="lvl-star-off">★</span>'))
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
        workshopStatus.textContent = '🔍';
        workshopStatus.className = 'lvl-status play';
      } else {
        workshopBtn.classList.add('locked');
        workshopStatus.textContent = '🔒';
        workshopStatus.className = 'lvl-status locked-icon';
      }
    }
  }

  private showFeedback(
    html: string,
    type: 'success' | 'step2' | 'error',
    nextCallback?: () => void
  ): void {
    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    const instructionEl = document.getElementById('instruction');
    document.getElementById('tutorial-callout-row')?.classList.add('hidden');
    if (!helpBox || !helpText) return;

    if (type === 'success' || type === 'step2') {
      instructionEl?.classList.add('hidden');
    } else {
      instructionEl?.classList.remove('hidden');
    }

    helpText.innerHTML = html;
    helpBox.classList.remove(
      'invisible-feedback',
      'hidden',
      'feedback-success',
      'feedback-step2',
      'feedback-error',
      'feedback-tutorial'
    );
    helpBox.classList.add(
      type === 'step2'
        ? 'feedback-step2'
        : type === 'success'
          ? 'feedback-success'
          : 'feedback-error'
    );

    if (nextCallback) {
      this.isWaitingNext = true;
      clearTimeout(this.autoNextTimerId);
      this.autoNextTimerId = window.setTimeout(() => {
        if (!this.isWaitingNext) return;
        this.isWaitingNext = false;
        nextCallback();
      }, 3000);
    }
  }

  private hideHelp(): void {
    const helpBox = document.getElementById('help-box');
    const instructionEl = document.getElementById('instruction');
    instructionEl?.classList.remove('hidden');
    if (!helpBox) return;
    helpBox.classList.add('invisible-feedback');
    helpBox.classList.remove(
      'feedback-success',
      'feedback-step2',
      'feedback-error',
      'feedback-tutorial'
    );
  }

  private formatGoldStarsHTML(earnedStars: number): string {
    return [1, 2, 3]
      .map(i =>
        i <= earnedStars
          ? '<span class="inline-star-gold">★</span>'
          : '<span class="inline-star-empty">★</span>'
      )
      .join('');
  }

  private handleSuccessfulAnswer(): void {
    this.triggerSuccessEffect();

    if (this.currentQuestionAssisted) {
      this.soundEngine.playSuccess();
      this.showFeedback(
        `👍 <strong>Bien vu !</strong> Réussis la suivante du premier coup pour gagner ton étoile <span class="inline-star-gold">★</span>`,
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
        const step2Text =
          this.currentLevel <= 2
            ? '🎉 <strong>Bravo !</strong> Étape 2 : à toi de placer la petite aiguille orange !'
            : this.currentLevel === 3
              ? '🎉 <strong>Bravo !</strong> Étape 2 : à toi de placer la grande aiguille bleue !'
              : '🎉 <strong>Bravo !</strong> Étape 2 : à toi de placer les aiguilles avec ton doigt !';

        this.showFeedback(
          step2Text,
          'step2',
          () => {
            this.currentPhase = 2;
            this.phaseSuccessCount = 0;
            this.initNewQuestion();
            this.updateUI();
            this.render();
          }
        );
        return;
      } else {
        this.soundEngine.playLevelComplete();
        const earnedStars = SaveManager.computeStarsForErrors(this.levelTotalErrors);
        SaveManager.applyLevelRewards(this.saveData, this.currentLevel, earnedStars);
        SaveManager.save(this.saveData);
        this.updateMenuUI();

        const starsHtml = this.formatGoldStarsHTML(earnedStars);
        this.playCelebrationAnimation(earnedStars);

        if (this.currentLevel === SaveManager.MAX_LEVEL) {
          this.showFeedback(
            `👑 <strong>Niveau 8 validé (${starsHtml}) !</strong> L’Atelier de l’Horloger est débloqué !`,
            'success',
            () => {
              this.openWorkshop();
            }
          );
          return;
        }

        const nextLvl = this.currentLevel + 1;
        const msg =
          earnedStars === 3
            ? `🏆 <strong>Niveau ${this.currentLevel} parfait (${starsHtml}) !</strong> Passage au Niveau ${nextLvl}...`
            : `🏆 <strong>Niveau ${this.currentLevel} validé (${starsHtml}) !</strong> Passage au Niveau ${nextLvl}...`;

        this.showFeedback(
          msg,
          'success',
          () => {
            this.startLevel(nextLvl);
          }
        );
        return;
      }
    }

    this.soundEngine.playSuccess();
    const spokenSuffix = this.targetTime.spokenText ? ` (<em>${this.targetTime.spokenText}</em>)` : '';
    const successMsg =
      this.currentLevel === 3
        ? `✨ <strong>Bravo ! L’aiguille indique bien ${this.targetTime.text} !</strong>`
        : `✨ <strong>Bravo ! Il est bien ${this.targetTime.text}${spokenSuffix} !</strong>`;

    this.showFeedback(
      successMsg,
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

  private handleFailedReadAttempt(selectedChoice: TimeTarget, clickedBtn: HTMLElement | null): void {
    this.errorsCount++;
    this.levelTotalErrors++;

    if (this.errorsCount >= 2) {
      this.currentQuestionAssisted = true;
    }

    if (clickedBtn) {
      clickedBtn.classList.add('choice-tried');
      clickedBtn.setAttribute('disabled', 'true');
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
    allBtns.forEach(btn => {
      btn.classList.remove('btn-correct', 'btn-wrong', 'choice-tried');
      btn.removeAttribute('disabled');
    });
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
    if (clickedBtn?.hasAttribute('disabled')) return;

    const isMinutesExact = selectedChoice.minutes === this.targetTime.minutes;
    const isHoursExact = TimeMath.is24HourLevel(this.currentLevel)
      ? selectedChoice.hours === this.targetTime.hours
      : (selectedChoice.hours % 12) === (this.targetTime.hours % 12);

    const isCorrect =
      this.currentLevel === 3
        ? isMinutesExact
        : this.currentLevel <= 2
          ? isHoursExact
          : isHoursExact && isMinutesExact;

    this.animateButtonFeedback(clickedBtn, isCorrect);

    if (isCorrect) this.handleSuccessfulAnswer();
    else this.handleFailedReadAttempt(selectedChoice, clickedBtn);
  }

  private formatNeutralTargetHTML(target: TimeTarget): string {
    return `<span class="target-time-badge">${target.text}</span>`;
  }

  private updatePhaseStarsUI(): void {
    const phaseBadge = document.getElementById('phase-badge');
    if (!phaseBadge) return;
    const totalEarned = (this.currentPhase === 1 ? 0 : 3) + this.phaseSuccessCount;
    const stars = [0, 1, 2, 3, 4, 5]
      .map(i => (i < totalEarned ? '<span class="star-on">★</span>' : '<span class="star-off">★</span>'))
      .join('');
    phaseBadge.innerHTML = stars;
  }

  private updateUI(): void {
    const periodChipEl = document.getElementById('period-chip-el');
    const instructionEl = document.getElementById('instruction');
    const placementTools = document.getElementById('placement-tools');
    const choicesContainer = document.getElementById('choices-container');
    document.getElementById('tutorial-tools')?.classList.add('hidden');
    document.getElementById('tutorial-callout-row')?.classList.add('hidden');
    instructionEl?.classList.remove('hidden');

    this.updatePhaseStarsUI();

    if (periodChipEl) {
      if (TimeMath.is24HourLevel(this.currentLevel) && this.targetTime?.periodLabel) {
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
        instructionEl.innerHTML =
          this.currentLevel === 3
            ? `<span>Combien de minutes indique l’aiguille ?</span>`
            : `<span>Quelle heure est-il ?</span>`;
      }

      const choiceBtns = document.querySelectorAll('#choices-container .choice-btn');
      choiceBtns.forEach((btn, idx) => {
        if (this.currentChoices[idx]) btn.textContent = this.currentChoices[idx].text;
      });
    } else {
      placementTools?.classList.remove('hidden');
      choicesContainer?.classList.add('hidden');
      if (instructionEl) {
        const verbLabel =
          this.currentLevel <= 2
            ? 'Place la petite aiguille sur'
            : this.currentLevel === 3
              ? 'Place la grande aiguille sur'
              : 'Place les aiguilles sur';
        instructionEl.innerHTML = `<span>${verbLabel}</span> ${this.formatNeutralTargetHTML(this.targetTime)}`;
      }
    }
  }

  private get radius(): number {
    return Math.min(this.canvas.width / 2, this.canvas.height / 2) - 14;
  }

  public render(): void {
    const isDay = TimeMath.is24HourLevel(this.currentLevel)
      ? (this.targetTime ? this.targetTime.isDay : true)
      : true;
    this.clock.draw(this.currentLevel, isDay);

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
