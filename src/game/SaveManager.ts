export type DialTheme = 'classic' | 'wood' | 'forest' | 'ocean' | 'space';
export type HandsStyle = 'classic-hands' | 'gold-hands' | 'neon-hands';

export interface GameSave {
  maxUnlockedLevel: number;
  unlockedParts: string[];
  placedParts: string[];
  unlockedThemes: DialTheme[];
  unlockedHands: HandsStyle[];
  selectedTheme: DialTheme;
  selectedHands: HandsStyle;
  muted: boolean;
}

export const ALL_PARTS = ['crown', 'spring', 'hours', 'minutes', 'seconds'] as const;
export const ALL_THEMES: DialTheme[] = ['classic', 'wood', 'forest', 'ocean', 'space'];
export const ALL_HANDS: HandsStyle[] = ['classic-hands', 'gold-hands', 'neon-hands'];

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_watch_save';

  public static createDefaultSave(unlockAll: boolean = false): GameSave {
    if (unlockAll) {
      return {
        maxUnlockedLevel: 6,
        unlockedParts: [...ALL_PARTS],
        placedParts: [],
        unlockedThemes: [...ALL_THEMES],
        unlockedHands: [...ALL_HANDS],
        selectedTheme: 'classic',
        selectedHands: 'classic-hands',
        muted: false
      };
    }
    return {
      maxUnlockedLevel: 1,
      unlockedParts: [],
      placedParts: [],
      unlockedThemes: ['classic'],
      unlockedHands: ['classic-hands'],
      selectedTheme: 'classic',
      selectedHands: 'classic-hands',
      muted: false
    };
  }

  public static unlockAll(muted: boolean = false): GameSave {
    const save = this.createDefaultSave(true);
    save.muted = muted;
    this.save(save);
    return save;
  }

  public static isFullyUnlocked(save: GameSave): boolean {
    return (
      save.maxUnlockedLevel >= 6 &&
      save.unlockedParts.length >= ALL_PARTS.length &&
      save.unlockedThemes.length >= ALL_THEMES.length &&
      save.unlockedHands.length >= ALL_HANDS.length
    );
  }

  public static applyLevelRewards(save: GameSave, completedLevel: number): GameSave {
    const levelPartsMap: Record<number, string> = {
      1: 'crown',
      2: 'spring',
      3: 'hours',
      4: 'minutes',
      5: 'seconds'
    };

    const levelThemesMap: Record<number, DialTheme> = {
      1: 'wood',
      2: 'forest',
      3: 'ocean',
      4: 'space'
    };

    const part = levelPartsMap[completedLevel];
    if (part && !save.unlockedParts.includes(part)) {
      save.unlockedParts.push(part);
    }

    const theme = levelThemesMap[completedLevel];
    if (theme && !save.unlockedThemes.includes(theme)) {
      save.unlockedThemes.push(theme);
    }

    if (completedLevel === 5 && !save.unlockedHands.includes('gold-hands')) {
      save.unlockedHands.push('gold-hands');
    }

    if (completedLevel >= 6) {
      ALL_THEMES.forEach(t => {
        if (!save.unlockedThemes.includes(t)) save.unlockedThemes.push(t);
      });
      ALL_HANDS.forEach(h => {
        if (!save.unlockedHands.includes(h)) save.unlockedHands.push(h);
      });
    }

    if (completedLevel === save.maxUnlockedLevel && completedLevel < 6) {
      save.maxUnlockedLevel = completedLevel + 1;
    }

    return save;
  }

  public static load(): GameSave {
    const isDemoMode =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1';

    if (isDemoMode) {
      return this.createDefaultSave(true);
    }

    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      return this.createDefaultSave(false);
    }

    try {
      const parsed = JSON.parse(data) as Partial<GameSave>;
      const maxUnlockedLevel =
        typeof parsed.maxUnlockedLevel === 'number' && parsed.maxUnlockedLevel >= 1 && parsed.maxUnlockedLevel <= 6
          ? Math.floor(parsed.maxUnlockedLevel)
          : 1;

      const unlockedParts = Array.isArray(parsed.unlockedParts)
        ? parsed.unlockedParts.filter((p): p is string => typeof p === 'string' && (ALL_PARTS as readonly string[]).includes(p))
        : [];

      const placedParts = Array.isArray(parsed.placedParts)
        ? parsed.placedParts.filter((p): p is string => typeof p === 'string' && unlockedParts.includes(p))
        : [];

      const unlockedThemes: DialTheme[] = ['classic'];
      if (Array.isArray(parsed.unlockedThemes)) {
        parsed.unlockedThemes.forEach(t => {
          if (ALL_THEMES.includes(t) && !unlockedThemes.includes(t)) {
            unlockedThemes.push(t);
          }
        });
      }

      const unlockedHands: HandsStyle[] = ['classic-hands'];
      if (Array.isArray(parsed.unlockedHands)) {
        parsed.unlockedHands.forEach(h => {
          if (ALL_HANDS.includes(h) && !unlockedHands.includes(h)) {
            unlockedHands.push(h);
          }
        });
      }

      const selectedTheme: DialTheme =
        parsed.selectedTheme && unlockedThemes.includes(parsed.selectedTheme)
          ? parsed.selectedTheme
          : 'classic';

      const selectedHands: HandsStyle =
        parsed.selectedHands && unlockedHands.includes(parsed.selectedHands)
          ? parsed.selectedHands
          : 'classic-hands';

      const muted = Boolean(parsed.muted);

      return {
        maxUnlockedLevel,
        unlockedParts,
        placedParts,
        unlockedThemes,
        unlockedHands,
        selectedTheme,
        selectedHands,
        muted
      };
    } catch {
      return this.createDefaultSave(false);
    }
  }

  public static save(save: GameSave): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(save));
  }

  public static reset(): GameSave {
    const fresh = this.createDefaultSave(false);
    this.save(fresh);
    return fresh;
  }
}
