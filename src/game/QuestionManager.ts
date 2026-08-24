export interface TimeTarget {
  hours: number;
  minutes: number;
  text: string;
}

export class QuestionManager {
  private level: number;

  constructor(level: number = 1) {
    this.level = level;
  }

  public setLevel(level: number): void {
    this.level = level;
  }

  public generateQuestion(): TimeTarget {
    let hours = 1;
    let minutes = 0;

    switch (this.level) {
      case 1: // Heures piles (1-12)
        hours = Math.floor(Math.random() * 12) + 1;
        minutes = 0;
        break;
      case 2: // Demi-heures (ex: 4h30)
        hours = Math.floor(Math.random() * 12) + 1;
        minutes = Math.random() < 0.5 ? 0 : 30;
        break;
      case 3: // Quarts d'heure (0, 15, 30, 45)
        hours = Math.floor(Math.random() * 12) + 1;
        minutes = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
        break;
      case 4: // Tranches de 5 minutes
        hours = Math.floor(Math.random() * 12) + 1;
        minutes = Math.floor(Math.random() * 12) * 5;
        break;
      default:
        hours = Math.floor(Math.random() * 12) + 1;
        minutes = 0;
    }

    const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return {
      hours,
      minutes,
      text: `${hours}h${formattedMinutes}`
    };
  }

  public generateChoices(correct: TimeTarget): TimeTarget[] {
    const choices: TimeTarget[] = [correct];

    while (choices.length < 3) {
      const decoy = this.generateQuestion();
      if (!choices.some(c => c.hours === decoy.hours && c.minutes === decoy.minutes)) {
        choices.push(decoy);
      }
    }

    // Mélanger les choix aléatoirement
    return choices.sort(() => Math.random() - 0.5);
  }
}