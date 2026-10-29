import type { WrappedStats } from '@git-wrapped/contracts';
import { dateKeyFromDayNumber, dayNumber } from './internal/time';
import type { ActivityContext } from './internal/context';

/**
 * Ritmo: istogrammi di ore, giorni e mesi e streak. Tutti basati sui commit dell'anno
 * (merge compresi: anche un merge alle 3 di notte è stato fatto alle 3 di notte).
 */

export interface Rhythm {
  hours: number[];
  weekdays: number[];
  months: number[];
  peakHour: number | null;
  peakWeekday: number | null;
}

/** Indice del massimo; a parità vince l'indice più basso. `null` se tutto è zero. */
function peakIndex(values: readonly number[]): number | null {
  let best: number | null = null;
  values.forEach((v, i) => {
    if (v > 0 && (best === null || v > (values[best] ?? 0))) best = i;
  });
  return best;
}

export function computeRhythm(ctx: ActivityContext): Rhythm {
  const hours = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  const months = Array.from({ length: 12 }, () => 0);
  for (const { at } of ctx.commits) {
    hours[at.hour] = (hours[at.hour] ?? 0) + 1;
    weekdays[at.weekday] = (weekdays[at.weekday] ?? 0) + 1;
    months[at.month - 1] = (months[at.month - 1] ?? 0) + 1;
  }
  return { hours, weekdays, months, peakHour: peakIndex(hours), peakWeekday: peakIndex(weekdays) };
}

/** Serie più lunga di giorni consecutivi con almeno un commit. A parità, la prima. */
export function computeStreak(ctx: ActivityContext): WrappedStats['streak'] {
  const days = [...new Set(ctx.commits.map((c) => dayNumber(c.at.dateKey)))].sort((a, b) => a - b);
  if (days.length === 0) return { longestDays: 0, from: null, to: null };

  let bestStart = days[0] ?? 0;
  let bestLength = 1;
  let runStart = bestStart;
  let runLength = 1;
  for (let i = 1; i < days.length; i++) {
    const day = days[i] ?? 0;
    if (day === (days[i - 1] ?? 0) + 1) {
      runLength++;
    } else {
      runStart = day;
      runLength = 1;
    }
    if (runLength > bestLength) {
      bestLength = runLength;
      bestStart = runStart;
    }
  }
  return {
    longestDays: bestLength,
    from: dateKeyFromDayNumber(bestStart),
    to: dateKeyFromDayNumber(bestStart + bestLength - 1),
  };
}
