import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';
import { Hands } from './Hands';
import { Clock } from './Clock';
import { TutorialOverlay } from './TutorialOverlay';
import { GameEngine } from './GameEngine';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    filter: 'none',
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    roundRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fill: () => {},
    stroke: () => {},
    setLineDash: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 60 })
  } as unknown as CanvasRenderingContext2D;
}

describe('WatchMechanism V63 — Cinématique 5 Contacts & Ressort à 0 par défaut', () => {
  it('démarre avec le ressort à 0 par défaut et maintient l’engrènement sur les 5 contacts', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    expect(wm.power).toBe(0);

    wm.power = 100;
    const s0 = wm.angleSeconds;
    const rs0 = wm.angleRelaySeconds;
    const m0 = wm.angleMinutes;
    const rm0 = wm.angleRelayMinutes;
    const h0 = wm.angleHours;
    const b0 = wm.angleBarrel;

    wm.update(1000, false);
    wm.update(80, false);

    const dSec = wm.angleSeconds - s0;
    const dRelaySec = wm.angleRelaySeconds - rs0;
    const dMin = wm.angleMinutes - m0;
    const dRelayMin = wm.angleRelayMinutes - rm0;
    const dHr = wm.angleHours - h0;
    const dBarrel = wm.angleBarrel - b0;

    const { spring, hours, relayMinutes, minutes, relaySeconds, seconds } = WatchMechanism.POS;

    expect(dRelaySec * relaySeconds.teethWheel).toBeCloseTo(-dSec * seconds.teeth, 5);
    expect(dMin * minutes.teeth).toBeCloseTo(-dRelaySec * relaySeconds.teethPinion, 5);
    expect(dRelayMin * relayMinutes.teethWheel).toBeCloseTo(-dMin * minutes.teeth, 5);
    expect(dHr * hours.teeth).toBeCloseTo(-dRelayMin * relayMinutes.teethPinion, 5);
    expect(dBarrel * spring.teeth).toBeCloseTo(-dHr * hours.teeth, 5);
  });
});

describe('Didacticiels & Expressions parlées Niveaux 4, 5 et 6 (V63)', () => {
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

  it('affiche les pilules "2 heures pile" et "deux heures et demi" avec pause de 1s au Niveau 4', () => {
    const c200 = TutorialOverlay.getCallout(4, 200);
    const c230 = TutorialOverlay.getCallout(4, 2600);
    expect(c200?.text).toBe('2 heures pile');
    expect(c230?.text).toBe('deux heures et demi');
  });

  it('met à jour le texte, les pilules et les confirmations parlées du Niveau 5', () => {
    const info5 = TutorialOverlay.getInfo(5);
    expect(info5.ruleHtml).toContain('moitié d’une');
    expect(info5.ruleHtml).toContain('demi-heure');

    expect(TutorialOverlay.getCallout(5, 200)?.text).toBe('4 heures pile');
    expect(TutorialOverlay.getCallout(5, 2600)?.text).toBe('4 heures et quart');
    expect(TutorialOverlay.getCallout(5, 5000)?.text).toBe('4 heures et demi');
    expect(TutorialOverlay.getCallout(5, 7400)?.text).toBe('5 heures moins le quart');

    expect(TimeMath.formatSpokenTime(4, 0, 5)).toBe('4 heures pile');
    expect(TimeMath.formatSpokenTime(4, 15, 5)).toBe('4 heures et quart');
    expect(TimeMath.formatSpokenTime(4, 30, 5)).toBe('4 heures et demi');
    expect(TimeMath.formatSpokenTime(2, 45, 5)).toBe('3 heures moins le quart');
  });

  it('affiche la pilule "8h23" dans le didacticiel du Niveau 6', () => {
    const c6 = TutorialOverlay.getCallout(6, 500);
    expect(c6?.text).toBe('8h23');
  });

  it('dessine tous les niveaux et vérifie les textes d’étapes sans erreur', () => {
    const ctx = createMockCtx();
    const clock = new Clock(ctx, 200);
    const hands = new Hands(ctx, 200);

    for (let lvl = 1; lvl <= 8; lvl++) {
      const summary = GameEngine.getLevelTransitionSummary(lvl);
      expect(summary.learnedText.length).toBeGreaterThan(20);
      expect(() => clock.draw(lvl, true)).not.toThrow();
      expect(() => TutorialOverlay.draw(ctx, hands, 200, lvl, 1200)).not.toThrow();
    }

    const created = SaveManager.createProfile('Menu', false);
    const renamed = SaveManager.renameProfile(created.id, 'Sophia');
    expect(renamed.name).toBe('Sophia');

    const sound = new SoundEngine(false);
    expect(() => sound.playWindingClick()).not.toThrow();
  });
});
