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

describe('WatchMechanism V54 — Continuité du Ressort, Détente Rapide (20s), Cinématique 5 Contacts & 3 Zooms', () => {
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

describe('Progression Pédagogique 8 Niveaux (V54) — 6 repères quotidiens du Niveau 2', () => {
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

  it('parcourt les 6 repères de la journée (Minuit 00h, 03h, 09h école, 12h repas, 17h fin école, 21h dodo)', () => {
    // 1. Minuit (00h) : on change de jour (t = 500 ms)
    const step00 = TutorialOverlay.getLevel2Timeline(500);
    expect(step00.hours24).toBe(0);
    expect(step00.isDay).toBe(false);
    expect(step00.calloutText).toContain('on change de jour');

    // 2. 03 h : On dort (t = 3000 ms)
    const step03 = TutorialOverlay.getLevel2Timeline(3000);
    expect(step03.hours24).toBe(3);
    expect(step03.isDay).toBe(false);
    expect(step03.tourBlend).toBe(0);
    expect(step03.calloutText).toContain('03 h');

    // 3. 09 h : L’école (t = 6000 ms)
    const step09 = TutorialOverlay.getLevel2Timeline(6000);
    expect(step09.hours24).toBe(9);
    expect(step09.isDay).toBe(true);
    expect(step09.tourBlend).toBe(0);
    expect(step09.calloutText).toContain('09 h · L’école');

    // 4. 12 h : Midi : le repas (t = 8500 ms)
    const step12 = TutorialOverlay.getLevel2Timeline(8500);
    expect(step12.hours24).toBe(12);
    expect(step12.isDay).toBe(true);
    expect(step12.tourBlend).toBe(0);
    expect(step12.calloutText).toContain('Midi : le repas');

    // 5. 17 h : La fin de l’école (t = 11500 ms)
    const step17 = TutorialOverlay.getLevel2Timeline(11500);
    expect(step17.hours24).toBe(17);
    expect(step17.isDay).toBe(true);
    expect(step17.tourBlend).toBe(1);
    expect(step17.calloutText).toContain('17 h · La fin de l’école');

    // 6. 21 h : Le dodo (t = 14000 ms)
    const step21 = TutorialOverlay.getLevel2Timeline(14000);
    expect(step21.hours24).toBe(21);
    expect(step21.isDay).toBe(false);
    expect(step21.tourBlend).toBe(1);
    expect(step21.calloutText).toContain('21 h · Le dodo');
  });

  it('dessine le cadran et le didacticiel sans erreur pour chacun des 8 niveaux', () => {
    const ctx = createMockCtx();
    const clock = new Clock(ctx, 200);
    const hands = new Hands(ctx, 200);

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
