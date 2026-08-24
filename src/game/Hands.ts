export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;
  private handsStyle: string;

  constructor(ctx: CanvasRenderingContext2D, radius: number, handsStyle: string = 'classic-hands') {
    this.ctx = ctx;
    this.radius = radius;
    this.handsStyle = handsStyle;
  }

  public setStyle(style: string): void {
    this.handsStyle = style;
  }

  public draw(hours: number, minutes: number): void {
    const ctx = this.ctx;

    let hourColor = '#2d3748';
    let minuteColor = '#3182ce';
    let hourWidth = 8;
    let minuteWidth = 5;

    if (this.handsStyle === 'neon-hands') {
      hourColor = '#00ffcc';
      minuteColor = '#ff00ff';
      hourWidth = 9;
      minuteWidth = 6;
    } else if (this.handsStyle === 'gold-hands') {
      hourColor = '#b7791f';
      minuteColor = '#d69e2e';
      hourWidth = 8;
      minuteWidth = 5;
    }

    // Aiguille des heures
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    ctx.save();
    ctx.rotate(hourAngle);
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
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(0, -this.radius * 0.74);
    ctx.lineWidth = minuteWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = minuteColor;
    ctx.stroke();
    ctx.restore();
  }
}