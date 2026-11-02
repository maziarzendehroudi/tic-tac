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
    const shiftCompensation = (currentMinutes / 60) * 0.5;
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

  /**
   * Chantier D : Traduit une heure en expression orale française naturelle
   * ("et demie", "et quart", "moins le quart", "Midi", "Minuit") pour enrichir le sens pédagogique.
   */
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
   * Chantiers A, C & D : Génère un indice méthodologique progressif.
   * Au 1er essai, guide l'observation du secteur horaire et des minutes sans donner la solution brute.
   */
  public static buildPedagogicalHint(hours: number, minutes: number, level: number): string {
    const dialHour = hours % 12 || 12;
    const nextHour = (dialHour % 12) + 1;
    const dialMinNum = this.minuteToDialNumber(minutes);

    let hourPart = `la <strong>petite aiguille orange</strong> pointe sur le <strong>${dialHour}</strong>`;
    if (minutes >= 30) {
      // Chantier C : explication explicite du piège de la petite aiguille entre H et H+1
      if (level >= 5 && (hours >= 13 || hours === 0)) {
        const h24Label = hours === 0 ? '00h' : `${hours}h`;
        hourPart = `la <strong>petite aiguille orange</strong> est dans la zone dorée entre <strong>${dialHour}</strong> et <strong>${nextHour}</strong> : elle n'a pas encore atteint le ${nextHour}, il est donc toujours <strong>${h24Label}</strong>`;
      } else {
        hourPart = `la <strong>petite aiguille orange</strong> est dans la zone dorée entre <strong>${dialHour}</strong> et <strong>${nextHour}</strong> : elle n'a pas encore dépassé le ${nextHour}, il est donc toujours <strong>${dialHour}h</strong>`;
      }
    } else if (level >= 5 && (hours >= 13 || hours === 0)) {
      const h24Text = hours === 0 ? '00h (minuit)' : `${hours}h`;
      hourPart = `la <strong>petite aiguille orange</strong> montre le <strong>${dialHour}</strong> (soit <strong>${h24Text}</strong> en orange)`;
    }

    let minPart = '';
    if (minutes === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> est en haut sur <strong>00</strong> (heure pile)`;
    } else if (minutes === 30) {
      minPart = `la <strong>grande aiguille bleue</strong> est en bas sur <strong>30</strong> (« <em>et demie</em> »)`;
    } else if (minutes === 15) {
      minPart = `la <strong>grande aiguille bleue</strong> est à droite sur <strong>15</strong> (« <em>et quart</em> »)`;
    } else if (minutes === 45) {
      minPart = `la <strong>grande aiguille bleue</strong> est à gauche sur <strong>45</strong> (« <em>moins le quart</em> »)`;
    } else if (minutes % 5 === 0) {
      minPart = `la <strong>grande aiguille bleue</strong> pointe sur <strong>${minutes < 10 ? '0' + minutes : minutes}</strong> (${dialMinNum} × 5)`;
    } else {
      const base5 = Math.floor(minutes / 5) * 5;
      const baseNum = base5 === 0 ? 12 : base5 / 5;
      const extra = minutes - base5;
      minPart = `la <strong>grande aiguille bleue</strong> est <strong>${extra} graduation(s)</strong> après le <strong>${baseNum}</strong> (${base5} + ${extra} = <strong>${minutes} min</strong>)`;
    }

    return `${hourPart}, et ${minPart}.`;
  }
}
