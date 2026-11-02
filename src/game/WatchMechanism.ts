export interface WatchPart {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  radius: number;
  teeth: number;
  color: string;
  speedRatio: number;
  placed: boolean;
}

export class WatchMechanism {
  private ctx: CanvasRenderingContext2D;
  private radius: number;
  private animId: number = 0;
  private isActive: boolean = false;
  private tickPhase: number = 0;
  private onPartPlaced?: (part: WatchPart, placedCount: number, total: number) => void;

  public parts: WatchPart[] = [
    {
      id: 'barrel',
      name: '1. Le Barillet',
      role: 'Son ressort stocke l’énergie quand on remonte la montre !',
      x: -76,
      y: 58,
      radius: 54,
      teeth: 24,
      color: '#d97706',
      speedRatio: 0.25,
      placed: false
    },
    {
      id: 'center',
      name: '2. La Roue de Centre',
      role: 'Placée au milieu, elle fait un tour complet en 60 minutes et porte les aiguilles !',
      x: 0,
      y: 0,
      radius: 44,
      teeth: 20,
      color: '#f59e0b',
      speedRatio: -0.6,
      placed: false
    },
    {
      id: 'third',
      name: '3. La Grande Moyenne',
      role: 'Elle transmet l’énergie de la roue de centre vers la roue des secondes.',
      x: 68,
      y: 36,
      radius: 36,
      teeth: 16,
      color: '#eab308',
      speedRatio: 1.2,
      placed: false
    },
    {
      id: 'escape',
      name: '4. La Roue d’Échappement',
      role: 'Elle libère l’énergie dent par dent en faisant « Tic-Tac » !',
      x: 56,
      y: -52,
      radius: 28,
      teeth: 12,
      color: '#38bdf8',
      speedRatio: -2.4,
      placed: false
    },
    {
      id: 'balance',
      name: '5. Le Balancier-Spiral',
      role: 'C’est le cœur de la montre : il oscille régulièrement pour garder l’heure exacte !',
      x: -54,
      y: -64,
      radius: 46,
      teeth: 0,
      color: '#ec4899',
      speedRatio: 1,
      placed: false
    }
  ];

  constructor(
    canvas: HTMLCanvasElement,
    onPartPlaced?: (part: WatchPart, placedCount: number, total: number) => void
  ) {
    this.ctx = canvas.getContext('2d')!;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    this.radius = Math.min(centerX, centerY) - 16;
    this.ctx.translate(centerX, centerY);
    this.onPartPlaced = onPartPlaced;
  }

  public start(): void {
    if (this.isActive) return;
    this.isActive = true;
    const loop = () => {
      if (!this.isActive) return;
      this.tickPhase += 0.035;
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isActive = false;
    cancelAnimationFrame(this.animId);
  }

  public resetAssembly(): void {
    this.parts.forEach(p => {
      p.placed = false;
    });
  }

  public placeNextPart(partId?: string): WatchPart | null {
    const target = partId
      ? this.parts.find(p => p.id === partId && !p.placed)
      : this.parts.find(p => !p.placed);
    if (!target) return null;
    target.placed = true;
    const count = this.getPlacedCount();
    if (this.onPartPlaced) {
      this.onPartPlaced(target, count, this.parts.length);
    }
    return target;
  }

  public getPlacedCount(): number {
    return this.parts.filter(p => p.placed).length;
  }

  public isComplete(): boolean {
    return this.parts.every(p => p.placed);
  }

  private drawGear(
    x: number,
    y: number,
    radius: number,
    teeth: number,
    color: string,
    angle: number,
    isGhost: boolean
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (isGhost) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(225, 29, 72, 0.45)';
      ctx.fill();
      ctx.restore();
      return;
    }

    // Dents de l'engrenage
    if (teeth > 0) {
      ctx.fillStyle = color;
      for (let i = 0; i < teeth; i++) {
        const a = (i * Math.PI * 2) / teeth;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.roundRect(-4, -(radius + 6), 8, 10, 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Couronne de la roue
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = color;
    ctx.stroke();

    // 4 rayons horlogers
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -radius + 4);
      ctx.lineTo(0, radius - 4);
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    }

    // Rubis d'axe horloger
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fde047';
    ctx.stroke();

    ctx.restore();
  }

  public draw(): void {
    const ctx = this.ctx;
    const r = this.radius;
    ctx.clearRect(-r - 16, -r - 16, (r + 16) * 2, (r + 16) * 2);

    const complete = this.isComplete();

    // 1. Platine horlogère (Côtes de Genève sombres)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = complete ? '#fbbf24' : '#475569';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 8, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 12;
    for (let x = -r; x <= r; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, -r);
      ctx.lineTo(x, r);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Dessin des 5 organes (emplacements fantômes ou pièces actives)
    this.parts.forEach((part, index) => {
      const isSpinning = complete || part.placed;
      let angle = isSpinning ? this.tickPhase * part.speedRatio : 0;
      if (part.id === 'balance' && isSpinning) {
        angle = Math.sin(this.tickPhase * 4) * 0.85;
      }

      this.drawGear(
        part.x,
        part.y,
        part.radius,
        part.teeth,
        part.color,
        angle,
        !part.placed
      );

      // Numéro d'emplacement si non posé
      if (!part.placed) {
        ctx.font = '700 18px "Fredoka", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${index + 1}`, part.x, part.y - 22);
      }
    });

    // 3. Si le calibre est complet, les aiguilles squelettes tournent au-dessus du mouvement !
    if (complete) {
      for (let i = 1; i <= 12; i++) {
        const a = (i * Math.PI) / 6;
        const tx = (r - 22) * Math.sin(a);
        const ty = -(r - 22) * Math.cos(a);
        ctx.font = '700 18px "Fredoka", sans-serif';
        ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), tx, ty);
      }

      const demoMinAngle = this.tickPhase * 0.4;
      const demoHrAngle = demoMinAngle / 12 + Math.PI / 3;

      ctx.save();
      ctx.rotate(demoHrAngle);
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, -(r * 0.48));
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.88)';
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(demoMinAngle);
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(0, -(r * 0.72));
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.stroke();
      ctx.restore();
    }
  }
}
