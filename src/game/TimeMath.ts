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

  /**
   * Indique si l'heure sur 24h se lit sur la couronne intérieure 24h (13h..23h ou 00h)
   */
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
    const shiftCompensation = (currentMinutes / 60) * 0.5;
    const adjusted = (rawHours - shiftCompensation + 12) % 12;
    const totalHours = Math.round(adjusted) % 12;
    return totalHours === 0 ? 12 : totalHours;
  }

  /**
   * Calcule la distance entre un point (px, py) et un segment d'aiguille allant de (0,0) à (x2, y2)
   */
  public static distToSegment(px: number, py: number, x2: number, y2: number): number {
    const lenSq = x2 * x2 + y2 * y2 || 1;
    const t = Math.max(0, Math.min(1, (px * x2 + py * y2) / lenSq));
    const projX = t * x2;
    const projY = t * y2;
    return Math.hypot(px - projX, py - projY);
  }

  /**
   * Détermine quelle aiguille l'enfant souhaite attraper lorsqu'il touche le cadran en (x, y)
   */
  public static pickHandFromPointer(
    x: number,
    y: number,
    hours: number,
    minutes: number,
    radius: number,
    level: number,
    currentActive: 'hour' | 'minute'
  ): 'hour' | 'minute' {
    // Au Niveau 1 (Heures piles), les minutes restent à 00 : on manipule directement les heures
    if (level === 1 && minutes === 0) {
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

    // Si le doigt touche clairement l'une des deux aiguilles (à moins de 34 px)
    if (dHour < 34 || dMin < 34) {
      if (Math.abs(dHour - dMin) < 10) {
        // Si les deux aiguilles sont superposées, la zone extérieure prend la grande, l'intérieure la petite
        return Math.hypot(x, y) > hourLen * 0.85 ? 'minute' : 'hour';
      }
      return dHour < dMin ? 'hour' : 'minute';
    }

    // Sinon, sélection naturelle selon la couronne touchée (piste extérieure = minutes, cœur = heures)
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

  public static buildPedagogicalHint(hours: number, minutes: number, level: number): string {
    const dialHour = hours % 12 || 12;
    const dialMinNum = this.minuteToDialNumber(minutes);

    let hourPart = `la <strong>petite aiguille orange</strong> montre le <strong>${dialHour}</strong>`;
    if (level >= 5 && (hours >= 13 || hours === 0)) {
      const h24Text = hours === 0 ? '00h (minuit)' : `${hours}h`;
      hourPart = `la <strong>petite aiguille orange</strong> pointe vers le <strong>${dialHour}</strong> (<strong>${h24Text}</strong> en orange)`;
    } else if (minutes >= 30) {
      const nextHour = (dialHour % 12) + 1;
      hourPart = `la <strong>petite aiguille orange</strong> est entre le <strong>${dialHour}</strong> et le <strong>${nextHour}</strong> (il est donc <strong>${dialHour}h</strong>)`;
    }

    let minPart = '';
    if (minutes === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> est en haut sur le <strong>12</strong> (<strong>00 min</strong>)`;
    } else if (minutes === 30) {
      minPart = `la <strong>grande aiguille bleue</strong> est en bas sur <strong>30</strong> (et demie)`;
    } else if (minutes === 15) {
      minPart = `la <strong>grande aiguille bleue</strong> est sur <strong>15</strong> (et quart)`;
    } else if (minutes === 45) {
      minPart = `la <strong>grande aiguille bleue</strong> est sur <strong>45</strong> (moins le quart)`;
    } else if (minutes % 5 === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> pointe sur <strong>${minutes < 10 ? '0' + minutes : minutes}</strong> (${dialMinNum} × 5)`;
    } else {
      const base5 = Math.floor(minutes / 5) * 5;
      const baseNum = base5 === 0 ? 12 : base5 / 5;
      const extra = minutes - base5;
      minPart = `la <strong>grande aiguille bleue</strong> est <strong>${extra} graduation(s)</strong> après le <strong>${baseNum}</strong> (<strong>${minutes} min</strong>)`;
    }

    return `${hourPart}, et ${minPart}.`;
  }
}
