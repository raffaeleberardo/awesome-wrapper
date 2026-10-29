/**
 * Rigenera la sezione "Esempi" di docs/contracts.md dagli esempi tipizzati dei contratti.
 * Uso: pnpm docs:contracts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ex from '../packages/contracts/src/examples';

const MARKER = '<!-- esempi generati: non modificare a mano sotto questa riga -->';
const docPath = fileURLToPath(new URL('../docs/contracts.md', import.meta.url));

const sections: [string, unknown][] = [
  ['RawActivity', ex.exampleRawActivity],
  ['WrappedStats (`GET /api/wrapped/:username`)', ex.exampleWrappedStats],
  ['TeamAwards (`GET /api/team`)', ex.exampleTeamAwards],
  ['CalendarEvent', ex.exampleCalendarEvent],
  ['CalendarStats', ex.exampleCalendarStats],
  ['HealthResponse (`GET /api/health`)', ex.exampleHealthResponse],
  ['MembersResponse (`GET /api/members`)', ex.exampleMembersResponse],
  ['ApiError (risposte 4xx/5xx)', ex.exampleApiError],
];

const generated = sections
  .map(
    ([title, value]) => `### ${title}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`,
  )
  .join('\n');

const current = readFileSync(docPath, 'utf8');
const head = current.split(MARKER)[0]!.trimEnd();
writeFileSync(docPath, `${head}\n\n${MARKER}\n\n${generated}`);
console.log('docs/contracts.md aggiornato');
