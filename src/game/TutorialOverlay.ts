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

export interface Level4TimelineState {
  minutes: number;
  dwellFactor: number;
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
  public static readonly LEVEL2_CYCLE_MS = 15200;

  /**
   * Niveau 4 — Cycle de 4 800 ms (2 étapes × [1000 ms pause + 1400 ms déplacement]) :
   * - Pause de 1s à 2:00 ("2 heures pile"), puis déplacement vers 2:30
   * - Pause de 1s à 2:30 ("deux heures et demi"), puis retour vers 2:00
   */
  public static readonly LEVEL4_STEP_PAUSE_MS = 1000;
  public static readonly LEVEL4_STEP_MOVE_MS = 1400;
  public static readonly LEVEL4_CYCLE_MS =
    2 * (TutorialOverlay.LEVEL4_STEP_PAUSE_MS + TutorialOverlay.LEVEL4_STEP_MOVE_MS);

  /**
   * Niveau 5 — Cycle de 9 600 ms (4 étapes × [1000 ms pause + 1400 ms déplacement]) :
   * - Pause de 1s à 4:00 ("4 heures pile")
   * - Pause de 1s à 4:15 ("4 heures et quart")
   * - Pause de 1s à 4:30 ("4 heures et demi")
   * - Pause de 1s à 4:45 ("5 heures moins le quart")
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
            'La <strong class="kw-orange">petite aiguille orange</strong> indique les heures : regarde le chiffre qu’elle pointe : il est <strong>3 heures</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 2:
        return {
          title: 'Les 24 heures',
          ruleHtml:
            'Chaque jour commence à minuit. Entre minuit et midi, on lit les <strong>chiffres noirs</strong>. Après midi et jusqu’à minuit, on lit les <strong class="kw-orange">chiffres orange</strong>.',
          periodLabel: '🌙 Nuit (matin)',
          isDay: false
        };
      case 3:
        return {
          title: 'Les minutes',
          ruleHtml:
            'La <strong class="kw-blue">grande aiguille bleue</strong> indique les minutes (de 5 en 5) : lis les nombres bleus : <strong>20 minutes</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 4:
        return {
          title: 'Les demi-heures',
          ruleHtml:
            'En haut c’est <strong>l’heure pile</strong>, en bas c’est <strong>la demie</strong>. L’<strong class="kw-orange">aiguille orange</strong> montre qu’il est entre <strong>2h et 3h</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 5:
        return {
          title: 'Les quarts d’heure',
          ruleHtml:
            'Le <strong>quart d’heure</strong> est la moitié d’une <strong>demi-heure</strong>.',
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
      h = this.easeInOutSine(t / 2600) * 8;
      dwellFactor = 0.65;
      calloutText = 'C’est la nuit';
      calloutColor = '#38bdf8';
    } else if (t < 3600) {
      h = 8;
      dwellFactor = 1;
      calloutText = 'Le jour se lève';
      calloutColor = '#0284c7';
    } else if (t < 5000) {
      h = 8 + this.easeInOutSine((t - 3600) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Le jour se lève';
      calloutColor = '#0284c7';
    } else if (t < 6000) {
      h = 12;
      dwellFactor = 1;
      calloutText = 'Repas de midi';
      calloutColor = '#0284c7';
    } else if (t < 7400) {
      h = 12 + this.easeInOutSine((t - 6000) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Repas de midi';
      calloutColor = '#0284c7';
    } else if (t < 8400) {
      h = 16;
      dwellFactor = 1;
      calloutText = 'Le goûter';
      calloutColor = '#ea580c';
    } else if (t < 9800) {
      h = 16 + this.easeInOutSine((t - 8400) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Le goûter';
      calloutColor = '#ea580c';
    } else if (t < 10800) {
      h = 20;
      dwellFactor = 1;
      calloutText = 'Repas du soir';
      calloutColor = '#ea580c';
    } else if (t < 12200) {
      h = 20 + this.easeInOutSine((t - 10800) / 1400) * 4;
      dwellFactor = 0.5;
      calloutText = 'Repas du soir';
      calloutColor = '#ea580c';
    } else {
      h = 0;
      dwellFactor = 1;
      calloutText = 'Minuit : on change de jour';
      calloutColor = '#fbbf24';
    }

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
   * Niveau 4 — Pause de 1 seconde sur 2:00 ("2 heures pile") et sur 2:30 ("deux heures et demi")
   */
  public static getLevel4Timeline(elapsedMs: number): Level4TimelineState {
    const total = this.LEVEL4_CYCLE_MS;
    const cycleTime = ((elapsedMs % total) + total) % total;

    const stepDuration = this.LEVEL4_STEP_PAUSE_MS + this.LEVEL4_STEP_MOVE_MS; // 2400 ms
    const stepIndex = Math.min(1, Math.floor(cycleTime / stepDuration));
    const localTime = cycleTime - stepIndex * stepDuration;

    const isPaused = localTime < this.LEVEL4_STEP_PAUSE_MS;

    if (stepIndex === 0) {
      let minutes = 0;
      let dwellFactor = 1;
      if (!isPaused) {
        const moveProgress = this.easeInOutSine(
          (localTime - this.LEVEL4_STEP_PAUSE_MS) / this.LEVEL4_STEP_MOVE_MS
        );
        minutes = moveProgress * 30;
        dwellFactor = 0.45;
      }
      return {
        minutes,
        dwellFactor,
        calloutText: '2 heures pile',
        calloutColor: '#10b981'
      };
    }

    let minutes = 30;
    let dwellFactor = 1;
    if (!isPaused) {
      const moveProgress = this.easeInOutSine(
        (localTime - this.LEVEL4_STEP_PAUSE_MS) / this.LEVEL4_STEP_MOVE_MS
      );
      minutes = 30 - moveProgress * 30;
      dwellFactor = 0.45;
    }
    return {
      minutes,
      dwellFactor,
      calloutText: 'deux heures et demi',
      calloutColor: '#0284c7'
    };
  }

  /**
   * Niveau 5 — Pause de 1 seconde sur 00, 15, 30 et 45 avec les pilules :
   * "4 heures pile", "4 heures et quart", "4 heures et demi", "5 heures moins le quart"
   */
  public static getLevel5Timeline(elapsedMs: number): Level5TimelineState {
    const total = this.LEVEL5_CYCLE_MS;
    const cycleTime = ((elapsedMs % total) + total) % total;

    const stepDuration = this.LEVEL5_STEP_PAUSE_MS + this.LEVEL5_STEP_MOVE_MS; // 2400 ms
    const stepIndex = Math.min(3, Math.floor(cycleTime / stepDuration));
    const localTime = cycleTime - stepIndex * stepDuration;

    const steps: Array<{ targetMin: number; text: string; color: string }> = [
      { targetMin: 0, text: '4 heures pile', color: '#10b981' },
      { targetMin: 15, text: '4 heures et quart', color: '#0284c7' },
      { targetMin: 30, text: '4 heures et demi', color: '#8b5cf6' },
      { targetMin: 45, text: '5 heures moins le quart', color: '#ea580c' }
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
    if (level === 4) {
      const state = this.getLevel4Timeline(elapsedMs);
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
    if (level === 6) {
      return {
        text: '8h23',
        color: '#10b981'
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
      const state4 = this.getLevel4Timeline(elapsedMs);
      const m = state4.minutes;
      hands.draw(2, m, 4);
      const hourAngle = ((2 + m / 60) * Math.PI) / 6;
      const minAngle = (m * Math.PI) / 30;
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.55 * state4.dwellFactor;
      this.drawTargetHalo(ctx, radius - 68, hourAngle, 22 + pulse * 3.5, '#ea580c');
      this.drawTargetHalo(ctx, radius - 25, minAngle, 20 + pulse * 3.5, state4.calloutColor);
      ctx.restore();
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
