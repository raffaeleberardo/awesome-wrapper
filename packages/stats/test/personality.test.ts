import { describe, expect, it } from 'vitest';
import { PERSONALITY_IDS, type PersonalityId, type RawActivity } from '@git-wrapped/contracts';
import { computeWrappedStats } from '../src/index';
import { PERSONALITY_TIE_ORDER, PERSONALITY_WEIGHTS } from '../src/personality';
import {
  activity,
  approval,
  commit,
  commits,
  emojiGiven,
  mr,
  note,
  pipeline,
  team,
  times,
  winter,
} from './builders';

const personality = (raw: RawActivity) => computeWrappedStats(raw, team).personality;

/** Profili caricaturali: ognuno deve ottenere la sua personalità. */
const profiles: Record<PersonalityId, RawActivity> = {
  night_creature: activity({
    commits: times(30, (i) => commit(winter(i * 2, [23, 0, 1, 2][i % 4] ?? 0, 15))),
  }),
  metronome: activity({ commits: commits(40, { message: 'aggiorna il modulo dei preventivi' }) }),
  sprinter: activity({
    commits: times(60, (i) =>
      commit(winter(4 + Math.floor(i / 6), 9 + (i % 6) * 1, i), { additions: 4, deletions: 1 }),
    ),
  }),
  architect: activity({
    commits: commits(10, (i) => ({
      files: times(12, (f) => `src/modulo${i}/file${f}.ts`),
      additions: 450,
      deletions: 50,
    })),
    mergeRequests: times(4, () => mr({ changedLines: 2000 })),
  }),
  gardener: activity({ commits: commits(20, { additions: 10, deletions: 100 }) }),
  diplomat: activity({
    commits: commits(5),
    approvalsGiven: times(40, () => approval()),
    notes: times(40, () => note()),
    emojiGiven: times(40, () => emojiGiven()),
  }),
  philosopher: activity({ commits: commits(20, { message: 'x'.repeat(150) }) }),
  firefighter: activity({
    commits: commits(20, { message: 'hotfix: ripristina il checkout' }),
    pipelines: times(20, () => pipeline()),
  }),
};

describe('personalità', () => {
  for (const id of PERSONALITY_IDS) {
    it(`il profilo "${id}" ottiene ${id}`, () => {
      const result = personality(profiles[id]);
      expect(result.id).toBe(id);
      for (const v of Object.values(result.scores)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  }

  it('con attività zero vince la prima dell’ordine di parità (il Filosofo)', () => {
    expect(personality(activity()).id).toBe(PERSONALITY_TIE_ORDER[0]);
    expect(PERSONALITY_TIE_ORDER[0]).toBe('philosopher');
  });

  it('ogni personalità ha pesi e un posto nell’ordine di parità', () => {
    expect([...PERSONALITY_TIE_ORDER].sort()).toEqual([...PERSONALITY_IDS].sort());
    expect(Object.keys(PERSONALITY_WEIGHTS).sort()).toEqual([...PERSONALITY_IDS].sort());
  });

  it('è deterministica', () => {
    expect(personality(profiles.sprinter)).toEqual(personality(profiles.sprinter));
  });
});
