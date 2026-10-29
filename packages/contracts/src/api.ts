import { z } from 'zod';
import { year } from './common';
import { wrappedStatsSchema } from './stats';

/** Contratto HTTP tra `apps/web` e `apps/api`. Tutte le risposte sono JSON. */

export const API_ROUTES = {
  health: '/api/health',
  /**
   * Wrapped dell'utente proprietario del token (`GET /user` su GitLab). Query facoltativa
   * `?year=`. Non esiste una rotta per leggere altri utenti: l'app mostra solo chi la avvia.
   */
  me: '/api/me',
} as const;

export const apiPaths = {
  health: () => API_ROUTES.health,
  me: (y?: number) => `${API_ROUTES.me}${y === undefined ? '' : `?year=${y}`}`,
};

/** Query `?year=`: se assente si usa `WRAPPED_YEAR`. */
export const yearQuerySchema = z.object({ year: z.coerce.number().pipe(year).optional() });

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  demoMode: z.boolean(),
  /** Anno di default (`WRAPPED_YEAR`). */
  year,
  contractsVersion: z.number().int(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const meResponseSchema = wrappedStatsSchema;
export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * - `unauthorized`: token mancante, non valido o scaduto (401).
 * - `bot_token`: il token appartiene a un bot (es. Group/Project Access Token): serve un
 *   Personal Access Token, perché il wrapped è di una persona (403).
 * - `not_found`: l'utente del token non ha attività leggibili nei gruppi configurati (404).
 */
export const API_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'bot_token',
  'not_found',
  'rate_limited',
  'upstream_error',
  'internal',
] as const;

/** Corpo delle risposte 4xx/5xx. `message` è in italiano e non contiene mai dati personali. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
