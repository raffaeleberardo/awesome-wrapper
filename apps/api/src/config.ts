import { readFileSync } from 'node:fs';
import { z } from 'zod';

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

/** Stringa vuota o di soli spazi = non impostata. */
const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const bool = (key: string, fallback: boolean) =>
  optional.transform((v, ctx) => {
    if (v === undefined) return fallback;
    const value = v.toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(value)) return true;
    if (['false', '0', 'no'].includes(value)) return false;
    ctx.addIssue({ code: 'custom', message: `${key} deve essere true o false.` });
    return z.NEVER;
  });

const int = (key: string, fallback: number, min: number, max: number) =>
  optional.transform((v, ctx) => {
    if (v === undefined) return fallback;
    const value = Number(v);
    if (!Number.isInteger(value) || value < min || value > max) {
      ctx.addIssue({
        code: 'custom',
        message: `${key} deve essere un intero tra ${min} e ${max}.`,
      });
      return z.NEVER;
    }
    return value;
  });

const url = optional.transform((v, ctx) => {
  const value = v ?? 'https://gitlab.com';
  if (!URL.canParse(value)) {
    ctx.addIssue({ code: 'custom', message: 'GITLAB_URL non è un URL valido.' });
    return z.NEVER;
  }
  return value;
});

const timezone = optional.transform((v, ctx) => {
  const tz = v ?? 'Europe/Rome';
  try {
    new Intl.DateTimeFormat('it-IT', { timeZone: tz });
    return tz;
  } catch {
    ctx.addIssue({ code: 'custom', message: 'TZ non è un fuso orario IANA valido.' });
    return z.NEVER;
  }
});

/**
 * Schema dell'ambiente. I messaggi d'errore non contengono mai i valori (token compreso).
 * Con `DEMO_MODE=false` il token è obbligatorio; senza gruppo si leggono tutti i gruppi del token.
 */
const envSchema = z
  .object({
    DEMO_MODE: bool('DEMO_MODE', true),
    GITLAB_URL: url,
    GITLAB_TOKEN: optional,
    GITLAB_GROUP: optional,
    WRAPPED_YEAR: int('WRAPPED_YEAR', 2026, 2000, 2100),
    TZ: timezone,
    CACHE_TTL_MINUTES: int('CACHE_TTL_MINUTES', 15, 1, 1440),
    GITLAB_CA_CERT: optional,
  })
  .superRefine((env, ctx) => {
    if (env.DEMO_MODE || env.GITLAB_TOKEN) return;
    ctx.addIssue({
      code: 'custom',
      message:
        'Con DEMO_MODE=false serve anche: GITLAB_TOKEN. ' +
        'Impostalo nel file .env oppure usa DEMO_MODE=true.',
    });
  });

/**
 * `GITLAB_CA_CERT`: contenuto PEM inline (contiene `-----BEGIN`) oppure percorso di un
 * file leggibile, da montare in sola lettura. Il file viene solo letto, mai scritto.
 */
function readCaCert(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (raw.includes('-----BEGIN')) return raw;
  try {
    return readFileSync(raw, 'utf8');
  } catch {
    // Nessun percorso nel messaggio: potrebbe rivelare la struttura dei segreti montati.
    throw new ConfigError('GITLAB_CA_CERT non è un PEM valido né un file leggibile.');
  }
}

/** Valida l'ambiente con zod e restituisce la configurazione, o lancia `ConfigError`. */
export function loadConfig(env: Env = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues[0]?.message ?? 'Configurazione non valida.');
  }
  const e = parsed.data;
  return {
    demoMode: e.DEMO_MODE,
    gitlabUrl: e.GITLAB_URL,
    gitlabToken: e.GITLAB_TOKEN ?? '',
    gitlabGroup: e.GITLAB_GROUP ?? '',
    year: e.WRAPPED_YEAR,
    timezone: e.TZ,
    cacheTtlMinutes: e.CACHE_TTL_MINUTES,
    gitlabCaCert: e.DEMO_MODE ? undefined : readCaCert(e.GITLAB_CA_CERT),
  };
}
