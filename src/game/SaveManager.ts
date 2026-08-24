export interface GameSave {
  maxUnlockedLevel: number;
  unlockedParts: string[]; // ['spring', 'gears', 'escapement', 'balance', 'hands']
  placedParts: string[];   // Pièces positionnées sur le plan de l'atelier
}

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_watch_save';

  public static load(): GameSave {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      return { 
        maxUnlockedLevel: 1,
        unlockedParts: [], 
        placedParts: []
      };
    }
    try {
      const save = JSON.parse(data);
      return {
        maxUnlockedLevel: save.maxUnlockedLevel ?? 1,
        unlockedParts: save.unlockedParts ?? [],
        placedParts: save.placedParts ?? []
      };
    } catch {
      return { 
        maxUnlockedLevel: 1,
        unlockedParts: [],
        placedParts: []
      };
    }
  }

  public static save(save: GameSave): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(save));
  }
}