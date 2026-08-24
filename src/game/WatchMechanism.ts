export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  public power: number = 0; // Énergie du ressort (0 à 100)
  public timeOffset: number = 0; // Pour le réglage de l'heure
  private animTime: number = 0;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  public update(deltaTime: number, isFullyAssembled: boolean): void {
    if (isFullyAssembled && this.power > 0) {
      this.power = Math.max(0, this.power - deltaTime * 0.002); // Le ressort se décharge lentement
      this.animTime += deltaTime * 0.005;
      this.timeOffset += deltaTime * 0.0005; // L'heure avance naturellement
    }
  }

  public draw(placedParts: string[], unlockedParts: string[]): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    // 1. Platine de base (Gris perlé avec des rubis)
    this.drawBasePlate();

    // 2. Barillet (Ressort)
    this.drawPart('spring', placedParts, unlockedParts, -50, -50, () => {
      this.drawBarrel(-50, -50, 45, this.animTime * 0.1, this.power);
    });

    // 3. Train de rouage
    this.drawPart('gears', placedParts, unlockedParts, 40, -20, () => {
      this.drawGear(40, -20, 35, 12, -this.animTime * 0.3, '#d97706'); // Roue de centre
      this.drawGear(60, 30, 25, 10, this.animTime * 0.6, '#b45309'); // Roue moyenne
    });

    // 4. Échappement (Ancre et Roue d'échappement)
    this.drawPart('escapement', placedParts, unlockedParts, 20, 65, () => {
      const tickStep = Math.floor(this.animTime * 4) * 0.15; // Mouvement saccadé (tic-tac)
      this.drawEscapeWheel(20, 65, 20, 15, tickStep, '#94a3b8'); // Acier
      this.drawPalletFork(0, 80, Math.sin(this.animTime * 4) * 0.2); // Ancre
    });

    // 5. Balancier-Spiral
    this.drawPart('balance', placedParts, unlockedParts, -40, 60, () => {
      const oscillation = Math.sin(this.animTime * 4) * 2; // Oscillation rapide
      this.drawBalanceWheel(-40, 60, 35, oscillation);
    });

    // 6. Cadran & Aiguilles (Par dessus tout le reste)
    this.drawPart('hands', placedParts, unlockedParts, 0, 0, () => {
      this.drawDialAndHands(0, 0, 95, this.timeOffset);
    });

    this.ctx.restore();
  }

  // --- Fonctions de dessin mécaniques ---

  private drawPart(id: string, placed: string[], unlocked: string[], x: number, y: number, drawFunc: () => void) {
    if (placed.includes(id)) {
      // Dessin réaliste complet
      this.ctx.globalAlpha = 1;
      drawFunc();
    } else {
      // Schéma (Blueprint)
      this.ctx.globalAlpha = unlocked.includes(id) ? 0.4 : 0.15;
      this.ctx.filter = 'grayscale(100%)';
      drawFunc();
      this.ctx.filter = 'none';
      this.ctx.globalAlpha = 1;

      // Pointillé pour indiquer l'emplacement
      this.ctx.beginPath();
      this.ctx.arc(x, y, 20, 0, Math.PI * 2);
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeStyle = '#64748b';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawBasePlate() {
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 110, 0, Math.PI * 2);
    this.ctx.fillStyle = '#1e293b'; // Acier sombre
    this.ctx.fill();
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    // Quelques rubis d'horlogerie
    const rubies = [[-50, -50], [40, -20], [60, 30], [20, 65], [-40, 60]];
    rubies.forEach(([rx, ry]) => {
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48'; // Rouge rubis
      this.ctx.fill();
    });
  }

  private drawBarrel(x: number, y: number, r: number, angle: number, power: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    // Tambour du barillet en laiton
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fillStyle = '#b45309';
    this.ctx.fill();
    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Ressort spirale à l'intérieur (plus serré si power est élevé)
    this.ctx.beginPath();
    const turns = 3 + (power / 20);
    for (let i = 0; i < 100; i++) {
      const theta = (i / 100) * Math.PI * 2 * turns;
      const sr = (i / 100) * (r - 5);
      if (i === 0) this.ctx.moveTo(0, 0);
      else this.ctx.lineTo(Math.cos(theta) * sr, Math.sin(theta) * sr);
    }
    this.ctx.strokeStyle = '#475569'; // Acier bleui
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
      this.ctx.lineTo(Math.cos(a - 0.05) * r, Math.sin(a - 0.05) * r);
      this.ctx.lineTo(Math.cos(a + 0.05) * r, Math.sin(a + 0.05) * r);
      this.ctx.lineTo(Math.cos(a + 0.1) * rInner, Math.sin(a + 0.1) * rInner);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#451a03';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Trous (rayons)
    this.ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.arc(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5), r * 0.2, 0, Math.PI * 2);
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
      this.ctx.lineTo(Math.cos(a) * (r * 0.6), Math.sin(a) * (r * 0.6));
      this.ctx.lineTo(Math.cos(a + 0.15) * r, Math.sin(a + 0.15) * r); // Dents pointues (échappement)
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
    this.ctx.lineTo(-10, -15);
    this.ctx.lineTo(-12, -20);
    this.ctx.lineTo(10, -15);
    this.ctx.lineTo(12, -20);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(0, 15);
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#64748b';
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawBalanceWheel(x: number, y: number, r: number, angle: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Anneau du balancier
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#d97706'; // Or
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Rayons
    this.ctx.beginPath();
    this.ctx.moveTo(-r, 0); this.ctx.lineTo(r, 0);
    this.ctx.moveTo(0, -r); this.ctx.lineTo(0, r);
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Spiral (Cheveu bleu)
    this.ctx.beginPath();
    for (let i = 0; i < 100; i++) {
      const theta = (i / 100) * Math.PI * 2 * 4;
      const sr = (i / 100) * (r * 0.7);
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
    
    // Verre et cadran transparent
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#e2e8f0';
    this.ctx.stroke();

    // Chiffres romains
    this.ctx.fillStyle = '#0f172a';
    this.ctx.font = 'bold 16px "Fredoka"';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6 - Math.PI / 2;
      this.ctx.fillText(numerals[i], Math.cos(angle) * (r * 0.8), Math.sin(angle) * (r * 0.8));
    }

    // Aiguille des minutes
    this.ctx.save();
    this.ctx.rotate(time);
    this.ctx.beginPath();
    this.ctx.moveTo(-3, 0); this.ctx.lineTo(0, -r * 0.85); this.ctx.lineTo(3, 0);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.restore();

    // Aiguille des heures (12x plus lente)
    this.ctx.save();
    this.ctx.rotate(time / 12);
    this.ctx.beginPath();
    this.ctx.moveTo(-4, 0); this.ctx.lineTo(0, -r * 0.55); this.ctx.lineTo(4, 0);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.restore();

    // Pivot central
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = '#d97706';
    this.ctx.fill();

    this.ctx.restore();
  }
}