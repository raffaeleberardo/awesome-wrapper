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
  /**
   * `POST`: imposta GitLab (URL, gruppo, token) o la demo dalla schermata iniziale, dopo averli
   * verificati con GitLab. `DELETE`: dimentica le impostazioni. Entrambe richiedono
   * l'intestazione `SETTINGS_HEADER`: un altro sito aperto nel browser non può impostarla
   * senza un preflight CORS, che il server non concede.
   */
  settings: '/api/settings',
} as const;

/** Intestazione obbligatoria per le richieste che modificano le impostazioni (anti-CSRF). */
export const SETTINGS_HEADER = 'x-git-wrapped';

export const apiPaths = {
  health: () => API_ROUTES.health,
  settings: () => API_ROUTES.settings,
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
  /** `false` finché non ci sono impostazioni (né da `.env` né dalla schermata iniziale). */
  configured: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Impostazioni dalla schermata iniziale. Il token resta solo nella RAM del server locale.
 * `gitlabUrl`: solo http/https. `group`: facoltativo, vuoto = tutti i gruppi del token.
 */
export const settingsRequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('demo') }),
  z.object({
    mode: z.literal('gitlab'),
    gitlabUrl: z
      .string()
      .trim()
      .max(2048)
      .pipe(z.url({ protocol: /^https?$/, error: 'URL non valido' })),
    group: z.string().trim().max(512).default(''),
    token: z.string().trim().min(1).max(512),
  }),
]);
export type SettingsRequest = z.input<typeof settingsRequestSchema>;

export const settingsResponseSchema = z.object({
  demoMode: z.boolean(),
  /** Nome visualizzato dell'utente del token (in demo: il membro fisso del team finto). */
  displayName: z.string(),
});
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

export const meResponseSchema = wrappedStatsSchema;
export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * - `unauthorized`: token mancante, non valido o scaduto (401).
 * - `bot_token`: il token appartiene a un bot (es. Group/Project Access Token): serve un
 *   Personal Access Token, perché il wrapped è di una persona (403).
 * - `not_found`: l'utente del token non ha attività leggibili nei gruppi configurati (404).
 * - `not_configured`: nessuna impostazione ancora, serve la schermata iniziale (409).
 */
export const API_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'bot_token',
  'not_found',
  'not_configured',
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
