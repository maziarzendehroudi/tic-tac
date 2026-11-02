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

  private currentScale: number = 1.44;
  private currentFocusX: number = 32;
  private currentFocusY: number = 0;

  public wormOffset: number = 0;
  public angleBarrel: number = 0;
  public angleHours: number = (10 * Math.PI) / 6;
  public angleRelayMinutes: number = 0;
  public angleMinutes: number = (10 * Math.PI) / 30;
  public angleRelaySeconds: number = 0;
  public angleSeconds: number = 0;

  private baseAngleHours: number = (10 * Math.PI) / 6;
  private baseAngleMinutes: number = (10 * Math.PI) / 30;

  private stepTimerMs: number = 0;
  private secondsStepIndex: number = 0;
  private prevSecondsAngle: number = 0;
  private targetSecondsAngle: number = 0;

  private windingStepAccumulator: number = 0;
  private isTicPhase: boolean = true;

  private onTickCallback?: (isTic: boolean) => void;
  private onWindingClickCallback?: () => void;

  public static readonly POS = {
    crown: { x: 178, y: 0 },
    spring: { x: 82, y: -41, r: 36, teeth: 12 },
    hours: { x: 0, y: 0, r: 56, teeth: 16 },
    relayMinutes: { x: 0, y: -76, rPinion: 20, teethPinion: 8, rWheel: 36, teethWheel: 12 },
    minutes: { x: 0, y: 0, r: 40, teeth: 12 },
    relaySeconds: { x: -68, y: 0, rPinion: 28, teethPinion: 10, rWheel: 44, teethWheel: 14 },
    seconds: { x: 0, y: 0, r: 24, teeth: 8 }
  };

  /**
   * Cibles des 4 boutons de zoom + vue globale dans le Canvas carré 500×500
   */
  private static readonly CAMERA_TARGETS: Record<WorkshopZoom, CameraTarget> = {
    overview: { scale: 1.44, x: 32, y: 0 },
    spring: { scale: 2.45, x: 108, y: -16 },
    hours: { scale: 2.35, x: 0, y: -14 },
    minutes: { scale: 2.45, x: 0, y: -38 },
    seconds: { scale: 2.45, x: -34, y: 0 }
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
    this.syncMeshedGears();
  }

  public setZoomMode(mode: WorkshopZoom): void {
    this.zoomMode = mode;
  }

  /**
   * Loi d'engrènement géométrique exacte entre deux roues dentées extérieures :
   * Calcule l'angle de la roue menée (driven) pour que chacune de ses dents
   * tombe pile au milieu du creux (valley) de la roue menante (driver).
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

  private syncMeshedGears(): void {
    const { spring, hours, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;

    this.angleBarrel = WatchMechanism.computeDrivenGearAngle(
      hours.x, hours.y, hours.teeth, this.angleHours,
      spring.x, spring.y, spring.teeth
    );

    this.angleRelayMinutes = WatchMechanism.computeDrivenGearAngle(
      minutes.x, minutes.y, minutes.teeth, this.angleMinutes,
      relayMinutes.x, relayMinutes.y, relayMinutes.teethWheel
    );

    this.angleRelaySeconds = WatchMechanism.computeDrivenGearAngle(
      seconds.x, seconds.y, seconds.teeth, this.angleSeconds,
      relaySeconds.x, relaySeconds.y, relaySeconds.teethWheel
    );
  }

  public isAtEndStop(): boolean {
    return this.power >= 100;
  }

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
    // 1. Interpolation fluide de la caméra vers la cible du bouton de zoom actif
    const targetCam = WatchMechanism.CAMERA_TARGETS[this.zoomMode];
    const camLerp = Math.min(1, deltaTime * 0.014);
    this.currentScale += (targetCam.scale - this.currentScale) * camLerp;
    this.currentFocusX += (targetCam.x - this.currentFocusX) * camLerp;
    this.currentFocusY += (targetCam.y - this.currentFocusY) * camLerp;

    const { spring } = WatchMechanism.POS;
    const threadPitch = 12;

    // 2. Remontage par la molette : S'ARRÊTE EN BOUT DE COURSE dès que power >= 100%
    if (isWinding && this.power < 100) {
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

    // 3. Marche simultanée et visible des 4 mécanismes (Secondes, Minutes, Heures, Ressort) :
    if (this.power > 0 && !isWinding) {
      const dischargeRate = this.realTimeMode ? 0.00025 : 0.0012;
      this.power = Math.max(0, this.power - deltaTime * dischargeRate);

      const stepPeriodMs = this.realTimeMode ? 1000 : 200;
      const stepAngleSec = Math.PI / 30; // 1 graduation = 6°

      const degToRad = Math.PI / 180;
      const dtSec = deltaTime / 1000;

      const minDegPerSec = this.realTimeMode ? 3.6 : 7.2;
      const hrDegPerSec = this.realTimeMode ? 2.2 : 3.8;

      this.baseAngleMinutes = (this.baseAngleMinutes + dtSec * minDegPerSec * degToRad) % (Math.PI * 2);
      this.baseAngleHours = (this.baseAngleHours + dtSec * hrDegPerSec * degToRad) % (Math.PI * 2);

      // Avancée SACCADÉE de la roue des secondes et déclenchement du son Tic-Tac des secondes
      this.stepTimerMs += deltaTime;
      while (this.stepTimerMs >= stepPeriodMs) {
        this.stepTimerMs -= stepPeriodMs;
        this.prevSecondsAngle = this.targetSecondsAngle;
        this.secondsStepIndex = (this.secondsStepIndex + 1) % 60;
        this.targetSecondsAngle = this.secondsStepIndex * stepAngleSec;

        this.onTickCallback?.(this.isTicPhase);
        this.isTicPhase = !this.isTicPhase;
      }

      const jumpDurationMs = Math.min(65, stepPeriodMs * 0.45);
      const jumpProgress = Math.min(1, this.stepTimerMs / jumpDurationMs);
      const easedJump = 1 - Math.pow(1 - jumpProgress, 3);

      let deltaStep = this.targetSecondsAngle - this.prevSecondsAngle;
      if (deltaStep < 0) deltaStep += Math.PI * 2;
      if (deltaStep > Math.PI) deltaStep = 0;
      this.angleSeconds = (this.prevSecondsAngle + deltaStep * easedJump) % (Math.PI * 2);

      const tickPulse = Math.sin(jumpProgress * Math.PI) * 0.008;
      this.angleMinutes = (this.baseAngleMinutes + tickPulse) % (Math.PI * 2);
      this.angleHours = (this.baseAngleHours + tickPulse * 0.6) % (Math.PI * 2);

      this.syncMeshedGears();
    }
  }

  /**
   * Dessine le mouvement :
   * - En 'overview' : affiche les 4 mécanismes et les 3 aiguilles.
   * - En zoom ('spring', 'hours', 'minutes', 'seconds') : masque complètement les autres mécanismes
   *   (aucun élément en gris transparent).
   */
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

    // 2. Mécanisme des Heures (affiché uniquement en Vue globale et en Zoom Heures)
    if (z === 'overview' || z === 'hours') {
      this.drawToyDiscGear(hours.x, hours.y, hours.r, hours.teeth, this.angleHours, '#fbbf24', '#b45309', '#fef3c7', 8);
    }

    // 3. Mécanisme Ressort / Molette (affiché uniquement en Vue globale et en Zoom Ressort/Molette)
    if (z === 'overview' || z === 'spring') {
      this.drawToyBarrel(spring.x, spring.y, spring.r, spring.teeth, this.angleBarrel, this.power);
      this.drawRightCrownAndWormStem(crown.x, crown.y, this.wormOffset, isWinding && this.power < 100);
    }

    // 4. Mécanisme des Minutes (affiché uniquement en Vue globale et en Zoom Minutes)
    if (z === 'overview' || z === 'minutes') {
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
    }

    // 5. Mécanisme des Secondes (affiché uniquement en Vue globale et en Zoom Secondes)
    if (z === 'overview' || z === 'seconds') {
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
    }

    // 6. Aiguilles correspondant strictement au mécanisme observé
    this.drawHandsOnly();

    this.ctx.restore();
  }

  private drawChassisWithBraceletStubs(): void {
    const borderColor = '#d97706';
    const z = this.zoomMode;

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

    // Affiche uniquement le pont du mécanisme actif (ou les 3 en vue globale)
    this.ctx.beginPath();
    if (z === 'overview' || z === 'spring') {
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(82, -41);
    }
    if (z === 'overview' || z === 'minutes') {
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(0, -76);
    }
    if (z === 'overview' || z === 'seconds') {
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(-68, 0);
    }
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
  }

  private drawRightCrownAndWormStem(x: number, y: number, offset: number, isActivelyWinding: boolean): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    const stemRight = -12;
    const stemLength = 122;
    const stemLeft = stemRight - stemLength;
    const wormZoneLeft = -124;
    const wormZoneRight = -68;
    const pitch = 12;
    const atMaxStop = this.power >= 100;

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(stemLeft, -5, stemLength, 10);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(stemLeft, -5, stemLength, 10);

    this.ctx.fillStyle = isActivelyWinding ? '#fde047' : '#e2e8f0';
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

    this.ctx.fillStyle = '#d97706';
    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(stemLeft - 6, -9, 10, 18, 3);
    this.ctx.fill();
    this.ctx.stroke();

    const travelStart = -26;
    const travelEnd = -60;
    const nutX = travelStart + (travelEnd - travelStart) * (this.power / 100);
    this.ctx.fillStyle = atMaxStop ? '#ef4444' : '#fbbf24';
    this.ctx.strokeStyle = '#78350f';
    this.ctx.lineWidth = 1.8;
    this.ctx.beginPath();
    this.ctx.roundRect(nutX, -8, 8, 16, 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#475569';
    this.ctx.fillRect(-64, -8, 4, 16);

    if (isActivelyWinding) {
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.shadowBlur = 18;
    }
    this.ctx.fillStyle = atMaxStop ? '#b45309' : isActivelyWinding ? '#f59e0b' : '#d97706';
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

  private drawHandsOnly(): void {
    const z = this.zoomMode;

    // En zoom 'spring' (Ressort / Molette), aucune aiguille centrale n'est dessinée
    if (z === 'spring') return;

    // Petite aiguille des Heures (uniquement en Vue globale et en Zoom Heures)
    if (z === 'overview' || z === 'hours') {
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
    }

    // Grande aiguille des Minutes (uniquement en Vue globale et en Zoom Minutes)
    if (z === 'overview' || z === 'minutes') {
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
    }

    // Trotteuse rouge des Secondes (uniquement en Vue globale et en Zoom Secondes)
    if (z === 'overview' || z === 'seconds') {
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
    }

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
