import { describe, expect, it } from 'vitest';
import type { BadgeId, RawActivity } from '@git-wrapped/contracts';
import { computeWrappedStats } from '../src/index';
import { BADGE_THRESHOLDS } from '../src/badges';
import {
  activity,
  approval,
  commit,
  commits,
  deployment,
  emojiGiven,
  fridayDay,
  issueEvent,
  mr,
  note,
  pipeline,
  project,
  pushEvent,
  team,
  times,
  winter,
} from './builders';

function badge(raw: RawActivity, id: BadgeId) {
  return computeWrappedStats(raw, team).badges.find((b) => b.id === id) ?? null;
}

/** `n` commit di cui `special` all'ora `specialHour` e il resto alle 11:00. */
function hoursProfile(n: number, special: number, specialHour: number, specialMinute = 0) {
  return times(n, (i) =>
    commit(winter(i % 70, i < special ? specialHour : 11, i < special ? specialMinute : 0)),
  );
}

describe('night_owl (Gufo notturno)', () => {
  it('scatta al 20% di commit tra le 22:00 e le 04:59', () => {
    expect(badge(activity({ commits: hoursProfile(20, 4, 23) }), 'night_owl')).toEqual({
      id: 'night_owl',
      value: 0.2,
    });
    expect(badge(activity({ commits: hoursProfile(20, 4, 4, 59) }), 'night_owl')).not.toBeNull();
  });
  it('non scatta appena sotto soglia, sotto il campione minimo o alle 05:00', () => {
    expect(badge(activity({ commits: hoursProfile(21, 4, 23) }), 'night_owl')).toBeNull();
    expect(badge(activity({ commits: hoursProfile(19, 19, 23) }), 'night_owl')).toBeNull();
    expect(badge(activity({ commits: hoursProfile(20, 10, 5) }), 'night_owl')).toBeNull();
    expect(badge(activity({ commits: hoursProfile(20, 10, 21, 59) }), 'night_owl')).toBeNull();
  });
});

describe('early_bird (Allodola)', () => {
  it('scatta al 20% di commit tra le 05:00 e le 08:29', () => {
    expect(badge(activity({ commits: hoursProfile(20, 4, 5) }), 'early_bird')?.value).toBe(0.2);
    expect(badge(activity({ commits: hoursProfile(20, 4, 8, 29) }), 'early_bird')).not.toBeNull();
  });
  it('non scatta appena sotto soglia o alle 08:30', () => {
    expect(badge(activity({ commits: hoursProfile(21, 4, 6) }), 'early_bird')).toBeNull();
    expect(badge(activity({ commits: hoursProfile(19, 19, 6) }), 'early_bird')).toBeNull();
    expect(badge(activity({ commits: hoursProfile(20, 10, 8, 30) }), 'early_bird')).toBeNull();
    expect(badge(activity({ commits: hoursProfile(20, 10, 4, 59) }), 'early_bird')).toBeNull();
  });
});

describe('main_breaker (Distruttore di main)', () => {
  const failed = (n: number, isDefaultBranch = true) =>
    times(n, () => pipeline({ status: 'failed', isDefaultBranch }));
  it('scatta con 5 pipeline fallite sul branch di default', () => {
    expect(badge(activity({ pipelines: failed(5) }), 'main_breaker')?.value).toBe(5);
  });
  it('non scatta con 4, né con fallimenti su altri branch', () => {
    expect(badge(activity({ pipelines: failed(4) }), 'main_breaker')).toBeNull();
    expect(badge(activity({ pipelines: failed(9, false) }), 'main_breaker')).toBeNull();
  });
});

describe('blind_approver (Approvatore cieco)', () => {
  const quick = (n: number, minutes = 5, lines: number | null = 300) =>
    times(n, () =>
      approval({
        mrCreatedAt: winter(20, 10, 0),
        approvedAt: winter(20, 10, minutes),
        mrChangedLines: lines,
      }),
    );
  it('scatta con 3 approvazioni entro 5 minuti su MR da almeno 300 righe', () => {
    expect(badge(activity({ approvalsGiven: quick(3) }), 'blind_approver')?.value).toBe(3);
  });
  it('non scatta con 2, a 6 minuti, sotto 300 righe o senza righe note', () => {
    expect(badge(activity({ approvalsGiven: quick(2) }), 'blind_approver')).toBeNull();
    expect(badge(activity({ approvalsGiven: quick(3, 6) }), 'blind_approver')).toBeNull();
    expect(badge(activity({ approvalsGiven: quick(3, 1, 299) }), 'blind_approver')).toBeNull();
    expect(badge(activity({ approvalsGiven: quick(3, 1, null) }), 'blind_approver')).toBeNull();
  });
});

describe('novelist (Romanziere)', () => {
  const msg = (n: number) => 'x'.repeat(n);
  it('scatta con messaggi di commit lunghi in media 120 caratteri (min 10 commit)', () => {
    expect(
      badge(activity({ commits: commits(10, { message: msg(120) }) }), 'novelist')?.value,
    ).toBe(120);
  });
  it('scatta con note lunghe in media 400 caratteri (min 10 note)', () => {
    const notes = times(10, () => note({ bodyLength: 400 }));
    expect(badge(activity({ notes }), 'novelist')?.value).toBe(400);
  });
  it('non scatta appena sotto soglia o sotto il campione minimo', () => {
    expect(badge(activity({ commits: commits(10, { message: msg(119) }) }), 'novelist')).toBeNull();
    expect(badge(activity({ commits: commits(9, { message: msg(500) }) }), 'novelist')).toBeNull();
    expect(
      badge(activity({ notes: times(10, () => note({ bodyLength: 399 })) }), 'novelist'),
    ).toBeNull();
    expect(
      badge(activity({ notes: times(9, () => note({ bodyLength: 999 })) }), 'novelist'),
    ).toBeNull();
  });
  it('i merge non contano', () => {
    const raw = activity({
      commits: [
        ...commits(9, { message: msg(200) }),
        commit(winter(70), { isMerge: true, message: msg(200) }),
      ],
    });
    expect(badge(raw, 'novelist')).toBeNull();
  });
});

describe('silent_monk (Monaco silenzioso), variante "messaggi cortissimi"', () => {
  it('scatta con media dei messaggi ≤ 15 caratteri (min 20 commit)', () => {
    expect(
      badge(activity({ commits: commits(20, { message: 'x'.repeat(15) }) }), 'silent_monk')?.value,
    ).toBe(15);
  });
  it('non scatta a 16 caratteri o con 19 commit', () => {
    expect(
      badge(activity({ commits: commits(20, { message: 'x'.repeat(16) }) }), 'silent_monk'),
    ).toBeNull();
    expect(badge(activity({ commits: commits(19, { message: 'ok' }) }), 'silent_monk')).toBeNull();
  });
});

describe('ghost_mr (MR fantasma)', () => {
  const ghost = () =>
    mr({ state: 'opened', mergedAt: null, updatedAt: '2026-11-30T10:00:00+01:00' });
  const alive = () =>
    mr({ state: 'opened', mergedAt: null, updatedAt: '2026-12-02T10:00:00+01:00' });
  it('scatta con 2 MR fantasma', () => {
    const closed = mr({ state: 'closed', mergedAt: null, closedAt: winter(40) });
    expect(badge(activity({ mergeRequests: [ghost(), closed] }), 'ghost_mr')?.value).toBe(2);
  });
  it('non scatta con una sola, né con MR aggiornate meno di 30 giorni prima di fine anno', () => {
    expect(badge(activity({ mergeRequests: [ghost(), alive()] }), 'ghost_mr')).toBeNull();
  });
});

describe('lives_dangerously (Vive pericolosamente)', () => {
  const friday = (n: number, hour: number, minute = 0) =>
    times(n, (i) => deployment({ createdAt: winter(fridayDay(i), hour, minute) }));
  it('scatta con 3 deploy di venerdì dalle 16:00', () => {
    expect(badge(activity({ deployments: friday(3, 16) }), 'lives_dangerously')?.value).toBe(3);
  });
  it('non scatta con 2, alle 15:59 o con le sole pipeline', () => {
    expect(badge(activity({ deployments: friday(2, 18) }), 'lives_dangerously')).toBeNull();
    expect(badge(activity({ deployments: friday(5, 15, 59) }), 'lives_dangerously')).toBeNull();
    const pipelines = times(5, (i) => pipeline({ createdAt: winter(fridayDay(i), 18) }));
    expect(badge(activity({ pipelines }), 'lives_dangerously')).toBeNull();
  });
});

describe('marie_kondo (Marie Kondo)', () => {
  it('scatta con righe cancellate ≥ 1,2 × aggiunte (min 500 righe)', () => {
    const raw = activity({ commits: [commit(winter(5), { additions: 250, deletions: 300 })] });
    expect(badge(raw, 'marie_kondo')?.value).toBe(1.2);
  });
  it('scatta con 15 branch cancellati', () => {
    const pushEvents = times(15, () => pushEvent({ action: 'deleted' }));
    expect(badge(activity({ pushEvents }), 'marie_kondo')?.value).toBe(15);
  });
  it('non scatta appena sotto le soglie', () => {
    const low = activity({ commits: [commit(winter(5), { additions: 251, deletions: 300 })] });
    expect(badge(low, 'marie_kondo')).toBeNull();
    const small = activity({ commits: [commit(winter(5), { additions: 0, deletions: 499 })] });
    expect(badge(small, 'marie_kondo')).toBeNull();
    const branches = [
      ...times(14, () => pushEvent({ action: 'deleted' })),
      pushEvent({ action: 'deleted', refType: 'tag' }),
    ];
    expect(badge(activity({ pushEvents: branches }), 'marie_kondo')).toBeNull();
  });
});

describe('todo_collector (Collezionista di TODO)', () => {
  it('scatta con saldo TODO ≥ 10', () => {
    const raw = activity({ commits: [commit(winter(5), { todosAdded: 12, todosRemoved: 2 })] });
    expect(badge(raw, 'todo_collector')?.value).toBe(10);
  });
  it('non scatta con saldo 9', () => {
    const raw = activity({ commits: [commit(winter(5), { todosAdded: 12, todosRemoved: 3 })] });
    expect(badge(raw, 'todo_collector')).toBeNull();
  });
});

describe('necromancer (Necromante)', () => {
  it('scatta per una issue riaperta più di 180 giorni dopo la chiusura', () => {
    const raw = activity({
      issueEvents: [
        issueEvent({
          action: 'reopened',
          at: winter(30),
          previouslyClosedAt: '2025-08-02T10:00:00+02:00',
        }),
      ],
    });
    expect(badge(raw, 'necromancer')?.value).toBe(182);
  });
  it('scatta per un commit su un progetto fermo da più di 365 giorni', () => {
    const raw = activity({
      projects: [project({ lastActivityBeforeYearAt: '2024-06-01T10:00:00+02:00' })],
      commits: [commit(winter(10))],
    });
    expect(badge(raw, 'necromancer')?.value).toBeGreaterThan(365);
  });
  it('non scatta appena sotto soglia o senza dati', () => {
    const raw = activity({
      projects: [
        project({ lastActivityBeforeYearAt: '2025-01-12T10:00:00+01:00' }),
        project({ path: 'acme/vuoto', lastActivityBeforeYearAt: null }),
      ],
      commits: [commit(winter(10)), commit(winter(10), { projectPath: 'acme/vuoto' })],
      issueEvents: [
        issueEvent({
          action: 'reopened',
          at: winter(30),
          previouslyClosedAt: '2025-08-04T11:00:00+02:00',
        }),
        issueEvent({ action: 'reopened', previouslyClosedAt: null }),
        issueEvent({ action: 'closed', previouslyClosedAt: '2020-01-01T10:00:00+01:00' }),
      ],
    });
    expect(badge(raw, 'necromancer')).toBeNull();
  });
});

describe('polyglot (Poliglotta)', () => {
  const withFiles = (n: number, files: (i: number) => string[]) =>
    activity({ commits: commits(n, (i) => ({ files: files(i) })) });
  it('scatta con 4 linguaggi al 5% o più (min 10 commit)', () => {
    const raw = withFiles(10, () => ['a.ts', 'b.py', 'c.go', 'd.rs']);
    expect(badge(raw, 'polyglot')?.value).toBe(4);
  });
  it('non scatta con 3 linguaggi, con un linguaggio sotto il 5% o con 9 commit', () => {
    expect(
      badge(
        withFiles(10, () => ['a.ts', 'b.py', 'c.go']),
        'polyglot',
      ),
    ).toBeNull();
    // Rust compare in 1 commit su 30: 1/91 di file, sotto il 5%.
    const rare = withFiles(30, (i) =>
      i === 0 ? ['a.ts', 'b.py', 'c.go', 'd.rs'] : ['a.ts', 'b.py', 'c.go'],
    );
    expect(badge(rare, 'polyglot')).toBeNull();
    expect(
      badge(
        withFiles(9, () => ['a.ts', 'b.py', 'c.go', 'd.rs']),
        'polyglot',
      ),
    ).toBeNull();
  });
});

describe('emoji_overlord (Re delle reazioni)', () => {
  it('scatta con 150 emoji date', () => {
    expect(
      badge(activity({ emojiGiven: times(150, () => emojiGiven()) }), 'emoji_overlord')?.value,
    ).toBe(150);
  });
  it('non scatta con 149', () => {
    expect(
      badge(activity({ emojiGiven: times(149, () => emojiGiven()) }), 'emoji_overlord'),
    ).toBeNull();
  });
});

describe('soglie', () => {
  it('sono quelle documentate in BADGES.md', () => {
    expect(BADGE_THRESHOLDS.night_owl.minShare).toBe(0.2);
    expect(BADGE_THRESHOLDS.silent_monk.maxCommitAverage).toBe(15);
    expect(Object.keys(BADGE_THRESHOLDS)).toHaveLength(13);
  });
});
