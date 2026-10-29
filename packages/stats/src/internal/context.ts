import type {
  RawActivity,
  RawApprovalGiven,
  RawCommit,
  RawDeployment,
  RawEmojiGiven,
  RawEmojiReceived,
  RawIssueEvent,
  RawMergeRequest,
  RawNote,
  RawPipeline,
  RawPushEvent,
} from '@git-wrapped/contracts';
import { assertTimezone, parseInstant, yearBounds, zonedParts, type ZonedParts } from './time';

/**
 * Contesto di calcolo: l'attività grezza filtrata sull'anno raccontato (nel fuso dato),
 * con ogni evento già scomposto in ora/giorno locali e ordinato nel tempo.
 */

export interface Timed<T> {
  item: T;
  at: ZonedParts;
}

export interface ActivityContext {
  raw: RawActivity;
  year: number;
  timezone: string;
  /** Inizio dell'anno nel fuso (ms, incluso). */
  yearStart: number;
  /** Fine dell'anno nel fuso (ms, esclusa): è il "presente" del racconto. */
  yearEnd: number;
  /** Tutti i commit dell'anno, merge compresi. */
  commits: Timed<RawCommit>[];
  /** Commit dell'anno esclusi i merge: base per righe, file, messaggi e TODO. */
  authoredCommits: Timed<RawCommit>[];
  /** MR create nell'anno. */
  mergeRequests: Timed<RawMergeRequest>[];
  approvalsGiven: Timed<RawApprovalGiven>[];
  pipelines: Timed<RawPipeline>[];
  deployments: Timed<RawDeployment>[];
  notes: Timed<RawNote>[];
  emojiGiven: Timed<RawEmojiGiven>[];
  emojiReceived: Timed<RawEmojiReceived>[];
  issueEvents: Timed<RawIssueEvent>[];
  pushEvents: Timed<RawPushEvent>[];
  /** Zona di un istante qualsiasi nel fuso del contesto. */
  zone: (epoch: number) => ZonedParts;
}

export function buildContext(raw: RawActivity, timezone: string): ActivityContext {
  assertTimezone(timezone);
  const { start, end } = yearBounds(raw.year, timezone);
  const zone = (epoch: number) => zonedParts(epoch, timezone);

  function pick<T>(items: readonly T[], when: (item: T) => string): Timed<T>[] {
    const out: Timed<T>[] = [];
    for (const item of items) {
      const t = parseInstant(when(item));
      if (t === null || t < start || t >= end) continue;
      out.push({ item, at: zone(t) });
    }
    // Ordinamento stabile: a parità di istante resta l'ordine d'origine.
    return out.sort((a, b) => a.at.epoch - b.at.epoch);
  }

  const commits = pick(raw.commits, (c) => c.authoredAt);
  return {
    raw,
    year: raw.year,
    timezone,
    yearStart: start,
    yearEnd: end,
    commits,
    authoredCommits: commits.filter((c) => !c.item.isMerge),
    mergeRequests: pick(raw.mergeRequests, (m) => m.createdAt),
    approvalsGiven: pick(raw.approvalsGiven, (a) => a.approvedAt),
    pipelines: pick(raw.pipelines, (p) => p.createdAt),
    deployments: pick(raw.deployments, (d) => d.createdAt),
    notes: pick(raw.notes, (n) => n.createdAt),
    emojiGiven: pick(raw.emojiGiven, (e) => e.awardedAt),
    emojiReceived: pick(raw.emojiReceived, (e) => e.awardedAt),
    issueEvents: pick(raw.issueEvents, (e) => e.at),
    pushEvents: pick(raw.pushEvents, (e) => e.at),
    zone,
  };
}

/** Commit notturni: dalle 22:00 alle 04:59 (ora locale). */
export function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 5;
}

/** Commit all'alba: dalle 05:00 alle 08:29 (ora locale). */
export function isEarlyMinute(minuteOfDay: number): boolean {
  return minuteOfDay >= 5 * 60 && minuteOfDay < 8 * 60 + 30;
}
