export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Aiguilles épurées sans pastilles parasites :
   * - Petite aiguille des Heures (Or / Ambre #d97706)
   * - Grande aiguille des Minutes (Bleue #0284c7)
   */
  public draw(hours: number, minutes: number, activeHand?: 'hour' | 'minute'): void {
    const ctx = this.ctx;
    const hourLength = this.radius * 0.48;
    const minuteLength = this.radius * 0.76;

    // 1. Petite aiguille des Heures
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    ctx.save();
    ctx.rotate(hourAngle);
    if (activeHand === 'hour') {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, -hourLength);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d97706';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-7, -(hourLength - 8));
    ctx.lineTo(0, -(hourLength + 10));
    ctx.lineTo(7, -(hourLength - 8));
    ctx.closePath();
    ctx.fillStyle = '#d97706';
    ctx.fill();
    ctx.restore();

    // 2. Grande aiguille des Minutes
    const minuteAngle = (minutes * Math.PI) / 30;
    ctx.save();
    ctx.rotate(minuteAngle);
    if (activeHand === 'minute') {
      ctx.shadowColor = 'rgba(2, 132, 199, 0.55)';
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(0, -minuteLength);
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-6, -(minuteLength - 8));
    ctx.lineTo(0, -(minuteLength + 10));
    ctx.lineTo(6, -(minuteLength - 8));
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.restore();

    // 3. Pivot central sobre
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
