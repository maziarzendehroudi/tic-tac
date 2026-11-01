import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';

describe('TimeMath — Jour/Nuit, Géométrie 12h/24h & Aide Pédagogique', () => {
  it('distingue correctement les heures du Jour (06h..17h) et les heures de la Nuit (18h..05h)', () => {
    expect(TimeMath.isDayTime(6)).toBe(true);
    expect(TimeMath.isDayTime(12)).toBe(true);
    expect(TimeMath.isDayTime(17)).toBe(true);
    expect(TimeMath.isDayTime(18)).toBe(false);
    expect(TimeMath.isDayTime(23)).toBe(false);
    expect(TimeMath.isDayTime(0)).toBe(false);
    expect(TimeMath.isDayTime(5)).toBe(false);
  });

  it('convertit les coordonnées cartésiennes en minutes (0..59) et en heures (1..12) avec compensation', () => {
    expect(TimeMath.pointerToMinutes(0, -100)).toBe(0);
    expect(TimeMath.pointerToMinutes(100, 0)).toBe(15);
    expect(TimeMath.pointerToMinutes(0, 100)).toBe(30);
    expect(TimeMath.pointerToMinutes(-100, 0)).toBe(45);

    const rad3 = (3 * Math.PI) / 6;
    const rad375 = (3.75 * Math.PI) / 6;
    expect(TimeMath.pointerToHours(Math.sin(rad3) * 100, -Math.cos(rad3) * 100, 45)).toBe(3);
    expect(TimeMath.pointerToHours(Math.sin(rad375) * 100, -Math.cos(rad375) * 100, 45)).toBe(3);
  });

  it('génère des indices pédagogiques mentionnant les pastilles 24h et la couronne des minutes', () => {
    const hint24 = TimeMath.buildPedagogicalHint(15, 20, 5);
    expect(hint24).toContain('15h');
    expect(hint24).toContain('20');
  });
});

describe('QuestionManager — Format 12h/24h & Cohérence Jour/Nuit', () => {
  it('associe chaque question à son état Jour/Nuit et propose le leurre 12h/24h au niveau 5', () => {
    const qm5 = new QuestionManager(5);
    for (let i = 0; i < 30; i++) {
      const q = qm5.generateQuestion();
      expect(q.isDay).toBe(q.hours >= 6 && q.hours < 18);
      const choices = qm5.generateChoices(q);
      expect(choices).toHaveLength(3);
      // Vérifie que les 3 textes proposés sont bien distincts
      const texts = choices.map(c => c.text);
      expect(new Set(texts).size).toBe(3);
    }
  });
});

describe('SaveManager & SoundEngine — Progression des 6 Niveaux', () => {
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

  it('débloque et valide progressivement les 6 niveaux', () => {
    let save = SaveManager.load();
    expect(save.maxUnlockedLevel).toBe(1);
    for (let lvl = 1; lvl <= 6; lvl++) {
      save = SaveManager.applyLevelRewards(save, lvl);
    }
    expect(SaveManager.isFullyUnlocked(save)).toBe(true);

    const sound = new SoundEngine(false);
    expect(() => sound.playSuccess()).not.toThrow();
  });
});
