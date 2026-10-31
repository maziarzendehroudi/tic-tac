export interface TimeTarget {
  hours: number;
  minutes: number;
  text: string;
  periodLabel: string;
}

export class QuestionManager {
  private level: number;
  private lastQuestionText: string = '';

  constructor(level: number = 1) {
    this.level = level;
  }

  public setLevel(level: number): void {
    this.level = level;
  }

  public getLevel(): number {
    return this.level;
  }

  public static formatTimeText(hours: number, minutes: number, level: number): string {
    const m = minutes < 10 ? `0${minutes}` : `${minutes}`;
    if (level >= 5) {
      const h = hours < 10 ? `0${hours}` : `${hours}`;
      return `${h}h${m}`;
    }
    const displayHour = hours % 12 || 12;
    return `${displayHour}h${m}`;
  }

  public static getPeriodLabel(hours: number, level: number): string {
    if (level < 5) return '';
    if (hours >= 0 && hours < 6) return '🌙 Nuit (00h - 05h)';
    if (hours >= 6 && hours < 12) return '☀️ Matin (06h - 11h)';
    if (hours >= 12 && hours < 18) return '🌤️ Après-midi (12h - 17h)';
    return '🌆 Soir (18h - 23h)';
  }

  public generateQuestion(): TimeTarget {
    let candidate = this.buildCandidate();
    // Évite de poser 2 fois de suite exactement la même heure
    for (let attempt = 0; attempt < 5; attempt++) {
      if (candidate.text !== this.lastQuestionText) break;
      candidate = this.buildCandidate();
    }
    this.lastQuestionText = candidate.text;
    return candidate;
  }

  private buildCandidate(): TimeTarget {
    let hours = Math.floor(Math.random() * 12) + 1;
    let minutes = 0;

    if (this.level === 1) {
      // Niveau 1 : Heures pleines (1h00 à 12h00)
      minutes = 0;
    } else if (this.level === 2) {
      // Niveau 2 : Demi-heures (privilégie :30 à 75% pour vraiment exercer la nouveauté)
      minutes = Math.random() < 0.75 ? 30 : 0;
    } else if (this.level === 3) {
      // Niveau 3 : Quarts d'heure (privilégie :15, :30 et :45)
      const quarters = [15, 30, 45, 15, 45, 0];
      minutes = quarters[Math.floor(Math.random() * quarters.length)];
    } else if (this.level === 4) {
      // Niveau 4 : Table de 5 (toutes les 5 minutes)
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 5) {
      // Niveau 5 : Les 24 heures (80% après-midi/soir/minuit 13h..23h & 00h pour exercer le cercle 24h)
      if (Math.random() < 0.8) {
        const pmHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
        hours = pmHours[Math.floor(Math.random() * pmHours.length)];
      } else {
        hours = Math.floor(Math.random() * 12) + 1;
      }
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 6) {
      // Niveau 6 : Maître Horloger (24h + minutes précises hors multiples de 5)
      hours = Math.floor(Math.random() * 24);
      minutes = Math.floor(Math.random() * 60);
      if (minutes % 5 === 0) {
        minutes = (minutes + Math.floor(Math.random() * 4) + 1) % 60;
      }
    }

    const text = QuestionManager.formatTimeText(hours, minutes, this.level);
    const periodLabel = QuestionManager.getPeriodLabel(hours, this.level);
    return { hours, minutes, text, periodLabel };
  }

  /**
   * Génère 3 choix incluant la bonne réponse et 2 leurres pédagogiques ciblés
   * (1 leurre sur l'heure voisine avec la même minute, 1 leurre avec la même heure mais une autre minute)
   * sans jamais créer d'ambiguïté 12h/24h (ex: pas de 03h15 face à 15h15).
   */
  public generateChoices(correct: TimeTarget): TimeTarget[] {
    const choices: TimeTarget[] = [correct];

    const isDistinctAndUnambiguous = (cand: TimeTarget): boolean => {
      return !choices.some(
        c =>
          c.text === cand.text ||
          ((c.hours % 12) === (cand.hours % 12) && c.minutes === cand.minutes)
      );
    };

    // Leurre pédagogique 1 : Heure voisine (+1h ou -1h), même minute (teste la lecture de la petite aiguille)
    const deltaH = Math.random() < 0.5 ? 1 : -1;
    let closeHour = correct.hours + deltaH;
    if (this.level >= 5) {
      closeHour = (closeHour + 24) % 24;
    } else {
      closeHour = ((closeHour - 1 + 12) % 12) + 1;
    }
    const hourDecoy: TimeTarget = {
      hours: closeHour,
      minutes: correct.minutes,
      text: QuestionManager.formatTimeText(closeHour, correct.minutes, this.level),
      periodLabel: QuestionManager.getPeriodLabel(closeHour, this.level)
    };
    if (isDistinctAndUnambiguous(hourDecoy)) {
      choices.push(hourDecoy);
    }

    // Leurre pédagogique 2 : Même heure, autre minute du niveau (teste la lecture de la grande aiguille)
    if (this.level >= 2) {
      let altMin = (correct.minutes + 30) % 60;
      if (this.level === 3) altMin = (correct.minutes + 15) % 60;
      else if (this.level === 4 || this.level === 5) altMin = (correct.minutes + 5) % 60;
      else if (this.level === 6) altMin = (correct.minutes + 10) % 60;

      const minDecoy: TimeTarget = {
        hours: correct.hours,
        minutes: altMin,
        text: QuestionManager.formatTimeText(correct.hours, altMin, this.level),
        periodLabel: correct.periodLabel
      };
      if (isDistinctAndUnambiguous(minDecoy)) {
        choices.push(minDecoy);
      }
    }

    // Complément éventuel (ex: au Niveau 1 où toutes les minutes valent 00)
    while (choices.length < 3) {
      const decoy = this.buildCandidate();
      if (isDistinctAndUnambiguous(decoy)) {
        choices.push(decoy);
      }
    }

    return choices.sort(() => Math.random() - 0.5);
  }
}
