export interface GameSave {
  gears: number;
  maxUnlockedLevel: number;
  unlockedItems: string[];
  unlockedHands: string[];
  activeTheme: string;
  activeHands: string;
}

export class SaveManager {
  private static STORAGE_KEY = 'tic_tac_save_data';

  public static load(): GameSave {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      return { 
        gears: 0, 
        maxUnlockedLevel: 1,
        unlockedItems: ['classic'], 
        unlockedHands: ['classic-hands'],
        activeTheme: 'classic',
        activeHands: 'classic-hands'
      };
    }
    try {
      const save = JSON.parse(data);
      return {
        gears: save.gears ?? 0,
        maxUnlockedLevel: save.maxUnlockedLevel ?? 1,
        unlockedItems: save.unlockedItems ?? ['classic'],
        unlockedHands: save.unlockedHands ?? ['classic-hands'],
        activeTheme: save.activeTheme ?? 'classic',
        activeHands: save.activeHands ?? 'classic-hands'
      };
    } catch {
      return { 
        gears: 0, 
        maxUnlockedLevel: 1,
        unlockedItems: ['classic'], 
        unlockedHands: ['classic-hands'],
        activeTheme: 'classic',
        activeHands: 'classic-hands'
      };
    }
  }

  public static save(save: GameSave): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(save));
  }
}