export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  public power: number = 0; // Énergie du ressort (0 à 100)
  public timeOffset: number = 0; 
  public showDial: boolean = true; 
  
  // Angles de rotation
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

    // Remontage via la molette
    if (isWinding && placedParts.includes('crown')) {
      this.power = Math.min(100, this.power + deltaTime * 0.05);
      this.wormOffset = (this.wormOffset + deltaTime * 0.05) % 12;
      
      if (placedParts.includes('spring')) {
        this.angleBarrel -= deltaTime * 0.002; 
      }
    }

    // Décharge (Fonctionnement de l'horloge)
    if (isComplete && this.power > 0 && !isWinding) {
      this.power = Math.max(0, this.power - deltaTime * 0.003); // Autonomie ~30 secondes
      
      const speed = 0.001;
      this.angleSeconds += speed * 40;   
      this.angleMinutes += speed * 5;    
      this.angleHours += speed * 0.5;    
      this.angleBarrel += speed * 0.2;  
      
      this.timeOffset = this.angleMinutes;
    }
  }

  public draw(placedParts: string[], unlockedParts: string[], isWinding: boolean): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    // 1. Platine de base
    this.drawBasePlate();

    // 2. Molette & Vis sans fin
    this.drawPart('crown', placedParts, unlockedParts, -170, 0, () => {
      this.drawHorizontalWormGear(-170, 0, this.wormOffset, isWinding);
    });

    // 3. Barillet & Ressort avec reflets tournants
    this.drawPart('spring', placedParts, unlockedParts, -80, 0, () => {
      this.drawBarrel(-80, 0, 45, 18, this.angleBarrel, this.power);
    });

    // 4. Engrenage Heures (Fond, Or)
    this.drawPart('hours', placedParts, unlockedParts, 0, 0, () => {
      this.drawGear(0, 0, 55, 24, this.angleHours, '#fbbf24', '#b45309', 10, 5);
    });

    // 5. Engrenage Minutes (Milieu, Bleu)
    this.drawPart('minutes', placedParts, unlockedParts, 0, 0, () => {
      this.drawGear(0, 0, 40, 16, this.angleMinutes, '#38bdf8', '#0284c7', 8, 4);
    });

    // 6. Engrenage Secondes (Haut, Rouge)
    this.drawPart('seconds', placedParts, unlockedParts, 0, 0, () => {
      this.drawGear(0, 0, 25, 10, this.angleSeconds, '#f43f5e', '#be123c', 6, 3);
    });

    // 7. Cadran & Aiguilles
    if (placedParts.length >= 5) {
      this.drawDialAndHands(0, 0, 120, this.timeOffset);
    }

    this.ctx.restore();
  }

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
      this.ctx.arc(x, y, id === 'crown' ? 15 : 25, 0, Math.PI * 2);
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeStyle = '#64748b';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawBasePlate() {
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 150, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    const rubies = [[0, 0], [-80, 0]];
    rubies.forEach(([rx, ry]) => {
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
    });
  }

  private drawHorizontalWormGear(x: number, y: number, offset: number, isWinding: boolean) {
    this.ctx.save();
    this.ctx.translate(x, y);
    
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(10, -8, 45, 16);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, -8, 45, 16);

    this.ctx.beginPath();
    for (let i = 10; i < 55; i += 10) {
      const threadX = i + (offset % 10);
      if (threadX > 10 && threadX < 55) {
        this.ctx.moveTo(threadX, -8);
        this.ctx.lineTo(threadX + 5, 8);
      }
    }
    this.ctx.strokeStyle = '#cbd5e1';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    
    if (isWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 15;
    }
    this.ctx.fillStyle = '#d97706';
    this.ctx.beginPath();
    this.ctx.roundRect(-10, -18, 20, 36, 6);
    this.ctx.fill();
    this.ctx.shadowBlur = 0; 

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let i = -12; i <= 12; i += 6) {
      this.ctx.moveTo(-10, i);
      this.ctx.lineTo(10, i);
    }
    this.ctx.strokeStyle = '#fcd34d';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawBarrel(x: number, y: number, r: number, teeth: number, angle: number, power: number) {
    this.drawGear(x, y, r, teeth, angle, '#94a3b8', '#475569', 0, 0);

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle); // Fait pivoter le contenu du barillet (y compris le ressort) pour voir le mouvement
    
    // Tambour du barillet
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fill();
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Axe central (Arbor)
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#d97706';
    this.ctx.fill();

    // --- RESSORT AVEC POINTS DE REFLET ROTATIFS ---
    this.ctx.beginPath();
    const turns = 5.0; 
    const innerR = 5;
    const outerR = r * 0.75;
    const tightness = power / 100; 
    const exponent = 1.0 + tightness * 3.0; 

    const points: {x: number, y: number}[] = [];

    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (outerR - innerR) * Math.pow(t, exponent);
      
      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;
      points.push({x: px, y: py});

      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }

    const red = Math.floor(200 - (power * 0.3));
    const green = Math.floor(200 - (power * 0.3));
    const blue = Math.floor(205 + (power * 0.3));
    this.ctx.strokeStyle = `rgb(${red}, ${green}, ${blue})`;
    this.ctx.lineWidth = 2.2;
    this.ctx.stroke();

    // Petits points lumineux / reflets le long du ressort pour matérialiser sa rotation
    this.ctx.fillStyle = '#ffffff';
    for (let i = 25; i < points.length; i += 35) {
      const pt = points[i];
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, 1.4, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }

  private drawGear(x: number, y: number, r: number, teeth: number, angle: number, fillColor: string, strokeColor: string, holeRadius: number, spokes: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    
    this.ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const rInner = r * 0.8;
      const tW = (Math.PI * 2) / (teeth * 2.2);
      
      this.ctx.lineTo(Math.cos(a - tW/2) * rInner, Math.sin(a - tW/2) * rInner);
      this.ctx.lineTo(Math.cos(a - tW/4) * r, Math.sin(a - tW/4) * r);
      this.ctx.lineTo(Math.cos(a + tW/4) * r, Math.sin(a + tW/4) * r);
      this.ctx.lineTo(Math.cos(a + tW/2) * rInner, Math.sin(a + tW/2) * rInner);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    if (holeRadius > 0 && spokes > 0) {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, holeRadius, 0, Math.PI * 2);
      this.ctx.fill();
      
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.arc(Math.cos(a) * (r * 0.55), Math.sin(a) * (r * 0.55), r * 0.22, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.globalCompositeOperation = 'source-over';
      
      this.ctx.beginPath();
      this.ctx.arc(0, 0, holeRadius * 0.7, 0, Math.PI * 2);
      this.ctx.fillStyle = '#334155';
      this.ctx.fill();
    }
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
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = '#b45309';
      this.ctx.stroke();

      this.ctx.fillStyle = '#0f172a';
      this.ctx.font = 'bold 22px "Fredoka"';
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

    this.ctx.save();
    this.ctx.rotate(time);
    this.ctx.beginPath();
    this.ctx.moveTo(-4, 0); this.ctx.lineTo(0, -r * 0.85); this.ctx.lineTo(4, 0);
    this.ctx.fillStyle = this.showDial ? '#0f172a' : '#f8fafc';
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.save();
    this.ctx.rotate(time / 12);
    this.ctx.beginPath();
    this.ctx.moveTo(-5, 0); this.ctx.lineTo(0, -r * 0.55); this.ctx.lineTo(5, 0);
    this.ctx.fillStyle = this.showDial ? '#0f172a' : '#f8fafc';
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#d97706';
    this.ctx.fill();

    this.ctx.restore();
  }
}