import { readFileSync } from 'node:fs';

/** Configurazione letta dalle variabili d'ambiente (vedi tabella in `docs/piano.md`). */
export interface AppConfig {
  demoMode: boolean;
  gitlabUrl: string;
  gitlabToken: string;
  gitlabGroup: string;
  year: number;
  timezone: string;
  cacheTtlMinutes: number;
  /** Contenuto PEM già risolto (da PEM inline o da file), se presente. */
  gitlabCaCert: string | undefined;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

/** Stringa vuota o assente = non impostata. */
function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function readBool(env: Env, key: string, fallback: boolean): boolean {
  const value = read(env, key)?.toLowerCase();
  if (value === undefined) return fallback;
  if (['true', '1', 'yes', 'si'].includes(value)) return true;
  if (['false', '0', 'no'].includes(value)) return false;
  throw new ConfigError(`${key} deve essere true o false.`);
}

function readInt(env: Env, key: string, fallback: number, min: number, max: number): number {
  const raw = read(env, key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${key} deve essere un intero tra ${min} e ${max}.`);
  }
  return value;
}

/**
 * `GITLAB_CA_CERT`: contenuto PEM inline (contiene `-----BEGIN`) oppure percorso di un
 * file leggibile, da montare in sola lettura. Il file viene solo letto, mai scritto.
 */
function readCaCert(env: Env): string | undefined {
  const raw = read(env, 'GITLAB_CA_CERT');
  if (raw === undefined) return undefined;
  if (raw.includes('-----BEGIN')) return raw;
  try {
    return readFileSync(raw, 'utf8');
  } catch {
    // Nessun percorso nel messaggio: potrebbe rivelare la struttura dei segreti montati.
    throw new ConfigError('GITLAB_CA_CERT non è un PEM valido né un file leggibile.');
  }
}

function checkTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat('it-IT', { timeZone: tz });
    return tz;
  } catch {
    throw new ConfigError('TZ non è un fuso orario IANA valido.');
  }
}

/**
 * Valida l'ambiente. Con `DEMO_MODE=false` token e gruppo sono obbligatori.
 * Gli errori non contengono mai il valore del token.
 * (Validazione scritta a mano: `zod` non è tra le dipendenze di `apps/api`,
 * vedi `docs/contract-requests.md`.)
 */
export function loadConfig(env: Env = process.env): AppConfig {
  const demoMode = readBool(env, 'DEMO_MODE', true);
  const gitlabToken = read(env, 'GITLAB_TOKEN') ?? '';
  const gitlabGroup = read(env, 'GITLAB_GROUP') ?? '';
  if (!demoMode) {
    const missing = [
      gitlabToken ? null : 'GITLAB_TOKEN',
      gitlabGroup ? null : 'GITLAB_GROUP',
    ].filter((k): k is string => k !== null);
    if (missing.length > 0) {
      throw new ConfigError(
        `Con DEMO_MODE=false servono anche: ${missing.join(', ')}. ` +
          'Impostali nel file .env oppure usa DEMO_MODE=true.',
      );
    }
  }
  const gitlabUrl = read(env, 'GITLAB_URL') ?? 'https://gitlab.com';
  try {
    new URL(gitlabUrl);
  } catch {
    throw new ConfigError('GITLAB_URL non è un URL valido.');
  }
  return {
    demoMode,
    gitlabUrl,
    gitlabToken,
    gitlabGroup,
    year: readInt(env, 'WRAPPED_YEAR', 2026, 2000, 2100),
    timezone: checkTimezone(read(env, 'TZ') ?? 'Europe/Rome'),
    cacheTtlMinutes: readInt(env, 'CACHE_TTL_MINUTES', 15, 1, 1440),
    gitlabCaCert: demoMode ? undefined : readCaCert(env),
  };
}
