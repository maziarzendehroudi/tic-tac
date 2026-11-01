export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Aiguilles calibrées pour pointer précisément vers leurs couronnes sans masquer les chiffres :
   * - Petite aiguille (Heures, Orange) : pointe à r - 124 (juste devant 13..00 et 1..12)
   * - Grande aiguille (Minutes, Bleue) : pointe à r - 44 (entre 1..12 et la piste 00..55)
   */
  public draw(hours: number, minutes: number, activeHand?: 'hour' | 'minute'): void {
    const ctx = this.ctx;
    const hourTip = this.radius - 122;
    const minuteTip = this.radius - 43;

    // 1. Petite aiguille des Heures (Orange #ea580c)
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    ctx.save();
    ctx.rotate(hourAngle);
    if (activeHand === 'hour') {
      ctx.shadowColor = 'rgba(234, 88, 12, 0.5)';
      ctx.shadowBlur = 12;
    }

    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -(hourTip - 10));
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ea580c';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-7.5, -(hourTip - 12));
    ctx.lineTo(0, -hourTip);
    ctx.lineTo(7.5, -(hourTip - 12));
    ctx.closePath();
    ctx.fillStyle = '#ea580c';
    ctx.fill();
    ctx.restore();

    // 2. Grande aiguille des Minutes (Bleue #0284c7)
    const minuteAngle = (minutes * Math.PI) / 30;
    ctx.save();
    ctx.rotate(minuteAngle);
    if (activeHand === 'minute') {
      ctx.shadowColor = 'rgba(2, 132, 199, 0.5)';
      ctx.shadowBlur = 12;
    }

    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -(minuteTip - 11));
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-6, -(minuteTip - 13));
    ctx.lineTo(0, -minuteTip);
    ctx.lineTo(6, -(minuteTip - 13));
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.restore();

    // 3. Pivot central sobre
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
