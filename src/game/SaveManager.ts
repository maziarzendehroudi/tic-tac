export interface GameSave {
  maxUnlockedLevel: number;
  unlockedParts: string[];
  placedParts: string[];
}

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_watch_save';

  public static load(): GameSave {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      // MODE TEST : Tout débloquer par défaut pour les tests en navigation privée
      return { 
        maxUnlockedLevel: 6,
        unlockedParts: ['crown', 'spring', 'hours', 'minutes', 'seconds'], 
        placedParts: [] // L'établi contient les pièces, prêtes à être montées/démontées
      };
    }
    try {
      const save = JSON.parse(data);
      return {
        maxUnlockedLevel: Math.max(save.maxUnlockedLevel ?? 1, 6), // Force l'accès aux 6 niveaux
        unlockedParts: save.unlockedParts?.length ? save.unlockedParts : ['crown', 'spring', 'hours', 'minutes', 'seconds'],
        placedParts: save.placedParts ?? []
      };
    } catch {
      return { 
        maxUnlockedLevel: 6,
        unlockedParts: ['crown', 'spring', 'hours', 'minutes', 'seconds'],
        placedParts: []
      };
    }
  }

  public static save(save: GameSave): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(save));
  }
}