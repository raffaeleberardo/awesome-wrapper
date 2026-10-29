import { z } from 'zod';
import { memberSchema, year } from './common';
import { wrappedStatsSchema } from './stats';
import { teamAwardsSchema } from './team';

/** Contratto HTTP tra `apps/web` e `apps/api`. Tutte le risposte sono JSON. */

export const API_ROUTES = {
  health: '/api/health',
  members: '/api/members',
  /** Parametro di percorso `:username`, query facoltativa `?year=`. */
  wrapped: '/api/wrapped/:username',
  /** Query facoltativa `?year=`. */
  team: '/api/team',
} as const;

export const apiPaths = {
  health: () => API_ROUTES.health,
  members: () => API_ROUTES.members,
  wrapped: (username: string, y?: number) =>
    `/api/wrapped/${encodeURIComponent(username)}${y === undefined ? '' : `?year=${y}`}`,
  team: (y?: number) => `${API_ROUTES.team}${y === undefined ? '' : `?year=${y}`}`,
};

/** Query `?year=`: se assente si usa `WRAPPED_YEAR`. */
export const yearQuerySchema = z.object({ year: z.coerce.number().pipe(year).optional() });
export const wrappedParamsSchema = z.object({ username: z.string().min(1) });

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  demoMode: z.boolean(),
  /** Anno di default (`WRAPPED_YEAR`). */
  year,
  contractsVersion: z.number().int(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const membersResponseSchema = z.object({
  year,
  members: z.array(memberSchema),
});
export type MembersResponse = z.infer<typeof membersResponseSchema>;

export const wrappedResponseSchema = wrappedStatsSchema;
export type WrappedResponse = z.infer<typeof wrappedResponseSchema>;

export const teamResponseSchema = teamAwardsSchema;
export type TeamResponse = z.infer<typeof teamResponseSchema>;

export const API_ERROR_CODES = [
  'bad_request',
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
