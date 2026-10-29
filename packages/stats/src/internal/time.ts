/**
 * Gestione dei fusi orari con il solo `Intl.DateTimeFormat`: nessuna dipendenza,
 * funziona identico in Node e nel browser.
 */

export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;

/** Un istante scomposto nel fuso richiesto. `weekday`: 0 = lunedì, 6 = domenica. */
export interface ZonedParts {
  epoch: number;
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  /** Minuti dalla mezzanotte locale (0–1439). */
  minuteOfDay: number;
  /** Data locale `YYYY-MM-DD`. */
  dateKey: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    // Lancia RangeError se il fuso non esiste: meglio fallire subito che sbagliare gli orari.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** Verifica che il fuso sia un identificativo IANA valido. */
export function assertTimezone(timezone: string): void {
  formatterFor(timezone);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function toDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

interface RawParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function rawParts(epoch: number, timezone: string): RawParts {
  const out: RawParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, weekday: 0 };
  for (const part of formatterFor(timezone).formatToParts(new Date(epoch))) {
    switch (part.type) {
      case 'year':
        out.year = Number(part.value);
        break;
      case 'month':
        out.month = Number(part.value);
        break;
      case 'day':
        out.day = Number(part.value);
        break;
      case 'hour':
        // Alcuni motori scrivono "24" per la mezzanotte anche con h23.
        out.hour = Number(part.value) % 24;
        break;
      case 'minute':
        out.minute = Number(part.value);
        break;
      case 'second':
        out.second = Number(part.value);
        break;
      case 'weekday':
        out.weekday = WEEKDAY_INDEX[part.value] ?? 0;
        break;
    }
  }
  return out;
}

export function zonedParts(epoch: number, timezone: string): ZonedParts {
  const p = rawParts(epoch, timezone);
  return {
    epoch,
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour,
    minute: p.minute,
    weekday: p.weekday,
    minuteOfDay: p.hour * 60 + p.minute,
    dateKey: toDateKey(p.year, p.month, p.day),
  };
}

/** Scarto (ms) tra l'ora locale del fuso e UTC in un dato istante. */
function offsetAt(epoch: number, timezone: string): number {
  const whole = epoch - (((epoch % 1000) + 1000) % 1000);
  const p = rawParts(whole, timezone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole;
}

/** Istante corrispondente a un'ora locale "da parete" nel fuso (gestisce l'ora legale). */
export function zonedWallTimeToEpoch(
  timezone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetAt(guess, timezone);
  const second = guess - offsetAt(first, timezone);
  return second;
}

/** Inizio (incluso) e fine (esclusa) dell'anno nel fuso, in ms. */
export function yearBounds(year: number, timezone: string): { start: number; end: number } {
  return {
    start: zonedWallTimeToEpoch(timezone, year, 1, 1),
    end: zonedWallTimeToEpoch(timezone, year + 1, 1, 1),
  };
}

/** Numero progressivo del giorno di calendario (indipendente dal fuso) da `YYYY-MM-DD`. */
export function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / MS_PER_DAY);
}

/** Inverso di `dayNumber`. */
export function dateKeyFromDayNumber(n: number): string {
  const date = new Date(n * MS_PER_DAY);
  return toDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** `Date.parse` che restituisce `null` invece di `NaN`. */
export function parseInstant(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}
