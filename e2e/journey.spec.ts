import { expect, test, type Page, type Request } from '@playwright/test';
import {
  CARD_IDS,
  SAMPLE_ICS,
  currentCardId,
  expectCleanCard,
  openStory,
  watchErrors,
} from './helpers';

/**
 * Percorso completo in demo mode contro lo stack vero (`E2E_BASE_URL`, es. il container `web`):
 * `/` apre subito il percorso dell'utente del token (in demo un utente fisso, niente scelta del
 * membro) → calendario (saltato o caricato) → storia fino alla fine → schermata finale.
 */

const END_TEXT = /Fine della storia/;

/** Scorre la storia con la tastiera fino alla schermata finale; restituisce gli id delle card viste. */
async function playToTheEnd(page: Page): Promise<string[]> {
  const seen: string[] = [];
  const player = page.getByTestId('story-player');
  await page.getByTestId('story-pause').click();
  for (let i = 0; i < CARD_IDS.length + 2 && (await player.isVisible()); i++) {
    const id = await currentCardId(page);
    if (id && seen.at(-1) !== id) seen.push(id);
    await expectCleanCard(page);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => !(await player.isVisible()) || (await currentCardId(page)) !== id)
      .toBe(true);
  }
  await expect(page.getByText(END_TEXT)).toBeVisible();
  return seen;
}

test('demo: / → salta calendario → storia completa → fine e ricomincia', async ({ page }) => {
  const errors = watchErrors(page);
  await openStory(page);
  const seen = await playToTheEnd(page);
  // Tutte le card nell'ordine dei contratti, senza quella del calendario.
  expect(seen).toEqual(CARD_IDS.filter((id) => id !== 'calendar'));
  // Niente scelta del membro né Oscar: l'URL resta sulla radice.
  expect(page.url()).not.toMatch(/#\/(u\/|oscar)/);

  // «Ricomincia» riparte dalla prima card.
  await page.getByRole('button', { name: /Ricomincia/ }).click();
  await expect(page.getByTestId('story-player')).toBeVisible();
  await expect.poll(() => currentCardId(page)).toBe('intro');
  expect(errors).toEqual([]);
});

test('chiudere la storia riporta al passo del calendario', async ({ page }) => {
  await openStory(page);
  await page.getByTestId('story-close').click();
  await expect(page.getByTestId('calendar-privacy-note')).toBeVisible();
  await page.getByRole('button', { name: /Salta/ }).click();
  await expect(page.getByTestId('story-player')).toBeVisible();
});

test('con il .ics di esempio compare la card calendario, senza richieste di rete', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openStory(page, { skipCalendar: false });
  await page.waitForLoadState('networkidle');

  // Da qui in poi nessuna richiesta deve portare dati: ammesso solo il codice del worker
  // (stessa origine, /assets/*.js), che non contiene nulla del file.
  const requests: Request[] = [];
  page.on('request', (r) => requests.push(r));
  await page.getByTestId('calendar-file-input').setInputFiles(SAMPLE_ICS);
  await expect(page.getByTestId('story-player')).toBeVisible();

  const data = requests.filter(
    (r) =>
      !/^blob:|^data:/.test(r.url()) && !/\/assets\/[^/]+\.js$/.test(new URL(r.url()).pathname),
  );
  expect(data.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  expect(requests.every((r) => r.method() === 'GET' && r.postData() === null)).toBe(true);

  const seen = await playToTheEnd(page);
  expect(seen).toContain('calendar');
  expect(seen).toEqual([...CARD_IDS]);
  expect(errors).toEqual([]);
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('niente numeri che contano, niente transizioni né coriandoli', async ({ page }) => {
    await openStory(page);
    await page.getByTestId('story-pause').click();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => currentCardId(page)).toBe('key_numbers');
    // Il numero grande mostra subito il valore finale (nessun conteggio da 0).
    const big = page.locator('[data-card-id="key_numbers"] [data-value]').first();
    const final = Number(await big.getAttribute('data-value'));
    expect(final).toBeGreaterThan(0);
    await expect(big.locator('[aria-hidden="true"]')).toHaveText(
      new Intl.NumberFormat('it-IT').format(final),
    );
    // Nessuna animazione CSS/Motion in corso sulla card.
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === 'running' &&
              !(a.effect?.target as Element | null)?.closest?.('[data-testid="story-progress"]'),
          ).length,
    );
    expect(running).toBe(0);
    // Card dei badge: niente coriandoli (canvas-confetti crea un <canvas>).
    while ((await currentCardId(page)) !== 'badges') await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});
