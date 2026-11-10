export interface GameSave {
  maxUnlockedLevel: number;
  completedLevels: number[];
  levelStars: Record<number, number>;
  muted: boolean;
}

export interface PlayerProfile {
  id: string;
  name: string;
  save: GameSave;
}

interface ProfilesStore {
  activeProfileId: string;
  profiles: PlayerProfile[];
}

export class SaveManager {
  public static readonly MAX_LEVEL = 8;
  public static readonly MAX_STARS = 24;
  private static LEGACY_KEY = 'tic_tac_pedagogy_save';
  private static PROFILES_KEY = 'tic_tac_profiles_v1';

  public static createDefaultSave(unlockAll: boolean = false): GameSave {
    if (unlockAll) {
      return {
        maxUnlockedLevel: 8,
        completedLevels: [1, 2, 3, 4, 5, 6, 7, 8],
        levelStars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
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

  private static sanitizeSave(raw: Partial<GameSave> | null | undefined): GameSave {
    if (!raw || typeof raw !== 'object') {
      return this.createDefaultSave(false);
    }
    const maxUnlockedLevel =
      typeof raw.maxUnlockedLevel === 'number' &&
      raw.maxUnlockedLevel >= 1 &&
      raw.maxUnlockedLevel <= this.MAX_LEVEL
        ? Math.floor(raw.maxUnlockedLevel)
        : 1;

    const completedLevels = Array.isArray(raw.completedLevels)
      ? raw.completedLevels.filter(
          (lvl): lvl is number => typeof lvl === 'number' && lvl >= 1 && lvl <= this.MAX_LEVEL
        )
      : [];

    const levelStars: Record<number, number> = {};
    if (raw.levelStars && typeof raw.levelStars === 'object') {
      for (let lvl = 1; lvl <= this.MAX_LEVEL; lvl++) {
        const val = (raw.levelStars as Record<number, unknown>)[lvl];
        if (typeof val === 'number' && val >= 1 && val <= 3) {
          levelStars[lvl] = Math.floor(val);
        }
      }
    }
    completedLevels.forEach(lvl => {
      if (!levelStars[lvl]) levelStars[lvl] = 2;
    });

    const highestCompleted = completedLevels.length > 0 ? Math.max(...completedLevels) : 0;
    const adjustedMax = Math.min(
      this.MAX_LEVEL,
      Math.max(maxUnlockedLevel, highestCompleted + 1)
    );

    return {
      maxUnlockedLevel: adjustedMax,
      completedLevels,
      levelStars,
      muted: Boolean(raw.muted)
    };
  }

  private static loadStore(): ProfilesStore {
    const rawStore = localStorage.getItem(this.PROFILES_KEY);
    if (rawStore) {
      try {
        const parsed = JSON.parse(rawStore) as Partial<ProfilesStore>;
        if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
          const profiles: PlayerProfile[] = parsed.profiles.map((p, idx) => ({
            id: typeof p.id === 'string' && p.id ? p.id : `p_${idx + 1}`,
            name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 18) : `Joueur ${idx + 1}`,
            save: this.sanitizeSave(p.save)
          }));
          const activeId = profiles.some(p => p.id === parsed.activeProfileId)
            ? (parsed.activeProfileId as string)
            : profiles[0].id;
          return { activeProfileId: activeId, profiles };
        }
      } catch {
        // Fallback ci-dessous
      }
    }

    let initialSave = this.createDefaultSave(false);
    const legacy = localStorage.getItem(this.LEGACY_KEY);
    if (legacy) {
      try {
        initialSave = this.sanitizeSave(JSON.parse(legacy) as Partial<GameSave>);
      } catch {
        initialSave = this.createDefaultSave(false);
      }
    }

    const defaultProfile: PlayerProfile = {
      id: 'p_default',
      name: 'Joueur 1',
      save: initialSave
    };
    const store: ProfilesStore = {
      activeProfileId: defaultProfile.id,
      profiles: [defaultProfile]
    };
    this.saveStore(store);
    return store;
  }

  private static saveStore(store: ProfilesStore): void {
    localStorage.setItem(this.PROFILES_KEY, JSON.stringify(store));
    const active = store.profiles.find(p => p.id === store.activeProfileId) || store.profiles[0];
    if (active) {
      localStorage.setItem(this.LEGACY_KEY, JSON.stringify(active.save));
    }
  }

  public static getProfiles(): PlayerProfile[] {
    return this.loadStore().profiles;
  }

  public static getActiveProfile(): PlayerProfile {
    const store = this.loadStore();
    return store.profiles.find(p => p.id === store.activeProfileId) || store.profiles[0];
  }

  public static switchProfile(profileId: string): GameSave {
    const store = this.loadStore();
    const target = store.profiles.find(p => p.id === profileId);
    if (target) {
      store.activeProfileId = target.id;
      this.saveStore(store);
      return target.save;
    }
    return this.getActiveProfile().save;
  }

  public static createProfile(name: string, muted: boolean = false): PlayerProfile {
    const cleanName = name.trim().slice(0, 18) || 'Joueur';
    const store = this.loadStore();
    const newSave = this.createDefaultSave(false);
    newSave.muted = muted;
    const newProfile: PlayerProfile = {
      id: `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      save: newSave
    };
    store.profiles.push(newProfile);
    store.activeProfileId = newProfile.id;
    this.saveStore(store);
    return newProfile;
  }

  public static deleteProfile(profileId: string): PlayerProfile {
    const store = this.loadStore();
    if (store.profiles.length <= 1) {
      store.profiles[0].save = this.createDefaultSave(false);
      this.saveStore(store);
      return store.profiles[0];
    }
    store.profiles = store.profiles.filter(p => p.id !== profileId);
    if (!store.profiles.some(p => p.id === store.activeProfileId)) {
      store.activeProfileId = store.profiles[0].id;
    }
    this.saveStore(store);
    return this.getActiveProfile();
  }

  public static unlockAll(muted: boolean = false): GameSave {
    const save = this.createDefaultSave(true);
    save.muted = muted;
    this.save(save);
    return save;
  }

  public static isFullyUnlocked(save: GameSave): boolean {
    return save.maxUnlockedLevel >= this.MAX_LEVEL && save.completedLevels.length >= this.MAX_LEVEL;
  }

  public static isWorkshopUnlocked(save: GameSave): boolean {
    return save.completedLevels.includes(this.MAX_LEVEL) || this.isFullyUnlocked(save);
  }

  public static computeStarsForErrors(totalErrors: number): 1 | 2 | 3 {
    if (totalErrors <= 1) return 3;
    if (totalErrors <= 4) return 2;
    return 1;
  }

  public static getTotalStars(save: GameSave): number {
    let sum = 0;
    for (let lvl = 1; lvl <= this.MAX_LEVEL; lvl++) {
      sum += save.levelStars[lvl] || 0;
    }
    return sum;
  }

  public static getRankTitle(totalStars: number): string {
    if (totalStars >= 24) return '👑 Grand Maître du Temps';
    if (totalStars >= 16) return '🌟 Gardien Jour & Nuit';
    if (totalStars >= 8) return '🧭 Éclaireur des Aiguilles';
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

    if (completedLevel === save.maxUnlockedLevel && completedLevel < this.MAX_LEVEL) {
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
    return this.getActiveProfile().save;
  }

  public static save(save: GameSave): void {
    const store = this.loadStore();
    const active = store.profiles.find(p => p.id === store.activeProfileId) || store.profiles[0];
    if (active) {
      active.save = save;
    }
    this.saveStore(store);
  }

  public static reset(): GameSave {
    const fresh = this.createDefaultSave(false);
    this.save(fresh);
    return fresh;
  }
}
