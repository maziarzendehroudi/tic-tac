import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';

describe('TimeMath — Format 9:30, Préhension Tactile Intelligente & Indices Diagnostiques', () => {
  it('détecte l’erreur Matin vs Après-midi avec le format 00:00 / 12:00', () => {
    const hintAfternoon = TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 5);
    expect(hintAfternoon).toContain('après-midi');
    expect(hintAfternoon).not.toContain('15');

    const hintMidnight = TimeMath.buildReadDiagnosticHint(0, 0, 12, 0, 5);
    expect(hintMidnight).toContain('00:00');
  });

  it('sélectionne prioritairement l’aiguille qui n’est pas encore sur sa cible en cas de superposition', () => {
    // Les deux aiguilles sont à 12h00 (en haut : x=0, y=-100). La cible est 12:30 (l'heure est déjà bonne, les minutes doivent bouger)
    const picked = TimeMath.pickHandFromPointer(0, -100, 12, 0, 236, 2, 'hour', 12, 30);
    expect(picked).toBe('minute');
  });

  it('détecte le piège de l’heure suivante (H+1) lorsque les minutes dépassent :30', () => {
    const hintTrap = TimeMath.buildReadDiagnosticHint(8, 45, 9, 45, 3);
    expect(hintTrap).toContain('pas encore dépassé');
    expect(hintTrap).not.toContain('8:45');
  });
});

describe('QuestionManager & SaveManager — Format ":", 7 Niveaux (21 ⭐) & Multi-Profils Fratrie', () => {
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

  it('formate toutes les heures avec ":" (9:30 en niv 1-4, 09:30 en niv 5-7)', () => {
    expect(QuestionManager.formatTimeText(9, 30, 2)).toBe('9:30');
    expect(QuestionManager.formatTimeText(9, 30, 5)).toBe('09:30');
    expect(QuestionManager.formatTimeText(16, 5, 7)).toBe('16:05');
  });

  it('gère plusieurs profils joueurs indépendants (fratrie) et 21 étoiles au total', () => {
    const p1 = SaveManager.getActiveProfile();
    expect(p1.name).toBe('Joueur 1');

    // Débloque tout sur le profil 1 (21 étoiles)
    const unlockedP1 = SaveManager.unlockAll(false);
    expect(SaveManager.getTotalStars(unlockedP1)).toBe(21);

    // Crée un second profil pour un frère ou une sœur : il démarre bien au Niveau 1 avec 0 étoile
    const p2 = SaveManager.createProfile('Sophia');
    expect(p2.name).toBe('Sophia');
    expect(SaveManager.getTotalStars(p2.save)).toBe(0);
    expect(p2.save.maxUnlockedLevel).toBe(1);

    // Bascule à nouveau sur le profil 1 : ses 21 étoiles sont intactes
    const backToP1 = SaveManager.switchProfile(p1.id);
    expect(SaveManager.getTotalStars(backToP1)).toBe(21);

    const sound = new SoundEngine(false);
    expect(() => sound.playSuccess()).not.toThrow();
  });
});
