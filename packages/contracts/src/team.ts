import { z } from 'zod';
import { count, memberSchema, year } from './common';
import { awardIdSchema } from './catalog';

/** Premi di team in stile notte degli Oscar. Ironici, mai classifiche di produttività. */

export const teamAwardSchema = z.object({
  id: awardIdSchema,
  /** Uno o più vincitori (pari merito). Per `best_duet` sempre due. */
  winners: z.array(memberSchema).min(1),
  /** Valore che ha deciso il premio, da inserire nel testo con `{value}`. */
  value: z.number(),
  /** Dettaglio facoltativo da inserire con `{detail}`, es. il nome dell'emoji o il messaggio più corto. */
  detail: z.string().nullable(),
});
export type TeamAward = z.infer<typeof teamAwardSchema>;

export const teamAwardsSchema = z.object({
  schemaVersion: z.literal(1),
  year,
  teamSize: count,
  /** Premi assegnabili: un premio senza dati sufficienti viene omesso, non inventato. */
  awards: z.array(teamAwardSchema),
  /** Totali aggregati del team, senza dettaglio per persona. */
  teamTotals: z.object({
    commits: count,
    mergeRequestsMerged: count,
    pipelines: count,
    emojiGiven: count,
  }),
});
export type TeamAwards = z.infer<typeof teamAwardsSchema>;
