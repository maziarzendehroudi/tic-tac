export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Code couleur pédagogique constant (Méthode Montessori / Éducation Nationale) :
   * - Petite aiguille des Heures : Or / Ambre (#d97706, contour #78350f), plus courte et plus large
   * - Grande aiguille des Minutes : Bleue (#0284c7, contour #0c4a6e), plus longue et plus fine
   */
  public draw(hours: number, minutes: number, activeHand?: 'hour' | 'minute'): void {
    const ctx = this.ctx;

    // 1. Petite aiguille des Heures (Or / Ambre)
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    ctx.save();
    ctx.rotate(hourAngle);
    if (activeHand === 'hour') {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -this.radius * 0.5);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d97706';
    ctx.stroke();

    // Pointe fléchée pour bien lire la cible horaire
    ctx.beginPath();
    ctx.moveTo(-7, -this.radius * 0.46);
    ctx.lineTo(0, -this.radius * 0.55);
    ctx.lineTo(7, -this.radius * 0.46);
    ctx.closePath();
    ctx.fillStyle = '#d97706';
    ctx.fill();
    ctx.restore();

    // 2. Grande aiguille des Minutes (Bleue)
    const minuteAngle = (minutes * Math.PI) / 30;
    ctx.save();
    ctx.rotate(minuteAngle);
    if (activeHand === 'minute') {
      ctx.shadowColor = 'rgba(2, 132, 199, 0.55)';
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -this.radius * 0.76);
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-5.5, -this.radius * 0.72);
    ctx.lineTo(0, -this.radius * 0.81);
    ctx.lineTo(5.5, -this.radius * 0.72);
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.restore();

    // 3. Rubis central d'horlogerie
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
