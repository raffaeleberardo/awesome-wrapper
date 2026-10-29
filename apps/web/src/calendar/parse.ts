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

/**
 * Decodifica i byte del file. Outlook e altri programmi salvano in UTF-8 (con o senza BOM), in
 * UTF-16 (con o senza BOM) o in Windows-1252: `File.text()` assumerebbe sempre UTF-8.
 */
export function decodeIcs(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  // UTF-16 senza BOM: il testo ASCII ha un byte zero ogni due.
  const sample = bytes.subarray(0, 512);
  let evenZeros = 0;
  let oddZeros = 0;
  sample.forEach((b, i) => {
    if (b === 0) {
      if (i % 2) oddZeros++;
      else evenZeros++;
    }
  });
  if (oddZeros > sample.length / 4) return new TextDecoder('utf-16le').decode(bytes);
  if (evenZeros > sample.length / 4) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Nome di proprietà iCalendar seguito da parametri o valore (`DTSTART;`, `SUMMARY:`). */
const PROPERTY_LINE = /^[A-Za-z0-9-]+[;:]/;

/**
 * Se una virgoletta nei parametri non è chiusa (`CN="Rossi, Mario;ROLE=...:mailto:...`), ical.js
 * non trova il `:` del valore: si tolgono le virgolette prima del primo `:`.
 */
function fixUnbalancedQuotes(line: string): string {
  let quoted = false;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) return line;
  }
  const colon = line.indexOf(':');
  return colon < 0 ? line : line.slice(0, colon).replaceAll('"', '') + line.slice(colon);
}

/**
 * Rende digeribili gli export reali prima di ical.js: BOM, a capo `CR`/`LF`/`CRLF`, spazi in
 * fondo alle righe, righe vuote, testo andato a capo senza piegatura (riga senza `NOME:`, unita
 * alla precedente) e virgolette non chiuse nei parametri.
 */
export function normalizeIcs(text: string): string {
  const out: string[] = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)) {
    const last = out.length - 1;
    if (/^[ \t]/.test(raw)) {
      // piegatura corretta: continua la riga precedente
      if (last >= 0) out[last] += raw.slice(1).replace(/\s+$/, '');
      continue;
    }
    const line = raw.replace(/\s+$/, '');
    if (!line) continue;
    if (!PROPERTY_LINE.test(line) && last >= 0) {
      out[last] += `\\n${line}`;
      continue;
    }
    out.push(line);
  }
  return out.map(fixUnbalancedQuotes).join('\r\n');
}

/** jCal: `[nome, proprietà, sottocomponenti]`. */
type JCal = [string, unknown[], unknown[]];

/**
 * Unisce i sottocomponenti di più VCALENDAR in un unico calendario, lavorando sul jCal:
 * `addSubcomponent` di ical.js toglie il componente dal genitore e sfaserebbe l'iterazione.
 */
function mergeCalendars(calendars: JCal[]): Comp {
  return new ICAL.Component([
    'vcalendar',
    calendars[0]?.[1] ?? [],
    calendars.flatMap((c) => c[2]),
  ] as never);
}

/** Tutti i componenti di primo livello di uno o più VCALENDAR, uniti in un unico calendario. */
function parseRoot(text: string): Comp {
  const jcal = ICAL.parse(text) as unknown[];
  return mergeCalendars((Array.isArray(jcal[0]) ? jcal : [jcal]) as JCal[]);
}

/**
 * Piano B se il file intero non si legge: ogni VEVENT e VTIMEZONE viene letto da solo e quelli
 * illeggibili si saltano, così un evento rotto non fa scartare tutto il calendario.
 */
function parseLeniently(text: string): Comp {
  const parsed: JCal[] = [];
  const lines = text.split('\r\n');
  let block: string[] | null = null;
  let kind = '';
  for (const line of lines) {
    const begin = /^BEGIN:(VEVENT|VTIMEZONE)$/i.exec(line);
    if (!block && begin) {
      block = [line];
      kind = begin[1]!.toUpperCase();
      continue;
    }
    if (!block) continue;
    block.push(line);
    if (line.toUpperCase() === `END:${kind}`) {
      try {
        parsed.push(
          ICAL.parse(`BEGIN:VCALENDAR\r\n${block.join('\r\n')}\r\nEND:VCALENDAR`) as JCal,
        );
      } catch {
        // blocco illeggibile: si salta
      }
      block = null;
    }
  }
  return mergeCalendars(parsed);
}

export function parseIcs(input: string, year: number, options: ParseOptions = {}): CalendarEvent[] {
  const fallbackTz = options.timezone ?? 'Europe/Rome';
  if (input.length > MAX_FILE_BYTES) {
    throw new CalendarParseError('too_large', 'Il file supera la dimensione massima consentita.');
  }
  if (!/BEGIN:VCALENDAR/i.test(input)) {
    throw new CalendarParseError('invalid', 'Il file non sembra un calendario .ics valido.');
  }

  const text = normalizeIcs(input);
  let root: Comp;
  try {
    root = parseRoot(text);
  } catch {
    root = parseLeniently(text);
    // Nemmeno un evento leggibile: non è un calendario utilizzabile.
    if (root.getAllSubcomponents('vevent').length === 0) {
      throw new CalendarParseError('invalid', 'Il file non sembra un calendario .ics valido.');
    }
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

  /** Un evento rotto (es. data vuota) si salta; i limiti di dimensione restano errori. */
  const safely = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      if (err instanceof CalendarParseError) throw err;
    }
  };

  groups.forEach((g, i) => {
    options.onProgress?.(i / Math.max(1, groups.length));
    safely(() => expand(g));
  });

  options.onProgress?.(1);
  return out;

  function expand(g: { master: Comp | null; overrides: Comp[] }) {
    const { master, overrides } = g;
    if (!master) {
      for (const o of overrides) safely(() => pushSingle(o, true));
      return;
    }
    if (!master.hasProperty('dtstart')) return;
    if (!master.hasProperty('rrule') && !master.hasProperty('rdate')) {
      pushSingle(master, false);
      for (const o of overrides) safely(() => pushSingle(o, false));
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
  }
}
