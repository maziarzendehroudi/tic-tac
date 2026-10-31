import { Clock } from './Clock';
import type { DialTheme } from './SaveManager';

export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  public power: number = 75;
  public showDial: boolean = true;
  private theme: DialTheme = 'classic';

  // Angles des roues principales (Sens horaire +) et des engrenages relais (Sens anti-horaire -)
  private wormOffset: number = 0;
  public angleBarrel: number = 0;
  public angleHours: number = (10 * Math.PI) / 6;
  public angleRelayMinutes: number = 0;
  public angleMinutes: number = (10 * Math.PI) / 30;
  public angleRelaySeconds: number = 0;
  public angleSeconds: number = 0;

  // Accumulateurs acoustiques
  private toothStepAccumulator: number = 0;
  private windingStepAccumulator: number = 0;
  private isTicPhase: boolean = true;

  private onTickCallback?: (isTic: boolean) => void;
  private onWindingClickCallback?: () => void;

  /**
   * Géométrie exacte des contacts dent-contre-dent (Proposition Mécanique A) :
   * - 9h : Barillet (-92, 0, R=36) -> touche Roue Heures Jaune (0, 0, R=56) en (-56, 0) [36 + 56 = 92]
   * - 12h : Relais Bleu (0, -76) :
   *     * Pignon d'entrée (R=20) -> touche Roue Heures Jaune (R=56) en (0, -56) [20 + 56 = 76]
   *     * Roue de sortie (R=36)  -> touche Roue Minutes Bleue (0, 0, R=40) en (0, -40) [36 + 40 = 76]
   * - 3h : Relais Rouge (68, 0) :
   *     * Pignon d'entrée (R=28) -> touche Roue Minutes Bleue (R=40) en (40, 0) [28 + 40 = 68]
   *     * Roue de sortie (R=44)  -> touche Roue Secondes Rouge (0, 0, R=24) en (24, 0) [44 + 24 = 68]
   * - 6h : Cliquet Tic-Tac (0, 35) -> rebondit sur les dents de la Roue Secondes Rouge (R=24)
   */
  private static readonly POS = {
    crown: { x: -194, y: 0 },
    spring: { x: -92, y: 0, r: 36, teeth: 12 },
    hours: { x: 0, y: 0, r: 56, teeth: 16 },
    relayMinutes: { x: 0, y: -76, rPinion: 20, teethPinion: 8, rWheel: 36, teethWheel: 12 },
    minutes: { x: 0, y: 0, r: 40, teeth: 12 },
    relaySeconds: { x: 68, y: 0, rPinion: 28, teethPinion: 10, rWheel: 44, teethWheel: 14 },
    seconds: { x: 0, y: 0, r: 24, teeth: 8 },
    clicker: { x: 0, y: 35 }
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

  public isPointInCrown(canvasX: number, canvasY: number): boolean {
    const localX = canvasX - this.width / 2;
    const localY = canvasY - this.height / 2;
    return (
      localX >= -235 &&
      localX <= -150 &&
      localY >= -45 &&
      localY <= 45
    );
  }

  public update(deltaTime: number, placedParts: string[], isWinding: boolean): void {
    const hasCrown = placedParts.includes('crown');
    const hasSpring = placedParts.includes('spring');
    const hasHours = placedParts.includes('hours');
    const hasMinutes = placedParts.includes('minutes');
    const hasSeconds = placedParts.includes('seconds');

    // 1. REMONTAGE : La Molette (1) tourne et tend le Ressort (2)
    if (isWinding && hasCrown) {
      const deltaWorm = deltaTime * 0.08;
      this.wormOffset = (this.wormOffset + deltaWorm) % 10;

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

    // 2. TRANSMISSION SÉQUENTIELLE : Ressort (2) -> Heures (3) -> Minutes (4) -> Secondes (5)
    if (hasSpring && hasHours && this.power > 0 && !isWinding) {
      this.power = Math.max(0, this.power - deltaTime * 0.0012);

      // Vitesses pédagogiques bien visibles :
      // - Heures (Jaune)   : Lente
      // - Minutes (Bleue)  : 4x plus rapide que les Heures (entraînée par le Relais Bleu à 12h)
      // - Secondes (Rouge) : 12x plus rapide que les Heures (entraînée par le Relais Rouge à 3h)
      const deltaSec = (deltaTime / 1000) * (Math.PI / 3);
      const deltaMin = deltaSec / 4;
      const deltaHr = deltaSec / 12;

      const { spring, hours, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;

      // A. Le Ressort (-) pousse la Grande Roue Jaune des Heures (+)
      this.angleBarrel -= deltaHr * (hours.r / spring.r);
      this.angleHours = (this.angleHours + deltaHr) % (Math.PI * 2);

      // B. Si les Minutes (4) sont montées : la Roue Jaune (+) fait tourner le Relais Bleu (-), qui pousse la Roue Bleue (+)
      if (hasMinutes) {
        this.angleRelayMinutes = (this.angleRelayMinutes - deltaMin * (minutes.r / relayMinutes.rWheel)) % (Math.PI * 2);
        this.angleMinutes = (this.angleMinutes + deltaMin) % (Math.PI * 2);

        // C. Si les Secondes (5) sont AUSSI montées : la Roue Bleue (+) fait tourner le Relais Rouge (-), qui pousse la Roue Rouge (+)
        if (hasSeconds) {
          this.angleRelaySeconds = (this.angleRelaySeconds - deltaSec * (seconds.r / relaySeconds.rWheel)) % (Math.PI * 2);
          this.angleSeconds = (this.angleSeconds + deltaSec) % (Math.PI * 2);

          // Cliquet Tic-Tac calé sur les 8 dents de la Roue Rouge
          const toothPitch = (Math.PI * 2) / seconds.teeth;
          this.toothStepAccumulator += deltaSec;
          if (this.toothStepAccumulator >= toothPitch) {
            this.toothStepAccumulator %= toothPitch;
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

    const { crown, spring, hours, relayMinutes, minutes, relaySeconds, seconds, clicker } = WatchMechanism.POS;

    // 1. Boîtier horloger
    this.drawBasePlate();

    // 2. Pièce 1 : Molette à gauche (9h)
    this.drawPart('crown', '1. Molette', placedParts, unlockedParts, -162, -44, () => {
      this.drawCenteredCrownAndStem(crown.x, crown.y, this.wormOffset, isWinding);
    });

    // 3. Pièce 2 : Le Ressort dans son Barillet à 9h (touche la Grande Roue Jaune)
    this.drawPart('spring', '2. Ressort', placedParts, unlockedParts, spring.x, -56, () => {
      this.drawToyBarrel(spring.x, spring.y, spring.r, spring.teeth, this.angleBarrel, this.power);
    });

    // 4. Pièce 3 : Grande Roue Jaune des Heures au centre (0, 0)
    this.drawPart('hours', '3. Heures', placedParts, unlockedParts, -58, 66, () => {
      this.drawToyDiscGear(
        hours.x,
        hours.y,
        hours.r,
        hours.teeth,
        this.angleHours,
        '#fbbf24',
        '#b45309',
        '#fef3c7',
        8
      );
    });

    // 5. Pièce 4 : Engrenage Relais Bleu (à 12h) + Roue Bleue des Minutes (au centre)
    this.drawPart('minutes', '4. Minutes', placedParts, unlockedParts, 0, -96, () => {
      // Relais multiplicateur Bleu en haut (0, -76) : prend sur la Roue Jaune et pousse la Roue Bleue
      this.drawSteppedRelayGear(
        relayMinutes.x,
        relayMinutes.y,
        relayMinutes.rPinion,
        relayMinutes.teethPinion,
        relayMinutes.rWheel,
        relayMinutes.teethWheel,
        this.angleRelayMinutes,
        '#fbbf24',
        '#0284c7',
        '#38bdf8'
      );
      // Roue centrale Bleue des Minutes (0, 0) dont les dents touchent le Relais Bleu en (0, -40)
      this.drawToyDiscGear(
        minutes.x,
        minutes.y,
        minutes.r,
        minutes.teeth,
        this.angleMinutes,
        '#38bdf8',
        '#0284c7',
        '#e0f2fe',
        6
      );
    });

    // 6. Pièce 5 : Engrenage Relais Rouge (à 3h) + Petite Roue Rouge des Secondes (au centre) + Cliquet Tic-Tac (à 6h)
    this.drawPart('seconds', '5. Secondes', placedParts, unlockedParts, 82, 56, () => {
      // Relais multiplicateur Rouge à droite (68, 0) : prend sur la Roue Bleue et pousse la Roue Rouge
      this.drawSteppedRelayGear(
        relaySeconds.x,
        relaySeconds.y,
        relaySeconds.rPinion,
        relaySeconds.teethPinion,
        relaySeconds.rWheel,
        relaySeconds.teethWheel,
        this.angleRelaySeconds,
        '#38bdf8',
        '#be123c',
        '#f43f5e'
      );
      // Petite Roue centrale Rouge des Secondes (0, 0) dont les dents touchent le Relais Rouge en (24, 0)
      this.drawToyDiscGear(
        seconds.x,
        seconds.y,
        seconds.r,
        seconds.teeth,
        this.angleSeconds,
        '#f43f5e',
        '#be123c',
        '#ffe4e6',
        4
      );
      // Petit cliquet Tic-Tac en bas (0, 35) qui rebondit sur les dents de la Roue Rouge
      this.drawSimpleTicTacClicker(clicker.x, clicker.y, this.angleSeconds * seconds.teeth);
    });

    // 7. Cadran (1 à 12) et les 3 aiguilles au centre (apparaissent une par une avec leurs roues !)
    this.drawChildFriendlyDialAndHands(placedParts);

    this.ctx.restore();
  }

  private drawBasePlate(): void {
    const palette = Clock.getPalette(this.theme);

    // Attaches du bracelet
    this.ctx.fillStyle = '#334155';
    this.ctx.strokeStyle = palette.borderColor;
    this.ctx.lineWidth = 3;
    [-1, 1].forEach(dir => {
      this.ctx.beginPath();
      this.ctx.roundRect(-52, dir * 162 - (dir === 1 ? 0 : 24), 104, 24, 6);
      this.ctx.fill();
      this.ctx.stroke();
    });

    // Boîtier rond principal
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 174, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.lineWidth = 8;
    this.ctx.strokeStyle = palette.borderColor;
    this.ctx.stroke();

    // Fond intérieur de l'atelier
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 126, 0, Math.PI * 2);
    this.ctx.fillStyle = '#090d16';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.stroke();
  }

  private drawPart(
    id: string,
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
      // Silhouette fantôme de la pièce à son emplacement
      this.ctx.save();
      this.ctx.globalAlpha = isUnlocked ? 0.22 : 0.09;
      this.ctx.filter = 'grayscale(100%)';
      drawFunc();
      this.ctx.restore();

      // Pastille numérotée
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.roundRect(badgeX - 36, badgeY - 11, 72, 22, 8);
      this.ctx.fillStyle = isUnlocked ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.72)';
      this.ctx.fill();
      this.ctx.strokeStyle = isUnlocked ? '#fbbf24' : '#475569';
      this.ctx.lineWidth = 1.6;
      this.ctx.stroke();

      this.ctx.fillStyle = isUnlocked ? '#fbbf24' : '#64748b';
      this.ctx.font = 'bold 10.5px "Fredoka", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(label, badgeX, badgeY);
      this.ctx.restore();
    }
  }

  private drawCenteredCrownAndStem(x: number, y: number, offset: number, isWinding: boolean): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    // Tige crantée reliant la Molette au Ressort (-194 + 68 = -126)
    const stemStart = 12;
    const stemLength = 56;
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(stemStart, -7, stemLength, 14);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(stemStart, -7, stemLength, 14);

    this.ctx.beginPath();
    for (let i = stemStart + 4; i < stemStart + stemLength - 4; i += 10) {
      const threadX = i + (offset % 10);
      this.ctx.moveTo(threadX, -7);
      this.ctx.lineTo(threadX + 4, 7);
    }
    this.ctx.strokeStyle = '#f8fafc';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    if (isWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 18;
    }
    this.ctx.fillStyle = isWinding ? '#f59e0b' : '#d97706';
    this.ctx.beginPath();
    this.ctx.roundRect(-22, -28, 34, 56, 10);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let i = -18; i <= 18; i += 9) {
      this.ctx.moveTo(-18, i);
      this.ctx.lineTo(8, i);
    }
    this.ctx.strokeStyle = '#fde68a';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawToyBarrel(x: number, y: number, r: number, teeth: number, angle: number, power: number): void {
    this.drawToyDiscGear(x, y, r, teeth, angle, '#94a3b8', '#475569', '#cbd5e1', 0);

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.beginPath();
    const turns = 3.5;
    const innerR = 5;
    const outerR = r * 0.68;
    const tightness = power / 100;
    const exponent = 0.6 + tightness * 1.6;

    for (let i = 0; i <= 140; i++) {
      const t = i / 140;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (outerR - innerR) * Math.pow(t, exponent);

      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;

      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }

    this.ctx.strokeStyle = power > 10 ? '#f97316' : '#64748b';
    this.ctx.lineWidth = 3.2;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.fill();

    this.ctx.restore();
  }

  /**
   * Dessine un Engrenage Relais Étagé (Proposition Mécanique A) :
   * - Une couronne extérieure ajourée (couleur de la roue cible) qui pousse les dents de la roue centrale suivante.
   * - Un pignon intérieur (couleur de la roue source) qui reçoit la force de la roue précédente.
   */
  private drawSteppedRelayGear(
    x: number,
    y: number,
    rPinion: number,
    teethPinion: number,
    rWheel: number,
    teethWheel: number,
    angle: number,
    pinionColor: string,
    wheelStroke: string,
    wheelFill: string
  ): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // 1. Grande couronne extérieure ajourée (qui pousse la roue centrale cible)
    this.ctx.beginPath();
    const tW = (Math.PI * 2) / teethWheel;
    const rIn = rWheel - 3.8;
    const rOut = rWheel + 3.0;

    for (let i = 0; i < teethWheel; i++) {
      const a = i * tW;
      this.ctx.lineTo(Math.cos(a - tW * 0.3) * rIn, Math.sin(a - tW * 0.3) * rIn);
      this.ctx.lineTo(Math.cos(a - tW * 0.15) * rOut, Math.sin(a - tW * 0.15) * rOut);
      this.ctx.lineTo(Math.cos(a + tW * 0.15) * rOut, Math.sin(a + tW * 0.15) * rOut);
      this.ctx.lineTo(Math.cos(a + tW * 0.3) * rIn, Math.sin(a + tW * 0.3) * rIn);
    }
    this.ctx.closePath();

    // Découpe intérieure pour voir le pignon d'entrée
    const rimHole = rWheel * 0.68;
    this.ctx.moveTo(rimHole, 0);
    this.ctx.arc(0, 0, rimHole, 0, Math.PI * 2, true);
    this.ctx.fillStyle = wheelFill;
    this.ctx.fill('evenodd');
    this.ctx.strokeStyle = wheelStroke;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // 4 bras reliant le pignon d'entrée à la couronne de sortie
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      this.ctx.save();
      this.ctx.rotate(a);
      this.ctx.fillStyle = wheelFill;
      this.ctx.fillRect(-3, rPinion * 0.6, 6, rimHole - rPinion * 0.6);
      this.ctx.restore();
    }

    // 2. Pignon central d'entrée (qui s'engrène avec la roue précédente)
    this.ctx.beginPath();
    const tpW = (Math.PI * 2) / teethPinion;
    const rpIn = rPinion - 3.0;
    const rpOut = rPinion + 2.5;
    for (let i = 0; i < teethPinion; i++) {
      const a = i * tpW;
      this.ctx.lineTo(Math.cos(a - tpW * 0.3) * rpIn, Math.sin(a - tpW * 0.3) * rpIn);
      this.ctx.lineTo(Math.cos(a - tpW * 0.15) * rpOut, Math.sin(a - tpW * 0.15) * rpOut);
      this.ctx.lineTo(Math.cos(a + tpW * 0.15) * rpOut, Math.sin(a + tpW * 0.15) * rpOut);
      this.ctx.lineTo(Math.cos(a + tpW * 0.3) * rpIn, Math.sin(a + tpW * 0.3) * rpIn);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = pinionColor;
    this.ctx.fill();
    this.ctx.strokeStyle = wheelStroke;
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();

    // Axe rubis du relais
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawToyDiscGear(
    x: number,
    y: number,
    r: number,
    teeth: number,
    angle: number,
    fillColor: string,
    strokeColor: string,
    dotColor: string,
    dotsCount: number
  ): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    this.ctx.shadowBlur = 6;

    this.ctx.beginPath();
    const tW = (Math.PI * 2) / teeth;
    const rInner = r - 4.2;
    const rOuter = r + 3.2;

    for (let i = 0; i < teeth; i++) {
      const a = i * tW;
      this.ctx.lineTo(Math.cos(a - tW * 0.32) * rInner, Math.sin(a - tW * 0.32) * rInner);
      this.ctx.lineTo(Math.cos(a - tW * 0.16) * rOuter, Math.sin(a - tW * 0.16) * rOuter);
      this.ctx.lineTo(Math.cos(a + tW * 0.16) * rOuter, Math.sin(a + tW * 0.16) * rOuter);
      this.ctx.lineTo(Math.cos(a + tW * 0.32) * rInner, Math.sin(a + tW * 0.32) * rInner);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2.4;
    this.ctx.stroke();

    if (dotsCount > 0) {
      const dotOrbit = r - 10;
      this.ctx.fillStyle = dotColor;
      for (let i = 0; i < dotsCount; i++) {
        const a = (i / dotsCount) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.arc(Math.cos(a) * dotOrbit, Math.sin(a) * dotOrbit, 3.0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  /**
   * Petit cliquet "Tic-Tac" en bas (0, 35) qui rebondit sur les dents de la Roue Rouge
   */
  private drawSimpleTicTacClicker(x: number, y: number, toothPhase: number): void {
    const bounce = Math.abs(Math.sin(toothPhase * 0.5)) * 0.35;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(bounce);

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(-5, -12);
    this.ctx.lineTo(5, -10);
    this.ctx.closePath();
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.fill();
    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawChildFriendlyDialAndHands(placedParts: string[]): void {
    const palette = Clock.getPalette(this.theme);
    const dialRadius = 165;

    if (this.showDial) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
      this.ctx.arc(0, 0, 125, 0, Math.PI * 2, true);
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      this.ctx.fill('evenodd');

      for (let i = 1; i <= 12; i++) {
        const a = (i * Math.PI) / 6;
        this.ctx.beginPath();
        this.ctx.moveTo(Math.sin(a) * 156, -Math.cos(a) * 156);
        this.ctx.lineTo(Math.sin(a) * 165, -Math.cos(a) * 165);
        this.ctx.strokeStyle = palette.borderColor;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        this.ctx.fillStyle = '#f8fafc';
        this.ctx.font = 'bold 21px "Fredoka", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(i.toString(), Math.sin(a) * 141, -Math.cos(a) * 141);
      }
    }

    // 1. Petite Aiguille JAUNE (Heures)
    if (placedParts.includes('hours')) {
      this.ctx.save();
      this.ctx.rotate(this.angleHours);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      this.ctx.shadowBlur = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 12);
      this.ctx.lineTo(0, -82);
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 10;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      this.ctx.strokeStyle = '#78350f';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 2. Grande Aiguille BLEUE (Minutes)
    if (placedParts.includes('minutes')) {
      this.ctx.save();
      this.ctx.rotate(this.angleMinutes);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      this.ctx.shadowBlur = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 16);
      this.ctx.lineTo(0, -116);
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 7;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 3. Fine Aiguille ROUGE (Secondes)
    if (placedParts.includes('seconds')) {
      this.ctx.save();
      this.ctx.rotate(this.angleSeconds);
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      this.ctx.shadowBlur = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 20);
      this.ctx.lineTo(0, -128);
      this.ctx.strokeStyle = '#f43f5e';
      this.ctx.lineWidth = 3.5;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 4. Rubis central
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 7, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();
  }
}
