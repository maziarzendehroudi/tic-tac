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

  public power: number = 100;
  public zoomMode: WorkshopZoom = 'overview';
  public clutchEngagement: number = 0;

  private currentScale: number = 1.62;
  private currentFocusX: number = 16;
  private currentFocusY: number = 0;

  public wormOffset: number = 0;
  public angleBarrel: number = 0;
  public angleHours: number = 0;
  public angleRelayMinutes: number = 0;
  public angleMinutes: number = 0;
  public angleRelaySeconds: number = 0;
  public angleSeconds: number = 0;

  private stepTimerMs: number = 0;

  private windingStepAccumulator: number = 0;
  private isTicPhase: boolean = true;

  private onTickCallback?: (isTic: boolean) => void;
  private onWindingClickCallback?: () => void;

  /**
   * Calage géométrique V46 :
   * - relayMinutes.rPinion (24) + hours.r (52) = 76 px (distance exacte)
   * - hours.r (52) + spring.r (29) = 81 px (distance sqrt(73² + (-35)²) = 80.96 px)
   * - Rayon extérieur max du barillet depuis le centre : 80.96 + 29 + 3.2 = 113.16 px (< 114 px graduations)
   */
  public static readonly POS = {
    crown: { x: 138, y: 0 },
    spring: { x: 73, y: -35, r: 29, teeth: 12 },
    hours: { x: 0, y: 0, r: 52, teeth: 16 },
    relayMinutes: { x: 0, y: -76, rPinion: 24, teethPinion: 8, rWheel: 36, teethWheel: 14 },
    minutes: { x: 0, y: 0, r: 40, teeth: 12 },
    relaySeconds: { x: -68, y: 0, rPinion: 28, teethPinion: 8, rWheel: 44, teethWheel: 14 },
    seconds: { x: 0, y: 0, r: 24, teeth: 8 }
  };

  public static readonly CAMERA_TARGETS: Record<WorkshopZoom, CameraTarget> = {
    overview: { scale: 1.62, x: 16, y: 0 },
    spring: { scale: 2.65, x: 88, y: -16 },
    hours: { scale: 2.35, x: 24, y: -14 },
    minutes: { scale: 2.35, x: 14, y: -32 },
    seconds: { scale: 2.25, x: 0, y: -10 }
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
    this.initInitialGearMesh();
  }

  public setZoomMode(mode: WorkshopZoom): void {
    this.zoomMode = mode;
  }

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

  private initInitialGearMesh(): void {
    const { spring, hours, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;

    this.angleSeconds = 0;

    this.angleRelaySeconds = WatchMechanism.computeDrivenGearAngle(
      seconds.x, seconds.y, seconds.teeth, this.angleSeconds,
      relaySeconds.x, relaySeconds.y, relaySeconds.teethWheel
    );

    const rawAngleMinutes = WatchMechanism.computeDrivenGearAngle(
      relaySeconds.x, relaySeconds.y, relaySeconds.teethPinion, this.angleRelaySeconds,
      minutes.x, minutes.y, minutes.teeth
    );
    this.angleMinutes = rawAngleMinutes + 2 * ((Math.PI * 2) / minutes.teeth);

    this.angleRelayMinutes = WatchMechanism.computeDrivenGearAngle(
      minutes.x, minutes.y, minutes.teeth, this.angleMinutes,
      relayMinutes.x, relayMinutes.y, relayMinutes.teethWheel
    );

    const rawAngleHours = WatchMechanism.computeDrivenGearAngle(
      relayMinutes.x, relayMinutes.y, relayMinutes.teethPinion, this.angleRelayMinutes,
      hours.x, hours.y, hours.teeth
    );
    this.angleHours = rawAngleHours + 13 * ((Math.PI * 2) / hours.teeth);

    this.angleBarrel = WatchMechanism.computeDrivenGearAngle(
      hours.x, hours.y, hours.teeth, this.angleHours,
      spring.x, spring.y, spring.teeth
    );
  }

  private applyKinematicDelta(deltaSec: number): void {
    const { spring, hours, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;

    this.angleSeconds = (this.angleSeconds + deltaSec) % (Math.PI * 2);

    const dRelaySec = -deltaSec * (seconds.teeth / relaySeconds.teethWheel);
    this.angleRelaySeconds = (this.angleRelaySeconds + dRelaySec) % (Math.PI * 2);

    const dMin = -dRelaySec * (relaySeconds.teethPinion / minutes.teeth);
    this.angleMinutes = (this.angleMinutes + dMin) % (Math.PI * 2);

    const dRelayMin = -dMin * (minutes.teeth / relayMinutes.teethWheel);
    this.angleRelayMinutes = (this.angleRelayMinutes + dRelayMin) % (Math.PI * 2);

    const dHr = -dRelayMin * (relayMinutes.teethPinion / hours.teeth);
    this.angleHours = (this.angleHours + dHr) % (Math.PI * 2);

    const dBarrel = -dHr * (hours.teeth / spring.teeth);
    this.angleBarrel = (this.angleBarrel + dBarrel) % (Math.PI * 2);
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
      worldX >= 95 &&
      worldX <= 175 &&
      worldY >= -48 &&
      worldY <= 48
    );
  }

  public update(deltaTime: number, isWinding: boolean): void {
    const targetCam = WatchMechanism.CAMERA_TARGETS[this.zoomMode];
    const camLerp = Math.min(1, deltaTime * 0.014);
    this.currentScale += (targetCam.scale - this.currentScale) * camLerp;
    this.currentFocusX += (targetCam.x - this.currentFocusX) * camLerp;
    this.currentFocusY += (targetCam.y - this.currentFocusY) * camLerp;

    const { spring, hours } = WatchMechanism.POS;
    const threadPitch = 11;

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
      if (this.windingStepAccumulator >= 5.5) {
        this.windingStepAccumulator = 0;
        this.onWindingClickCallback?.();
      }

      const deltaBarrel = deltaWorm / spring.r;
      this.angleBarrel = (this.angleBarrel + deltaBarrel) % (Math.PI * 2);

      if (this.power >= 100) {
        const toothPitch = (Math.PI * 2) / spring.teeth;
        const idealMesh = WatchMechanism.computeDrivenGearAngle(
          hours.x, hours.y, hours.teeth, this.angleHours,
          spring.x, spring.y, spring.teeth
        );
        const diff = idealMesh - this.angleBarrel;
        this.angleBarrel += diff - Math.round(diff / toothPitch) * toothPitch;
      }
      return;
    }

    if (this.power > 0 && !isWinding) {
      const dischargeRate = 0.005;
      this.power = Math.max(0, this.power - deltaTime * dischargeRate);

      const stepPeriodMs = 1000;
      const stepAngleSec = Math.PI / 30;

      const prevBlended = this.getBlendedStepProgress(this.stepTimerMs, stepPeriodMs);
      this.stepTimerMs += deltaTime;

      let completedSteps = 0;
      while (this.stepTimerMs >= stepPeriodMs) {
        this.stepTimerMs -= stepPeriodMs;
        completedSteps++;

        this.onTickCallback?.(this.isTicPhase);
        this.isTicPhase = !this.isTicPhase;
      }

      const newBlended = this.getBlendedStepProgress(this.stepTimerMs, stepPeriodMs);
      const progressDelta = completedSteps - prevBlended + newBlended;
      const deltaSec = progressDelta * stepAngleSec;

      this.applyKinematicDelta(deltaSec);
    }
  }

  private getBlendedStepProgress(timerMs: number, stepPeriodMs: number): number {
    const jumpDurationMs = Math.min(75, stepPeriodMs * 0.45);
    const jumpProgress = Math.min(1, timerMs / jumpDurationMs);
    const cubicJump = 1 - Math.pow(1 - jumpProgress, 3);
    const linearCreep = timerMs / stepPeriodMs;
    return 0.72 * cubicJump + 0.28 * linearCreep;
  }

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

    // Opacité maximale cumulative selon le niveau de zoom :
    // - spring : ressort/molette
    // - hours : ressort/molette + heures
    // - minutes : ressort/molette + heures + minutes
    // - seconds : tout en opacité maximale
    const focusSpring = true;
    const focusHours = z === 'hours' || z === 'minutes' || z === 'seconds';
    const focusMinutes = z === 'minutes' || z === 'seconds';
    const focusSeconds = z === 'seconds';

    // 1. Début de bracelet (haut/bas) + Platine squelette avec les 60 graduations
    this.drawChassisWithBraceletStubs();

    // 2. Roue dorée des Heures
    this.drawWithFocus(focusHours, () => {
      this.drawToyDiscGear(hours.x, hours.y, hours.r, hours.teeth, this.angleHours, '#fbbf24', '#b45309', '#fef3c7', 8);
    });

    // 3. Barillet du Ressort et Molette à débrayage automatique
    this.drawWithFocus(focusSpring, () => {
      this.drawToyBarrel(spring.x, spring.y, spring.r, spring.teeth, this.angleBarrel, this.power);
      this.drawRightCrownWithAutoClutch(crown.x, crown.y, this.wormOffset, isWinding && this.power < 100);
    });

    // 4. Train des Minutes à double roue
    this.drawWithFocus(focusMinutes, () => {
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

    // 5. Train des Secondes à double roue
    this.drawWithFocus(focusSeconds, () => {
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

    // 6. Les 3 aiguilles
    this.drawHandsWithFocus(focusHours, focusMinutes, focusSeconds);

    this.ctx.restore();
  }

  private drawChassisWithBraceletStubs(): void {
    const borderColor = '#d97706';
    const { spring } = WatchMechanism.POS;

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
    this.ctx.lineTo(spring.x, spring.y);
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
    const stemLeft = -88;
    const stemLength = stemRight - stemLeft;
    const wormZoneLeft = -84;
    const wormZoneRight = -36;
    const pitch = 11;

    this.ctx.fillStyle = '#1e293b';
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 1.6;
    this.ctx.beginPath();
    this.ctx.roundRect(stemLeft - 6, -9, 10, 24, 3);
    this.ctx.fill();
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
      const tx = base - (offset % pitch);
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

    const drumR = r * 0.78;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, drumR, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.beginPath();
    const turns = 4;
    const innerR = 4.0;
    const outerR = drumR - 1.5;
    const tightness = power / 100;
    const exponent = 0.42 + tightness * 2.38;

    for (let i = 0; i <= 160; i++) {
      const t = i / 160;
      const theta = t * Math.PI * 2 * turns;
      const currentR = innerR + (outerR - innerR) * Math.pow(t, exponent);

      const px = Math.cos(theta) * currentR;
      const py = Math.sin(theta) * currentR;

      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }

    this.ctx.strokeStyle = power > 5 ? '#f97316' : '#64748b';
    this.ctx.lineWidth = 2.6;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(outerR, 0, 2.8, 0, Math.PI * 2);
    this.ctx.fillStyle = power > 5 ? '#f97316' : '#94a3b8';
    this.ctx.fill();
    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineWidth = 1.1;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
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
      this.ctx.fillRect(-3, rPinion * 0.6, 6, Math.max(2, rimHole - rPinion * 0.6));
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
    const rInner = r - 4.0;
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
      const dotOrbit = r - 9.5;
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

  private drawHandsWithFocus(
    focusHours: boolean,
    focusMinutes: boolean,
    focusSeconds: boolean
  ): void {
    this.drawWithFocus(focusHours, () => {
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

    this.drawWithFocus(focusMinutes, () => {
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

    this.drawWithFocus(focusSeconds, () => {
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

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e11d48';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();
  }
}
