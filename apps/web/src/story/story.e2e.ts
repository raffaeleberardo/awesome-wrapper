import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Player a storie (A6) sulla rotta di sviluppo `#/dev/story`.
 * `?durationMs=` accorcia o allunga le card della demo per rendere i tempi deterministici.
 */

const LONG = 60_000;
const open = async (page: Page, durationMs = LONG) => {
  await page.goto(`/?durationMs=${durationMs}#/dev/story`);
  await expect(page.getByTestId('story-player')).toBeVisible();
};
const expectIndex = (page: Page, index: number, timeout?: number) =>
  expect(page.getByTestId('story-player')).toHaveAttribute('data-index', String(index), {
    timeout,
  });

async function tapAreaPoint(page: Page, side: 'left' | 'right') {
  const box = await page.getByTestId('story-tap-area').boundingBox();
  if (!box) throw new Error('area di tap non visibile');
  return {
    x: box.x + box.width * (side === 'left' ? 0.2 : 0.8),
    y: box.y + box.height * 0.5,
    box,
  };
}

async function tap(page: Page, side: 'left' | 'right', touch: boolean) {
  const { x, y } = await tapAreaPoint(page, side);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Tocchi veri via CDP (Chromium): generano pointer event di tipo `touch`. */
async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  return { send };
}

async function swipe(page: Page, direction: 'left' | 'right', isTouch: boolean) {
  const { box } = await tapAreaPoint(page, 'left');
  const y = box.y + box.height * 0.5;
  const from = box.x + box.width * (direction === 'left' ? 0.8 : 0.2);
  const to = box.x + box.width * (direction === 'left' ? 0.2 : 0.8);
  const steps = 8;
  if (isTouch) {
    const { send } = await touch(page);
    await send('touchStart', from, y);
    for (let i = 1; i <= steps; i++) await send('touchMove', from + ((to - from) * i) / steps, y);
    await send('touchEnd');
  } else {
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps });
    await page.mouse.up();
  }
}

test.describe('player a storie', () => {
  test('tap a destra avanza, tap a sinistra torna indietro', async ({ page, hasTouch }) => {
    await open(page);
    await expectIndex(page, 0);
    await tap(page, 'right', hasTouch);
    await expectIndex(page, 1);
    await tap(page, 'right', hasTouch);
    await expectIndex(page, 2);
    await tap(page, 'left', hasTouch);
    await expectIndex(page, 1);
    await expect(page.getByTestId('story-live')).toContainText('Card 2 di 3');
  });

  test('swipe orizzontale cambia card', async ({ page, hasTouch }) => {
    await open(page);
    await swipe(page, 'left', hasTouch);
    await expectIndex(page, 1);
    await swipe(page, 'left', hasTouch);
    await expectIndex(page, 2);
    await swipe(page, 'right', hasTouch);
    await expectIndex(page, 1);
  });

  test('frecce, Spazio ed Esc da tastiera', async ({ page }) => {
    await open(page, 1500);
    await page.keyboard.press('ArrowRight');
    await expectIndex(page, 1);
    await page.keyboard.press('ArrowLeft');
    await expectIndex(page, 0);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('story-player')).toHaveAttribute('data-paused', 'true');
    await page.waitForTimeout(2500);
    await expectIndex(page, 0);
    await page.keyboard.press('Space');
    await expectIndex(page, 1, 3000);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('story-demo-end')).toContainText('Storia chiusa');
  });

  test('i pulsanti indietro/avanti/pausa sono raggiungibili da tastiera', async ({ page }) => {
    await open(page);
    const next = page.getByTestId('story-next');
    await next.focus();
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');
    await expectIndex(page, 1);
    await page.getByTestId('story-pause').focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('story-pause')).toHaveAttribute('aria-pressed', 'true');
    await expectIndex(page, 1);
  });

  test('tenere premuto mette in pausa, il rilascio non avanza', async ({ page, hasTouch }) => {
    await open(page, 1500);
    const { x, y } = await tapAreaPoint(page, 'right');
    const player = page.getByTestId('story-player');
    if (hasTouch) {
      const { send } = await touch(page);
      await send('touchStart', x, y);
      await page.waitForTimeout(2500);
      await expect(player).toHaveAttribute('data-paused', 'true');
      await expectIndex(page, 0);
      await send('touchEnd');
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(2500);
      await expect(player).toHaveAttribute('data-paused', 'true');
      await expectIndex(page, 0);
      await page.mouse.up();
    }
    await expect(player).toHaveAttribute('data-paused', 'false');
    await expectIndex(page, 0);
    // Riprende il tempo rimasto e avanza da solo.
    await expectIndex(page, 1, 3000);
  });

  test('avanzamento automatico fino alla fine della storia', async ({ page }) => {
    await open(page, 800);
    await expectIndex(page, 1, 3000);
    await expectIndex(page, 2, 3000);
    await expect(page.getByTestId('story-demo-end')).toContainText('Fine della storia', {
      timeout: 3000,
    });
  });

  test('i click sull’overlay non cambiano card', async ({ page, hasTouch }) => {
    await open(page);
    const button = page.getByTestId('story-demo-overlay-button');
    if (hasTouch) await button.tap();
    else await button.click();
    await expect(button).toHaveText('Azione di prova (1)');
    await expectIndex(page, 0);
  });

  test('formato 9:16 su desktop, tutto schermo su telefono', async ({ page, isMobile }) => {
    await open(page);
    const box = await page.getByTestId('story-tap-area').boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('misure non disponibili');
    if (isMobile) {
      expect(box.width).toBeCloseTo(viewport.width, 0);
      expect(box.height).toBeCloseTo(viewport.height, 0);
    } else {
      expect(box.width / box.height).toBeCloseTo(9 / 16, 2);
      expect(box.x).toBeGreaterThan(0);
    }
  });
});

/** Dopo un cambio di card: card renderizzate e animazioni attive (escluse le barre). */
async function transitionSnapshot(page: Page) {
  return page.evaluate(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const animations = document
      .getAnimations()
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return !(target instanceof Element && target.closest('[data-progress]'));
      })
      .filter((a) => a.playState === 'running');
    return {
      cards: document.querySelectorAll('[data-card-id]').length,
      animations: animations.length,
      number: document.querySelector('[data-value] [aria-hidden]')?.textContent ?? null,
    };
  });
}

test.describe('senza reduced motion', () => {
  test('il cambio di card è animato', async ({ page }) => {
    await open(page);
    const snap = await transitionSnapshot(page);
    // La card uscente è ancora presente oppure c'è un'animazione in corso.
    expect(snap.cards > 1 || snap.animations > 0).toBe(true);
    await expect(page.locator('[data-card-id]')).toHaveCount(1);
  });
});

test.describe('con prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('niente animazioni e numeri subito al valore finale', async ({ page }) => {
    await open(page);
    const snap = await transitionSnapshot(page);
    expect(snap.cards).toBe(1);
    expect(snap.animations).toBe(0);
    expect(snap.number).toBe('1.234');
    await expectIndex(page, 1);
  });

  test('le card restano navigabili', async ({ page, hasTouch }) => {
    await open(page);
    await tap(page, 'right', hasTouch);
    await expectIndex(page, 1);
    await page.keyboard.press('ArrowRight');
    await expectIndex(page, 2);
  });
});
