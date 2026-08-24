export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;
  private show24h: boolean;
  private theme: string;

  constructor(ctx: CanvasRenderingContext2D, radius: number, show24h: boolean = false, theme: string = 'classic') {
    this.ctx = ctx;
    this.radius = radius;
    this.show24h = show24h;
    this.theme = theme;
  }

  public setTheme(theme: string): void {
    this.theme = theme;
  }

  public setShow24h(show: boolean): void {
    this.show24h = show;
  }

  public draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

    // Couleurs selon le thème
    let bgColor = '#ffffff';
    let borderColor = '#2b6cb0';
    let numberColor = '#2d3748';

    if (this.theme === 'wood') {
      bgColor = '#fdf6e2';
      borderColor = '#b7791f';
      numberColor = '#744210';
    } else if (this.theme === 'space') {
      bgColor = '#1a202c';
      borderColor = '#805ad5';
      numberColor = '#e2e8f0';
    }

    // Fond du cadran
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Pastille centrale (pivot)
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 2 * Math.PI);
    ctx.fillStyle = borderColor;
    ctx.fill();

    // Graduations et chiffres (1 à 12)
    for (let i = 1; i <= 12; i++) {
      const angle = (i * Math.PI) / 6;
      
      const innerRadius = this.radius - 15;
      const outerRadius = this.radius - 5;
      ctx.beginPath();
      ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
      ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
      ctx.lineWidth = i % 3 === 0 ? 4 : 2;
      ctx.strokeStyle = numberColor;
      ctx.stroke();

      const numRadius = this.radius - 42;
      const x = numRadius * Math.sin(angle);
      const y = -numRadius * Math.cos(angle);
      ctx.font = 'bold 24px "Comic Sans MS", sans-serif';
      ctx.fillStyle = numberColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i.toString(), x, y);
    }

    if (this.show24h) {
      const hours24 = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0];
      for (let i = 0; i < 12; i++) {
        const angle = ((i + 1) * Math.PI) / 6;
        const numRadius = this.radius - 85;
        const x = numRadius * Math.sin(angle);
        const y = -numRadius * Math.cos(angle);
        ctx.font = 'bold 14px "Comic Sans MS", sans-serif';
        ctx.fillStyle = this.theme === 'space' ? '#a0aec0' : '#a0aec0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hours24[i].toString(), x, y);
      }
    }
  }
}