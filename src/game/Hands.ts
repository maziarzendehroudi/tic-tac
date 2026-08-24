export class Hands {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  public draw(hours: number, minutes: number): void {
    const minuteAngle = (minutes * Math.PI) / 30;
    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;

    this.drawHand(hourAngle, this.radius * 0.5, 10, '#3182ce');
    this.drawHand(minuteAngle, this.radius * 0.75, 6, '#e53e3e');
  }

  private drawHand(angle: number, length: number, width: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    ctx.rotate(angle);

    ctx.moveTo(0, 0);
    ctx.lineTo(0, -length);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -length, width / 2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  }
}