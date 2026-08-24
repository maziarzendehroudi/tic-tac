export interface GameSave {
  gears: number;
  levelProgress: number;
  unlockedItems: string[];
  activeTheme: string;
}

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_save_data';

  public static load(): GameSave {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      return { 
        gears: 0, 
        levelProgress: 1, 
        unlockedItems: ['classic'], 
        activeTheme: 'classic' 
      };
    }
    try {
      const save = JSON.parse(data);
      return {
        gears: save.gears ?? 0,
        levelProgress: save.levelProgress ?? 1,
        unlockedItems: save.unlockedItems ?? ['classic'],
        activeTheme: save.activeTheme ?? 'classic'
      };
    } catch {
      return { 
        gears: 0, 
        levelProgress: 1, 
        unlockedItems: ['classic'], 
        activeTheme: 'classic' 
      };
    }
  }

  public static save(save: GameSave): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(save));
  }
}