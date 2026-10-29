import type { WrappedStats } from '@git-wrapped/contracts';
import { MS_PER_DAY, parseInstant } from './internal/time';
import type { ActivityContext } from './internal/context';

/**
 * MR fantasma, calcolate rispetto alla fine dell'anno nel fuso (il "presente" del racconto):
 * - aperte (`state: opened`), create prima di fine anno e senza aggiornamenti da più di
 *   30 giorni a fine anno; età = giorni dalla creazione a fine anno;
 * - chiuse senza merge (`state: closed`, `mergedAt` nullo) con chiusura nell'anno;
 *   età = giorni dalla creazione alla chiusura.
 */

export const GHOST_IDLE_DAYS = 30;

export function computeGhostMrs(ctx: ActivityContext): WrappedStats['ghostMrs'] {
  const ages: number[] = [];
  for (const mr of ctx.raw.mergeRequests) {
    const created = parseInstant(mr.createdAt);
    if (created === null || created >= ctx.yearEnd) continue;

    if (mr.state === 'opened') {
      const updated = parseInstant(mr.updatedAt) ?? created;
      if (ctx.yearEnd - updated > GHOST_IDLE_DAYS * MS_PER_DAY) {
        ages.push(ctx.yearEnd - created);
      }
    } else if (mr.state === 'closed' && mr.mergedAt === null) {
      const closed = parseInstant(mr.closedAt ?? mr.updatedAt);
      if (closed !== null && closed >= ctx.yearStart && closed < ctx.yearEnd) {
        ages.push(Math.max(0, closed - created));
      }
    }
  }
  return {
    count: ages.length,
    oldestDays:
      ages.length === 0 ? null : Math.floor(ages.reduce((a, b) => Math.max(a, b), 0) / MS_PER_DAY),
  };
}
