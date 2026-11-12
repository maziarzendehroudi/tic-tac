import { Hands } from './Hands';

export interface TutorialStepInfo {
  title: string;
  ruleHtml: string;
  periodLabel: string;
  isDay: boolean;
}

export interface TutorialCallout {
  text: string;
  color: string;
}

export interface Level2TimelineState {
  hours24: number;
  isDay: boolean;
  activeTour: 1 | 2;
  tourBlend: number;
  dwellFactor: number;
  periodLabel: string;
  calloutText: string;
  calloutColor: string;
}

export interface Level5TimelineState {
  minutes: number;
  dwellFactor: number;
  calloutText: string;
  calloutColor: string;
}

export class TutorialOverlay {
  /**
   * Niveau 2 — Cycle complet de 15 200 ms :
   * - [0 .. 2600[     : déplacement continu 0h -> 8h sans arrêt à 3h ("C’est la nuit")
   * - [2600 .. 3600[  : pause de 1s à 8h ("Le jour se lève")
   * - [3600 .. 5000[  : déplacement 8h -> 12h
   * - [5000 .. 6000[  : pause de 1s à 12h ("Repas de midi")
   * - [6000 .. 7400[  : déplacement 12h -> 16h
   * - [7400 .. 8400[  : pause de 1s à 16h ("Le goûter")
   * - [8400 .. 9800[  : déplacement 16h -> 20h
   * - [9800 .. 10800[ : pause de 1s à 20h ("Repas du soir")
   * - [10800 .. 12200[: déplacement 20h -> 24h (00h)
   * - [12200 .. 15200[: pause de 3s à minuit 00h ("Minuit : on change de jour")
   */
  public static readonly LEVEL2_CYCLE_MS = 15200;

  /**
   * Niveau 5 — Cycle complet de 9 600 ms (4 étapes × [1000 ms pause + 1400 ms déplacement]) :
   * - Pause de 1s à 00 ("Heure pile"), puis déplacement vers 15
   * - Pause de 1s à 15 ("Quart d’heure"), puis déplacement vers 30
   * - Pause de 1s à 30 ("Demi-heure"), puis déplacement vers 45
   * - Pause de 1s à 45 ("Trois quarts d’heure"), puis déplacement vers 00
   */
  public static readonly LEVEL5_STEP_PAUSE_MS = 1000;
  public static readonly LEVEL5_STEP_MOVE_MS = 1400;
  public static readonly LEVEL5_CYCLE_MS =
    4 * (TutorialOverlay.LEVEL5_STEP_PAUSE_MS + TutorialOverlay.LEVEL5_STEP_MOVE_MS);

  public static getInfo(level: number): TutorialStepInfo {
    switch (level) {
      case 1:
        return {
          title: 'Les 12 heures',
          ruleHtml:
            'La <strong>petite aiguille orange</strong> indique les heures : regarde le chiffre qu’elle pointe : il est <strong>3 heures</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 2:
        return {
          title: 'Les 24 heures',
          ruleHtml:
            'Chaque jour commence à minuit. Entre minuit et midi, on lit les <strong>chiffres noirs</strong>. Après midi, et jusqu’à minuit, on lit les <strong>chiffres orange</strong>.',
          periodLabel: '🌙 Nuit (matin)',
          isDay: false
        };
      case 3:
        return {
          title: 'Les minutes',
          ruleHtml:
            'La <strong>grande aiguille bleue</strong> indique les minutes (de 5 en 5) : lis les nombres bleus : <strong>20 minutes</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 4:
        return {
          title: 'Les demi-heures',
          ruleHtml:
            'En haut c’est <strong>l’heure pile</strong>, en bas c’est <strong>la demie</strong>. Regarde l’aiguille orange des heures qui montre qu’il est entre <strong>2h et 3h</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 5:
        return {
          title: 'Les quarts d’heure',
          ruleHtml:
            '<strong>0</strong> = heure pile · <strong>15</strong> = un quart d’heure · <strong>30</strong> = demie heure · <strong>45</strong> = trois quarts d’heure.',
          periodLabel: '',
          isDay: true
        };
      case 6:
        return {
          title: 'À la minute près',
          ruleHtml:
            'Pars du nombre bleu le plus proche (<strong>20</strong>), puis compte les petites graduations une par une (<strong>21, 22, 23</strong>) !',
          periodLabel: '',
          isDay: true
        };
      case 7:
        return {
          title: 'Le défi jour & nuit',
          ruleHtml:
            'Comme il fait jour, on sait qu’il est <strong>16h20</strong> (l’après-midi) et pas 4h20 du matin !',
          periodLabel: '🌤️ Après-midi',
          isDay: true
        };
      default:
        return {
          title: 'L’horloge des grands',
          ruleHtml:
            'Voici une horloge de grand : il faut <strong>deviner les chiffres</strong> : il est <strong>16h10</strong> !',
          periodLabel: '🌤️ Après-midi',
          isDay: true
        };
    }
  }

  public static getLevel2Timeline(elapsedMs: number): Level2TimelineState {
    const total = this.LEVEL2_CYCLE_MS;
    const t = ((elapsedMs % total) + total) % total;

    let h = 0;
    let dwellFactor = 0.55;
    let calloutText = 'C’est la nuit';
    let calloutColor = '#38bdf8';

    if (t < 2600) {
      // 0h -> 8h sans arrêt à 3h00
      h = this.easeInOutSine(t / 2600) * 8;
      dwellFactor = 0.65;
      calloutText = 'C’est la nuit';
      calloutColor = '#38bdf8';
    } else if (t < 3600) {
      // Pause de 1 seconde à 8h00
      h = 8;
      dwellFactor = 1;
      calloutText = 'Le jour se lève';
      calloutColor = '#0284c7';
    } else if (t < 5000) {
      // Déplacement 8h -> 12h
      h = 8 + this.easeInOutSine((t - 3600) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Le jour se lève';
      calloutColor = '#0284c7';
    } else if (t < 6000) {
      // Pause de 1 seconde à 12h00
      h = 12;
      dwellFactor = 1;
      calloutText = 'Repas de midi';
      calloutColor = '#0284c7';
    } else if (t < 7400) {
      // Déplacement 12h -> 16h
      h = 12 + this.easeInOutSine((t - 6000) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Repas de midi';
      calloutColor = '#0284c7';
    } else if (t < 8400) {
      // Pause de 1 seconde à 16h00
      h = 16;
      dwellFactor = 1;
      calloutText = 'Le goûter';
      calloutColor = '#ea580c';
    } else if (t < 9800) {
      // Déplacement 16h -> 20h
      h = 16 + this.easeInOutSine((t - 8400) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Le goûter';
      calloutColor = '#ea580c';
    } else if (t < 10800) {
      // Pause de 1 seconde à 20h00
      h = 20;
      dwellFactor = 1;
      calloutText = 'Repas du soir';
      calloutColor = '#ea580c';
    } else if (t < 12200) {
      // Déplacement 20h -> 24h (00h)
      h = 20 + this.easeInOutSine((t - 10800) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Repas du soir';
      calloutColor = '#ea580c';
    } else {
      // Pause de 3 secondes à Minuit (00h00)
      h = 0;
      dwellFactor = 1;
      calloutText = 'Minuit : on change de jour';
      calloutColor = '#fbbf24';
    }

    // Fondu entre le 1er tour (0 = chiffres noirs) et le 2e tour (1 = chiffres orange)
    let tourBlend = 0;
    if (t >= 12200) {
      const pauseElapsed = t - 12200;
      tourBlend = pauseElapsed > 2400 ? 1 - (pauseElapsed - 2400) / 600 : 1;
    } else if (t >= 6000 && t < 6700) {
      tourBlend = this.smoothstep(6000, 6700, t);
    } else if (t >= 6700) {
      tourBlend = 1;
    }

    const activeTour: 1 | 2 = tourBlend >= 0.5 ? 2 : 1;
    const isDay = t < 12200 && h >= 6 && h < 18;

    let periodLabel = '🌙 Nuit (matin)';
    if (t >= 12200) {
      periodLabel = '🌙 Minuit';
    } else if (h >= 6 && h < 12) {
      periodLabel = '☀️ Matin';
    } else if (h >= 12 && h < 13) {
      periodLabel = '☀️ Midi';
    } else if (h >= 13 && h < 18) {
      periodLabel = '🌤️ Après-midi';
    } else if (h >= 18) {
      periodLabel = '🌙 Soir';
    }

    return {
      hours24: h % 24,
      isDay,
      activeTour,
      tourBlend,
      dwellFactor,
      periodLabel,
      calloutText,
      calloutColor
    };
  }

  /**
   * Niveau 5 — Pause de 1 seconde (1000 ms) sur 00, 15, 30 et 45 :
   * la pilule s'affiche au moment exact où l'aiguille s'arrête sur chaque quart d'heure.
   */
  public static getLevel5Timeline(elapsedMs: number): Level5TimelineState {
    const total = this.LEVEL5_CYCLE_MS;
    const cycleTime = ((elapsedMs % total) + total) % total;

    const stepDuration = this.LEVEL5_STEP_PAUSE_MS + this.LEVEL5_STEP_MOVE_MS; // 2400 ms
    const stepIndex = Math.min(3, Math.floor(cycleTime / stepDuration));
    const localTime = cycleTime - stepIndex * stepDuration;

    const steps: Array<{ targetMin: number; text: string; color: string }> = [
      { targetMin: 0, text: 'Heure pile', color: '#10b981' },
      { targetMin: 15, text: 'Quart d’heure', color: '#0284c7' },
      { targetMin: 30, text: 'Demi-heure', color: '#8b5cf6' },
      { targetMin: 45, text: 'Trois quarts d’heure', color: '#ea580c' }
    ];

    const current = steps[stepIndex];
    const isPaused = localTime < this.LEVEL5_STEP_PAUSE_MS;

    let minutes = current.targetMin;
    let dwellFactor = 1;

    if (!isPaused) {
      const moveProgress = this.easeInOutSine(
        (localTime - this.LEVEL5_STEP_PAUSE_MS) / this.LEVEL5_STEP_MOVE_MS
      );
      minutes = (current.targetMin + moveProgress * 15) % 60;
      dwellFactor = 0.45;
    }

    return {
      minutes,
      dwellFactor,
      calloutText: current.text,
      calloutColor: current.color
    };
  }

  public static getDynamicFrameState(
    level: number,
    elapsedMs: number
  ): { isDay: boolean; periodLabel: string; activeTour: 1 | 2; tourBlend: number } | null {
    if (level !== 2) return null;
    const state = this.getLevel2Timeline(elapsedMs);
    return {
      isDay: state.isDay,
      periodLabel: state.periodLabel,
      activeTour: state.activeTour,
      tourBlend: state.tourBlend
    };
  }

  public static getCallout(level: number, elapsedMs: number): TutorialCallout | null {
    if (level === 2) {
      const state = this.getLevel2Timeline(elapsedMs);
      return {
        text: state.calloutText,
        color: state.calloutColor
      };
    }
    if (level === 5) {
      const state = this.getLevel5Timeline(elapsedMs);
      return {
        text: state.calloutText,
        color: state.calloutColor
      };
    }
    return null;
  }

  public static draw(
    ctx: CanvasRenderingContext2D,
    hands: Hands,
    radius: number,
    level: number,
    elapsedMs: number
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(elapsedMs * 0.005);
    const cycle = (elapsedMs % 4200) / 4200;
    const smoothT =
      cycle < 0.42
        ? this.easeInOutSine(cycle / 0.42)
        : cycle < 0.78
          ? 1
          : 1 - this.easeInOutSine((cycle - 0.78) / 0.22);

    if (level === 1) {
      const h = 1 + smoothT * 2;
      hands.draw(h, 0, 1, 'hour');
      this.drawCurvedArrow(ctx, radius - 94, Math.PI / 6 + 0.06, Math.PI / 2 - 0.06, '#ea580c');
      this.drawTargetHalo(ctx, radius - 54, Math.PI / 2, 24 + pulse * 4, '#ea580c');
      return;
    }

    if (level === 2) {
      this.drawLevel2Continuous(ctx, hands, radius, elapsedMs, pulse);
      return;
    }

    if (level === 3) {
      const m = smoothT * 20;
      hands.draw(12, m, 3, 'minute');
      const endAngle = (20 * Math.PI) / 30;
      this.drawCurvedArrow(ctx, radius - 52, 0.1, endAngle - 0.08, '#0284c7');
      this.drawTargetHalo(ctx, radius - 25, endAngle, 20 + pulse * 4, '#0284c7');
      return;
    }

    if (level === 4) {
      const m = smoothT * 30;
      hands.draw(2, m, 4);
      const midHourAngle = (2.5 * Math.PI) / 6;
      this.drawTargetHalo(ctx, radius - 68, midHourAngle, 22 + pulse * 4, '#ea580c');
      this.drawTargetHalo(ctx, radius - 25, Math.PI, 20 + pulse * 4, '#0284c7');
      return;
    }

    if (level === 5) {
      this.drawLevel5Continuous(ctx, hands, radius, elapsedMs, pulse);
      return;
    }

    if (level === 6) {
      const m = 20 + smoothT * 3;
      hands.draw(8, m, 6);
      const a20 = (20 * Math.PI) / 30;
      const a23 = (23 * Math.PI) / 30;
      this.drawTargetHalo(ctx, radius - 25, a20, 18, '#0284c7');
      this.drawCurvedArrow(ctx, radius - 10, a20, a23, '#10b981');
      this.drawTargetHalo(ctx, radius - 10, a23, 14 + pulse * 3, '#10b981');
      return;
    }

    if (level === 7) {
      const m = smoothT * 20;
      hands.draw(16, m, 7);
      const endMinAngle = (20 * Math.PI) / 30;
      this.drawTargetHalo(ctx, radius - 108, (4 * Math.PI) / 6, 20 + pulse * 4, '#ea580c');
      this.drawTargetHalo(ctx, radius - 25, endMinAngle, 19 + pulse * 3, '#0284c7');
      return;
    }

    const h8 = 15 + smoothT;
    const m8 = smoothT * 10;
    hands.draw(h8, m8, 8);
  }

  private static drawLevel2Continuous(
    ctx: CanvasRenderingContext2D,
    hands: Hands,
    radius: number,
    elapsedMs: number,
    pulse: number
  ): void {
    const state = this.getLevel2Timeline(elapsedMs);
    const h = state.hours24;

    hands.draw(h, 0, 2, 'hour');
    const angleH = ((h % 12) * Math.PI) / 6;

    const orbitR = (radius - 54) * (1 - state.tourBlend) + (radius - 104) * state.tourBlend;
    const baseHaloR = 24 * (1 - state.tourBlend) + 20 * state.tourBlend;
    const haloColor = state.tourBlend < 0.5 ? '#0284c7' : '#ea580c';

    ctx.save();
    ctx.globalAlpha = 0.45 + 0.55 * state.dwellFactor;
    this.drawTargetHalo(ctx, orbitR, angleH, baseHaloR + pulse * 3.5, haloColor);
    ctx.restore();
  }

  private static drawLevel5Continuous(
    ctx: CanvasRenderingContext2D,
    hands: Hands,
    radius: number,
    elapsedMs: number,
    pulse: number
  ): void {
    const state = this.getLevel5Timeline(elapsedMs);
    const m = state.minutes;

    hands.draw(4, m, 5, 'minute');
    const minAngle = (m * Math.PI) / 30;

    ctx.save();
    ctx.globalAlpha = 0.45 + 0.55 * state.dwellFactor;
    this.drawTargetHalo(ctx, radius - 25, minAngle, 20 + pulse * 3.5, state.calloutColor);
    ctx.restore();
  }

  private static easeInOutSine(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return -(Math.cos(Math.PI * clamped) - 1) / 2;
  }

  private static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  private static drawTargetHalo(
    ctx: CanvasRenderingContext2D,
    orbitR: number,
    angle: number,
    haloR: number,
    color: string
  ): void {
    const x = orbitR * Math.sin(angle);
    const y = -orbitR * Math.cos(angle);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  }

  private static drawCurvedArrow(
    ctx: CanvasRenderingContext2D,
    r: number,
    startAngle: number,
    endAngle: number,
    color: string
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, startAngle - Math.PI / 2, endAngle - Math.PI / 2, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    const tipX = r * Math.sin(endAngle);
    const tipY = -r * Math.cos(endAngle);
    ctx.translate(tipX, tipY);
    ctx.rotate(endAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
}
