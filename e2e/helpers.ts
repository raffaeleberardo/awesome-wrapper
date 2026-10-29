import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

/** File .ics di esempio di A5 (riunioni ricorrenti, call Teams, inviti rifiutati). */
export const SAMPLE_ICS = fileURLToPath(
  new URL('../packages/fixtures/data/calendario-esempio.ics', import.meta.url),
);

/** `CARD_IDS` dei contratti (la radice non dipende dai pacchetti del workspace). */
export const CARD_IDS = [
  'intro',
  'key_numbers',
  'top_projects',
  'top_files',
  'languages',
  'hours',
  'streak',
  'duet',
  'emoji',
  'commit_messages',
  'pipeline_graveyard',
  'ghost_mrs',
  'friday_deploys',
  'calendar',
  'badges',
  'personality',
  'horoscope',
  'summary',
] as const;

export const DEMO_MEMBERS = [
  'Giulia Ferri',
  'Marco Vitale',
  'Chiara Esposito',
  'Luca Moretti',
  'Sara Bianchi',
  'Davide Rinaldi',
  'Elena Costa',
  'Andrea Galli',
];

/** Raccoglie errori della pagina e violazioni CSP (da verificare a fine test). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  void page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  return errors;
}

/** Dalla home apre la storia di un membro e salta il calendario. */
export async function openStory(page: Page, member: string, opts: { skipCalendar?: boolean } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(member) }).click();
  await expect(page.getByTestId('calendar-privacy-note')).toBeVisible();
  if (opts.skipCalendar !== false) {
    await page.getByRole('button', { name: /Salta/ }).click();
    await expect(page.getByTestId('story-player')).toBeVisible();
  }
}

/** Id della card mostrata (attributo messo da `ThemeSurface` del player). */
export async function currentCardId(page: Page): Promise<string | null> {
  return page.locator('[data-card-id]').last().getAttribute('data-card-id');
}

/** Testo visibile + testo per screen reader della card corrente: niente segnaposto né NaN. */
export async function expectCleanCard(page: Page) {
  const live = (await page.getByTestId('story-live').textContent()) ?? '';
  const visible = await page.locator('[data-card-id]').last().innerText();
  // (non "null": è una parola possibile nei messaggi di commit, es. «valori null nel CSV»)
  expect(`${live}\n${visible}`).not.toMatch(/NaN|undefined|\{\w+\}|Infinity/);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Clicca il bottone di export e restituisce i byte del PNG scaricato. */
export async function downloadPng(page: Page, scope = page.getByTestId('story-overlay')) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    scope.getByTestId('export-button').first().click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/^git-wrapped-.*\.png$/);
  return readFile(await dl.path());
}

/** PNG valido: firma, chunk IHDR, 1080×1920. */
export function expectPng1080x1920(buf: Buffer) {
  expect([...buf.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect(buf.readUInt32BE(16)).toBe(1080);
  expect(buf.readUInt32BE(20)).toBe(1920);
}
