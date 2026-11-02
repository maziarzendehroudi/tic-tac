import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';

describe('TimeMath — Jour/Nuit, Préhension Directe & Vocabulaire Courant (Chantiers C & D)', () => {
  it('distingue correctement les heures du Jour (06h..17h) et de la Nuit (18h..05h)', () => {
    expect(TimeMath.isDayTime(6)).toBe(true);
    expect(TimeMath.isDayTime(12)).toBe(true);
    expect(TimeMath.isDayTime(17)).toBe(true);
    expect(TimeMath.isDayTime(18)).toBe(false);
    expect(TimeMath.isDayTime(0)).toBe(false);
  });

  it('formate correctement les expressions courantes en français (Chantier D)', () => {
    expect(TimeMath.formatSpokenTime(4, 30, 2)).toBe('4 h et demie');
    expect(TimeMath.formatSpokenTime(6, 15, 3)).toBe('6 h et quart');
    expect(TimeMath.formatSpokenTime(7, 45, 3)).toBe('8 h moins le quart');
    expect(TimeMath.formatSpokenTime(12, 0, 5)).toBe('Midi pile');
    expect(TimeMath.formatSpokenTime(0, 0, 5)).toBe('Minuit pile');
  });

  it('explique le piège de la zone dorée entre H et H+1 lorsque les minutes dépassent 30 (Chantier C)', () => {
    const hint45 = TimeMath.buildPedagogicalHint(8, 45, 3);
    expect(hint45).toContain('zone dorée entre <strong>8</strong> et <strong>9</strong>');
    expect(hint45).toContain('moins le quart');
  });
});

describe('QuestionManager — Leurre Anti-Piège H+1 après :35 (Chantier C)', () => {
  it('inclut systématiquement le leurre H+1 lorsque les minutes valent 35 ou plus', () => {
    const qm4 = new QuestionManager(4);
    const target = {
      hours: 4,
      minutes: 50,
      text: '4h50',
      spokenText: '',
      isDay: true,
      periodLabel: ''
    };
    const choices = qm4.generateChoices(target);
    expect(choices).toHaveLength(3);
    expect(choices.some(c => c.text === '5h50')).toBe(true);
  });
});

describe('SaveManager — Notation 1..3 Étoiles & Grades sur 18 ⭐ (Chantiers A & B)', () => {
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

  it('calcule de 1 à 3 étoiles selon le nombre d’erreurs et conserve le meilleur score', () => {
    expect(SaveManager.computeStarsForErrors(0)).toBe(3);
    expect(SaveManager.computeStarsForErrors(1)).toBe(3);
    expect(SaveManager.computeStarsForErrors(3)).toBe(2);
    expect(SaveManager.computeStarsForErrors(6)).toBe(1);

    let save = SaveManager.load();
    save = SaveManager.applyLevelRewards(save, 1, 2);
    expect(save.levelStars[1]).toBe(2);

    // Si l'enfant rejoue et fait mieux (3 étoiles), le score monte à 3
    save = SaveManager.applyLevelRewards(save, 1, 3);
    expect(save.levelStars[1]).toBe(3);

    // Si l'enfant rejoue et fait moins bien (1 étoile), son record de 3 étoiles est préservé
    save = SaveManager.applyLevelRewards(save, 1, 1);
    expect(save.levelStars[1]).toBe(3);

    const sound = new SoundEngine(false);
    expect(() => sound.playSuccess()).not.toThrow();
  });

  it('attribue le grade Grand Maître du Temps à 18 étoiles', () => {
    const unlocked = SaveManager.unlockAll(false);
    expect(SaveManager.getTotalStars(unlocked)).toBe(18);
    expect(SaveManager.getRankTitle(18)).toContain('Grand Maître du Temps');
  });
});
