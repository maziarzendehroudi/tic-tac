import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';

describe('TimeMath — Niveau 5 vs Niveau 6 (Sans heures oranges) & Préhension Tactile', () => {
  it('mentionne les nombres oranges uniquement au Niveau 5, et le calcul +12 dès le Niveau 6', () => {
    const hintLvl5 = TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 5);
    expect(hintLvl5).toContain('orange');

    const hintLvl6 = TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 6);
    expect(hintLvl6).toContain('ajoute 12');
    expect(hintLvl6).not.toContain('orange');
  });

  it('sélectionne prioritairement l’aiguille qui n’est pas encore sur sa cible en cas de superposition', () => {
    const picked = TimeMath.pickHandFromPointer(0, -100, 12, 0, 236, 2, 'hour', 12, 30);
    expect(picked).toBe('minute');
  });

  it('détecte le piège de l’heure suivante (H+1) lorsque les minutes dépassent :30', () => {
    const hintTrap = TimeMath.buildReadDiagnosticHint(8, 45, 9, 45, 3);
    expect(hintTrap).toContain('pas encore dépassé');
    expect(hintTrap).not.toContain('8:45');
  });
});

describe('SaveManager — Déblocage de l’Atelier de l’Horloger après le Niveau 7', () => {
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

  it('verrouille l’Atelier par défaut et le débloque dès que le Niveau 7 est validé', () => {
    let save = SaveManager.load();
    expect(SaveManager.isWorkshopUnlocked(save)).toBe(false);

    save = SaveManager.applyLevelRewards(save, 7, 3);
    expect(SaveManager.isWorkshopUnlocked(save)).toBe(true);

    expect(QuestionManager.formatTimeText(16, 5, 6)).toBe('16:05');
    const sound = new SoundEngine(false);
    expect(() => sound.playSuccess()).not.toThrow();
  });
});
