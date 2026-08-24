export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  public power: number = 0; // Énergie (0 à 100)
  public timeOffset: number = 0; // Rotation des aiguilles
  public showDial: boolean = true; // Affichage du cadran
  
  // Angles des différents engrenages (liés cinématiquement)
  private angleCenter: number = 0;
  private angleBarrel: number = 0;
  private angleThird: number = 0;
  private angleEscape: number = 0;
  private angleBalance: number = 0;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  public update(deltaTime: number, placedParts: string[], isWinding: boolean): void {
    // Si on remonte la molette, l'énergie augmente
    if (isWinding) {
      this.power = Math.min(100, this.power + deltaTime * 0.05);
      // Remonter fait tourner le barillet dans le sens de la charge
      this.angleBarrel -= deltaTime * 0.002; 
    }

    const canRun = placedParts.includes('spring') &&
                   placedParts.includes('gears') &&
                   placedParts.includes('escapement') &&
                   placedParts.includes('balance');

    if (canRun && this.power > 0 && !isWinding) {
      // Décharge du ressort (environ 30s d'autonomie à 100%)
      this.power = Math.max(0, this.power - deltaTime * 0.003); 
      
      // Le mécanisme tourne. La vitesse de base est dictée par l'échappement.
      const speed = 0.002;
      this.angleEscape += speed * 5;
      this.angleThird = -this.angleEscape * (15 / 20); // Ratio Roue d'échappement (R=15) / Roue moyenne (R=20)
      this.angleCenter = -this.angleThird * (20 / 15); // Ratio Roue moyenne / Roue de centre
      this.angleBarrel = -this.angleCenter * (15 / 35); // Ratio Roue centre / Barillet
      
      this.angleBalance = Math.sin(performance.now() * 0.015) * 1.5; // Oscillation rapide
      this.timeOffset = this.angleCenter;
    }
  }

  public draw(placedParts: string[], unlockedParts: string[]): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    // 1. Platine de base
    this.drawBasePlate();

    // 2. Barillet (Ressort) - Centre: (-35, -35), Rayon: 35
    this.drawPart('spring', placedParts, unlockedParts, -35, -35, () => {
      this.drawBarrel(-35, -35, 35, 24, this.angleBarrel, this.power);
    });

    // 3. Train de rouage
    this.drawPart('gears', placedParts, unlockedParts, 12, 12, () => {
      // Roue de centre - Centre: (0, 0), Rayon: 15 (S'engrène avec le Barillet)
      this.drawGear(0, 0, 15, 10, this.angleCenter, '#eab308'); 
      // Roue moyenne - Centre: (25, 25), Rayon: 20 (S'engrène avec Roue Centre)
      this.drawGear(25, 25, 20, 14, this.angleThird, '#d97706'); 
    });

    // 4. Échappement
    this.drawPart('escapement', placedParts, unlockedParts, 0, 50, () => {
      // Roue d'échappement - Centre: (0, 50), Rayon: 15 (S'engrène avec Roue moyenne)
      this.drawEscapeWheel(0, 50, 15, 12, this.angleEscape, '#94a3b8');
      // Ancre
      const palletAngle = Math.sin(performance.now() * 0.015 - Math.PI/4) * 0.2;
      this.drawPalletFork(-15, 60, palletAngle);
    });

    // 5. Balancier-Spiral
    this.drawPart('balance', placedParts, unlockedParts, -35, 55, () => {
      this.drawBalanceWheel(-35, 55, 22, this.angleBalance);
    });

    // 6. Cadran & Aiguilles (Directement sur l'axe central (0,0))
    this.drawPart('hands', placedParts, unlockedParts, 0, 0, () => {
      this.drawDialAndHands(0, 0, 100, this.timeOffset);
    });

    this.ctx.restore();
  }

  // --- Moteur de rendu des pièces ---

  private drawPart(id: string, placed: string[], unlocked: string[], x: number, y: number, drawFunc: () => void) {
    if (placed.includes(id)) {
      this.ctx.globalAlpha = 1;
      drawFunc();
    } else {
      this.ctx.globalAlpha = unlocked.includes(id) ? 0.3 : 0.1;
      this.ctx.filter = 'grayscale(100%)';
      drawFunc();
      this.ctx.filter = 'none';
      this.ctx.globalAlpha = 1;

      this.ctx.beginPath();
      this.ctx.arc(x, y, 15, 0, Math.PI * 2);
      this.ctx.setLineDash([4, 4]);
      this.ctx.strokeStyle = '#64748b';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawBasePlate() {
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 115, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    // Rubis (Axe de rotation exact des engrenages)
    const rubies = [[-35, -35], [0, 0], [25, 25], [0, 50], [-35, 55], [-15, 60]];
    rubies.forEach(([rx, ry]) => {
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
    });
  }

  private drawBarrel(x: number, y: number, r: number, teeth: number, angle: number, power: number) {
    // Engrenage extérieur du barillet
    this.drawGear(x, y, r, teeth, angle, '#b45309');

    this.ctx.save();
    this.ctx.translate(x, y);
    
    // Intérieur creusé
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fill();

    // Compression du ressort spirale !
    this.ctx.beginPath();
    const minTurns = 3;
    const maxTurns = 8;
    const turns = minTurns + (power / 100) * (maxTurns - minTurns);
    const tightness = power / 100;

    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const theta = t * Math.PI * 2 * turns;
      
      const maxR = r * 0.8;
      const minR = 4;
      // Formule mathématique pour compresser les spires vers le centre quand power augmente
      const actualR = minR + (maxR - minR) * Math.pow(t, 1 + tightness * 1.5);
      
      if (i === 0) this.ctx.moveTo(0, 0);
      else this.ctx.lineTo(Math.cos(theta) * actualR, Math.sin(theta) * actualR);
    }
    this.ctx.strokeStyle = '#94a3b8'; // Acier du ressort
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private drawGear(x: number, y: number, r: number, teeth: number, angle: number, color: string) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    
    this.ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const rInner = r * 0.85;
      this.ctx.lineTo(Math.cos(a - 0.1) * rInner, Math.sin(a - 0.1) * rInner);
      this.ctx.lineTo(Math.cos(a - 0.04) * r, Math.sin(a - 0.04) * r);
      this.ctx.lineTo(Math.cos(a + 0.04) * r, Math.sin(a + 0.04) * r);
      this.ctx.lineTo(Math.cos(a + 0.1) * rInner, Math.sin(a + 0.1) * rInner);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#451a03';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Trous d'allègement
    this.ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.arc(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5), r * 0.25, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();
  }

  private drawEscapeWheel(x: number, y: number, r: number, teeth: number, angle: number, color: string) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      this.ctx.lineTo(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5));
      this.ctx.lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r); // Dents asymétriques
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawPalletFork(x: number, y: number, angle: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(-8, -12);
    this.ctx.lineTo(8, -12);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(0, 15);
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.fill();
    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Palettes rubis
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fillRect(-10, -14, 4, 4);
    this.ctx.fillRect(6, -14, 4, 4);
    this.ctx.restore();
  }

  private drawBalanceWheel(x: number, y: number, r: number, angle: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Roue
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#d97706';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(-r, 0); this.ctx.lineTo(r, 0);
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Cheveu (Spiral du balancier)
    this.ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const theta = (i / 80) * Math.PI * 2 * 3;
      const sr = (i / 80) * (r * 0.6);
      if (i === 0) this.ctx.moveTo(0, 0);
      else this.ctx.lineTo(Math.cos(theta) * sr, Math.sin(theta) * sr);
    }
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawDialAndHands(x: number, y: number, r: number, time: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    
    if (this.showDial) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = '#b45309';
      this.ctx.stroke();

      this.ctx.fillStyle = '#0f172a';
      this.ctx.font = 'bold 18px "Fredoka"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        this.ctx.fillText(numerals[i], Math.cos(angle) * (r * 0.8), Math.sin(angle) * (r * 0.8));
      }
    } else {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      this.ctx.stroke();
    }

    // Aiguille minutes
    this.ctx.save();
    this.ctx.rotate(time);
    this.ctx.beginPath();
    this.ctx.moveTo(-3, 0); this.ctx.lineTo(0, -r * 0.85); this.ctx.lineTo(3, 0);
    this.ctx.fillStyle = this.showDial ? '#0f172a' : '#f8fafc';
    this.ctx.fill();
    this.ctx.restore();

    // Aiguille heures (12x plus lente)
    this.ctx.save();
    this.ctx.rotate(time / 12);
    this.ctx.beginPath();
    this.ctx.moveTo(-4, 0); this.ctx.lineTo(0, -r * 0.55); this.ctx.lineTo(4, 0);
    this.ctx.fillStyle = this.showDial ? '#0f172a' : '#f8fafc';
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = '#d97706';
    this.ctx.fill();

    this.ctx.restore();
  }
}