export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Étagement radial anti-chevauchement (pour r = 236 px) :
   * - Bord & graduations : r - 4 à r - 14
   * - Couronne bleue des minutes (00..55) : r - 26 (210 px)
   * - Pointe de la grande aiguille bleue : r - 44 (192 px -> espace libre !)
   * - Chiffres des heures (1..12) : r - 68 (168 px)
   * - Chiffres 24h (13..00, Niv 5-6) : r - 104 (132 px)
   * - Pointe de la petite aiguille orange : r - 124 (112 px -> espace libre !)
   */
  public draw(level: number = 1, isDay: boolean = true): void {
    const ctx = this.ctx;
    const r = this.radius;
    ctx.clearRect(-r - 14, -r - 14, (r + 14) * 2, (r + 14) * 2);

    const outerBezelColor = isDay ? '#0284c7' : '#6366f1';
    const hourNumberColor = '#0f172a';
    const minuteColor = '#0284c7';
    const hour24Color = '#ea580c';

    // 1. Ombre douce interne et disque blanc pur
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = outerBezelColor;
    ctx.stroke();

    // 2. Anneau subtil de la piste des minutes sur le pourtour
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, 2 * Math.PI);
    ctx.arc(0, 0, r - 40, 0, 2 * Math.PI, true);
    ctx.fillStyle = '#f0f9ff';
    ctx.fill('evenodd');

    // 3. Graduations au bord du cadran
    for (let i = 0; i < 60; i++) {
      const isFiveMark = i % 5 === 0;
      if (level === 1 && !isFiveMark) continue;

      const angle = (i * Math.PI) / 30;
      const tickOuter = r - 5;
      const tickInner = isFiveMark ? r - 14 : r - 10;

      ctx.beginPath();
      ctx.moveTo(tickInner * Math.sin(angle), -tickInner * Math.cos(angle));
      ctx.lineTo(tickOuter * Math.sin(angle), -tickOuter * Math.cos(angle));
      ctx.lineWidth = isFiveMark ? 2.8 : 1.3;
      ctx.strokeStyle = isFiveMark ? minuteColor : '#94a3b8';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 4. Repères des minutes en bleu dans la piste extérieure (r - 26)
    const minuteLabelRadius = r - 26;
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

      ctx.font = '700 13px "Fredoka", sans-serif';
      ctx.fillStyle = minuteColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
    });

    // 5. Chiffres des heures 1 à 12 (r - 68) et heures 24h 13 à 00 (r - 104)
    const hour12Radius = r - 68;
    const hour24Radius = r - 104;

    for (let i = 1; i <= 12; i++) {
      const angle = (i * Math.PI) / 6;

      // A. Heures 1 à 12
      const hx = hour12Radius * Math.sin(angle);
      const hy = -hour12Radius * Math.cos(angle);

      ctx.font = '700 28px "Fredoka", sans-serif';
      ctx.fillStyle = hourNumberColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i.toString(), hx, hy);

      // B. Heures 24h (13 à 23 et 00) aux Niveaux 5 et 6
      if (level >= 5) {
        const h24Text = i === 12 ? '00' : (i + 12).toString();
        const x24 = hour24Radius * Math.sin(angle);
        const y24 = -hour24Radius * Math.cos(angle);

        ctx.font = '700 15px "Fredoka", sans-serif';
        ctx.fillStyle = hour24Color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h24Text, x24, y24);
      }
    }
  }
}
