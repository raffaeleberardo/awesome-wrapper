import { expect, test } from '@playwright/test';

/**
 * Privacy: dopo il caricamento della pagina, il parsing di un .ics non deve generare richieste
 * di rete. Escluse (e documentate) solo le richieste per lo script del worker e per i moduli
 * che importa, serviti dallo stesso dev server Vite (`parser.worker`, `/@fs`, `/node_modules`,
 * `/src`): sono codice, non dati, e non contengono il file dell'utente.
 */

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//IT',
  'BEGIN:VEVENT',
  'UID:e1',
  'DTSTART:20260310T090000Z',
  'DTEND:20260310T100000Z',
  'DESCRIPTION:https://teams.microsoft.com/l/meetup-join/abc',
  'RRULE:FREQ=WEEKLY;COUNT=3',
  'ATTENDEE:mailto:a@example.com',
  'ATTENDEE:mailto:b@example.com',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:e2',
  'DTSTART:20260311T090000Z',
  'DTEND:20260311T093000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const isWorkerAsset = (url: string) =>
  /parser\.worker|\/@fs\/|\/node_modules\/|\/src\/|\/@vite\/|\/@id\/|\/assets\/.*\.js/.test(url);

test('il caricamento del calendario non genera richieste di rete e mostra le stats', async ({
  page,
}) => {
  await page.goto('/#/dev/calendar');
  await expect(page.getByTestId('calendar-privacy-note')).toBeVisible();
  await page.waitForLoadState('networkidle');

  const requests: string[] = [];
  page.on('request', (r) => {
    if (!isWorkerAsset(r.url()) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) {
      requests.push(`${r.method()} ${r.url()}`);
    }
  });

  await page.getByTestId('calendar-file-input').setInputFiles({
    name: 'calendario.ics',
    mimeType: 'text/calendar',
    buffer: Buffer.from(ICS),
  });

  const pre = page.getByTestId('calendar-stats');
  await expect(pre).toBeVisible();
  const stats = JSON.parse((await pre.textContent()) ?? '{}');
  expect(stats.year).toBe(2026);
  expect(stats.meetings).toBe(4);
  expect(stats.teamsCallShare).toBeCloseTo(0.75);
  expect(requests).toEqual([]);
});

test('un file non valido mostra un errore comprensibile', async ({ page }) => {
  await page.goto('/#/dev/calendar');
  await page.getByTestId('calendar-file-input').setInputFiles({
    name: 'rotto.ics',
    mimeType: 'text/calendar',
    buffer: Buffer.from('non sono un calendario'),
  });
  await expect(page.getByTestId('calendar-error')).toBeVisible();
});

test('la zona di caricamento è raggiungibile da tastiera e il bottone salta funziona', async ({
  page,
}) => {
  await page.goto('/#/dev/calendar');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /.+/ }).first()).toBeFocused();
  await page.getByRole('button').last().click();
  await expect(page.getByText('Calendario saltato.')).toBeVisible();
});
