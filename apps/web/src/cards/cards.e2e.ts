import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function download(page: Page, cardId: string) {
  const button = page.getByTestId(`card-${cardId}`).getByTestId('export-button');
  await button.scrollIntoViewIfNeeded();
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    button.click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  const path = await dl.path();
  return readFile(path);
}

function expectValidPng(buf: Buffer) {
  expect([...buf.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  // IHDR: lunghezza (4) + "IHDR" (4) + larghezza (4) + altezza (4)
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect(buf.readUInt32BE(16)).toBe(1080);
  expect(buf.readUInt32BE(20)).toBe(1920);
}

test.describe('export PNG delle card', () => {
  for (const cardId of ['key_numbers', 'summary']) {
    test(`scarica un PNG 1080×1920 valido (${cardId})`, async ({ page }) => {
      await page.goto('/#/dev/cards');
      expectValidPng(await download(page, cardId));
    });
  }

  test('scarica anche con dati estremi', async ({ page }) => {
    await page.goto('/#/dev/cards');
    await page.getByTestId('variant-extreme').click();
    expectValidPng(await download(page, 'top_files'));
  });
});
