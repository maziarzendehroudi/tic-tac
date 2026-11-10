export class TimeMath {
  public static normalizeAngle(angle: number): number {
    let a = angle;
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
  }

  public static isDayTime(hours24: number): boolean {
    const h = ((hours24 % 24) + 24) % 24;
    return h >= 6 && h < 18;
  }

  public static is24HourLevel(level: number): boolean {
    return level === 2 || level >= 7;
  }

  public static pointerToMinutes(x: number, y: number): number {
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += 2 * Math.PI;
    return Math.round((angle / (2 * Math.PI)) * 60) % 60;
  }

  public static pointerToHours(x: number, y: number, currentMinutes: number = 0): number {
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += 2 * Math.PI;
    const rawHours = (angle / (2 * Math.PI)) * 12;
    const shiftCompensation = (currentMinutes / 60) * 0.35;
    const adjusted = (rawHours - shiftCompensation + 12) % 12;
    const totalHours = Math.round(adjusted) % 12;
    return totalHours === 0 ? 12 : totalHours;
  }

  public static distToSegment(px: number, py: number, x2: number, y2: number): number {
    const lenSq = x2 * x2 + y2 * y2 || 1;
    const t = Math.max(0, Math.min(1, (px * x2 + py * y2) / lenSq));
    const projX = t * x2;
    const projY = t * y2;
    return Math.hypot(px - projX, py - projY);
  }

  public static pickHandFromPointer(
    x: number,
    y: number,
    hours: number,
    minutes: number,
    radius: number,
    level: number,
    currentActive: 'hour' | 'minute',
    targetHours?: number,
    targetMinutes?: number
  ): 'hour' | 'minute' {
    if (level <= 2) return 'hour';
    if (level === 3) return 'minute';

    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    const minuteAngle = (minutes * Math.PI) / 30;

    const hourLen = level === 7 ? radius - 118 : radius - 96;
    const minLen = level <= 6 ? radius - 42 : radius - 24;

    const hx = Math.sin(hourAngle) * hourLen;
    const hy = -Math.cos(hourAngle) * hourLen;
    const mx = Math.sin(minuteAngle) * minLen;
    const my = -Math.cos(minuteAngle) * minLen;

    const dHour = this.distToSegment(x, y, hx, hy);
    const dMin = this.distToSegment(x, y, mx, my);

    if (dHour < 42 || dMin < 42) {
      if (Math.abs(dHour - dMin) < 16) {
        if (typeof targetHours === 'number' && typeof targetMinutes === 'number') {
          const isHourAlreadyOk = (hours % 12) === (targetHours % 12);
          const isMinAlreadyOk =
            level >= 6
              ? this.circularMinuteDiff(minutes, targetMinutes) <= 1
              : minutes === targetMinutes;
          if (isHourAlreadyOk && !isMinAlreadyOk) return 'minute';
          if (!isHourAlreadyOk && isMinAlreadyOk) return 'hour';
        }
        return Math.hypot(x, y) > hourLen * 0.82 ? 'minute' : 'hour';
      }
      return dHour < dMin ? 'hour' : 'minute';
    }

    const distFromCenter = Math.hypot(x, y);
    if (distFromCenter > radius * 0.62) return 'minute';
    if (distFromCenter < radius * 0.52) return 'hour';
    return currentActive;
  }

  public static snapMinutes(minutes: number, level: number): number {
    if (level <= 2) return 0;
    const clean = ((minutes % 60) + 60) % 60;
    if (level >= 6) return clean;
    const snapped = Math.round(clean / 5) * 5;
    return snapped >= 60 ? 0 : snapped;
  }

  public static circularMinuteDiff(minA: number, minB: number): number {
    const diff = Math.abs((minA % 60) - (minB % 60));
    return Math.min(diff, 60 - diff);
  }

  public static isPlacementCorrect(
    currentHours: number,
    currentMinutes: number,
    targetHours: number,
    targetMinutes: number,
    level: number
  ): boolean {
    const isHourCorrect = (currentHours % 12) === (targetHours % 12);
    if (level <= 2) return isHourCorrect;
    if (level === 3) return currentMinutes === targetMinutes;

    const isMinuteCorrect =
      level >= 6
        ? this.circularMinuteDiff(currentMinutes, targetMinutes) <= 1
        : currentMinutes === targetMinutes;

    return isHourCorrect && isMinuteCorrect;
  }

  public static minuteToDialNumber(minutes: number): number {
    const n = Math.round(minutes / 5) % 12;
    return n === 0 ? 12 : n;
  }

  public static formatSpokenTime(hours24: number, minutes: number, level: number): string {
    const h24 = ((hours24 % 24) + 24) % 24;
    const h12 = h24 % 12 || 12;
    const nextH12 = (h12 % 12) + 1;

    if (level === 1) return `${h12} heures`;
    if (level === 2) {
      if (h24 === 12) return 'Midi';
      if (h24 === 0) return 'Minuit';
      return `${h24} heures`;
    }
    if (level === 3) return `${minutes} minutes`;

    if (level >= 7 && minutes === 0) {
      if (h24 === 12) return 'Midi pile';
      if (h24 === 0) return 'Minuit pile';
    }

    if (minutes === 0 && level === 4) return `${h12} heures pile`;
    if (minutes === 15 && level === 5) return `${h12} heures et quart`;
    if (minutes === 30 && (level === 4 || level === 5)) return `${h12} heures et demie`;
    if (minutes === 45 && level === 5) return `${nextH12} heures moins le quart`;
    return '';
  }

  public static buildReadDiagnosticHint(
    targetHours: number,
    targetMinutes: number,
    chosenHours: number,
    chosenMinutes: number,
    level: number
  ): string {
    const targetH12 = targetHours % 12 || 12;
    const chosenH12 = chosenHours % 12 || 12;
    const nextH12 = (targetH12 % 12) + 1;
    const blueHandDialNum = this.minuteToDialNumber(targetMinutes);

    if (level === 1) {
      return 'Regarde bien vers quel chiffre pointe la <strong>petite aiguille orange</strong> des heures !';
    }

    if (level === 2) {
      if (chosenH12 === targetH12 && chosenHours !== targetHours) {
        if (targetHours === 0) {
          return 'C’est <strong>minuit</strong> : regarde le nombre orange <strong>00</strong> en haut du cadran !';
        }
        if (targetHours === 12) {
          return 'C’est <strong>midi</strong> : au milieu de la journée, midi s’écrit <strong>12 h</strong> !';
        }
        if (targetHours >= 13) {
          return 'C’est <strong>l’après-midi ou le soir</strong> : lis le petit nombre <strong>orange</strong> à l’intérieur du cadran !';
        }
        return 'C’est <strong>le matin ou la nuit</strong> : lis le grand chiffre noir entre <strong>1 et 11</strong> !';
      }
      return 'Suis la <strong>petite aiguille orange</strong> et observe l’étiquette Jour/Nuit au-dessus de la question.';
    }

    if (level === 3) {
      if (chosenMinutes === blueHandDialNum && targetMinutes !== blueHandDialNum) {
        return 'Attention : lis le petit nombre <strong>bleu</strong> au bord du cadran (de 5 en 5), pas le chiffre des heures !';
      }
      return 'Suis la pointe de la <strong>grande aiguille bleue</strong> jusqu’au nombre bleu écrit sur le bord extérieur.';
    }

    if (level >= 7 && chosenH12 === targetH12 && chosenMinutes === targetMinutes && chosenHours !== targetHours) {
      if (targetHours === 0) {
        return 'C’est <strong>la nuit (minuit)</strong> : en haut du cadran, minuit s’écrit <strong>00</strong> !';
      }
      if (targetHours === 12) {
        return 'C’est <strong>le midi</strong> : au milieu de la journée, midi s’écrit <strong>12</strong> !';
      }
      if (targetHours >= 13) {
        if (level >= 8) {
          return 'C’est <strong>l’après-midi ou le soir</strong> : ajoute 12 à l’heure du matin (ex : 1h ➔ 13h, 4h ➔ 16h) !';
        }
        return 'C’est <strong>l’après-midi ou le soir</strong> : lis le petit nombre <strong>orange</strong> à l’intérieur du cadran !';
      }
      return 'C’est <strong>le matin / la nuit (avant midi)</strong> : lis l’heure entre <strong>01 et 11</strong> !';
    }

    if (chosenMinutes === targetMinutes && targetMinutes >= 30 && chosenH12 === nextH12) {
      return 'Piège ! La <strong>petite aiguille orange</strong> s’approche du chiffre suivant, mais elle ne l’a <strong>pas encore dépassé</strong>.';
    }

    if (chosenH12 === blueHandDialNum && chosenH12 !== targetH12) {
      return 'Attention à ne pas inverser : c’est la <strong>petite aiguille orange</strong> qui indique les heures !';
    }

    if (chosenMinutes === targetMinutes) {
      if (level === 8) {
        return 'Les minutes sont justes ! Aide-toi des repères <strong>12, 3, 6, 9</strong> pour trouver l’heure de la petite aiguille orange.';
      }
      return 'Les minutes sont justes ! Regarde bien vers quel chiffre pointe la <strong>petite aiguille orange</strong>.';
    }

    if (chosenH12 === targetH12) {
      if (level === 4) {
        return 'L’heure est juste ! En haut c’est <strong>:00</strong> (heure pile), tout en bas c’est <strong>:30</strong> (et demie).';
      }
      if (level === 5) {
        return 'L’heure est juste ! Regarde le nombre bleu pointé par la <strong>grande aiguille bleue</strong> (:15 à droite, :30 en bas, :45 à gauche).';
      }
      if (level === 6) {
        return 'L’heure est juste ! Pars du nombre bleu le plus proche (de 5 en 5) et compte les petites graduations.';
      }
      return 'L’heure est juste ! Compte de 5 en 5 sur les grands traits bleus, puis ajoute les petites graduations.';
    }

    return 'Observe d’abord la <strong>petite aiguille orange</strong> pour l’heure, puis la <strong>grande aiguille bleue</strong> pour les minutes.';
  }

  public static buildPlacementDiagnosticHint(
    currentHours: number,
    currentMinutes: number,
    targetHours: number,
    targetMinutes: number,
    level: number
  ): string {
    if (level === 1) {
      return 'Glisse la <strong>petite aiguille orange</strong> avec ton doigt vers le chiffre demandé.';
    }
    if (level === 2) {
      if (targetHours >= 13 || targetHours === 0) {
        return 'Glisse la <strong>petite aiguille orange</strong> en face du petit nombre <strong>orange</strong> demandé !';
      }
      return 'Glisse la <strong>petite aiguille orange</strong> sur le chiffre des heures demandé.';
    }
    if (level === 3) {
      return 'Glisse la <strong>grande aiguille bleue</strong> vers le nombre bleu des minutes écrit au bord du cadran.';
    }

    const isHourCorrect = (currentHours % 12) === (targetHours % 12);
    const isMinuteCorrect =
      level >= 6
        ? this.circularMinuteDiff(currentMinutes, targetMinutes) <= 1
        : currentMinutes === targetMinutes;

    if (isHourCorrect && !isMinuteCorrect) {
      if (targetMinutes === 0) {
        return 'L’heure est bonne ! Pour <strong>:00 (heure pile)</strong>, glisse la grande aiguille bleue tout en haut sur le 12.';
      }
      if (level === 4 && targetMinutes === 30) {
        return 'L’heure est bonne ! Pour <strong>:30 (« et demie »)</strong>, glisse la grande aiguille bleue tout en bas sur le 6.';
      }
      if (level >= 6) {
        const diff = this.circularMinuteDiff(currentMinutes, targetMinutes);
        if (diff <= 4) {
          return 'Tu es tout près ! Glisse doucement la <strong>grande aiguille bleue</strong> sur la graduation exacte.';
        }
        return 'L’heure est bonne ! Compte de 5 en 5 sur les grands traits bleus, puis ajuste la <strong>grande aiguille bleue</strong>.';
      }
      return 'L’heure est bonne ! Glisse maintenant la <strong>grande aiguille bleue</strong> sur le repère des minutes demandé.';
    }

    if (!isHourCorrect && isMinuteCorrect) {
      if (level === 8) {
        return 'Les minutes sont bonnes ! Aide-toi des repères <strong>12, 3, 6, 9</strong> pour placer la <strong>petite aiguille orange</strong>.';
      }
      if (level >= 7 && targetHours >= 13) {
        return 'Les minutes sont bonnes ! Pour l’après-midi ou le soir, retranche 12 pour trouver le chiffre de la <strong>petite aiguille orange</strong>.';
      }
      return 'Les minutes sont bonnes ! Glisse maintenant la <strong>petite aiguille orange</strong> sur le chiffre des heures demandé.';
    }

    return 'Glisse d’abord la <strong>petite aiguille orange</strong> sur l’heure, puis la <strong>grande aiguille bleue</strong> sur les minutes.';
  }
}
