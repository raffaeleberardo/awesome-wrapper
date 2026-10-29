import { afterEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema, meResponseSchema } from '@git-wrapped/contracts';
import { demoMembers } from '@git-wrapped/fixtures';
import { createDemoSource } from '../src/gitlab';
import { createLogger } from '../src/logger';
import { buildServer } from '../src/server';
import { SourceError } from '../src/source';
import { makeApp, makeLogSink, makeSource, testConfig, testMembers } from './helpers';

let current: ReturnType<typeof makeApp> | undefined;
const setup = (...args: Parameters<typeof makeApp>) => (current = makeApp(...args));
afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

describe('rotte', () => {
  it('GET /api/health', async () => {
    const { app } = setup();
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    const body = healthResponseSchema.parse(res.json());
    expect(body).toMatchObject({ demoMode: true, year: 2026, contractsVersion: 3 });
  });

  it('imposta gli header di sicurezza', async () => {
    const { app } = setup();
    const res = await app.inject('/api/health');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /api/me: wrapped del proprietario del token, anno di default e timezone', async () => {
    const { app, compute, source } = setup();
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(200);
    expect(meResponseSchema.parse(res.json()).member.username).toBe('giulia.ferri');
    expect(source.currentUser).toHaveBeenCalledTimes(1);
    expect(source.getActivity).toHaveBeenCalledWith('giulia.ferri', 2026);
    // i membri dei gruppi servono solo alle statistiche social
    expect(compute.computeWrappedStats).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026 }),
      testMembers,
      { timezone: 'Europe/Rome' },
    );
  });

  it('GET /api/me?year= rispetta l anno richiesto', async () => {
    const { app, source } = setup();
    const res = await app.inject('/api/me?year=2025');
    expect(res.statusCode).toBe(200);
    expect(source.getActivity).toHaveBeenCalledWith('giulia.ferri', 2025);
  });

  it('GET /api/me con la sorgente demo restituisce il primo membro del team finto', async () => {
    const sink = makeLogSink();
    const app = buildServer({
      source: createDemoSource(undefined, 'Europe/Rome'),
      config: testConfig,
      logger: createLogger('info', sink.stream),
    });
    try {
      const res = await app.inject('/api/me');
      expect(res.statusCode).toBe(200);
      const body = meResponseSchema.parse(res.json());
      expect(body.member).toEqual(demoMembers[0]);
      expect(body.year).toBe(2026);
    } finally {
      await app.close();
    }
  });

  it.each(['/api/members', '/api/wrapped/giulia.ferri', '/api/team'])(
    'le vecchie rotte non esistono più (%s)',
    async (url) => {
      const { app, source } = setup();
      const res = await app.inject(url);
      expect(res.statusCode).toBe(404);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('not_found');
      expect(source.listMembers).not.toHaveBeenCalled();
      expect(res.body).not.toContain('marco.vitale');
    },
  );
});

describe('errori', () => {
  it('404 not_found se l utente del token non ha attività leggibili', async () => {
    const { app } = setup({ source: makeSource({ getActivity: async () => null }) });
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(404);
    const body = apiErrorSchema.parse(res.json());
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toMatch(/utente del token/);
    expect(res.body).not.toContain('giulia.ferri');
  });

  it('404 sulle rotte inesistenti nel formato ApiError', async () => {
    const { app } = setup();
    const res = await app.inject('/api/boh');
    expect(res.statusCode).toBe(404);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('not_found');
  });

  it.each(['abc', '1999', '2101', '2026.5'])('400 su anno non valido (%s)', async (y) => {
    const { app, source } = setup();
    const res = await app.inject(`/api/me?year=${y}`);
    expect(res.statusCode).toBe(400);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('bad_request');
    expect(source.currentUser).not.toHaveBeenCalled();
  });

  it('401 unauthorized con un messaggio che rimanda a GITLAB_TOKEN', async () => {
    const source = makeSource({
      currentUser: async () => {
        throw new SourceError('unauthorized', 'dettaglio-segreto-xyz');
      },
    });
    const { app } = setup({ source });
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(401);
    const body = apiErrorSchema.parse(res.json());
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toContain('GITLAB_TOKEN');
    expect(res.body).not.toContain('dettaglio-segreto-xyz');
    expect(source.getActivity).not.toHaveBeenCalled();
  });

  it('403 bot_token: serve un Personal Access Token', async () => {
    const source = makeSource({
      currentUser: async () => {
        throw new SourceError('bot_token', 'group_7_bot_abc');
      },
    });
    const { app } = setup({ source });
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(403);
    const body = apiErrorSchema.parse(res.json());
    expect(body.error.code).toBe('bot_token');
    expect(body.error.message).toContain('Personal Access Token');
    expect(body.error.message).toContain('docs/gitlab-token.md');
    expect(res.body).not.toContain('group_7_bot_abc');
    expect(source.getActivity).not.toHaveBeenCalled();
  });

  it.each([
    ['rate_limited', 429, 'rate_limited'],
    ['upstream_error', 502, 'upstream_error'],
    ['unauthorized', 401, 'unauthorized'],
    ['bot_token', 403, 'bot_token'],
  ] as const)(
    'SourceError %s dall attività -> %i senza trapelare il messaggio',
    async (code, status, apiCode) => {
      const source = makeSource({
        getActivity: async () => {
          throw new SourceError(code, 'dettaglio-segreto-xyz');
        },
      });
      const { app } = setup({ source });
      const res = await app.inject('/api/me');
      expect(res.statusCode).toBe(status);
      expect(res.body).not.toContain('dettaglio-segreto-xyz');
      expect(apiErrorSchema.parse(res.json()).error.code).toBe(apiCode);
    },
  );

  it('SourceError dai membri (statistiche social) -> 502', async () => {
    const source = makeSource({
      listMembers: async () => {
        throw new SourceError('upstream_error', 'dettaglio-segreto-xyz');
      },
    });
    const { app } = setup({ source });
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain('dettaglio-segreto-xyz');
  });

  it('errore generico -> 500 internal', async () => {
    const source = makeSource({
      currentUser: async () => {
        throw new Error('boom giulia.ferri');
      },
    });
    const { app, sink } = setup({ source });
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(500);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('internal');
    expect(res.body).not.toContain('boom');
    expect(sink.lines.join('')).not.toContain('giulia.ferri');
  });

  it('500 se la risposta non rispetta lo schema', async () => {
    const { app, compute } = setup();
    compute.computeWrappedStats.mockImplementation(() => ({ member: {} }) as never);
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(500);
  });
});

describe('cache', () => {
  it('la sorgente viene chiamata una volta sola entro il TTL', async () => {
    const { app, source } = setup();
    for (let i = 0; i < 3; i++) {
      expect((await app.inject('/api/me')).statusCode).toBe(200);
    }
    expect(source.currentUser).toHaveBeenCalledTimes(1);
    expect(source.listMembers).toHaveBeenCalledTimes(1);
    expect(source.getActivity).toHaveBeenCalledTimes(1);
  });

  it('deduplica le richieste concorrenti in volo', async () => {
    const { app, source } = setup();
    await Promise.all(Array.from({ length: 5 }, () => app.inject('/api/me')));
    expect(source.currentUser).toHaveBeenCalledTimes(1);
    expect(source.getActivity).toHaveBeenCalledTimes(1);
    expect(source.listMembers).toHaveBeenCalledTimes(1);
  });

  it('anni diversi hanno voci di cache diverse, l utente resta in cache', async () => {
    const { app, source } = setup();
    await app.inject('/api/me?year=2025');
    await app.inject('/api/me?year=2026');
    expect(source.getActivity).toHaveBeenCalledTimes(2);
    expect(source.currentUser).toHaveBeenCalledTimes(1);
  });

  it('gli errori non vengono messi in cache', async () => {
    let fail = true;
    const source = makeSource();
    source.currentUser.mockImplementation(async () => {
      if (fail) throw new SourceError('unauthorized', 'x');
      return { username: 'giulia.ferri', displayName: 'Giulia Ferri' };
    });
    const { app } = setup({ source });
    expect((await app.inject('/api/me')).statusCode).toBe(401);
    fail = false;
    expect((await app.inject('/api/me')).statusCode).toBe(200);
  });
});
