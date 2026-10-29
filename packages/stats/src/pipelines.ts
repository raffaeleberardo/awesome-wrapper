import type { WrappedStats } from '@git-wrapped/contracts';
import { round } from './internal/math';
import type { ActivityContext } from './internal/context';

/**
 * Cimitero delle pipeline.
 * - `successRate`: quota di pipeline non fallite sul totale (come nell'esempio dei contratti).
 * - `longestFailStreak`: fallimenti consecutivi in ordine cronologico; una `success` interrompe
 *   la serie, gli altri stati (annullate, saltate, in corso...) non la toccano.
 * - `recoveries`: pipeline `success` subito dopo una `failed` sullo stesso progetto e ref, in
 *   ordine cronologico (gli altri stati non contano, come per la serie).
 * - `graveyard`: le più memorabili tra le fallite: prima quelle sul branch di default,
 *   poi le più lunghe, poi le più recenti.
 */
export function computePipelines(ctx: ActivityContext): WrappedStats['pipelines'] {
  const all = ctx.pipelines;
  const failed = all.filter((p) => p.item.status === 'failed');

  let streak = 0;
  let longestFailStreak = 0;
  for (const { item } of all) {
    if (item.status === 'failed') {
      streak++;
      longestFailStreak = Math.max(longestFailStreak, streak);
    } else if (item.status === 'success') {
      streak = 0;
    }
  }

  let recoveries = 0;
  const lastOutcome = new Map<string, 'failed' | 'success'>();
  for (const { item } of all) {
    if (item.status !== 'failed' && item.status !== 'success') continue;
    const key = `${item.projectPath}\u0000${item.ref}`;
    if (item.status === 'success' && lastOutcome.get(key) === 'failed') recoveries++;
    lastOutcome.set(key, item.status);
  }

  const graveyard = [...failed]
    .sort(
      (a, b) =>
        Number(b.item.isDefaultBranch) - Number(a.item.isDefaultBranch) ||
        (b.item.durationSeconds ?? 0) - (a.item.durationSeconds ?? 0) ||
        b.at.epoch - a.at.epoch ||
        a.item.id - b.item.id,
    )
    .slice(0, 3)
    .map(({ item }) => ({
      projectPath: item.projectPath,
      ref: item.ref,
      failedAt: item.createdAt,
    }));

  return {
    total: all.length,
    failed: failed.length,
    successRate: all.length === 0 ? null : round((all.length - failed.length) / all.length, 3),
    longestFailStreak,
    recoveries,
    graveyard,
  };
}

/** Pipeline fallite sul branch di default (badge Distruttore di main). */
export function failedDefaultBranchPipelines(ctx: ActivityContext): number {
  return ctx.pipelines.filter((p) => p.item.status === 'failed' && p.item.isDefaultBranch).length;
}
