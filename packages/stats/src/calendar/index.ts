import type { CalendarEvent, CalendarStats } from '@git-wrapped/contracts';

/**
 * Statistiche del calendario. Gira solo nel browser (dentro il Web Worker di A8).
 * Funzione pura: nessun I/O. Riceve eventi già normalizzati (senza testi).
 *
 * Definizioni:
 * - "riunione": evento non tutto-il-giorno e non rifiutato/annullato, che inizia nell'anno
 *   richiesto (anno, ora e giorno sono calcolati nel fuso `timezone`).
 * - `declinedInvites`: eventi rifiutati/annullati non tutto-il-giorno dell'anno.
 * - `longestBackToBack`: serie, nello stesso giorno locale, di riunioni in cui ciascuna inizia
 *   al massimo 5 minuti dopo la fine della precedente (le sovrapposizioni proseguono la serie).
 *   Una riunione isolata non è una serie: servono almeno 2 riunioni, altrimenti `null`.
 * - `mostCrowded`: `null` se nessuna riunione ha partecipanti noti (> 0).
 */

export interface CalendarOptions {
  /** Fuso IANA. Default `Europe/Rome`. */
  timezone?: string;
  /** Commit dell'anno, per `meetingsPerCommit`. `null` se non noti. */
  commits?: number | null;
}

const DEFAULT_TZ = 'Europe/Rome';
const BACK_TO_BACK_GAP_MS = 5 * 60_000;
const FRIDAY = 4;
const FRIDAY_AFTERNOON_HOUR = 14;
const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

interface LocalParts {
  year: number;
  date: string;
  hour: number;
  weekday: number;
}

function makeLocalizer(timezone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  return (ms: number): LocalParts => {
    const p: Record<string, string> = {};
    for (const part of fmt.formatToParts(new Date(ms))) p[part.type] = part.value;
    return {
      year: Number(p.year),
      date: `${p.year}-${p.month}-${p.day}`,
      hour: Number(p.hour) % 24,
      weekday: WEEKDAYS[p.weekday ?? ''] ?? 0,
    };
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Meeting {
  event: CalendarEvent;
  start: number;
  end: number;
  local: LocalParts;
}

function longestBackToBack(meetings: Meeting[]): CalendarStats['longestBackToBack'] {
  const sorted = [...meetings].sort((a, b) => a.start - b.start || a.end - b.end);
  let best: { meetings: number; date: string } | null = null;
  let runLength = 0;
  let runDate = '';
  let runEnd = 0;
  for (const m of sorted) {
    if (runLength > 0 && m.local.date === runDate && m.start - runEnd <= BACK_TO_BACK_GAP_MS) {
      runLength += 1;
      runEnd = Math.max(runEnd, m.end);
    } else {
      runLength = 1;
      runDate = m.local.date;
      runEnd = m.end;
    }
    if (runLength >= 2 && (!best || runLength > best.meetings)) {
      best = { meetings: runLength, date: runDate };
    }
  }
  return best;
}

export function computeCalendarStats(
  events: CalendarEvent[],
  year: number,
  options: CalendarOptions = {},
): CalendarStats {
  const localize = makeLocalizer(options.timezone ?? DEFAULT_TZ);
  const hours = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  const meetings: Meeting[] = [];
  let declinedInvites = 0;

  for (const event of events) {
    if (event.isAllDay) continue;
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const local = localize(start);
    if (local.year !== year) continue;
    if (event.declined) {
      declinedInvites += 1;
      continue;
    }
    meetings.push({ event, start, end: Math.max(start, end), local });
  }

  let totalMs = 0;
  let longest: Meeting | null = null;
  let crowded: Meeting | null = null;
  let friday = 0;
  let teams = 0;
  let recurring = 0;
  for (const m of meetings) {
    const duration = m.end - m.start;
    totalMs += duration;
    if (!longest || duration > longest.end - longest.start) longest = m;
    if (
      m.event.attendeeCount > 0 &&
      (!crowded || m.event.attendeeCount > crowded.event.attendeeCount)
    ) {
      crowded = m;
    }
    if (m.local.weekday === FRIDAY && m.local.hour >= FRIDAY_AFTERNOON_HOUR) friday += 1;
    if (m.event.isTeamsCall) teams += 1;
    if (m.event.isRecurring) recurring += 1;
    hours[m.local.hour] = (hours[m.local.hour] ?? 0) + 1;
    weekdays[m.local.weekday] = (weekdays[m.local.weekday] ?? 0) + 1;
  }

  const n = meetings.length;
  const commits = options.commits ?? null;
  return {
    schemaVersion: 1,
    year,
    meetings: n,
    meetingHours: round2(totalMs / 3_600_000),
    declinedInvites,
    longestMeeting: longest
      ? { minutes: Math.round((longest.end - longest.start) / 60_000), date: longest.local.date }
      : null,
    mostCrowded: crowded
      ? { attendees: crowded.event.attendeeCount, date: crowded.local.date }
      : null,
    longestBackToBack: longestBackToBack(meetings),
    fridayAfternoonMeetings: friday,
    teamsCallShare: n > 0 ? teams / n : null,
    recurringShare: n > 0 ? recurring / n : null,
    hours,
    weekdays,
    meetingsPerCommit: commits !== null && commits > 0 ? round2(n / commits) : null,
  };
}
