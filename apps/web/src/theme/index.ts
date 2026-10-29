import type { ThemeName } from '../shared/types';

/** Palette delle card (A6). Stub di A0: A6 può cambiare i colori, non i nomi. */
export const THEMES: Record<ThemeName, { background: string; foreground: string; accent: string }> =
  {
    electric: { background: '#3b1cf5', foreground: '#ffffff', accent: '#c6ff3d' },
    sunset: { background: '#ff5a36', foreground: '#1a0b05', accent: '#ffe14d' },
    lime: { background: '#c6ff3d', foreground: '#111111', accent: '#3b1cf5' },
    ocean: { background: '#0aa5c9', foreground: '#04131a', accent: '#ff3d9a' },
    candy: { background: '#ff3d9a', foreground: '#ffffff', accent: '#ffe14d' },
    midnight: { background: '#14142b', foreground: '#ffffff', accent: '#ff5a36' },
  };
