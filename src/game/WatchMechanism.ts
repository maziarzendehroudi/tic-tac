export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  public power: number = 0; // Énergie du ressort (0 à 100)
  public showDial: boolean = true; 
  
  // Angles de rotation (Synchronisation mécanique stricte)
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

    // Remontage : la vis pousse le barillet (bloqué à 100%)
    if (isWinding && hasCrown && this.power < 100) {
      this.power = Math.min(100, this.power + deltaTime * 0.06);
      this.wormOffset = (this.wormOffset + deltaTime * 0.08) % 12;
      
      if (hasSpring) {
        this.angleBarrel += deltaTime * 0.003; 
      }
    }

    // Décharge : Le barillet entraîne tout le mécanisme !
    const isComplete = hasSpring && hasCrown && hasHours && hasMinutes && hasSeconds;
    if (isComplete && this.power > 0 && !isWinding) {
      this.power = Math.max(0, this.power - deltaTime * 0.002); 
      
      const energyFactor = this.power / 100;
      const v = 0.08 * energyFactor * deltaTime; // Vitesse tangentielle constante

      // Cinématique réaliste : la vitesse de rotation dépend du rayon de chaque engrenage
      // Le barillet tourne en sens ANTI-HORAIRE (-), tous les autres tournent en sens HORAIRE (+)
      this.angleBarrel -= v / 60;   
      this.angleSeconds += v / 20;  // Rayon 20 -> Rapide
      this.angleMinutes += v / 40;  // Rayon 40 -> Moyen
      this.angleHours += v / 45;    // Rayon 45 -> Lent
    }
  }

  public draw(placedParts: string[], unlockedParts: string[], isWinding: boolean): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    // 1. Platine de base grand format
    this.drawBasePlate();

    // 2. Molette & Vis sans fin (Déborde largement à gauche)
    this.drawPart('crown', placedParts, unlockedParts, -185, 124, () => {
      this.drawHorizontalWormGear(-185, 124, this.wormOffset, isWinding);
    });

    // 3. Roue du Ressort (Barillet) - R=60, Dents=36. Position: x=-48, y=64
    this.drawPart('spring', placedParts, unlockedParts, -48, 64, () => {
      this.drawBarrel(-48, 64, 60, 36, this.angleBarrel, this.power);
    });

    // 4. Engrenage des Secondes (Centre) - R=20, Dents=12. S'engrène avec le barillet
    this.drawPart('seconds', placedParts, unlockedParts, 0, 0, () => {
      this.drawGear(0, 0, 20, 12, this.angleSeconds + 0.12, '#f43f5e', '#be123c', 6, 3);
    });

    // 5. Engrenage des Minutes - R=40, Dents=24. Position: x=-108, y=-16
    this.drawPart('minutes', placedParts, unlockedParts, -108, -16, () => {
      this.drawGear(-108, -16, 40, 24, this.angleMinutes + 0.05, '#38bdf8', '#0284c7', 8, 4);
    });

    // 6. Engrenage des Heures - R=45, Dents=27. Position: x=34, y=130
    this.drawPart('hours', placedParts, unlockedParts, 34, 130, () => {
      this.drawGear(34, 130, 45, 27, this.angleHours + 0.08, '#fbbf24', '#b45309', 10, 5);
    });

    // 7. Cadran global & Aiguilles ancrées sur leurs engrenages respectifs
    if (placedParts.length >= 5) {
      this.drawDialAndHands(185);
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
    this.ctx.arc(0, 0, 195, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    // Rubis sur chaque axe
    const rubies = [[-185, 124], [-48, 64], [0, 0], [-108, -16], [34, 130]];
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
    
    // Vis sans fin s'engrenant tangientiellement en bas du barillet
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(10, -8, 70, 16);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, -8, 70, 16);

    this.ctx.beginPath();
    for (let i = 10; i < 75; i += 9) {
      const threadX = i + (offset % 9);
      if (threadX > 10 && threadX < 75) {
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
    this.ctx.roundRect(-15, -20, 25, 40, 6);
    this.ctx.fill();
    this.ctx.shadowBlur = 0; 

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let i = -14; i <= 14; i += 7) {
      this.ctx.moveTo(-15, i);
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
    this.ctx.rotate(angle); 
    
    // Tambour intérieur
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
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

    // Cinématique réaliste du ruban de ressort
    this.ctx.beginPath();
    const turns = 6.0; 
    const innerR = 5.5;
    const outerR = r * 0.78;
    const tightness = power / 100; // 0 à 1
    
    // Magie mathématique : modifie la densité des spires sans changer la longueur totale
    const exponent = 0.5 + tightness * 2.0; 

    for (let i = 0; i <= 250; i++) {
      const t = i / 250;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (outerR - innerR) * Math.pow(t, exponent);
      
      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;

      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }

    const red = Math.floor(200 - (power * 0.3));
    const green = Math.floor(200 - (power * 0.3));
    const blue = Math.floor(205 + (power * 0.3));
    this.ctx.strokeStyle = `rgb(${red}, ${green}, ${blue})`;
    this.ctx.lineWidth = 2.0;
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private drawGear(x: number, y: number, r: number, teeth: number, angle: number, fillColor: string, strokeColor: string, holeRadius: number, spokes: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    
    // Dents trapézoïdales réalistes pour un emboîtement parfait
    this.ctx.beginPath();
    const tW = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * tW;
      const rInner = r * 0.85;
      
      this.ctx.lineTo(Math.cos(a - tW*0.25) * rInner, Math.sin(a - tW*0.25) * rInner);
      this.ctx.lineTo(Math.cos(a - tW*0.12) * r, Math.sin(a - tW*0.12) * r);
      this.ctx.lineTo(Math.cos(a + tW*0.12) * r, Math.sin(a + tW*0.12) * r);
      this.ctx.lineTo(Math.cos(a + tW*0.25) * rInner, Math.sin(a + tW*0.25) * rInner);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();

    // Évidements allégés du corps de l'engrenage
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

  private drawDialAndHands(r: number) {
    // Anneau du cadran extérieur
    if (this.showDial) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      this.ctx.fill();
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      this.ctx.stroke();

      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = 'bold 22px "Fredoka"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        this.ctx.fillText(numerals[i], Math.cos(angle) * (r * 0.85), Math.sin(angle) * (r * 0.85));
      }
    }

    // --- AIGUILLE DES HEURES (Or) ancrée sur l'engrenage des Heures ---
    this.ctx.save();
    this.ctx.translate(34, 130);
    this.ctx.rotate(this.angleHours);
    this.ctx.beginPath();
    this.ctx.moveTo(-3.5, 0); this.ctx.lineTo(0, -35); this.ctx.lineTo(3.5, 0);
    this.ctx.fillStyle = '#d97706'; 
    this.ctx.fill();
    this.ctx.beginPath(); this.ctx.arc(0,0,3,0,Math.PI*2); this.ctx.fill();
    this.ctx.restore();

    // --- AIGUILLE DES MINUTES (Bleue) ancrée sur l'engrenage des Minutes ---
    this.ctx.save();
    this.ctx.translate(-108, -16);
    this.ctx.rotate(this.angleMinutes);
    this.ctx.beginPath();
    this.ctx.moveTo(-2.5, 0); this.ctx.lineTo(0, -35); this.ctx.lineTo(2.5, 0);
    this.ctx.fillStyle = '#0284c7'; 
    this.ctx.fill();
    this.ctx.beginPath(); this.ctx.arc(0,0,3,0,Math.PI*2); this.ctx.fill();
    this.ctx.restore();

    // --- AIGUILLE DES SECONDES (Rouge) ancrée au Centre ---
    this.ctx.save();
    this.ctx.translate(0, 0);
    this.ctx.rotate(this.angleSeconds);
    this.ctx.beginPath();
    this.ctx.moveTo(-1.5, 8); this.ctx.lineTo(0, -100); this.ctx.lineTo(1.5, 8);
    this.ctx.strokeStyle = '#e11d48'; 
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.beginPath(); this.ctx.arc(0,0,3.5,0,Math.PI*2); this.ctx.fillStyle='#e11d48'; this.ctx.fill();
    this.ctx.restore();
  }
}