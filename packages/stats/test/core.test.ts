import { describe, expect, it } from 'vitest';
import { BADGE_IDS, PERSONALITY_DIMENSIONS, wrappedStatsSchema } from '@git-wrapped/contracts';
import { exampleRawActivity } from '@git-wrapped/contracts/examples';
import { computeWrappedStats, DEFAULT_TIMEZONE, horoscopeSeed } from '../src/index';
import {
  activity,
  approval,
  bruno,
  commit,
  commits,
  deployment,
  emojiGiven,
  emojiReceived,
  fridayDay,
  issueEvent,
  mr,
  note,
  pipeline,
  pushEvent,
  team,
  times,
  winter,
} from './builders';

describe('computeWrappedStats: forma dell’output', () => {
  it('con attività zero passa lo schema e assegna comunque una personalità', () => {
    const stats = computeWrappedStats(activity(), team);
    expect(wrappedStatsSchema.parse(stats)).toEqual(stats);
    expect(stats.timezone).toBe(DEFAULT_TIMEZONE);
    expect(stats.totals.commits).toBe(0);
    expect(stats.peakHour).toBeNull();
    expect(stats.peakWeekday).toBeNull();
    expect(stats.streak).toEqual({ longestDays: 0, from: null, to: null });
    expect(stats.duet).toBeNull();
    expect(stats.commitMessages.shortest).toBeNull();
    expect(stats.commitMessages.averageLength).toBe(0);
    expect(stats.pipelines.successRate).toBeNull();
    expect(stats.ghostMrs).toEqual({ count: 0, oldestDays: null });
    expect(stats.fridayDeploys).toEqual({ count: 0, latestAt: null });
    expect(stats.epicMoments).toEqual([]);
    expect(stats.badges).toEqual([]);
    expect(stats.languages).toEqual([]);
    expect(stats.personality.id).toBe('philosopher');
    expect(Object.keys(stats.personality.scores).sort()).toEqual(
      [...PERSONALITY_DIMENSIONS].sort(),
    );
    for (const v of Object.values(stats.personality.scores)) expect(v).toBe(0);
  });

  it('l’esempio dei contratti produce statistiche valide', () => {
    const stats = computeWrappedStats(exampleRawActivity, [
      { username: 'marco.vitale', displayName: 'Marco Vitale' },
    ]);
    expect(() => wrappedStatsSchema.parse(stats)).not.toThrow();
    expect(stats.totals.commits).toBe(1);
    expect(stats.hours[23]).toBe(1);
    expect(stats.duet?.partner.displayName).toBe('Marco Vitale');
    expect(stats.epicMoments.map((m) => m.kind)).toContain('latest_night_commit');
  });

  it('con attività estrema resta valida e ogni badge scatta nettamente', () => {
    // Profilo esagerato in tutto: 3.000 commit cortissimi tra notte e alba, poliglotti, ecc.
    const files = ['a.ts', 'b.py', 'c.go', 'd.rs', 'e.java', 'f.sh'];
    const extreme = activity({
      projects: [
        {
          id: 1,
          path: 'acme/officina/motore',
          defaultBranch: 'main',
          languages: { Go: 100 },
          lastActivityBeforeYearAt: '2023-01-01T10:00:00+01:00',
        },
      ],
      commits: times(3000, (i) =>
        commit(winter(i % 80, [23, 2, 6, 7][i % 4] ?? 0, i % 60), {
          message: i % 2 ? 'ops' : 'fix ✨',
          files,
          additions: 5,
          deletions: 40,
          todosAdded: 2,
        }),
      ),
      mergeRequests: times(300, (i) =>
        mr({
          createdAt: winter(i % 10, 9),
          updatedAt: winter(i % 10, 9),
          state: i % 2 ? 'opened' : 'closed',
          mergedAt: null,
          closedAt: i % 2 ? null : winter(20, 9),
          changedLines: 5000,
        }),
      ),
      approvalsGiven: times(400, () =>
        approval({
          mrCreatedAt: winter(5, 10, 0),
          approvedAt: winter(5, 10, 1),
          mrChangedLines: 9999,
        }),
      ),
      pipelines: times(2000, (i) => pipeline({ status: i % 3 ? 'failed' : 'success' })),
      deployments: times(200, (i) =>
        deployment({ createdAt: winter(fridayDay(i % 10), 18, i % 60) }),
      ),
      notes: times(500, () => note({ bodyLength: 2000 })),
      emojiGiven: times(5000, () => emojiGiven()),
      emojiReceived: times(5000, () => emojiReceived()),
      issueEvents: times(50, () =>
        issueEvent({ action: 'reopened', previouslyClosedAt: '2024-01-01T10:00:00+01:00' }),
      ),
      pushEvents: times(500, () => pushEvent({ action: 'deleted' })),
    });
    const stats = computeWrappedStats(extreme, team);
    expect(() => wrappedStatsSchema.parse(stats)).not.toThrow();
    expect(stats.badges.map((b) => b.id).sort()).toEqual([...BADGE_IDS].sort());
    const sum = stats.languages.reduce((s, l) => s + l.share, 0);
    expect(sum).toBeLessThanOrEqual(1);
  });

  it('rifiuta un fuso orario inesistente', () => {
    expect(() => computeWrappedStats(activity(), team, { timezone: 'Marte/Olympus' })).toThrow(
      RangeError,
    );
  });

  it('i totali contano solo l’anno raccontato', () => {
    const raw = activity({
      commits: [
        commit(winter(3)),
        commit('2025-06-01T10:00:00+02:00'),
        commit(winter(4), { isMerge: true, additions: 999, deletions: 999 }),
      ],
      mergeRequests: [
        mr(),
        mr({ createdAt: '2025-12-01T10:00:00+01:00', mergedAt: winter(2) }),
        mr({ state: 'opened', mergedAt: null }),
      ],
      approvalsGiven: [approval()],
      pipelines: [pipeline(), pipeline({ status: 'failed' })],
      deployments: [deployment()],
      notes: [note({ projectPath: null }), note()],
      emojiGiven: [emojiGiven()],
      emojiReceived: [emojiReceived()],
      issueEvents: [
        issueEvent(),
        issueEvent({ action: 'closed' }),
        issueEvent({ action: 'reopened' }),
      ],
      pushEvents: [pushEvent({ projectPath: 'acme/altro' })],
    });
    const { totals } = computeWrappedStats(raw, team);
    expect(totals).toEqual({
      commits: 2,
      linesAdded: 10,
      linesDeleted: 2,
      mergeRequestsOpened: 2,
      mergeRequestsMerged: 2,
      approvalsGiven: 1,
      notesWritten: 2,
      pipelines: 2,
      pipelinesFailed: 1,
      deployments: 1,
      issuesOpened: 1,
      issuesClosed: 1,
      emojiGiven: 1,
      emojiReceived: 1,
      projectsTouched: 2,
      activeDays: 5,
    });
  });
});

describe('fusi orari', () => {
  it('ore e giorni nel fuso dato, con l’ora legale', () => {
    const raw = activity({
      commits: [
        // 29 marzo 2026: alle 01:00 UTC Roma passa da +01:00 a +02:00.
        commit('2026-03-29T00:30:00Z'), // 01:30 a Roma
        commit('2026-03-29T01:30:00Z'), // 03:30 a Roma (le 02:xx non esistono)
        // 25 ottobre 2026: alle 01:00 UTC Roma torna a +01:00.
        commit('2026-10-25T00:30:00Z'), // 02:30 CEST
        commit('2026-10-25T01:30:00Z'), // 02:30 CET
      ],
    });
    const rome = computeWrappedStats(raw, team);
    expect(rome.hours[1]).toBe(1);
    expect(rome.hours[3]).toBe(1);
    expect(rome.hours[2]).toBe(2);
    expect(rome.weekdays[6]).toBe(4); // tutte domeniche
    const utc = computeWrappedStats(raw, team, { timezone: 'UTC' });
    expect(utc.hours[0]).toBe(2);
    expect(utc.hours[1]).toBe(2);
    expect(utc.timezone).toBe('UTC');
  });

  it('i confini dell’anno seguono il fuso', () => {
    const raw = activity({
      commits: [
        commit('2025-12-31T23:30:00Z'), // 1° gennaio 2026 00:30 a Roma
        commit('2026-12-31T23:30:00Z'), // 1° gennaio 2027 a Roma: fuori
      ],
    });
    expect(computeWrappedStats(raw, team).totals.commits).toBe(1);
    const ny = computeWrappedStats(raw, team, { timezone: 'America/New_York' });
    // A New York il primo è ancora 2025, il secondo è il 31 dicembre 2026 alle 18:30.
    expect(ny.totals.commits).toBe(1);
    expect(ny.hours[18]).toBe(1);
    expect(ny.weekdays[3]).toBe(1); // giovedì
    expect(ny.months[11]).toBe(1);
  });

  it('picchi e streak nel fuso locale', () => {
    const raw = activity({
      commits: [
        ...commits(3, {}, 9), // lun-mer 5-7 gennaio
        commit(winter(9, 9)), // sabato 10
        commit(winter(10, 9)), // domenica 11
        commit(winter(11, 9)), // lunedì 12
        commit(winter(12, 14)), // martedì 13
      ],
    });
    const stats = computeWrappedStats(raw, team);
    expect(stats.peakHour).toBe(9);
    expect(stats.peakWeekday).toBe(0);
    expect(stats.streak).toEqual({ longestDays: 4, from: '2026-01-10', to: '2026-01-13' });
  });
});

describe('horoscopeSeed', () => {
  /** Implementazione di riferimento di FNV-1a 32 bit, per stringhe ASCII. */
  function reference(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Number((BigInt(h) * 0x01000193n) & 0xffffffffn);
    }
    return h;
  }

  it('è FNV-1a su "username:anno", uint32 e deterministico', () => {
    expect(horoscopeSeed('ada.rinaldi', 2026)).toBe(reference('ada.rinaldi:2026'));
    expect(horoscopeSeed('ada.rinaldi', 2026)).toBe(horoscopeSeed('ada.rinaldi', 2026));
    expect(horoscopeSeed('ada.rinaldi', 2025)).not.toBe(horoscopeSeed('ada.rinaldi', 2026));
    expect(horoscopeSeed(bruno.username, 2026)).not.toBe(horoscopeSeed('ada.rinaldi', 2026));
    const seed = horoscopeSeed('zoë', 2026);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it('finisce nelle statistiche', () => {
    expect(computeWrappedStats(activity(), team).horoscopeSeed).toBe(
      horoscopeSeed('ada.rinaldi', 2026),
    );
  });
});
