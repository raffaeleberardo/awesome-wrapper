import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnimatedNumber,
  BigNumber,
  THEMES,
  THEME_NAMES,
  ThemeSurface,
  contrastRatio,
  formatNumber,
  themeStyle,
} from '.';

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('palette', () => {
  it.each(THEME_NAMES)('%s: testo con contrasto AA e accento ≥ 3:1 sullo sfondo', (name) => {
    const t = THEMES[name];
    expect(contrastRatio(t.foreground, t.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accent, t.background)).toBeGreaterThanOrEqual(3);
  });

  it('calcola il contrasto WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('themeStyle imposta variabili, sfondo e colore', () => {
    const style = themeStyle('candy') as Record<string, string>;
    expect(style['--card-bg']).toBe(THEMES.candy.background);
    expect(style['--card-accent']).toBe(THEMES.candy.accent);
    expect(style.color).toBe(THEMES.candy.foreground);
  });

  it('ThemeSurface espone il tema', () => {
    render(<ThemeSurface theme="ocean" data-testid="s" />);
    expect(screen.getByTestId('s').dataset.theme).toBe('ocean');
  });
});

describe('AnimatedNumber', () => {
  it('formatta all’italiana', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
    expect(formatNumber(3.5, 1)).toBe('3,5');
  });

  it('in export mostra subito il valore finale', () => {
    mockReducedMotion(false);
    const { container } = render(<AnimatedNumber value={1234} exporting />);
    expect(container.textContent).toBe('1.2341.234');
    expect(container.querySelector('[aria-hidden]')?.textContent).toBe('1.234');
  });

  it('con prefers-reduced-motion non conta', () => {
    mockReducedMotion(true);
    const { container } = render(<AnimatedNumber value={42} />);
    expect(container.querySelector('[aria-hidden]')?.textContent).toBe('42');
  });

  it('conta da 0 fino al valore, gli screen reader leggono solo il finale', async () => {
    mockReducedMotion(false);
    const { container } = render(<AnimatedNumber value={500} durationMs={60} />);
    const visible = () => container.querySelector('[aria-hidden]')?.textContent;
    expect(visible()).toBe('0');
    expect(container.querySelector('.sr-only')?.textContent).toBe('500');
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(visible()).toBe('500');
  });
});

describe('BigNumber', () => {
  it('riduce il corpo per i numeri lunghi', () => {
    mockReducedMotion(true);
    const { container } = render(
      <>
        <BigNumber value={7} label="giorni" />
        <BigNumber value={123456789} />
      </>,
    );
    const sizes = [...container.querySelectorAll<HTMLElement>('[style*="font-size"]')].map((el) =>
      parseFloat(el.style.fontSize),
    );
    expect(sizes[0]).toBe(28);
    expect(sizes[1]).toBeLessThan(13);
    expect(screen.getByText('giorni')).toBeTruthy();
  });
});
