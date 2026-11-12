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
  periodLabel: string;
  calloutText: string;
  calloutColor: string;
}

export class TutorialOverlay {
  private static readonly LEVEL2_CYCLE_MS = 12000;

  public static getInfo(level: number): TutorialStepInfo {
    switch (level) {
      case 1:
        return {
          title: 'Les Heures (12h)',
          ruleHtml:
            'La <strong>petite aiguille orange</strong> indique les heures : regarde le chiffre qu’elle pointe : il est <strong>3 heures</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 2:
        return {
          title: 'Les 24 Heures',
          ruleHtml:
            'Chaque jour commence à minuit. Entre minuit et midi, on lit les <strong>chiffres noirs</strong>. Après midi, et jusqu’à minuit, on lit les <strong>chiffres orange</strong>.',
          periodLabel: '🌙 1er tour · Nuit (matin)',
          isDay: false
        };
      case 3:
        return {
          title: 'Les Minutes',
          ruleHtml:
            'La <strong>grande aiguille bleue</strong> indique les minutes (de 5 en 5) : lis les nombres bleus : <strong>20 minutes</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 4:
        return {
          title: 'Les Demi-Heures',
          ruleHtml:
            'En haut c’est <strong>l’heure pile</strong>, en bas c’est <strong>la demie</strong>. Regarde l’aiguille orange des heures qui montre qu’il est entre <strong>2h et 3h</strong>.',
          periodLabel: '',
          isDay: true
        };
      case 5:
        return {
          title: 'Les Quarts d’Heure',
          ruleHtml:
            '<strong>15</strong> = un quart d’heure et <strong>45</strong> = trois quarts d’heure.',
          periodLabel: '',
          isDay: true
        };
      case 6:
        return {
          title: 'À la Minute près',
          ruleHtml:
            'Pars du nombre bleu le plus proche (<strong>20</strong>), puis compte les petites graduations une par une (<strong>21, 22, 23</strong>) !',
          periodLabel: '',
          isDay: true
        };
      case 7:
        return {
          title: 'Le Défi Jour & Nuit',
          ruleHtml:
            'Comme il fait jour, on sait qu’il est <strong>16h20</strong> (l’après-midi) et pas 4h20 du matin !',
          periodLabel: '🌤️ Après-midi',
          isDay: true
        };
      default:
        return {
          title: 'L’Horloge des Grands',
          ruleHtml:
            'Voici une horloge de grand : il faut <strong>deviner les chiffres</strong> : il est <strong>16h10</strong> !',
          periodLabel: '🌤️ Après-midi',
          isDay: true
        };
    }
  }

  /**
   * Calcule l'état continu des 2 tours d'horloge (00h -> 12h -> 24h) avec 4 pauses :
   * 1. 03 h (Nuit, 1er tour noir) : "🌙 03 h · On dort"
   * 2. 08 h (Matin, 1er tour noir, après le lever du soleil à 06 h) : "☀️ 08 h · L’école"
   * 3. 15 h (Après-midi, 2e tour orange, après la bascule de midi à 12 h) : "🌤️ 15 h · L’après-midi"
   * 4. 20 h (Soir, 2e tour orange, après le coucher du soleil à 18 h) : "🌙 20 h · Le soir"
   */
  public static getLevel2Timeline(elapsedMs: number): Level2TimelineState {
    const t = ((elapsedMs % this.LEVEL2_CYCLE_MS) + this.LEVEL2_CYCLE_MS) % this.LEVEL2_CYCLE_MS / this.LEVEL2_CYCLE_MS;
    let h = 3;

    if (t < 0.06) {
      h = this.easeInOut(t / 0.06) * 3;
    } else if (t < 0.25) {
      h = 3;
    } else if (t < 0.33) {
      h = 3 + this.easeInOut((t - 0.25) / 0.08) * 5;
    } else if (t < 0.50) {
      h = 8;
    } else if (t < 0.60) {
      h = 8 + this.easeInOut((t - 0.50) / 0.10) * 7;
    } else if (t < 0.75) {
      h = 15;
    } else if (t < 0.82) {
      h = 15 + this.easeInOut((t - 0.75) / 0.07) * 5;
    } else if (t < 0.94) {
      h = 20;
    } else {
      h = 20 + this.easeInOut((t - 0.94) / 0.06) * 4;
    }

    const isDay = h >= 6 && h < 18;
    const activeTour: 1 | 2 = h < 12 || h >= 23.95 ? 1 : 2;

    if (t < 0.25) {
      return {
        hours24: h,
        isDay,
        activeTour,
        periodLabel: '🌙 1er tour · Nuit (matin)',
        calloutText: '🌙 03 h · On dort',
        calloutColor: '#38bdf8'
      };
    }
    if (t < 0.50) {
      return {
        hours24: h,
        isDay,
        activeTour,
        periodLabel: isDay ? '☀️ 1er tour · Matin' : '🌙 1er tour · Nuit (matin)',
        calloutText: '☀️ 08 h · L’école',
        calloutColor: '#0284c7'
      };
    }
    if (t < 0.75) {
      return {
        hours24: h,
        isDay,
        activeTour,
        periodLabel: activeTour === 2 ? '🌤️ 2e tour · Après-midi' : '☀️ 1er tour · Matin',
        calloutText: '🌤️ 15 h · L’après-midi',
        calloutColor: '#ea580c'
      };
    }
    return {
      hours24: h,
      isDay,
      activeTour,
      periodLabel: isDay ? '🌤️ 2e tour · Après-midi' : '🌙 2e tour · Soir',
      calloutText: '🌙 20 h · Le soir',
      calloutColor: '#ea580c'
    };
  }

  public static getDynamicFrameState(
    level: number,
    elapsedMs: number
  ): { isDay: boolean; periodLabel: string; activeTour: 1 | 2 } | null {
    if (level !== 2) return null;
    const state = this.getLevel2Timeline(elapsedMs);
    return {
      isDay: state.isDay,
      periodLabel: state.periodLabel,
      activeTour: state.activeTour
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
    const pulse = 0.5 + 0.5 * Math.sin(elapsedMs * 0.006);
    const cycle = (elapsedMs % 3600) / 3600;
    const smoothT =
      cycle < 0.45
        ? this.easeInOut(cycle / 0.45)
        : cycle < 0.85
          ? 1
          : 1 - this.easeInOut((cycle - 0.85) / 0.15);

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
    const a4 = (4 * Math.PI) / 6;
    this.drawCurvedArrow(ctx, radius - 90, Math.PI / 2, a4, '#ea580c');
    this.drawTargetHalo(ctx, radius - 54, a4, 22 + pulse * 4, '#ea580c');
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

    if (state.activeTour === 1) {
      this.drawTargetHalo(ctx, radius - 54, angleH, 24 + pulse * 4, '#0284c7');
    } else {
      this.drawTargetHalo(ctx, radius - 104, angleH, 20 + pulse * 4, '#ea580c');
    }
  }

  private static drawLevel5Continuous(
    ctx: CanvasRenderingContext2D,
    hands: Hands,
    radius: number,
    elapsedMs: number,
    pulse: number
  ): void {
    const t = (elapsedMs % 7500) / 7500;
    let m = 15;

    if (t < 0.14) {
      m = this.easeInOut(t / 0.14) * 15;
    } else if (t < 0.45) {
      m = 15;
    } else if (t < 0.63) {
      m = 15 + this.easeInOut((t - 0.45) / 0.18) * 30;
    } else if (t < 0.93) {
      m = 45;
    } else {
      m = 45 - this.easeInOut((t - 0.93) / 0.07) * 45;
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

  private static easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
