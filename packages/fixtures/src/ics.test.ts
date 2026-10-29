import { describe, expect, it } from 'vitest';
import { sampleIcs } from './index';

/** Riattacca le righe piegate (RFC 5545 §3.1): i controlli sul contenuto lavorano su righe logiche. */
const unfolded = sampleIcs.replace(/\r\n[ \t]/g, '');

describe('file .ics di esempio', () => {
  it('è un VCALENDAR con PRODID Microsoft e fuso Windows', () => {
    expect(sampleIcs.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(unfolded).toMatch(/^PRODID:-\/\/Microsoft Corporation/m);
    expect(unfolded).toContain('TZID:W. Europe Standard Time');
    expect(sampleIcs.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('contiene una RRULE settimanale con EXDATE', () => {
    expect(unfolded).toMatch(/^RRULE:FREQ=WEEKLY/m);
    expect(unfolded).toMatch(/^EXDATE/m);
  });

  it('contiene un link Teams nella DESCRIPTION e in X-MICROSOFT-SKYPETEAMSMEETINGURL', () => {
    expect(unfolded).toContain('https://teams.microsoft.com/l/meetup-join/');
    expect(unfolded).toMatch(
      /^X-MICROSOFT-SKYPETEAMSMEETINGURL:https:\/\/teams\.microsoft\.com\/l\/meetup-join\//m,
    );
    expect(unfolded).toMatch(/^DESCRIPTION:.*Microsoft Teams/m);
  });

  it('contiene un invito rifiutato per l utente e un evento annullato', () => {
    expect(unfolded).toContain('PARTSTAT=DECLINED');
    expect(unfolded).toContain('STATUS:CANCELLED');
  });

  it('contiene eventi nel 2026, tutto il giorno e riunioni affollate', () => {
    expect(unfolded).toContain('DTSTART;TZID="W. Europe Standard Time":2026');
    expect(unfolded).toContain('DTSTART;VALUE=DATE:2026');
    const attendees = unfolded.match(/^ATTENDEE/gm) ?? [];
    expect(attendees.length).toBeGreaterThan(30);
  });

  it('usa CRLF come da RFC 5545 e nessuna riga supera 75 ottetti', () => {
    expect(/[^\r]\n/.test(sampleIcs)).toBe(false);
    for (const line of sampleIcs.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8'), line).toBeLessThanOrEqual(75);
    }
  });

  it('usa solo indirizzi example.com', () => {
    const emails = unfolded.match(/mailto:[^\r\n]+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) expect(email).toMatch(/@example\.com$/);
  });
});
