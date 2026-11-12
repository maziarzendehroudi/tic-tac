import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMath } from './TimeMath';
import { QuestionManager } from './QuestionManager';
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

describe('WatchMechanism V40/V41 — Continuité du Ressort sans saut, Détente Rapide (20s) & Cinématique 5 Contacts', () => {
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

  it('maintient un rapport d’engrènement exact sur les 5 contacts (Secondes -> Minutes -> Heures -> Ressort)', () => {
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
  });
});

describe('Progression Pédagogique 8 Niveaux (V41) — QuestionManager, TimeMath & SaveManager', () => {
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

  it('isole les heures (Niv 1-2) et les minutes (Niv 3) avec leurs formats dédiés', () => {
    expect(QuestionManager.formatTimeText(3, 0, 1)).toBe('3 h');
    expect(QuestionManager.formatTimeText(15, 0, 2)).toBe('15 h');
    expect(QuestionManager.formatTimeText(12, 25, 3)).toBe('25 min');

    expect(TimeMath.pickHandFromPointer(10, -100, 3, 0, 200, 1, 'minute')).toBe('hour');
    expect(TimeMath.pickHandFromPointer(10, -100, 15, 0, 200, 2, 'minute')).toBe('hour');
    expect(TimeMath.pickHandFromPointer(10, -50, 12, 25, 200, 3, 'hour')).toBe('minute');
  });

  it('génère toujours un leurre sur l’heure ET un leurre sur les minutes aux niveaux 4 à 8', () => {
    for (let lvl = 4; lvl <= 8; lvl++) {
      const qm = new QuestionManager(lvl);
      const target = qm.generateQuestion();
      const choices = qm.generateChoices(target);
      expect(choices).toHaveLength(3);
      expect(choices.some(c => c.minutes !== target.minutes)).toBe(true);
      expect(choices.some(c => c.hours !== target.hours)).toBe(true);
    }
  });

  it('mentionne les nombres oranges au Niveau 2, le calcul +12 dès le Niveau 7, et débloque l’Atelier au Niveau 8', () => {
    expect(TimeMath.buildReadDiagnosticHint(15, 0, 3, 0, 2)).toContain('orange');
    expect(TimeMath.buildReadDiagnosticHint(15, 20, 3, 20, 7)).toContain('orange');
    expect(TimeMath.buildReadDiagnosticHint(15, 20, 3, 20, 8)).toContain('ajoute 12');

    let save = SaveManager.load();
    expect(SaveManager.MAX_LEVEL).toBe(8);
    expect(SaveManager.MAX_STARS).toBe(24);

    save = SaveManager.applyLevelRewards(save, 8, 3);
    expect(SaveManager.isWorkshopUnlocked(save)).toBe(true);

    const sound = new SoundEngine(false);
    expect(() => sound.playWindingClick()).not.toThrow();
  });

  it("fournit et dessine un didacticiel animé sans erreur pour chacun des 8 niveaux", () => {
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

describe('Correctifs V46 — Barillet dans le cadran & Gestion des profils', () => {
  it('maintient les dents du barillet du ressort strictement à l’intérieur des graduations du cadran (< 114 px)', () => {
    const { spring } = WatchMechanism.POS;
    const centerDist = Math.hypot(spring.x, spring.y);
    const maxToothRadiusFromCenter = centerDist + spring.r + 3.2;
    expect(maxToothRadiusFromCenter).toBeLessThan(114);
  });

  it('permet de renommer un profil joueur existant', () => {
    const created = SaveManager.createProfile('Test', false);
    const renamed = SaveManager.renameProfile(created.id, 'Sophia');
    expect(renamed.name).toBe('Sophia');
    expect(SaveManager.getActiveProfile().name).toBe('Sophia');
  });
});
