import {
  apiErrorSchema,
  apiPaths,
  healthResponseSchema,
  membersResponseSchema,
  teamResponseSchema,
  wrappedResponseSchema,
  type HealthResponse,
  type MembersResponse,
  type TeamResponse,
  type WrappedResponse,
} from '@git-wrapped/contracts';
import type { z } from 'zod';

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

async function getJson<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' }, signal });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : 'internal';
    const message = parsed.success ? parsed.data.error.message : `HTTP ${res.status}`;
    throw new ApiRequestError(res.status, code, message);
  }
  return schema.parse(body);
}

export const api = {
  health: (signal?: AbortSignal): Promise<HealthResponse> =>
    getJson(apiPaths.health(), healthResponseSchema, signal),
  members: (signal?: AbortSignal): Promise<MembersResponse> =>
    getJson(apiPaths.members(), membersResponseSchema, signal),
  wrapped: (username: string, year?: number, signal?: AbortSignal): Promise<WrappedResponse> =>
    getJson(apiPaths.wrapped(username, year), wrappedResponseSchema, signal),
  team: (year?: number, signal?: AbortSignal): Promise<TeamResponse> =>
    getJson(apiPaths.team(year), teamResponseSchema, signal),
};
