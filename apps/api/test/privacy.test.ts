import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeApp } from './helpers';

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
    for (const url of [
      '/api/health',
      '/api/members',
      '/api/wrapped/giulia.ferri',
      '/api/wrapped/sconosciuto',
      '/api/team',
    ]) {
      await app.inject(url);
    }
    await app.close();

    const tmp = path.resolve(os.tmpdir());
    expect(written.filter((p) => !p.startsWith(tmp))).toEqual([]);
    expect(listFiles(apiRoot)).toEqual(before);
  });
});

describe('log', () => {
  it('non contengono username, token né URL reali', async () => {
    const { app, sink } = makeApp();
    const token = 'glpat-SEGRETISSIMO-123';
    const res = await app.inject({
      url: '/api/wrapped/giulia.ferri?year=2026',
      headers: { authorization: `Bearer ${token}`, cookie: 'sessione=abc' },
    });
    expect(res.statusCode).toBe(200);
    await app.inject({
      url: '/api/wrapped/sconosciuto.utente',
      headers: { authorization: `Bearer ${token}` },
    });
    await app.close();

    const output = sink.lines.join('');
    expect(output).toContain('/api/wrapped/:username'); // pattern della rotta
    for (const secret of [token, 'giulia.ferri', 'sconosciuto.utente', 'Giulia', 'sessione=abc']) {
      expect(output).not.toContain(secret);
    }
    // Nessun corpo di risposta nei log.
    expect(output).not.toContain('totals');
  });
});
