export class TimeMath {
  /**
   * Normalise un angle en radians dans l'intervalle ]-PI, PI]
   */
  public static normalizeAngle(angle: number): number {
    let a = angle;
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
  }

  /**
   * Convertit des coordonnées cartésiennes (origine au centre du cadran) en minutes (0..59)
   */
  public static pointerToMinutes(x: number, y: number): number {
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += 2 * Math.PI;
    return Math.round((angle / (2 * Math.PI)) * 60) % 60;
  }

  /**
   * Convertit des coordonnées cartésiennes en heures (1..12) en compensant la demi-avance des minutes
   * afin que pointer sur le chiffre H OU sur l'aiguille décalée (H + min/60) sélectionne toujours H.
   */
  public static pointerToHours(x: number, y: number, currentMinutes: number = 0): number {
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += 2 * Math.PI;
    const rawHours = (angle / (2 * Math.PI)) * 12;
    const shiftCompensation = (currentMinutes / 60) * 0.5;
    const adjusted = (rawHours - shiftCompensation + 12) % 12;
    const totalHours = Math.round(adjusted) % 12;
    return totalHours === 0 ? 12 : totalHours;
  }

  /**
   * Aimante les minutes sur la graduation adaptée au niveau (sauf au niveau 6 expert : minute près)
   */
  public static snapMinutes(minutes: number, level: number): number {
    const clean = ((minutes % 60) + 60) % 60;
    if (level === 6) return clean;
    const snapped = Math.round(clean / 5) * 5;
    return snapped >= 60 ? 0 : snapped;
  }

  /**
   * Calcule l'écart minimal circulaire entre deux valeurs de minutes (0..59)
   */
  public static circularMinuteDiff(minA: number, minB: number): number {
    const diff = Math.abs((minA % 60) - (minB % 60));
    return Math.min(diff, 60 - diff);
  }

  /**
   * Vérifie si le placement des aiguilles correspond à l'heure cible selon la tolérance du niveau
   */
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

  /**
   * Retourne le repère sur le cadran (1 à 12) vers lequel pointe la grande aiguille pour une minute donnée
   */
  public static minuteToDialNumber(minutes: number): number {
    const n = Math.round(minutes / 5) % 12;
    return n === 0 ? 12 : n;
  }

  /**
   * Génère une explication pédagogique adaptée à l'âge de l'enfant pour une heure cible
   */
  public static buildPedagogicalHint(hours: number, minutes: number, level: number): string {
    const dialHour = hours % 12 || 12;
    const dialMinNum = this.minuteToDialNumber(minutes);

    let hourPart = `la <strong>petite aiguille dorée</strong> montre <strong>${dialHour}</strong>`;
    if (level >= 5 && (hours >= 13 || hours === 0)) {
      hourPart = `la <strong>petite aiguille dorée</strong> pointe vers <strong>${dialHour}</strong> (soit <strong>${hours === 0 ? '00h' : hours + 'h'}</strong> sur le cercle 24h)`;
    } else if (minutes >= 30) {
      const nextHour = (dialHour % 12) + 1;
      hourPart = `la <strong>petite aiguille dorée</strong> est entre <strong>${dialHour}</strong> et <strong>${nextHour}</strong> (il est donc toujours <strong>${dialHour}h</strong>)`;
    }

    let minPart = '';
    if (minutes === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> est tout en haut sur le <strong>12</strong> (<strong>00 minute</strong> = heure pile)`;
    } else if (minutes === 30) {
      minPart = `la <strong>grande aiguille bleue</strong> est tout en bas sur le <strong>6</strong> (<strong>30 minutes</strong> = et demie)`;
    } else if (minutes === 15) {
      minPart = `la <strong>grande aiguille bleue</strong> est à droite sur le <strong>3</strong> (<strong>15 minutes</strong> = et quart)`;
    } else if (minutes === 45) {
      minPart = `la <strong>grande aiguille bleue</strong> est à gauche sur le <strong>9</strong> (<strong>45 minutes</strong> = moins le quart)`;
    } else if (minutes % 5 === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> est sur le <strong>${dialMinNum}</strong> (${dialMinNum} × 5 = <strong>${minutes} minutes</strong>)`;
    } else {
      const base5 = Math.floor(minutes / 5) * 5;
      const baseNum = base5 === 0 ? 12 : base5 / 5;
      const extra = minutes - base5;
      minPart = `la <strong>grande aiguille bleue</strong> est <strong>${extra} petit(s) trait(s)</strong> après le <strong>${baseNum}</strong> (${base5} + ${extra} = <strong>${minutes} minutes</strong>)`;
    }

    return `Regarde bien : ${hourPart}, et ${minPart}.`;
  }
}
