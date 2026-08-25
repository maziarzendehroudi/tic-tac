export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  public power: number = 0; // Énergie du ressort (0 à 100)
  public timeOffset: number = 0; // Pour les aiguilles
  public showDial: boolean = true; 
  
  // Angles de rotation pour la cinématique
  private wormOffset: number = 0;
  private angleBarrel: number = 0;
  private angleHours: number = 0;
  private angleMinutes: number = 0;
  private angleSeconds: number = 0;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  public update(deltaTime: number, placedParts: string[], isWinding: boolean): void {
    const isComplete = placedParts.length >= 5;

    // Remontage via la vis sans fin
    if (isWinding && placedParts.includes('crown')) {
      this.power = Math.min(100, this.power + deltaTime * 0.04);
      this.wormOffset = (this.wormOffset + deltaTime * 0.05) % 12;
      this.angleBarrel -= deltaTime * 0.002; // Le barillet se remonte
    }

    // Décharge et rotation du mécanisme
    if (isComplete && this.power > 0 && !isWinding) {
      this.power = Math.max(0, this.power - deltaTime * 0.003); // Autonomie ~30s
      
      const speed = 0.001;
      this.angleSeconds += speed * 30;   // Rapide
      this.angleMinutes += speed * 3;    // Moyen
      this.angleHours += speed * 0.25;   // Lent
      this.angleBarrel += speed * 0.1;   // Très lent
      
      this.timeOffset = this.angleMinutes;
    }
  }

  public draw(placedParts: string[], unlockedParts: string[]): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    // 1. Platine de base
    this.drawBasePlate();

    // 2. Molette & Vis sans fin (à gauche)
    this.drawPart('crown', placedParts, unlockedParts, -75, 0, () => {
      this.drawWormGear(-75, 0, this.wormOffset);
    });

    // 3. Le Ressort / Barillet (s'engrène avec la vis)
    this.drawPart('spring', placedParts, unlockedParts, -30, 0, () => {
      this.drawBarrel(-30, 0, 30, 18, this.angleBarrel, this.power);
    });

    // 4. Engrenage des Heures (Grand, Or, empilé en bas)
    this.drawPart('hours', placedParts, unlockedParts, 15, 0, () => {
      this.drawGear(15, 0, 42, 24, this.angleHours, '#fbbf24', '#b45309');
    });

    // 5. Engrenage des Minutes (Moyen, Bleu, empilé au milieu)
    this.drawPart('minutes', placedParts, unlockedParts, 15, 0, () => {
      this.drawGear(15, 0, 30, 16, this.angleMinutes, '#38bdf8', '#0284c7');
    });

    // 6. Engrenage des Secondes (Petit, Rouge, empilé en haut)
    this.drawPart('seconds', placedParts, unlockedParts, 15, 0, () => {
      this.drawGear(15, 0, 18, 10, this.angleSeconds, '#f43f5e', '#be123c');
    });

    // 7. Cadran (Masquable) & Aiguilles
    if (placedParts.length >= 5) {
      this.drawDialAndHands(15, 0, 85, this.timeOffset);
    }

    this.ctx.restore();
  }

  // --- MOTEUR DE DESSIN MÉCANIQUE ---

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

      // Pointillé pour l'emplacement
      this.ctx.beginPath();
      this.ctx.arc(x, y, id === 'crown' ? 10 : 20, 0, Math.PI * 2);
      this.ctx.setLineDash([4, 4]);
      this.ctx.strokeStyle = '#64748b';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawBasePlate() {
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 110, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    const rubies = [[-30, 0], [15, 0], [-75, -45], [-75, 45]];
    rubies.forEach(([rx, ry]) => {
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
    });
  }

  private drawWormGear(x: number, y: number, offset: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    
    // Axe de la vis
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(-6, -40, 12, 80);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(-6, -40, 12, 80);

    // Filetage hélicoïdal animé
    this.ctx.beginPath();
    for (let i = -40; i < 40; i += 12) {
      const threadY = i + offset;
      if (threadY > -40 && threadY < 40) {
        this.ctx.moveTo(-6, threadY);
        this.ctx.lineTo(6, threadY + 6);
      }
    }
    this.ctx.strokeStyle = '#cbd5e1';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    
    // Molette (Couronne)
    this.ctx.fillStyle = '#d97706';
    this.ctx.fillRect(-12, -50, 24, 15);
    this.ctx.strokeRect(-12, -50, 24, 15);

    this.ctx.restore();
  }

  private drawBarrel(x: number, y: number, r: number, teeth: number, angle: number, power: number) {
    this.drawGear(x, y, r, teeth, angle, '#94a3b8', '#475569');

    this.ctx.save();
    this.ctx.translate(x, y);
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fill();

    // Compression dynamique du ressort spirale
    this.ctx.beginPath();
    const turns = 2 + (power / 20); // S'enroule de plus en plus
    const tightness = power / 100;

    for (let i = 0; i <= 150; i++) {
      const t = i / 150;
      const theta = t * Math.PI * 2 * turns;
      
      const maxR = r * 0.75;
      const minR = 4;
      const actualR = minR + (maxR - minR) * Math.pow(t, 1 + tightness);
      
      if (i === 0) this.ctx.moveTo(0, 0);
      else this.ctx.lineTo(Math.cos(theta) * actualR, Math.sin(theta) * actualR);
    }
    this.ctx.strokeStyle = '#e2e8f0';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private drawGear(x: number, y: number, r: number, teeth: number, angle: number, fillColor: string, strokeColor: string) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    
    // Dents crantées réalistes
    this.ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const rInner = r * 0.8;
      const tW = (Math.PI * 2) / (teeth * 2);
      
      this.ctx.lineTo(Math.cos(a - tW/2) * rInner, Math.sin(a - tW/2) * rInner);
      this.ctx.lineTo(Math.cos(a - tW/4) * r, Math.sin(a - tW/4) * r);
      this.ctx.lineTo(Math.cos(a + tW/4) * r, Math.sin(a + tW/4) * r);
      this.ctx.lineTo(Math.cos(a + tW/2) * rInner, Math.sin(a + tW/2) * rInner);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Trou central et évidements
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.arc(Math.cos(a) * (r * 0.55), Math.sin(a) * (r * 0.55), r * 0.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalCompositeOperation = 'source-over';
    
    // Axe
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
    this.ctx.fillStyle = '#334155';
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawDialAndHands(x: number, y: number, r: number, time: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    
    if (this.showDial) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
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
      // Si cadran masqué, on trace juste l'anneau de verre extérieur
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      this.ctx.stroke();
    }

    // Aiguilles toujours visibles
    this.ctx.save();
    this.ctx.rotate(time);
    this.ctx.beginPath();
    this.ctx.moveTo(-3, 0); this.ctx.lineTo(0, -r * 0.85); this.ctx.lineTo(3, 0);
    this.ctx.fillStyle = this.showDial ? '#0f172a' : '#f8fafc';
    this.ctx.fill();
    this.ctx.restore();

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