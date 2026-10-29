import type { EarnedBadge, WrappedStats } from '@git-wrapped/contracts';
import { charLength, mean, round, safeRatio } from './internal/math';
import { MS_PER_DAY, MS_PER_MINUTE, parseInstant } from './internal/time';
import { isEarlyMinute, isNightHour, type ActivityContext } from './internal/context';
import { failedDefaultBranchPipelines } from './pipelines';
import { dangerousFridayDeploys } from './social';

/**
 * Regole dei badge. Ogni soglia è documentata in `packages/stats/BADGES.md`: se cambi un
 * numero qui, aggiorna anche quel file. Nessun badge premia o punisce il volume di lavoro:
 * si guardano proporzioni e comportamenti, con minimi di campione solo contro i falsi positivi.
 */
export const BADGE_THRESHOLDS = {
  night_owl: { minShare: 0.2, minCommits: 20 },
  early_bird: { minShare: 0.2, minCommits: 20 },
  main_breaker: { minFailedDefault: 5 },
  blind_approver: { minApprovals: 3, maxMinutes: 5, minChangedLines: 300 },
  novelist: { minCommitAverage: 120, minCommits: 10, minNoteAverage: 400, minNotes: 10 },
  silent_monk: { maxCommitAverage: 15, minCommits: 20 },
  ghost_mr: { minGhosts: 2 },
  lives_dangerously: { minDeploys: 3 },
  marie_kondo: { minDeleteRatio: 1.2, minChangedLines: 500, minDeletedBranches: 15 },
  todo_collector: { minNetTodos: 10 },
  necromancer: { minReopenGapDays: 180, minProjectIdleDays: 365 },
  polyglot: { minLanguages: 4, minShare: 0.05, minCommits: 10 },
  emoji_overlord: { minEmojiGiven: 150 },
} as const;

/** Parte delle statistiche già calcolate che serve ai badge. */
export type BadgeInputs = Pick<WrappedStats, 'languages' | 'ghostMrs'>;

/** Metriche grezze usate dai badge (esportate per i test e per la personalità). */
export function commitMessageAverage(ctx: ActivityContext): number {
  return mean(ctx.authoredCommits.map((c) => charLength(c.item.message.trim())));
}

export function computeBadges(ctx: ActivityContext, inputs: BadgeInputs): EarnedBadge[] {
  const T = BADGE_THRESHOLDS;
  const badges: EarnedBadge[] = [];
  const award = (id: EarnedBadge['id'], value: number) => badges.push({ id, value });

  const commits = ctx.commits.length;
  const nightShare = safeRatio(ctx.commits.filter((c) => isNightHour(c.at.hour)).length, commits);
  if (commits >= T.night_owl.minCommits && nightShare >= T.night_owl.minShare) {
    award('night_owl', round(nightShare, 2));
  }

  const earlyShare = safeRatio(
    ctx.commits.filter((c) => isEarlyMinute(c.at.minuteOfDay)).length,
    commits,
  );
  if (commits >= T.early_bird.minCommits && earlyShare >= T.early_bird.minShare) {
    award('early_bird', round(earlyShare, 2));
  }

  const failedDefault = failedDefaultBranchPipelines(ctx);
  if (failedDefault >= T.main_breaker.minFailedDefault) award('main_breaker', failedDefault);

  const blind = ctx.approvalsGiven.filter(({ item, at }) => {
    const created = parseInstant(item.mrCreatedAt);
    if (created === null || item.mrChangedLines === null) return false;
    const minutes = (at.epoch - created) / MS_PER_MINUTE;
    return (
      minutes >= 0 &&
      minutes <= T.blind_approver.maxMinutes &&
      item.mrChangedLines >= T.blind_approver.minChangedLines
    );
  }).length;
  if (blind >= T.blind_approver.minApprovals) award('blind_approver', blind);

  const authored = ctx.authoredCommits.length;
  const messageAverage = commitMessageAverage(ctx);
  const noteAverage = mean(ctx.notes.map((n) => n.item.bodyLength));
  if (authored >= T.novelist.minCommits && messageAverage >= T.novelist.minCommitAverage) {
    award('novelist', round(messageAverage, 1));
  } else if (ctx.notes.length >= T.novelist.minNotes && noteAverage >= T.novelist.minNoteAverage) {
    award('novelist', round(noteAverage, 1));
  }

  // Variante scelta: messaggi di commit cortissimi (vedi BADGES.md).
  if (authored >= T.silent_monk.minCommits && messageAverage <= T.silent_monk.maxCommitAverage) {
    award('silent_monk', round(messageAverage, 1));
  }

  if (inputs.ghostMrs.count >= T.ghost_mr.minGhosts) award('ghost_mr', inputs.ghostMrs.count);

  const dangerous = dangerousFridayDeploys(ctx);
  if (dangerous >= T.lives_dangerously.minDeploys) award('lives_dangerously', dangerous);

  let added = 0;
  let deleted = 0;
  for (const { item } of ctx.authoredCommits) {
    added += item.additions;
    deleted += item.deletions;
  }
  const deletedBranches = ctx.pushEvents.filter(
    (e) => e.item.action === 'deleted' && e.item.refType === 'branch',
  ).length;
  if (
    added + deleted >= T.marie_kondo.minChangedLines &&
    deleted >= T.marie_kondo.minDeleteRatio * added
  ) {
    award('marie_kondo', round(deleted / Math.max(added, 1), 2));
  } else if (deletedBranches >= T.marie_kondo.minDeletedBranches) {
    award('marie_kondo', deletedBranches);
  }

  const netTodos = ctx.authoredCommits.reduce(
    (sum, { item }) => sum + item.todosAdded - item.todosRemoved,
    0,
  );
  if (netTodos >= T.todo_collector.minNetTodos) award('todo_collector', netTodos);

  const necromancy = necromancerDays(ctx);
  if (necromancy !== null) award('necromancer', necromancy);

  const languages = inputs.languages.filter((l) => l.share >= T.polyglot.minShare).length;
  if (authored >= T.polyglot.minCommits && languages >= T.polyglot.minLanguages) {
    award('polyglot', languages);
  }

  if (ctx.emojiGiven.length >= T.emoji_overlord.minEmojiGiven) {
    award('emoji_overlord', ctx.emojiGiven.length);
  }

  return badges;
}

/**
 * Necromante: giorni del "risveglio" più lungo, `null` se nessuno supera la soglia.
 * - issue riaperta nell'anno più di 180 giorni dopo la sua ultima chiusura;
 * - primo commit dell'anno su un progetto fermo da più di 365 giorni
 *   (`lastActivityBeforeYearAt`).
 */
export function necromancerDays(ctx: ActivityContext): number | null {
  const T = BADGE_THRESHOLDS.necromancer;
  let best: number | null = null;
  const consider = (gapDays: number, min: number) => {
    if (gapDays > min && (best === null || gapDays > best)) best = Math.floor(gapDays);
  };

  for (const { item, at } of ctx.issueEvents) {
    if (item.action !== 'reopened' || item.previouslyClosedAt === null) continue;
    const closed = parseInstant(item.previouslyClosedAt);
    if (closed !== null) consider((at.epoch - closed) / MS_PER_DAY, T.minReopenGapDays);
  }

  const firstCommitOn = new Map<string, number>();
  for (const { item, at } of ctx.commits) {
    if (!firstCommitOn.has(item.projectPath)) firstCommitOn.set(item.projectPath, at.epoch);
  }
  for (const project of ctx.raw.projects) {
    const first = firstCommitOn.get(project.path);
    const idleSince =
      project.lastActivityBeforeYearAt === null
        ? null
        : parseInstant(project.lastActivityBeforeYearAt);
    if (first === undefined || idleSince === null) continue;
    consider((first - idleSince) / MS_PER_DAY, T.minProjectIdleDays);
  }
  return best;
}
