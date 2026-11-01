export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Cadran épuré haute lisibilité :
   * - Fond blanc uni (sans cercle central ni petits points parasites)
   * - Couronne extérieure : graduations + minutes en bleu (00 à 55)
   * - Couronne principale : heures 1 à 12
   * - Couronne intérieure (Niv. 5 & 6) : heures 13 à 23 et 00 épurées (sans bulles ni pointillés)
   */
  public draw(level: number = 1, isDay: boolean = true): void {
    const ctx = this.ctx;
    const r = this.radius;
    ctx.clearRect(-r - 12, -r - 12, (r + 12) * 2, (r + 12) * 2);

    const outerBezelColor = isDay ? '#0284c7' : '#4f46e5';
    const hourNumberColor = '#0f172a';
    const minuteColor = '#0284c7';
    const hour24Color = '#ea580c';

    // 1. Disque blanc uni
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = outerBezelColor;
    ctx.stroke();

    // 2. Graduations au bord du cadran
    for (let i = 0; i < 60; i++) {
      const isFiveMark = i % 5 === 0;
      if (level === 1 && !isFiveMark) continue;

      const angle = (i * Math.PI) / 30;
      const tickOuter = r - 5;
      const tickInner = isFiveMark ? r - 15 : r - 10;

      ctx.beginPath();
      ctx.moveTo(tickInner * Math.sin(angle), -tickInner * Math.cos(angle));
      ctx.lineTo(tickOuter * Math.sin(angle), -tickOuter * Math.cos(angle));
      ctx.lineWidth = isFiveMark ? 2.8 : 1.2;
      ctx.strokeStyle = isFiveMark ? minuteColor : '#cbd5e1';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 3. Repères des minutes en bleu (r - 27)
    const minuteLabelRadius = r - 27;
    let minutesToDisplay: number[] = [];
    if (level === 2) minutesToDisplay = [0, 30];
    else if (level === 3) minutesToDisplay = [0, 15, 30, 45];
    else if (level === 4 || level === 5) {
      minutesToDisplay = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    }

    minutesToDisplay.forEach(min => {
      const angle = (min * Math.PI) / 30;
      const mx = minuteLabelRadius * Math.sin(angle);
      const my = -minuteLabelRadius * Math.cos(angle);
      const label = min < 10 ? `0${min}` : `${min}`;

      ctx.font = 'bold 13px "Fredoka", sans-serif';
      ctx.fillStyle = minuteColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
    });

    // 4. Chiffres des heures 1 à 12 (r - 60) et heures 24h 13 à 00 (r - 98)
    const hour12Radius = level >= 2 && level <= 5 ? r - 60 : r - 46;
    const hour24Radius = r - 98;

    for (let i = 1; i <= 12; i++) {
      const angle = (i * Math.PI) / 6;

      // A. Heures 1 à 12
      const hx = hour12Radius * Math.sin(angle);
      const hy = -hour12Radius * Math.cos(angle);

      ctx.font = 'bold 28px "Fredoka", sans-serif';
      ctx.fillStyle = hourNumberColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i.toString(), hx, hy);

      // B. Heures 24h (13 à 23 et 00) aux Niveaux 5 et 6 : texte simple, sans cercle ni pointillés
      if (level >= 5) {
        const h24Text = i === 12 ? '00' : (i + 12).toString();
        const x24 = hour24Radius * Math.sin(angle);
        const y24 = -hour24Radius * Math.cos(angle);

        ctx.font = 'bold 15px "Fredoka", sans-serif';
        ctx.fillStyle = hour24Color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h24Text, x24, y24);
      }
    }
  }
}
