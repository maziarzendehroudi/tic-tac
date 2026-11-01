export class Clock {
  private ctx: CanvasRenderingContext2D;
  private radius: number;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    this.ctx = ctx;
    this.radius = radius;
  }

  /**
   * Dessine l'horloge pédagogique :
   * 1. Piste extérieure bleue dédiée aux MINUTES (graduations 0..59 + repères bleus 00..55)
   * 2. Cercle principal dédié aux HEURES 1 à 12
   * 3. Cercle intérieur dédié aux HEURES 24H (13 à 23 et 00) aux niveaux 5 et 6
   * 4. Médaillon central Jour (Soleil ☀️) ou Nuit (Lune 🌙)
   */
  public draw(level: number = 1, isDay: boolean = true): void {
    const ctx = this.ctx;
    const r = this.radius;
    ctx.clearRect(-r - 12, -r - 12, (r + 12) * 2, (r + 12) * 2);

    const outerBezelColor = isDay ? '#f59e0b' : '#6366f1';
    const minuteTrackBg = isDay ? '#e0f2fe' : '#dbeafe';
    const dialCenterBg = isDay ? '#ffffff' : '#f8fafc';
    const hourNumberColor = '#0f172a';
    const minuteColor = '#0284c7';
    const hour24Bg = isDay ? '#fff7ed' : '#eef2ff';
    const hour24Border = isDay ? '#fb923c' : '#818cf8';
    const hour24Text = isDay ? '#ea580c' : '#4f46e5';

    // 1. Disque extérieur (Piste des minutes bleutée) + Lunette colorée selon Jour/Nuit
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = minuteTrackBg;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = outerBezelColor;
    ctx.stroke();

    // 2. Disque intérieur blanc (Zone des heures)
    const innerDialRadius = r - 48;
    ctx.beginPath();
    ctx.arc(0, 0, innerDialRadius, 0, 2 * Math.PI);
    ctx.fillStyle = dialCenterBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bae6fd';
    ctx.stroke();

    // 3. Médaillon central Jour (Soleil) / Nuit (Lune & Étoiles)
    this.drawDayNightCenterEmblem(isDay);

    // 4. Lignes de repères de fractions d'heure (Demi-heure au Niv. 2, Quarts au Niv. 3)
    if (level === 2 || level === 3) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.28)';
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.moveTo(0, -innerDialRadius);
      ctx.lineTo(0, innerDialRadius);
      ctx.stroke();

      if (level === 3) {
        ctx.beginPath();
        ctx.moveTo(-innerDialRadius, 0);
        ctx.lineTo(innerDialRadius, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. GRADUATIONS DES MINUTES SUR LE BORD EXTÉRIEUR (60 graduations dès le Niveau 2)
    for (let i = 0; i < 60; i++) {
      const isFiveMark = i % 5 === 0;
      if (level === 1 && !isFiveMark) continue;

      const angle = (i * Math.PI) / 30;
      const tickOuter = r - 5;
      const tickInner = isFiveMark ? r - 17 : r - 11;

      ctx.beginPath();
      ctx.moveTo(tickInner * Math.sin(angle), -tickInner * Math.cos(angle));
      ctx.lineTo(tickOuter * Math.sin(angle), -tickOuter * Math.cos(angle));
      ctx.lineWidth = isFiveMark ? 3 : 1.3;
      ctx.strokeStyle = isFiveMark ? minuteColor : '#64748b';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 6. NOMBRES DES MINUTES SUR LA PISTE EXTÉRIEURE BLEUE (r - 31)
    const minuteLabelRadius = r - 31;
    let minutesToDisplay: number[] = [];
    if (level === 1) minutesToDisplay = [0];
    else if (level === 2) minutesToDisplay = [0, 30];
    else if (level === 3) minutesToDisplay = [0, 15, 30, 45];
    else if (level === 4 || level === 5) {
      minutesToDisplay = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    }
    // Au Niveau 6 (Expert), on laisse uniquement les 60 graduations pour que l'enfant compte lui-même

    minutesToDisplay.forEach(min => {
      const angle = (min * Math.PI) / 30;
      const mx = minuteLabelRadius * Math.sin(angle);
      const my = -minuteLabelRadius * Math.cos(angle);
      const label = min < 10 ? `0${min}` : `${min}`;

      ctx.font = 'bold 14px "Fredoka", sans-serif';
      ctx.fillStyle = minuteColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
    });

    // 7. CHIFFRES DES HEURES 1 À 12 (Cercle principal : r - 72) & HEURES 24H 13 À 00 (Cercle intérieur : r - 114)
    const hour12Radius = r - 72;
    const hour24Radius = r - 114;

    if (level >= 5) {
      // Cercle pointillé subtil reliant les pastilles 24h
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, hour24Radius, 0, 2 * Math.PI);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = hour24Border;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 1; i <= 12; i++) {
      const angle = (i * Math.PI) / 6;

      // A. Chiffre principal de l'heure (1 à 12)
      const hx = hour12Radius * Math.sin(angle);
      const hy = -hour12Radius * Math.cos(angle);

      ctx.font = 'bold 28px "Fredoka", sans-serif';
      ctx.fillStyle = hourNumberColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i.toString(), hx, hy);

      // B. Pastille intérieure 24h (13 à 23 et 00) aux Niveaux 5 et 6
      if (level >= 5) {
        const h24Text = i === 12 ? '00' : (i + 12).toString();
        const x24 = hour24Radius * Math.sin(angle);
        const y24 = -hour24Radius * Math.cos(angle);

        ctx.beginPath();
        ctx.arc(x24, y24, 13.5, 0, 2 * Math.PI);
        ctx.fillStyle = hour24Bg;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = hour24Border;
        ctx.stroke();

        ctx.font = 'bold 13px "Fredoka", sans-serif';
        ctx.fillStyle = hour24Text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h24Text, x24, y24);
      }
    }
  }

  /**
   * Dessine un médaillon doux Soleil (Jour) ou Lune/Étoiles (Nuit) au cœur du cadran
   */
  private drawDayNightCenterEmblem(isDay: boolean): void {
    const ctx = this.ctx;
    ctx.save();

    if (isDay) {
      // Halo solaire très doux au centre
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
      ctx.fill();

      // Rayons du soleil
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
        ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
      ctx.fill();
    } else {
      // Halo nocturne doux au centre
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(224, 231, 255, 0.5)';
      ctx.fill();

      // Croissant de lune doux
      ctx.beginPath();
      ctx.arc(-4, -2, 18, 0.4, Math.PI * 2 - 0.4);
      ctx.arc(4, -6, 15, Math.PI * 2 - 0.6, 0.6, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
      ctx.fill();

      // Petites étoiles
      const stars = [
        [20, -16],
        [-22, 18],
        [18, 20]
      ];
      ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
      stars.forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    ctx.restore();
  }
}
