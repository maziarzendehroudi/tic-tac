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
   * Format adapté à chaque étape :
   * - Niveau 1 (Heures 12h) : "3 h"
   * - Niveau 2 (Heures 24h) : "15 h", "00 h", "08 h"
   * - Niveau 3 (Minutes seules) : "25 min", "05 min"
   * - Niveaux 4 à 6 (12h) : "9:30", "4:23"
   * - Niveaux 7 et 8 (24h) : "21:30", "09:15"
   */
  public static formatTimeText(hours: number, minutes: number, level: number): string {
    const m = minutes < 10 ? `0${minutes}` : `${minutes}`;
    if (level === 1) {
      const displayHour = hours % 12 || 12;
      return `${displayHour} h`;
    }
    if (level === 2) {
      const h = hours < 10 ? `0${hours}` : `${hours}`;
      return `${h} h`;
    }
    if (level === 3) {
      return `${m} min`;
    }
    if (level >= 7) {
      const h = hours < 10 ? `0${hours}` : `${hours}`;
      return `${h}:${m}`;
    }
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${m}`;
  }

  public static getPeriodLabel(hours24: number, level: number): string {
    if (!TimeMath.is24HourLevel(level)) return '';
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
      if (Math.random() < 0.78) {
        const afternoonEvening = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
        hours = afternoonEvening[Math.floor(Math.random() * afternoonEvening.length)];
      } else {
        hours = Math.floor(Math.random() * 12) + 1;
      }
      minutes = 0;
    } else if (this.level === 3) {
      hours = 12;
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 4) {
      minutes = Math.random() < 0.75 ? 30 : 0;
    } else if (this.level === 5) {
      const quarters = [15, 30, 45, 15, 45, 45];
      minutes = quarters[Math.floor(Math.random() * quarters.length)];
    } else if (this.level === 6) {
      minutes = Math.floor(Math.random() * 60);
      if (minutes % 5 === 0) {
        minutes = (minutes + Math.floor(Math.random() * 4) + 1) % 60;
      }
    } else if (this.level === 7) {
      if (Math.random() < 0.78) {
        const afternoonEvening = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
        hours = afternoonEvening[Math.floor(Math.random() * afternoonEvening.length)];
      } else {
        hours = Math.floor(Math.random() * 12) + 1;
      }
      minutes = Math.floor(Math.random() * 60);
    } else if (this.level >= 8) {
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
    const is24 = TimeMath.is24HourLevel(this.level);
    const cleanH = is24 ? ((hours % 24) + 24) % 24 : ((hours - 1 + 12) % 12) + 1;
    const cleanM = ((minutes % 60) + 60) % 60;
    return {
      hours: cleanH,
      minutes: cleanM,
      text: QuestionManager.formatTimeText(cleanH, cleanM, this.level),
      spokenText: TimeMath.formatSpokenTime(cleanH, cleanM, this.level),
      isDay: TimeMath.isDayTime(cleanH),
      periodLabel: QuestionManager.getPeriodLabel(cleanH, this.level)
    };
  }

  public generateChoices(correct: TimeTarget): TimeTarget[] {
    const choices: TimeTarget[] = [correct];
    const is24 = TimeMath.is24HourLevel(this.level);

    const isDistinctAndUnambiguous = (cand: TimeTarget): boolean => {
      return !choices.some(
        c =>
          c.text === cand.text ||
          (this.level !== 3 && !is24 && (c.hours % 12) === (cand.hours % 12) && c.minutes === cand.minutes)
      );
    };

    // Cas particulier du Niveau 3 (Minutes seules : 3 choix de minutes)
    if (this.level === 3) {
      const step5 = Math.random() < 0.5 ? 5 : -5;
      const decoy1 = this.createTargetFrom(12, correct.minutes + step5);
      if (isDistinctAndUnambiguous(decoy1)) choices.push(decoy1);

      const dialTrap = TimeMath.minuteToDialNumber(correct.minutes);
      const decoy2 = this.createTargetFrom(
        12,
        dialTrap % 5 === 0 ? dialTrap : correct.minutes + 10
      );
      if (isDistinctAndUnambiguous(decoy2)) choices.push(decoy2);

      while (choices.length < 3) {
        const extra = this.createTargetFrom(12, Math.floor(Math.random() * 12) * 5);
        if (isDistinctAndUnambiguous(extra)) choices.push(extra);
      }
      return choices.sort(() => Math.random() - 0.5);
    }

    // 1. LEURRE SUR L'HEURE (même minute)
    if (this.level >= 4 && correct.minutes >= 30) {
      const trapNextHour = this.createTargetFrom(correct.hours + 1, correct.minutes);
      if (isDistinctAndUnambiguous(trapNextHour)) choices.push(trapNextHour);
    }
    if (choices.length < 2 && is24) {
      const amPmDecoy = this.createTargetFrom((correct.hours + 12) % 24, correct.minutes);
      if (isDistinctAndUnambiguous(amPmDecoy)) choices.push(amPmDecoy);
    }
    if (choices.length < 2) {
      const deltaH = Math.random() < 0.5 ? 1 : -1;
      const hourDecoy = this.createTargetFrom(correct.hours + deltaH, correct.minutes);
      if (isDistinctAndUnambiguous(hourDecoy)) choices.push(hourDecoy);
    }

    // 2. LEURRE SUR LES MINUTES (même heure, minute différente) aux Niveaux 4 à 8
    if (this.level >= 4 && choices.length < 3) {
      let altMin = (correct.minutes + 30) % 60;
      if (this.level === 5) {
        altMin = correct.minutes === 15 ? 45 : correct.minutes === 45 ? 15 : 15;
      } else if (this.level >= 6) {
        const deltaM = Math.random() < 0.5 ? 1 : -1;
        altMin = (correct.minutes + deltaM + 60) % 60;
      }

      const minDecoy = this.createTargetFrom(correct.hours, altMin);
      if (isDistinctAndUnambiguous(minDecoy)) choices.push(minDecoy);
    }

    // 3. Complément pour Niveaux 1 et 2 (heures seules) ou sécurité
    if (choices.length < 3) {
      const secondHourDecoy = this.createTargetFrom(correct.hours + 2, correct.minutes);
      if (isDistinctAndUnambiguous(secondHourDecoy)) choices.push(secondHourDecoy);
    }

    while (choices.length < 3) {
      const decoy = this.buildCandidate();
      if (isDistinctAndUnambiguous(decoy)) choices.push(decoy);
    }

    return choices.sort(() => Math.random() - 0.5);
  }
}
