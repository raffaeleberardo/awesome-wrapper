import ICAL from 'ical.js';
import type { CalendarEvent } from '@git-wrapped/contracts';
import { MAX_FILE_BYTES } from './protocol';
import { resolveTimeZone, wallClockToUtc } from './timezones';

/**
 * Parsing puro di un file .ics in `CalendarEvent[]` (nessun accesso a rete, DOM o worker,
 * testabile in node/jsdom). Usato da `parser.worker.ts`.
 *
 * PRIVACY: oggetto, descrizione, luogo, nomi ed email dei partecipanti sono letti solo per
 * riconoscere le call Teams, contare i partecipanti e stabilire se l'invito è rifiutato.
 * Nell'output non resta alcun testo.
 *
 * Euristica per "rifiutato" (`declined`):
 * 1. `STATUS:CANCELLED` -> declined (evento annullato).
 * 2. L'utente non è dichiarato nel file, quindi si deduce: è l'indirizzo (ATTENDEE/ORGANIZER)
 *    che compare nel maggior numero di eventi, a condizione che sia presente in almeno 2 eventi
 *    e che sia strettamente più frequente del secondo (un export personale lo contiene in quasi
 *    tutti gli eventi). Se è noto, l'evento è declined quando il suo ATTENDEE ha PARTSTAT=DECLINED.
 * 3. Se l'utente non si può dedurre (pareggio, file con pochi eventi): l'evento è declined se
 *    `X-MICROSOFT-CDO-BUSYSTATUS:FREE` e almeno un ATTENDEE ha PARTSTAT=DECLINED
 *    (Outlook marca "libero" gli inviti rifiutati rimasti nel calendario).
 */

export { MAX_FILE_BYTES };
export const MAX_OCCURRENCES = 20_000;
/** Tetto di iterazioni per singola regola di ricorrenza (protegge da RRULE patologiche). */
export const MAX_ITERATIONS_PER_RULE = 50_000;

export type CalendarParseErrorCode = 'too_large' | 'invalid' | 'too_many';

export class CalendarParseError extends Error {
  readonly code: CalendarParseErrorCode;
  constructor(code: CalendarParseErrorCode, message: string) {
    super(message);
    this.name = 'CalendarParseError';
    this.code = code;
  }
}

export interface ParseOptions {
  /** Fuso IANA per orari fluttuanti o con TZID sconosciuto. Default `Europe/Rome`. */
  timezone?: string;
  /** Progresso 0..1. */
  onProgress?: (fraction: number) => void;
}

const TEAMS_RE = /teams\.microsoft\.com/i;
const DAY_MS = 86_400_000;
const TEAMS_PROPS = [
  'description',
  'location',
  'x-alt-desc',
  'x-microsoft-skypeteamsmeetingurl',
  'x-microsoft-onlinemeetingconflink',
];

type Comp = InstanceType<typeof ICAL.Component>;
type Time = InstanceType<typeof ICAL.Time>;

const emailOf = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, '');

function tzidOf(comp: Comp, prop: string): string | null {
  const p = comp.getFirstProperty(prop);
  const v = p?.getParameter('tzid');
  return typeof v === 'string' ? v : null;
}

function toMs(t: Time, tzid: string | null, fallbackTz: string): number {
  if (t.isDate) return Date.UTC(t.year, t.month - 1, t.day);
  if (t.zone && t.zone.tzid === 'floating') {
    return wallClockToUtc(
      t.year,
      t.month,
      t.day,
      t.hour,
      t.minute,
      t.second,
      resolveTimeZone(tzid, fallbackTz),
    );
  }
  return t.toUnixTime() * 1000;
}

function isTeams(comp: Comp): boolean {
  for (const name of TEAMS_PROPS) {
    for (const p of comp.getAllProperties(name)) {
      if (TEAMS_RE.test(String(p.getFirstValue() ?? ''))) return true;
    }
  }
  return false;
}

interface People {
  count: number;
  emails: string[];
  anyDeclined: boolean;
  declinedEmails: Set<string>;
}

function peopleOf(comp: Comp): People {
  const emails = new Set<string>();
  const declinedEmails = new Set<string>();
  for (const a of comp.getAllProperties('attendee')) {
    const e = emailOf(a.getFirstValue());
    if (!e) continue;
    emails.add(e);
    if (String(a.getParameter('partstat') ?? '').toUpperCase() === 'DECLINED') {
      declinedEmails.add(e);
    }
  }
  const org = comp.getFirstProperty('organizer');
  if (org) {
    const e = emailOf(org.getFirstValue());
    if (e) emails.add(e);
  }
  return {
    count: emails.size,
    emails: [...emails],
    anyDeclined: declinedEmails.size > 0,
    declinedEmails,
  };
}

/** Deduce l'indirizzo dell'utente: il più frequente fra gli eventi (vedi euristica in testa). */
function inferSelf(masters: Comp[]): string | null {
  const freq = new Map<string, number>();
  for (const c of masters) {
    for (const e of peopleOf(c).emails) freq.set(e, (freq.get(e) ?? 0) + 1);
  }
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] < 2) return null;
  if (ranked[1] && ranked[1][1] === top[1]) return null;
  return top[0];
}

function isDeclined(comp: Comp, self: string | null): boolean {
  if (String(comp.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') {
    return true;
  }
  const people = peopleOf(comp);
  if (self) return people.declinedEmails.has(self);
  const busy = String(comp.getFirstPropertyValue('x-microsoft-cdo-busystatus') ?? '');
  return busy.toUpperCase() === 'FREE' && people.anyDeclined;
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function parseIcs(text: string, year: number, options: ParseOptions = {}): CalendarEvent[] {
  const fallbackTz = options.timezone ?? 'Europe/Rome';
  if (text.length > MAX_FILE_BYTES) {
    throw new CalendarParseError('too_large', 'Il file supera la dimensione massima consentita.');
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new CalendarParseError('invalid', 'Il file non sembra un calendario .ics valido.');
  }

  let root: Comp;
  try {
    const jcal = ICAL.parse(text);
    root = new ICAL.Component(Array.isArray(jcal[0]) ? (jcal[0] as never) : (jcal as never));
  } catch {
    throw new CalendarParseError('invalid', 'Il file non sembra un calendario .ics valido.');
  }

  ICAL.TimezoneService.reset();
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(vtz);
    } catch {
      // VTIMEZONE malformato: si ricade sulla mappa Windows -> IANA.
    }
  }

  const windowStart = Date.UTC(year, 0, 1) - 2 * DAY_MS;
  const windowEnd = Date.UTC(year + 1, 0, 1) + 2 * DAY_MS;

  const vevents = root.getAllSubcomponents('vevent');
  const byUid = new Map<string, { master: Comp | null; overrides: Comp[] }>();
  let anon = 0;
  for (const c of vevents) {
    const uid = String(c.getFirstPropertyValue('uid') ?? `__anon${anon++}`);
    let g = byUid.get(uid);
    if (!g) {
      g = { master: null, overrides: [] };
      byUid.set(uid, g);
    }
    if (c.hasProperty('recurrence-id')) g.overrides.push(c);
    else g.master ??= c;
  }

  const masters = [...byUid.values()].flatMap((g) => (g.master ? [g.master] : []));
  const self = inferSelf(masters);
  const out: CalendarEvent[] = [];
  const groups = [...byUid.values()];

  const push = (
    comp: Comp,
    startMs: number,
    endMs: number,
    isAllDay: boolean,
    recurring: boolean,
  ) => {
    if (startMs > windowEnd || endMs < windowStart) return;
    if (out.length >= MAX_OCCURRENCES) {
      throw new CalendarParseError(
        'too_many',
        `Il calendario contiene troppe riunioni (oltre ${MAX_OCCURRENCES}) per essere elaborato.`,
      );
    }
    out.push({
      start: isoFromMs(startMs),
      end: isoFromMs(Math.max(startMs, endMs)),
      isAllDay,
      attendeeCount: peopleOf(comp).count,
      isTeamsCall: isTeams(comp),
      isRecurring: recurring,
      declined: isDeclined(comp, self),
    });
  };

  /** Evento singolo (o override) con le proprie date. */
  const pushSingle = (comp: Comp, recurring: boolean) => {
    if (!comp.hasProperty('dtstart')) return;
    const ev = new ICAL.Event(comp);
    const allDay = ev.startDate.isDate;
    const startTz = tzidOf(comp, 'dtstart');
    const startMs = toMs(ev.startDate, startTz, fallbackTz);
    const endMs =
      comp.hasProperty('dtend') || comp.hasProperty('duration')
        ? toMs(ev.endDate, tzidOf(comp, 'dtend') ?? startTz, fallbackTz)
        : startMs + (allDay ? DAY_MS : 0);
    push(comp, startMs, endMs, allDay, recurring);
  };

  groups.forEach((g, i) => {
    options.onProgress?.(i / Math.max(1, groups.length));
    const { master, overrides } = g;
    if (!master) {
      for (const o of overrides) pushSingle(o, true);
      return;
    }
    if (!master.hasProperty('dtstart')) return;
    if (!master.hasProperty('rrule') && !master.hasProperty('rdate')) {
      pushSingle(master, false);
      for (const o of overrides) pushSingle(o, false);
      return;
    }

    const ev = new ICAL.Event(master);
    for (const o of overrides) ev.relateException(o);
    const startTz = tzidOf(master, 'dtstart');
    const seen = new Set<string>();
    const iter = ev.iterator();
    let iterations = 0;
    for (;;) {
      const next = iter.next();
      if (!next) break;
      if (++iterations > MAX_ITERATIONS_PER_RULE) {
        throw new CalendarParseError(
          'too_many',
          'Una regola di ricorrenza genera troppe occorrenze per essere elaborata.',
        );
      }
      seen.add(next.toString());
      if (toMs(next, startTz, fallbackTz) > windowEnd) break;
      const d = ev.getOccurrenceDetails(next);
      const comp = d.item.component;
      const isOverride = d.item !== ev;
      const sTz = isOverride ? tzidOf(comp, 'dtstart') : startTz;
      const eTz = isOverride ? (tzidOf(comp, 'dtend') ?? sTz) : startTz;
      const allDay = d.startDate.isDate;
      push(
        comp,
        toMs(d.startDate, sTz, fallbackTz),
        toMs(d.endDate, eTz, fallbackTz),
        allDay,
        true,
      );
    }
    // Override spostati fuori dalla finestra iterata (la loro occorrenza originale è dopo l'anno).
    for (const o of overrides) {
      const rid = o.getFirstPropertyValue('recurrence-id');
      if (rid && !seen.has(String(rid))) pushSingle(o, true);
    }
  });

  options.onProgress?.(1);
  return out;
}
