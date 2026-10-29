import { z } from 'zod';

/** Versione dei contratti. Cambia solo con un nuovo tag `contracts-vN`. */
export const CONTRACTS_VERSION = 3 as const;

/** Data e ora ISO 8601 con offset, es. `2026-03-14T23:41:07+01:00` o `...Z`. */
export const isoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof isoDateTime>;

/** Data di calendario ISO, es. `2026-03-14`, nel fuso `TZ` configurato. */
export const isoDate = z.iso.date();
export type IsoDate = z.infer<typeof isoDate>;

export const year = z.number().int().min(2000).max(2100);

/** Username GitLab (senza `@`). */
export const username = z.string().min(1).max(255);

/** Percorso completo di un progetto GitLab, es. `azienda/team/backend`. */
export const projectPath = z.string().min(1);

export const count = z.number().int().nonnegative();
export const ratio = z.number().min(0).max(1);

/** Istogramma per ora del giorno: 24 valori, indice 0 = 00:00–00:59 nel fuso `TZ`. */
export const hourHistogram = z.array(count).length(24);
/** Istogramma per giorno della settimana: 7 valori, indice 0 = lunedì, 6 = domenica. */
export const weekdayHistogram = z.array(count).length(7);
/** Istogramma per mese: 12 valori, indice 0 = gennaio. */
export const monthHistogram = z.array(count).length(12);

export const memberSchema = z.object({
  username,
  /** Nome visualizzato come da profilo GitLab. */
  displayName: z.string().min(1),
});
export type Member = z.infer<typeof memberSchema>;
