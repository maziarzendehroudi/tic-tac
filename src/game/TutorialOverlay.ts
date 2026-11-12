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

export class TutorialOverlay {
  /**
   * Niveau 2 :
   * - 12 000 ms de rotation fluide et continue sur 24h (sans aucun arrêt intermédiaire)
   * - 3 000 ms d'arrêt à minuit (00h) avant de recommencer le cycle
   */
  public static readonly LEVEL2_MOVE_MS = 12000;
  public static readonly LEVEL2_MIDNIGHT_PAUSE_MS = 3000;
  public static readonly LEVEL2_CYCLE_MS =
    TutorialOverlay.LEVEL2_MOVE_MS + TutorialOverlay.LEVEL2_MIDNIGHT_PAUSE_MS;

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

  /**
   * Calcule la progression continue du Niveau 2 :
   * - Rotation fluide sans arrêt de 0h à 24h pendant 12 secondes :
   *   1. [0h .. 6h[     : "C'est la nuit" (passe par 3h00 sans s'arrêter)
   *   2. [6h .. 11h[    : "Le jour se lève" (vers 8h00)
   *   3. [11h .. 14h30[ : "Repas de midi" (autour de 12h00)
   *   4. [14h30 .. 18h30[: "Le goûter" (autour de 16h00)
   *   5. [18h30 .. 23h[ : "Repas du soir" (vers 20h00)
   *   6. [23h .. 24h] + pause de 3 secondes à 00h : "Minuit : on change de jour"
   */
  public static getLevel2Timeline(elapsedMs: number): Level2TimelineState {
    const total = this.LEVEL2_CYCLE_MS;
    const cycleTime = ((elapsedMs % total) + total) % total;

    const isMidnightPause = cycleTime >= this.LEVEL2_MOVE_MS;
    const h = isMidnightPause ? 0 : (cycleTime / this.LEVEL2_MOVE_MS) * 24;

    let tourBlend = 0;
    if (isMidnightPause) {
      const pauseElapsed = cycleTime - this.LEVEL2_MOVE_MS;
      tourBlend =
        pauseElapsed > this.LEVEL2_MIDNIGHT_PAUSE_MS - 600
          ? 1 - (pauseElapsed - (this.LEVEL2_MIDNIGHT_PAUSE_MS - 600)) / 600
          : 1;
    } else if (h >= 11.4 && h <= 12.6) {
      tourBlend = this.smoothstep(11.4, 12.6, h);
    } else if (h > 12.6) {
      tourBlend = 1;
    }

    const activeTour: 1 | 2 = tourBlend >= 0.5 ? 2 : 1;

    if (isMidnightPause || h >= 23) {
      return {
        hours24: h,
        isDay: false,
        activeTour,
        tourBlend,
        dwellFactor: isMidnightPause ? 1 : 0.75,
        periodLabel: '🌙 Minuit',
        calloutText: 'Minuit : on change de jour',
        calloutColor: '#fbbf24'
      };
    }

    if (h < 6) {
      return {
        hours24: h,
        isDay: false,
        activeTour,
        tourBlend,
        dwellFactor: 0.65,
        periodLabel: '🌙 Nuit (matin)',
        calloutText: 'C’est la nuit',
        calloutColor: '#38bdf8'
      };
    }

    if (h < 11) {
      return {
        hours24: h,
        isDay: true,
        activeTour,
        tourBlend,
        dwellFactor: 0.65,
        periodLabel: '☀️ Matin',
        calloutText: 'Le jour se lève',
        calloutColor: '#0284c7'
      };
    }

    if (h < 14.5) {
      return {
        hours24: h,
        isDay: true,
        activeTour,
        tourBlend,
        dwellFactor: 0.65,
        periodLabel: h < 12 ? '☀️ Midi' : '🌤️ Après-midi',
        calloutText: 'Repas de midi',
        calloutColor: '#0284c7'
      };
    }

    if (h < 18.5) {
      return {
        hours24: h,
        isDay: true,
        activeTour,
        tourBlend,
        dwellFactor: 0.65,
        periodLabel: '🌤️ Après-midi',
        calloutText: 'Le goûter',
        calloutColor: '#ea580c'
      };
    }

    return {
      hours24: h,
      isDay: false,
      activeTour,
      tourBlend,
      dwellFactor: 0.65,
      periodLabel: '🌙 Soir',
      calloutText: 'Repas du soir',
      calloutColor: '#ea580c'
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
    if (level !== 2) return null;
    const state = this.getLevel2Timeline(elapsedMs);
    return {
      text: state.calloutText,
      color: state.calloutColor
    };
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

    // Niveau 8 : uniquement les aiguilles (sans cercle pointillé ni flèche orange)
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
    ctx.globalAlpha = 0.55 + 0.45 * state.dwellFactor;
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
    const t = (elapsedMs % 7200) / 7200;
    let m = 15;

    if (t < 0.35) {
      m = 15;
    } else if (t < 0.50) {
      m = 15 + this.easeInOutSine((t - 0.35) / 0.15) * 30;
    } else if (t < 0.85) {
      m = 45;
    } else {
      m = 45 - this.easeInOutSine((t - 0.85) / 0.15) * 30;
    }

    hands.draw(4, m, 5);
    const minAngle = (m * Math.PI) / 30;
    this.drawTargetHalo(ctx, radius - 25, minAngle, 20 + pulse * 4, '#0284c7');

    if (m < 30) {
      this.drawCurvedArrow(ctx, radius - 50, 0.08, Math.max(0.15, minAngle - 0.08), '#0284c7');
    } else {
      const hAngle = ((4 + m / 60) * Math.PI) / 6;
      this.drawTargetHalo(ctx, radius - 68, hAngle, 20 + pulse * 4, '#ea580c');
    }
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
