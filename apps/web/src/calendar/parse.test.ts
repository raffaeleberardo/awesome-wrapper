import { calendarEventSchema } from '@git-wrapped/contracts';
import { sampleIcs } from '@git-wrapped/fixtures';
import { computeCalendarStats } from '@git-wrapped/stats/calendar';
import { describe, expect, it } from 'vitest';
import { CalendarParseError, MAX_FILE_BYTES, decodeIcs, parseIcs } from './parse';
import {
  allDayIcs,
  declinedFallbackIcs,
  declinedIcs,
  dailyForeverIcs,
  floatingIcs,
  noVtimezoneIcs,
  oldDailyIcs,
  orphanOverrideIcs,
  recurringIcs,
  teamsIcs,
  wrap,
} from './testdata';

const starts = (xs: { start: string }[]) => xs.map((e) => e.start).sort();

describe('parseIcs', () => {
  it('espande RRULE con EXDATE e override, con VTIMEZONE Windows', () => {
    const ev = parseIcs(recurringIcs, 2026);
    // Lunedì 5, (12 escluso), 19 (spostato alle 15), 26 -> 3 occorrenze
    expect(ev).toHaveLength(3);
    for (const e of ev) expect(calendarEventSchema.parse(e)).toEqual(e);
    expect(starts(ev)).toEqual([
      '2026-01-05T09:00:00Z', // 10:00 CET
      '2026-01-19T14:00:00Z', // override 15:00 CET
      '2026-01-26T09:00:00Z',
    ]);
    expect(ev.every((e) => e.isRecurring)).toBe(true);
    expect(ev.every((e) => e.attendeeCount >= 2)).toBe(true);
    expect(ev.find((e) => e.start === '2026-01-05T09:00:00Z')?.end).toBe('2026-01-05T09:30:00Z');
  });

  it('gestisce l ora legale con il VTIMEZONE', () => {
    const ics = recurringIcs.replace('UNTIL=20260131T230000Z', 'UNTIL=20260430T230000Z');
    const ev = parseIcs(ics, 2026);
    expect(ev.some((e) => e.start === '2026-04-06T08:00:00Z')).toBe(true); // 10:00 CEST
  });

  it('senza VTIMEZONE usa la mappa Windows -> IANA', () => {
    const [e] = parseIcs(noVtimezoneIcs, 2026);
    expect(e?.start).toBe('2026-07-15T08:00:00Z'); // CEST
    expect(e?.end).toBe('2026-07-15T09:00:00Z');
  });

  it('riconosce le call Teams da descrizione e proprietà X-', () => {
    const ev = parseIcs(teamsIcs, 2026);
    expect(ev.map((e) => e.isTeamsCall)).toEqual([true, true, false]);
  });

  it('rifiutati: deduce l utente dall indirizzo più frequente; annullati', () => {
    const ev = parseIcs(declinedIcs, 2026);
    expect(ev.map((e) => e.declined)).toEqual([true, false, true]);
  });

  it('rifiutati: fallback BUSYSTATUS:FREE + DECLINED se l utente non è deducibile', () => {
    const ev = parseIcs(declinedFallbackIcs, 2026);
    expect(ev.map((e) => e.declined)).toEqual([true, false]);
  });

  it('eventi tutto il giorno, con e senza DTEND, e filtro per anno', () => {
    const ev = parseIcs(allDayIcs, 2026);
    expect(ev).toHaveLength(2);
    expect(ev.every((e) => e.isAllDay)).toBe(true);
    expect(ev[0]?.start).toBe('2026-05-01T00:00:00Z');
    expect(ev[1]?.end).toBe('2026-06-02T00:00:00Z');
  });

  it('orari fluttuanti usano il fuso indicato, DURATION, eventi senza DTSTART ignorati', () => {
    const ev = parseIcs(floatingIcs, 2026, { timezone: 'Europe/Rome' });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ start: '2026-01-15T08:00:00Z', end: '2026-01-15T08:45:00Z' });
    const utc = parseIcs(floatingIcs, 2026, { timezone: 'UTC' });
    expect(utc[0]?.start).toBe('2026-01-15T09:00:00Z');
  });

  it('limita l espansione all anno richiesto', () => {
    const ev = parseIcs(oldDailyIcs, 2026);
    // dal 2024-01-01, 1000 giorni -> fino al 2026-09-27; 2026: giorni 1 gen..27 set = 269
    const inYear = ev.filter((e) => e.start.startsWith('2026-'));
    expect(inYear).toHaveLength(269);
    expect(ev.length).toBeLessThan(280);
  });

  it('override orfani o spostati nell anno vengono mantenuti', () => {
    const ev = parseIcs(orphanOverrideIcs, 2026);
    expect(starts(ev)).toEqual(['2026-01-09T09:00:00Z', '2026-04-02T09:00:00Z']);
  });

  it('errori chiari: file non valido, troppo grande, troppe occorrenze', () => {
    expect(() => parseIcs('ciao', 2026)).toThrow(CalendarParseError);
    expect(() => parseIcs('BEGIN:VCALENDAR\nFOO', 2026)).toThrow(/valido/);
    expect(() => parseIcs('x'.repeat(MAX_FILE_BYTES + 1), 2026)).toThrow(/dimensione/);
    try {
      parseIcs(dailyForeverIcs, 2026);
      expect.unreachable();
    } catch (e) {
      expect((e as CalendarParseError).code).toBe('too_many');
    }
  });

  it('segnala il progresso', () => {
    const seen: number[] = [];
    parseIcs(teamsIcs, 2026, { onProgress: (f) => seen.push(f) });
    expect(seen.at(-1)).toBe(1);
  });

  it('non lascia testo nell output', () => {
    const json = JSON.stringify(parseIcs(recurringIcs, 2026));
    expect(json).not.toMatch(/Segreto|Spostata|example\.com|teams\.microsoft/i);
  });

  it('calcolo end-to-end sulle stats', () => {
    const stats = computeCalendarStats(parseIcs(teamsIcs, 2026), 2026, { commits: 6 });
    expect(stats.meetings).toBe(3);
    expect(stats.teamsCallShare).toBeCloseTo(2 / 3);
    expect(stats.meetingsPerCommit).toBe(0.5);
  });

  it('accetta più VCALENDAR e file vuoti', () => {
    expect(parseIcs(wrap(''), 2026)).toEqual([]);
  });

  it.skipIf(!sampleIcs)('sampleIcs di A5: produce eventi validi e stats coerenti', () => {
    const events = parseIcs(sampleIcs, 2026);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) calendarEventSchema.parse(e);
    const stats = computeCalendarStats(events, 2026);
    expect(stats.meetings).toBeGreaterThan(0);
    expect(stats.declinedInvites).toBeGreaterThan(0);
    expect(stats.teamsCallShare).toBeGreaterThan(0);
    expect(stats.recurringShare).toBeGreaterThan(0);
  });
});

describe('export reali di Outlook e altri programmi', () => {
  const base = parseIcs(teamsIcs, 2026);
  const addEvent = (body: string) =>
    teamsIcs.replace(/END:VCALENDAR\s*$/, `${body}\r\nEND:VCALENDAR\r\n`);
  const extra = [
    'BEGIN:VEVENT',
    'UID:extra-1',
    'DTSTART:20260310T090000Z',
    'DTEND:20260310T100000Z',
  ];

  it.each([
    ['BOM UTF-8 in testa', `\uFEFF${teamsIcs}`],
    ['a capo solo CR', teamsIcs.replace(/\r?\n/g, '\r')],
    ['a capo solo LF', teamsIcs.replace(/\r\n/g, '\n')],
    ['spazi in fondo alle righe', teamsIcs.replace(/\r?\n/g, ' \r\n')],
    ['righe vuote tra gli eventi', teamsIcs.replace(/\r?\nBEGIN:VEVENT/g, '\r\n\r\nBEGIN:VEVENT')],
  ])('%s: stessi eventi del file pulito', (_name, ics) => {
    expect(parseIcs(ics, 2026)).toEqual(base);
  });

  it.each([
    ['testo andato a capo senza piegatura', [...extra, 'DESCRIPTION:prima riga', 'seconda riga']],
    [
      'virgolette non chiuse in un partecipante',
      [...extra, 'ATTENDEE;CN="Rossi, Mario;ROLE=REQ-PARTICIPANT:mailto:a@example.com'],
    ],
  ])('%s: l evento si legge', (_name, lines) => {
    const ev = parseIcs(addEvent([...lines, 'END:VEVENT'].join('\r\n')), 2026);
    expect(ev).toHaveLength(base.length + 1);
  });

  it('un evento rotto si salta senza scartare il resto del file', () => {
    const ev = parseIcs(addEvent('BEGIN:VEVENT\r\nUID:rotto\r\nDTSTART:\r\nEND:VEVENT'), 2026);
    expect(ev).toEqual(base);
  });

  it('decodifica UTF-8, UTF-16 con e senza BOM e Windows-1252', () => {
    const text = 'BEGIN:VCALENDAR\r\nX-WR-CALNAME:Caffè\r\nEND:VCALENDAR';
    const le = Buffer.from(text, 'utf16le');
    const be = Buffer.from(le).swap16();
    expect(decodeIcs(new Uint8Array(Buffer.from(text, 'utf8')))).toBe(text);
    expect(
      decodeIcs(
        new Uint8Array(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)])),
      ),
    ).toBe(text);
    expect(decodeIcs(new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), le])))).toBe(text);
    expect(decodeIcs(new Uint8Array(Buffer.concat([Buffer.from([0xfe, 0xff]), be])))).toBe(text);
    expect(decodeIcs(new Uint8Array(le))).toBe(text);
    expect(decodeIcs(new Uint8Array(Buffer.from(text, 'latin1')))).toBe(text);
  });
});
