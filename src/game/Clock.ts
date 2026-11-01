export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Dessine le cadran avec un échafaudage visuel adapté à chaque niveau (1 à 6)
   * et une mise en évidence intelligente du cercle 1..12 (Matin) vs 13..00 (Après-midi/Soir/Minuit).
   */
  public draw(level: number = 1, isDay: boolean = true, is24HourTarget: boolean = false): void {
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

    // 2. Anneau de la piste des minutes (uniquement aux niveaux 2 à 5 où les repères bleus sont affichés)
    const showMinuteTrackBand = level >= 2 && level <= 5;
    if (showMinuteTrackBand) {
      ctx.beginPath();
      ctx.arc(0, 0, r - 4.5, 0, 2 * Math.PI);
      ctx.arc(0, 0, r - 39, 0, 2 * Math.PI, true);
      ctx.fillStyle = '#f0f9ff';
      ctx.fill('evenodd');
    }

    // 3. Repères géométriques subtils pour les demi-heures (Niv 2) et quarts d'heure (Niv 3)
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
      if (level === 1 && !isFiveMark) continue;

      const angle = (i * Math.PI) / 30;
      const tickOuter = r - 5;
      const tickInner = isFiveMark ? r - 15 : r - 10;

      ctx.beginPath();
      ctx.moveTo(tickInner * Math.sin(angle), -tickInner * Math.cos(angle));
      ctx.lineTo(tickOuter * Math.sin(angle), -tickOuter * Math.cos(angle));
      ctx.lineWidth = isFiveMark ? 3 : 1.4;
      ctx.strokeStyle = isFiveMark ? minuteColor : '#94a3b8';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 5. Repères des minutes en bleu (r - 25)
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

    // 6. Chiffres des heures 1 à 12 et heures 24h (13 à 00 aux Niveaux 5 & 6)
    const hour12Radius = showMinuteTrackBand ? r - 66 : r - 52;
    const hour24Radius = showMinuteTrackBand ? r - 102 : r - 92;

    for (let i = 1; i <= 12; i++) {
      const angle = (i * Math.PI) / 6;

      // A. Heures 1 à 12
      const hx = hour12Radius * Math.sin(angle);
      const hy = -hour12Radius * Math.cos(angle);

      ctx.save();
      ctx.font = '700 29px "Fredoka", sans-serif';
      ctx.fillStyle = hourNumberColor;
      // En Niv 5-6, si l'heure cible est >= 13h ou 00h, on adoucit légèrement 1..12 pour guider l'œil vers 13..00
      ctx.globalAlpha = level >= 5 && is24HourTarget ? 0.45 : 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i.toString(), hx, hy);
      ctx.restore();

      // B. Heures 24h (13 à 23 et 00) aux Niveaux 5 et 6
      if (level >= 5) {
        const h24Text = i === 12 ? '00' : (i + 12).toString();
        const x24 = hour24Radius * Math.sin(angle);
        const y24 = -hour24Radius * Math.cos(angle);

        ctx.save();
        ctx.font = is24HourTarget ? '700 16px "Fredoka", sans-serif' : '600 14px "Fredoka", sans-serif';
        ctx.fillStyle = hour24Color;
        // Si c'est le matin (01h..12h), on estompe 13..00 pour éviter la confusion 08h42 vs 20h42 !
        ctx.globalAlpha = is24HourTarget ? 1 : 0.28;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h24Text, x24, y24);
        ctx.restore();
      }
    }
  }
}
