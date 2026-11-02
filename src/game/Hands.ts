export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Dessine les aiguilles épurées (sans curseur blanc sur le corps de l'aiguille)
   */
  public draw(
    hours: number,
    minutes: number,
    level: number = 1,
    activeHand?: 'hour' | 'minute',
    ghostTarget?: { hours: number; minutes: number }
  ): void {
    const ctx = this.ctx;
    const hourTip = level === 5 || level === 6 ? this.radius - 118 : this.radius - 96;
    const minuteTip = level >= 2 && level <= 5 ? this.radius - 42 : this.radius - 24;

    if (ghostTarget) {
      const ghostHourAngle = ((ghostTarget.hours % 12) * Math.PI) / 6 + (ghostTarget.minutes * Math.PI) / 360;
      const ghostMinAngle = (ghostTarget.minutes * Math.PI) / 30;

      ctx.save();
      ctx.rotate(ghostHourAngle);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -hourTip);
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.38)';
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(ghostMinAngle);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -minuteTip);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.38)';
      ctx.stroke();
      ctx.restore();
    }

    // 1. Petite aiguille des Heures (Orange #ea580c)
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    ctx.save();
    ctx.rotate(hourAngle);
    if (activeHand === 'hour') {
      ctx.shadowColor = 'rgba(234, 88, 12, 0.45)';
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -(hourTip - 11));
    ctx.lineWidth = 10.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ea580c';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-8, -(hourTip - 13));
    ctx.lineTo(0, -hourTip);
    ctx.lineTo(8, -(hourTip - 13));
    ctx.closePath();
    ctx.fillStyle = '#ea580c';
    ctx.fill();
    ctx.restore();

    // 2. Grande aiguille des Minutes (Bleue #0284c7)
    const minuteAngle = (minutes * Math.PI) / 30;
    ctx.save();
    ctx.rotate(minuteAngle);
    if (activeHand === 'minute') {
      ctx.shadowColor = 'rgba(2, 132, 199, 0.45)';
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -(minuteTip - 12));
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-6.5, -(minuteTip - 14));
    ctx.lineTo(0, -minuteTip);
    ctx.lineTo(6.5, -(minuteTip - 14));
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.restore();

    // 3. Pivot central
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
