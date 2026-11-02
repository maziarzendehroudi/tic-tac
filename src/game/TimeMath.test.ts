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

describe('WatchMechanism V31 — Rotation des 3 Aiguilles en Vitesse Réelle & Zoom Roue des Heures', () => {
  it('fait tourner visiblement les aiguilles des Heures, des Minutes ET des Secondes en mode Vitesse réelle', () => {
    let ticks = 0;
    const wm = new WatchMechanism(createMockCtx(), 500, 500, () => {
      ticks++;
    });
    wm.realTimeMode = true;
    wm.power = 80;

    const initialHours = wm.angleHours;
    const initialMinutes = wm.angleMinutes;
    const initialSeconds = wm.angleSeconds;

    // Avance de 1000 ms (1 seconde réelle) + 70 ms pour terminer le saut de la trotteuse
    wm.update(1000, false);
    wm.update(70, false);

    expect(ticks).toBe(1);
    expect(wm.angleSeconds).toBeGreaterThan(initialSeconds);
    expect(wm.angleMinutes).toBeGreaterThan(initialMinutes);
    expect(wm.angleHours).toBeGreaterThan(initialHours);
  });

  it('supporte le zoom dédié sur la Roue des Heures ("hours") et bloque la vis en bout de course à 100%', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    wm.setZoomMode('hours');
    expect(wm.zoomMode).toBe('hours');

    wm.power = 99.8;
    wm.update(100, true);
    expect(wm.power).toBe(100);
    const wormAtStop = wm.wormOffset;
    wm.update(400, true);
    expect(wm.wormOffset).toBe(wormAtStop);
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
