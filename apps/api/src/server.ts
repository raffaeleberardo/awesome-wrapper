import Fastify, {
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyReply,
} from 'fastify';
import type { Logger } from 'pino';
import {
  API_ROUTES,
  CONTRACTS_VERSION,
  healthResponseSchema,
  meResponseSchema,
  SETTINGS_HEADER,
  settingsRequestSchema,
  settingsResponseSchema,
  yearQuerySchema,
  type ApiError,
  type Member,
  type RawActivity,
  type WrappedStats,
} from '@git-wrapped/contracts';
import { computeWrappedStats } from '@git-wrapped/stats';
import { MemoCache } from './cache';
import type { AppConfig } from './config';
import { SourceError, type ActivitySource } from './source';

/** Funzioni di calcolo iniettabili (default: `@git-wrapped/stats`). */
export interface ComputeFns {
  computeWrappedStats: (
    raw: RawActivity,
    teamMembers: RawActivity['member'][],
    options?: { timezone?: string },
  ) => WrappedStats;
}

/** Impostazioni scelte dalla schermata iniziale, già validate e normalizzate. */
export type SourceSettings =
  { mode: 'demo' } | { mode: 'gitlab'; url: string; group: string; token: string };

export interface ServerDeps {
  /** Sorgente iniziale, dal `.env`. `null`: si imposta dalla schermata iniziale. */
  source: ActivitySource | null;
  /** Crea la sorgente per le impostazioni della schermata iniziale (`POST /api/settings`). */
  createSource: (settings: SourceSettings) => ActivitySource;
  config: AppConfig;
  logger: Logger;
  compute?: ComputeFns;
}

const ERROR_MAP = {
  bad_request: { status: 400, message: 'Richiesta non valida.' },
  unauthorized: {
    status: 401,
    message: 'GitLab non accetta il token: è mancante, non valido o scaduto.',
  },
  bot_token: {
    status: 403,
    message:
      'Il token appartiene a un bot (Group o Project Access Token), non a una persona. ' +
      'Crea un Personal Access Token con scope read_api.',
  },
  not_found: {
    status: 404,
    message: "L'utente del token non ha attività leggibili nei gruppi configurati.",
  },
  not_configured: {
    status: 409,
    message: 'Imposta GitLab e token dalla schermata iniziale.',
  },
  rate_limited: {
    status: 429,
    message: 'GitLab sta limitando le richieste: riprova tra qualche minuto.',
  },
  upstream_error: {
    status: 502,
    message: 'GitLab non risponde come previsto: riprova più tardi.',
  },
  internal: { status: 500, message: 'Qualcosa è andato storto sul server.' },
} as const;

type ErrorCode = keyof typeof ERROR_MAP;

function sendError(reply: FastifyReply, code: ErrorCode, message?: string): FastifyReply {
  const body: ApiError = { error: { code, message: message ?? ERROR_MAP[code].message } };
  return reply.code(ERROR_MAP[code].status).send(body);
}

/** Traduce un errore in un codice `ApiError`; il messaggio originale non esce mai. */
function classify(err: unknown): ErrorCode {
  if (err instanceof SourceError) {
    switch (err.code) {
      case 'unauthorized':
      case 'bot_token':
      case 'rate_limited':
        return err.code;
      default:
        return 'upstream_error';
    }
  }
  return 'internal';
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const { source, config, logger } = deps;
  const compute: ComputeFns = deps.compute ?? { computeWrappedStats };
  const ttlMs = config.cacheTtlMinutes * 60_000;

  /**
   * Sorgente attiva con le sue cache. Cambiare impostazioni crea una sessione nuova, così nessun
   * dato letto con il token precedente sopravvive. Un solo utente: l'app gira in locale.
   */
  const newSession = (src: ActivitySource, demoMode: boolean) => {
    const userCache = new MemoCache<Member>(ttlMs, 1);
    const membersCache = new MemoCache<Member[]>(ttlMs, 1);
    // Un solo utente: una voce per anno richiesto.
    const statsCache = new MemoCache<WrappedStats | null>(ttlMs, 20);
    const user = () => userCache.get('me', () => src.currentUser());
    /** Membri dei gruppi: solo per le statistiche social, mai restituiti al client. */
    const members = () => membersCache.get('members', () => src.listMembers());
    /** Statistiche dell'utente del token; `null` se la sorgente non ha attività. */
    const stats = (username: string, year: number): Promise<WrappedStats | null> =>
      statsCache.get(`${year}:${username}`, async () => {
        const raw = await src.getActivity(username, year);
        if (raw === null) return null;
        return compute.computeWrappedStats(raw, await members(), { timezone: config.timezone });
      });
    return { demoMode, user, members, stats };
  };
  type Session = ReturnType<typeof newSession>;
  let session: Session | null = source ? newSession(source, config.demoMode) : null;

  // Il request logging automatico di Fastify è spento: loggherebbe l'URL reale (con la
  // query). Sotto si registra solo metodo, pattern di rotta, status e durata.
  const app = Fastify({
    loggerInstance: logger as FastifyBaseLogger,
    logController: new LogController({ disableRequestLogging: true }),
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
  });

  app.addHook('onResponse', async (req, reply) => {
    req.log.info(
      {
        method: req.method,
        route: req.routeOptions.url ?? 'non-corrispondente',
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
      'richiesta',
    );
  });

  app.setNotFoundHandler((_req, reply) => sendError(reply, 'not_found', 'Risorsa non trovata.'));

  app.setErrorHandler((err, req, reply) => {
    const code = classify(err);
    // Solo il codice: il messaggio dell'errore potrebbe contenere dati personali.
    req.log.error({ code }, 'errore');
    return sendError(reply, code);
  });

  const parseYear = (query: unknown): number | null => {
    const parsed = yearQuerySchema.safeParse(query);
    return parsed.success ? (parsed.data.year ?? config.year) : null;
  };

  app.get(API_ROUTES.health, async (_req, reply) =>
    reply.send(
      healthResponseSchema.parse({
        status: 'ok',
        demoMode: session?.demoMode ?? false,
        year: config.year,
        contractsVersion: CONTRACTS_VERSION,
        configured: session !== null,
      }),
    ),
  );

  app.get(API_ROUTES.me, async (req, reply) => {
    const year = parseYear(req.query);
    if (year === null) {
      return sendError(reply, 'bad_request', 'Parametro year non valido.');
    }
    // Sessione fissata all'inizio: se le impostazioni cambiano a metà, la risposta resta coerente.
    const current = session;
    if (!current) return sendError(reply, 'not_configured');
    const user = await current.user();
    const stats = await current.stats(user.username, year);
    if (stats === null) return sendError(reply, 'not_found');
    return reply.send(meResponseSchema.parse(stats));
  });

  /** Solo la pagina dell'app può impostarla: un altro sito non ottiene il preflight CORS. */
  const fromApp = (headers: Record<string, unknown>) => headers[SETTINGS_HEADER] === '1';

  app.post(API_ROUTES.settings, async (req, reply) => {
    if (!fromApp(req.headers)) return sendError(reply, 'bad_request', 'Richiesta non consentita.');
    const parsed = settingsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        reply,
        'bad_request',
        'Controlla i campi: serve un indirizzo http(s) di GitLab e un token.',
      );
    }
    const body = parsed.data;
    const settings: SourceSettings =
      body.mode === 'demo'
        ? { mode: 'demo' }
        : {
            mode: 'gitlab',
            url: body.gitlabUrl.replace(/\/+$/, ''),
            group: body.group.replace(/^\/+|\/+$/g, ''),
            token: body.token,
          };
    const next = newSession(deps.createSource(settings), settings.mode === 'demo');

    // Verifica subito con GitLab: errori chiari qui invece che a metà caricamento.
    let user: Member;
    try {
      user = await next.user();
    } catch (err) {
      if (classify(err) !== 'upstream_error') throw err;
      return sendError(
        reply,
        'upstream_error',
        'Non riesco a parlare con GitLab a questo indirizzo: controlla l’URL.',
      );
    }
    if (settings.mode === 'gitlab' && settings.group) {
      try {
        await next.members();
      } catch (err) {
        if (classify(err) !== 'upstream_error') throw err;
        return sendError(reply, 'not_found', 'Gruppo non trovato, o il token non può leggerlo.');
      }
    }
    session = next;
    return reply.send(
      settingsResponseSchema.parse({ demoMode: next.demoMode, displayName: user.displayName }),
    );
  });

  app.delete(API_ROUTES.settings, async (req, reply) => {
    if (!fromApp(req.headers)) return sendError(reply, 'bad_request', 'Richiesta non consentita.');
    session = null;
    return reply.code(204).send();
  });

  return app;
}
