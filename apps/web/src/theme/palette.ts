import type { CSSProperties } from 'react';
import type { ThemeName } from '../shared/types';

export interface ThemePalette {
  /** Sfondo pieno della card. */
  background: string;
  /** Testo principale: contrasto AA (≥ 4.5:1) con `background`. */
  foreground: string;
  /** Colore d'accento per numeri e titoli grandi: contrasto ≥ 3:1 con `background`. */
  accent: string;
}

/** Palette delle card. I nomi sono congelati in `shared/types.ts`, i colori sono di A6. */
export const THEMES: Record<ThemeName, ThemePalette> = {
  electric: { background: '#3d1cf5', foreground: '#ffffff', accent: '#d4ff3a' },
  sunset: { background: '#ff5a1f', foreground: '#1c0800', accent: '#3a0ca3' },
  lime: { background: '#c6ff2e', foreground: '#101500', accent: '#5a00e0' },
  ocean: { background: '#00a3d9', foreground: '#02151d', accent: '#2b0f8f' },
  candy: { background: '#ff2e93', foreground: '#1f0010', accent: '#fff35c' },
  midnight: { background: '#13112e', foreground: '#ffffff', accent: '#ff7a45' },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

/**
 * Variabili CSS del tema (`--card-bg`, `--card-fg`, `--card-accent`) più sfondo e colore.
 * I componenti del tema leggono queste variabili, quindi funzionano in qualsiasi contenitore
 * che le imposti (il player, oppure il nodo renderizzato per l'export PNG).
 */
export function themeStyle(name: ThemeName): CSSProperties {
  const t = THEMES[name];
  return {
    '--card-bg': t.background,
    '--card-fg': t.foreground,
    '--card-accent': t.accent,
    background: t.background,
    color: t.foreground,
  } as CSSProperties;
}

/** Luminanza relativa WCAG 2.x di un colore `#rrggbb`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Rapporto di contrasto WCAG tra due colori `#rrggbb` (da 1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
