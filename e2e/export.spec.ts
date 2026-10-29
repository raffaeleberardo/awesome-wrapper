import { expect, test } from '@playwright/test';
import { currentCardId, downloadPng, expectPng1080x1920, openStory } from './helpers';

/**
 * Export PNG dentro la storia vera e dalla notte degli Oscar. Gira anche sui progetti
 * `firefox` e `webkit` (vedi playwright.config.ts). WebKit di Playwright NON è Safari:
 * è lo stesso motore, ma la verifica su Safari reale resta manuale.
 */

test('export PNG 1080×1920 di una card della storia', async ({ page }) => {
  await openStory(page, 'Elena Costa');
  await page.getByTestId('story-pause').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentCardId(page)).toBe('key_numbers');
  expectPng1080x1920(await downloadPng(page));
});

test('export PNG 1080×1920 di un premio della notte degli Oscar', async ({ page }) => {
  await page.goto('/#/oscar');
  await expect(page.getByTestId('export-button').first()).toBeVisible();
  expectPng1080x1920(await downloadPng(page, page.locator('main')));
});
