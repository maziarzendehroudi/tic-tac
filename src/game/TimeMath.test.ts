import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';
import { Hands } from './Hands';
import { Clock } from './Clock';
import { TutorialOverlay } from './TutorialOverlay';

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

describe('WatchMechanism V53 — Continuité du Ressort, Détente Rapide (20s), Cinématique 5 Contacts & 3 Zooms', () => {
  it('ne provoque aucun saut de position du barillet lorsque le ressort est chargé et repart en détente', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    wm.power = 50;

    wm.update(400, true);
    const angleAtEndOfWinding = wm.angleBarrel;

    wm.update(16, false);
    const jumpDiff = Math.abs(wm.angleBarrel - angleAtEndOfWinding);
    expect(jumpDiff).toBeLessThan(0.05);
  });

  it('détend complètement le ressort en 20 secondes (5% par seconde)', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    wm.power = 100;

    wm.update(10000, false);
    expect(wm.power).toBeCloseTo(50, 1);

    wm.update(10000, false);
    expect(wm.power).toBeCloseTo(0, 1);
  });

  it('maintient un rapport d’engrènement exact sur les 5 contacts et contient le barillet dans le cadran (< 114 px)', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
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

    const maxToothRadiusFromCenter = Math.hypot(spring.x, spring.y) + spring.r + 3.2;
    expect(maxToothRadiusFromCenter).toBeLessThan(114);
  });
});

describe('Progression Pédagogique 8 Niveaux (V53) — Fluidité des 2 tours & Fondus progressifs', () => {
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

  it('accorde "1 heure" au singulier et retire la mention entre parenthèses au Niveau 5', () => {
    expect(TimeMath.formatSpokenTime(1, 0, 1)).toBe('1 heure');
    expect(TimeMath.formatSpokenTime(2, 0, 1)).toBe('2 heures');
    expect(TimeMath.formatSpokenTime(1, 0, 2)).toBe('1 heure');
    expect(TimeMath.formatSpokenTime(1, 30, 4)).toBe('1 heure et demie');
    expect(TimeMath.formatSpokenTime(4, 15, 5)).toBe('');
    expect(TimeMath.formatSpokenTime(4, 45, 5)).toBe('');
  });

  it('anime de façon continue les 4 moments de vie (03h, 08h, 15h, 20h) avec fondu tourBlend à midi et minuit', () => {
    expect(TutorialOverlay.getCallout(1, 1000)).toBeNull();
    expect(TutorialOverlay.getCallout(7, 1000)).toBeNull();

    // 1. Segment 0 (800 ms) : 03 h (Nuit, 1er tour noir, tourBlend = 0)
    const step03 = TutorialOverlay.getLevel2Timeline(800);
    expect(step03.hours24).toBe(3);
    expect(step03.isDay).toBe(false);
    expect(step03.tourBlend).toBe(0);
    expect(step03.calloutText).toContain('03 h');

    // 2. Segment 1 (4400 ms) : 08 h (Matin, 1er tour noir, tourBlend = 0)
    const step08 = TutorialOverlay.getLevel2Timeline(4400);
    expect(step08.hours24).toBe(8);
    expect(step08.isDay).toBe(true);
    expect(step08.tourBlend).toBe(0);
    expect(step08.calloutText).toContain('08 h');

    // Passage de midi (~6450 ms) : tourBlend est en transition progressive entre 0 et 1
    const midNoon = TutorialOverlay.getLevel2Timeline(6450);
    expect(midNoon.tourBlend).toBeGreaterThan(0.05);
    expect(midNoon.tourBlend).toBeLessThan(0.95);

    // 3. Segment 2 (8000 ms) : 15 h (Après-midi, 2e tour orange, tourBlend = 1)
    const step15 = TutorialOverlay.getLevel2Timeline(8000);
    expect(step15.hours24).toBe(15);
    expect(step15.isDay).toBe(true);
    expect(step15.tourBlend).toBe(1);
    expect(step15.calloutText).toContain('15 h');

    // 4. Segment 3 (11600 ms) : 20 h (Soir, 2e tour orange, tourBlend = 1)
    const step20 = TutorialOverlay.getLevel2Timeline(11600);
    expect(step20.hours24).toBe(20);
    expect(step20.isDay).toBe(false);
    expect(step20.tourBlend).toBe(1);
    expect(step20.calloutText).toContain('20 h');
  });

  it('dessine le cadran (avec tourBlend continu) et le didacticiel sans erreur pour chacun des 8 niveaux', () => {
    const ctx = createMockCtx();
    const clock = new Clock(ctx, 200);
    const hands = new Hands(ctx, 200);

    expect(() => clock.draw(2, false, 0)).not.toThrow();
    expect(() => clock.draw(2, true, 0.5)).not.toThrow();
    expect(() => clock.draw(2, true, 1)).not.toThrow();

    for (let lvl = 1; lvl <= 8; lvl++) {
      const info = TutorialOverlay.getInfo(lvl);
      expect(info.ruleHtml.length).toBeGreaterThan(15);
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
