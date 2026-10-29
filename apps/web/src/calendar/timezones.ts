/**
 * Fusi orari: mappa dei nomi Windows (usati da Outlook nei TZID) verso nomi IANA, e
 * conversione "ora locale in un fuso IANA" -> millisecondi UTC, senza dipendenze.
 * Serve quando un evento usa un TZID senza VTIMEZONE corrispondente nel file.
 */

export const WINDOWS_TO_IANA: Record<string, string> = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'GTB Standard Time': 'Europe/Bucharest',
  'Russian Standard Time': 'Europe/Moscow',
  'Turkey Standard Time': 'Europe/Istanbul',
  'Israel Standard Time': 'Asia/Jerusalem',
  'Egypt Standard Time': 'Africa/Cairo',
  'South Africa Standard Time': 'Africa/Johannesburg',
  UTC: 'UTC',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Canada Central Standard Time': 'America/Regina',
  'Atlantic Standard Time': 'America/Halifax',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'Argentina Standard Time': 'America/Argentina/Buenos_Aires',
  'Arab Standard Time': 'Asia/Riyadh',
  'Arabian Standard Time': 'Asia/Dubai',
  'India Standard Time': 'Asia/Kolkata',
  'Singapore Standard Time': 'Asia/Singapore',
  'China Standard Time': 'Asia/Shanghai',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'New Zealand Standard Time': 'Pacific/Auckland',
};

export function isValidTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** Nome IANA per un TZID di un evento; `fallback` se sconosciuto. */
export function resolveTimeZone(tzid: string | null | undefined, fallback: string): string {
  if (!tzid) return fallback;
  const name = tzid.trim().replace(/^"|"$/g, '');
  const mapped = WINDOWS_TO_IANA[name];
  if (mapped) return mapped;
  return isValidTimeZone(name) ? name : fallback;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function offsetAt(ms: number, timeZone: string): number {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, fmt);
  }
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    p.year ?? 1970,
    (p.month ?? 1) - 1,
    p.day ?? 1,
    (p.hour ?? 0) % 24,
    p.minute ?? 0,
    p.second ?? 0,
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Ora "a muro" (componenti locali) in un fuso IANA -> millisecondi UTC. */
export function wallClockToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  timeZone: string,
): number {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = naive - offsetAt(naive, timeZone);
  // Secondo passaggio: corregge i casi a cavallo di un cambio d'ora legale.
  return naive - offsetAt(first, timeZone);
}
