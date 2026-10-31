import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';

describe('TimeMath — Géométrie, Compensation Horaire & Aide Pédagogique', () => {
  it('convertit correctement les coordonnées cartésiennes en minutes (0..59)', () => {
    expect(TimeMath.pointerToMinutes(0, -100)).toBe(0);
    expect(TimeMath.pointerToMinutes(100, 0)).toBe(15);
    expect(TimeMath.pointerToMinutes(0, 100)).toBe(30);
    expect(TimeMath.pointerToMinutes(-100, 0)).toBe(45);
  });

  it('convertit les coordonnées en heures (1..12) sans saut intempestif à :30 et :45', () => {
    expect(TimeMath.pointerToHours(0, -100, 0)).toBe(12);
    expect(TimeMath.pointerToHours(100, 0, 0)).toBe(3);
    expect(TimeMath.pointerToHours(0, 100, 0)).toBe(6);
    expect(TimeMath.pointerToHours(-100, 0, 0)).toBe(9);

    // À 3h45, que l'enfant vise le chiffre 3 (90°) ou l'aiguille décalée à 3.75 (112.5°), l'heure reste 3 !
    const rad3 = (3 * Math.PI) / 6;
    const rad375 = (3.75 * Math.PI) / 6;
    expect(TimeMath.pointerToHours(Math.sin(rad3) * 100, -Math.cos(rad3) * 100, 45)).toBe(3);
    expect(TimeMath.pointerToHours(Math.sin(rad375) * 100, -Math.cos(rad375) * 100, 45)).toBe(3);
  });

  it('aimante les minutes par pas de 5 sauf au niveau 6', () => {
    expect(TimeMath.snapMinutes(12, 1)).toBe(10);
    expect(TimeMath.snapMinutes(13, 4)).toBe(15);
    expect(TimeMath.snapMinutes(59, 4)).toBe(0);
    expect(TimeMath.snapMinutes(43, 6)).toBe(43);
  });

  it('valide la tolérance circulaire au niveau 6 et génère des indices pédagogiques', () => {
    expect(TimeMath.isPlacementCorrect(3, 0, 15, 59, 6)).toBe(true);
    expect(TimeMath.isPlacementCorrect(3, 15, 15, 15, 5)).toBe(true);
    expect(TimeMath.isPlacementCorrect(3, 14, 15, 15, 5)).toBe(false);

    const hint30 = TimeMath.buildPedagogicalHint(3, 30, 2);
    expect(hint30).toContain('sur le <strong>6</strong>');
    expect(hint30).toContain('et demie');
  });
});

describe('QuestionManager — Progression Pédagogique & Leurres Sans Ambiguïté', () => {
  it('génère des heures pleines au niveau 1 et fournit des périodes de journée aux niveaux 5 et 6', () => {
    const qm1 = new QuestionManager(1);
    const q1 = qm1.generateQuestion();
    expect(q1.minutes).toBe(0);
    expect(q1.periodLabel).toBe('');

    const qm5 = new QuestionManager(5);
    const q5 = qm5.generateQuestion();
    expect(q5.hours).toBeGreaterThanOrEqual(0);
    expect(q5.hours).toBeLessThanOrEqual(23);
    expect(q5.periodLabel.length).toBeGreaterThan(0);
  });

  it('ne génère jamais deux choix ayant la même position d’aiguilles (ex: 03h15 et 15h15)', () => {
    const qm5 = new QuestionManager(5);
    for (let i = 0; i < 40; i++) {
      const target = qm5.generateQuestion();
      const choices = qm5.generateChoices(target);
      expect(choices).toHaveLength(3);
      const keys = choices.map(c => `${c.hours % 12}:${c.minutes}`);
      expect(new Set(keys).size).toBe(3);
    }
  });
});

describe('SaveManager — 6 Niveaux = 6 Pièces Mécaniques (Zéro Personnalisation)', () => {
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

  it('débloque chacune des 6 pièces mécaniques des niveaux 1 à 6', () => {
    let save = SaveManager.load();
    for (let lvl = 1; lvl <= 6; lvl++) {
      save = SaveManager.applyLevelRewards(save, lvl);
    }
    expect(save.unlockedParts).toEqual([
      'crown',
      'spring',
      'hours',
      'minutes',
      'seconds',
      'escapement'
    ]);
    expect(SaveManager.isFullyUnlocked(save)).toBe(true);
  });
});

describe('WatchMechanism & SoundEngine — Chaîne Causale & Tic-Tac au Niveau 6', () => {
  it('déclenche le son Tic-Tac uniquement lorsque la 6e pièce (escapement) est montée', () => {
    const dummyCtx = {} as CanvasRenderingContext2D;
    let ticks = 0;
    const mech = new WatchMechanism(dummyCtx, 500, 500, () => { ticks++; });
    const sound = new SoundEngine(false);
    expect(() => sound.playTick(true)).not.toThrow();

    // Sans la 6e pièce (escapement), les roues tournent mais sans déclencher le cliquet Tic-Tac
    mech.update(3000, ['crown', 'spring', 'hours', 'minutes', 'seconds'], false);
    expect(mech.angleSeconds).toBeGreaterThan(0);
    expect(ticks).toBe(0);

    // Avec la 6e pièce (escapement), le cliquet Tic-Tac bat la mesure
    mech.update(3000, ['crown', 'spring', 'hours', 'minutes', 'seconds', 'escapement'], false);
    expect(ticks).toBeGreaterThan(0);
  });
});
