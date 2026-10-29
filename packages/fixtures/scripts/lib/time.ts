/**
 * Orari del fuso `Europe/Rome` senza librerie esterne.
 *
 * Un "istante locale" è un numero di millisecondi `Date.UTC(anno, mese, giorno, ore, minuti)`:
 * i campi UTC del numero coincidono con l'orologio di Roma. Così ore, giorni e giorni
 * della settimana si leggono direttamente, e `toIso` aggiunge l'offset corretto.
 */

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Ultima domenica del mese (`monthIndex` 0-based) come giorno del mese. */
function lastSunday(year: number, monthIndex: number): number {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** Ora legale EU: dall'ultima domenica di marzo alle 01:00 UTC all'ultima domenica di ottobre. */
function isSummerTime(utcMs: number): boolean {
  const year = new Date(utcMs).getUTCFullYear();
  const start = Date.UTC(year, 2, lastSunday(year, 2), 1);
  const end = Date.UTC(year, 9, lastSunday(year, 9), 1);
  return utcMs >= start && utcMs < end;
}

/** Istante locale di Roma → offset ISO, es. `+01:00` in inverno, `+02:00` in estate. */
export function romeOffset(localMs: number): string {
  // Con l'ora legale l'UTC è locale - 2h; altrimenti locale - 1h.
  return isSummerTime(localMs - 2 * HOUR) ? '+02:00' : '+01:00';
}

/** Istante locale di Roma → ISO 8601 con offset, es. `2026-03-14T23:41:07+01:00`. */
export function toIso(localMs: number): string {
  const base = new Date(localMs).toISOString().slice(0, 19);
  return `${base}${romeOffset(localMs)}`;
}

/** Istante locale a partire dai campi di calendario (mese 1-based). */
export function romeAt(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

/** Ora del giorno (0–23) nel fuso di Roma. */
export function romeHour(localMs: number): number {
  return new Date(localMs).getUTCHours();
}

/** Giorno della settimana: 0 = lunedì, 6 = domenica. */
export function romeWeekday(localMs: number): number {
  return (new Date(localMs).getUTCDay() + 6) % 7;
}

/** Inizio del giorno (mezzanotte locale) per un istante. */
export function startOfRomeDay(localMs: number): number {
  return Math.floor(localMs / DAY) * DAY;
}

/** Data `YYYY-MM-DD` di un istante locale. */
export function romeDate(localMs: number): string {
  return new Date(localMs).toISOString().slice(0, 10);
}
