import type { WrappedStats } from '@git-wrapped/contracts';
import { floorTo, increment, rankCounts } from './internal/math';
import type { ActivityContext } from './internal/context';

/** Repo e file più toccati. */

export function computeTopProjects(ctx: ActivityContext): WrappedStats['topProjects'] {
  const counts = new Map<string, number>();
  for (const { item } of ctx.commits) increment(counts, item.projectPath);
  const total = ctx.commits.length;
  return rankCounts(counts, 5).map(([projectPath, commits]) => ({
    projectPath,
    commits,
    share: floorTo(commits / total),
  }));
}

/** File più toccati nei commit non di merge. Chiave: progetto + percorso. */
export function computeTopFiles(ctx: ActivityContext): WrappedStats['topFiles'] {
  const counts = new Map<string, number>();
  for (const { item } of ctx.authoredCommits) {
    for (const path of new Set(item.files)) increment(counts, `${item.projectPath}\u0000${path}`);
  }
  return rankCounts(counts, 5).map(([key, touches]) => {
    const [projectPath = '', path = ''] = key.split('\u0000');
    return { path, projectPath, touches };
  });
}
