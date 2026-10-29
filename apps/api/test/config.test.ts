import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applica i default', () => {
    expect(loadConfig({})).toMatchObject({
      demoMode: true,
      gitlabUrl: 'https://gitlab.com',
      year: 2026,
      timezone: 'Europe/Rome',
      cacheTtlMinutes: 15,
      gitlabCaCert: undefined,
    });
  });

  it('con DEMO_MODE=false richiede il token', () => {
    expect(() => loadConfig({ DEMO_MODE: 'false' })).toThrow(ConfigError);
    expect(() => loadConfig({ DEMO_MODE: 'false' })).toThrow(/GITLAB_TOKEN/);
  });

  it('con DEMO_MODE=false il gruppo è facoltativo', () => {
    const cfg = loadConfig({ DEMO_MODE: 'false', GITLAB_TOKEN: 'glpat-segreto' });
    expect(cfg).toMatchObject({ demoMode: false, gitlabGroup: '' });
  });

  it('accetta configurazione reale completa', () => {
    const cfg = loadConfig({
      DEMO_MODE: 'false',
      GITLAB_TOKEN: 't',
      GITLAB_GROUP: 'acme/team',
      CACHE_TTL_MINUTES: '5',
      WRAPPED_YEAR: '2025',
    });
    expect(cfg).toMatchObject({ demoMode: false, gitlabGroup: 'acme/team', cacheTtlMinutes: 5 });
  });

  it.each([
    { WRAPPED_YEAR: 'x' },
    { CACHE_TTL_MINUTES: '0' },
    { DEMO_MODE: 'forse' },
    { GITLAB_URL: 'non un url' },
    { TZ: 'Marte/Olympus' },
  ])('rifiuta valori non validi %j', (env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('GITLAB_CA_CERT: PEM inline o percorso di file', () => {
    const base = { DEMO_MODE: 'false', GITLAB_TOKEN: 't', GITLAB_GROUP: 'g' };
    const pem = '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----';
    expect(loadConfig({ ...base, GITLAB_CA_CERT: pem }).gitlabCaCert).toBe(pem);

    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-')), 'ca.pem');
    fs.writeFileSync(file, pem);
    expect(loadConfig({ ...base, GITLAB_CA_CERT: file }).gitlabCaCert).toBe(pem);
    fs.rmSync(path.dirname(file), { recursive: true });

    expect(() => loadConfig({ ...base, GITLAB_CA_CERT: '/non/esiste.pem' })).toThrow(ConfigError);
  });
});
