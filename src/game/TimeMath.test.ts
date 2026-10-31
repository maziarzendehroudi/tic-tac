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
});

describe('SaveManager — Progression 1 (Pièces aux niveaux 1..5, Personnalisation au niveau 6)', () => {
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

  it('débloque exclusivement 1 pièce par niveau de 1 à 5, puis les thèmes et aiguilles au niveau 6', () => {
    let save = SaveManager.load();
    expect(save.unlockedParts).toEqual([]);
    expect(save.unlockedThemes).toEqual(['classic']);
    expect(save.unlockedHands).toEqual(['classic-hands']);

    save = SaveManager.applyLevelRewards(save, 1);
    expect(save.unlockedParts).toEqual(['crown']);
    expect(save.unlockedThemes).toEqual(['classic']);

    save = SaveManager.applyLevelRewards(save, 2);
    save = SaveManager.applyLevelRewards(save, 3);
    save = SaveManager.applyLevelRewards(save, 4);
    save = SaveManager.applyLevelRewards(save, 5);
    expect(save.unlockedParts).toEqual(['crown', 'spring', 'hours', 'minutes', 'seconds']);
    // Avant le niveau 6, la personnalisation reste verrouillée
    expect(save.unlockedThemes).toEqual(['classic']);
    expect(save.unlockedHands).toEqual(['classic-hands']);

    // Le niveau 6 débloque tout le coffret de personnalisation
    save = SaveManager.applyLevelRewards(save, 6);
    expect(save.unlockedThemes).toEqual(['classic', 'wood', 'forest', 'ocean', 'space']);
    expect(save.unlockedHands).toEqual(['classic-hands', 'gold-hands', 'neon-hands']);
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

describe('WatchMechanism — Proposition Mécanique A (Chaîne Causale & Engrenages Relais)', () => {
  it('anime séquentiellement Heures -> Relais Bleu (Minutes) -> Relais Rouge (Secondes)', () => {
    const dummyCtx = {} as CanvasRenderingContext2D;
    let ticks = 0;
    const mech = new WatchMechanism(dummyCtx, 500, 500, () => { ticks++; });

    mech.angleHours = 0;
    mech.angleMinutes = 0;
    mech.angleSeconds = 0;

    // 1. Si on monte les Minutes SANS les Heures, rien ne tourne (chaîne coupée)
    mech.update(1000, ['crown', 'spring', 'minutes'], false);
    expect(mech.angleMinutes).toBe(0);

    // 2. Avec Ressort + Heures + Minutes + Secondes, toute la chaîne et les relais tournent
    mech.update(3000, ['crown', 'spring', 'hours', 'minutes', 'seconds'], false);
    expect(mech.angleSeconds).toBeCloseTo(Math.PI, 4);
    expect(mech.angleMinutes).toBeCloseTo(mech.angleSeconds / 4, 4);
    expect(mech.angleHours).toBeCloseTo(mech.angleSeconds / 12, 4);
    expect(mech.angleRelayMinutes).toBeLessThan(0); // Le relais bleu tourne en sens inverse pour renvoyer le sens horaire
    expect(mech.angleRelaySeconds).toBeLessThan(0); // Le relais rouge tourne en sens inverse pour renvoyer le sens horaire
    expect(ticks).toBeGreaterThan(0);
  });
});
