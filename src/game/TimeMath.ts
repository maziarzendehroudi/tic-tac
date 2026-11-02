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

  public static is24HourRingTarget(hours24: number): boolean {
    const h = ((hours24 % 24) + 24) % 24;
    return h === 0 || h >= 13;
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
    currentActive: 'hour' | 'minute'
  ): 'hour' | 'minute' {
    if (level === 1) {
      return 'hour';
    }

    const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360;
    const minuteAngle = (minutes * Math.PI) / 30;

    const hourLen = level >= 5 ? radius - 118 : radius - 96;
    const minLen = level >= 2 && level <= 5 ? radius - 42 : radius - 24;

    const hx = Math.sin(hourAngle) * hourLen;
    const hy = -Math.cos(hourAngle) * hourLen;
    const mx = Math.sin(minuteAngle) * minLen;
    const my = -Math.cos(minuteAngle) * minLen;

    const dHour = this.distToSegment(x, y, hx, hy);
    const dMin = this.distToSegment(x, y, mx, my);

    if (dHour < 34 || dMin < 34) {
      if (Math.abs(dHour - dMin) < 10) {
        return Math.hypot(x, y) > hourLen * 0.85 ? 'minute' : 'hour';
      }
      return dHour < dMin ? 'hour' : 'minute';
    }

    const distFromCenter = Math.hypot(x, y);
    if (distFromCenter > radius * 0.68) return 'minute';
    if (distFromCenter < radius * 0.52) return 'hour';
    return currentActive;
  }

  public static snapMinutes(minutes: number, level: number): number {
    const clean = ((minutes % 60) + 60) % 60;
    if (level === 6) return clean;
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
    const isMinuteCorrect =
      level === 6
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

    if (level >= 5 && minutes === 0) {
      if (h24 === 12) return 'Midi pile';
      if (h24 === 0) return 'Minuit pile';
    }

    if (minutes === 0) {
      return level <= 2 ? `${h12} h pile` : '';
    }
    if (minutes === 15) {
      return level <= 4 ? `${h12} h et quart` : '';
    }
    if (minutes === 30) {
      if (level >= 5 && h24 === 12) return 'Midi et demie';
      if (level >= 5 && h24 === 0) return 'Minuit et demie';
      return level <= 4 ? `${h12} h et demie` : '';
    }
    if (minutes === 45) {
      return level <= 4 ? `${nextH12} h moins le quart` : '';
    }
    return '';
  }

  /**
   * Génère un indice pertinent et ciblé en Phase 1 (Lecture) selon le bouton erroné cliqué par l'enfant,
   * SANS jamais donner le chiffre de la bonne réponse !
   */
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

    // 1. Erreur Matin (1..12) vs Après-midi/Soir/Minuit (13..00) aux Niveaux 5 et 6
    if (level >= 5 && chosenH12 === targetH12 && chosenMinutes === targetMinutes && chosenHours !== targetHours) {
      if (targetHours === 0) {
        return 'C’est <strong>la nuit (minuit)</strong> : en haut du cadran, minuit s’écrit <strong>00h</strong> !';
      }
      if (targetHours === 12) {
        return 'C’est <strong>le midi</strong> : au milieu de la journée, midi s’écrit <strong>12h</strong> !';
      }
      if (targetHours >= 13) {
        return 'C’est <strong>l’après-midi ou le soir</strong> : lis le petit nombre <strong>orange</strong> à l’intérieur du cadran !';
      }
      return 'C’est <strong>le matin / la nuit (avant midi)</strong> : lis le grand chiffre <strong>noir</strong> du cadran !';
    }

    // 2. Piège classique H+1 : les minutes sont justes (>= 30) mais l'enfant a choisi l'heure suivante (ex: 9h45 au lieu de 8h45)
    if (chosenMinutes === targetMinutes && targetMinutes >= 30 && chosenH12 === nextH12) {
      return 'Piège ! La <strong>petite aiguille orange</strong> s’approche du chiffre suivant, mais elle ne l’a <strong>pas encore dépassé</strong>.';
    }

    // 3. Inversion des deux aiguilles (l'enfant a lu l'aiguille bleue comme étant l'heure)
    if (chosenH12 === blueHandDialNum && chosenH12 !== targetH12) {
      return 'Attention à ne pas inverser : c’est la <strong>petite aiguille orange</strong> qui indique les heures !';
    }

    // 4. Les minutes sont justes, mais l'heure est fausse
    if (chosenMinutes === targetMinutes) {
      if (level >= 5 && (targetHours >= 13 || targetHours === 0)) {
        return 'Les minutes sont justes ! Pour l’heure, regarde quel nombre <strong>orange</strong> est pointé par la petite aiguille.';
      }
      return 'Les minutes sont justes ! Regarde bien vers quel chiffre pointe la <strong>petite aiguille orange</strong>.';
    }

    // 5. L'heure est juste, mais les minutes sont fausses
    if (chosenH12 === targetH12) {
      if (level === 2) {
        return 'L’heure est juste ! Pour les minutes : en haut c’est <strong>:00</strong> (heure pile), tout en bas c’est <strong>:30</strong> (et demie).';
      }
      if (level === 3) {
        return 'L’heure est juste ! Regarde le nombre bleu pointé par la <strong>grande aiguille bleue</strong> (:15 à droite, :30 en bas, :45 à gauche).';
      }
      if (level === 4 || level === 5) {
        return 'L’heure est juste ! Suis la <strong>grande aiguille bleue</strong> jusqu’au nombre bleu écrit au bord du cadran.';
      }
      return 'L’heure est juste ! Compte de 5 en 5 jusqu’au dernier grand trait bleu, puis ajoute les petites graduations.';
    }

    // 6. Les deux sont faux
    return 'Observe d’abord la <strong>petite aiguille orange</strong> pour l’heure, puis la <strong>grande aiguille bleue</strong> pour les minutes.';
  }

  /**
   * Génère un indice pertinent en Phase 2 (Placement) selon la position actuelle des aiguilles de l'enfant
   */
  public static buildPlacementDiagnosticHint(
    currentHours: number,
    currentMinutes: number,
    targetHours: number,
    targetMinutes: number,
    level: number
  ): string {
    const isHourCorrect = (currentHours % 12) === (targetHours % 12);
    const isMinuteCorrect =
      level === 6
        ? this.circularMinuteDiff(currentMinutes, targetMinutes) <= 1
        : currentMinutes === targetMinutes;

    if (isHourCorrect && !isMinuteCorrect) {
      if (targetMinutes === 0) {
        return 'L’heure est bonne ! Pour une <strong>heure pile (:00)</strong>, place la grande aiguille bleue tout en haut sur le 12.';
      }
      if (level === 2 && targetMinutes === 30) {
        return 'L’heure est bonne ! Pour <strong>:30 (« et demie »)</strong>, place la grande aiguille bleue tout en bas sur le 6.';
      }
      if (level === 6) {
        const diff = this.circularMinuteDiff(currentMinutes, targetMinutes);
        if (diff <= 4) {
          return 'Tu es tout près ! Utilise les boutons <strong>−</strong> et <strong>+</strong> pour ajuster la grande aiguille bleue à la graduation près.';
        }
        return 'L’heure est bonne ! Compte de 5 en 5 sur les grands traits bleus, puis ajuste les minutes avec <strong>−</strong> et <strong>+</strong>.';
      }
      return 'L’heure est bonne ! Tourne maintenant la <strong>grande aiguille bleue</strong> sur le repère bleu des minutes demandé.';
    }

    if (!isHourCorrect && isMinuteCorrect) {
      if (level >= 5 && (targetHours >= 13 || targetHours === 0)) {
        return 'Les minutes sont bonnes ! Place maintenant la <strong>petite aiguille orange</strong> en face du nombre orange demandé.';
      }
      return 'Les minutes sont bonnes ! Tourne maintenant la <strong>petite aiguille orange</strong> sur le chiffre des heures demandé.';
    }

    if (level === 1) {
      return 'Tourne la <strong>petite aiguille orange</strong> vers le chiffre de l’heure demandée (ou utilise <strong>−</strong> et <strong>+</strong>).';
    }

    return 'Place d’abord la <strong>petite aiguille orange</strong> sur l’heure, puis la <strong>grande aiguille bleue</strong> sur les minutes.';
  }
}
