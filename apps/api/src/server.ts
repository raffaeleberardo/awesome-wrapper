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

export interface ServerDeps {
  source: ActivitySource;
  config: AppConfig;
  logger: Logger;
  compute?: ComputeFns;
}

const ERROR_MAP = {
  bad_request: { status: 400, message: 'Richiesta non valida.' },
  unauthorized: {
    status: 401,
    message:
      'GitLab non accetta il token: è mancante, non valido o scaduto. ' +
      'Controlla GITLAB_TOKEN nel file .env.',
  },
  bot_token: {
    status: 403,
    message:
      'Il token appartiene a un bot (Group o Project Access Token), non a una persona. ' +
      'Crea un Personal Access Token con scope read_api: vedi docs/gitlab-token.md.',
  },
  not_found: {
    status: 404,
    message: "L'utente del token non ha attività leggibili nei gruppi configurati.",
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

  const userCache = new MemoCache<Member>(ttlMs, 1);
  const membersCache = new MemoCache<Member[]>(ttlMs, 1);
  // Un solo utente: una voce per anno richiesto.
  const statsCache = new MemoCache<WrappedStats | null>(ttlMs, 20);

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

  const getCurrentUser = () => userCache.get('me', () => source.currentUser());
  /** Membri dei gruppi: solo per le statistiche social, mai restituiti al client. */
  const getMembers = () => membersCache.get('members', () => source.listMembers());

  /** Statistiche dell'utente del token; `null` se la sorgente non ha attività. */
  const getStats = (username: string, year: number): Promise<WrappedStats | null> =>
    statsCache.get(`${year}:${username}`, async () => {
      const raw = await source.getActivity(username, year);
      if (raw === null) return null;
      const members = await getMembers();
      return compute.computeWrappedStats(raw, members, { timezone: config.timezone });
    });

  const parseYear = (query: unknown): number | null => {
    const parsed = yearQuerySchema.safeParse(query);
    return parsed.success ? (parsed.data.year ?? config.year) : null;
  };

  app.get(API_ROUTES.health, async (_req, reply) =>
    reply.send(
      healthResponseSchema.parse({
        status: 'ok',
        demoMode: config.demoMode,
        year: config.year,
        contractsVersion: CONTRACTS_VERSION,
      }),
    ),
  );

  app.get(API_ROUTES.me, async (req, reply) => {
    const year = parseYear(req.query);
    if (year === null) {
      return sendError(reply, 'bad_request', 'Parametro year non valido.');
    }
    const user = await getCurrentUser();
    const stats = await getStats(user.username, year);
    if (stats === null) return sendError(reply, 'not_found');
    return reply.send(meResponseSchema.parse(stats));
  });

  return app;
}
