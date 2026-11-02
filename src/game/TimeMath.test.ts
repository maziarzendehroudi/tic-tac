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

describe('WatchMechanism V30 — Bout de course à 100%, Trotteuse saccadée & Tic-Tac 1 seconde', () => {
  it('bloque la vis sans fin et le barillet en bout de course dès que le ressort atteint 100%', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    wm.power = 99.5;
    wm.update(100, true); // Atteint 100%
    expect(wm.power).toBe(100);
    expect(wm.isAtEndStop()).toBe(true);

    const wormAtStop = wm.wormOffset;
    const barrelAtStop = wm.angleBarrel;

    // On continue à maintenir la molette à 100% : rien ne doit plus bouger (bout de course)
    wm.update(500, true);
    expect(wm.wormOffset).toBe(wormAtStop);
    expect(wm.angleBarrel).toBe(barrelAtStop);
  });

  it('déclenche le son Tic-Tac exactement toutes les 1000 ms (1 seconde) en mode Vitesse réelle et avance par saccades', () => {
    let ticks = 0;
    const wm = new WatchMechanism(createMockCtx(), 500, 500, () => {
      ticks++;
    });
    wm.realTimeMode = true;
    wm.power = 80;

    // À 500 ms (0.5 s) : aucun nouveau Tic-Tac déclenché, l'aiguille des secondes reste fixe sur sa graduation
    wm.update(500, false);
    expect(ticks).toBe(0);
    expect(wm.angleSeconds).toBe(0);

    // À 1000 ms (1.0 s) : exactement 1 Tic-Tac déclenché !
    wm.update(500, false);
    expect(ticks).toBe(1);

    // 70 ms plus tard (fin du saut mécanique) : l'aiguille s'est calée pile sur 1 seconde (π/30 rad) et ne bouge plus jusqu'à 2000 ms
    wm.update(70, false);
    expect(wm.angleSeconds).toBeCloseTo(Math.PI / 30, 4);
    wm.update(400, false);
    expect(wm.angleSeconds).toBeCloseTo(Math.PI / 30, 4);
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
