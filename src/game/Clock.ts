export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Dessine le cadran pédagogique avec :
   * - Échafaudage progressif selon le niveau (1 à 6)
   * - Mise en valeur automatique 1..12 vs 13..00 aux niveaux 5 & 6
   * - Chantier C (highlightHourSector) : Coloration du secteur angulaire [H, H+1] en cas d'erreur
   *   pour visualiser pourquoi la petite aiguille appartient toujours à l'heure H.
   */
  public draw(
    level: number = 1,
    isDay: boolean = true,
    is24HourTarget: boolean = false,
    highlightHourSector?: number
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

    // 2. Chantier C : Affichage du "Territoire de l'Heure" (secteur doré entre H et H+1) en cas d'erreur
    const showMinuteTrackBand = level >= 2 && level <= 5;
    if (typeof highlightHourSector === 'number') {
      const h12 = highlightHourSector % 12;
      const startAngle = (h12 * Math.PI) / 6 - Math.PI / 2;
      const endAngle = ((h12 + 1) * Math.PI) / 6 - Math.PI / 2;
      const sectorRadius = showMinuteTrackBand ? r - 40 : r - 18;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, sectorRadius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.55)';
      ctx.stroke();
      ctx.restore();
    }

    // 3. Anneau de la piste des minutes (niveaux 2 à 5)
    if (showMinuteTrackBand) {
      ctx.beginPath();
      ctx.arc(0, 0, r - 4.5, 0, 2 * Math.PI);
      ctx.arc(0, 0, r - 39, 0, 2 * Math.PI, true);
      ctx.fillStyle = '#f0f9ff';
      ctx.fill('evenodd');
    }

    // 4. Repères géométriques subtils pour les demi-heures (Niv 2) et quarts d'heure (Niv 3)
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

    // 5. Graduations au bord du cadran
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

    // 6. Repères des minutes en bleu (r - 25)
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

    // 7. Chiffres des heures 1 à 12 et heures 24h (13 à 00 aux Niveaux 5 & 6)
    const hour12Radius = showMinuteTrackBand ? r - 66 : r - 52;
    const hour24Radius = showMinuteTrackBand ? r - 102 : r - 92;
    const highlightedH12 = typeof highlightHourSector === 'number' ? (highlightHourSector % 12 || 12) : null;

    for (let i = 1; i <= 12; i++) {
      const angle = (i * Math.PI) / 6;
      const hx = hour12Radius * Math.sin(angle);
      const hy = -hour12Radius * Math.cos(angle);
      const isHighlightedHour = highlightedH12 === i;

      // Halo de mise en évidence sur le chiffre de l'heure active si l'aide anti-piège est déclenchée
      if (isHighlightedHour && (!is24HourTarget || level < 5)) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(hx, hy, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#fef3c7';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ea580c';
        ctx.stroke();
        ctx.restore();
      }

      // A. Heures 1 à 12
      ctx.save();
      ctx.font = '700 29px "Fredoka", sans-serif';
      ctx.fillStyle = isHighlightedHour && (!is24HourTarget || level < 5) ? '#ea580c' : hourNumberColor;
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

        if (isHighlightedHour && is24HourTarget) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x24, y24, 15, 0, 2 * Math.PI);
          ctx.fillStyle = '#fef3c7';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ea580c';
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.font = is24HourTarget ? '700 16px "Fredoka", sans-serif' : '600 14px "Fredoka", sans-serif';
        ctx.fillStyle = hour24Color;
        ctx.globalAlpha = is24HourTarget ? 1 : 0.28;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h24Text, x24, y24);
        ctx.restore();
      }
    }
  }
}
