import type { RawActivity, TeamAwards, WrappedStats } from '@git-wrapped/contracts';

/**
 * API pubblica del motore statistiche. Le firme sono congelate a `contracts-v1`;
 * l'implementazione è di A3. Funzioni pure: nessun I/O, nessun accesso a `process.env`.
 */

export interface ComputeOptions {
  /** Fuso IANA per orari e giorni. Default `Europe/Rome`. */
  timezone?: string;
}

export const DEFAULT_TIMEZONE = 'Europe/Rome';

/**
 * `RawActivity` → `WrappedStats`.
 * `teamMembers` serve a risolvere il nome visualizzato del partner del "duetto".
 */
export function computeWrappedStats(
  _raw: RawActivity,
  _teamMembers: RawActivity['member'][],
  _options: ComputeOptions = {},
): WrappedStats {
  throw new Error('computeWrappedStats: non ancora implementato (A3)');
}

/** `WrappedStats[]` dell'intero team → premi della notte degli Oscar. */
export function computeTeamAwards(_stats: WrappedStats[], _year: number): TeamAwards {
  throw new Error('computeTeamAwards: non ancora implementato (A3)');
}

/** uint32 deterministico da username e anno: seme dell'oroscopo. */
export function horoscopeSeed(_username: string, _year: number): number {
  throw new Error('horoscopeSeed: non ancora implementato (A3)');
}
