import { calendarStatsSchema, type CalendarEvent } from '@git-wrapped/contracts';
import { describe, expect, it } from 'vitest';
import { computeCalendarStats } from './index';

const ev = (start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  start,
  end,
  isAllDay: false,
  attendeeCount: 2,
  isTeamsCall: false,
  isRecurring: false,
  declined: false,
  ...extra,
});

describe('computeCalendarStats', () => {
  it('senza eventi restituisce zeri e null', () => {
    const s = computeCalendarStats([], 2026);
    expect(calendarStatsSchema.parse(s)).toEqual(s);
    expect(s.meetings).toBe(0);
    expect(s.longestMeeting).toBeNull();
    expect(s.mostCrowded).toBeNull();
    expect(s.longestBackToBack).toBeNull();
    expect(s.teamsCallShare).toBeNull();
    expect(s.recurringShare).toBeNull();
    expect(s.meetingsPerCommit).toBeNull();
  });

  it('esclude tutto-il-giorno, rifiutati e altri anni; conta i rifiutati', () => {
    const s = computeCalendarStats(
      [
        ev('2026-03-10T09:00:00+01:00', '2026-03-10T10:00:00+01:00'),
        ev('2026-03-10T00:00:00Z', '2026-03-11T00:00:00Z', { isAllDay: true }),
        ev('2026-03-11T09:00:00+01:00', '2026-03-11T10:00:00+01:00', { declined: true }),
        ev('2025-03-11T09:00:00+01:00', '2025-03-11T10:00:00+01:00'),
        ev('garbage', 'garbage'),
      ],
      2026,
    );
    expect(s.meetings).toBe(1);
    expect(s.declinedInvites).toBe(1);
    expect(s.meetingHours).toBe(1);
  });

  it('usa il fuso per anno, ora e giorno', () => {
    // 2026-12-31T23:30Z = 2027-01-01 00:30 a Roma
    const e = ev('2026-12-31T23:30:00Z', '2027-01-01T00:00:00Z');
    expect(computeCalendarStats([e], 2026, { timezone: 'UTC' }).meetings).toBe(1);
    expect(computeCalendarStats([e], 2026).meetings).toBe(0);
    const s = computeCalendarStats([e], 2027);
    expect(s.hours[0]).toBe(1);
    expect(s.weekdays[4]).toBe(1); // 2027-01-01 è venerdì
  });

  it('riunione più lunga e più affollata (pareggi: la prima)', () => {
    const s = computeCalendarStats(
      [
        ev('2026-02-02T10:00:00Z', '2026-02-02T11:30:00Z', { attendeeCount: 5 }),
        ev('2026-02-03T10:00:00Z', '2026-02-03T11:30:00Z', { attendeeCount: 9 }),
        ev('2026-02-04T10:00:00Z', '2026-02-04T10:15:00Z', { attendeeCount: 0 }),
      ],
      2026,
      { timezone: 'UTC' },
    );
    expect(s.longestMeeting).toEqual({ minutes: 90, date: '2026-02-02' });
    expect(s.mostCrowded).toEqual({ attendees: 9, date: '2026-02-03' });
  });

  it('mostCrowded è null se nessun partecipante è noto', () => {
    const s = computeCalendarStats(
      [ev('2026-02-02T10:00:00Z', '2026-02-02T11:00:00Z', { attendeeCount: 0 })],
      2026,
    );
    expect(s.mostCrowded).toBeNull();
  });

  it('serie back-to-back con pausa <= 5 minuti', () => {
    const s = computeCalendarStats(
      [
        ev('2026-05-04T09:00:00Z', '2026-05-04T10:00:00Z'),
        ev('2026-05-04T10:05:00Z', '2026-05-04T11:00:00Z'), // pausa 5: continua
        ev('2026-05-04T10:30:00Z', '2026-05-04T11:30:00Z'), // sovrapposta: continua
        ev('2026-05-04T11:36:00Z', '2026-05-04T12:00:00Z'), // pausa 6: interrompe
        ev('2026-05-05T09:00:00Z', '2026-05-05T10:00:00Z'),
        ev('2026-05-05T10:00:00Z', '2026-05-05T10:30:00Z'),
      ],
      2026,
      { timezone: 'UTC' },
    );
    expect(s.longestBackToBack).toEqual({ meetings: 3, date: '2026-05-04' });
  });

  it('non unisce serie su giorni diversi e ignora riunioni isolate', () => {
    const s = computeCalendarStats(
      [
        ev('2026-05-04T23:00:00Z', '2026-05-04T23:59:00Z'),
        ev('2026-05-05T00:00:00Z', '2026-05-05T01:00:00Z'),
      ],
      2026,
      { timezone: 'UTC' },
    );
    expect(s.longestBackToBack).toBeNull();
  });

  it('venerdì pomeriggio, Teams, ricorrenti, istogrammi', () => {
    const s = computeCalendarStats(
      [
        ev('2026-03-06T14:00:00+01:00', '2026-03-06T15:00:00+01:00', { isTeamsCall: true }), // ven
        ev('2026-03-06T13:59:00+01:00', '2026-03-06T14:30:00+01:00', { isRecurring: true }),
        ev('2026-03-09T09:00:00+01:00', '2026-03-09T09:30:00+01:00', {
          isTeamsCall: true,
          isRecurring: true,
        }),
        ev('2026-03-08T09:00:00+01:00', '2026-03-08T09:30:00+01:00'), // domenica
      ],
      2026,
    );
    expect(s.fridayAfternoonMeetings).toBe(1);
    expect(s.teamsCallShare).toBe(0.5);
    expect(s.recurringShare).toBe(0.5);
    expect(s.hours[14]).toBe(1);
    expect(s.hours[9]).toBe(2);
    expect(s.weekdays).toEqual([1, 0, 0, 0, 2, 0, 1]);
  });

  it('riunioni per commit', () => {
    const events = [
      ev('2026-03-09T09:00:00Z', '2026-03-09T09:30:00Z'),
      ev('2026-03-10T09:00:00Z', '2026-03-10T09:30:00Z'),
      ev('2026-03-11T09:00:00Z', '2026-03-11T09:30:00Z'),
    ];
    expect(computeCalendarStats(events, 2026, { commits: 4 }).meetingsPerCommit).toBe(0.75);
    expect(computeCalendarStats(events, 2026, { commits: 0 }).meetingsPerCommit).toBeNull();
    expect(computeCalendarStats(events, 2026, { commits: null }).meetingsPerCommit).toBeNull();
  });

  it('durata negativa è trattata come zero', () => {
    const s = computeCalendarStats([ev('2026-03-09T10:00:00Z', '2026-03-09T09:00:00Z')], 2026);
    expect(s.meetingHours).toBe(0);
  });
});
