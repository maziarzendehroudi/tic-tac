export interface GameSave {
  maxUnlockedLevel: number;
  unlockedParts: string[];
  placedParts: string[];
  muted: boolean;
}

export const ALL_PARTS = [
  'crown',
  'spring',
  'hours',
  'minutes',
  'seconds',
  'escapement'
] as const;

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_watch_save';

  public static createDefaultSave(unlockAll: boolean = false): GameSave {
    if (unlockAll) {
      return {
        maxUnlockedLevel: 6,
        unlockedParts: [...ALL_PARTS],
        placedParts: [...ALL_PARTS],
        muted: false
      };
    }
    return {
      maxUnlockedLevel: 1,
      unlockedParts: [],
      placedParts: [],
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
      save.unlockedParts.length >= ALL_PARTS.length
    );
  }

  /**
   * Chaque niveau gagné (1 à 6) débloque et monte 1 pièce mécanique dans l'Atelier :
   * 1: Molette | 2: Ressort | 3: Heures | 4: Minutes | 5: Secondes | 6: Balancier Tic-Tac
   */
  public static applyLevelRewards(save: GameSave, completedLevel: number): GameSave {
    const levelPartsMap: Record<number, string> = {
      1: 'crown',
      2: 'spring',
      3: 'hours',
      4: 'minutes',
      5: 'seconds',
      6: 'escapement'
    };

    const part = levelPartsMap[completedLevel];
    if (part) {
      if (!save.unlockedParts.includes(part)) {
        save.unlockedParts.push(part);
      }
      if (!save.placedParts.includes(part)) {
        save.placedParts.push(part);
      }
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

      const muted = Boolean(parsed.muted);

      return {
        maxUnlockedLevel,
        unlockedParts,
        placedParts,
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
