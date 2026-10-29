import type { EpicMoment } from '@git-wrapped/contracts';
import { round } from './internal/math';
import { dayNumber, MS_PER_DAY, MS_PER_MINUTE, parseInstant, toDateKey } from './internal/time';
import { isNightHour, type ActivityContext } from './internal/context';

/**
 * Momenti epici, nell'ordine di `EPIC_MOMENT_KINDS`. Un momento senza dati viene omesso.
 * Unità di `value` per tipo:
 * - `biggest_commit`: righe cambiate (aggiunte + cancellate), commit non di merge;
 * - `first_commit` / `last_commit`: giorno dell'anno (1 = 1° gennaio);
 * - `latest_night_commit`: minuti dalla mezzanotte locale (03:12 → 192); si sceglie, tra i
 *   commit dalle 22:00 alle 04:59, quello più vicino alle 04:00;
 * - `fastest_approval`: minuti tra creazione e prima approvazione di una MR della persona;
 * - `longest_mr`: giorni (1 decimale) tra creazione e merge, MR mergiate nell'anno;
 * - `busiest_day`: commit in quel giorno (`at` = primo commit del giorno).
 */

const FOUR_AM = 4 * 60;

function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
}

export function computeEpicMoments(ctx: ActivityContext): EpicMoment[] {
  const moments: EpicMoment[] = [];
  const dayOfYear = (dateKey: string) =>
    dayNumber(dateKey) - dayNumber(toDateKey(ctx.year, 1, 1)) + 1;

  // Il commit più grosso.
  let biggest: (typeof ctx.authoredCommits)[number] | null = null;
  for (const c of ctx.authoredCommits) {
    const size = c.item.additions + c.item.deletions;
    if (size > 0 && (!biggest || size > biggest.item.additions + biggest.item.deletions))
      biggest = c;
  }
  if (biggest) {
    moments.push({
      kind: 'biggest_commit',
      at: biggest.item.authoredAt,
      value: biggest.item.additions + biggest.item.deletions,
      projectPath: biggest.item.projectPath,
    });
  }

  // Primo e ultimo commit dell'anno.
  const first = ctx.commits[0];
  const last = ctx.commits[ctx.commits.length - 1];
  if (first && last) {
    moments.push({
      kind: 'first_commit',
      at: first.item.authoredAt,
      value: dayOfYear(first.at.dateKey),
      projectPath: first.item.projectPath,
    });
    moments.push({
      kind: 'last_commit',
      at: last.item.authoredAt,
      value: dayOfYear(last.at.dateKey),
      projectPath: last.item.projectPath,
    });
  }

  // Il commit più notturno.
  let night: (typeof ctx.commits)[number] | null = null;
  for (const c of ctx.commits) {
    if (!isNightHour(c.at.hour)) continue;
    if (
      !night ||
      circularDistance(c.at.minuteOfDay, FOUR_AM) < circularDistance(night.at.minuteOfDay, FOUR_AM)
    ) {
      night = c;
    }
  }
  if (night) {
    moments.push({
      kind: 'latest_night_commit',
      at: night.item.authoredAt,
      value: night.at.minuteOfDay,
      projectPath: night.item.projectPath,
    });
  }

  // La MR approvata più in fretta.
  let fastest: { minutes: number; at: string; projectPath: string } | null = null;
  for (const { item, at } of ctx.mergeRequests) {
    const approved = item.firstApprovedAt === null ? null : parseInstant(item.firstApprovedAt);
    if (approved === null || item.firstApprovedAt === null || approved < at.epoch) continue;
    const minutes = Math.round((approved - at.epoch) / MS_PER_MINUTE);
    if (!fastest || minutes < fastest.minutes) {
      fastest = { minutes, at: item.firstApprovedAt, projectPath: item.projectPath };
    }
  }
  if (fastest) {
    moments.push({
      kind: 'fastest_approval',
      at: fastest.at,
      value: fastest.minutes,
      projectPath: fastest.projectPath,
    });
  }

  // La MR rimasta aperta più a lungo prima del merge.
  let longest: { ms: number; at: string; projectPath: string } | null = null;
  for (const mr of ctx.raw.mergeRequests) {
    if (mr.mergedAt === null) continue;
    const merged = parseInstant(mr.mergedAt);
    const created = parseInstant(mr.createdAt);
    if (merged === null || created === null) continue;
    if (merged < ctx.yearStart || merged >= ctx.yearEnd || merged < created) continue;
    if (!longest || merged - created > longest.ms) {
      longest = { ms: merged - created, at: mr.mergedAt, projectPath: mr.projectPath };
    }
  }
  if (longest) {
    moments.push({
      kind: 'longest_mr',
      at: longest.at,
      value: round(longest.ms / MS_PER_DAY, 1),
      projectPath: longest.projectPath,
    });
  }

  // Il giorno con più commit (a parità, il primo).
  const byDay = new Map<string, { count: number; first: (typeof ctx.commits)[number] }>();
  for (const c of ctx.commits) {
    const entry = byDay.get(c.at.dateKey);
    if (entry) entry.count++;
    else byDay.set(c.at.dateKey, { count: 1, first: c });
  }
  let busiest: { count: number; first: (typeof ctx.commits)[number] } | null = null;
  for (const entry of byDay.values()) {
    if (!busiest || entry.count > busiest.count) busiest = entry;
  }
  if (busiest) {
    moments.push({
      kind: 'busiest_day',
      at: busiest.first.item.authoredAt,
      value: busiest.count,
      projectPath: null,
    });
  }

  return moments;
}
