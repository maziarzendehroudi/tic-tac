export type WorkshopZoom = 'overview' | 'spring' | 'hours' | 'minutes' | 'seconds';

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
  public realTimeMode: boolean = true;
  public zoomMode: WorkshopZoom = 'overview';

  public clutchEngagement: number = 0;

  private currentScale: number = 1.72;
  private currentFocusX: number = 12;
  private currentFocusY: number = 0;

  public wormOffset: number = 0;
  public angleBarrel: number = 0;
  public angleHours: number = 0;
  public angleRelayMinutes: number = 0;
  public angleMinutes: number = 0;
  public angleRelaySeconds: number = 0;
  public angleSeconds: number = 0;

  private stepTimerMs: number = 0;
  private secondsStepIndex: number = 0;
  private prevSecondsAngle: number = 0;
  private targetSecondsAngle: number = 0;

  private windingStepAccumulator: number = 0;
  private isTicPhase: boolean = true;

  private onTickCallback?: (isTic: boolean) => void;
  private onWindingClickCallback?: () => void;

  /**
   * Géométrie horlogère à entraxes exacts (R1 + R2 = Distance centre à centre) :
   * - Contact 1 : hours (0,0, r=56, Z=16) <-> spring (82,-41, r=36, Z=12) => Distance = 91.7 px (≈ 56+36 = 92 px)
   * - Contact 2 : hours (0,0, r=56, Z=16) <-> relayMinutes.pinion (0,-76, r=20, Z=8) => Distance = 76 px (56+20 = 76 px)
   * - Contact 3 : relayMinutes.wheel (0,-76, r=36, Z=14) <-> minutes (0,0, r=40, Z=12) => Distance = 76 px (36+40 = 76 px)
   * - Contact 4 : minutes (0,0, r=40, Z=12) <-> relaySeconds.pinion (-68,0, r=28, Z=8) => Distance = 68 px (40+28 = 68 px)
   * - Contact 5 : relaySeconds.wheel (-68,0, r=44, Z=14) <-> seconds (0,0, r=24, Z=8) => Distance = 68 px (44+24 = 68 px)
   */
  public static readonly POS = {
    crown: { x: 138, y: 0 },
    spring: { x: 82, y: -41, r: 36, teeth: 12 },
    hours: { x: 0, y: 0, r: 56, teeth: 16 },
    relayMinutes: { x: 0, y: -76, rPinion: 20, teethPinion: 8, rWheel: 36, teethWheel: 14 },
    minutes: { x: 0, y: 0, r: 40, teeth: 12 },
    relaySeconds: { x: -68, y: 0, rPinion: 28, teethPinion: 8, rWheel: 44, teethWheel: 14 },
    seconds: { x: 0, y: 0, r: 24, teeth: 8 }
  };

  public static readonly CAMERA_TARGETS: Record<WorkshopZoom, CameraTarget> = {
    overview: { scale: 1.72, x: 12, y: 0 },
    spring: { scale: 2.65, x: 96, y: -18 },
    hours: { scale: 2.45, x: 0, y: -14 },
    minutes: { scale: 2.55, x: 0, y: -38 },
    seconds: { scale: 2.55, x: -34, y: 0 }
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
    this.syncFullKinematicChain();
  }

  public setZoomMode(mode: WorkshopZoom): void {
    this.zoomMode = mode;
  }

  /**
   * Loi d'engrènement géométrique exacte entre deux roues dentées extérieures :
   * Calcule l'angle de la roue menée (driven) pour que chacune de ses dents
   * tombe pile au milieu du creux (valley) de la roue menante (driver), sans jamais glisser ni se chevaucher.
   */
  public static computeDrivenGearAngle(
    driverX: number,
    driverY: number,
    driverTeeth: number,
    driverAngle: number,
    drivenX: number,
    drivenY: number,
    drivenTeeth: number
  ): number {
    const angleDriverToDriven = Math.atan2(drivenY - driverY, drivenX - driverX);
    const angleDrivenToDriver = Math.atan2(driverY - drivenY, driverX - drivenX);
    const halfToothDriven = Math.PI / drivenTeeth;
    return (
      angleDrivenToDriver +
      halfToothDriven -
      (driverAngle - angleDriverToDriven) * (driverTeeth / drivenTeeth)
    );
  }

  /**
   * Chaîne cinématique intégrale à 5 contacts verrouillés :
   * Chaque pignon et chaque roue est entraîné par la denture exacte de l'étage adjacent.
   * Les décalages de posture initiale (2 pas de dent sur les minutes = +60°, 13 pas sur les heures = ~10h)
   * sont des multiples entiers exacts du pas de denture (2π/Z), ce qui préserve l'engrènement au micron près !
   */
  private syncFullKinematicChain(): void {
    const { spring, hours, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;

    // 1. Contact 5 : Roue des secondes (Z=8) <-> Grande roue du relais des secondes (Z=14)
    this.angleRelaySeconds = WatchMechanism.computeDrivenGearAngle(
      seconds.x, seconds.y, seconds.teeth, this.angleSeconds,
      relaySeconds.x, relaySeconds.y, relaySeconds.teethWheel
    );

    // 2. Contact 4 : Pignon du relais des secondes (Z=8) <-> Roue des minutes (Z=12)
    // + décalage de 2 dents entières (2 * 2π/12) pour orienter l'aiguille des minutes vers 10 min
    const rawAngleMinutes = WatchMechanism.computeDrivenGearAngle(
      relaySeconds.x, relaySeconds.y, relaySeconds.teethPinion, this.angleRelaySeconds,
      minutes.x, minutes.y, minutes.teeth
    );
    this.angleMinutes = rawAngleMinutes + 2 * ((Math.PI * 2) / minutes.teeth);

    // 3. Contact 3 : Roue des minutes (Z=12) <-> Grande roue du relais des minutes (Z=14)
    this.angleRelayMinutes = WatchMechanism.computeDrivenGearAngle(
      minutes.x, minutes.y, minutes.teeth, this.angleMinutes,
      relayMinutes.x, relayMinutes.y, relayMinutes.teethWheel
    );

    // 4. Contact 2 : Pignon du relais des minutes (Z=8) <-> Roue des heures (Z=16)
    // + décalage de 13 dents entières (13 * 2π/16) pour orienter la petite aiguille vers ~10h
    const rawAngleHours = WatchMechanism.computeDrivenGearAngle(
      relayMinutes.x, relayMinutes.y, relayMinutes.teethPinion, this.angleRelayMinutes,
      hours.x, hours.y, hours.teeth
    );
    this.angleHours = rawAngleHours + 13 * ((Math.PI * 2) / hours.teeth);

    // 5. Contact 1 : Roue des heures (Z=16) <-> Barillet du ressort (Z=12)
    this.angleBarrel = WatchMechanism.computeDrivenGearAngle(
      hours.x, hours.y, hours.teeth, this.angleHours,
      spring.x, spring.y, spring.teeth
    );
  }

  public isAtEndStop(): boolean {
    return this.power >= 100;
  }

  public isClutchEngaged(): boolean {
    return this.clutchEngagement > 0.5;
  }

  public isPointInCrown(canvasX: number, canvasY: number): boolean {
    const worldX = (canvasX - this.width / 2) / this.currentScale + this.currentFocusX;
    const worldY = (canvasY - this.height / 2) / this.currentScale + this.currentFocusY;
    return (
      worldX >= 115 &&
      worldX <= 168 &&
      worldY >= -35 &&
      worldY <= 35
    );
  }

  public update(deltaTime: number, isWinding: boolean): void {
    // 1. Interpolation fluide de la caméra
    const targetCam = WatchMechanism.CAMERA_TARGETS[this.zoomMode];
    const camLerp = Math.min(1, deltaTime * 0.014);
    this.currentScale += (targetCam.scale - this.currentScale) * camLerp;
    this.currentFocusX += (targetCam.x - this.currentFocusX) * camLerp;
    this.currentFocusY += (targetCam.y - this.currentFocusY) * camLerp;

    const { spring } = WatchMechanism.POS;
    const threadPitch = 12;

    // 2. Débrayage automatique de la molette
    const activelyWinding = isWinding && this.power < 100;
    const targetClutch = activelyWinding ? 1 : 0;
    const clutchLerp = Math.min(1, deltaTime * 0.025);
    this.clutchEngagement += (targetClutch - this.clutchEngagement) * clutchLerp;

    if (activelyWinding) {
      const prevPower = this.power;
      this.power = Math.min(100, this.power + deltaTime * 0.065);
      const effectiveDt = (this.power - prevPower) / 0.065;

      const deltaWorm = effectiveDt * 0.09;
      this.wormOffset = (this.wormOffset + deltaWorm) % threadPitch;

      this.windingStepAccumulator += deltaWorm;
      if (this.windingStepAccumulator >= 6.0) {
        this.windingStepAccumulator = 0;
        this.onWindingClickCallback?.();
      }

      const deltaBarrel = -deltaWorm / spring.r;
      this.angleBarrel = (this.angleBarrel + deltaBarrel) % (Math.PI * 2);
      return;
    }

    // 3. Marche de la chaîne cinématique complète :
    // - En Vitesse réelle : 1 battement = 1000 ms (1 seconde exacte)
    // - En Mode accéléré  : 5 battements/s = 200 ms
    // L'impulsion saccadée de la seconde (65% saut franc + 35% glissement de maintien) entraîne
    // l'intégralité du train d'engrenages sans qu'aucune roue ne paraisse figée entre deux battements.
    if (this.power > 0 && !isWinding) {
      const dischargeRate = this.realTimeMode ? 0.00025 : 0.0012;
      this.power = Math.max(0, this.power - deltaTime * dischargeRate);

      const stepPeriodMs = this.realTimeMode ? 1000 : 200;
      const stepAngleSec = Math.PI / 30; // 1 seconde = 6°

      this.stepTimerMs += deltaTime;
      while (this.stepTimerMs >= stepPeriodMs) {
        this.stepTimerMs -= stepPeriodMs;
        this.prevSecondsAngle = this.targetSecondsAngle;
        this.secondsStepIndex = (this.secondsStepIndex + 1) % 60;
        this.targetSecondsAngle = this.secondsStepIndex * stepAngleSec;

        this.onTickCallback?.(this.isTicPhase);
        this.isTicPhase = !this.isTicPhase;
      }

      const jumpDurationMs = Math.min(75, stepPeriodMs * 0.45);
      const jumpProgress = Math.min(1, this.stepTimerMs / jumpDurationMs);
      const cubicJump = 1 - Math.pow(1 - jumpProgress, 3);
      const linearCreep = this.stepTimerMs / stepPeriodMs;

      // Combine la saccade franche de la trotteuse (72%) et l'entraînement continu du train (28%)
      const blendedProgress = 0.72 * cubicJump + 0.28 * linearCreep;

      let deltaStep = this.targetSecondsAngle - this.prevSecondsAngle;
      if (deltaStep < 0) deltaStep += Math.PI * 2;
      if (deltaStep > Math.PI) deltaStep = 0;

      this.angleSeconds = (this.prevSecondsAngle + deltaStep * blendedProgress) % (Math.PI * 2);

      // Verrouille instantanément les 5 engrènements (Secondes -> Relais Sec -> Minutes -> Relais Min -> Heures -> Ressort)
      this.syncFullKinematicChain();
    }
  }

  /**
   * Applique un rendu normal (opaque + couleurs vives) sur le mécanisme actif,
   * et un rendu GRIS TRANSPARENT (grayscale + globalAlpha = 0.20) sur les autres éléments lors d'un zoom.
   */
  private drawWithFocus(isFocused: boolean, drawFn: () => void): void {
    this.ctx.save();
    if (this.zoomMode !== 'overview' && !isFocused) {
      this.ctx.globalAlpha = 0.20;
      this.ctx.filter = 'grayscale(100%)';
    } else {
      this.ctx.globalAlpha = 1;
      this.ctx.filter = 'none';
    }
    drawFn();
    this.ctx.restore();
  }

  public draw(isWinding: boolean): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.currentScale, this.currentScale);
    this.ctx.translate(-this.currentFocusX, -this.currentFocusY);

    const { crown, spring, hours, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;
    const z = this.zoomMode;

    // 1. Début de bracelet (haut/bas) + Platine squelette avec les 60 graduations
    this.drawChassisWithBraceletStubs();

    // 2. Roue dorée des Heures (mise en valeur dans Zoom Heures, et visible en gris transparent dans les autres zooms)
    this.drawWithFocus(z === 'hours', () => {
      this.drawToyDiscGear(hours.x, hours.y, hours.r, hours.teeth, this.angleHours, '#fbbf24', '#b45309', '#fef3c7', 8);
    });

    // 3. Barillet du Ressort et Molette à débrayage automatique (mis en valeur dans Zoom Ressort/Molette)
    this.drawWithFocus(z === 'spring', () => {
      this.drawToyBarrel(spring.x, spring.y, spring.r, spring.teeth, this.angleBarrel, this.power);
      this.drawRightCrownWithAutoClutch(crown.x, crown.y, this.wormOffset, isWinding && this.power < 100);
    });

    // 4. Train des Minutes à double roue (mis en valeur dans Zoom Minutes)
    this.drawWithFocus(z === 'minutes', () => {
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
    });

    // 5. Train des Secondes à double roue (mis en valeur dans Zoom Secondes)
    this.drawWithFocus(z === 'seconds', () => {
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
    });

    // 6. Les 3 aiguilles (l'aiguille du mécanisme zoomé est vive, les autres sont en gris transparent)
    this.drawHandsWithFocus();

    this.ctx.restore();
  }

  private drawChassisWithBraceletStubs(): void {
    const borderColor = '#d97706';

    this.ctx.fillStyle = '#334155';
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 3;
    [-1, 1].forEach(dir => {
      this.ctx.beginPath();
      this.ctx.roundRect(-48, dir * 114 - (dir === 1 ? 0 : 24), 96, 24, 6);
      this.ctx.fill();
      this.ctx.stroke();
    });

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 126, 0, Math.PI * 2);
    this.ctx.fillStyle = '#090d16';
    this.ctx.fill();
    this.ctx.lineWidth = 4.5;
    this.ctx.strokeStyle = borderColor;
    this.ctx.stroke();

    for (let i = 0; i < 60; i++) {
      const isFive = i % 5 === 0;
      const a = (i * Math.PI) / 30;
      const rOut = 122;
      const rIn = isFive ? 114 : 118;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.sin(a) * rIn, -Math.cos(a) * rIn);
      this.ctx.lineTo(Math.sin(a) * rOut, -Math.cos(a) * rOut);
      this.ctx.strokeStyle = isFive ? '#fbbf24' : 'rgba(148, 163, 184, 0.38)';
      this.ctx.lineWidth = isFive ? 2.4 : 1.2;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(82, -41);
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, -76);
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(-68, 0);
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
  }

  private drawRightCrownWithAutoClutch(x: number, y: number, offset: number, isActivelyWinding: boolean): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    const disengageRatio = 1 - this.clutchEngagement;
    const dropY = disengageRatio * 7.5;
    const pushOutX = disengageRatio * 5.0;

    const stemRight = -6 + pushOutX;
    const stemLeft = -84;
    const stemLength = stemRight - stemLeft;
    const wormZoneLeft = -80;
    const wormZoneRight = -32;
    const pitch = 11;

    this.ctx.fillStyle = '#1e293b';
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 1.6;
    this.ctx.beginPath();
    this.ctx.roundRect(stemLeft - 6, -9, 10, 24, 3);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.strokeStyle = isActivelyWinding ? '#fbbf24' : '#38bdf8';
    this.ctx.lineWidth = 1.8;
    for (let s = 0; s < 3; s++) {
      const sy = -7 + s * 2.2 + dropY * 0.3;
      this.ctx.moveTo(stemLeft - 4, sy);
      this.ctx.lineTo(stemLeft + 2, sy + 1.2);
    }
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.translate(0, dropY);

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(stemLeft, -4.5, stemLength, 9);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.8;
    this.ctx.strokeRect(stemLeft, -4.5, stemLength, 9);

    this.ctx.fillStyle = isActivelyWinding ? '#fde047' : '#cbd5e1';
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.5;

    for (let base = wormZoneLeft; base <= wormZoneRight + pitch; base += pitch) {
      const tx = base + (offset % pitch);
      if (tx < wormZoneLeft - 2 || tx > wormZoneRight - 4) continue;

      this.ctx.beginPath();
      this.ctx.moveTo(tx, -4.5);
      this.ctx.lineTo(tx + 2.2, -9.5);
      this.ctx.lineTo(tx + 5.8, -9.5);
      this.ctx.lineTo(tx + 8, -4.5);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(tx + 5.8, -4.5);
      this.ctx.lineTo(tx + 2.2, 4.5);
      this.ctx.strokeStyle = '#475569';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    this.ctx.fillStyle = '#d97706';
    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 1.8;
    this.ctx.beginPath();
    this.ctx.roundRect(stemLeft - 4, -7.5, 7, 15, 2);
    this.ctx.fill();
    this.ctx.stroke();

    const neckLeft = -24;
    const neckRight = stemRight;
    this.ctx.beginPath();
    this.ctx.strokeStyle = isActivelyWinding ? '#fde047' : '#38bdf8';
    this.ctx.lineWidth = 2;
    const coils = 4;
    const coilStep = (neckRight - neckLeft) / coils;
    for (let c = 0; c < coils; c++) {
      const cx = neckLeft + c * coilStep;
      this.ctx.moveTo(cx, -6.5);
      this.ctx.lineTo(cx + coilStep * 0.5, 6.5);
      this.ctx.lineTo(cx + coilStep, -6.5);
    }
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.translate(pushOutX, 0);
    if (isActivelyWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 14;
    }
    this.ctx.fillStyle = isActivelyWinding ? '#f59e0b' : '#d97706';
    this.ctx.beginPath();
    this.ctx.roundRect(-6, -19, 20, 38, 7);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let i = -12; i <= 12; i += 6) {
      this.ctx.moveTo(-2, i);
      this.ctx.lineTo(10, i);
    }
    this.ctx.strokeStyle = '#fde68a';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.restore();
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

  private drawHandsWithFocus(): void {
    const z = this.zoomMode;

    // Petite aiguille des Heures
    this.drawWithFocus(z === 'hours', () => {
      this.ctx.save();
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
    });

    // Grande aiguille des Minutes
    this.drawWithFocus(z === 'minutes', () => {
      this.ctx.save();
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
    });

    // Trotteuse rouge des Secondes
    this.drawWithFocus(z === 'seconds', () => {
      this.ctx.save();
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
    });

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
