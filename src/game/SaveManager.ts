export interface GameSave {
  maxUnlockedLevel: number;
  completedLevels: number[];
  levelStars: Record<number, number>;
  muted: boolean;
}

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_pedagogy_save';

  public static createDefaultSave(unlockAll: boolean = false): GameSave {
    if (unlockAll) {
      return {
        maxUnlockedLevel: 6,
        completedLevels: [1, 2, 3, 4, 5, 6],
        levelStars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 },
        muted: false
      };
    }
    return {
      maxUnlockedLevel: 1,
      completedLevels: [],
      levelStars: {},
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

  /**
   * Calcule le nombre d'étoiles (1 à 3) gagnées sur un niveau selon le nombre d'erreurs :
   * - 0 ou 1 erreur sur les 6 questions : 3 étoiles (★★★ Maîtrise parfaite)
   * - 2 à 4 erreurs : 2 étoiles (★★☆ Niveau maîtrisé)
   * - 5 erreurs ou plus : 1 étoile (★☆☆ Niveau découvert, à rejouer pour progresser)
   */
  public static computeStarsForErrors(totalErrors: number): 1 | 2 | 3 {
    if (totalErrors <= 1) return 3;
    if (totalErrors <= 4) return 2;
    return 1;
  }

  public static getTotalStars(save: GameSave): number {
    let sum = 0;
    for (let lvl = 1; lvl <= 6; lvl++) {
      sum += save.levelStars[lvl] || 0;
    }
    return sum;
  }

  public static getRankTitle(totalStars: number): string {
    if (totalStars >= 18) return '👑 Grand Maître du Temps';
    if (totalStars >= 12) return '🌟 Gardien Jour & Nuit';
    if (totalStars >= 6) return '🧭 Éclaireur des Aiguilles';
    return '⏱️ Apprenti du Temps';
  }

  public static applyLevelRewards(
    save: GameSave,
    completedLevel: number,
    earnedStars: number = 3
  ): GameSave {
    if (!save.completedLevels.includes(completedLevel)) {
      save.completedLevels.push(completedLevel);
    }
    const previousBest = save.levelStars[completedLevel] || 0;
    save.levelStars[completedLevel] = Math.max(previousBest, Math.min(3, Math.max(1, earnedStars)));

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

      const levelStars: Record<number, number> = {};
      if (parsed.levelStars && typeof parsed.levelStars === 'object') {
        for (let lvl = 1; lvl <= 6; lvl++) {
          const val = (parsed.levelStars as Record<number, unknown>)[lvl];
          if (typeof val === 'number' && val >= 1 && val <= 3) {
            levelStars[lvl] = Math.floor(val);
          }
        }
      }
      // Rétrocompatibilité : si un niveau était déjà complété sans étoile enregistrée, lui attribuer 2 étoiles par défaut
      completedLevels.forEach(lvl => {
        if (!levelStars[lvl]) levelStars[lvl] = 2;
      });

      const muted = Boolean(parsed.muted);

      return {
        maxUnlockedLevel,
        completedLevels,
        levelStars,
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
