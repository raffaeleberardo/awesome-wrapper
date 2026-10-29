import { prefersReducedMotion } from './motion';

/** Coriandoli per i badge. Niente con `prefers-reduced-motion`; mai bloccante né fatale. */
export function fireConfetti(): void {
  if (prefersReducedMotion() || typeof document === 'undefined') return;
  void import('canvas-confetti')
    .then(({ default: confetti }) => {
      void confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.7 },
        disableForReducedMotion: true,
      });
    })
    .catch(() => undefined);
}
