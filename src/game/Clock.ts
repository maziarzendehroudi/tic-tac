export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;
  private theme: string;

  constructor(ctx: CanvasRenderingContext2D, radius: number, theme: string = 'classic') {
    this.ctx = ctx;
    this.radius = radius;
    this.theme = theme;
  }

  public setTheme(theme: string): void {
    this.theme = theme;
  }

  public draw(level: number = 1): void {
    const ctx = this.ctx;
    ctx.clearRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

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
    } else if (this.theme === 'forest') {
      bgColor = '#f0fff4';
      borderColor = '#276749';
      numberColor = '#22543d';
    } else if (this.theme === 'ocean') {
      bgColor = '#ebf8ff';
      borderColor = '#2b6cb0';
      numberColor = '#2c5282';
    }

    // Fond du cadran
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Pastille centrale (pivot)
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, 2 * Math.PI);
    ctx.fillStyle = borderColor;
    ctx.fill();

    // --- GRADUATIONS SELON LE NIVEAU ---
    if (level === 2) {
      // Niveau 2 : Seulement les graduations des demi-heures (0 et 30 min)
      [0, 30].forEach(min => {
        const angle = (min * Math.PI) / 30;
        const innerRadius = this.radius - 14;
        const outerRadius = this.radius - 4;
        ctx.beginPath();
        ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
        ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
        ctx.lineWidth = 3;
        ctx.strokeStyle = numberColor;
        ctx.stroke();
      });
    } else if (level === 3) {
      // Niveau 3 : Seulement les graduations des quarts d'heure (0, 15, 30, 45)
      [0, 15, 30, 45].forEach(min => {
        const angle = (min * Math.PI) / 30;
        const innerRadius = this.radius - 14;
        const outerRadius = this.radius - 4;
        ctx.beginPath();
        ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
        ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
        ctx.lineWidth = 3;
        ctx.strokeStyle = numberColor;
        ctx.stroke();
      });
    } else if (level === 4 || level === 5) {
      // Niveaux 4 & 5 : Graduations de toutes les minutes
      for (let i = 0; i < 60; i++) {
        const angle = (i * Math.PI) / 30;
        const isHourMark = i % 5 === 0;
        
        const innerRadius = this.radius - (isHourMark ? 14 : 8);
        const outerRadius = this.radius - 4;

        ctx.beginPath();
        ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
        ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
        ctx.lineWidth = isHourMark ? 2.5 : 1;
        ctx.strokeStyle = isHourMark ? numberColor : '#94a3b8';
        ctx.stroke();
      }
    }
    // Niveau 1 et Niveau 6 : Aucune graduation de minutes

    // --- CHIFFRES DES HEURES SELON LE NIVEAU ---
    if (level === 6) {
      // Niveau 6 : Horloge épurée avec seulement 12, 3, 6 et 9
      const hoursToShow = [12, 3, 6, 9];
      hoursToShow.forEach(h => {
        const angle = (h * Math.PI) / 6;
        const numRadius = this.radius - 42;
        const x = numRadius * Math.sin(angle);
        const y = -numRadius * Math.cos(angle);

        ctx.font = 'bold 36px "Fredoka", sans-serif';
        ctx.fillStyle = numberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.toString(), x, y);
      });
    } else if (level === 5) {
      // Niveau 5 : Heures de 1 à 12 (intérieur) et 13 à 00 (extérieur)
      for (let i = 1; i <= 12; i++) {
        const angle = (i * Math.PI) / 6;

        const numRadius = this.radius - 52;
        const x = numRadius * Math.sin(angle);
        const y = -numRadius * Math.cos(angle);
        
        ctx.font = 'bold 24px "Fredoka", sans-serif';
        ctx.fillStyle = numberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), x, y);

        const hour24 = i === 12 ? '00' : (i + 12).toString();
        const outRadius = this.radius - 24;
        const outX = outRadius * Math.sin(angle);
        const outY = -outRadius * Math.cos(angle);

        ctx.font = '600 15px "Fredoka", sans-serif';
        ctx.fillStyle = '#4f46e5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hour24, outX, outY);
      }
    } else {
      // Niveaux 1 à 4 : Chiffres classiques de 1 à 12
      for (let i = 1; i <= 12; i++) {
        const angle = (i * Math.PI) / 6;

        const numRadius = this.radius - 42;
        const x = numRadius * Math.sin(angle);
        const y = -numRadius * Math.cos(angle);
        
        ctx.font = 'bold 34px "Fredoka", sans-serif';
        ctx.fillStyle = numberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), x, y);
      }
    }
  }
}