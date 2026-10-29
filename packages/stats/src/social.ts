import type { Member, WrappedStats } from '@git-wrapped/contracts';
import { compareStrings, increment, rankCounts } from './internal/math';
import type { ActivityContext } from './internal/context';

/** Emoji, duetto e deploy del venerdì: il lato "sociale" (e coraggioso) dell'anno. */

export function computeEmoji(ctx: ActivityContext): WrappedStats['emoji'] {
  const given = new Map<string, number>();
  const received = new Map<string, number>();
  ctx.emojiGiven.forEach(({ item }) => increment(given, item.name));
  ctx.emojiReceived.forEach(({ item }) => increment(received, item.name));
  return {
    topGiven: rankCounts(given, 5).map(([name, count]) => ({ name, count })),
    topReceived: rankCounts(received, 5).map(([name, count]) => ({ name, count })),
  };
}

type Via = NonNullable<WrappedStats['duet']>['via'];

/**
 * Duetto: il collega con più interazioni nei due sensi.
 * - approvals: approvazioni date alle sue MR + sue approvazioni sulle MR della persona;
 * - reviews: presenza tra i reviewer delle MR della persona;
 * - notes: note della persona su oggetti di cui è autore (`counterpart`);
 * - emoji: emoji date a lui e ricevute da lui.
 * Si considerano solo i membri del team (se la lista è vuota, chiunque, con lo username come
 * nome). A parità vince lo username alfabeticamente primo. `null` se nessuna interazione.
 */
export function computeDuet(
  ctx: ActivityContext,
  teamMembers: readonly Member[],
): WrappedStats['duet'] {
  const self = ctx.raw.member.username;
  const team = new Map(teamMembers.map((m) => [m.username, m]));
  const counts = new Map<string, Via>();
  const bump = (username: string | null, key: keyof Via) => {
    if (!username || username === self) return;
    if (team.size > 0 && !team.has(username)) return;
    const via = counts.get(username) ?? { approvals: 0, reviews: 0, notes: 0, emoji: 0 };
    via[key]++;
    counts.set(username, via);
  };

  ctx.approvalsGiven.forEach(({ item }) => bump(item.mrAuthor, 'approvals'));
  for (const { item } of ctx.mergeRequests) {
    new Set(item.approvedBy).forEach((u) => bump(u, 'approvals'));
    new Set(item.reviewers).forEach((u) => bump(u, 'reviews'));
  }
  ctx.notes.forEach(({ item }) => bump(item.counterpart, 'notes'));
  ctx.emojiGiven.forEach(({ item }) => bump(item.counterpart, 'emoji'));
  ctx.emojiReceived.forEach(({ item }) => bump(item.from, 'emoji'));

  const total = (v: Via) => v.approvals + v.reviews + v.notes + v.emoji;
  const best = [...counts.entries()].sort(
    (a, b) => total(b[1]) - total(a[1]) || compareStrings(a[0], b[0]),
  )[0];
  if (!best) return null;
  const [username, via] = best;
  return {
    partner: team.get(username) ?? { username, displayName: username },
    interactions: total(via),
    via,
  };
}

/** Il venerdì pomeriggio inizia alle 14:00 (contratto `fridayDeploys`). */
export const FRIDAY_AFTERNOON_MINUTE = 14 * 60;
/** Per il badge Vive pericolosamente si parte dalle 16:00. */
export const FRIDAY_DANGER_MINUTE = 16 * 60;
const FRIDAY = 4;

/**
 * Deploy del venerdì dalle 14:00. Fonte: `deployments`; se la persona non ha alcun deploy
 * nell'anno si ripiega sulle pipeline sul branch di default (come ammesso dal contratto).
 * `latestAt`: il deploy del venerdì all'ora più tarda (a parità, il più recente).
 */
export function computeFridayDeploys(ctx: ActivityContext): WrappedStats['fridayDeploys'] {
  const source =
    ctx.deployments.length > 0
      ? ctx.deployments.map((d) => ({ at: d.at, iso: d.item.createdAt }))
      : ctx.pipelines
          .filter((p) => p.item.isDefaultBranch)
          .map((p) => ({ at: p.at, iso: p.item.createdAt }));
  const friday = source.filter(
    (d) => d.at.weekday === FRIDAY && d.at.minuteOfDay >= FRIDAY_AFTERNOON_MINUTE,
  );
  const latest = [...friday].sort(
    (a, b) => b.at.minuteOfDay - a.at.minuteOfDay || b.at.epoch - a.at.epoch,
  )[0];
  return { count: friday.length, latestAt: latest ? latest.iso : null };
}

/** Deploy veri (non pipeline) di venerdì dalle 16:00: badge Vive pericolosamente. */
export function dangerousFridayDeploys(ctx: ActivityContext): number {
  return ctx.deployments.filter(
    (d) => d.at.weekday === FRIDAY && d.at.minuteOfDay >= FRIDAY_DANGER_MINUTE,
  ).length;
}
