import { Clock } from './Clock';
import type { DialTheme } from './SaveManager';

export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  public power: number = 65; // Réserve initiale pour observer immédiatement le mouvement
  public showDial: boolean = true;
  public speedMultiplier: 1 | 12 | 60 = 1; // 1x (Temps réel), 12x ou 60x
  private theme: DialTheme = 'classic';

  // Angles de rotation (chaque roue centrale est physiquement solidaire de son aiguille)
  private wormOffset: number = 0;
  public angleBarrel: number = 0;
  public angleHours: number = (10 * Math.PI) / 6;   // Position initiale esthétique ~10h10
  public angleMinutes: number = (10 * Math.PI) / 30;
  public angleSeconds: number = 0;

  // Phase de l'oscillateur (Balancier-Spiral & Ancre à 2 Hz = 4 alternances/s)
  private escapementPhase: number = 0;
  private stepAccumulatorMs: number = 0;
  private windingStepAccumulator: number = 0;
  private isTicPhase: boolean = true;

  private onTickCallback?: (isTic: boolean) => void;
  private onWindingClickCallback?: () => void;

  // Géométrie horlogère alignée sur l'axe horizontal y = 0 et coaxiale en (0, 0)
  private static readonly POS = {
    crown: { x: -194, y: 0 },
    spring: { x: -80, y: 0, r: 42, teeth: 28 },
    // Les 3 roues principales sont COAXIALES au centre (0, 0)
    hours: { x: 0, y: 0, r: 54, teeth: 36 },
    minutes: { x: 0, y: 0, r: 38, teeth: 24 },
    seconds: { x: 0, y: 0, r: 22, teeth: 30 },
    // Mobiles intermédiaires de minuterie (couplage mécanique) et Balancier à 3h (y = 0)
    idlerTop: { x: -42, y: -38, rOuter: 18, rInner: 8, teeth: 14 },
    idlerBottom: { x: -38, y: 44, rOuter: 20, rInner: 8, teeth: 16 },
    anchor: { x: 32, y: 0 },
    balance: { x: 78, y: 0, r: 28 }
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

  public cycleSpeedMultiplier(): 1 | 12 | 60 {
    if (this.speedMultiplier === 1) this.speedMultiplier = 12;
    else if (this.speedMultiplier === 12) this.speedMultiplier = 60;
    else this.speedMultiplier = 1;
    return this.speedMultiplier;
  }

  /**
   * Teste si un clic/toucher sur le canvas (500x500) cible la Molette centrée à gauche (y = 0)
   */
  public isPointInCrown(canvasX: number, canvasY: number): boolean {
    const localX = canvasX - this.width / 2;
    const localY = canvasY - this.height / 2;
    return (
      localX >= -235 &&
      localX <= -150 &&
      localY >= -42 &&
      localY <= 42
    );
  }

  public update(deltaTime: number, placedParts: string[], isWinding: boolean): void {
    const hasCrown = placedParts.includes('crown');
    const hasSpring = placedParts.includes('spring');
    const hasHours = placedParts.includes('hours');
    const hasMinutes = placedParts.includes('minutes');
    const hasSeconds = placedParts.includes('seconds');

    // 1. REMONTAGE SUR L'AXE HORIZONTAL (9h)
    if (isWinding && hasCrown) {
      const deltaWorm = deltaTime * 0.08;
      this.wormOffset = (this.wormOffset + deltaWorm) % 8;

      this.windingStepAccumulator += deltaWorm;
      if (this.windingStepAccumulator >= 5.0) {
        this.windingStepAccumulator = 0;
        this.onWindingClickCallback?.();
      }

      if (hasSpring && this.power < 100) {
        this.power = Math.min(100, this.power + deltaTime * 0.065);
        this.angleBarrel += deltaTime * 0.003;
      }
    }

    // 2. CINÉMATIQUE HORLOGÈRE RÉALISTE (Rapports stricts 1 : 12 : 720)
    if (hasSpring && (hasHours || hasMinutes || hasSeconds) && this.power > 0 && !isWinding) {
      // Décharge douce du barillet
      this.power = Math.max(0, this.power - deltaTime * 0.0008 * Math.sqrt(this.speedMultiplier));

      // En temps réel (speedMultiplier = 1) :
      // - Roue des Secondes : 1 tour complet (2*PI) en 60 000 ms -> omega_sec = 2*PI / 60000 rad/ms
      // - Roue des Minutes  : 1/60e de la vitesse des Secondes (1 tour en 60 min)
      // - Roue des Heures   : 1/12e de la vitesse des Minutes  (1 tour en 12 h)
      const effectiveDeltaMs = deltaTime * this.speedMultiplier;
      const deltaSecContinuous = (effectiveDeltaMs * 2 * Math.PI) / 60000;
      const deltaMin = deltaSecContinuous / 60;
      const deltaHr = deltaMin / 12;

      // Le barillet tourne lentement en sens anti-horaire pour délivrer le couple
      this.angleBarrel -= deltaMin * 1.5;

      if (hasHours) {
        this.angleHours = (this.angleHours + deltaHr) % (Math.PI * 2);
      }

      if (hasMinutes) {
        // Synchronisation horaire : si Heures et Minutes sont montées, l'angle des heures suit exactement les minutes
        this.angleMinutes = (this.angleMinutes + deltaMin) % (Math.PI * 2);
      }

      if (hasSeconds) {
        // Oscillation du balancier-spiral (2 battements Tic-Tac par seconde en 1x)
        const freqHz = 2 * Math.min(this.speedMultiplier, 6);
        this.escapementPhase = (this.escapementPhase + (deltaTime / 1000) * freqHz * Math.PI * 2) % (Math.PI * 2);

        if (this.speedMultiplier === 1) {
          // En mode 1x Temps Réel : vrai mouvement d'échappement à ancre par pas de 0.5 seconde (120 pas/tour)
          this.stepAccumulatorMs += deltaTime;
          const stepPeriodMs = 500; // Tic à 0.5s, Tac à 1.0s
          while (this.stepAccumulatorMs >= stepPeriodMs) {
            this.stepAccumulatorMs -= stepPeriodMs;
            this.angleSeconds = (this.angleSeconds + (Math.PI * 2) / 120) % (Math.PI * 2);
            this.onTickCallback?.(this.isTicPhase);
            this.isTicPhase = !this.isTicPhase;
          }
        } else {
          // En mode accéléré (12x ou 60x) : rotation fluide au rapport exact + impulsions acoustiques régulées
          this.angleSeconds = (this.angleSeconds + deltaSecContinuous) % (Math.PI * 2);
          this.stepAccumulatorMs += deltaTime;
          const fastTickPeriod = this.speedMultiplier === 12 ? 180 : 110;
          if (this.stepAccumulatorMs >= fastTickPeriod) {
            this.stepAccumulatorMs %= fastTickPeriod;
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

    const { crown, spring, hours, minutes, seconds, idlerTop, idlerBottom, anchor, balance } = WatchMechanism.POS;

    // 1. Boîtier horloger, platine squelette et ponts mécaniques
    this.drawBasePlate();
    this.drawMechanicalBridges(placedParts);

    // 2. Pièce 1 : Molette à gauche centrée verticalement (y = 0) & Tige de remontoir
    this.drawPart('crown', 1, '1. Molette', placedParts, unlockedParts, -162, -38, () => {
      this.drawCenteredCrownAndStem(crown.x, crown.y, this.wormOffset, isWinding);
    });

    // 3. Pièce 2 : Barillet & Ressort Spiral centré verticalement à gauche (x = -80, y = 0)
    this.drawPart('spring', 2, '2. Ressort', placedParts, unlockedParts, spring.x, -56, () => {
      this.drawBarrel(spring.x, spring.y, spring.r, spring.teeth, this.angleBarrel, this.power);
    });

    // 4. Mobiles intermédiaires de démultiplication (Minuterie 12:1 & Renvoi)
    this.drawReductionPinions(placedParts, idlerTop, idlerBottom);

    // 5. Pièce 3 : Grande Roue des Heures CENTRÉE en (0, 0) - R = 54 px (Jaune/Or)
    this.drawPart('hours', 3, '3. Heures', placedParts, unlockedParts, 0, 74, () => {
      this.drawGear(
        hours.x,
        hours.y,
        hours.r,
        hours.teeth,
        this.angleHours,
        '#fbbf24',
        '#b45309',
        14,
        5
      );
    });

    // 6. Pièce 4 : Roue Moyenne des Minutes CENTRÉE en (0, 0) - R = 38 px (Bleue)
    this.drawPart('minutes', 4, '4. Minutes', placedParts, unlockedParts, 0, -72, () => {
      this.drawGear(
        minutes.x,
        minutes.y,
        minutes.r,
        minutes.teeth,
        this.angleMinutes,
        '#38bdf8',
        '#0284c7',
        10,
        4
      );
    });

    // 7. Pièce 5 : Petite Roue des Secondes CENTRÉE en (0, 0) - R = 22 px (Rouge) + Échappement à 3h
    this.drawPart('seconds', 5, '5. Secondes', placedParts, unlockedParts, 78, -46, () => {
      this.drawEscapementAndBalance(anchor.x, anchor.y, balance.x, balance.y, balance.r, this.escapementPhase);
      this.drawGear(
        seconds.x,
        seconds.y,
        seconds.r,
        seconds.teeth,
        this.angleSeconds,
        '#f43f5e',
        '#be123c',
        6,
        3
      );
    });

    // 8. Cadran horloger périphérique & Aiguilles Coaxiales solidaires de leurs roues en (0, 0)
    this.drawDialAndCoaxialHands(placedParts);

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
      this.ctx.roundRect(-54, dir * 162 - (dir === 1 ? 0 : 24), 108, 24, 6);
      this.ctx.fill();
      this.ctx.stroke();
    });

    // Boîtier principal
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 174, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 7;
    this.ctx.strokeStyle = palette.borderColor;
    this.ctx.stroke();

    // Ouverture squelette centrale (Platine horlogère)
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 132, 0, Math.PI * 2);
    this.ctx.fillStyle = '#090d16';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.stroke();

    // Axe horizontal de référence horlogère (9h -> Centre -> 3h)
    this.ctx.beginPath();
    this.ctx.moveTo(-130, 0);
    this.ctx.lineTo(125, 0);
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([4, 4]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawMechanicalBridges(placedParts: string[]): void {
    // Pont central horloger reliant le Barillet (-80, 0), l'Axe Coaxial (0, 0) et le Balancier (78, 0)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.roundRect(-94, -12, 188, 24, 12);
    this.ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    if (placedParts.includes('spring')) {
      this.ctx.beginPath();
      this.ctx.arc(-80, 0, 4.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  /**
   * Dessine les 2 mobiles démultiplicateurs (roue + pignon coaxial) de la minuterie
   * qui couplent physiquement le Barillet et les 3 roues concentriques centrales
   */
  private drawReductionPinions(
    placedParts: string[],
    idlerTop: { x: number; y: number; rOuter: number; rInner: number; teeth: number },
    idlerBottom: { x: number; y: number; rOuter: number; rInner: number; teeth: number }
  ): void {
    // Mobile supérieur : couple le Barillet à la Roue des Minutes (4)
    if (placedParts.includes('minutes')) {
      const angleTop = -this.angleMinutes * (38 / idlerTop.rOuter);
      this.drawGear(idlerTop.x, idlerTop.y, idlerTop.rOuter, idlerTop.teeth, angleTop, '#475569', '#94a3b8', 0, 0);
      this.drawGear(idlerTop.x, idlerTop.y, idlerTop.rInner, 7, angleTop, '#38bdf8', '#0284c7', 0, 0);
      this.ctx.beginPath();
      this.ctx.arc(idlerTop.x, idlerTop.y, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
    }

    // Mobile inférieur (Minuterie 12:1) : démultiplie la Chaussée des Minutes vers la Roue des Heures (3)
    if (placedParts.includes('hours')) {
      const angleBot = -this.angleHours * (54 / idlerBottom.rInner);
      this.drawGear(idlerBottom.x, idlerBottom.y, idlerBottom.rOuter, idlerBottom.teeth, angleBot, '#475569', '#94a3b8', 0, 0);
      this.drawGear(idlerBottom.x, idlerBottom.y, idlerBottom.rInner, 8, angleBot, '#fbbf24', '#b45309', 0, 0);
      this.ctx.beginPath();
      this.ctx.arc(idlerBottom.x, idlerBottom.y, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = '#e11d48';
      this.ctx.fill();
    }
  }

  private drawPart(
    id: string,
    _stepNumber: number,
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
      // Aperçu fantôme de la pièce à son emplacement exact
      this.ctx.save();
      this.ctx.globalAlpha = isUnlocked ? 0.25 : 0.12;
      this.ctx.filter = 'grayscale(100%)';
      drawFunc();
      this.ctx.restore();

      // Pastille numérotée indiquant la pièce manquante
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.roundRect(badgeX - 34, badgeY - 11, 68, 22, 8);
      this.ctx.fillStyle = isUnlocked ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.65)';
      this.ctx.fill();
      this.ctx.strokeStyle = isUnlocked ? '#fbbf24' : '#475569';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.fillStyle = isUnlocked ? '#fbbf24' : '#64748b';
      this.ctx.font = 'bold 10px "Fredoka", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(label, badgeX, badgeY);
      this.ctx.restore();
    }
  }

  /**
   * 1. Dessine la Molette sur le flanc gauche, parfaitement centrée verticalement (y = 0)
   * avec sa tige de remontoir entrant à 9h jusqu'au Barillet
   */
  private drawCenteredCrownAndStem(x: number, y: number, offset: number, isWinding: boolean): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    // Tube d'étanchéité sur la carrure à 9h (y = 0)
    this.ctx.fillStyle = '#475569';
    this.ctx.fillRect(14, -10, 14, 20);
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(14, -10, 14, 20);

    // Tige de remontoir horizontale (de la molette jusqu'au rochet du barillet)
    const stemStart = 12;
    const stemLength = 62; // S'arrête proprement au contact du barillet (-194 + 74 = -120)
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(stemStart, -6, stemLength, 12);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.8;
    this.ctx.strokeRect(stemStart, -6, stemLength, 12);

    // Filets du pignon coulant animés lors du remontage
    this.ctx.beginPath();
    for (let i = stemStart + 4; i < stemStart + stemLength - 4; i += 8) {
      const threadX = i + (offset % 8);
      this.ctx.moveTo(threadX, -6);
      this.ctx.lineTo(threadX + 3, 6);
    }
    this.ctx.strokeStyle = '#f8fafc';
    this.ctx.lineWidth = 2.2;
    this.ctx.stroke();

    // Pignon conique d'engrènement contre la denture du barillet
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.beginPath();
    this.ctx.roundRect(stemStart + stemLength - 4, -11, 8, 22, 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Couronne / Molette dorée crantée à l'extérieur gauche du boîtier (centrée en y = 0)
    if (isWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 18;
    }
    this.ctx.fillStyle = isWinding ? '#f59e0b' : '#d97706';
    this.ctx.beginPath();
    this.ctx.roundRect(-20, -26, 32, 52, 8);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Cannelures de la molette
    this.ctx.beginPath();
    for (let i = -18; i <= 18; i += 6) {
      this.ctx.moveTo(-18, i);
      this.ctx.lineTo(10, i);
    }
    this.ctx.strokeStyle = '#fde68a';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * 2. Dessine le Barillet et son ressort spiral moteur en (x = -80, y = 0)
   */
  private drawBarrel(x: number, y: number, r: number, teeth: number, angle: number, power: number): void {
    this.drawGear(x, y, r, teeth, angle, '#94a3b8', '#475569', 0, 0);

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Tambour intérieur
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Ressort spiralé (se contracte vers la bonde centrale quand power -> 100%)
    this.ctx.beginPath();
    const turns = 5.0;
    const innerR = 5.5;
    const outerR = r * 0.76;
    const tightness = power / 100;
    const exponent = 0.55 + tightness * 1.85;

    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (outerR - innerR) * Math.pow(t, exponent);

      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;

      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }

    this.ctx.strokeStyle = power > 15 ? '#f59e0b' : '#cbd5e1';
    this.ctx.lineWidth = 2.2;
    this.ctx.stroke();

    // Bonde centrale du barillet
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#d97706';
    this.ctx.fill();

    this.ctx.restore();
  }

  /**
   * Dessine une roue dentée horlogère avec bras évidés laissant voir les roues situées en dessous
   */
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

    // 1. Couronne dentée extérieure
    this.ctx.beginPath();
    const tW = (Math.PI * 2) / teeth;
    const rInner = r - 3.0;
    const rOuter = r + 2.2;

    for (let i = 0; i < teeth; i++) {
      const a = i * tW;
      this.ctx.lineTo(Math.cos(a - tW * 0.28) * rInner, Math.sin(a - tW * 0.28) * rInner);
      this.ctx.lineTo(Math.cos(a - tW * 0.13) * rOuter, Math.sin(a - tW * 0.13) * rOuter);
      this.ctx.lineTo(Math.cos(a + tW * 0.13) * rOuter, Math.sin(a + tW * 0.13) * rOuter);
      this.ctx.lineTo(Math.cos(a + tW * 0.28) * rInner, Math.sin(a + tW * 0.28) * rInner);
    }
    this.ctx.closePath();

    if (spokes > 0) {
      // Découpe annulaire en 1 seul tracé (evenodd) pour laisser transparaître les roues coaxiales en dessous !
      const rimInner = r * 0.72;
      this.ctx.moveTo(rimInner, 0);
      this.ctx.arc(0, 0, rimInner, 0, Math.PI * 2, true);
      this.ctx.fillStyle = fillColor;
      this.ctx.fill('evenodd');
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Bras radiaux (rayons de la roue)
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        this.ctx.save();
        this.ctx.rotate(a);
        this.ctx.beginPath();
        this.ctx.rect(-2.5, holeRadius * 0.7, 5, rimInner - holeRadius * 0.7);
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.restore();
      }

      // Moyeu central (canon coaxial)
      this.ctx.beginPath();
      this.ctx.arc(0, 0, holeRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * 5. Dessine l'Ancre d'échappement et le Balancier-Spiral oscillant à droite sur l'axe y = 0
   */
  private drawEscapementAndBalance(
    anchorX: number,
    anchorY: number,
    balX: number,
    balY: number,
    balR: number,
    phase: number
  ): void {
    // A. Ancre d'échappement en (32, 0) qui bascule dans les dents de la roue des secondes (R=22)
    const rockAngle = Math.sin(phase) * 0.22;
    this.ctx.save();
    this.ctx.translate(anchorX, anchorY);
    this.ctx.rotate(rockAngle);

    this.ctx.beginPath();
    this.ctx.moveTo(-9, -11);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(-9, 11);
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(18, 0);
    this.ctx.strokeStyle = '#fbbf24';
    this.ctx.lineWidth = 2.8;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    // Palettes en rubis synthétique
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fillRect(-12, -13, 4, 4);
    this.ctx.fillRect(-12, 9, 4, 4);

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();
    this.ctx.restore();

    // B. Balancier-Spiral oscillant en (78, 0)
    const balanceAngle = Math.sin(phase) * 0.65;
    this.ctx.save();
    this.ctx.translate(balX, balY);

    // Coq de balancier (pont doré)
    this.ctx.beginPath();
    this.ctx.moveTo(0, -balR - 6);
    this.ctx.lineTo(0, balR + 6);
    this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    this.ctx.rotate(balanceAngle);

    // Serre-fil et jante du balancier en glucydur doré
    this.ctx.beginPath();
    this.ctx.arc(0, 0, balR, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Bras croisés du balancier
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(Math.cos(a) * balR, Math.sin(a) * balR);
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Spiral réglant au cœur du balancier (respire avec l'oscillation)
    this.ctx.beginPath();
    const hairspringScale = 1 + Math.sin(phase) * 0.12;
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const th = t * Math.PI * 6;
      const rad = (3 + t * 12) * hairspringScale;
      const hx = Math.cos(th) * rad;
      const hy = Math.sin(th) * rad;
      if (i === 0) this.ctx.moveTo(hx, hy);
      else this.ctx.lineTo(hx, hy);
    }
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 1.3;
    this.ctx.stroke();

    // Rubis antichoc Incabloc du balancier
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();

    this.ctx.restore();
  }

  /**
   * Dessine le cadran horloger et les 3 aiguilles COAXIALES solidaires de leurs roues respectives
   */
  private drawDialAndCoaxialHands(placedParts: string[]): void {
    const palette = Clock.getPalette(this.theme);
    const dialRadius = 165;

    if (this.showDial) {
      // Anneau tour d'heures périphérique (laisse tout le centre squelette parfaitement lisible)
      this.ctx.beginPath();
      this.ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
      this.ctx.arc(0, 0, 128, 0, Math.PI * 2, true);
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      this.ctx.fill('evenodd');

      // Minuterie (60 graduations)
      for (let i = 0; i < 60; i++) {
        const a = (i * Math.PI) / 30;
        const isHour = i % 5 === 0;
        const rIn = isHour ? 156 : 160;
        const rOut = 166;
        this.ctx.beginPath();
        this.ctx.moveTo(Math.sin(a) * rIn, -Math.cos(a) * rIn);
        this.ctx.lineTo(Math.sin(a) * rOut, -Math.cos(a) * rOut);
        this.ctx.strokeStyle = isHour ? palette.borderColor : 'rgba(148, 163, 184, 0.4)';
        this.ctx.lineWidth = isHour ? 2.5 : 1;
        this.ctx.stroke();
      }

      // Chiffres romains
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = 'bold 18px "Fredoka", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        this.ctx.fillText(numerals[i], Math.cos(angle) * 142, Math.sin(angle) * 142);
      }
    }

    // 1. Petite Aiguille des Heures (Jaune/Or) -> Solidaire de la Roue des Heures (3)
    if (placedParts.includes('hours')) {
      this.ctx.save();
      this.ctx.rotate(this.angleHours);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      this.ctx.shadowBlur = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 14);
      this.ctx.lineTo(-5, -18);
      this.ctx.lineTo(0, -84);
      this.ctx.lineTo(5, -18);
      this.ctx.closePath();
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.fill();
      this.ctx.strokeStyle = '#78350f';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 2. Grande Aiguille des Minutes (Bleue) -> Solidaire de la Roue des Minutes (4)
    if (placedParts.includes('minutes')) {
      this.ctx.save();
      this.ctx.rotate(this.angleMinutes);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      this.ctx.shadowBlur = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 18);
      this.ctx.lineTo(-3.8, -22);
      this.ctx.lineTo(0, -118);
      this.ctx.lineTo(3.8, -22);
      this.ctx.closePath();
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fill();
      this.ctx.strokeStyle = '#0c4a6e';
      this.ctx.lineWidth = 1.4;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 3. Trotteuse des Secondes (Rouge) -> Solidaire de la Roue des Secondes (5)
    if (placedParts.includes('seconds')) {
      this.ctx.save();
      this.ctx.rotate(this.angleSeconds);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      this.ctx.shadowBlur = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 24);
      this.ctx.lineTo(0, -130);
      this.ctx.strokeStyle = '#f43f5e';
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();

      // Contrepoids horloger de la trotteuse
      this.ctx.beginPath();
      this.ctx.arc(0, 16, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#f43f5e';
      this.ctx.fill();
      this.ctx.restore();
    }

    // 4. Rubis central d'axe coaxial
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();
  }
}
