export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  public power: number = 0; // Énergie du ressort (0 à 100)
  public showDial: boolean = true; 
  
  // Angles de rotation (tous dans le sens horaire)
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
    const hasSpring = placedParts.includes('spring');
    const hasCrown = placedParts.includes('crown');
    const hasHours = placedParts.includes('hours');
    const hasMinutes = placedParts.includes('minutes');
    const hasSeconds = placedParts.includes('seconds');

    // Remontage via la molette (s'arrête strictement à 100%)
    if (isWinding && hasCrown && this.power < 100) {
      this.power = Math.min(100, this.power + deltaTime * 0.06);
      this.wormOffset = (this.wormOffset + deltaTime * 0.08) % 12;
      
      if (hasSpring) {
        this.angleBarrel -= deltaTime * 0.004; 
      }
    }

    // Décharge et transmission mécanique dans le sens horaire
    const isComplete = hasSpring && hasCrown && hasHours && hasMinutes && hasSeconds;
    if (isComplete && this.power > 0 && !isWinding) {
      this.power = Math.max(0, this.power - deltaTime * 0.002); // Autonomie ~50 secondes
      
      const energyFactor = this.power / 100;
      const movement = 0.001 * energyFactor * deltaTime;

      // Transmission cinématique et sens horaire garanti
      this.angleBarrel -= movement * 0.3;   
      this.angleHours += movement * 0.5;    // Heures (Sens horaire)
      this.angleMinutes += movement * 1.5;  // Minutes (Sens horaire)
      this.angleSeconds += movement * 4.0;  // Secondes (Sens horaire)
    }
  }

  public draw(placedParts: string[], unlockedParts: string[], isWinding: boolean): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    // 1. Platine de base
    this.drawBasePlate();

    // 2. Molette & Vis sans fin (à gauche)
    this.drawPart('crown', placedParts, unlockedParts, -125, 0, () => {
      this.drawHorizontalWormGear(-125, 0, this.wormOffset, isWinding);
    });

    // 3. Roue du ressort unique et grand format (Barillet à x: -65, y: 0)
    this.drawPart('spring', placedParts, unlockedParts, -65, 0, () => {
      this.drawBarrel(-65, 0, 42, 28, this.angleBarrel, this.power);
    });

    // 4. Engrenage des Heures au centre (x: 0, y: 0)
    this.drawPart('hours', placedParts, unlockedParts, 0, 0, () => {
      this.drawGear(0, 0, 45, 28, this.angleHours, '#fbbf24', '#b45309', 12, 5);
    });

    // 5. Engrenage des Minutes déporté en HAUT (x: 0, y: -55) avec courroie vers le centre
    this.drawPart('minutes', placedParts, unlockedParts, 0, -55, () => {
      this.drawBeltConnection(0, 0, 0, -55, '#38bdf8');
      this.drawGear(0, -55, 26, 16, this.angleMinutes, '#38bdf8', '#0284c7', 6, 3);
    });

    // 6. Engrenage des Secondes déporté en BAS (x: 0, y: 55) avec courroie vers le centre
    this.drawPart('seconds', placedParts, unlockedParts, 0, 55, () => {
      this.drawBeltConnection(0, 0, 0, 55, '#f43f5e');
      this.drawGear(0, 55, 20, 12, this.angleSeconds, '#f43f5e', '#be123c', 5, 3);
    });

    // 7. Cadran & Aiguilles (sens horaire)
    if (placedParts.length >= 5) {
      this.drawDialAndHands(0, 0, 135, this.angleHours, this.angleMinutes, this.angleSeconds);
    }

    this.ctx.restore();
  }

  private drawBeltConnection(x1: number, y1: number, x2: number, y2: number, color: string) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(x1 - 6, y1);
    this.ctx.lineTo(x2 - 6, y2);
    this.ctx.moveTo(x1 + 6, y1);
    this.ctx.lineTo(x2 + 6, y2);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 10;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x1 - 4, y1);
    this.ctx.lineTo(x2 - 4, y2);
    this.ctx.moveTo(x1 + 4, y1);
    this.ctx.lineTo(x2 + 4, y2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.stroke();
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
      this.ctx.arc(x, y, id === 'crown' ? 14 : 25, 0, Math.PI * 2);
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeStyle = '#64748b';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawBasePlate() {
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 155, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    const rubies = [[-125, 0], [-65, 0], [0, 0], [0, -55], [0, 55]];
    rubies.forEach(([rx, ry]) => {
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
    });
  }

  private drawHorizontalWormGear(x: number, y: number, offset: number, isWinding: boolean) {
    this.ctx.save();
    this.ctx.translate(x, y);
    
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(0, -7, 40, 14);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, -7, 40, 14);

    this.ctx.beginPath();
    for (let i = 0; i < 40; i += 8) {
      const threadX = i + (offset % 8);
      if (threadX > 0 && threadX < 40) {
        this.ctx.moveTo(threadX, -7);
        this.ctx.lineTo(threadX + 4, 7);
      }
    }
    this.ctx.strokeStyle = '#cbd5e1';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();
    
    if (isWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 15;
    }
    this.ctx.fillStyle = '#d97706';
    this.ctx.beginPath();
    this.ctx.roundRect(-16, -18, 18, 36, 6);
    this.ctx.fill();
    this.ctx.shadowBlur = 0; 

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let i = -12; i <= 12; i += 6) {
      this.ctx.moveTo(-16, i);
      this.ctx.lineTo(0, i);
    }
    this.ctx.strokeStyle = '#fcd34d';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawBarrel(x: number, y: number, r: number, teeth: number, angle: number, power: number) {
    this.drawGear(x, y, r, teeth, angle, '#94a3b8', '#475569', 0, 0);

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle); 
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fill();
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#d97706';
    this.ctx.fill();

    // Ressort spirale et reflets
    this.ctx.beginPath();
    const turns = 4.5; 
    const innerR = 4.5;
    const outerR = r * 0.72;
    const tightness = power / 100; 
    const exponent = 1.0 + tightness * 3.0; 

    const points: {x: number, y: number}[] = [];

    for (let i = 0; i <= 180; i++) {
      const t = i / 180;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (outerR - innerR) * Math.pow(t, exponent);
      
      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;
      points.push({x: px, y: py});

      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }

    const red = Math.floor(200 - (power * 0.3));
    const green = Math.floor(200 - (power * 0.3));
    const blue = Math.floor(205 + (power * 0.3));
    this.ctx.strokeStyle = `rgb(${red}, ${green}, ${blue})`;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    for (let i = 20; i < points.length; i += 28) {
      const pt = points[i];
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
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
      const rInner = r * 0.78;
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
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();

    if (holeRadius > 0 && spokes > 0) {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, holeRadius, 0, Math.PI * 2);
      this.ctx.fill();
      
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.arc(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5), r * 0.2, 0, Math.PI * 2);
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

  private drawDialAndHands(x: number, y: number, r: number, angleHours: number, angleMinutes: number, angleSeconds: number) {
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
      this.ctx.font = 'bold 20px "Fredoka"';
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

    // --- AIGUILLE DES HEURES (Or, sens horaire) ---
    this.ctx.save();
    this.ctx.rotate(angleHours);
    this.ctx.beginPath();
    this.ctx.moveTo(-3.5, 0); this.ctx.lineTo(0, -r * 0.55); this.ctx.lineTo(3.5, 0);
    this.ctx.fillStyle = '#d97706'; 
    this.ctx.fill();
    this.ctx.restore();

    // --- AIGUILLE DES MINUTES (Bleue, sens horaire) ---
    this.ctx.save();
    this.ctx.rotate(angleMinutes);
    this.ctx.beginPath();
    this.ctx.moveTo(-2.5, 0); this.ctx.lineTo(0, -r * 0.82); this.ctx.lineTo(2.5, 0);
    this.ctx.fillStyle = '#0284c7'; 
    this.ctx.fill();
    this.ctx.restore();

    // --- AIGUILLE DES SECONDES (Rouge, sens horaire) ---
    this.ctx.save();
    this.ctx.rotate(angleSeconds);
    this.ctx.beginPath();
    this.ctx.moveTo(-1, 8); this.ctx.lineTo(0, -r * 0.88); this.ctx.lineTo(1, 8);
    this.ctx.strokeStyle = '#e11d48'; 
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();
    this.ctx.restore();

    // Pivot central
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#d97706';
    this.ctx.fill();

    this.ctx.restore();
  }
}