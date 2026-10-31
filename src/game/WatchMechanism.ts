import { Clock } from './Clock';
import type { DialTheme } from './SaveManager';

export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  public power: number = 0; // Énergie du ressort (0 à 100)
  public showDial: boolean = true;
  private theme: DialTheme = 'classic';

  // Angles de rotation des engrenages (inversion de sens à chaque contact)
  private wormOffset: number = 0;
  private angleBarrel: number = 0;
  private angleHours: number = 0;
  private angleMinutesGear: number = 0;
  private angleSeconds: number = 0;

  // Angles horaires des 3 aiguilles centrales coaxiales (sens horaire strict)
  private handHoursAngle: number = 0;
  private handMinutesAngle: number = 0;
  private handSecondsAngle: number = 0;

  // Accumulateurs acoustiques pour le synthétiseur horloger
  private windingStepAccumulator: number = 0;
  private escapementAccumulator: number = 0;
  private isTicPhase: boolean = true;

  private onTickCallback?: (isTic: boolean) => void;
  private onWindingClickCallback?: () => void;

  // Coordonnées et rayons exacts de la chaîne cinématique (Module m = 1.5 px/dent)
  // 1. Couronne (-202, 80) -> Vis sans fin tangente en (-76, 80)
  // 2. Barillet (-76, 32), R = 48 (32 dents)
  // 3. Engr. Heures (0, 0), R = 34.5 (23 dents) -> distance au Barillet = 82.5 px
  // 4. Engr. Minutes (52, -33), R = 27 (18 dents) -> distance à Heures = 61.5 px
  // 5. Engr. Secondes (76, 7), R = 19.5 (13 dents) -> distance à Minutes = 46.5 px
  private static readonly POS = {
    crown: { x: -202, y: 80 },
    spring: { x: -76, y: 32, r: 48, teeth: 32 },
    hours: { x: 0, y: 0, r: 34.5, teeth: 23 },
    minutes: { x: 52, y: -33, r: 27, teeth: 18 },
    seconds: { x: 76, y: 7, r: 19.5, teeth: 13 }
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    onTick?: (isTic: boolean) => void,
    onWindingClick?: () => void
  ) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = true;
    this.width = width;
    this.height = height;
    this.onTickCallback = onTick;
    this.onWindingClickCallback = onWindingClick;
  }

  public setTheme(theme: DialTheme): void {
    this.theme = theme;
  }

  /**
   * Teste si un clic/toucher sur le canvas (coordonnées normalisées 500x500) cible la molette
   */
  public isPointInCrown(canvasX: number, canvasY: number): boolean {
    const localX = canvasX - this.width / 2;
    const localY = canvasY - this.height / 2;
    return (
      localX >= -235 &&
      localX <= -155 &&
      localY >= 40 &&
      localY <= 120
    );
  }

  public update(deltaTime: number, placedParts: string[], isWinding: boolean): void {
    const hasCrown = placedParts.includes('crown');
    const hasSpring = placedParts.includes('spring');
    const hasHours = placedParts.includes('hours');
    const hasMinutes = placedParts.includes('minutes');
    const hasSeconds = placedParts.includes('seconds');

    // 1. REMONTAGE : La molette fait tourner la vis sans fin et tend le ressort du barillet
    if (isWinding && hasCrown) {
      const deltaWorm = deltaTime * 0.08;
      this.wormOffset = (this.wormOffset + deltaWorm) % 9;

      this.windingStepAccumulator += deltaWorm;
      if (this.windingStepAccumulator >= 5.5) {
        this.windingStepAccumulator = 0;
        this.onWindingClickCallback?.();
      }

      if (hasSpring && this.power < 100) {
        this.power = Math.min(100, this.power + deltaTime * 0.055);
        this.angleBarrel += deltaTime * 0.0025;
      }
    }

    // 2. DÉCHARGE PROGRESSIVE : Le barillet entraîne la chaîne d'engrenages montée
    if (hasSpring && hasHours && this.power > 0 && !isWinding) {
      // Si l'échappement (secondes) n'est pas encore monté, le ressort se détend un peu plus librement
      const drainRate = hasSeconds ? 0.0022 : 0.0035;
      this.power = Math.max(0, this.power - deltaTime * drainRate);

      const energyFactor = 0.25 + 0.75 * (this.power / 100);
      // Vitesse tangentielle linéaire le long des dentures (px/ms)
      const v = 0.045 * energyFactor * deltaTime;

      const { spring, hours, minutes, seconds } = WatchMechanism.POS;

      // Sens de rotation alternés réalistes :
      // Barillet (-) -> Heures (+) -> Minutes (-) -> Secondes (+)
      this.angleBarrel -= v / spring.r;
      this.angleHours += v / hours.r;
      this.handHoursAngle += v / hours.r;

      if (hasMinutes) {
        this.angleMinutesGear -= v / minutes.r;
        // L'aiguille centrale des minutes tourne en sens horaire (+) à la vitesse de l'engrenage des minutes
        this.handMinutesAngle += v / minutes.r;

        if (hasSeconds) {
          const deltaSec = v / seconds.r;
          this.angleSeconds += deltaSec;
          this.handSecondsAngle += deltaSec;

          // Tic-Tac de l'ancre d'échappement calé sur les 13 dents de la roue des secondes
          this.escapementAccumulator += deltaSec;
          const halfToothPitch = Math.PI / seconds.teeth;
          if (this.escapementAccumulator >= halfToothPitch) {
            this.escapementAccumulator %= halfToothPitch;
            this.onTickCallback?.(this.isTicPhase);
            this.isTicPhase = !this.isTicPhase;
          }
        }
      }
    }
  }

  public draw(placedParts: string[], unlockedParts: string[], isWinding: boolean): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    const { crown, spring, hours, minutes, seconds } = WatchMechanism.POS;

    // 1. Boîtier horloger, platine et flèches de flux d'énergie (1 -> 2 -> 3 -> 4 -> 5)
    this.drawBasePlate();
    this.drawKinematicBridges(placedParts);

    // 2. Pièce 1 : Molette extérieure & Vis sans fin
    this.drawPart('crown', 1, 'Molette', placedParts, unlockedParts, crown.x + 25, crown.y, () => {
      this.drawHorizontalWormGear(crown.x, crown.y, this.wormOffset, isWinding);
    });

    // 3. Pièce 2 : Barillet à Ressort
    this.drawPart('spring', 2, 'Ressort', placedParts, unlockedParts, spring.x, spring.y, () => {
      this.drawBarrel(spring.x, spring.y, spring.r, spring.teeth, this.angleBarrel, this.power);
    });

    // 4. Pièce 3 : Engrenage des Heures (Centre - Grand / Lent)
    this.drawPart('hours', 3, 'Heures', placedParts, unlockedParts, hours.x, hours.y, () => {
      this.drawGear(
        hours.x,
        hours.y,
        hours.r,
        hours.teeth,
        this.angleHours,
        '#fbbf24',
        '#b45309',
        8,
        5
      );
    });

    // 5. Pièce 4 : Engrenage des Minutes (Haut-Droite - Moyen)
    this.drawPart('minutes', 4, 'Minutes', placedParts, unlockedParts, minutes.x, minutes.y, () => {
      this.drawGear(
        minutes.x,
        minutes.y,
        minutes.r,
        minutes.teeth,
        this.angleMinutesGear + 0.14,
        '#38bdf8',
        '#0284c7',
        6,
        4
      );
    });

    // 6. Pièce 5 : Engrenage des Secondes & Ancre d'Échappement Tic-Tac (Droite - Petit / Rapide)
    this.drawPart('seconds', 5, 'Secondes', placedParts, unlockedParts, seconds.x, seconds.y, () => {
      this.drawGear(
        seconds.x,
        seconds.y,
        seconds.r,
        seconds.teeth,
        this.angleSeconds + 0.08,
        '#f43f5e',
        '#be123c',
        5,
        3
      );
      this.drawEscapementAnchor(seconds.x, seconds.y + 31, this.angleSeconds * seconds.teeth);
    });

    // 7. Rubis d'axes sur les engrenages montés
    this.drawAxleRubies(placedParts);

    // 8. Cadran horloger (Chiffres romains) & Aiguilles Centrales Coaxiales
    this.drawCentralDialAndHands(placedParts);

    this.ctx.restore();
  }

  private drawBasePlate(): void {
    const palette = Clock.getPalette(this.theme);

    // Cornes du boîtier (Haut et Bas)
    this.ctx.fillStyle = '#334155';
    this.ctx.strokeStyle = palette.borderColor;
    this.ctx.lineWidth = 3;
    [-1, 1].forEach(dir => {
      this.ctx.beginPath();
      this.ctx.roundRect(-55, dir * 162 - (dir === 1 ? 0 : 24), 110, 24, 6);
      this.ctx.fill();
      this.ctx.stroke();
    });

    // Boîtier principal (Rayon 176 px pour laisser la Molette à l'extérieur à gauche)
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 176, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 7;
    this.ctx.strokeStyle = palette.borderColor;
    this.ctx.stroke();

    // Platine mécanique intérieure (Squelette horloger)
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 134, 0, Math.PI * 2);
    this.ctx.fillStyle = '#090d16';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.stroke();
  }

  private drawKinematicBridges(placedParts: string[]): void {
    const { spring, hours, minutes, seconds } = WatchMechanism.POS;

    // Lignes pointillées de liaison cinématique (1 -> 2 -> 3 -> 4 -> 5)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(-150, 80);
    this.ctx.lineTo(spring.x, 80);
    this.ctx.lineTo(spring.x, spring.y);
    this.ctx.lineTo(hours.x, hours.y);
    this.ctx.lineTo(minutes.x, minutes.y);
    this.ctx.lineTo(seconds.x, seconds.y);
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([4, 4]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Renvoi coaxial Minutes -> Centre & Secondes -> Centre (pont horloger)
    if (placedParts.includes('minutes') || placedParts.includes('seconds')) {
      this.ctx.beginPath();
      this.ctx.moveTo(hours.x, hours.y);
      this.ctx.lineTo(minutes.x, minutes.y);
      this.ctx.lineTo(seconds.x, seconds.y);
      this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      this.ctx.lineWidth = 6;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawPart(
    id: string,
    stepNumber: number,
    label: string,
    placed: string[],
    unlocked: string[],
    badgeX: number,
    badgeY: number,
    drawFunc: () => void
  ): void {
    const isPlaced = placed.includes(id);
    const isUnlocked = unlocked.includes(id);

    if (isPlaced) {
      this.ctx.save();
      this.ctx.globalAlpha = 1;
      drawFunc();
      this.ctx.restore();
    } else {
      // Fantôme pédagogique de la pièce à monter
      this.ctx.save();
      this.ctx.globalAlpha = isUnlocked ? 0.28 : 0.12;
      this.ctx.filter = 'grayscale(100%)';
      drawFunc();
      this.ctx.restore();

      // Cercle pointillé et numéro d'étape (1 à 5)
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(badgeX, badgeY, 18, 0, Math.PI * 2);
      this.ctx.fillStyle = isUnlocked ? 'rgba(15, 23, 42, 0.88)' : 'rgba(15, 23, 42, 0.6)';
      this.ctx.fill();
      this.ctx.setLineDash([4, 3]);
      this.ctx.strokeStyle = isUnlocked ? '#fbbf24' : '#475569';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.fillStyle = isUnlocked ? '#fbbf24' : '#64748b';
      this.ctx.font = 'bold 13px "Fredoka", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`${stepNumber}`, badgeX, badgeY - 4);

      this.ctx.font = '600 9px "Fredoka", sans-serif';
      this.ctx.fillStyle = isUnlocked ? '#e2e8f0' : '#64748b';
      this.ctx.fillText(label, badgeX, badgeY + 8);
      this.ctx.restore();
    }
  }

  private drawHorizontalWormGear(x: number, y: number, offset: number, isWinding: boolean): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    // 1. Tube de passage (canon d'étanchéité) sur le bord du boîtier
    this.ctx.fillStyle = '#475569';
    this.ctx.fillRect(28, -11, 18, 22);
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(28, -11, 18, 22);

    // 2. Longue tige à vis sans fin allant jusqu'au bas du Barillet (x_local = +126 -> x_global = -76)
    const wormStart = 12;
    const wormLength = 142; // Couvre de x = -190 jusqu'à x = -48 (engrènement parfait sous x = -76)
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(wormStart, -7, wormLength, 14);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(wormStart, -7, wormLength, 14);

    // Filets hélicoïdaux animés de la vis sans fin
    this.ctx.beginPath();
    for (let i = wormStart + 4; i < wormStart + wormLength - 6; i += 9) {
      const threadX = i + (offset % 9);
      this.ctx.moveTo(threadX, -7);
      this.ctx.lineTo(threadX + 4, 7);
    }
    this.ctx.strokeStyle = '#f8fafc';
    this.ctx.lineWidth = 2.8;
    this.ctx.stroke();

    // Palier de maintien à l'extrémité droite de la vis sans fin
    this.ctx.fillStyle = '#64748b';
    this.ctx.beginPath();
    this.ctx.roundRect(wormStart + wormLength - 4, -10, 8, 20, 3);
    this.ctx.fill();
    this.ctx.stroke();

    // 3. Couronne / Molette dorée crantée (À L'EXTÉRIEUR du boîtier)
    if (isWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 18;
    }
    this.ctx.fillStyle = isWinding ? '#f59e0b' : '#d97706';
    this.ctx.beginPath();
    this.ctx.roundRect(-22, -24, 34, 48, 8);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Crans antidérapants de la molette
    this.ctx.beginPath();
    for (let i = -16; i <= 16; i += 8) {
      this.ctx.moveTo(-20, i);
      this.ctx.lineTo(10, i);
    }
    this.ctx.strokeStyle = '#fde68a';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawBarrel(x: number, y: number, r: number, teeth: number, angle: number, power: number): void {
    this.drawGear(x, y, r, teeth, angle, '#94a3b8', '#475569', 0, 0);

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Tambour intérieur du barillet
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Ressort spiralé moteur (se contracte au centre quand power -> 100%)
    this.ctx.beginPath();
    const turns = 5.5;
    const innerR = 6;
    const outerR = r * 0.76;
    const tightness = power / 100;
    const exponent = 0.55 + tightness * 1.85;

    for (let i = 0; i <= 220; i++) {
      const t = i / 220;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (outerR - innerR) * Math.pow(t, exponent);

      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;

      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }

    // Couleur du ressort : passe du gris acier au doré/orangé énergétique quand il est tendu
    this.ctx.strokeStyle = power > 15 ? '#f59e0b' : '#cbd5e1';
    this.ctx.lineWidth = 2.2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawGear(
    x: number,
    y: number,
    r: number,
    teeth: number,
    angle: number,
    fillColor: string,
    strokeColor: string,
    holeRadius: number,
    spokes: number
  ): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Denture horlogère trapézoïdale
    this.ctx.beginPath();
    const tW = (Math.PI * 2) / teeth;
    const rInner = r - 3.2;
    const rOuter = r + 2.4;

    for (let i = 0; i < teeth; i++) {
      const a = i * tW;
      this.ctx.lineTo(Math.cos(a - tW * 0.28) * rInner, Math.sin(a - tW * 0.28) * rInner);
      this.ctx.lineTo(Math.cos(a - tW * 0.13) * rOuter, Math.sin(a - tW * 0.13) * rOuter);
      this.ctx.lineTo(Math.cos(a + tW * 0.13) * rOuter, Math.sin(a + tW * 0.13) * rOuter);
      this.ctx.lineTo(Math.cos(a + tW * 0.28) * rInner, Math.sin(a + tW * 0.28) * rInner);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1.6;
    this.ctx.stroke();

    // Rayons évidés sans altérer le fond de la platine
    if (holeRadius > 0 && spokes > 0) {
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.arc(Math.cos(a) * (r * 0.52), Math.sin(a) * (r * 0.52), r * 0.2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#090d16';
        this.ctx.fill();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();
      }

      this.ctx.beginPath();
      this.ctx.arc(0, 0, holeRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#334155';
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  /**
   * Dessine l'ancre d'échappement qui oscille (Tic-Tac) sous la roue des secondes
   */
  private drawEscapementAnchor(x: number, y: number, phase: number): void {
    const rockAngle = Math.sin(phase) * 0.24;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(rockAngle);

    // Bras de l'ancre d'échappement
    this.ctx.beginPath();
    this.ctx.moveTo(-14, -10);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(14, -10);
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, 14);
    this.ctx.strokeStyle = '#fbbf24';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    // Palettes en rubis de l'ancre
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fillRect(-16, -14, 4, 5);
    this.ctx.fillRect(12, -14, 4, 5);

    // Pivot de l'ancre
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawAxleRubies(placedParts: string[]): void {
    const { spring, hours, minutes, seconds } = WatchMechanism.POS;
    const axles = [
      { id: 'spring', x: spring.x, y: spring.y },
      { id: 'hours', x: hours.x, y: hours.y },
      { id: 'minutes', x: minutes.x, y: minutes.y },
      { id: 'seconds', x: seconds.x, y: seconds.y }
    ];

    axles.forEach(a => {
      if (placedParts.includes(a.id)) {
        this.ctx.beginPath();
        this.ctx.arc(a.x, a.y, 4.5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#e11d48';
        this.ctx.fill();
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.stroke();
      }
    });
  }

  /**
   * Dessine le grand cadran horloger et les 3 aiguilles COAXIALES au centre (0, 0)
   */
  private drawCentralDialAndHands(placedParts: string[]): void {
    const palette = Clock.getPalette(this.theme);
    const dialRadius = 166;

    // 1. Couronne des chiffres romains (située entre R=136 et R=170, hors de portée des engrenages)
    if (this.showDial) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      this.ctx.fill();

      // Graduations horaires
      for (let i = 0; i < 60; i++) {
        const a = (i * Math.PI) / 30;
        const isHour = i % 5 === 0;
        const rIn = isHour ? 160 : 164;
        const rOut = 169;
        this.ctx.beginPath();
        this.ctx.moveTo(Math.sin(a) * rIn, -Math.cos(a) * rIn);
        this.ctx.lineTo(Math.sin(a) * rOut, -Math.cos(a) * rOut);
        this.ctx.strokeStyle = isHour ? palette.borderColor : 'rgba(148, 163, 184, 0.35)';
        this.ctx.lineWidth = isHour ? 2.5 : 1;
        this.ctx.stroke();
      }

      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = 'bold 19px "Fredoka", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        this.ctx.fillText(numerals[i], Math.cos(angle) * 147, Math.sin(angle) * 147);
      }
    }

    // 2. Petite Aiguille des Heures (Or/Jaune) au CENTRE (0, 0)
    if (placedParts.includes('hours')) {
      this.ctx.save();
      this.ctx.rotate(this.handHoursAngle);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      this.ctx.shadowBlur = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 14);
      this.ctx.lineTo(0, -76);
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 8;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 3. Grande Aiguille des Minutes (Bleue) au CENTRE (0, 0)
    if (placedParts.includes('minutes')) {
      this.ctx.save();
      this.ctx.rotate(this.handMinutesAngle);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      this.ctx.shadowBlur = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 18);
      this.ctx.lineTo(0, -112);
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 5.5;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 4. Trotteuse des Secondes (Rouge) au CENTRE (0, 0)
    if (placedParts.includes('seconds')) {
      this.ctx.save();
      this.ctx.rotate(this.handSecondsAngle);
      this.ctx.beginPath();
      this.ctx.moveTo(0, 22);
      this.ctx.lineTo(0, -128);
      this.ctx.strokeStyle = '#f43f5e';
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 5. Rubis central d'horlogerie par-dessus les aiguilles
    if (placedParts.includes('hours') || placedParts.includes('minutes') || placedParts.includes('seconds')) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.stroke();
    }
  }
}
