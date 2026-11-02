import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    roundRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fill: () => {},
    stroke: () => {}
  } as unknown as CanvasRenderingContext2D;
}

describe('WatchMechanism V32 — Ratio Horloger Exact (1:60:720), Engrènement des Secondes & Pinch-to-Zoom', () => {
  it('respecte strictement la loi horlogère 1:60:720 en temps réel comme en accéléré (60s = +1 min pile = +1/12e heure)', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    wm.realTimeMode = true;
    wm.power = 90;

    const startMin = wm.angleMinutes;
    const startHr = wm.angleHours;

    // Avance de 60 vraies secondes (60 pas de 1000 ms)
    for (let s = 0; s < 60; s++) {
      wm.update(1000, false);
    }

    // L'aiguille des minutes a avancé d'exactement 1 minute (π/30 rad = 6°)
    const deltaMin = wm.angleMinutes - startMin;
    expect(deltaMin).toBeCloseTo(Math.PI / 30, 4);

    // L'aiguille des heures a avancé d'exactement 1/12e de minute (π/360 rad = 0.5°)
    const deltaHr = wm.angleHours - startHr;
    expect(deltaHr).toBeCloseTo(Math.PI / 360, 4);
  });

  it('cale les dents de la roue relais des secondes en opposition de phase (creux face aux pointes) avec la roue des secondes', () => {
    const { relaySeconds, seconds } = WatchMechanism.POS;
    const angleRelayAtZero = WatchMechanism.computeDrivenGearAngle(
      seconds.x, seconds.y, seconds.teeth, 0,
      relaySeconds.x, relaySeconds.y, relaySeconds.teethWheel
    );
    // À angleSeconds = 0, l'angle de relaySeconds ne doit jamais être un multiple exact du pas (2π/14), mais décalé d'un demi-pas (π/14)
    const toothPitch = (Math.PI * 2) / relaySeconds.teethWheel;
    const remainder = ((angleRelayAtZero % toothPitch) + toothPitch) % toothPitch;
    expect(remainder).toBeCloseTo(toothPitch / 2, 4);
  });

  it('supporte le zoom au pincement (zoomAtPoint), le glissement (panBy) et le retour à la vue globale', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    expect(wm.isZoomedIn()).toBe(false);

    wm.zoomAtPoint(2.0, 320, 220);
    expect(wm.isZoomedIn()).toBe(true);
    expect(wm.selectedOrgan).toBe('spring');

    wm.panBy(-80, 40);
    wm.resetCamera();
    expect(wm.isZoomedIn()).toBe(false);
    expect(wm.selectedOrgan).toBe('overview');
  });
});

describe('QuestionManager & SaveManager — Cohérence Globale', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0
    };
  });

  it('génère toujours un leurre sur l’heure ET un leurre sur les minutes aux niveaux 2 à 7', () => {
    for (let lvl = 2; lvl <= 7; lvl++) {
      const qm = new QuestionManager(lvl);
      const target = qm.generateQuestion();
      const choices = qm.generateChoices(target);
      expect(choices.some(c => c.minutes !== target.minutes)).toBe(true);
      expect(choices.some(c => c.hours !== target.hours)).toBe(true);
    }
  });

  it('mentionne les nombres oranges uniquement au Niveau 5, et le calcul +12 dès le Niveau 6', () => {
    expect(TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 5)).toContain('orange');
    expect(TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 6)).toContain('ajoute 12');

    let save = SaveManager.load();
    save = SaveManager.applyLevelRewards(save, 7, 3);
    expect(SaveManager.isWorkshopUnlocked(save)).toBe(true);
    const sound = new SoundEngine(false);
    expect(() => sound.playWindingClick()).not.toThrow();
  });
});
