import { TimeMath } from './TimeMath';

export interface TimeTarget {
  hours: number;
  minutes: number;
  text: string;
  spokenText: string;
  isDay: boolean;
  periodLabel: string;
}

export class QuestionManager {
  private level: number;
  private lastQuestionText: string = '';
  private usedQuestions: Set<string> = new Set();

  constructor(level: number = 1) {
    this.level = level;
  }

  public setLevel(level: number): void {
    this.level = level;
    this.usedQuestions.clear();
  }

  public getLevel(): number {
    return this.level;
  }

  public resetHistory(): void {
    this.usedQuestions.clear();
  }

  /**
   * Format universel avec deux-points ("9:30" aux niveaux 1-4, "09:30" / "21:30" aux niveaux 5-7)
   */
  public static formatTimeText(hours: number, minutes: number, level: number): string {
    const m = minutes < 10 ? `0${minutes}` : `${minutes}`;
    if (level >= 5) {
      const h = hours < 10 ? `0${hours}` : `${hours}`;
      return `${h}:${m}`;
    }
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${m}`;
  }

  public static getPeriodLabel(hours24: number, level: number): string {
    if (level < 5) return '';
    const h = ((hours24 % 24) + 24) % 24;
    if (h === 0) return '🌙 Minuit';
    if (h >= 1 && h < 6) return '🌙 Nuit';
    if (h >= 6 && h < 12) return '☀️ Matin';
    if (h === 12) return '☀️ Midi';
    if (h >= 13 && h < 18) return '🌤️ Après-midi';
    return '🌆 Soir';
  }

  public generateQuestion(): TimeTarget {
    let candidate = this.buildCandidate();
    for (let attempt = 0; attempt < 24; attempt++) {
      if (candidate.text !== this.lastQuestionText && !this.usedQuestions.has(candidate.text)) {
        break;
      }
      candidate = this.buildCandidate();
    }
    this.lastQuestionText = candidate.text;
    this.usedQuestions.add(candidate.text);
    return candidate;
  }

  private buildCandidate(): TimeTarget {
    let hours = Math.floor(Math.random() * 12) + 1;
    let minutes = 0;

    if (this.level === 1) {
      minutes = 0;
    } else if (this.level === 2) {
      minutes = Math.random() < 0.75 ? 30 : 0;
    } else if (this.level === 3) {
      const quarters = [15, 30, 45, 15, 45, 45];
      minutes = quarters[Math.floor(Math.random() * quarters.length)];
    } else if (this.level === 4) {
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 5) {
      if (Math.random() < 0.78) {
        const afternoonEvening = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
        hours = afternoonEvening[Math.floor(Math.random() * afternoonEvening.length)];
      } else {
        hours = Math.floor(Math.random() * 12) + 1;
      }
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 6) {
      hours = Math.floor(Math.random() * 24);
      minutes = Math.floor(Math.random() * 60);
      if (minutes % 5 === 0) {
        minutes = (minutes + Math.floor(Math.random() * 4) + 1) % 60;
      }
    } else if (this.level >= 7) {
      const nonCardinalHours24 = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17, 19, 20, 22, 23];
      if (Math.random() < 0.8) {
        hours = nonCardinalHours24[Math.floor(Math.random() * nonCardinalHours24.length)];
      } else {
        hours = Math.floor(Math.random() * 24);
      }
      minutes = Math.floor(Math.random() * 60);
    }

    const isDay = TimeMath.isDayTime(hours);
    const text = QuestionManager.formatTimeText(hours, minutes, this.level);
    const spokenText = TimeMath.formatSpokenTime(hours, minutes, this.level);
    const periodLabel = QuestionManager.getPeriodLabel(hours, this.level);

    return { hours, minutes, text, spokenText, isDay, periodLabel };
  }

  private createTargetFrom(hours: number, minutes: number): TimeTarget {
    const cleanH = this.level >= 5 ? (hours + 24) % 24 : ((hours - 1 + 12) % 12) + 1;
    const cleanM = (minutes + 60) % 60;
    return {
      hours: cleanH,
      minutes: cleanM,
      text: QuestionManager.formatTimeText(cleanH, cleanM, this.level),
      spokenText: TimeMath.formatSpokenTime(cleanH, cleanM, this.level),
      isDay: TimeMath.isDayTime(cleanH),
      periodLabel: QuestionManager.getPeriodLabel(cleanH, this.level)
    };
  }

  /**
   * Génère 3 choix équilibrés :
   * - Au Niveau 1 : la bonne réponse + 2 leurres d'heures.
   * - Aux Niveaux 2 à 7 : la bonne réponse + 1 leurre sur l'HEURE (même minute) + 1 leurre sur la MINUTE (même heure),
   *   afin que l'enfant soit toujours obligé de lire les deux aiguilles !
   */
  public generateChoices(correct: TimeTarget): TimeTarget[] {
    const choices: TimeTarget[] = [correct];

    const isDistinctAndUnambiguous = (cand: TimeTarget): boolean => {
      return !choices.some(
        c =>
          c.text === cand.text ||
          (this.level < 5 && (c.hours % 12) === (cand.hours % 12) && c.minutes === cand.minutes)
      );
    };

    // 1. LEURRE SUR L'HEURE (même minute)
    if (correct.minutes >= 35) {
      const trapNextHour = this.createTargetFrom(correct.hours + 1, correct.minutes);
      if (isDistinctAndUnambiguous(trapNextHour)) {
        choices.push(trapNextHour);
      }
    }
    if (choices.length < 2 && this.level >= 5) {
      const amPmDecoy = this.createTargetFrom((correct.hours + 12) % 24, correct.minutes);
      if (isDistinctAndUnambiguous(amPmDecoy)) {
        choices.push(amPmDecoy);
      }
    }
    if (choices.length < 2) {
      const deltaH = Math.random() < 0.5 ? 1 : -1;
      const hourDecoy = this.createTargetFrom(correct.hours + deltaH, correct.minutes);
      if (isDistinctAndUnambiguous(hourDecoy)) {
        choices.push(hourDecoy);
      }
    }

    // 2. LEURRE SUR LES MINUTES (même heure, minute différente) aux Niveaux 2 à 7
    if (this.level >= 2 && choices.length < 3) {
      let altMin = (correct.minutes + 30) % 60;
      if (this.level === 3) {
        altMin = correct.minutes === 15 ? 45 : correct.minutes === 45 ? 15 : 15;
      } else if (this.level === 4 || this.level === 5) {
        const step5 = Math.random() < 0.5 ? 5 : -5;
        altMin = (correct.minutes + step5 + 60) % 60;
      } else if (this.level >= 6) {
        const deltaM = Math.random() < 0.5 ? 1 : -1;
        altMin = (correct.minutes + deltaM + 60) % 60;
      }

      const minDecoy = this.createTargetFrom(correct.hours, altMin);
      if (isDistinctAndUnambiguous(minDecoy)) {
        choices.push(minDecoy);
      }
    }

    // 3. Complément éventuel (Niveau 1 ou sécurité)
    if (choices.length < 3) {
      const secondHourDecoy = this.createTargetFrom(correct.hours + 2, correct.minutes);
      if (isDistinctAndUnambiguous(secondHourDecoy)) {
        choices.push(secondHourDecoy);
      }
    }

    while (choices.length < 3) {
      const decoy = this.buildCandidate();
      if (isDistinctAndUnambiguous(decoy)) {
        choices.push(decoy);
      }
    }

    return choices.sort(() => Math.random() - 0.5);
  }
}
