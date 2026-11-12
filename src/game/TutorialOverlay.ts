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

interface Level2Waypoint {
  hour: number;
  deltaToNext: number;
  dwellMs: number;
  moveMs: number;
  tourBlend: number;
  periodLabel: string;
  calloutText: string;
  calloutColor: string;
}

export class TutorialOverlay {
  /**
   * Les 6 repères clés d'une journée de 24h (2 tours d'horloge) :
   * - 3 repères sur la couronne extérieure noire (03 h, 09 h, 12 h)
   * - 3 repères sur la couronne intérieure orange (17 h, 21 h, 00 h)
   */
  private static readonly LEVEL2_WAYPOINTS: readonly Level2Waypoint[] = [
    {
      hour: 0,
      deltaToNext: 3,
      dwellMs: 1400,
      moveMs: 1050,
      tourBlend: 1,
      periodLabel: '🌙 Minuit · Nouveau jour',
      calloutText: '🌙 Minuit (00 h) : on change de jour',
      calloutColor: '#fbbf24'
    },
    {
      hour: 3,
      deltaToNext: 6,
      dwellMs: 1350,
      moveMs: 1650,
      tourBlend: 0,
      periodLabel: '🌙 1er tour · Nuit (matin)',
      calloutText: '🌙 03 h · On dort',
      calloutColor: '#38bdf8'
    },
    {
      hour: 9,
      deltaToNext: 3,
      dwellMs: 1400,
      moveMs: 1050,
      tourBlend: 0,
      periodLabel: '☀️ 1er tour · Matin',
      calloutText: '☀️ 09 h · L’école',
      calloutColor: '#0284c7'
    },
    {
      hour: 12,
      deltaToNext: 5,
      dwellMs: 1450,
      moveMs: 1450,
      tourBlend: 0,
      periodLabel: '☀️ Midi · Milieu du jour',
      calloutText: '🍽️ 12 h · Midi : le repas',
      calloutColor: '#0284c7'
    },
    {
      hour: 17,
      deltaToNext: 4,
      dwellMs: 1400,
      moveMs: 1250,
      tourBlend: 1,
      periodLabel: '🌤️ 2e tour · Après-midi',
      calloutText: '🌤️ 17 h · La fin de l’école',
      calloutColor: '#ea580c'
    },
    {
      hour: 21,
      deltaToNext: 3,
      dwellMs: 1400,
      moveMs: 1050,
      tourBlend: 1,
      periodLabel: '🌙 2e tour · Soir',
      calloutText: '🌙 21 h · Le dodo',
      calloutColor: '#ea580c'
    }
  ];

  public static readonly LEVEL2_CYCLE_MS = TutorialOverlay.LEVEL2_WAYPOINTS.reduce(
    (sum, wp) => sum + wp.dwellMs + wp.moveMs,
    0
  );

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
          periodLabel: '🌙 Minuit · Nouveau jour',
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

  public static getLevel2Timeline(elapsedMs: number): Level2TimelineState {
    const total = this.LEVEL2_CYCLE_MS;
    let rem = ((elapsedMs % total) + total) % total;

    const waypoints = this.LEVEL2_WAYPOINTS;
    let idx = 0;
    for (let i = 0; i < waypoints.length; i++) {
      const segDuration = waypoints[i].dwellMs + waypoints[i].moveMs;
      if (rem < segDuration || i === waypoints.length - 1) {
        idx = i;
        break;
      }
      rem -= segDuration;
    }

    const current = waypoints[idx];
    const next = waypoints[(idx + 1) % waypoints.length];

    let moveProgress = 0;
    let dwellFactor = 1;
    let labelSource = current;

    if (rem > current.dwellMs) {
      const moveU = Math.min(1, (rem - current.dwellMs) / current.moveMs);
      moveProgress = this.easeInOutSine(moveU);
      dwellFactor = Math.max(0.28, 1 - Math.sin(moveU * Math.PI) * 0.72);
      if (moveU >= 0.52) {
        labelSource = next;
      }
    }

    const hRaw = current.hour + moveProgress * current.deltaToNext;
    const h = ((hRaw % 24) + 24) % 24;

    const tourBlend =
      current.tourBlend + (next.tourBlend - current.tourBlend) * moveProgress;
    const isDay = h >= 6 && h < 18;
    const activeTour: 1 | 2 = tourBlend >= 0.5 ? 2 : 1;

    return {
      hours24: h,
      isDay,
      activeTour,
      tourBlend,
      dwellFactor,
      periodLabel: labelSource.periodLabel,
      calloutText: labelSource.calloutText,
      calloutColor: labelSource.calloutColor
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
