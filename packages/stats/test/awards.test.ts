import { describe, expect, it } from 'vitest';
import { teamAwardsSchema, type Member, type WrappedStats } from '@git-wrapped/contracts';
import { computeTeamAwards, computeWrappedStats } from '../src/index';
import {
  activity,
  ada,
  bruno,
  carla,
  commit,
  dario,
  deployment,
  emojiGiven,
  fridayDay,
  mr,
  note,
  pipeline,
  team,
  times,
  winter,
} from './builders';

/** Statistiche "vuote" di un membro, da ritoccare nei singoli test. */
function base(member: Member, overrides: Partial<WrappedStats> = {}): WrappedStats {
  return { ...computeWrappedStats(activity({ member }), team), ...overrides };
}

const award = (stats: WrappedStats[], id: string) =>
  computeTeamAwards(stats, 2026).awards.find((a) => a.id === id) ?? null;

describe('computeTeamAwards', () => {
  it('team senza attività: nessun premio, totali a zero, schema valido', () => {
    const result = computeTeamAwards(
      team.map((m) => base(m)),
      2026,
    );
    expect(teamAwardsSchema.parse(result)).toEqual(result);
    expect(result.awards).toEqual([]);
    expect(result.teamSize).toBe(4);
    expect(result.teamTotals).toEqual({
      commits: 0,
      mergeRequestsMerged: 0,
      pipelines: 0,
      emojiGiven: 0,
    });
  });

  it('team vuoto e anni diversi', () => {
    expect(computeTeamAwards([], 2026).teamSize).toBe(0);
    const other = { ...base(ada), year: 2025 };
    expect(computeTeamAwards([other], 2026).teamSize).toBe(0);
  });

  it('dalle statistiche reali: tutti i premi calcolabili, schema valido', () => {
    const raws = [
      activity({
        member: ada,
        commits: [
          commit(winter(3, 3, 50), { message: 'fix' }),
          commit(winter(4, 5, 10), { message: 'x'.repeat(300), additions: 100, deletions: 900 }),
        ],
        notes: times(5, () => note({ counterpart: bruno.username })),
        emojiGiven: times(3, () => emojiGiven({ name: 'tada', counterpart: bruno.username })),
        deployments: [deployment({ createdAt: winter(fridayDay(1), 17) })],
        mergeRequests: [mr({ createdAt: winter(1), mergedAt: winter(30) })],
      }),
      activity({
        member: bruno,
        commits: [commit(winter(3, 22, 0), { message: 'ok' })],
        pipelines: [
          pipeline({ status: 'failed', createdAt: winter(2, 9), author: bruno.username }),
          pipeline({ status: 'success', createdAt: winter(2, 10), author: bruno.username }),
        ],
        notes: times(2, () => note({ counterpart: ada.username })),
        emojiGiven: times(5, () => emojiGiven({ name: 'eyes' })),
      }),
    ];
    const stats = raws.map((r) => computeWrappedStats(r, team));
    const result = computeTeamAwards(stats, 2026);
    expect(() => teamAwardsSchema.parse(result)).not.toThrow();
    expect(result.awards.map((a) => a.id)).toEqual([
      'best_duet',
      'night_shift',
      'pipeline_phoenix',
      'emoji_of_the_year',
      'marathon_mr',
      'hemingway',
      'tolstoy',
      'golden_broom',
      'friday_courage',
      'first_light',
    ]);
    const get = (id: string) => result.awards.find((a) => a.id === id);
    expect(get('best_duet')).toMatchObject({ winners: [ada, bruno], value: 8 });
    expect(get('night_shift')).toMatchObject({ winners: [ada], value: 230, detail: '03:50' });
    expect(get('emoji_of_the_year')).toMatchObject({ winners: [bruno], value: 5, detail: 'eyes' });
    expect(get('marathon_mr')).toMatchObject({ winners: [ada], value: 29 });
    expect(get('hemingway')).toMatchObject({ winners: [bruno], value: 2, detail: 'ok' });
    expect(get('tolstoy')).toMatchObject({ winners: [ada], value: 300 });
    expect(get('golden_broom')).toMatchObject({ winners: [ada], value: 8.2 });
    expect(get('friday_courage')).toMatchObject({ winners: [ada], value: 1 });
    expect(get('first_light')).toMatchObject({ winners: [ada], value: 310, detail: '05:10' });
    expect(get('pipeline_phoenix')).toMatchObject({ winners: [bruno], value: 1, detail: null });
    expect(result.teamTotals.commits).toBe(3);
  });

  it('pari merito: più vincitori in ordine di username', () => {
    const withShortest = (m: Member, shortest: string) =>
      base(m, { commitMessages: { ...base(m).commitMessages, shortest } });
    const result = award(
      [withShortest(dario, 'wip'), withShortest(bruno, 'fix'), withShortest(carla, 'refactor')],
      'hemingway',
    );
    expect(result).toMatchObject({ winners: [bruno, dario], value: 3, detail: 'fix' });
  });

  it('best_duet: una coppia, conteggio più alto tra le due metà, sempre due vincitori', () => {
    const duet = (m: Member, partner: Member, interactions: number): WrappedStats =>
      base(m, {
        duet: {
          partner,
          interactions,
          via: { approvals: interactions, reviews: 0, notes: 0, emoji: 0 },
        },
      });
    const result = award(
      [duet(bruno, ada, 10), duet(ada, bruno, 12), duet(carla, dario, 12), duet(dario, dario, 99)],
      'best_duet',
    );
    expect(result).toMatchObject({ winners: [ada, bruno], value: 12 });
  });

  it('golden_broom richiede almeno 500 righe cambiate', () => {
    const totals = (m: Member, linesAdded: number, linesDeleted: number) =>
      base(m, { totals: { ...base(m).totals, linesAdded, linesDeleted } });
    expect(award([totals(ada, 10, 489)], 'golden_broom')).toBeNull();
    expect(award([totals(ada, 0, 500)], 'golden_broom')?.value).toBe(500);
    expect(award([totals(ada, 600, 0)], 'golden_broom')).toBeNull();
  });

  it('marathon_mr considera anche le MR fantasma', () => {
    const ghost = base(carla, { ghostMrs: { count: 1, oldestDays: 200 } });
    expect(award([ghost, base(ada)], 'marathon_mr')).toMatchObject({
      winners: [carla],
      value: 200,
    });
  });

  it('night_shift premia il commit più vicino alle 04:00', () => {
    const night = (m: Member, value: number) =>
      base(m, {
        epicMoments: [{ kind: 'latest_night_commit', at: winter(1), value, projectPath: null }],
      });
    expect(award([night(ada, 23 * 60), night(bruno, 4 * 60 + 30)], 'night_shift')).toMatchObject({
      winners: [bruno],
      detail: '04:30',
    });
  });
});
