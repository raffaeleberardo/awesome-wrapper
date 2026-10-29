import { describe, expect, it } from 'vitest';
import { BADGE_IDS, teamAwardsSchema, wrappedStatsSchema } from '@git-wrapped/contracts';
import { DEMO_YEAR, demoActivities, demoMembers } from '@git-wrapped/fixtures';
import { computeTeamAwards, computeWrappedStats } from '../src/index';

/**
 * Verifica sui dati demo di A5. Oggi `demoActivities` è vuoto: il test si salta da solo
 * e si attiva in integrazione, quando arrivano i dati veri del team finto.
 */
const activities = Object.values(demoActivities);

describe('dati demo', () => {
  it.skipIf(activities.length === 0)('ogni badge è assegnato ad almeno una persona', () => {
    const stats = activities.map((raw) => computeWrappedStats(raw, demoMembers));
    for (const s of stats) expect(() => wrappedStatsSchema.parse(s)).not.toThrow();

    const earned = new Set(stats.flatMap((s) => s.badges.map((b) => b.id)));
    const missing = BADGE_IDS.filter((id) => !earned.has(id));
    expect(missing).toEqual([]);

    if (stats.length >= 8) {
      const personalities = new Set(stats.map((s) => s.personality.id));
      expect(personalities.size).toBeGreaterThan(1);
    }

    const awards = computeTeamAwards(stats, DEMO_YEAR);
    expect(() => teamAwardsSchema.parse(awards)).not.toThrow();
  });
});
