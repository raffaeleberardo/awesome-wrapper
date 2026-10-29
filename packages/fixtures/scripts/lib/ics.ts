/**
 * File .ics di esempio in stile export Outlook (Windows, fuso "W. Europe Standard Time").
 * Nomi ed email sono inventati (`@example.com`). Testo fisso: nessun dato casuale.
 * RFC 5545: righe terminate da CRLF, righe piegate a 75 ottetti.
 */

const CRLF = '\r\n';
const TZ = 'W. Europe Standard Time';
const OWNER = { name: 'Utente Demo', email: 'utente.demo@example.com' };

const TEAMS_BASE = 'https://teams.microsoft.com/l/meetup-join';

/** Persone che compaiono come partecipanti (nomi e email inventati). */
const PEOPLE: { name: string; email: string }[] = [
  ['Giulia', 'Ferri'],
  ['Marco', 'Vitale'],
  ['Chiara', 'Esposito'],
  ['Luca', 'Moretti'],
  ['Sara', 'Bianchi'],
  ['Davide', 'Rinaldi'],
  ['Elena', 'Costa'],
  ['Andrea', 'Galli'],
  ['Federica', 'Greco'],
  ['Matteo', 'Conti'],
  ['Valentina', 'Marino'],
  ['Paolo', 'Lombardi'],
  ['Silvia', 'Ricci'],
  ['Nicola', 'Serra'],
  ['Anna', 'De Luca'],
  ['Simone', 'Fontana'],
  ['Laura', 'Villa'],
  ['Roberto', 'Monti'],
  ['Irene', 'Barbieri'],
  ['Stefano', 'Gatti'],
  ['Carla', 'Pellegrini'],
  ['Tommaso', 'Sanna'],
  ['Alice', 'Parisi'],
  ['Gianluca', 'Russo'],
  ['Ilaria', 'Bruno'],
  ['Emanuele', 'Ferrara'],
  ['Beatrice', 'Lamberti'],
  ['Pietro', 'Caruso'],
].map(([first, last]) => ({
  name: `${first} ${last}`,
  email: `${(first ?? '').toLowerCase()}.${(last ?? '').toLowerCase().replace(' ', '')}@example.com`,
}));

const TEAM_SLICE = PEOPLE.slice(0, 8);

const teamsUrl = (id: string): string =>
  `${TEAMS_BASE}/19%3ameeting_${id}%40thread.v2/0?context=%7b%22Tid%22%3a%22c0ffee00-0000-4000-8000-000000000001%22%7d`;

/** Piega una riga a 75 ottetti, con continuazione che inizia da uno spazio. */
function fold(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.map((piece, index) => (index === 0 ? piece : ` ${piece}`));
}

/** Escape di testo secondo RFC 5545 (virgole, punti e virgola, a capo). */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

interface Attendee {
  name: string;
  email: string;
  status?: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
}

interface EventSpec {
  uid: string;
  summary: string;
  /** Riga completa, es. `DTSTART;TZID="W. Europe Standard Time":20260105T091500`. */
  start: string;
  end: string;
  rrule?: string;
  exdate?: string;
  organizer?: { name: string; email: string };
  attendees?: Attendee[];
  location?: string;
  teamsId?: string;
  description?: string;
  cancelled?: boolean;
  busy?: 'BUSY' | 'FREE';
}

function eventLines(spec: EventSpec): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${spec.uid}`,
    'DTSTAMP:20251201T090000Z',
    spec.start,
    spec.end,
    `SUMMARY:${escapeText(spec.summary)}`,
  ];
  if (spec.rrule) lines.push(`RRULE:${spec.rrule}`);
  if (spec.exdate) lines.push(spec.exdate);
  if (spec.location) lines.push(`LOCATION:${escapeText(spec.location)}`);
  if (spec.organizer) {
    lines.push(`ORGANIZER;CN=${spec.organizer.name}:mailto:${spec.organizer.email}`);
  }
  for (const a of spec.attendees ?? []) {
    lines.push(
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=${a.status ?? 'NEEDS-ACTION'};RSVP=TRUE;CN=${a.name}:mailto:${a.email}`,
    );
  }
  const description: string[] = [];
  if (spec.description) description.push(spec.description);
  if (spec.teamsId) {
    const url = teamsUrl(spec.teamsId);
    description.push(
      '________________________________________________________________________________',
      'Partecipa a Microsoft Teams',
      url,
      'ID riunione: 412 857 309 614',
    );
    lines.push(`X-MICROSOFT-SKYPETEAMSMEETINGURL:${url}`);
  }
  if (description.length > 0) lines.push(`DESCRIPTION:${escapeText(description.join('\n'))}`);
  lines.push(`X-MICROSOFT-CDO-BUSYSTATUS:${spec.busy ?? 'BUSY'}`, 'SEQUENCE:0');
  lines.push(`STATUS:${spec.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
  if (spec.cancelled) lines.push('CANCEL:TRUE');
  lines.push('TRANSP:OPAQUE', 'END:VEVENT');
  return lines;
}

const TEAM_ATTENDEES = (statusOf?: (email: string) => Attendee['status']): Attendee[] =>
  TEAM_SLICE.map((p) => ({
    name: p.name,
    email: p.email,
    status: statusOf?.(p.email) ?? 'ACCEPTED',
  }));

const OWNER_DECLINED: Attendee = { name: OWNER.name, email: OWNER.email, status: 'DECLINED' };
const OWNER_ACCEPTED: Attendee = { name: OWNER.name, email: OWNER.email, status: 'ACCEPTED' };
const ORGANIZER_TEAM = {
  name: TEAM_SLICE[0]?.name ?? 'Giulia Ferri',
  email: TEAM_SLICE[0]?.email ?? '',
};

function crowd(count: number): Attendee[] {
  return PEOPLE.slice(0, count).map((p) => ({ name: p.name, email: p.email }));
}

const EVENTS: EventSpec[] = [
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E8F',
    summary: 'Standup Piattaforma',
    start: `DTSTART;TZID="${TZ}":20260105T091500`,
    end: `DTEND;TZID="${TZ}":20260105T093000`,
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261218T080000Z',
    exdate: `EXDATE;TZID="${TZ}":20260406T091500,20260501T091500`,
    organizer: ORGANIZER_TEAM,
    attendees: [...TEAM_ATTENDEES(), OWNER_ACCEPTED],
    teamsId: '7f3c1a9e-2b44-4d8a-9c10-0a1b2c3d4e51',
    location: 'Microsoft Teams',
    description: 'Aggiornamenti rapidi: cosa è stato fatto, cosa si fa oggi, cosa blocca.',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E90',
    summary: 'Sync team Piattaforma',
    start: `DTSTART;TZID="${TZ}":20260105T100000`,
    end: `DTEND;TZID="${TZ}":20260105T110000`,
    rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261221T080000Z',
    exdate: `EXDATE;TZID="${TZ}":20260406T100000`,
    organizer: ORGANIZER_TEAM,
    attendees: [...crowd(12).map((a) => ({ ...a, status: 'ACCEPTED' as const })), OWNER_DECLINED],
    teamsId: '3a9d5c2e-61f0-4b7e-8d24-1c2b3a4d5e62',
    description:
      'Priorità della settimana, rischi e decisioni aperte. Chi non può esserci lasci una nota.',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E91',
    summary: 'Planning cliente Alfa',
    start: `DTSTART;TZID="${TZ}":20260106T090000`,
    end: `DTEND;TZID="${TZ}":20260106T100000`,
    rrule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T080000Z',
    organizer: { name: OWNER.name, email: OWNER.email },
    attendees: [...crowd(4).map((a) => ({ ...a, status: 'ACCEPTED' as const })), OWNER_ACCEPTED],
    location: 'Sala Riunioni 2',
    description: 'Backlog della prossima release per il cliente Alfa.',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E92',
    summary: 'Review architettura',
    start: `DTSTART;TZID="${TZ}":20260106T100000`,
    end: `DTEND;TZID="${TZ}":20260106T103000`,
    rrule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T080000Z',
    organizer: ORGANIZER_TEAM,
    attendees: crowd(5).map((a) => ({ ...a, status: 'ACCEPTED' as const })),
    teamsId: '5d1e7b8a-0c3f-4e62-a719-2d3e4f5a6b73',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E93',
    summary: '1:1 con Luca',
    start: `DTSTART;TZID="${TZ}":20260106T103000`,
    end: `DTEND;TZID="${TZ}":20260106T110000`,
    rrule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T080000Z',
    organizer: { name: OWNER.name, email: OWNER.email },
    attendees: [{ name: 'Luca Moretti', email: 'luca.moretti@example.com', status: 'ACCEPTED' }],
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E94',
    summary: 'Retro sprint',
    start: `DTSTART;TZID="${TZ}":20260109T160000`,
    end: `DTEND;TZID="${TZ}":20260109T170000`,
    rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;UNTIL=20261218T080000Z',
    organizer: ORGANIZER_TEAM,
    attendees: [...crowd(9).map((a) => ({ ...a, status: 'ACCEPTED' as const })), OWNER_DECLINED],
    teamsId: '9c4b2d1e-7a6f-4c3b-b2a1-3e4d5c6b7a84',
    description: 'Cosa ha funzionato, cosa no, cosa proviamo nello sprint successivo.',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E95',
    summary: 'Call cliente Beta',
    start: `DTSTART;TZID="${TZ}":20260216T150000`,
    end: `DTEND;TZID="${TZ}":20260216T160000`,
    organizer: { name: 'Roberto Monti', email: 'roberto.monti@example.com' },
    attendees: [
      { name: 'Roberto Monti', email: 'roberto.monti@example.com', status: 'ACCEPTED' },
      OWNER_DECLINED,
    ],
    teamsId: '1e2f3a4b-5c6d-4e7f-8091-a2b3c4d5e6f5',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E96',
    summary: 'Webinar fornitore cloud',
    start: `DTSTART;TZID="${TZ}":20260325T110000`,
    end: `DTEND;TZID="${TZ}":20260325T120000`,
    organizer: { name: 'Marketing Esterno', email: 'eventi@example.com' },
    attendees: [OWNER_DECLINED],
    busy: 'FREE',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E97',
    summary: 'Sync con Marketing',
    start: `DTSTART;TZID="${TZ}":20260714T150000`,
    end: `DTEND;TZID="${TZ}":20260714T153000`,
    organizer: { name: 'Silvia Ricci', email: 'silvia.ricci@example.com' },
    attendees: [
      { name: 'Silvia Ricci', email: 'silvia.ricci@example.com', status: 'ACCEPTED' },
      OWNER_DECLINED,
    ],
    teamsId: '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b86',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E98',
    summary: 'Demo mensile (annullata)',
    start: `DTSTART;TZID="${TZ}":20260529T150000`,
    end: `DTEND;TZID="${TZ}":20260529T160000`,
    organizer: ORGANIZER_TEAM,
    attendees: crowd(6),
    cancelled: true,
    location: 'Sala Verde',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E99',
    summary: 'Ferie',
    start: 'DTSTART;VALUE=DATE:20260803',
    end: 'DTEND;VALUE=DATE:20260808',
    organizer: { name: OWNER.name, email: OWNER.email },
    busy: 'FREE',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E9A',
    summary: 'Chiusura ufficio: ponte',
    start: 'DTSTART;VALUE=DATE:20261208',
    end: 'DTEND;VALUE=DATE:20261209',
    busy: 'FREE',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E9B',
    summary: 'Kickoff Q4 Piattaforma',
    start: `DTSTART;TZID="${TZ}":20261013T090000`,
    end: `DTEND;TZID="${TZ}":20261013T103000`,
    organizer: ORGANIZER_TEAM,
    attendees: [...crowd(14).map((a) => ({ ...a, status: 'TENTATIVE' as const })), OWNER_ACCEPTED],
    teamsId: '6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e97',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E9C',
    summary: 'All hands trimestrale',
    start: `DTSTART;TZID="${TZ}":20261002T140000`,
    end: `DTEND;TZID="${TZ}":20261002T170000`,
    organizer: { name: 'Anna De Luca', email: 'anna.deluca@example.com' },
    attendees: crowd(28).map((a) => ({ ...a, status: 'ACCEPTED' as const })),
    teamsId: '4c5d6e7f-8091-4a2b-8c3d-4e5f6a7b8c9d',
    description:
      'Aggiornamenti dei team, premi e domande dalla sala. Registrazione disponibile per chi è in ferie.',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E9D',
    summary: 'Dogfooding',
    start: `DTSTART;TZID="${TZ}":20260911T143000`,
    end: `DTEND;TZID="${TZ}":20260911T153000`,
    organizer: ORGANIZER_TEAM,
    attendees: crowd(8).map((a) => ({ ...a, status: 'ACCEPTED' as const })),
    teamsId: '8a9b0c1d-2e3f-4a5b-9c6d-7e8f9a0b1c2d',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E9E',
    summary: 'Bugbash',
    start: `DTSTART;TZID="${TZ}":20260911T153000`,
    end: `DTEND;TZID="${TZ}":20260911T163000`,
    organizer: ORGANIZER_TEAM,
    attendees: crowd(8).map((a) => ({ ...a, status: 'ACCEPTED' as const })),
    teamsId: '0d1e2f3a-4b5c-4d6e-8f70-819a2b3c4d5e',
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7E9F',
    summary: 'Retro breve di venerdì',
    start: `DTSTART;TZID="${TZ}":20260911T163000`,
    end: `DTEND;TZID="${TZ}":20260911T170000`,
    organizer: ORGANIZER_TEAM,
    attendees: crowd(8).map((a) => ({ ...a, status: 'ACCEPTED' as const })),
  },
  {
    uid: '040000008200E00074C5B7101A82E0080000000010A1B2C3D4E5F60718293A4B5C6D7EA0',
    summary: 'Pranzo di team',
    start: `DTSTART;TZID="${TZ}":20261211T123000`,
    end: `DTEND;TZID="${TZ}":20261211T140000`,
    organizer: { name: 'Anna De Luca', email: 'anna.deluca@example.com' },
    attendees: crowd(10).map((a) => ({ ...a, status: 'ACCEPTED' as const })),
    location: 'Trattoria Sala Verde',
    busy: 'FREE',
  },
];

/** Contenuto del file .ics di esempio, con CRLF come da RFC 5545. */
export function buildSampleIcs(): string {
  const header = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
    'VERSION:2.0',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Calendario di Utente Demo',
    `X-WR-TIMEZONE:${TZ}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TZ}`,
    'BEGIN:STANDARD',
    'DTSTART:16010101T030000',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:16010101T020000',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ];
  const body = EVENTS.flatMap((event) => eventLines(event));
  const lines = [...header, ...body, 'END:VCALENDAR'];
  return lines.flatMap((line) => fold(line)).join(CRLF) + CRLF;
}
