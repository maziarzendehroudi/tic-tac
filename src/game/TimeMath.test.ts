import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
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

describe('WatchMechanism V38 — Molette Compacte Rapprochée, Boîtier Agrandi (1.72x) & Débrayage Automatique', () => {
  it('rapproche la molette du boîtier (x = 138) et agrandit l’échelle de la vue globale à 1.72x', () => {
    expect(WatchMechanism.POS.crown.x).toBe(138);
    expect(WatchMechanism.CAMERA_TARGETS.overview.scale).toBeCloseTo(1.72, 2);
  });

  it('embraye la vis sans fin pendant le remontage (power < 100) et débraye automatiquement au relâcher ou à 100%', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    wm.power = 70;

    // Au repos : la molette est débrayée
    expect(wm.isClutchEngaged()).toBe(false);

    // Pendant le remontage : la vis s'embraye contre les dents du barillet
    wm.update(200, true);
    expect(wm.isClutchEngaged()).toBe(true);

    // Dès qu'on relâche la molette : la vis débraye automatiquement pour ne pas tourner à l'envers
    wm.update(300, false);
    expect(wm.isClutchEngaged()).toBe(false);

    // À 100% de charge : même si on maintient la molette, le débrayage automatique de fin de course s'active
    wm.power = 100;
    wm.update(300, true);
    expect(wm.isClutchEngaged()).toBe(false);
  });

  it('masque complètement les autres mécanismes sans jamais utiliser de transparence partielle lors d’un zoom', () => {
    const ctx = createMockCtx();
    let minAlphaObserved = 1;
    let currentAlpha = 1;
    Object.defineProperty(ctx, 'globalAlpha', {
      get: () => currentAlpha,
      set: (val: number) => {
        currentAlpha = val;
        if (val < minAlphaObserved) minAlphaObserved = val;
      }
    });

    const wm = new WatchMechanism(ctx, 500, 500);
    for (const mode of ['spring', 'hours', 'minutes', 'seconds'] as const) {
      wm.setZoomMode(mode);
      wm.draw(false);
    }

    expect(minAlphaObserved).toBe(1);
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
