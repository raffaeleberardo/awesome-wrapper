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
  membersResponseSchema,
  teamResponseSchema,
  wrappedParamsSchema,
  wrappedResponseSchema,
  yearQuerySchema,
  type ApiError,
  type Member,
  type RawActivity,
  type TeamAwards,
  type WrappedStats,
} from '@git-wrapped/contracts';
import { computeTeamAwards, computeWrappedStats } from '@git-wrapped/stats';
import { MemoCache, mapLimit } from './cache';
import type { AppConfig } from './config';
import { SourceError, type ActivitySource } from './source';

/** Funzioni di calcolo iniettabili (default: `@git-wrapped/stats`). */
export interface ComputeFns {
  computeWrappedStats: (
    raw: RawActivity,
    teamMembers: RawActivity['member'][],
    options?: { timezone?: string },
  ) => WrappedStats;
  computeTeamAwards: (stats: WrappedStats[], year: number) => TeamAwards;
}

export interface ServerDeps {
  source: ActivitySource;
  config: AppConfig;
  logger: Logger;
  compute?: ComputeFns;
}

/** Quante richieste verso la sorgente girano in parallelo quando si calcola il team. */
const TEAM_CONCURRENCY = 4;

const ERROR_MAP = {
  bad_request: { status: 400, message: 'Richiesta non valida.' },
  not_found: { status: 404, message: 'Questa persona non fa parte del gruppo.' },
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
    return err.code === 'rate_limited' ? 'rate_limited' : 'upstream_error';
  }
  return 'internal';
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const { source, config, logger } = deps;
  const compute: ComputeFns = deps.compute ?? { computeWrappedStats, computeTeamAwards };
  const ttlMs = config.cacheTtlMinutes * 60_000;

  const membersCache = new MemoCache<Member[]>(ttlMs, 1);
  const statsCache = new MemoCache<WrappedStats | null>(ttlMs);
  const teamCache = new MemoCache<TeamAwards>(ttlMs, 20);

  // Il request logging automatico di Fastify è spento: loggherebbe l'URL reale
  // (con lo username). Sotto si registra solo metodo, pattern di rotta, status e durata.
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

  const getMembers = () => membersCache.get('members', () => source.listMembers());

  /** Statistiche di un membro già verificato; `null` se la sorgente non ha attività. */
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

  app.get(API_ROUTES.members, async (_req, reply) =>
    reply.send(membersResponseSchema.parse({ year: config.year, members: await getMembers() })),
  );

  app.get(API_ROUTES.wrapped, async (req, reply) => {
    const params = wrappedParamsSchema.safeParse(req.params);
    const year = parseYear(req.query);
    if (!params.success || year === null) {
      return sendError(reply, 'bad_request', 'Parametri non validi: controlla username e anno.');
    }
    // La verifica di appartenenza avviene prima della cache delle statistiche,
    // così username inventati non occupano spazio.
    const members = await getMembers();
    if (!members.some((m) => m.username === params.data.username)) {
      return sendError(reply, 'not_found');
    }
    const stats = await getStats(params.data.username, year);
    if (stats === null) return sendError(reply, 'not_found');
    return reply.send(wrappedResponseSchema.parse(stats));
  });

  app.get(API_ROUTES.team, async (req, reply) => {
    const year = parseYear(req.query);
    if (year === null) {
      return sendError(reply, 'bad_request', 'Parametro year non valido.');
    }
    const awards = await teamCache.get(String(year), async () => {
      const members = await getMembers();
      const all = await mapLimit(members, TEAM_CONCURRENCY, (m) => getStats(m.username, year));
      const stats = all.filter((s): s is WrappedStats => s !== null);
      return compute.computeTeamAwards(stats, year);
    });
    return reply.send(teamResponseSchema.parse(awards));
  });

  return app;
}
