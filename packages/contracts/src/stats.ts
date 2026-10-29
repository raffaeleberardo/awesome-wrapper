import { z } from 'zod';
import {
  count,
  hourHistogram,
  isoDate,
  isoDateTime,
  memberSchema,
  monthHistogram,
  projectPath,
  ratio,
  weekdayHistogram,
  year,
} from './common';
import {
  badgeIdSchema,
  epicMomentKindSchema,
  personalityDimensionSchema,
  personalityIdSchema,
} from './catalog';

/** Statistiche annuali di una persona, prodotte da `computeWrappedStats` in `packages/stats`. */

export const totalsSchema = z.object({
  commits: count,
  linesAdded: count,
  linesDeleted: count,
  mergeRequestsOpened: count,
  mergeRequestsMerged: count,
  approvalsGiven: count,
  notesWritten: count,
  pipelines: count,
  pipelinesFailed: count,
  deployments: count,
  issuesOpened: count,
  issuesClosed: count,
  emojiGiven: count,
  emojiReceived: count,
  projectsTouched: count,
  /** Giorni con almeno un'attività (commit, MR, note, approvazioni). */
  activeDays: count,
});
export type Totals = z.infer<typeof totalsSchema>;

export const topProjectSchema = z.object({ projectPath, commits: count, share: ratio });
export const topFileSchema = z.object({ path: z.string(), projectPath, touches: count });
export const languageShareSchema = z.object({ name: z.string(), share: ratio });

export const streakSchema = z.object({
  /** Giorni consecutivi con almeno un commit. 0 se nessun commit. */
  longestDays: count,
  from: isoDate.nullable(),
  to: isoDate.nullable(),
});

export const duetSchema = z.object({
  partner: memberSchema,
  /** Interazioni totali nei due sensi. */
  interactions: count,
  via: z.object({
    approvals: count,
    reviews: count,
    notes: count,
    emoji: count,
  }),
});
export type Duet = z.infer<typeof duetSchema>;

export const wordCountSchema = z.object({ word: z.string(), count });

export const commitMessagesSchema = z.object({
  averageLength: z.number().nonnegative(),
  /** Messaggio più corto (prima riga), `null` se nessun commit. */
  shortest: z.string().nullable(),
  longestLength: count,
  /** Fino a 10 parole più frequenti, stopword italiane e inglesi escluse. */
  topWords: z.array(wordCountSchema).max(10),
  /** Messaggi che contengono "fix" (case-insensitive). */
  fixCount: count,
  /** Messaggi che contengono "wip". */
  wipCount: count,
  /** Messaggi che contengono almeno un'emoji o uno shortcode `:emoji:`. */
  emojiCount: count,
});

export const pipelineStatsSchema = z.object({
  total: count,
  failed: count,
  /** `null` se nessuna pipeline. */
  successRate: ratio.nullable(),
  longestFailStreak: count,
  /**
   * Pipeline `success` subito dopo una `failed` sullo stesso progetto e ref, in ordine
   * cronologico (premio Fenice delle pipeline). Aggiunto in `contracts-v2`: assente = 0.
   */
  recoveries: count.default(0),
  /** Fino a 3 lapidi: le pipeline fallite più memorabili. */
  graveyard: z.array(z.object({ projectPath, ref: z.string(), failedAt: isoDateTime })).max(3),
});

export const ghostMrStatsSchema = z.object({
  /** MR aperte senza aggiornamenti da più di 30 giorni a fine anno, più quelle chiuse senza merge. */
  count,
  /** Età in giorni della MR fantasma più antica; `null` se nessuna. */
  oldestDays: count.nullable(),
});

export const fridayDeploySchema = z.object({
  /** Deploy (o pipeline su default branch) del venerdì dalle 14:00 in poi, nel fuso `TZ`. */
  count,
  latestAt: isoDateTime.nullable(),
});

export const emojiStatsSchema = z.object({
  topGiven: z.array(z.object({ name: z.string(), count })).max(5),
  topReceived: z.array(z.object({ name: z.string(), count })).max(5),
});

export const epicMomentSchema = z.object({
  kind: epicMomentKindSchema,
  at: isoDateTime,
  /** Valore numerico del momento (righe, minuti, commit...). Unità implicita nel `kind`. */
  value: z.number(),
  projectPath: projectPath.nullable(),
});
export type EpicMoment = z.infer<typeof epicMomentSchema>;

export const earnedBadgeSchema = z.object({
  id: badgeIdSchema,
  /** Metrica che ha fatto scattare il badge, da inserire nel testo con `{value}`. */
  value: z.number(),
});
export type EarnedBadge = z.infer<typeof earnedBadgeSchema>;

export const personalityResultSchema = z.object({
  id: personalityIdSchema,
  scores: z.record(personalityDimensionSchema, z.number().min(0).max(1)),
});

export const wrappedStatsSchema = z.object({
  schemaVersion: z.literal(1),
  member: memberSchema,
  year,
  /** Fuso IANA usato per orari e giorni, es. `Europe/Rome`. */
  timezone: z.string(),
  totals: totalsSchema,
  topProjects: z.array(topProjectSchema).max(5),
  topFiles: z.array(topFileSchema).max(5),
  /** Linguaggi ordinati per quota decrescente; la somma delle quote è ≤ 1. */
  languages: z.array(languageShareSchema).max(8),
  hours: hourHistogram,
  weekdays: weekdayHistogram,
  months: monthHistogram,
  /** Ora più attiva (0–23), `null` se nessuna attività. */
  peakHour: z.number().int().min(0).max(23).nullable(),
  /** Giorno più attivo (0 = lunedì), `null` se nessuna attività. */
  peakWeekday: z.number().int().min(0).max(6).nullable(),
  streak: streakSchema,
  duet: duetSchema.nullable(),
  commitMessages: commitMessagesSchema,
  pipelines: pipelineStatsSchema,
  ghostMrs: ghostMrStatsSchema,
  fridayDeploys: fridayDeploySchema,
  emoji: emojiStatsSchema,
  epicMoments: z.array(epicMomentSchema),
  badges: z.array(earnedBadgeSchema),
  /** Sempre presente: ogni persona ha una personalità. */
  personality: personalityResultSchema,
  /** uint32 deterministico da hash(username + anno): sceglie le frasi dell'oroscopo. */
  horoscopeSeed: z.number().int().min(0).max(0xffffffff),
});
export type WrappedStats = z.infer<typeof wrappedStatsSchema>;
