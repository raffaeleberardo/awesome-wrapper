import { z } from 'zod';

/**
 * Cataloghi chiusi. Ogni voce deve avere un testo in `packages/copy` e una regola
 * (badge, personalità, premio) in `packages/stats`. Aggiungere una voce = nuovo tag dei contratti.
 */

export const BADGE_IDS = [
  /** Gufo notturno */
  'night_owl',
  /** Allodola */
  'early_bird',
  /** Distruttore di main */
  'main_breaker',
  /** Approvatore cieco */
  'blind_approver',
  /** Romanziere */
  'novelist',
  /** Monaco silenzioso */
  'silent_monk',
  /** MR fantasma */
  'ghost_mr',
  /** Vive pericolosamente */
  'lives_dangerously',
  /** Marie Kondo */
  'marie_kondo',
  /** Collezionista di TODO */
  'todo_collector',
  /** Necromante */
  'necromancer',
  /** Poliglotta */
  'polyglot',
  /** Re delle reazioni */
  'emoji_overlord',
] as const;
export const badgeIdSchema = z.enum(BADGE_IDS);
export type BadgeId = z.infer<typeof badgeIdSchema>;

export const PERSONALITY_IDS = [
  /** L'Architetto: MR grandi, tanti file, struttura */
  'architect',
  /** Il Pompiere: fix, hotfix, interventi rapidi su main */
  'firefighter',
  /** Il Giardiniere: pota, rifattorizza, cancella */
  'gardener',
  /** Il Diplomatico: review, commenti, approvazioni */
  'diplomat',
  /** Lo Sprinter: tanti commit piccoli e frequenti */
  'sprinter',
  /** Il Filosofo: messaggi e descrizioni lunghe */
  'philosopher',
  /** La Creatura della notte: orari improbabili */
  'night_creature',
  /** Il Metronomo: ritmo regolare, sempre alla stessa ora */
  'metronome',
] as const;
export const personalityIdSchema = z.enum(PERSONALITY_IDS);
export type PersonalityId = z.infer<typeof personalityIdSchema>;

/** Dimensioni su cui si calcola il punteggio della personalità. Ogni punteggio è in [0, 1]. */
export const PERSONALITY_DIMENSIONS = [
  'nocturnality',
  'collaboration',
  'cleanup',
  'changeSize',
  'cadence',
  'verbosity',
  'regularity',
  'urgency',
] as const;
export const personalityDimensionSchema = z.enum(PERSONALITY_DIMENSIONS);
export type PersonalityDimension = z.infer<typeof personalityDimensionSchema>;

export const AWARD_IDS = [
  /** Miglior duetto: la coppia che si è scambiata più review/commenti/emoji */
  'best_duet',
  /** Turno di notte: chi ha fatto il commit più tardi dell'anno */
  'night_shift',
  /** Fenice delle pipeline: più pipeline verdi subito dopo una rossa */
  'pipeline_phoenix',
  /** Emoji dell'anno: l'emoji più usata dal team (vincitore = chi l'ha usata di più) */
  'emoji_of_the_year',
  /** La MR più longeva: aperta da più tempo */
  'marathon_mr',
  /** Premio Hemingway: il messaggio di commit più corto */
  'hemingway',
  /** Premio Tolstoj: il messaggio di commit più lungo */
  'tolstoy',
  /** Spazzino d'oro: più righe cancellate in proporzione a quelle aggiunte */
  'golden_broom',
  /** Coraggio del venerdì: più deploy di venerdì pomeriggio */
  'friday_courage',
  /** Mattiniero del team: il commit più presto dell'anno */
  'first_light',
] as const;
export const awardIdSchema = z.enum(AWARD_IDS);
export type AwardId = z.infer<typeof awardIdSchema>;

/** Card della storia, nell'ordine in cui vengono mostrate. */
export const CARD_IDS = [
  'intro',
  'key_numbers',
  'top_projects',
  'top_files',
  'languages',
  'hours',
  'streak',
  'duet',
  'emoji',
  'commit_messages',
  'pipeline_graveyard',
  'ghost_mrs',
  'friday_deploys',
  'calendar',
  'badges',
  'personality',
  'horoscope',
  'summary',
] as const;
export const cardIdSchema = z.enum(CARD_IDS);
export type CardId = z.infer<typeof cardIdSchema>;

export const EPIC_MOMENT_KINDS = [
  /** Il commit con più righe cambiate */
  'biggest_commit',
  /** Il primo commit dell'anno */
  'first_commit',
  /** L'ultimo commit dell'anno */
  'last_commit',
  /** Il commit più notturno (più vicino alle 4:00) */
  'latest_night_commit',
  /** La MR approvata più in fretta dopo la creazione */
  'fastest_approval',
  /** La MR rimasta aperta più a lungo prima del merge */
  'longest_mr',
  /** Il giorno con più commit */
  'busiest_day',
  /** Il commit più mattiniero dalle 05:00 alle 11:59, in minuti dalla mezzanotte (`contracts-v2`) */
  'earliest_morning_commit',
] as const;
export const epicMomentKindSchema = z.enum(EPIC_MOMENT_KINDS);
export type EpicMomentKind = z.infer<typeof epicMomentKindSchema>;
