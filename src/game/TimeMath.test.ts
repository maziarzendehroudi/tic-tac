import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';

describe('WatchMechanism — Cohérence Cinématique Molette / Ressort / Roue des Heures', () => {
  it('place la roue du ressort en tangence avec la vis de la molette (y=0) ET avec la roue des heures (0,0)', () => {
    const { spring, hours } = WatchMechanism.POS;

    // 1. Tangence avec la roue des heures : r_spring + r_hours = 36 + 56 = 92 px (± 1 px)
    const distSpringToHours = Math.hypot(spring.x - hours.x, spring.y - hours.y);
    expect(distSpringToHours).toBeGreaterThan(90.5);
    expect(distSpringToHours).toBeLessThan(93.0);

    // 2. Tangence avec la vis sans fin de la molette (axe y = 0)
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

  it('ne répète jamais la même question au cours d’une série de 6 questions', () => {
    const qm = new QuestionManager(4);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const q = qm.generateQuestion();
      expect(seen.has(q.text)).toBe(false);
      seen.add(q.text);
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

    expect(QuestionManager.formatTimeText(16, 5, 6)).toBe('16:05');
    const sound = new SoundEngine(false);
    expect(() => sound.playWindingClick()).not.toThrow();
  });
});
