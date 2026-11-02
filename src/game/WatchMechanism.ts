export type WorkshopZoom = 'overview' | 'spring' | 'minutes' | 'seconds';

interface CameraTarget {
  scale: number;
  x: number;
  y: number;
}

export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  public power: number = 80;
  public showDial: boolean = true;
  public realTimeMode: boolean = false;
  public zoomMode: WorkshopZoom = 'overview';

  private currentScale: number = 1.14;
  private currentFocusX: number = 10;
  private currentFocusY: number = 0;

  private wormOffset: number = 0;
  public angleBarrel: number = 0;
  public angleHours: number = (10 * Math.PI) / 6;
  public angleRelayMinutes: number = 0;
  public angleMinutes: number = (10 * Math.PI) / 30;
  public angleRelaySeconds: number = 0;
  public angleSeconds: number = 0;

  private toothStepAccumulator: number = 0;
  private windingStepAccumulator: number = 0;
  private isTicPhase: boolean = true;

  private onTickCallback?: (isTic: boolean) => void;
  private onWindingClickCallback?: () => void;

  /**
   * Disposition horlogère en miroir avec Molette à droite (3h) :
   * - Molette ('crown') à droite (x = +178, y = 0), tige filetée vers la gauche jusqu'au palier (x = +58).
   * - Barillet du ressort ('spring', r = 36, 12 dents) à droite en (x = +82, y = -41) :
   *   1) Ses dents inférieures (y = -5) engrènent dans la vis sans fin (y = 0).
   *   2) Sa distance à la roue des heures (0, 0, r = 56, 16 dents) vaut √(82² + 41²) = 91.68 px (≈ 36 + 56 = 92 px).
   * - Relais des secondes ('relaySeconds') basculé à gauche (x = -68, y = 0).
   */
  public static readonly POS = {
    crown: { x: 178, y: 0 },
    spring: { x: 82, y: -41, r: 36, teeth: 12 },
    hours: { x: 0, y: 0, r: 56, teeth: 16 },
    relayMinutes: { x: 0, y: -76, rPinion: 20, teethPinion: 8, rWheel: 36, teethWheel: 12 },
    minutes: { x: 0, y: 0, r: 40, teeth: 12 },
    relaySeconds: { x: -68, y: 0, rPinion: 28, teethPinion: 10, rWheel: 44, teethWheel: 14 },
    seconds: { x: 0, y: 0, r: 24, teeth: 8 },
    escapement: { x: 0, y: 38 }
  };

  private static readonly CAMERA_TARGETS: Record<WorkshopZoom, CameraTarget> = {
    overview: { scale: 1.14, x: 10, y: 0 },
    spring: { scale: 2.05, x: 92, y: -18 },
    minutes: { scale: 2.05, x: 0, y: -42 },
    seconds: { scale: 2.05, x: -26, y: 12 }
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
    this.syncBarrelPhaseWithHours();
  }

  public setZoomMode(mode: WorkshopZoom): void {
    this.zoomMode = mode;
  }

  private syncBarrelPhaseWithHours(): void {
    const { spring, hours } = WatchMechanism.POS;
    const angleHtoS = Math.atan2(spring.y - hours.y, spring.x - hours.x);
    const angleStoH = Math.atan2(hours.y - spring.y, hours.x - spring.x);
    const halfToothSpring = Math.PI / spring.teeth;
    this.angleBarrel =
      angleStoH +
      halfToothSpring -
      (this.angleHours - angleHtoS) * (hours.teeth / spring.teeth);
  }

  /**
   * Convertit les coordonnées écran du toucher en coordonnées du mécanisme (tenant compte du zoom actif)
   */
  public isPointInCrown(canvasX: number, canvasY: number): boolean {
    const worldX = (canvasX - this.width / 2) / this.currentScale + this.currentFocusX;
    const worldY = (canvasY - this.height / 2) / this.currentScale + this.currentFocusY;
    return (
      worldX >= 135 &&
      worldX <= 220 &&
      worldY >= -45 &&
      worldY <= 45
    );
  }

  public update(deltaTime: number, isWinding: boolean): void {
    // 1. Interpolation fluide de la caméra (Loupe d'Horloger)
    const targetCam = WatchMechanism.CAMERA_TARGETS[this.zoomMode];
    const camLerp = Math.min(1, deltaTime * 0.012);
    this.currentScale += (targetCam.scale - this.currentScale) * camLerp;
    this.currentFocusX += (targetCam.x - this.currentFocusX) * camLerp;
    this.currentFocusY += (targetCam.y - this.currentFocusY) * camLerp;

    const { spring, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;
    const threadPitch = 12;

    // 2. Remontage par la molette de droite (vis sans fin entraînant le ressort)
    if (isWinding) {
      const deltaWorm = deltaTime * 0.09;
      this.wormOffset = (this.wormOffset + deltaWorm) % threadPitch;

      this.windingStepAccumulator += deltaWorm;
      if (this.windingStepAccumulator >= 6.0) {
        this.windingStepAccumulator = 0;
        this.onWindingClickCallback?.();
      }

      const deltaBarrel = -deltaWorm / spring.r;
      this.angleBarrel = (this.angleBarrel + deltaBarrel) % (Math.PI * 2);
      if (this.power < 100) {
        this.power = Math.min(100, this.power + deltaTime * 0.065);
      }
    }

    // 3. Marche du mouvement (Mode Accéléré vs Mode Vitesse Réelle)
    if (this.power > 0 && !isWinding) {
      const dischargeRate = this.realTimeMode ? 0.00015 : 0.0014;
      this.power = Math.max(0, this.power - deltaTime * dischargeRate);

      // En vitesse réelle : 1 tour de trotteuse en 60 s (soit π/30 rad/s).
      // En vitesse accélérée : démonstration cinématique où l'on voit tourner toutes les roues !
      const deltaSec = this.realTimeMode
        ? (deltaTime / 1000) * (Math.PI / 30)
        : (deltaTime / 1000) * (Math.PI / 2.5);

      const deltaMin = this.realTimeMode ? deltaSec / 60 : deltaSec / 4;
      const deltaHr = this.realTimeMode ? deltaMin / 12 : deltaSec / 12;

      this.angleHours = (this.angleHours + deltaHr) % (Math.PI * 2);
      this.syncBarrelPhaseWithHours();

      this.angleRelayMinutes =
        (this.angleRelayMinutes - deltaMin * (minutes.teeth / relayMinutes.teethWheel)) % (Math.PI * 2);
      this.angleMinutes = (this.angleMinutes + deltaMin) % (Math.PI * 2);

      this.angleRelaySeconds =
        (this.angleRelaySeconds - deltaSec * (seconds.teeth / relaySeconds.teethWheel)) % (Math.PI * 2);
      this.angleSeconds = (this.angleSeconds + deltaSec) % (Math.PI * 2);

      const toothPitch = (Math.PI * 2) / seconds.teeth;
      this.toothStepAccumulator += deltaSec;
      if (this.toothStepAccumulator >= toothPitch) {
        this.toothStepAccumulator %= toothPitch;
        this.onTickCallback?.(this.isTicPhase);
        this.isTicPhase = !this.isTicPhase;
      }
    }
  }

  private getGroupAlpha(group: 'spring' | 'minutes' | 'seconds'): number {
    if (this.zoomMode === 'overview') return 1;
    if (this.zoomMode === group) return 1;
    return 0.22;
  }

  public draw(isWinding: boolean): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.currentScale, this.currentScale);
    this.ctx.translate(-this.currentFocusX, -this.currentFocusY);

    const { crown, spring, hours, relayMinutes, minutes, relaySeconds, seconds, escapement } = WatchMechanism.POS;

    // 1. Platine squelette épurée (sans boîtier ni cornes de bracelet)
    this.drawMinimalChassis();

    // 2. Roue des Heures (active dans les zooms 'spring' et 'minutes')
    this.ctx.save();
    this.ctx.globalAlpha =
      this.zoomMode === 'overview' || this.zoomMode === 'spring' || this.zoomMode === 'minutes' ? 1 : 0.25;
    this.drawToyDiscGear(hours.x, hours.y, hours.r, hours.teeth, this.angleHours, '#fbbf24', '#b45309', '#fef3c7', 8);
    this.ctx.restore();

    // 3. Barillet du Ressort et Molette à droite (Zoom 1 : 'spring')
    this.ctx.save();
    this.ctx.globalAlpha = this.getGroupAlpha('spring');
    this.drawToyBarrel(spring.x, spring.y, spring.r, spring.teeth, this.angleBarrel, this.power);
    this.drawRightCrownAndWormStem(crown.x, crown.y, this.wormOffset, isWinding);
    this.ctx.restore();

    // 4. Train des Minutes à double roue (Zoom 2 : 'minutes')
    this.ctx.save();
    this.ctx.globalAlpha =
      this.zoomMode === 'overview' || this.zoomMode === 'minutes' || this.zoomMode === 'seconds' ? 1 : 0.22;
    if (this.zoomMode === 'seconds') this.ctx.globalAlpha = 0.45;
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
    this.drawToyDiscGear(minutes.x, minutes.y, minutes.r, minutes.teeth, this.angleMinutes, '#38bdf8', '#0284c7', '#e0f2fe', 6);
    this.ctx.restore();

    // 5. Train des Secondes à gauche & Échappement Tic-Tac en bas (Zoom 3 : 'seconds')
    this.ctx.save();
    this.ctx.globalAlpha = this.getGroupAlpha('seconds');
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
    this.drawToyDiscGear(seconds.x, seconds.y, seconds.r, seconds.teeth, this.angleSeconds, '#f43f5e', '#be123c', '#ffe4e6', 4);
    this.drawSimpleTicTacClicker(escapement.x, escapement.y, this.angleSeconds * seconds.teeth);
    this.ctx.restore();

    // 6. Aiguilles et repères horaires
    this.drawDialAndHands();

    this.ctx.restore();
  }

  /**
   * Platine squelette légère sans boîtier massif ni attaches de bracelet
   */
  private drawMinimalChassis(): void {
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 124, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
    this.ctx.fill();
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    this.ctx.stroke();

    // Ponts horlogers fins reliant les axes
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(82, -41);
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, -76);
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(-68, 0);
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, 38);
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
  }

  /**
   * Dessine la molette à DROITE (x = +178) et sa tige à vis sans fin qui s'étend vers la gauche
   * sous la roue dentée du ressort (x = +82) jusqu'au palier en laiton (x = +54).
   */
  private drawRightCrownAndWormStem(x: number, y: number, offset: number, isWinding: boolean): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    const stemRight = -12;
    const stemLength = 122; // De x = +166 jusqu'à x = +44 (passe sous le ressort centré en x = +82)
    const stemLeft = stemRight - stemLength; // -134 en coordonnées locales
    const wormZoneLeft = -124; // Zone filetée de x = +54 à x = +110
    const wormZoneRight = -68;
    const pitch = 12;

    // 1. Arbre métallique principal
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(stemLeft, -5, stemLength, 10);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(stemLeft, -5, stemLength, 10);

    // 2. Filets trapézoïdaux de la vis sans fin (en prise directe avec le bas du ressort à y ≈ -5)
    this.ctx.fillStyle = isWinding ? '#fde047' : '#e2e8f0';
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.6;

    for (let base = wormZoneLeft; base <= wormZoneRight + pitch; base += pitch) {
      const tx = base + (offset % pitch);
      if (tx < wormZoneLeft - 2 || tx > wormZoneRight - 4) continue;

      this.ctx.beginPath();
      this.ctx.moveTo(tx, -5);
      this.ctx.lineTo(tx + 2.5, -10);
      this.ctx.lineTo(tx + 6.5, -10);
      this.ctx.lineTo(tx + 9, -5);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(tx + 6.5, -5);
      this.ctx.lineTo(tx + 2.5, 5);
      this.ctx.strokeStyle = '#475569';
      this.ctx.lineWidth = 2.2;
      this.ctx.stroke();
    }

    // 3. Palier de maintien en laiton à l'extrémité gauche de la vis (x = +44)
    this.ctx.fillStyle = '#d97706';
    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(stemLeft - 6, -9, 10, 18, 3);
    this.ctx.fill();
    this.ctx.stroke();

    // 4. Molette extérieure crantée à droite
    if (isWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 18;
    }
    this.ctx.fillStyle = isWinding ? '#f59e0b' : '#d97706';
    this.ctx.beginPath();
    this.ctx.roundRect(-12, -28, 34, 56, 10);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let i = -18; i <= 18; i += 9) {
      this.ctx.moveTo(-6, i);
      this.ctx.lineTo(18, i);
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

    // Spires du ressort qui se contractent vers le centre quand l'énergie monte à 100%
    // et se détendent vers le bord quand l'énergie baisse !
    this.ctx.beginPath();
    const turns = 3.8;
    const innerR = 4.5;
    const tightness = power / 100;
    const maxCoilR = r * (0.72 - tightness * 0.22);
    const exponent = 0.65 + tightness * 1.45;

    for (let i = 0; i <= 150; i++) {
      const t = i / 150;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (maxCoilR - innerR) * Math.pow(t, exponent);

      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;

      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }

    this.ctx.strokeStyle = power > 15 ? '#f97316' : '#64748b';
    this.ctx.lineWidth = 3.2;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.fill();

    this.ctx.restore();
  }

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

    const rimHole = rWheel * 0.68;
    this.ctx.moveTo(rimHole, 0);
    this.ctx.arc(0, 0, rimHole, 0, Math.PI * 2, true);
    this.ctx.fillStyle = wheelFill;
    this.ctx.fill('evenodd');
    this.ctx.strokeStyle = wheelStroke;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      this.ctx.save();
      this.ctx.rotate(a);
      this.ctx.fillStyle = wheelFill;
      this.ctx.fillRect(-3, rPinion * 0.6, 6, rimHole - rPinion * 0.6);
      this.ctx.restore();
    }

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

  private drawSimpleTicTacClicker(x: number, y: number, toothPhase: number): void {
    const bounce = Math.sin(toothPhase) * 0.28;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(bounce);

    this.ctx.beginPath();
    this.ctx.arc(0, 14, 16, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#fbbf24';
    this.ctx.lineWidth = 3.5;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(0, 14);
    this.ctx.lineTo(-6, -14);
    this.ctx.lineTo(6, -12);
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

  private drawDialAndHands(): void {
    if (this.showDial && this.zoomMode === 'overview') {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 146, 0, Math.PI * 2);
      this.ctx.arc(0, 0, 118, 0, Math.PI * 2, true);
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      this.ctx.fill('evenodd');

      for (let i = 1; i <= 12; i++) {
        const a = (i * Math.PI) / 6;
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.font = 'bold 18px "Fredoka", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(i.toString(), Math.sin(a) * 132, -Math.cos(a) * 132);
      }
    }

    // Petite aiguille des Heures
    this.ctx.save();
    this.ctx.globalAlpha = this.zoomMode === 'seconds' ? 0.25 : 1;
    this.ctx.rotate(this.angleHours);
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    this.ctx.shadowBlur = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 12);
    this.ctx.lineTo(0, -76);
    this.ctx.strokeStyle = '#fbbf24';
    this.ctx.lineWidth = 9;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();
    this.ctx.restore();

    // Grande aiguille des Minutes
    this.ctx.save();
    this.ctx.globalAlpha = this.zoomMode === 'spring' || this.zoomMode === 'seconds' ? 0.25 : 1;
    this.ctx.rotate(this.angleMinutes);
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    this.ctx.shadowBlur = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 16);
    this.ctx.lineTo(0, -108);
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 6.5;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
    this.ctx.restore();

    // Trotteuse rouge des Secondes
    this.ctx.save();
    this.ctx.globalAlpha = this.zoomMode === 'spring' || this.zoomMode === 'minutes' ? 0.25 : 1;
    this.ctx.rotate(this.angleSeconds);
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 18);
    this.ctx.lineTo(0, -118);
    this.ctx.strokeStyle = '#f43f5e';
    this.ctx.lineWidth = 3.2;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
    this.ctx.restore();

    // Rubis central
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();
  }
}
