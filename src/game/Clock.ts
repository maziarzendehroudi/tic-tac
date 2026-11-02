export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  public draw(
    level: number = 1,
    isDay: boolean = true
  ): void {
    const ctx = this.ctx;
    const r = this.radius;
    ctx.clearRect(-r - 14, -r - 14, (r + 14) * 2, (r + 14) * 2);

    const outerBezelColor = isDay ? '#0284c7' : '#6366f1';
    const minuteColor = '#0284c7';
    const hourNumberColor = '#0f172a';
    const hour24Color = '#ea580c';

    // 1. Disque blanc principal + Lunette
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = outerBezelColor;
    ctx.stroke();

    // 2. Anneau de la piste des minutes (niveaux 2 à 5)
    const showMinuteTrackBand = level >= 2 && level <= 5;
    if (showMinuteTrackBand) {
      ctx.beginPath();
      ctx.arc(0, 0, r - 4.5, 0, 2 * Math.PI);
      ctx.arc(0, 0, r - 39, 0, 2 * Math.PI, true);
      ctx.fillStyle = '#f0f9ff';
      ctx.fill('evenodd');
    }

    // 3. Repères géométriques pour demi-heures (Niv 2) et quarts d'heure (Niv 3)
    if (level === 2 || level === 3) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -(r - 42));
      ctx.lineTo(0, r - 42);
      ctx.stroke();

      if (level === 3) {
        ctx.beginPath();
        ctx.moveTo(-(r - 42), 0);
        ctx.lineTo(r - 42, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Graduations au bord du cadran
    for (let i = 0; i < 60; i++) {
      const isFiveMark = i % 5 === 0;
      const isQuarterMark = i % 15 === 0;
      if (level === 1 && !isFiveMark) continue;

      const angle = (i * Math.PI) / 30;
      const tickOuter = r - 5;
      const tickInner = isFiveMark ? (level >= 7 && isQuarterMark ? r - 18 : r - 15) : r - 10;

      ctx.beginPath();
      ctx.moveTo(tickInner * Math.sin(angle), -tickInner * Math.cos(angle));
      ctx.lineTo(tickOuter * Math.sin(angle), -tickOuter * Math.cos(angle));
      ctx.lineWidth = isFiveMark ? (level >= 7 && isQuarterMark ? 4 : 3) : 1.4;
      ctx.strokeStyle = isFiveMark ? minuteColor : '#94a3b8';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 5. Repères des minutes en bleu (r - 25, niveaux 2 à 5)
    const minuteLabelRadius = r - 25;
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

    // 6. Chiffres des heures :
    // - Niveaux 1 à 6 : 1 à 12
    // - Niveau 5 uniquement : couronne intérieure orange 13..00 (opacité franche 1.0 sans estompage spoiler)
    // - Niveau 7 : uniquement 12, 3, 6, 9 et des index bâtons horlogers ancrés près de la minuterie
    const hour12Radius = showMinuteTrackBand ? r - 68 : r - 54;
    const hour24Radius = r - 104;

    for (let i = 1; i <= 12; i++) {
      const angle = (i * Math.PI) / 6;

      if (level >= 7 && i % 3 !== 0) {
        const markerOuter = r - 20;
        const markerInner = r - 42;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(markerInner * Math.sin(angle), -markerInner * Math.cos(angle));
        ctx.lineTo(markerOuter * Math.sin(angle), -markerOuter * Math.cos(angle));
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#1e293b';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const hx = hour12Radius * Math.sin(angle);
      const hy = -hour12Radius * Math.cos(angle);

      ctx.save();
      ctx.font = level >= 7 ? '700 32px "Fredoka", sans-serif' : '700 28px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(i.toString(), hx, hy);
      ctx.fillStyle = hourNumberColor;
      ctx.fillText(i.toString(), hx, hy);
      ctx.restore();

      if (level === 5) {
        const h24Text = i === 12 ? '00' : (i + 12).toString();
        const x24 = hour24Radius * Math.sin(angle);
        const y24 = -hour24Radius * Math.cos(angle);

        ctx.save();
        ctx.font = '700 15px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(h24Text, x24, y24);
        ctx.fillStyle = hour24Color;
        ctx.fillText(h24Text, x24, y24);
        ctx.restore();
      }
    }
  }
}
