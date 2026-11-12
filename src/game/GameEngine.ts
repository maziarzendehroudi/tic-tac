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
  shape: 'rect' | 'circle' | 'star';
}

export interface LevelTransitionSummary {
  learnedText: string;
  nextTitle: string;
  nextShortName: string;
  nextBadge: string;
  nextColorClass: string;
  isFinal: boolean;
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

export const WORKSHOP_EXPLANATIONS: Record<WorkshopZoom, string> = {
  overview: 'La montre est en marche ! Touche un bouton ci-dessous pour explorer les engrenages.',
  spring: '⚙️ Le ressort se déroule doucement et transmet son énergie à toute la montre.',
  hours: '🟠 La roue dorée tourne lentement pour entraîner la petite aiguille des heures.',
  minutes: '🔵 Les roues bleues accélèrent le mouvement pour faire tourner la grande aiguille des minutes.'
};

export const LEVEL_TITLES: Record<number, string> = {
  1: '1 · Les 12 heures',
  2: '2 · Les 24 heures',
  3: '3 · Les minutes',
  4: '4 · Les demi-heures',
  5: '5 · Les quarts d’heure',
  6: '6 · À la minute près',
  7: '7 · Le défi jour & nuit',
  8: '8 · L’horloge des grands'
};

export const LEVEL_SHORT_NAMES: Record<number, string> = {
  1: 'Les 12 heures',
  2: 'Les 24 heures',
  3: 'Les minutes',
  4: 'Les demi-heures',
  5: 'Les quarts d’heure',
  6: 'À la minute près',
  7: 'Le défi jour & nuit',
  8: 'L’horloge des grands'
};

export const LEVEL_RECAPS: Record<number, string> = {
  1: 'Tu sais lire les heures de 1 h à 12 h avec la petite aiguille orange !',
  2: 'Tu connais les 24 heures du jour et de la nuit (chiffres noirs et orange) !',
  3: 'Tu sais lire les minutes de 5 en 5 avec la grande aiguille bleue !',
  4: 'Tu sais lire l’heure pile et la demie avec les deux aiguilles !',
  5: 'Tu connais l’heure pile, le quart d’heure, la demie et les trois quarts d’heure !',
  6: 'Tu sais compter chaque petite graduation à la minute près !',
  7: 'Tu sais lire toutes les heures et les minutes, le jour comme la nuit !',
  8: 'Tu sais lire l’heure sur une horloge de grand en devinant les chiffres !'
};

const PLAY_ICON_SVG = `<svg class="btn-play-svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z"/></svg>`;

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
  private lastWorkshopHintText: string = '';

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

  private unlockedEditProfileId: string | null = null;
  private editingProfileId: string | null = null;
  private confirmingDeleteId: string | null = null;

  public static getStep1PromptForLevel(level: number): string {
    if (level <= 2) {
      return 'Observe la petite aiguille orange et choisis la bonne heure !';
    }
    if (level === 3) {
      return 'Observe la grande aiguille bleue et choisis les bonnes minutes !';
    }
    return 'Observe bien les aiguilles et choisis la bonne heure !';
  }

  public static getStep2PromptForLevel(level: number): string {
    if (level <= 2) {
      return 'Maintenant, à toi de bouger la petite aiguille orange !';
    }
    if (level === 3) {
      return 'Maintenant, à toi de bouger la grande aiguille bleue !';
    }
    return 'Maintenant, à toi de bouger les aiguilles !';
  }

  public static getWorkshopInstructionText(power: number, zoomMode: WorkshopZoom): string {
    if (power <= 0) {
      return 'Tourne la molette dorée à droite pour remonter la montre et voir le mécanisme !';
    }
    return WORKSHOP_EXPLANATIONS[zoomMode];
  }

  public static getLevelTransitionSummary(completedLevel: number): LevelTransitionSummary {
    const learnedText =
      LEVEL_RECAPS[completedLevel] || 'Tu maîtrises une nouvelle étape de l’horloge !';
    const isFinal = completedLevel >= SaveManager.MAX_LEVEL;
    const nextLvl = completedLevel + 1;
    const nextShortName = isFinal
      ? 'L’atelier de l’horloger'
      : LEVEL_SHORT_NAMES[nextLvl] || `Niveau ${nextLvl}`;
    const nextTitle = isFinal
      ? '⚙️ L’atelier de l’horloger'
      : `Niveau ${nextLvl} · ${nextShortName}`;
    return {
      learnedText,
      nextTitle,
      nextShortName,
      nextBadge: isFinal ? '⚙️' : String(nextLvl),
      nextColorClass: isFinal ? 'workshop-rect' : `lvl-${nextLvl}`,
      isFinal
    };
  }

  private static buildStarSvg(index: number, isEarned: boolean): string {
    const gradId = `starGrad_${index}`;
    if (!isEarned) {
      return `
        <svg class="trans-star-svg is-empty slot-${index}" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 7 L63 34 L93 38 L71 59 L76 89 L50 75 L24 89 L29 59 L7 38 L37 34 Z"
                fill="rgba(30, 41, 59, 0.65)" stroke="rgba(148, 163, 184, 0.45)" stroke-width="5" stroke-linejoin="round" stroke-dasharray="6 4" />
        </svg>
      `;
    }
    return `
      <svg class="trans-star-svg is-earned slot-${index}" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="55%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#d97706" />
          </linearGradient>
        </defs>
        <path d="M50 7 L63 34 L93 38 L71 59 L76 89 L50 75 L24 89 L29 59 L7 38 L37 34 Z"
              fill="url(#${gradId})" stroke="#ffffff" stroke-width="5.5" stroke-linejoin="round" />
        <ellipse cx="42" cy="30" rx="10" ry="5" transform="rotate(-22 42 30)" fill="rgba(255, 255, 255, 0.55)" />
      </svg>
    `;
  }

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

  private setSystemBarColor(hexColor: string): void {
    document.documentElement.style.backgroundColor = hexColor;
    document.body.style.backgroundColor = hexColor;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', hexColor);
    }
  }

  private clearPendingAnimations(): void {
    cancelAnimationFrame(this.celebrationAnimId);
    cancelAnimationFrame(this.workshopAnimId);
    cancelAnimationFrame(this.tutorialAnimId);
    clearTimeout(this.autoNextTimerId);
    this.isTutorialActive = false;
    this.isWinding = false;
    this.isWaitingNext = false;
    const transitionScreen = document.getElementById('transition-screen');
    if (transitionScreen) {
      transitionScreen.classList.add('hidden');
      transitionScreen.classList.remove('step1-theme', 'step2-theme', 'levelup-theme');
    }
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

    this.updatePhaseStarsUI();
    this.initNewQuestion();
    this.openTutorial();
  }

  private openTutorial(): void {
    cancelAnimationFrame(this.tutorialAnimId);
    cancelAnimationFrame(this.celebrationAnimId);
    clearTimeout(this.autoNextTimerId);
    this.isTutorialActive = true;
    this.tutorialStartTime = performance.now();

    this.updatePhaseStarsUI();

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
    const initialCallout = TutorialOverlay.getCallout(this.currentLevel, 0);
    if (initialCallout && calloutRow && calloutPill) {
      calloutRow.classList.remove('hidden');
      calloutPill.textContent = initialCallout.text;
      calloutPill.style.borderColor = initialCallout.color;
    } else {
      calloutRow?.classList.add('hidden');
    }

    document.getElementById('choices-container')?.classList.add('hidden');
    document.getElementById('placement-tools')?.classList.add('hidden');
    document.getElementById('tutorial-tools')?.classList.remove('hidden');

    const startBtn = document.getElementById('tutorial-start-btn');
    if (startBtn) {
      startBtn.innerHTML = `<span>C'est parti !</span>${PLAY_ICON_SVG}`;
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
        'feedback-levelup',
        'feedback-error',
        'compact-tutorial-text'
      );
      helpBox.classList.add('feedback-tutorial');
      if (this.currentLevel === 2 || this.currentLevel === 5) {
        helpBox.classList.add('compact-tutorial-text');
      }
    }

    let lastFrameDay = info.isDay;
    let lastPeriodLabel = info.periodLabel;
    let lastCalloutText = initialCallout ? initialCallout.text : '';

    const loop = (now: number) => {
      if (!this.isTutorialActive) return;
      const elapsed = now - this.tutorialStartTime;
      const dyn = TutorialOverlay.getDynamicFrameState(this.currentLevel, elapsed);
      const frameDay = dyn ? dyn.isDay : info.isDay;
      if (frameDay !== lastFrameDay) {
        lastFrameDay = frameDay;
        this.applySkyTheme(frameDay);
      }
      if (dyn && periodChipEl && dyn.periodLabel !== lastPeriodLabel) {
        lastPeriodLabel = dyn.periodLabel;
        periodChipEl.textContent = dyn.periodLabel;
      }

      const callout = TutorialOverlay.getCallout(this.currentLevel, elapsed);
      if (callout && calloutRow && calloutPill) {
        if (callout.text !== lastCalloutText) {
          lastCalloutText = callout.text;
          calloutRow.classList.remove('hidden');
          calloutPill.textContent = callout.text;
          calloutPill.style.borderColor = callout.color;
          calloutPill.classList.remove('pill-pop-transition');
          void calloutPill.offsetWidth;
          calloutPill.classList.add('pill-pop-transition');
        }
      } else if (lastCalloutText !== '') {
        lastCalloutText = '';
        calloutRow?.classList.add('hidden');
      }

      this.clock.draw(this.currentLevel, frameDay, dyn?.tourBlend);
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

    // Lance l'animation pleine page "Étape 1" (similaire à l'Étape 2) avant la première question
    this.playStep1FullPageAnimation(() => {
      const showDaySky = TimeMath.is24HourLevel(this.currentLevel) ? this.targetTime.isDay : true;
      this.applySkyTheme(showDaySky);
      this.hideHelp();
      this.updateUI();
      this.render();
    });
  }

  private updateWorkshopInstructionDOM(): void {
    if (!this.watchMechanism) return;
    const nextText = GameEngine.getWorkshopInstructionText(
      this.watchMechanism.power,
      this.watchMechanism.zoomMode
    );
    if (nextText !== this.lastWorkshopHintText) {
      this.lastWorkshopHintText = nextText;
      const el = document.getElementById('workshop-instruction');
      if (el) el.textContent = nextText;
    }
  }

  private openWorkshop(): void {
    this.clearPendingAnimations();
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('workshop-screen')?.classList.remove('hidden');
    this.applySkyTheme(false);

    if (this.watchMechanism) {
      this.watchMechanism.power = 0;
      this.watchMechanism.setZoomMode('overview');
    }

    this.lastWorkshopHintText = '';
    this.updateWorkshopInstructionDOM();
    this.renderWorkshopUI();

    this.lastWorkshopTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - this.lastWorkshopTime);
      this.lastWorkshopTime = now;
      if (this.watchMechanism) {
        this.watchMechanism.update(dt, this.isWinding);
        this.watchMechanism.draw(this.isWinding);
        this.updateWorkshopInstructionDOM();
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
        this.updateWorkshopInstructionDOM();
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

    this.setSystemBarColor(isDay ? '#38bdf8' : '#0b132b');
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
          this.updateWorkshopInstructionDOM();
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

    document.getElementById('tutorial-start-btn')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
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

    // Clic sur le nom du joueur sous le titre pour ouvrir la modale "Qui joue ?"
    document.getElementById('player-progress-bar')?.addEventListener('click', () => {
      this.soundEngine.playSnap();
      this.openProfileModal();
    });

    const closeProfileModal = () => {
      this.unlockedEditProfileId = null;
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
      this.unlockedEditProfileId = null;
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
    this.unlockedEditProfileId = null;
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
    profiles.forEach(profile => {
      const isActive = profile.id === active.id;
      const isEditUnlocked = this.unlockedEditProfileId === profile.id;
      const stars = SaveManager.getTotalStars(profile.save);
      const displayName = profile.name === 'Test' ? 'Joueur 1' : profile.name;

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
          this.unlockedEditProfileId = null;
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
        <span class="prof-name">${displayName}</span>
        <span class="prof-stars"><span class="prof-star-icon">★</span> ${stars} / ${SaveManager.MAX_STARS}</span>
      `;

      let pressTimer = 0;
      let longPressTriggered = false;

      const clearPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = 0;
        }
      };

      const startPress = () => {
        clearPress();
        longPressTriggered = false;
        pressTimer = window.setTimeout(() => {
          longPressTriggered = true;
          this.confirmingDeleteId = null;
          this.unlockedEditProfileId =
            this.unlockedEditProfileId === profile.id ? null : profile.id;
          this.soundEngine.playSnap();
          this.renderProfilesList();
        }, 500);
      };

      selectBtn.addEventListener('pointerdown', startPress);
      selectBtn.addEventListener('pointerup', clearPress);
      selectBtn.addEventListener('pointerleave', clearPress);
      selectBtn.addEventListener('pointercancel', clearPress);
      selectBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        clearPress();
        longPressTriggered = true;
        this.confirmingDeleteId = null;
        this.unlockedEditProfileId =
          this.unlockedEditProfileId === profile.id ? null : profile.id;
        this.soundEngine.playSnap();
        this.renderProfilesList();
      });

      selectBtn.addEventListener('click', () => {
        if (longPressTriggered) {
          longPressTriggered = false;
          return;
        }
        this.saveData = SaveManager.switchProfile(profile.id);
        this.soundEngine.setMuted(this.saveData.muted);
        this.soundEngine.playSnap();
        this.unlockedEditProfileId = null;
        this.confirmingDeleteId = null;
        this.renderProfilesList();
        this.updateSoundButtonUI();
        this.updateMenuUI();
      });

      row.appendChild(selectBtn);

      if (isEditUnlocked) {
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
            this.unlockedEditProfileId = null;
            const updatedActive = SaveManager.deleteProfile(profile.id);
            this.saveData = updatedActive.save;
            this.soundEngine.playSnap();
            this.renderProfilesList();
            this.updateMenuUI();
          });
          row.appendChild(delBtn);
        }
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
    const displayName = activeProfile.name === 'Test' ? 'Joueur 1' : activeProfile.name;

    const progressBarBtn = document.getElementById('player-progress-bar');
    if (progressBarBtn) {
      progressBarBtn.setAttribute('title', `Joueur actif : ${displayName} (cliquer pour changer)`);
    }

    const activePlayerPill = document.getElementById('active-player-pill');
    if (activePlayerPill) {
      activePlayerPill.textContent = `👤 ${displayName} ▾`;
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
        workshopStatus.innerHTML = '<span class="lvl-star-on">✨ Ouvrir</span>';
        workshopStatus.className = 'lvl-status stars-badge workshop-open-badge';
      } else {
        workshopBtn.classList.add('locked');
        workshopStatus.textContent = '🔒';
        workshopStatus.className = 'lvl-status locked-icon';
      }
    }
  }

  private showFeedback(
    html: string,
    type: 'success' | 'step2' | 'levelup' | 'error',
    nextCallback?: () => void,
    delayMs: number = 3000
  ): void {
    const helpBox = document.getElementById('help-box');
    const helpText = document.getElementById('help-text');
    const instructionEl = document.getElementById('instruction');
    document.getElementById('tutorial-callout-row')?.classList.add('hidden');
    if (!helpBox || !helpText) return;

    if (type === 'success' || type === 'step2' || type === 'levelup') {
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
      'feedback-levelup',
      'feedback-error',
      'feedback-tutorial',
      'compact-tutorial-text'
    );
    helpBox.classList.add(
      type === 'step2'
        ? 'feedback-step2'
        : type === 'levelup'
          ? 'feedback-levelup'
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
      }, delayMs);
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
      'feedback-levelup',
      'feedback-error',
      'feedback-tutorial',
      'compact-tutorial-text'
    );
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
        this.playStep2FullPageAnimation(() => {
          this.currentPhase = 2;
          this.phaseSuccessCount = 0;
          this.initNewQuestion();
          this.updateUI();
          this.render();
        });
        return;
      } else {
        this.soundEngine.playLevelComplete();
        const earnedStars = SaveManager.computeStarsForErrors(this.levelTotalErrors);
        SaveManager.applyLevelRewards(this.saveData, this.currentLevel, earnedStars);
        SaveManager.save(this.saveData);
        this.updateMenuUI();

        const summary = GameEngine.getLevelTransitionSummary(this.currentLevel);
        const nextLvl = this.currentLevel + 1;

        this.playLevelUpFullPageAnimation(
          earnedStars,
          summary,
          () => {
            this.returnToMenu();
          },
          () => {
            if (summary.isFinal) {
              this.openWorkshop();
            } else {
              this.startLevel(nextLvl);
            }
          }
        );
        return;
      }
    }

    this.soundEngine.playSuccess();
    const spokenSuffix = this.targetTime.spokenText ? ` (<em>${this.targetTime.spokenText}</em>)` : '';
    const successMsg =
      this.currentLevel === 3
        ? `<strong>Bravo ! L’aiguille indique bien ${this.targetTime.text} !</strong>`
        : `<strong>Bravo ! Il est bien ${this.targetTime.text}${spokenSuffix} !</strong>`;

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

  /**
   * Animation pleine page partagée pour Étape 1 (Lecture) et Étape 2 (Manipulation)
   */
  private playPhaseIntroFullPageAnimation(
    stepNumber: 1 | 2,
    onComplete: () => void
  ): void {
    cancelAnimationFrame(this.celebrationAnimId);
    clearTimeout(this.autoNextTimerId);
    this.isWaitingNext = true;

    const screen = document.getElementById('transition-screen');
    const content = document.getElementById('transition-content');
    const bgCanvas = document.getElementById('transitionBgCanvas') as HTMLCanvasElement | null;
    if (!screen || !content || !bgCanvas) {
      onComplete();
      return;
    }

    screen.classList.remove('hidden', 'step1-theme', 'step2-theme', 'levelup-theme');
    screen.classList.add(stepNumber === 1 ? 'step1-theme' : 'step2-theme');
    this.setSystemBarColor(stepNumber === 1 ? '#0c4a6e' : '#2e1065');

    const levelBadgeTitle = LEVEL_SHORT_NAMES[this.currentLevel] || `Niveau ${this.currentLevel}`;
    const promptText =
      stepNumber === 1
        ? GameEngine.getStep1PromptForLevel(this.currentLevel)
        : GameEngine.getStep2PromptForLevel(this.currentLevel);
    const starsBadgeHtml = stepNumber === 1 ? '☆ ☆ ☆' : '★ ★ ★';
    const badgeClass = stepNumber === 1 ? 'trans-step1-badge' : 'trans-step2-badge';

    content.innerHTML = `
      <div class="trans-top-group">
        <div class="trans-level-reminder lvl-${this.currentLevel}">
          <span class="lvl-badge">${this.currentLevel}</span>
          <span class="trans-reminder-name">${levelBadgeTitle}</span>
          <span class="trans-reminder-stars">${starsBadgeHtml}</span>
        </div>
      </div>

      <div class="trans-step2-center-box">
        <div class="trans-step2-emblem" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="92" height="92">
            <circle cx="60" cy="60" r="52" fill="#ffffff" stroke="#0284c7" stroke-width="8" />
            <circle cx="60" cy="20" r="4" fill="#0284c7" />
            <circle cx="100" cy="60" r="4" fill="#ea580c" />
            <circle cx="60" cy="100" r="4" fill="#94a3b8" />
            <circle cx="20" cy="60" r="4" fill="#94a3b8" />
            <g class="emblem-hand-group">
              <line x1="60" y1="60" x2="60" y2="26" stroke="#0284c7" stroke-width="7" stroke-linecap="round" />
              <line x1="60" y1="60" x2="88" y2="60" stroke="#ea580c" stroke-width="8" stroke-linecap="round" />
            </g>
            <circle cx="60" cy="60" r="6" fill="#0f172a" stroke="#ffffff" stroke-width="2" />
          </svg>
        </div>
        <div class="${badgeClass}">Étape ${stepNumber}</div>
        <h2 class="trans-step2-main-msg">${promptText}</h2>
      </div>

      <div class="trans-action-wrap">
        <button id="phase-start-btn" type="button" class="trans-action-btn">
          <span>Commencer</span>
          ${PLAY_ICON_SVG}
        </button>
      </div>
    `;

    const startBtn = document.getElementById('phase-start-btn');
    startBtn?.addEventListener('click', () => {
      if (!this.isWaitingNext) return;
      this.isWaitingNext = false;
      cancelAnimationFrame(this.celebrationAnimId);
      this.soundEngine.playSuccess();
      screen.classList.add('hidden');
      screen.classList.remove('step1-theme', 'step2-theme');
      const showDaySky = TimeMath.is24HourLevel(this.currentLevel) ? this.targetTime.isDay : true;
      this.applySkyTheme(showDaySky);
      onComplete();
    });

    const bgCtx = bgCanvas.getContext('2d')!;
    const sparkles = Array.from({ length: 28 }, (_, i) => ({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      r: 2 + (i % 4) * 1.5,
      vy: -0.4 - Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2
    }));

    const startTime = performance.now();

    const animate = (now: number) => {
      if (!this.isWaitingNext) return;
      const elapsed = now - startTime;

      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.save();
      bgCtx.translate(bgCanvas.width / 2, bgCanvas.height * 0.48);
      bgCtx.rotate(elapsed * 0.00025);
      for (let i = 0; i < 12; i++) {
        bgCtx.save();
        bgCtx.rotate((i * Math.PI) / 6);
        bgCtx.beginPath();
        bgCtx.moveTo(0, 0);
        bgCtx.lineTo(-42, -620);
        bgCtx.lineTo(42, -620);
        bgCtx.closePath();
        bgCtx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        bgCtx.fill();
        bgCtx.restore();
      }
      bgCtx.restore();

      sparkles.forEach(s => {
        s.y += s.vy;
        if (s.y < -10) s.y = bgCanvas.height + 10;
        const alpha = 0.35 + 0.55 * Math.sin(elapsed * 0.004 + s.phase);
        bgCtx.beginPath();
        bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
        bgCtx.fill();
      });

      this.celebrationAnimId = requestAnimationFrame(animate);
    };

    this.celebrationAnimId = requestAnimationFrame(animate);
  }

  private playStep1FullPageAnimation(onComplete: () => void): void {
    this.playPhaseIntroFullPageAnimation(1, onComplete);
  }

  private playStep2FullPageAnimation(onComplete: () => void): void {
    this.playPhaseIntroFullPageAnimation(2, onComplete);
  }

  /**
   * PLEINE PAGE FIN DE NIVEAU : 3 vraies étoiles SVG, carte cliquable du niveau suivant & bouton "Continuer"
   */
  private playLevelUpFullPageAnimation(
    earnedStars: 1 | 2 | 3,
    summary: LevelTransitionSummary,
    onReturnMenu: () => void,
    onLaunchNext: () => void
  ): void {
    cancelAnimationFrame(this.celebrationAnimId);
    clearTimeout(this.autoNextTimerId);
    this.isWaitingNext = true;

    const screen = document.getElementById('transition-screen');
    const content = document.getElementById('transition-content');
    const bgCanvas = document.getElementById('transitionBgCanvas') as HTMLCanvasElement | null;
    if (!screen || !content || !bgCanvas) {
      onReturnMenu();
      return;
    }

    screen.classList.remove('hidden', 'step1-theme', 'step2-theme');
    screen.classList.add('levelup-theme');
    this.setSystemBarColor('#090d16');

    const completedName = LEVEL_SHORT_NAMES[this.currentLevel] || `Niveau ${this.currentLevel}`;
    const bannerTitle =
      earnedStars === 3
        ? `Niveau ${this.currentLevel} parfait !`
        : `Niveau ${this.currentLevel} validé !`;

    content.innerHTML = `
      <div class="trans-top-group">
        <div class="trans-pill-badge gold-badge">🏆 ${completedName}</div>
        <h2 class="trans-hero-title">${bannerTitle}</h2>
      </div>

      <div class="trans-stars-showcase">
        ${GameEngine.buildStarSvg(1, earnedStars >= 1)}
        ${GameEngine.buildStarSvg(2, earnedStars >= 2)}
        ${GameEngine.buildStarSvg(3, earnedStars >= 3)}
      </div>

      <div class="trans-learned-card">
        <div class="trans-learned-header">🎓 Ce que tu as appris</div>
        <p class="trans-learned-body">${summary.learnedText}</p>
      </div>

      <button id="levelup-next-card-btn" type="button" class="trans-next-level-card ${summary.nextColorClass}">
        <span class="trans-next-overline">${summary.isFinal ? '🔓 Récompense finale débloquée' : '🔓 Niveau suivant débloqué'}</span>
        <div class="trans-next-main-row">
          <span class="lvl-badge">${summary.nextBadge}</span>
          <span class="trans-next-name">${summary.nextShortName}</span>
          <span class="trans-next-go">
            ${PLAY_ICON_SVG}
          </span>
        </div>
      </button>

      <div class="trans-action-wrap">
        <button id="levelup-continue-btn" type="button" class="trans-action-btn">
          <span>Continuer</span>
          ${PLAY_ICON_SVG}
        </button>
      </div>
    `;

    const closeTransition = () => {
      this.isWaitingNext = false;
      cancelAnimationFrame(this.celebrationAnimId);
      screen.classList.add('hidden');
      screen.classList.remove('levelup-theme');
    };

    document.getElementById('levelup-next-card-btn')?.addEventListener('click', () => {
      if (!this.isWaitingNext) return;
      closeTransition();
      this.soundEngine.playSnap();
      onLaunchNext();
    });

    document.getElementById('levelup-continue-btn')?.addEventListener('click', () => {
      if (!this.isWaitingNext) return;
      closeTransition();
      this.soundEngine.playSnap();
      onReturnMenu();
    });

    const bgCtx = bgCanvas.getContext('2d')!;
    const colors = ['#fde047', '#38bdf8', '#34d399', '#fb7185', '#c084fc', '#fb923c'];
    const shapes: Array<'rect' | 'circle' | 'star'> = ['rect', 'circle', 'star'];

    const particles: CelebrationParticle[] = Array.from({ length: 68 }, (_, i) => ({
      x: Math.random() * bgCanvas.width,
      y: -Math.random() * bgCanvas.height,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 1.8 + Math.random() * 3.2,
      size: 7 + Math.random() * 8,
      color: colors[i % colors.length],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.14,
      shape: shapes[i % shapes.length]
    }));

    const startTime = performance.now();

    const animate = (now: number) => {
      if (!this.isWaitingNext) return;
      const elapsed = now - startTime;

      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

      bgCtx.save();
      bgCtx.translate(bgCanvas.width / 2, bgCanvas.height * 0.27);
      bgCtx.rotate(elapsed * 0.00035);
      for (let i = 0; i < 16; i++) {
        bgCtx.save();
        bgCtx.rotate((i * Math.PI) / 8);
        bgCtx.beginPath();
        bgCtx.moveTo(0, 0);
        bgCtx.lineTo(-28, -520);
        bgCtx.lineTo(28, -520);
        bgCtx.closePath();
        bgCtx.fillStyle = 'rgba(253, 224, 71, 0.07)';
        bgCtx.fill();
        bgCtx.restore();
      }
      bgCtx.restore();

      particles.forEach(p => {
        p.x += p.vx + Math.sin(elapsed * 0.003 + p.size) * 0.4;
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.y > bgCanvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * bgCanvas.width;
        }

        bgCtx.save();
        bgCtx.translate(p.x, p.y);
        bgCtx.rotate(p.rotation);
        bgCtx.fillStyle = p.color;

        if (p.shape === 'circle') {
          bgCtx.beginPath();
          bgCtx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          bgCtx.fill();
        } else if (p.shape === 'star') {
          bgCtx.font = `${Math.round(p.size * 1.4)}px sans-serif`;
          bgCtx.textAlign = 'center';
          bgCtx.textBaseline = 'middle';
          bgCtx.fillText('★', 0, 0);
        } else {
          bgCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        bgCtx.restore();
      });

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

    this.showFeedback(diagnosticHint, 'error');
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
        'Aide-toi du modèle en pointillés sur l’horloge, puis clique sur <strong>✓ Vérifier</strong> !',
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
      this.showFeedback(placeHint, 'error');
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
    const step1Html = [0, 1, 2]
      .map(i => (i < totalEarned ? '<span class="star-on">★</span>' : '<span class="star-off">★</span>'))
      .join('');
    const step2Html = [3, 4, 5]
      .map(i => (i < totalEarned ? '<span class="star-on">★</span>' : '<span class="star-off">★</span>'))
      .join('');
    phaseBadge.innerHTML = `${step1Html}<span class="phase-sep">·</span>${step2Html}`;
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
