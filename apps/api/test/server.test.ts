import { afterEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  healthResponseSchema,
  membersResponseSchema,
  teamResponseSchema,
  wrappedResponseSchema,
} from '@git-wrapped/contracts';
import { SourceError } from '../src/source';
import { makeApp, makeSource } from './helpers';

let current: ReturnType<typeof makeApp> | undefined;
const setup = (...args: Parameters<typeof makeApp>) => (current = makeApp(...args));
afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

describe('rotte in demo mode', () => {
  it('GET /api/health', async () => {
    const { app } = setup();
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    const body = healthResponseSchema.parse(res.json());
    expect(body).toMatchObject({ demoMode: true, year: 2026 });
  });

  it('imposta gli header di sicurezza', async () => {
    const { app } = setup();
    const res = await app.inject('/api/health');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /api/members', async () => {
    const { app } = setup();
    const res = await app.inject('/api/members');
    expect(res.statusCode).toBe(200);
    expect(membersResponseSchema.parse(res.json()).members).toHaveLength(2);
  });

  it('GET /api/wrapped/:username usa anno di default e timezone', async () => {
    const { app, compute } = setup();
    const res = await app.inject('/api/wrapped/giulia.ferri');
    expect(res.statusCode).toBe(200);
    expect(wrappedResponseSchema.parse(res.json()).member.username).toBe('giulia.ferri');
    expect(compute.computeWrappedStats).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026 }),
      expect.any(Array),
      { timezone: 'Europe/Rome' },
    );
  });

  it('GET /api/wrapped/:username?year= rispetta l anno richiesto', async () => {
    const { app, source } = setup();
    const res = await app.inject('/api/wrapped/giulia.ferri?year=2025');
    expect(res.statusCode).toBe(200);
    expect(source.getActivity).toHaveBeenCalledWith('giulia.ferri', 2025);
  });

  it('GET /api/team calcola su tutti i membri', async () => {
    const { app, compute, source } = setup();
    const res = await app.inject('/api/team');
    expect(res.statusCode).toBe(200);
    teamResponseSchema.parse(res.json());
    expect(source.getActivity).toHaveBeenCalledTimes(2);
    expect(compute.computeTeamAwards).toHaveBeenCalledWith(expect.any(Array), 2026);
    expect(compute.computeTeamAwards.mock.calls[0]?.[0]).toHaveLength(2);
  });
});

describe('errori', () => {
  it('404 not_found se lo username non è membro', async () => {
    const { app, source } = setup();
    const res = await app.inject('/api/wrapped/sconosciuto');
    expect(res.statusCode).toBe(404);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('not_found');
    expect(source.getActivity).not.toHaveBeenCalled();
  });

  it('404 sulle rotte inesistenti nel formato ApiError', async () => {
    const { app } = setup();
    const res = await app.inject('/api/boh');
    expect(res.statusCode).toBe(404);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('not_found');
  });

  it.each(['abc', '1999', '2101', '2026.5'])('400 su anno non valido (%s)', async (y) => {
    const { app } = setup();
    for (const url of [`/api/wrapped/giulia.ferri?year=${y}`, `/api/team?year=${y}`]) {
      const res = await app.inject(url);
      expect(res.statusCode).toBe(400);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('bad_request');
    }
  });

  it.each([
    ['rate_limited', 429],
    ['upstream_error', 502],
    ['unauthorized', 502],
  ] as const)('SourceError %s -> %i senza trapelare il messaggio', async (code, status) => {
    const source = makeSource({
      listMembers: async () => {
        throw new SourceError(code, 'dettaglio-segreto-xyz');
      },
    });
    const { app } = setup({ source });
    const res = await app.inject('/api/members');
    expect(res.statusCode).toBe(status);
    expect(res.body).not.toContain('dettaglio-segreto-xyz');
    expect(apiErrorSchema.parse(res.json()).error.code).toBe(
      code === 'rate_limited' ? 'rate_limited' : 'upstream_error',
    );
  });

  it('errore generico -> 500 internal', async () => {
    const source = makeSource({
      listMembers: async () => {
        throw new Error('boom giulia.ferri');
      },
    });
    const { app, sink } = setup({ source });
    const res = await app.inject('/api/members');
    expect(res.statusCode).toBe(500);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('internal');
    expect(res.body).not.toContain('boom');
    expect(sink.lines.join('')).not.toContain('giulia.ferri');
  });

  it('500 se la risposta non rispetta lo schema', async () => {
    const source = makeSource({ listMembers: async () => [{ username: '' } as never] });
    const { app } = setup({ source });
    const res = await app.inject('/api/members');
    expect(res.statusCode).toBe(500);
  });
});

describe('cache', () => {
  it('la sorgente viene chiamata una volta sola entro il TTL', async () => {
    const { app, source } = setup();
    for (let i = 0; i < 3; i++) {
      await app.inject('/api/members');
      await app.inject('/api/wrapped/giulia.ferri');
      await app.inject('/api/team');
    }
    expect(source.listMembers).toHaveBeenCalledTimes(1);
    expect(source.getActivity).toHaveBeenCalledTimes(2); // una per membro
  });

  it('deduplica le richieste concorrenti in volo', async () => {
    const { app, source } = setup();
    await Promise.all(Array.from({ length: 5 }, () => app.inject('/api/wrapped/giulia.ferri')));
    expect(source.getActivity).toHaveBeenCalledTimes(1);
    expect(source.listMembers).toHaveBeenCalledTimes(1);
  });

  it('anni diversi hanno voci di cache diverse', async () => {
    const { app, source } = setup();
    await app.inject('/api/wrapped/giulia.ferri?year=2025');
    await app.inject('/api/wrapped/giulia.ferri?year=2026');
    expect(source.getActivity).toHaveBeenCalledTimes(2);
  });

  it('gli errori non vengono messi in cache', async () => {
    let fail = true;
    const source = makeSource();
    source.listMembers.mockImplementation(async () => {
      if (fail) throw new SourceError('upstream_error', 'x');
      return [{ username: 'giulia.ferri', displayName: 'Giulia Ferri' }];
    });
    const { app } = setup({ source });
    expect((await app.inject('/api/members')).statusCode).toBe(502);
    fail = false;
    expect((await app.inject('/api/members')).statusCode).toBe(200);
  });
});
