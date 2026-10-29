import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema, SETTINGS_HEADER } from '@git-wrapped/contracts';
import { SourceError } from '../src/source';
import { makeApp, makeSource } from './helpers';

const TOKEN = 'glpat-CANARINO-schermata-123';
const gitlab = {
  mode: 'gitlab',
  gitlabUrl: 'https://gitlab.example.test/',
  group: '/team/backend/',
  token: TOKEN,
};

function post(app: ReturnType<typeof makeApp>['app'], payload: unknown, withHeader = true) {
  return app.inject({
    method: 'POST',
    url: '/api/settings',
    headers: withHeader ? { [SETTINGS_HEADER]: '1' } : {},
    payload: payload as object,
  });
}

async function configured(app: ReturnType<typeof makeApp>['app']) {
  return healthResponseSchema.parse((await app.inject('/api/health')).json()).configured;
}

describe('schermata iniziale: /api/settings', () => {
  it('senza impostazioni health dice configured=false e /api/me risponde 409', async () => {
    const { app } = makeApp({ unconfigured: true });
    expect(await configured(app)).toBe(false);
    const res = await app.inject('/api/me');
    expect(res.statusCode).toBe(409);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('not_configured');
  });

  it('rifiuta le richieste senza l intestazione anti-CSRF', async () => {
    const { app, createSource } = makeApp({ unconfigured: true });
    const res = await post(app, gitlab, false);
    expect(res.statusCode).toBe(400);
    expect(createSource).not.toHaveBeenCalled();
    const del = await app.inject({ method: 'DELETE', url: '/api/settings' });
    expect(del.statusCode).toBe(400);
  });

  it('rifiuta campi non validi senza chiamare GitLab', async () => {
    const { app, createSource } = makeApp({ unconfigured: true });
    for (const payload of [
      { ...gitlab, gitlabUrl: 'ftp://gitlab.example.test' },
      { ...gitlab, token: '  ' },
      { mode: 'boh' },
    ]) {
      expect((await post(app, payload)).statusCode).toBe(400);
    }
    expect(createSource).not.toHaveBeenCalled();
  });

  it('demo: si attiva dalla schermata e /api/me risponde', async () => {
    const { app, createSource } = makeApp({ unconfigured: true });
    const res = await post(app, { mode: 'demo' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ demoMode: true, displayName: 'Giulia Ferri' });
    expect(createSource).toHaveBeenCalledWith({ mode: 'demo' });
    const health = healthResponseSchema.parse((await app.inject('/api/health')).json());
    expect(health).toMatchObject({ configured: true, demoMode: true });
    expect((await app.inject('/api/me')).statusCode).toBe(200);
  });

  it('GitLab: normalizza URL e gruppo, verifica utente e gruppo, poi usa la nuova sorgente', async () => {
    const fresh = makeSource();
    const { app, source: old, createSource } = makeApp({ createSource: () => fresh });
    const res = await post(app, gitlab);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ demoMode: false, displayName: 'Giulia Ferri' });
    expect(createSource).toHaveBeenCalledWith({
      mode: 'gitlab',
      url: 'https://gitlab.example.test',
      group: 'team/backend',
      token: TOKEN,
    });
    expect(fresh.currentUser).toHaveBeenCalled();
    expect(fresh.listMembers).toHaveBeenCalled();
    expect((await app.inject('/api/me')).statusCode).toBe(200);
    expect(fresh.getActivity).toHaveBeenCalled();
    expect(old.getActivity).not.toHaveBeenCalled();
  });

  it('senza gruppo non legge i membri per verificarlo', async () => {
    const fresh = makeSource();
    const { app } = makeApp({ unconfigured: true, createSource: () => fresh });
    expect((await post(app, { ...gitlab, group: '' })).statusCode).toBe(200);
    expect(fresh.listMembers).not.toHaveBeenCalled();
  });

  it.each([
    ['unauthorized', 401, 'unauthorized', /token/],
    ['bot_token', 403, 'bot_token', /Personal Access Token/],
    ['upstream_error', 502, 'upstream_error', /indirizzo/],
  ] as const)(
    'errore %s: risposta %i e impostazioni invariate',
    async (code, status, apiCode, msg) => {
      const failing = makeSource({
        currentUser: async () => {
          throw new SourceError(code, 'dettaglio interno');
        },
      });
      const { app } = makeApp({ unconfigured: true, createSource: () => failing });
      const res = await post(app, gitlab);
      expect(res.statusCode).toBe(status);
      const body = apiErrorSchema.parse(res.json());
      expect(body.error.code).toBe(apiCode);
      expect(body.error.message).toMatch(msg);
      expect(res.body).not.toContain('dettaglio interno');
      expect(await configured(app)).toBe(false);
    },
  );

  it('gruppo inesistente o non leggibile: 404 con un messaggio sul gruppo', async () => {
    const failing = makeSource({
      listMembers: async () => {
        throw new SourceError('upstream_error', '404');
      },
    });
    const { app } = makeApp({ unconfigured: true, createSource: () => failing });
    const res = await post(app, gitlab);
    expect(res.statusCode).toBe(404);
    expect(apiErrorSchema.parse(res.json()).error.message).toMatch(/Gruppo/);
    expect(await configured(app)).toBe(false);
  });

  it('DELETE dimentica le impostazioni', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/settings',
      headers: { [SETTINGS_HEADER]: '1' },
    });
    expect(res.statusCode).toBe(204);
    expect(await configured(app)).toBe(false);
    expect((await app.inject('/api/me')).statusCode).toBe(409);
  });

  it('il token non finisce mai nei log, nemmeno quando GitLab lo rifiuta', async () => {
    const failing = makeSource({
      currentUser: async () => {
        throw new SourceError('unauthorized', TOKEN);
      },
    });
    const { app, sink } = makeApp({ unconfigured: true, createSource: () => failing });
    await post(app, gitlab);
    await post(app, { ...gitlab, gitlabUrl: 'non-un-url' });
    expect(sink.lines.length).toBeGreaterThan(0);
    expect(sink.lines.join('\n')).not.toContain(TOKEN);
  });
});
