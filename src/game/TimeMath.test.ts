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

describe('WatchMechanism V36 — 4 Boutons de Zoom Manuels, Vitesse Réelle par défaut & Rotation des 4 Mécanismes', () => {
  it('supporte les 4 modes de zoom manuels (spring, hours, minutes, seconds) ainsi que le retour à overview', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    expect(wm.realTimeMode).toBe(true);
    expect(wm.zoomMode).toBe('overview');

    for (const mode of ['spring', 'hours', 'minutes', 'seconds'] as const) {
      wm.setZoomMode(mode);
      expect(wm.zoomMode).toBe(mode);
    }

    wm.setZoomMode('overview');
    expect(wm.zoomMode).toBe('overview');
  });

  it('fait tourner franchement les 4 mécanismes (Ressort, Heures, Minutes, Secondes) en Vitesse réelle comme en Accéléré', () => {
    for (const isRealTime of [true, false]) {
      const wm = new WatchMechanism(createMockCtx(), 500, 500);
      wm.realTimeMode = isRealTime;
      wm.power = 90;

      const initBarrel = wm.angleBarrel;
      const initHours = wm.angleHours;
      const initRelayMin = wm.angleRelayMinutes;
      const initMinutes = wm.angleMinutes;
      const initRelaySec = wm.angleRelaySeconds;
      const initSeconds = wm.angleSeconds;

      wm.update(1000, false);
      wm.update(70, false);

      expect(Math.abs(wm.angleHours - initHours)).toBeGreaterThan(0.038);
      expect(Math.abs(wm.angleBarrel - initBarrel)).toBeGreaterThan(0.05);
      expect(Math.abs(wm.angleMinutes - initMinutes)).toBeGreaterThan(0.06);
      expect(Math.abs(wm.angleRelayMinutes - initRelayMin)).toBeGreaterThan(0.06);
      expect(Math.abs(wm.angleRelaySeconds - initRelaySec)).toBeGreaterThan(0.05);
      expect(Math.abs(wm.angleSeconds - initSeconds)).toBeGreaterThan(0.09);
    }
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
