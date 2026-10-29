import { useEffect, useState } from 'react';

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Valore che sale da 0 a `target`. Con `exporting` o `prefers-reduced-motion` vale subito `target`.
 * Versione semplice di A7: A11 può sostituirla con il numero animato del tema di A6.
 */
export function useCountUp(target: number, exporting: boolean, durationMs = 900): number {
  const instant =
    exporting || prefersReducedMotion() || typeof requestAnimationFrame !== 'function';
  const [value, setValue] = useState(instant ? target : 0);
  useEffect(() => {
    if (instant) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, instant, durationMs]);
  return instant ? target : value;
}
