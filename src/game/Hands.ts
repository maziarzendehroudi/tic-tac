export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  public draw(
    hours: number,
    minutes: number,
    level: number = 1,
    activeHand?: 'hour' | 'minute',
    ghostTarget?: { hours: number; minutes: number }
  ): void {
    const ctx = this.ctx;
    const showHourHand = level !== 3;
    const showMinuteHand = level >= 3;

    const hourTip = level === 2 || level === 7 ? this.radius - 122 : this.radius - 86;
    const minuteTip = level >= 3 && level <= 6 ? this.radius - 36 : this.radius - 18;

    if (ghostTarget) {
      if (showHourHand) {
        const ghostHourAngle =
          ((ghostTarget.hours % 12) * Math.PI) / 6 +
          (showMinuteHand ? (ghostTarget.minutes * Math.PI) / 360 : 0);
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
      }

      if (showMinuteHand) {
        const ghostMinAngle = (ghostTarget.minutes * Math.PI) / 30;
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
    }

    if (showHourHand) {
      const hourAngle =
        ((hours % 12) * Math.PI) / 6 + (showMinuteHand ? (minutes * Math.PI) / 360 : 0);
      ctx.save();
      ctx.rotate(hourAngle);
      if (activeHand === 'hour') {
        ctx.shadowColor = 'rgba(234, 88, 12, 0.6)';
        ctx.shadowBlur = 14;
      }

      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(0, -(hourTip - 11));
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
    }

    if (showMinuteHand) {
      const minuteAngle = (minutes * Math.PI) / 30;
      ctx.save();
      ctx.rotate(minuteAngle);
      if (activeHand === 'minute') {
        ctx.shadowColor = 'rgba(2, 132, 199, 0.6)';
        ctx.shadowBlur = 14;
      }

      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(0, -(minuteTip - 11));
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0284c7';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-6, -(minuteTip - 12));
      ctx.lineTo(0, -minuteTip);
      ctx.lineTo(6, -(minuteTip - 12));
      ctx.closePath();
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
