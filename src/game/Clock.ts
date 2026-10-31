import type { DialTheme } from './SaveManager';

export interface ThemePalette {
  bgColor: string;
  borderColor: string;
  numberColor: string;
  subTickColor: string;
  hour24Color: string;
}

export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;
  private theme: DialTheme;

  constructor(ctx: CanvasRenderingContext2D, radius: number, theme: DialTheme = 'classic') {
    this.ctx = ctx;
    this.radius = radius;
    this.theme = theme;
  }

  public setTheme(theme: DialTheme): void {
    this.theme = theme;
  }

  public getTheme(): DialTheme {
    return this.theme;
  }

  public static getPalette(theme: DialTheme): ThemePalette {
    switch (theme) {
      case 'wood':
        return {
          bgColor: '#fdf6e2',
          borderColor: '#b7791f',
          numberColor: '#744210',
          subTickColor: '#bfa07a',
          hour24Color: '#c05621'
        };
      case 'space':
        return {
          bgColor: '#0f172a',
          borderColor: '#8b5cf6',
          numberColor: '#f8fafc',
          subTickColor: '#475569',
          hour24Color: '#38bdf8'
        };
      case 'forest':
        return {
          bgColor: '#f0fdf4',
          borderColor: '#15803d',
          numberColor: '#14532d',
          subTickColor: '#86efac',
          hour24Color: '#b45309'
        };
      case 'ocean':
        return {
          bgColor: '#f0f9ff',
          borderColor: '#0284c7',
          numberColor: '#0c4a6e',
          subTickColor: '#7dd3fc',
          hour24Color: '#0369a1'
        };
      case 'classic':
      default:
        return {
          bgColor: '#ffffff',
          borderColor: '#b45309',
          numberColor: '#0f172a',
          subTickColor: '#94a3b8',
          hour24Color: '#d97706'
        };
    }
  }

  public draw(level: number = 1): void {
    const ctx = this.ctx;
    ctx.clearRect(-this.radius - 10, -this.radius - 10, (this.radius + 10) * 2, (this.radius + 10) * 2);

    const palette = Clock.getPalette(this.theme);

    // Cercle extérieur (Lunette / Bezel)
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
    ctx.fillStyle = palette.bgColor;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = palette.borderColor;
    ctx.stroke();

    // --- GRADUATIONS SELON LE NIVEAU ---
    if (level === 2) {
      [0, 30].forEach(min => {
        const angle = (min * Math.PI) / 30;
        const innerRadius = this.radius - 14;
        const outerRadius = this.radius - 4;
        ctx.beginPath();
        ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
        ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
        ctx.lineWidth = 3;
        ctx.strokeStyle = palette.numberColor;
        ctx.stroke();
      });
    } else if (level === 3) {
      [0, 15, 30, 45].forEach(min => {
        const angle = (min * Math.PI) / 30;
        const innerRadius = this.radius - 14;
        const outerRadius = this.radius - 4;
        ctx.beginPath();
        ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
        ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
        ctx.lineWidth = 3;
        ctx.strokeStyle = palette.numberColor;
        ctx.stroke();
      });
    } else if (level === 4 || level === 5) {
      for (let i = 0; i < 60; i++) {
        const angle = (i * Math.PI) / 30;
        const isHourMark = i % 5 === 0;

        const innerRadius = this.radius - (isHourMark ? 14 : 8);
        const outerRadius = this.radius - 4;

        ctx.beginPath();
        ctx.moveTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
        ctx.lineTo(outerRadius * Math.sin(angle), -outerRadius * Math.cos(angle));
        ctx.lineWidth = isHourMark ? 2.5 : 1;
        ctx.strokeStyle = isHourMark ? palette.numberColor : palette.subTickColor;
        ctx.stroke();
      }
    }

    // --- CHIFFRES DES HEURES ---
    if (level === 6) {
      const hoursToShow = [12, 3, 6, 9];
      hoursToShow.forEach(h => {
        const angle = (h * Math.PI) / 6;
        const numRadius = this.radius - 42;
        const x = numRadius * Math.sin(angle);
        const y = -numRadius * Math.cos(angle);

        ctx.font = 'bold 36px "Fredoka", sans-serif';
        ctx.fillStyle = palette.numberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.toString(), x, y);
      });
    } else if (level === 5) {
      for (let i = 1; i <= 12; i++) {
        const angle = (i * Math.PI) / 6;

        const numRadius = this.radius - 52;
        const x = numRadius * Math.sin(angle);
        const y = -numRadius * Math.cos(angle);

        ctx.font = 'bold 24px "Fredoka", sans-serif';
        ctx.fillStyle = palette.numberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), x, y);

        const hour24 = i === 12 ? '00' : (i + 12).toString();
        const outRadius = this.radius - 24;
        const outX = outRadius * Math.sin(angle);
        const outY = -outRadius * Math.cos(angle);

        ctx.font = '600 15px "Fredoka", sans-serif';
        ctx.fillStyle = palette.hour24Color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hour24, outX, outY);
      }
    } else {
      for (let i = 1; i <= 12; i++) {
        const angle = (i * Math.PI) / 6;
        const numRadius = this.radius - 42;
        const x = numRadius * Math.sin(angle);
        const y = -numRadius * Math.cos(angle);

        ctx.font = 'bold 34px "Fredoka", sans-serif';
        ctx.fillStyle = palette.numberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), x, y);
      }
    }
  }
}
