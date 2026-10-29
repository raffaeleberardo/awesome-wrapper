/**
 * Genera i dati demo. Uso: `pnpm --filter @git-wrapped/fixtures generate [cartellaDiOutput]`.
 * Senza argomento scrive in `packages/fixtures/data/`.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFixtures } from './lib/build';

const defaultOut = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');
const outDir = process.argv[2] ? resolve(process.argv[2]) : defaultOut;

writeFixtures(outDir);
console.log(`Dati demo scritti in ${outDir}`);
