import { TimeMath } from './TimeMath';

export interface TimeTarget {
  hours: number;       // Heure réelle sur 24h (0..23)
  minutes: number;     // Minutes (0..59)
  text: string;        // Texte affiché ("8h00" en Niv 1-4, "20h00" ou "08h00" en Niv 5-6)
  isDay: boolean;      // true = Jour (06h..17h), false = Nuit (18h..05h)
  periodLabel: string; // Ex: "☀️ Jour — Matin" ou "🌙 Nuit — Soir"
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

  public static getPeriodLabel(hours24: number, level: number): string {
    const h = ((hours24 % 24) + 24) % 24;
    if (level < 5) {
      return TimeMath.isDayTime(h)
        ? '☀️ Heure du Jour'
        : '🌙 Heure du Soir / de la Nuit';
    }
    if (h === 0) return '🌙 Nuit — Minuit (00h)';
    if (h >= 1 && h < 6) return '🌙 Nuit (01h - 05h)';
    if (h >= 6 && h < 12) return '☀️ Jour — Matin (06h - 11h)';
    if (h === 12) return '☀️ Jour — Midi (12h)';
    if (h >= 13 && h < 18) return '☀️ Jour — Après-midi (13h - 17h)';
    return '🌙 Nuit — Soir (18h - 23h)';
  }

  public generateQuestion(): TimeTarget {
    let candidate = this.buildCandidate();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (candidate.text !== this.lastQuestionText) break;
      candidate = this.buildCandidate();
    }
    this.lastQuestionText = candidate.text;
    return candidate;
  }

  private buildCandidate(): TimeTarget {
    let hours = Math.floor(Math.random() * 24);
    let minutes = 0;

    if (this.level === 1) {
      // Niveau 1 : Heures piles (alternance Jour ☀️ / Nuit 🌙 pour découvrir l'ambiance)
      minutes = 0;
    } else if (this.level === 2) {
      // Niveau 2 : Demi-heures (:30 privilégié à 75%)
      minutes = Math.random() < 0.75 ? 30 : 0;
    } else if (this.level === 3) {
      // Niveau 3 : Quarts d'heure (:15, :30, :45)
      const quarters = [15, 30, 45, 15, 45, 0];
      minutes = quarters[Math.floor(Math.random() * quarters.length)];
    } else if (this.level === 4) {
      // Niveau 4 : Toutes les 5 minutes
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 5) {
      // Niveau 5 : Les 24 heures (accent sur l'après-midi/soir 13h..23h et minuit 00h)
      if (Math.random() < 0.75) {
        const afternoonEvening = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
        hours = afternoonEvening[Math.floor(Math.random() * afternoonEvening.length)];
      } else {
        hours = Math.floor(Math.random() * 12) + 1;
      }
      minutes = Math.floor(Math.random() * 12) * 5;
    } else if (this.level === 6) {
      // Niveau 6 : Maître du Temps (24h + précision à la minute)
      hours = Math.floor(Math.random() * 24);
      minutes = Math.floor(Math.random() * 60);
      if (minutes % 5 === 0) {
        minutes = (minutes + Math.floor(Math.random() * 4) + 1) % 60;
      }
    }

    const isDay = TimeMath.isDayTime(hours);
    const text = QuestionManager.formatTimeText(hours, minutes, this.level);
    const periodLabel = QuestionManager.getPeriodLabel(hours, this.level);

    return { hours, minutes, text, isDay, periodLabel };
  }

  public generateChoices(correct: TimeTarget): TimeTarget[] {
    const choices: TimeTarget[] = [correct];

    const isDistinctAndUnambiguous = (cand: TimeTarget): boolean => {
      return !choices.some(
        c =>
          c.text === cand.text ||
          (this.level < 5 && (c.hours % 12) === (cand.hours % 12) && c.minutes === cand.minutes)
      );
    };

    // Au Niveau 5 et 6 : on ajoute un leurre 12h/24h (ex: 08h15 vs 20h15) pour que l'enfant utilise le fond Jour/Nuit !
    if (this.level >= 5) {
      const oppositeHour = (correct.hours + 12) % 24;
      const amPmDecoy: TimeTarget = {
        hours: oppositeHour,
        minutes: correct.minutes,
        text: QuestionManager.formatTimeText(oppositeHour, correct.minutes, this.level),
        isDay: TimeMath.isDayTime(oppositeHour),
        periodLabel: QuestionManager.getPeriodLabel(oppositeHour, this.level)
      };
      if (isDistinctAndUnambiguous(amPmDecoy)) {
        choices.push(amPmDecoy);
      }
    }

    // Leurre sur l'heure voisine (+1h ou -1h) avec la même minute
    const deltaH = Math.random() < 0.5 ? 1 : -1;
    const closeHour = (correct.hours + deltaH + 24) % 24;
    const hourDecoy: TimeTarget = {
      hours: closeHour,
      minutes: correct.minutes,
      text: QuestionManager.formatTimeText(closeHour, correct.minutes, this.level),
      isDay: TimeMath.isDayTime(closeHour),
      periodLabel: QuestionManager.getPeriodLabel(closeHour, this.level)
    };
    if (choices.length < 3 && isDistinctAndUnambiguous(hourDecoy)) {
      choices.push(hourDecoy);
    }

    // Leurre sur les minutes avec la même heure
    if (choices.length < 3 && this.level >= 2) {
      let altMin = (correct.minutes + 30) % 60;
      if (this.level === 3) altMin = (correct.minutes + 15) % 60;
      else if (this.level === 4 || this.level === 5) altMin = (correct.minutes + 5) % 60;
      else if (this.level === 6) altMin = (correct.minutes + 5) % 60;

      const minDecoy: TimeTarget = {
        hours: correct.hours,
        minutes: altMin,
        text: QuestionManager.formatTimeText(correct.hours, altMin, this.level),
        isDay: correct.isDay,
        periodLabel: correct.periodLabel
      };
      if (isDistinctAndUnambiguous(minDecoy)) {
        choices.push(minDecoy);
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
