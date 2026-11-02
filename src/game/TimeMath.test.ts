import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';

describe('WatchMechanism V28 — Disposition Miroir à Droite (3h), Vis Sans Fin & Zooms', () => {
  it('place la molette et le ressort à droite (x > 0) en tangence avec la vis (y=0) et la roue des heures (0,0)', () => {
    const { crown, spring, hours, relaySeconds } = WatchMechanism.POS;

    // 1. Molette et ressort à droite (x > 0), relais des secondes en miroir à gauche (x < 0)
    expect(crown.x).toBeGreaterThan(150);
    expect(spring.x).toBeGreaterThan(70);
    expect(relaySeconds.x).toBeLessThan(-50);

    // 2. Tangence avec la roue des heures : r_spring + r_hours = 36 + 56 = 92 px (± 1 px)
    const distSpringToHours = Math.hypot(spring.x - hours.x, spring.y - hours.y);
    expect(distSpringToHours).toBeGreaterThan(90.5);
    expect(distSpringToHours).toBeLessThan(93.0);

    // 3. Tangence avec la vis sans fin de la molette (axe horizontal y = 0)
    const bottomPitchY = spring.y + spring.r;
    expect(bottomPitchY).toBeGreaterThanOrEqual(-7);
    expect(bottomPitchY).toBeLessThanOrEqual(-3);
  });
});

describe('QuestionManager — Mix obligatoire 1 Leurre Heure + 1 Leurre Minute (Niveaux 2 à 7)', () => {
  it('génère toujours un leurre sur l’heure ET un leurre sur les minutes aux niveaux 2 à 7', () => {
    for (let lvl = 2; lvl <= 7; lvl++) {
      const qm = new QuestionManager(lvl);
      const target = qm.generateQuestion();
      const choices = qm.generateChoices(target);
      expect(choices).toHaveLength(3);

      expect(choices.some(c => c.minutes !== target.minutes)).toBe(true);
      expect(choices.some(c => c.hours !== target.hours)).toBe(true);
    }
  });
});

describe('TimeMath & SaveManager — Pédagogie Niv. 5/6/7 & Atelier', () => {
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

  it('mentionne les nombres oranges uniquement au Niveau 5, et le calcul +12 dès le Niveau 6', () => {
    const hintLvl5 = TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 5);
    expect(hintLvl5).toContain('orange');

    const hintLvl6 = TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 6);
    expect(hintLvl6).toContain('ajoute 12');
    expect(hintLvl6).not.toContain('orange');
  });

  it('verrouille l’Atelier par défaut et le débloque dès que le Niveau 7 est validé', () => {
    let save = SaveManager.load();
    expect(SaveManager.isWorkshopUnlocked(save)).toBe(false);

    save = SaveManager.applyLevelRewards(save, 7, 3);
    expect(SaveManager.isWorkshopUnlocked(save)).toBe(true);

    const sound = new SoundEngine(false);
    expect(() => sound.playWindingClick()).not.toThrow();
  });
});
