import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getMedia(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void) {
  const media = getMedia();
  if (!media) return () => {};
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * `true` se l'utente ha chiesto di ridurre le animazioni (`prefers-reduced-motion: reduce`).
 * Si aggiorna in tempo reale se la preferenza cambia. Senza `matchMedia` (es. test) vale `false`.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getMedia()?.matches ?? false,
    () => false,
  );
}

/** Con `prefers-reduced-motion` l'avanzamento automatico non scende sotto questa durata. */
export const REDUCED_MOTION_MIN_DURATION_MS = 10_000;

/** Durata di default di una card se `durationMs` non è indicato. */
export const DEFAULT_CARD_DURATION_MS = 6000;
