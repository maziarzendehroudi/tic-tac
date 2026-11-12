import { describe, it, expect, beforeEach } from 'vitest';
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

describe('WatchMechanism V55 — Ressort à 0 par défaut, Continuité du Ressort, Détente Rapide (20s) & Cinématique 5 Contacts', () => {
  it('démarre avec le ressort à 0 par défaut et ne provoque aucun saut de position après remontage', () => {
    const wm = new WatchMechanism(createMockCtx(), 500, 500);
    expect(wm.power).toBe(0);

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

describe('Progression Pédagogique 8 Niveaux (V55) — Rotation continue Niveau 2 + Pause 3s à minuit & Niveau 5 complet', () => {
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

  it('nomme le Niveau 1 "Les 12 heures" et affiche 0 / 15 / 30 / 45 au Niveau 5', () => {
    expect(TutorialOverlay.getInfo(1).title).toBe('Les 12 heures');
    const info5 = TutorialOverlay.getInfo(5).ruleHtml;
    expect(info5).toContain('heure pile');
    expect(info5).toContain('demie heure');
    expect(info5).toContain('un quart d’heure');
    expect(info5).toContain('trois quarts d’heure');
  });

  it('anime le Niveau 2 sans arrêt intermédiaire et marque une pause de 3 secondes à minuit', () => {
    // 1. C'est la nuit (vers 3h00 => t = 1500 ms)
    const night = TutorialOverlay.getLevel2Timeline(1500);
    expect(night.hours24).toBeCloseTo(3, 2);
    expect(night.calloutText).toBe('C’est la nuit');
    expect(night.isDay).toBe(false);

    // 2. Le jour se lève (vers 8h00 => t = 4000 ms)
    const morning = TutorialOverlay.getLevel2Timeline(4000);
    expect(morning.hours24).toBeCloseTo(8, 2);
    expect(morning.calloutText).toBe('Le jour se lève');
    expect(morning.isDay).toBe(true);

    // 3. Repas de midi (à 12h00 => t = 6000 ms)
    const noon = TutorialOverlay.getLevel2Timeline(6000);
    expect(noon.hours24).toBeCloseTo(12, 2);
    expect(noon.calloutText).toBe('Repas de midi');
    expect(noon.isDay).toBe(true);

    // 4. Le goûter (à 16h00 => t = 8000 ms)
    const snack = TutorialOverlay.getLevel2Timeline(8000);
    expect(snack.hours24).toBeCloseTo(16, 2);
    expect(snack.calloutText).toBe('Le goûter');
    expect(snack.isDay).toBe(true);

    // 5. Repas du soir (vers 20h00 => t = 10000 ms)
    const dinner = TutorialOverlay.getLevel2Timeline(10000);
    expect(dinner.hours24).toBeCloseTo(20, 2);
    expect(dinner.calloutText).toBe('Repas du soir');
    expect(dinner.isDay).toBe(false);

    // 6. Pause de 3 secondes à minuit (entre 12000 ms et 15000 ms)
    const midnightStart = TutorialOverlay.getLevel2Timeline(12100);
    const midnightEnd = TutorialOverlay.getLevel2Timeline(14800);
    expect(midnightStart.hours24).toBe(0);
    expect(midnightEnd.hours24).toBe(0);
    expect(midnightStart.calloutText).toBe('Minuit : on change de jour');
    expect(midnightEnd.calloutText).toBe('Minuit : on change de jour');
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
import { GameEngine } from './GameEngine';

describe('Transitions V56 — Récapitulatif des acquis et annonce du niveau suivant', () => {
  it('fournit un récapitulatif pédagogique et annonce le niveau suivant (ou l’atelier) pour les 8 niveaux', () => {
    for (let lvl = 1; lvl <= 7; lvl++) {
      const summary = GameEngine.getLevelTransitionSummary(lvl);
      expect(summary.learnedText.length).toBeGreaterThan(20);
      expect(summary.nextTitle).toContain(`Niveau ${lvl + 1}`);
    }

    const finalSummary = GameEngine.getLevelTransitionSummary(8);
    expect(finalSummary.learnedText).toContain('horloge de grand');
    expect(finalSummary.nextTitle).toContain('atelier de l’horloger');
  });
});
