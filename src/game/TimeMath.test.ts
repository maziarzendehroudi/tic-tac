import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';

describe('QuestionManager — Mix obligatoire 1 Leurre Heure + 1 Leurre Minute (Niveaux 2 à 7)', () => {
  it('génère toujours un leurre sur l’heure ET un leurre sur les minutes aux niveaux 2 à 7', () => {
    for (let lvl = 2; lvl <= 7; lvl++) {
      const qm = new QuestionManager(lvl);
      const target = qm.generateQuestion();
      const choices = qm.generateChoices(target);
      expect(choices).toHaveLength(3);

      // Au moins un choix a une minute différente de la cible (oblige à lire les minutes)
      const hasDifferentMinute = choices.some(c => c.minutes !== target.minutes);
      // Au moins un choix a une heure différente de la cible (oblige à lire les heures)
      const hasDifferentHour = choices.some(c => c.hours !== target.hours);

      expect(hasDifferentMinute).toBe(true);
      expect(hasDifferentHour).toBe(true);
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

    const sound = new SoundEngine(false);
    expect(() => sound.playWindingClick()).not.toThrow();
  });
});
