import { expect, test, type Page, type Request } from '@playwright/test';
import {
  CARD_IDS,
  DEMO_MEMBERS,
  SAMPLE_ICS,
  currentCardId,
  expectCleanCard,
  openStory,
  watchErrors,
} from './helpers';

/**
 * Percorso completo in demo mode contro lo stack vero (`E2E_BASE_URL`, es. il container `web`):
 * scelta del membro → calendario (saltato o caricato) → storia fino alla fine → notte degli Oscar.
 */

/** Scorre la storia con la tastiera fino agli Oscar; restituisce gli id delle card viste. */
async function playToTheEnd(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.getByTestId('story-pause').click();
  for (let i = 0; i < CARD_IDS.length + 2 && !page.url().includes('#/oscar'); i++) {
    const id = await currentCardId(page);
    if (id && seen.at(-1) !== id) seen.push(id);
    await expectCleanCard(page);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => page.url().includes('#/oscar') || (await currentCardId(page)) !== id)
      .toBe(true);
  }
  return seen;
}

test('demo: membro → salta calendario → storia completa → notte degli Oscar', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  for (const name of DEMO_MEMBERS) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }

  await openStory(page, 'Giulia Ferri');
  const seen = await playToTheEnd(page);
  // Tutte le card nell'ordine dei contratti, senza quella del calendario.
  expect(seen).toEqual(CARD_IDS.filter((id) => id !== 'calendar'));

  await expect(page).toHaveURL(/#\/oscar$/);
  await expect(page.getByRole('heading', { name: /Oscar/ })).toBeVisible();
  const oscar = await page.locator('main').innerText();
  expect(oscar).toContain('resurrezione'); // pipeline_phoenix (contracts-v2)
  expect(oscar).not.toMatch(/NaN|undefined|\{\w+\}/);
  expect(errors).toEqual([]);
});

test('con il .ics di esempio compare la card calendario, senza richieste di rete', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openStory(page, 'Marco Vitale', { skipCalendar: false });
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

test('ogni membro demo ha una storia senza valori rotti', async ({ page }) => {
  test.slow();
  for (const name of DEMO_MEMBERS) {
    await openStory(page, name);
    await playToTheEnd(page);
  }
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('niente numeri che contano, niente transizioni né coriandoli', async ({ page }) => {
    await openStory(page, 'Luca Moretti');
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
