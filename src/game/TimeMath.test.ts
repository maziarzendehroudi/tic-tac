import { describe, it, expect, beforeEach } from 'vitest';
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

describe('WatchMechanism V59 — Ressort à 0 par défaut, Continuité du Ressort, Détente Rapide (20s) & Cinématique 5 Contacts', () => {
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

describe('Didacticiels Niveaux 2 et 5 (V59) — Pause de 1 seconde à chaque étape et pilules synchronisées', () => {
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

  it('marque une pause de 1 seconde à 8h, 12h, 16h, 20h (et 3s à minuit) au Niveau 2 avec la pilule correspondante', () => {
    // 1. Nuit sans arrêt à 3h00 (t = 1200 ms)
    const night = TutorialOverlay.getLevel2Timeline(1200);
    expect(night.calloutText).toBe('C’est la nuit');

    // 2. Pause de 1s à 8h00 (entre 2600 ms et 3600 ms)
    const pause8Start = TutorialOverlay.getLevel2Timeline(2650);
    const pause8End = TutorialOverlay.getLevel2Timeline(3550);
    expect(pause8Start.hours24).toBe(8);
    expect(pause8End.hours24).toBe(8);
    expect(pause8Start.calloutText).toBe('Le jour se lève');

    // 3. Pause de 1s à 12h00 (entre 5000 ms et 6000 ms)
    const pause12Start = TutorialOverlay.getLevel2Timeline(5050);
    const pause12End = TutorialOverlay.getLevel2Timeline(5950);
    expect(pause12Start.hours24).toBe(12);
    expect(pause12End.hours24).toBe(12);
    expect(pause12Start.calloutText).toBe('Repas de midi');

    // 4. Pause de 1s à 16h00 (entre 7400 ms et 8400 ms)
    const pause16Start = TutorialOverlay.getLevel2Timeline(7450);
    const pause16End = TutorialOverlay.getLevel2Timeline(8350);
    expect(pause16Start.hours24).toBe(16);
    expect(pause16End.hours24).toBe(16);
    expect(pause16Start.calloutText).toBe('Le goûter');

    // 5. Pause de 1s à 20h00 (entre 9800 ms et 10800 ms)
    const pause20Start = TutorialOverlay.getLevel2Timeline(9850);
    const pause20End = TutorialOverlay.getLevel2Timeline(10750);
    expect(pause20Start.hours24).toBe(20);
    expect(pause20End.hours24).toBe(20);
    expect(pause20Start.calloutText).toBe('Repas du soir');

    // 6. Pause de 3s à Minuit 00h00 (entre 12200 ms et 15200 ms)
    const pause00Start = TutorialOverlay.getLevel2Timeline(12300);
    const pause00End = TutorialOverlay.getLevel2Timeline(15100);
    expect(pause00Start.hours24).toBe(0);
    expect(pause00End.hours24).toBe(0);
    expect(pause00Start.calloutText).toBe('Minuit : on change de jour');
  });

  it('marque une pause de 1 seconde sur 00, 15, 30 et 45 au Niveau 5 avec les pilules associées', () => {
    // Étape 0 (0 .. 1000 ms) : Heure pile (minutes = 0)
    const p0Start = TutorialOverlay.getLevel5Timeline(50);
    const p0End = TutorialOverlay.getLevel5Timeline(950);
    expect(p0Start.minutes).toBe(0);
    expect(p0End.minutes).toBe(0);
    expect(p0Start.calloutText).toBe('Heure pile');

    // Étape 1 (2400 .. 3400 ms) : Quart d'heure (minutes = 15)
    const p15Start = TutorialOverlay.getLevel5Timeline(2450);
    const p15End = TutorialOverlay.getLevel5Timeline(3350);
    expect(p15Start.minutes).toBe(15);
    expect(p15End.minutes).toBe(15);
    expect(p15Start.calloutText).toBe('Quart d’heure');

    // Étape 2 (4800 .. 5800 ms) : Demi-heure (minutes = 30)
    const p30Start = TutorialOverlay.getLevel5Timeline(4850);
    const p30End = TutorialOverlay.getLevel5Timeline(5750);
    expect(p30Start.minutes).toBe(30);
    expect(p30End.minutes).toBe(30);
    expect(p30Start.calloutText).toBe('Demi-heure');

    // Étape 3 (7200 .. 8200 ms) : Trois quarts d'heure (minutes = 45)
    const p45Start = TutorialOverlay.getLevel5Timeline(7250);
    const p45End = TutorialOverlay.getLevel5Timeline(8150);
    expect(p45Start.minutes).toBe(45);
    expect(p45End.minutes).toBe(45);
    expect(p45Start.calloutText).toBe('Trois quarts d’heure');
  });

  it('fournit les récapitulatifs de fin de niveau et dessine tous les niveaux sans erreur', () => {
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

describe('Améliorations UX & Design V60 — Consignes adaptatives Étape 2 & Atelier de l’horloger', () => {
  it('adapte le message de l’Étape 2 à l’aiguille du niveau en cours', () => {
    expect(GameEngine.getStep2PromptForLevel(1)).toContain('petite aiguille orange');
    expect(GameEngine.getStep2PromptForLevel(2)).toContain('petite aiguille orange');
    expect(GameEngine.getStep2PromptForLevel(3)).toContain('grande aiguille bleue');
    expect(GameEngine.getStep2PromptForLevel(4)).toContain('bouger les aiguilles');
  });

  it('met à jour dynamiquement le texte explicatif de l’Atelier selon l’énergie du ressort et le zoom', () => {
    expect(GameEngine.getWorkshopInstructionText(0, 'overview')).toContain('Tourne la molette');
    expect(GameEngine.getWorkshopInstructionText(80, 'overview')).toContain('Touche un bouton');
    expect(GameEngine.getWorkshopInstructionText(80, 'spring')).toContain('Le ressort');
    expect(GameEngine.getWorkshopInstructionText(80, 'hours')).toContain('roue dorée');
    expect(GameEngine.getWorkshopInstructionText(80, 'minutes')).toContain('roues bleues');
  });
});

describe('Animation Étape 1 (V61) — Consigne adaptative de lecture de l’horloge', () => {
  it('adapte le message de l’Étape 1 à l’aiguille du niveau en cours', () => {
    expect(GameEngine.getStep1PromptForLevel(1)).toContain('petite aiguille orange');
    expect(GameEngine.getStep1PromptForLevel(2)).toContain('petite aiguille orange');
    expect(GameEngine.getStep1PromptForLevel(3)).toContain('grande aiguille bleue');
    expect(GameEngine.getStep1PromptForLevel(4)).toContain('choisis la bonne heure');
  });
});
