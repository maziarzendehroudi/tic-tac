import { Hands } from './Hands';

export interface TutorialStepInfo {
  title: string;
  ruleHtml: string;
  periodLabel: string;
  isDay: boolean;
}

export class TutorialOverlay {
  public static getInfo(level: number): TutorialStepInfo {
    switch (level) {
      case 1:
        return {
          title: '💡 Astuce · La petite aiguille',
          ruleHtml:
            'La <strong style="color:#fb923c">petite aiguille orange</strong> indique les <strong>heures</strong> : regarde le chiffre qu’elle pointe !',
          periodLabel: '',
          isDay: true
        };
      case 2:
        return {
          title: '💡 Astuce · Jour, Nuit et 24 Heures',
          ruleHtml:
            '1 jour + 1 nuit = <strong>24 h (2 tours)</strong> ! Matin (1er tour) : lis le chiffre <strong>noir (03 h)</strong> · Après-midi et Soir (2e tour) : lis le nombre <strong style="color:#fb923c">orange (15 h)</strong> !',
          periodLabel: '☀️ 1er tour : Matin (01h - 12h)',
          isDay: true
        };
      case 3:
        return {
          title: '💡 Astuce · La grande aiguille',
          ruleHtml:
            'La <strong style="color:#38bdf8">grande aiguille bleue</strong> indique les <strong>minutes</strong> : lis les nombres bleus au bord (de 5 en 5) !',
          periodLabel: '',
          isDay: true
        };
      case 4:
        return {
          title: '💡 Astuce · Les Demi-Heures',
          ruleHtml:
            'En bas sur <strong>30</strong>, c’est <strong>« et demie »</strong> : la petite aiguille orange avance <strong>entre deux chiffres</strong> !',
          periodLabel: '',
          isDay: true
        };
      case 5:
        return {
          title: '💡 Astuce · Les Quarts d’Heure',
          ruleHtml:
            '<strong>:15</strong> = et quart · <strong>:45</strong> = moins le quart (regarde la petite aiguille avancer vers le <strong>5</strong> sans le dépasser !).',
          periodLabel: '',
          isDay: true
        };
      case 6:
        return {
          title: '💡 Astuce · À la Minute près',
          ruleHtml:
            'Pars du nombre bleu le plus proche (<strong>20</strong>), puis compte les petites graduations une par une (<strong>21, 22, 23</strong>) !',
          periodLabel: '',
          isDay: true
        };
      case 7:
        return {
          title: '💡 Astuce · Défi Jour & Nuit',
          ruleHtml:
            'Les nombres bleus ont disparu : compte les grands traits bleus de <strong>5 en 5</strong> et lis l’heure du soir en <strong style="color:#fb923c">orange</strong> !',
          periodLabel: '🌤️ Après-midi',
          isDay: true
        };
      default:
        return {
          title: '💡 Astuce · L’Horloge des Grands',
          ruleHtml:
            'Repère-toi avec <strong>12, 3, 6, 9</strong> et ajoute <strong>+ 12</strong> dans ta tête l’après-midi (<strong>4 h + 12 = 16 h</strong>) !',
          periodLabel: '🌤️ Après-midi',
          isDay: true
        };
    }
  }

  public static getDynamicFrameState(
    level: number,
    elapsedMs: number
  ): { isDay: boolean; periodLabel: string } | null {
    if (level !== 2) return null;
    const t = (elapsedMs % 8400) / 8400;
    if (t < 0.44) {
      return { isDay: true, periodLabel: '☀️ 1er tour · Matin (01h - 12h)' };
    }
    if (t < 0.74) {
      return { isDay: true, periodLabel: '🌤️ 2e tour · Après-midi (13h - 17h)' };
    }
    return { isDay: false, periodLabel: '🌙 2e tour · Soir & Nuit (18h - 00h)' };
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
      this.drawCurvedArrow(ctx, radius - 54, Math.PI / 6, Math.PI / 2, '#ea580c');
      this.drawTargetHalo(ctx, radius - 54, Math.PI / 2, 24 + pulse * 4, '#ea580c');
      this.drawCalloutBadge(ctx, 0, radius * 0.42, '3 heures', '#ea580c');
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
      this.drawCurvedArrow(ctx, radius - 25, 0.12, endAngle - 0.14, '#0284c7');
      this.drawTargetHalo(ctx, radius - 25, endAngle, 20 + pulse * 4, '#0284c7');
      this.drawCalloutBadge(ctx, 0, radius * 0.42, '20 minutes', '#0284c7');
      return;
    }

    if (level === 4) {
      const m = smoothT * 30;
      hands.draw(2, m, 4);
      const midHourAngle = (2.5 * Math.PI) / 6;
      this.drawTargetHalo(ctx, radius - 68, midHourAngle, 22 + pulse * 4, '#ea580c');
      this.drawTargetHalo(ctx, radius - 25, Math.PI, 20 + pulse * 4, '#0284c7');
      this.drawCalloutBadge(ctx, 0, -radius * 0.38, '2:30 (2 h et demie)', '#0284c7');
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
      this.drawCalloutBadge(ctx, 0, -radius * 0.38, '20 + 3 traits = 8:23', '#0284c7');
      return;
    }

    if (level === 7) {
      const m = smoothT * 20;
      hands.draw(16, m, 7);
      this.drawTargetHalo(ctx, radius - 104, (4 * Math.PI) / 6, 20 + pulse * 4, '#ea580c');
      for (let step = 5; step <= 20; step += 5) {
        const aStep = (step * Math.PI) / 30;
        this.drawSmallDot(ctx, radius - 15, aStep, '#0284c7');
      }
      this.drawCalloutBadge(ctx, 0, radius * 0.45, '16:20 (5, 10, 15, 20)', '#0284c7');
      return;
    }

    // Niveau 8 : Mouvement fluide de 15:00 vers 16:10
    const h8 = 15 + smoothT;
    const m8 = smoothT * 10;
    hands.draw(h8, m8, 8);
    const a4 = (4 * Math.PI) / 6;
    this.drawCurvedArrow(ctx, radius - 54, Math.PI / 2, a4, '#ea580c');
    this.drawTargetHalo(ctx, radius - 28, a4, 18 + pulse * 4, '#ea580c');
    this.drawCalloutBadge(ctx, 0, radius * 0.44, '4 h + 12 = 16:10', '#ea580c');
  }

  /**
   * Niveau 2 : Une seule animation continue (8,4 s)
   * 1) Glisse de 12h à 3h du matin (chiffre noir 3 -> 03 h)
   * 2) Tourne jusqu'à 12h puis 15h (nombre orange 15 -> 15 h l'après-midi)
   * 3) Glisse jusqu'à 20h sous le ciel étoilé (nombre orange 20 -> 20 h le soir)
   */
  private static drawLevel2Continuous(
    ctx: CanvasRenderingContext2D,
    hands: Hands,
    radius: number,
    elapsedMs: number,
    pulse: number
  ): void {
    const t = (elapsedMs % 8400) / 8400;
    let h = 3;

    if (t < 0.12) {
      h = this.easeInOut(t / 0.12) * 3;
    } else if (t < 0.36) {
      h = 3;
    } else if (t < 0.50) {
      h = 3 + this.easeInOut((t - 0.36) / 0.14) * 12; // Fait un tour complet jusqu'à 15h
    } else if (t < 0.72) {
      h = 15;
    } else if (t < 0.80) {
      h = 15 + this.easeInOut((t - 0.72) / 0.08) * 5; // Glisse de 15h à 20h
    } else if (t < 0.95) {
      h = 20;
    } else {
      h = 20 + this.easeInOut((t - 0.95) / 0.05) * 4; // Retour par minuit (24h)
    }

    hands.draw(h, 0, 2, 'hour');
    const angleH = ((h % 12) * Math.PI) / 6;

    if (t < 0.44) {
      this.drawRadialArrow(ctx, angleH, radius - 104, radius - 54, '#0284c7');
      this.drawTargetHalo(ctx, radius - 54, angleH, 23 + pulse * 4, '#0284c7');
      this.drawCalloutBadge(ctx, 0, radius * 0.44, '☀️ 3 h du matin = 03 h', '#0284c7');
    } else if (t < 0.74) {
      this.drawRadialArrow(ctx, angleH, radius - 54, radius - 104, '#ea580c');
      this.drawTargetHalo(ctx, radius - 104, angleH, 21 + pulse * 4, '#ea580c');
      this.drawCalloutBadge(ctx, 0, radius * 0.44, '🌤️ 3 h après-midi = 15 h', '#ea580c');
    } else {
      this.drawRadialArrow(ctx, angleH, radius - 54, radius - 104, '#ea580c');
      this.drawTargetHalo(ctx, radius - 104, angleH, 21 + pulse * 4, '#ea580c');
      this.drawCalloutBadge(ctx, 0, radius * 0.44, '🌙 8 h du soir = 20 h', '#ea580c');
    }
  }

  /**
   * Niveau 5 (Option B) : Une seule animation continue avec paliers à :15 et :45 (7,5 s)
   */
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
      m = this.easeInOut(t / 0.14) * 15; // 4:00 -> 4:15
    } else if (t < 0.45) {
      m = 15; // Pause sur 4:15
    } else if (t < 0.63) {
      m = 15 + this.easeInOut((t - 0.45) / 0.18) * 30; // Glisse de 4:15 à 4:45
    } else if (t < 0.93) {
      m = 45; // Pause sur 4:45
    } else {
      m = 45 - this.easeInOut((t - 0.93) / 0.07) * 45; // Retour doux à 4:00
    }

    hands.draw(4, m, 5);
    const minAngle = (m * Math.PI) / 30;
    this.drawTargetHalo(ctx, radius - 25, minAngle, 20 + pulse * 4, '#0284c7');

    if (m < 30) {
      this.drawCurvedArrow(ctx, radius - 25, 0.08, Math.max(0.15, minAngle - 0.1), '#0284c7');
      this.drawCalloutBadge(ctx, 0, -radius * 0.38, '4:15 (4 h et quart)', '#0284c7');
    } else {
      const hAngle = ((4 + m / 60) * Math.PI) / 6;
      this.drawTargetHalo(ctx, radius - 68, hAngle, 20 + pulse * 4, '#ea580c');
      this.drawCalloutBadge(ctx, 0, -radius * 0.38, '4:45 (5 h moins le quart)', '#ea580c');
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

  private static drawSmallDot(
    ctx: CanvasRenderingContext2D,
    orbitR: number,
    angle: number,
    color: string
  ): void {
    const x = orbitR * Math.sin(angle);
    const y = -orbitR * Math.cos(angle);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
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

  private static drawRadialArrow(
    ctx: CanvasRenderingContext2D,
    angle: number,
    fromR: number,
    toR: number,
    color: string
  ): void {
    const x1 = fromR * Math.sin(angle);
    const y1 = -fromR * Math.cos(angle);
    const x2 = toR * Math.sin(angle);
    const y2 = -toR * Math.cos(angle);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    const dir = Math.atan2(y2 - y1, x2 - x1);
    ctx.translate(x2, y2);
    ctx.rotate(dir);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, -5);
    ctx.lineTo(-9, 5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  private static drawCalloutBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    borderColor: string
  ): void {
    ctx.save();
    ctx.font = '700 15px "Fredoka", sans-serif';
    const padX = 13;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 32;

    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 12);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }
}
