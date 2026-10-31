import type { HandsStyle } from './SaveManager';

export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;
  private handsStyle: HandsStyle;

  constructor(ctx: CanvasRenderingContext2D, radius: number, handsStyle: HandsStyle = 'classic-hands') {
    this.ctx = ctx;
    this.radius = radius;
    this.handsStyle = handsStyle;
  }

  public setStyle(style: HandsStyle): void {
    this.handsStyle = style;
  }

  public getStyle(): HandsStyle {
    return this.handsStyle;
  }

  public draw(hours: number, minutes: number): void {
    const ctx = this.ctx;

    let hourColor = '#334155';
    let minuteColor = '#0284c7';
    let hourWidth = 8;
    let minuteWidth = 5;
    let glow = false;

    if (this.handsStyle === 'neon-hands') {
      hourColor = '#10b981';
      minuteColor = '#ec4899';
      hourWidth = 9;
      minuteWidth = 6;
      glow = true;
    } else if (this.handsStyle === 'gold-hands') {
      hourColor = '#b45309';
      minuteColor = '#f59e0b';
      hourWidth = 8.5;
      minuteWidth = 5.5;
    }

    // Aiguille des heures
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    ctx.save();
    ctx.rotate(hourAngle);
    if (glow) {
      ctx.shadowColor = hourColor;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(0, -this.radius * 0.52);
    ctx.lineWidth = hourWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hourColor;
    ctx.stroke();
    ctx.restore();

    // Aiguille des minutes
    const minuteAngle = (minutes * Math.PI) / 30;
    ctx.save();
    ctx.rotate(minuteAngle);
    if (glow) {
      ctx.shadowColor = minuteColor;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(0, -this.radius * 0.74);
    ctx.lineWidth = minuteWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = minuteColor;
    ctx.stroke();
    ctx.restore();

    // Pivot central rubis d'horlogerie dessiné par-dessus l'axe des aiguilles
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
