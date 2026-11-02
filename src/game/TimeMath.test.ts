import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';

describe('TimeMath — Indices Diagnostiques Pertinents (Sans dévoiler la réponse)', () => {
  it('détecte l’erreur Matin vs Après-midi (ex: cliquer 03h00 au lieu de 15h00)', () => {
    const hintAfternoon = TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 5);
    expect(hintAfternoon).toContain('après-midi');
    expect(hintAfternoon).toContain('orange');
    // Ne dévoile pas le nombre 15 dans l'indice
    expect(hintAfternoon).not.toContain('15');

    const hintNight = TimeMath.buildReadDiagnosticHint(3, 0, 15, 0, 5);
    expect(hintNight).toContain('avant midi');
    expect(hintNight).not.toContain('03h00');
  });

  it('détecte l’inversion entre la petite aiguille et la grande aiguille', () => {
    // À 3h00 (grande aiguille sur 12), l'enfant clique 12h00
    const hintInverted = TimeMath.buildReadDiagnosticHint(3, 0, 12, 0, 1);
    expect(hintInverted).toContain('inverser');
    expect(hintInverted).not.toContain('sur le 3');
  });

  it('détecte le piège de l’heure suivante (H+1) lorsque les minutes dépassent :30', () => {
    const hintTrap = TimeMath.buildReadDiagnosticHint(8, 45, 9, 45, 3);
    expect(hintTrap).toContain('pas encore dépassé');
    expect(hintTrap).not.toContain('8h45');
  });

  it('ne mentionne jamais 00 au Niveau 1 et guide uniquement sur l’élément erroné en Placement', () => {
    const hintLvl1 = TimeMath.buildReadDiagnosticHint(3, 0, 2, 0, 1);
    expect(hintLvl1).not.toContain('00');
    expect(hintLvl1).not.toContain('sur le 3');

    const placeHintMin = TimeMath.buildPlacementDiagnosticHint(4, 15, 4, 30, 2);
    expect(placeHintMin).toContain('L’heure est bonne');
    expect(placeHintMin).toContain(':30');
  });
});

describe('QuestionManager & SaveManager — Cohérence Globale', () => {
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

  it('inclut le leurre H+1 après :35 et calcule correctement les 18 étoiles', () => {
    const qm4 = new QuestionManager(4);
    const choices = qm4.generateChoices({
      hours: 4,
      minutes: 50,
      text: '4h50',
      spokenText: '',
      isDay: true,
      periodLabel: ''
    });
    expect(choices.some(c => c.text === '5h50')).toBe(true);

    const unlocked = SaveManager.unlockAll(false);
    expect(SaveManager.getTotalStars(unlocked)).toBe(18);
    const sound = new SoundEngine(false);
    expect(() => sound.playSuccess()).not.toThrow();
  });
});
