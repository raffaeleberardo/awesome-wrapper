import type { CalendarEvent, CalendarStats } from '@git-wrapped/contracts';

/**
 * Statistiche del calendario. Gira solo nel browser (dentro il Web Worker di A8).
 * Firme congelate a `contracts-v1`; implementazione di A8.
 */

export interface CalendarOptions {
  /** Fuso IANA. Default `Europe/Rome`. */
  timezone?: string;
  /** Commit dell'anno, per `meetingsPerCommit`. `null` se non noti. */
  commits?: number | null;
}

export function computeCalendarStats(
  _events: CalendarEvent[],
  _year: number,
  _options: CalendarOptions = {},
): CalendarStats {
  throw new Error('computeCalendarStats: non ancora implementato (A8)');
}
