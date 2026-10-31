export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  public draw(level: number = 1): void {
    const ctx = this.ctx;
    ctx.clearRect(-this.radius - 12, -this.radius - 12, (this.radius + 12) * 2, (this.radius + 12) * 2);

    const bgColor = '#ffffff';
    const borderColor = '#d97706';
    const hourNumberColor = '#0f172a';
    const minuteGuideColor = '#0284c7';
    const hour24Color = '#ea580c';

    // 1. Cercle extérieur du cadran (Lunette horlogère haute lisibilité)
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // 2. Aides visuelles géométriques (Demi-heure au Niv. 2, Quarts d'heure au Niv. 3)
    if (level === 2 || level === 3) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.22)';
      ctx.lineWidth = 2;

      // Axe vertical :00 <-> :30
      ctx.beginPath();
      ctx.moveTo(0, -(this.radius - 34));
      ctx.lineTo(0, this.radius - 34);
      ctx.stroke();

      if (level === 3) {
        // Axe horizontal :45 <-> :15
        ctx.beginPath();
        ctx.moveTo(-(this.radius - 34), 0);
        ctx.lineTo(this.radius - 34, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. GRADUATIONS SELON LE NIVEAU (Incluant désormais le Niveau 6 !)
    if (level === 1) {
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo((this.radius - 14) * Math.sin(angle), -(this.radius - 14) * Math.cos(angle));
        ctx.lineTo((this.radius - 5) * Math.sin(angle), -(this.radius - 5) * Math.cos(angle));
        ctx.lineWidth = 3;
        ctx.strokeStyle = hourNumberColor;
        ctx.stroke();
      }
    } else if (level === 2 || level === 3) {
      const highlightedMins = level === 2 ? [0, 30] : [0, 15, 30, 45];
      for (let i = 0; i < 12; i++) {
        const min = i * 5;
        const angle = (min * Math.PI) / 30;
        const isKeyQuarter = highlightedMins.includes(min);
        ctx.beginPath();
        ctx.moveTo((this.radius - (isKeyQuarter ? 16 : 11)) * Math.sin(angle), -(this.radius - (isKeyQuarter ? 16 : 11)) * Math.cos(angle));
        ctx.lineTo((this.radius - 5) * Math.sin(angle), -(this.radius - 5) * Math.cos(angle));
        ctx.lineWidth = isKeyQuarter ? 3.5 : 2;
        ctx.strokeStyle = isKeyQuarter ? minuteGuideColor : '#cbd5e1';
        ctx.stroke();
      }

      // Repères bleus explicites (:00, :30 au Niv. 2 | :00, :15, :30, :45 au Niv. 3)
      highlightedMins.forEach(min => {
        const angle = (min * Math.PI) / 30;
        const badgeR = this.radius - 26;
        const bx = badgeR * Math.sin(angle);
        const by = -badgeR * Math.cos(angle);

        ctx.font = 'bold 13px "Fredoka", sans-serif';
        ctx.fillStyle = minuteGuideColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(min === 0 ? ':00' : `:${min}`, bx, by);
      });
    } else if (level >= 4) {
      // Niveaux 4, 5 et 6 : les 60 graduations de minutes sont indispensables !
      for (let i = 0; i < 60; i++) {
        const angle = (i * Math.PI) / 30;
        const isFiveMark = i % 5 === 0;

        const innerRadius = this.radius - (isFiveMark ? 15 : 9);
        const outerRadius = this.radius - 4;

        ctx.beginPath();
        ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
        ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
        ctx.lineWidth = isFiveMark ? 2.8 : 1.2;
        ctx.strokeStyle = isFiveMark ? hourNumberColor : '#94a3b8';
        ctx.stroke();
      }
    }

    // 4. CHIFFRES DES HEURES & COURONNES PÉDAGOGIQUES (Table de 5 au Niv. 4, 24h au Niv. 5)
    if (level === 6) {
      // Niveau 6 Expert : uniquement 12, 3, 6, 9 + les 60 graduations de minutes
      const hoursToShow = [12, 3, 6, 9];
      hoursToShow.forEach(h => {
        const angle = (h * Math.PI) / 6;
        const numRadius = this.radius - 38;
        ctx.font = 'bold 34px "Fredoka", sans-serif';
        ctx.fillStyle = hourNumberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.toString(), numRadius * Math.sin(angle), -numRadius * Math.cos(angle));
      });
    } else if (level === 4 || level === 5) {
      for (let i = 1; i <= 12; i++) {
        const angle = (i * Math.PI) / 6;

        // Cercle intérieur : heures 1 à 12
        const numRadius = this.radius - 54;
        ctx.font = 'bold 25px "Fredoka", sans-serif';
        ctx.fillStyle = hourNumberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), numRadius * Math.sin(angle), -numRadius * Math.cos(angle));

        // Cercle extérieur : Table de 5 bleue au Niveau 4 (05..55, 00) | Heures 24h orange au Niveau 5 (13..23, 00)
        const outRadius = this.radius - 26;
        const outX = outRadius * Math.sin(angle);
        const outY = -outRadius * Math.cos(angle);

        if (level === 4) {
          const minVal = (i * 5) % 60;
          const minText = minVal < 10 ? `0${minVal}` : `${minVal}`;
          ctx.font = 'bold 14px "Fredoka", sans-serif';
          ctx.fillStyle = minuteGuideColor;
          ctx.fillText(minText, outX, outY);
        } else {
          const hour24 = i === 12 ? '00' : (i + 12).toString();
          ctx.font = 'bold 15px "Fredoka", sans-serif';
          ctx.fillStyle = hour24Color;
          ctx.fillText(hour24, outX, outY);
        }
      }
    } else {
      // Niveaux 1, 2, 3 : Grands chiffres 1 à 12
      const numRadius = level === 1 ? this.radius - 38 : this.radius - 48;
      for (let i = 1; i <= 12; i++) {
        const angle = (i * Math.PI) / 6;
        ctx.font = 'bold 31px "Fredoka", sans-serif';
        ctx.fillStyle = hourNumberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), numRadius * Math.sin(angle), -numRadius * Math.cos(angle));
      }
    }
  }
}
