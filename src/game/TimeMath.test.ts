import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { Clock } from './Clock';
import { WatchMechanism } from './WatchMechanism';

describe('TimeMath — Géométrie et Validation Horlogère', () => {
  it('convertit correctement les coordonnées cartésiennes en minutes (0..59)', () => {
    expect(TimeMath.pointerToMinutes(0, -100)).toBe(0);
    expect(TimeMath.pointerToMinutes(100, 0)).toBe(15);
    expect(TimeMath.pointerToMinutes(0, 100)).toBe(30);
    expect(TimeMath.pointerToMinutes(-100, 0)).toBe(45);
  });

  it('convertit correctement les coordonnées cartésiennes en heures (1..12)', () => {
    expect(TimeMath.pointerToHours(0, -100)).toBe(12);
    expect(TimeMath.pointerToHours(100, 0)).toBe(3);
    expect(TimeMath.pointerToHours(0, 100)).toBe(6);
    expect(TimeMath.pointerToHours(-100, 0)).toBe(9);
  });

  it('aimante les minutes par pas de 5 sauf au niveau 6', () => {
    expect(TimeMath.snapMinutes(12, 1)).toBe(10);
    expect(TimeMath.snapMinutes(13, 4)).toBe(15);
    expect(TimeMath.snapMinutes(59, 4)).toBe(0);
    expect(TimeMath.snapMinutes(13, 6)).toBe(13);
  });

  it('valide la tolérance circulaire de ±2 minutes au niveau 6 (y compris passage 59 ↔ 0)', () => {
    expect(TimeMath.isPlacementCorrect(3, 0, 15, 59, 6)).toBe(true);
    expect(TimeMath.isPlacementCorrect(3, 58, 15, 0, 6)).toBe(true);
    expect(TimeMath.isPlacementCorrect(3, 56, 15, 0, 6)).toBe(false);
    expect(TimeMath.isPlacementCorrect(3, 15, 15, 15, 5)).toBe(true);
    expect(TimeMath.isPlacementCorrect(3, 14, 15, 15, 5)).toBe(false);
  });
});

describe('QuestionManager — Génération Pédagogique par Niveau', () => {
  it('génère des heures pleines (minutes = 0) au niveau 1', () => {
    const qm = new QuestionManager(1);
    for (let i = 0; i < 20; i++) {
      const q = qm.generateQuestion();
      expect(q.minutes).toBe(0);
      expect(q.hours).toBeGreaterThanOrEqual(1);
      expect(q.hours).toBeLessThanOrEqual(12);
    }
  });

  it('génère des heures entre 0 et 23 aux niveaux 5 et 6 (jamais 24h)', () => {
    const qm5 = new QuestionManager(5);
    const qm6 = new QuestionManager(6);
    for (let i = 0; i < 50; i++) {
      const q5 = qm5.generateQuestion();
      const q6 = qm6.generateQuestion();
      expect(q5.hours).toBeGreaterThanOrEqual(0);
      expect(q5.hours).toBeLessThanOrEqual(23);
      expect(q5.minutes % 5).toBe(0);
      expect(q6.hours).toBeGreaterThanOrEqual(0);
      expect(q6.hours).toBeLessThanOrEqual(23);
    }
  });

  it('génère toujours 3 choix distincts incluant la bonne réponse', () => {
    const qm = new QuestionManager(3);
    const target = qm.generateQuestion();
    const choices = qm.generateChoices(target);
    expect(choices).toHaveLength(3);
    expect(choices.some(c => c.hours === target.hours && c.minutes === target.minutes)).toBe(true);
  });
});

describe('SaveManager — Progression, Thèmes & Mode Test', () => {
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

  it('démarre au niveau 1 avec uniquement le thème classic et classic-hands', () => {
    const save = SaveManager.load();
    expect(save.maxUnlockedLevel).toBe(1);
    expect(save.unlockedParts).toEqual([]);
    expect(save.unlockedThemes).toEqual(['classic']);
    expect(save.unlockedHands).toEqual(['classic-hands']);
  });

  it('débloque intégralement le jeu via unlockAll et le détecte avec isFullyUnlocked', () => {
    const fresh = SaveManager.reset();
    expect(SaveManager.isFullyUnlocked(fresh)).toBe(false);

    const unlocked = SaveManager.unlockAll(true);
    expect(SaveManager.isFullyUnlocked(unlocked)).toBe(true);
    expect(unlocked.maxUnlockedLevel).toBe(6);
    expect(unlocked.unlockedParts).toHaveLength(5);
    expect(unlocked.unlockedThemes).toHaveLength(5);
    expect(unlocked.unlockedHands).toHaveLength(3);
  });

  it('fournit une palette valide pour chacun des 5 thèmes de cadran', () => {
    const themes = ['classic', 'wood', 'forest', 'ocean', 'space'] as const;
    themes.forEach(t => {
      const palette = Clock.getPalette(t);
      expect(palette.bgColor).toMatch(/^#/);
      expect(palette.borderColor).toMatch(/^#/);
    });
  });
});

describe('SoundEngine — Tolérance Headless & Mute', () => {
  it('bascule correctement l’état muet et ne lève aucune exception sans AudioContext DOM', () => {
    const sound = new SoundEngine(false);
    expect(sound.isMuted()).toBe(false);
    expect(() => sound.playTick(true)).not.toThrow();
    sound.setMuted(true);
    expect(sound.isMuted()).toBe(true);
  });
});

describe('WatchMechanism — 3 Disques Gigognes, Molette à 9h & Vitesses Pédagogiques (1 : 4 : 12)', () => {
  it('détecte la molette centrée à 9h et anime les 3 disques aux rapports pédagogiques 1:4:12', () => {
    const dummyCtx = {} as CanvasRenderingContext2D;
    let clicks = 0;
    let ticks = 0;
    const mech = new WatchMechanism(
      dummyCtx,
      500,
      500,
      () => { ticks++; },
      () => { clicks++; }
    );

    expect(mech.isPointInCrown(56, 250)).toBe(true);
    expect(mech.isPointInCrown(56, 350)).toBe(false);

    mech.power = 50;
    mech.update(500, ['crown', 'spring'], true);
    expect(mech.power).toBeGreaterThan(50);
    expect(clicks).toBeGreaterThan(0);

    mech.angleHours = 0;
    mech.angleMinutes = 0;
    mech.angleSeconds = 0;
    mech.update(3000, ['crown', 'spring', 'hours', 'minutes', 'seconds'], false);

    // En 3 secondes : Secondes a fait 1/2 tour (PI rad)
    expect(mech.angleSeconds).toBeCloseTo(Math.PI, 4);
    // Minutes tourne 4x moins vite que Secondes
    expect(mech.angleMinutes).toBeCloseTo(mech.angleSeconds / 4, 4);
    // Heures tourne 12x moins vite que Secondes (3x moins vite que Minutes)
    expect(mech.angleHours).toBeCloseTo(mech.angleSeconds / 12, 4);
    expect(ticks).toBeGreaterThan(0);
  });
});
