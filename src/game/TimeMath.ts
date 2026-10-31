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
   * Convertit des coordonnées cartésiennes (origine au centre du cadran) en heures (1..12)
   */
  public static pointerToHours(x: number, y: number): number {
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += 2 * Math.PI;
    const totalHours = Math.round((angle / (2 * Math.PI)) * 12) % 12;
    return totalHours === 0 ? 12 : totalHours;
  }

  /**
   * Aimante les minutes sur la graduation de 5 en 5 (sauf au niveau 6 expert)
   */
  public static snapMinutes(minutes: number, level: number): number {
    if (level === 6) return ((minutes % 60) + 60) % 60;
    const snapped = Math.round(minutes / 5) * 5;
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
        ? this.circularMinuteDiff(currentMinutes, targetMinutes) <= 2
        : currentMinutes === targetMinutes;

    return isHourCorrect && isMinuteCorrect;
  }
}
