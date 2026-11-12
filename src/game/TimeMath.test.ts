import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { SaveManager } from './SaveManager';
import { SoundEngine } from './SoundEngine';
import { WatchMechanism } from './WatchMechanism';
import { Hands } from './Hands';
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

describe('WatchMechanism V47 — Continuité du Ressort, Détente Rapide (20s), Cinématique 5 Contacts & 3 Zooms', () => {
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

describe('Progression Pédagogique 8 Niveaux (V47) — Orthographe 1 heure & Sans calcul +12', () => {
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

  it('accorde correctement "1 heure" au singulier et les autres heures au pluriel', () => {
    expect(TimeMath.formatSpokenTime(1, 0, 1)).toBe('1 heure');
    expect(TimeMath.formatSpokenTime(2, 0, 1)).toBe('2 heures');
    expect(TimeMath.formatSpokenTime(1, 0, 2)).toBe('1 heure');
    expect(TimeMath.formatSpokenTime(1, 30, 4)).toBe('1 heure et demie');
    expect(TimeMath.formatSpokenTime(1, 15, 5)).toBe('1 heure et quart');
    expect(TimeMath.formatSpokenTime(12, 45, 5)).toBe('1 heure moins le quart');
  });

  it('n’utilise jamais l’indication "+ 12" ou "ajoute 12" dans les didacticiels et indices', () => {
    const info8 = TutorialOverlay.getInfo(8);
    expect(info8.ruleHtml).not.toContain('12 =');
    expect(info8.ruleHtml).not.toContain('+ 12');

    const hint8 = TimeMath.buildReadDiagnosticHint(15, 20, 3, 20, 8);
    expect(hint8).not.toContain('ajoute 12');
    expect(hint8).toContain('après-midi');
  });

  it('permet de créer et renommer un profil joueur', () => {
    const created = SaveManager.createProfile('Menu', false);
    const renamed = SaveManager.renameProfile(created.id, 'Sophia');
    expect(renamed.name).toBe('Sophia');
    expect(SaveManager.getActiveProfile().name).toBe('Sophia');

    const sound = new SoundEngine(false);
    expect(() => sound.playWindingClick()).not.toThrow();
  });

  it('fournit et dessine un didacticiel animé sans erreur pour chacun des 8 niveaux', () => {
    const ctx = createMockCtx();
    const hands = new Hands(ctx, 200);
    for (let lvl = 1; lvl <= 8; lvl++) {
      const info = TutorialOverlay.getInfo(lvl);
      expect(info.title.length).toBeGreaterThan(5);
      expect(info.ruleHtml.length).toBeGreaterThan(10);
      expect(() => TutorialOverlay.draw(ctx, hands, 200, lvl, 1200)).not.toThrow();
    }
  });
});
