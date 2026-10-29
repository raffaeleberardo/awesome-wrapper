import {
  apiErrorSchema,
  apiPaths,
  healthResponseSchema,
  meResponseSchema,
  SETTINGS_HEADER,
  settingsResponseSchema,
  type HealthResponse,
  type MeResponse,
  type SettingsRequest,
  type SettingsResponse,
} from '@git-wrapped/contracts';
import { z } from 'zod';

/** Client HTTP verso `/api`, stesso dominio (CSP `connect-src 'self'`). Valida ogni risposta. */

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Esegue la richiesta e valida la risposta; senza `schema` si aspetta un corpo vuoto (204). */
async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { accept: 'application/json', ...init.headers },
  });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : 'internal';
    const message = parsed.success ? parsed.data.error.message : `HTTP ${res.status}`;
    throw new ApiRequestError(res.status, code, message);
  }
  return schema.parse(body);
}

const getJson = <T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) =>
  request(path, schema, { signal });

/** Le richieste che cambiano le impostazioni portano l'intestazione anti-CSRF. */
const settingsHeaders = { [SETTINGS_HEADER]: '1' };

export const api = {
  health: (signal?: AbortSignal): Promise<HealthResponse> =>
    getJson(apiPaths.health(), healthResponseSchema, signal),
  /** Wrapped del proprietario del token GitLab, rilevato dal server. */
  me: (year?: number, signal?: AbortSignal): Promise<MeResponse> =>
    getJson(apiPaths.me(year), meResponseSchema, signal),
  /** Imposta GitLab (verificato subito dal server) o la demo. Il token va solo al server locale. */
  saveSettings: (settings: SettingsRequest, signal?: AbortSignal): Promise<SettingsResponse> =>
    request(apiPaths.settings(), settingsResponseSchema, {
      method: 'POST',
      headers: { ...settingsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(settings),
      signal,
    }),
  /** Dimentica le impostazioni sul server. */
  clearSettings: (): Promise<null> =>
    request(apiPaths.settings(), z.null(), { method: 'DELETE', headers: settingsHeaders }),
};
