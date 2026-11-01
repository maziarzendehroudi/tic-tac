export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Dessine les aiguilles avec une correspondance géométrique exacte :
   * - Petite aiguille dorée (Heures) : pointe entre le cercle 24h (r-114) et le cercle 1-12 (r-72)
   * - Grande aiguille bleue (Minutes) : pointe directement sur la piste extérieure bleue des minutes (r-48)
   * - En phase de placement, affiche une poignée ronde tactile sur l'aiguille active
   */
  public draw(hours: number, minutes: number, activeHand?: 'hour' | 'minute'): void {
    const ctx = this.ctx;
    const hourLength = this.radius * 0.52;
    const minuteLength = this.radius * 0.79;

    // 1. Petite aiguille des Heures (Or / Ambre #d97706)
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    ctx.save();
    ctx.rotate(hourAngle);
    if (activeHand === 'hour') {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.65)';
      ctx.shadowBlur = 14;
    }

    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -hourLength);
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d97706';
    ctx.stroke();

    // Flèche de la petite aiguille
    ctx.beginPath();
    ctx.moveTo(-8, -(hourLength - 10));
    ctx.lineTo(0, -(hourLength + 12));
    ctx.lineTo(8, -(hourLength - 10));
    ctx.closePath();
    ctx.fillStyle = '#d97706';
    ctx.fill();

    // Pastille de préhension tactile si la petite aiguille est active
    if (activeHand === 'hour') {
      ctx.beginPath();
      ctx.arc(0, -(hourLength * 0.72), 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#fef3c7';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#b45309';
      ctx.stroke();
    }
    ctx.restore();

    // 2. Grande aiguille des Minutes (Bleue #0284c7)
    const minuteAngle = (minutes * Math.PI) / 30;
    ctx.save();
    ctx.rotate(minuteAngle);
    if (activeHand === 'minute') {
      ctx.shadowColor = 'rgba(2, 132, 199, 0.65)';
      ctx.shadowBlur = 14;
    }

    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -minuteLength);
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    // Flèche de la grande aiguille
    ctx.beginPath();
    ctx.moveTo(-6.5, -(minuteLength - 10));
    ctx.lineTo(0, -(minuteLength + 12));
    ctx.lineTo(6.5, -(minuteLength - 10));
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();

    // Pastille de préhension tactile si la grande aiguille est active
    if (activeHand === 'minute') {
      ctx.beginPath();
      ctx.arc(0, -(minuteLength * 0.78), 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#e0f2fe';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0369a1';
      ctx.stroke();
    }
    ctx.restore();

    // 3. Axe central rubis
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
