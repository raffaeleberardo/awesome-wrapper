import { describe, expect, it } from 'vitest';
import { BADGE_IDS, PERSONALITY_IDS, wrappedStatsSchema } from '@git-wrapped/contracts';
import { demoActivities, demoMembers } from '@git-wrapped/fixtures';
import { computeWrappedStats } from '../src/index';

/** Verifica sui dati demo di A5 (team finto di 8 persone): nessuno skip. */
const activities = Object.values(demoActivities);

describe('dati demo', () => {
  it('ogni badge e ogni personalità compaiono almeno una volta', () => {
    expect(activities).toHaveLength(8);
    const stats = activities.map((raw) => computeWrappedStats(raw, demoMembers));
    for (const s of stats) expect(() => wrappedStatsSchema.parse(s)).not.toThrow();

    const earned = new Set(stats.flatMap((s) => s.badges.map((b) => b.id)));
    expect(BADGE_IDS.filter((id) => !earned.has(id))).toEqual([]);

    // Il team demo è progettato con una personalità dominante diversa per ciascuno degli 8.
    const personalities = new Set(stats.map((s) => s.personality.id));
    expect(PERSONALITY_IDS.filter((id) => !personalities.has(id))).toEqual([]);
  });
});
