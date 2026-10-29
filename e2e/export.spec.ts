import { expect, test } from '@playwright/test';
import { currentCardId, downloadPng, expectPng1080x1920, openStory } from './helpers';

/**
 * Export PNG dentro la storia vera. Gira anche sui progetti
 * `firefox` e `webkit` (vedi playwright.config.ts). WebKit di Playwright NON è Safari:
 * è lo stesso motore, ma la verifica su Safari reale resta manuale.
 */

test('export PNG 1080×1920 di una card della storia', async ({ page }) => {
  await openStory(page);
  await page.getByTestId('story-pause').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentCardId(page)).toBe('key_numbers');
  expectPng1080x1920(await downloadPng(page));
});
