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
    let hours = Math.floor(Math.random() * 12) + 1;
    let minutes = 0;

    if (this.level === 1) {
      // Heures pleines
      minutes = 0;
    } else if (this.level === 2) {
      // Demi-heures (0 ou 30)
      minutes = Math.random() < 0.5 ? 0 : 30;
    } else if (this.level === 3) {
      // Quarts d'heure (0, 15, 30, 45)
      const quarters = [0, 15, 30, 45];
      minutes = quarters[Math.floor(Math.random() * quarters.length)];
    } else if (this.level === 4) {
      // Précision 5 minutes
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 5) {
      // Format 24h (heures de 1 à 24)
      hours = Math.floor(Math.random() * 24) + 1;
      minutes = Math.floor(Math.random() * 12) * 5;
    }

    let text = '';
    const displayHour = this.level === 5 ? hours : (hours % 12 || 12);

    if (minutes === 0) {
      text = `${displayHour}h00`;
    } else if (minutes < 10) {
      text = `${displayHour}h0${minutes}`;
    } else {
      text = `${displayHour}h${minutes}`;
    }

    if (this.level === 5) {
      text += ` (${hours}h)`;
    }

    return { hours, minutes, text };
  }

  public generateChoices(correct: TimeTarget): TimeTarget[] {
    const choices: TimeTarget[] = [correct];

    while (choices.length < 3) {
      const decoy = this.generateQuestion();
      if (!choices.some(c => c.hours === decoy.hours && c.minutes === decoy.minutes)) {
        choices.push(decoy);
      }
    }

    // Mélanger les choix
    return choices.sort(() => Math.random() - 0.5);
  }
}