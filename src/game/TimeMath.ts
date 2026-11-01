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
   * Détermine si une heure sur 24h (0..23) appartient au Jour (06h00 - 17h59) ou à la Nuit (18h00 - 05h59)
   */
  public static isDayTime(hours24: number): boolean {
    const h = ((hours24 % 24) + 24) % 24;
    return h >= 6 && h < 18;
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
   * Aimante les minutes sur la graduation adaptée au niveau (sauf au niveau 6 : précision à la minute)
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
   * Retourne le chiffre du cadran (1 à 12) correspondant à une minute multiple de 5
   */
  public static minuteToDialNumber(minutes: number): number {
    const n = Math.round(minutes / 5) % 12;
    return n === 0 ? 12 : n;
  }

  /**
   * Génère une explication pédagogique claire pour l'enfant
   */
  public static buildPedagogicalHint(hours: number, minutes: number, level: number): string {
    const dialHour = hours % 12 || 12;
    const dialMinNum = this.minuteToDialNumber(minutes);

    let hourPart = `la <strong>petite aiguille dorée</strong> montre le <strong>${dialHour}</strong>`;
    if (level >= 5 && (hours >= 13 || hours === 0)) {
      const h24Text = hours === 0 ? '00h (minuit)' : `${hours}h`;
      hourPart = `la <strong>petite aiguille dorée</strong> pointe vers le <strong>${dialHour}</strong> (pastille intérieure <strong>${h24Text}</strong>)`;
    } else if (minutes >= 30) {
      const nextHour = (dialHour % 12) + 1;
      hourPart = `la <strong>petite aiguille dorée</strong> est entre le <strong>${dialHour}</strong> et le <strong>${nextHour}</strong> (il est toujours <strong>${dialHour}h</strong>)`;
    }

    let minPart = '';
    if (minutes === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> est tout en haut sur <strong>00</strong> (le 12 = heure pile)`;
    } else if (minutes === 30) {
      minPart = `la <strong>grande aiguille bleue</strong> est tout en bas sur <strong>30</strong> (le 6 = et demie)`;
    } else if (minutes === 15) {
      minPart = `la <strong>grande aiguille bleue</strong> est à droite sur <strong>15</strong> (le 3 = et quart)`;
    } else if (minutes === 45) {
      minPart = `la <strong>grande aiguille bleue</strong> est à gauche sur <strong>45</strong> (le 9 = moins le quart)`;
    } else if (minutes % 5 === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> pointe sur <strong>${minutes < 10 ? '0' + minutes : minutes}</strong> en face du <strong>${dialMinNum}</strong> (${dialMinNum} × 5 = <strong>${minutes} min</strong>)`;
    } else {
      const base5 = Math.floor(minutes / 5) * 5;
      const baseNum = base5 === 0 ? 12 : base5 / 5;
      const extra = minutes - base5;
      minPart = `la <strong>grande aiguille bleue</strong> est <strong>${extra} petite(s) graduation(s)</strong> après le <strong>${baseNum}</strong> (${base5} + ${extra} = <strong>${minutes} min</strong>)`;
    }

    return `Regarde bien : ${hourPart}, et ${minPart}.`;
  }
}
