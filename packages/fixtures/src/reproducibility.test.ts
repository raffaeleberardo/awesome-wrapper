import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const committed = join(packageRoot, 'data');
const FILES = ['team.json', 'sample-ics.json', 'calendario-esempio.ics'];

describe('riproducibilità di scripts/generate.ts', () => {
  let outDir: string;

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), 'git-wrapped-fixtures-'));
    // Esegue lo script vero (non le sue funzioni) con la cartella di output come argomento.
    const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
    execFileSync(process.execPath, [tsxCli, join(packageRoot, 'scripts', 'generate.ts'), outDir], {
      cwd: packageRoot,
      stdio: 'pipe',
      timeout: 120_000,
    });
  }, 150_000);

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  for (const file of FILES) {
    it(`${file} è identico byte per byte a quello committato`, () => {
      const fresh = readFileSync(join(outDir, file));
      const stored = readFileSync(join(committed, file));
      expect(fresh.length).toBe(stored.length);
      expect(fresh.equals(stored)).toBe(true);
    });
  }
});
