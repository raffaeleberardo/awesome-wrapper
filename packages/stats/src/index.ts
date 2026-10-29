import type { RawActivity, WrappedStats } from '@git-wrapped/contracts';
import { computeBadges } from './badges';
import { computeEpicMoments } from './epic';
import { buildContext } from './internal/context';
import { computeLanguages } from './languages';
import { computeGhostMrs } from './mergeRequests';
import { computeCommitMessages } from './messages';
import { computePersonality } from './personality';
import { computePipelines } from './pipelines';
import { computeTopFiles, computeTopProjects } from './projects';
import { computeRhythm, computeStreak } from './rhythm';
import { computeDuet, computeEmoji, computeFridayDeploys } from './social';
import { computeTotals } from './totals';

/**
 * API pubblica del motore statistiche. Le firme sono congelate a `contracts-v1`;
 * l'implementazione è di A3. Funzioni pure: nessun I/O, nessun accesso a `process.env`.
 */

export interface ComputeOptions {
  /** Fuso IANA per orari e giorni. Default `Europe/Rome`. */
  timezone?: string;
}

export const DEFAULT_TIMEZONE = 'Europe/Rome';

/**
 * `RawActivity` → `WrappedStats`.
 * `teamMembers` serve a risolvere il nome visualizzato del partner del "duetto".
 * Si considerano solo gli eventi dell'anno `raw.year` nel fuso indicato; il "presente"
 * (es. per le MR fantasma) è la fine di quell'anno, mai la data di oggi.
 */
export function computeWrappedStats(
  raw: RawActivity,
  teamMembers: RawActivity['member'][],
  options: ComputeOptions = {},
): WrappedStats {
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;
  const ctx = buildContext(raw, timezone);

  const rhythm = computeRhythm(ctx);
  const languages = computeLanguages(ctx);
  const ghostMrs = computeGhostMrs(ctx);

  return {
    schemaVersion: 1,
    member: raw.member,
    year: raw.year,
    timezone,
    totals: computeTotals(ctx),
    topProjects: computeTopProjects(ctx),
    topFiles: computeTopFiles(ctx),
    languages,
    hours: rhythm.hours,
    weekdays: rhythm.weekdays,
    months: rhythm.months,
    peakHour: rhythm.peakHour,
    peakWeekday: rhythm.peakWeekday,
    streak: computeStreak(ctx),
    duet: computeDuet(ctx, teamMembers),
    commitMessages: computeCommitMessages(ctx),
    pipelines: computePipelines(ctx),
    ghostMrs,
    fridayDeploys: computeFridayDeploys(ctx),
    emoji: computeEmoji(ctx),
    epicMoments: computeEpicMoments(ctx),
    badges: computeBadges(ctx, { languages, ghostMrs }),
    personality: computePersonality(ctx),
    horoscopeSeed: horoscopeSeed(raw.member.username, raw.year),
  };
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * uint32 deterministico da username e anno: seme dell'oroscopo.
 * FNV-1a a 32 bit sui byte UTF-8 di `username + ':' + year`.
 */
export function horoscopeSeed(username: string, year: number): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(`${username}:${year}`)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}
