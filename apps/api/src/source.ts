import type { Member, RawActivity } from '@git-wrapped/contracts';

/**
 * Confine tra il collettore (A1, `src/gitlab`) e il server (A2).
 * Congelato a `contracts-v1`: entrambi lo importano, nessuno dei due lo modifica.
 */
export interface ActivitySource {
  /** Membri del gruppo (diretti e ereditati), esclusi i bot. */
  listMembers(): Promise<Member[]>;
  /** Attività di un membro per l'anno dato; `null` se lo username non è nel gruppo. */
  getActivity(username: string, year: number): Promise<RawActivity | null>;
}

export interface GitLabSourceConfig {
  /** Es. `https://gitlab.com`. */
  url: string;
  token: string;
  /** Percorso del gruppo, es. `azienda/team`. Vuoto: tutti i gruppi di cui il token è membro. */
  group: string;
  /** Contenuto PEM di una CA aziendale, se serve. */
  caCert?: string;
}

/**
 * Errori che il collettore può lanciare. Il server li traduce in `ApiError`.
 * I messaggi non contengono mai token né username.
 */
export class SourceError extends Error {
  constructor(
    readonly code: 'rate_limited' | 'upstream_error' | 'unauthorized',
    message: string,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}
