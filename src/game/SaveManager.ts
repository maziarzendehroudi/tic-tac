export interface GameSave {
  maxUnlockedLevel: number;
  completedLevels: number[];
  muted: boolean;
}

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_pedagogy_save';

  public static createDefaultSave(unlockAll: boolean = false): GameSave {
    if (unlockAll) {
      return {
        maxUnlockedLevel: 6,
        completedLevels: [1, 2, 3, 4, 5, 6],
        muted: false
      };
    }
    return {
      maxUnlockedLevel: 1,
      completedLevels: [],
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
    return save.maxUnlockedLevel >= 6 && save.completedLevels.length >= 6;
  }

  public static applyLevelRewards(save: GameSave, completedLevel: number): GameSave {
    if (!save.completedLevels.includes(completedLevel)) {
      save.completedLevels.push(completedLevel);
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
        typeof parsed.maxUnlockedLevel === 'number' &&
        parsed.maxUnlockedLevel >= 1 &&
        parsed.maxUnlockedLevel <= 6
          ? Math.floor(parsed.maxUnlockedLevel)
          : 1;

      const completedLevels = Array.isArray(parsed.completedLevels)
        ? parsed.completedLevels.filter(
            (lvl): lvl is number => typeof lvl === 'number' && lvl >= 1 && lvl <= 6
          )
        : [];

      const muted = Boolean(parsed.muted);

      return {
        maxUnlockedLevel,
        completedLevels,
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
