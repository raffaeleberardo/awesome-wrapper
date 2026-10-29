import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceError } from '../src/source';
import { makeApp, makeSource } from './helpers';

const apiRoot = path.resolve(__dirname, '..');

/** Elenco ricorsivo dei file del package (escluso node_modules). */
function listFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== 'node_modules')
    .flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? listFiles(full) : [`${full}:${fs.statSync(full).mtimeMs}`];
    })
    .sort();
}

afterEach(() => vi.restoreAllMocks());

describe('nessuna scrittura su disco', () => {
  it('le richieste non creano file fuori dalla tmpdir', async () => {
    const written: string[] = [];
    const record = (target: unknown) => {
      if (typeof target === 'string') written.push(path.resolve(target));
      else if (target instanceof URL) written.push(target.pathname);
    };
    const spy = (obj: object, name: string) =>
      vi
        .spyOn(obj as Record<string, (...a: unknown[]) => unknown>, name)
        .mockImplementation((...args: unknown[]) => {
          record(args[0]);
          throw new Error('scrittura bloccata nel test');
        });
    for (const fn of [
      'writeFile',
      'writeFileSync',
      'appendFile',
      'appendFileSync',
      'createWriteStream',
      'mkdir',
      'mkdirSync',
      'rename',
      'renameSync',
      'copyFile',
      'copyFileSync',
      'mkdtemp',
      'mkdtempSync',
    ]) {
      if (fn in fs) spy(fs, fn);
    }
    for (const fn of ['writeFile', 'appendFile', 'mkdir', 'rename', 'copyFile', 'mkdtemp']) {
      spy(fsp, fn);
    }

    const before = listFiles(apiRoot);
    const { app } = makeApp();
    for (const url of ['/api/health', '/api/me', '/api/me?year=2025', '/api/boh']) {
      await app.inject(url);
    }
    await app.close();

    const tmp = path.resolve(os.tmpdir());
    expect(written.filter((p) => !p.startsWith(tmp))).toEqual([]);
    expect(listFiles(apiRoot)).toEqual(before);
  });
});

describe('log', () => {
  it('non contengono username, nome, token né URL reali', async () => {
    const { app, sink } = makeApp();
    const token = 'glpat-SEGRETISSIMO-123';
    const res = await app.inject({
      url: '/api/me?year=2026',
      headers: { authorization: `Bearer ${token}`, cookie: 'sessione=abc' },
    });
    expect(res.statusCode).toBe(200);
    // la risposta contiene i dati dell'utente, i log no
    expect(res.body).toContain('giulia.ferri');
    await app.inject({ url: '/api/me?year=abc', headers: { authorization: `Bearer ${token}` } });
    await app.close();

    const output = sink.lines.join('');
    expect(output).toContain('/api/me'); // pattern della rotta
    for (const secret of [
      token,
      'giulia.ferri',
      'Giulia',
      'marco.vitale',
      'sessione=abc',
      'year=2026',
      'year=abc',
    ]) {
      expect(output).not.toContain(secret);
    }
    // Nessun corpo di risposta nei log.
    expect(output).not.toContain('totals');
  });

  it('gli errori della sorgente non portano nei log né in risposta token o username', async () => {
    const token = 'glpat-SEGRETISSIMO-456';
    for (const code of ['unauthorized', 'bot_token'] as const) {
      const source = makeSource({
        currentUser: async () => {
          throw new SourceError(code, `${token} group_9_bot_xyz`);
        },
      });
      const { app, sink } = makeApp({ source });
      const res = await app.inject('/api/me');
      await app.close();
      for (const text of [res.body, sink.lines.join('')]) {
        expect(text).not.toContain(token);
        expect(text).not.toContain('group_9_bot_xyz');
      }
      expect(sink.lines.join('')).toContain(code);
    }
  });
});
