import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { copy } from '@git-wrapped/copy';
import { CardLayout, CardText, Kicker, ThemeSurface, THEMES, useReducedMotion } from '../theme';
import type { ThemeName } from './types';

/**
 * Schermata di attesa nello stile delle card: stessa cornice 9:16 del player, palette del tema e
 * font del resto dell'app. La percentuale è stimata: `/api/me` è una sola richiesta e il server non
 * comunica l'avanzamento, quindi sale veloce all'inizio, rallenta verso il 95% e arriva al 100%
 * solo quando i dati ci sono (`done`). A quel punto, dopo una breve pausa, chiama `onFinished`.
 */

const THEME: ThemeName = 'electric';
/** Tetto della stima finché i dati non arrivano. */
const CEILING = 95;
/** Costante di tempo della stima: dopo ~8 s si è al 63% del tetto. */
const TAU_MS = 8000;
/** Ogni quanto cambia la frase di attesa. */
const LINE_MS = 2800;
/** Quanto resta visibile il 100% prima di mostrare il contenuto. */
const HOLD_MS = 450;

const estimate = (elapsedMs: number) => CEILING * (1 - Math.exp(-elapsedMs / TAU_MS));

export interface LoadingScreenProps {
  /** `true` quando i dati sono arrivati: la barra va al 100%. */
  done?: boolean;
  /** Chiamata quando il 100% è stato mostrato (subito con movimento ridotto). */
  onFinished?: () => void;
}

export function LoadingScreen({ done = false, onFinished }: LoadingScreenProps) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [lineIndex, setLineIndex] = useState(() => Math.floor(Math.random() * copy.loading.length));
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  // Stima dell'avanzamento finché i dati non arrivano.
  useEffect(() => {
    if (done) return;
    const start = performance.now();
    const id = window.setInterval(() => setProgress(estimate(performance.now() - start)), 100);
    return () => window.clearInterval(id);
  }, [done]);

  // Dati arrivati: breve pausa sul 100%, poi il contenuto.
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => finished.current?.(), reduced ? 0 : HOLD_MS);
    return () => window.clearTimeout(id);
  }, [done, reduced]);

  // Frasi a rotazione; con movimento ridotto resta la prima.
  useEffect(() => {
    if (reduced || done) return;
    const id = window.setInterval(
      () => setLineIndex((i) => (i + 1) % copy.loading.length),
      LINE_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced, done]);

  // Con i dati arrivati la barra è piena, qualunque fosse la stima.
  const shown = done ? 100 : progress;
  const percent = Math.round(shown);
  const theme = THEMES[THEME];
  const stage = { '--stage-bg': theme.background, '--stage-accent': theme.accent } as CSSProperties;

  return (
    <div className="gw-story relative grid h-full place-items-center" style={stage}>
      <div aria-hidden="true" className="gw-story-backdrop absolute inset-0 hidden sm:block" />
      <div className="relative h-full w-full sm:aspect-[9/16] sm:h-[min(calc(100dvh-3rem),calc((100vw-9rem)*16/9))] sm:w-auto">
        <div className="absolute inset-0 overflow-hidden sm:rounded-[1.75rem] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <ThemeSurface theme={THEME} className="h-full w-full">
            <CardLayout align="end">
              <Kicker>{copy.ui.app_title}</Kicker>
              <div
                role="progressbar"
                aria-label={copy.ui.loading_story}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={`${percent}% (stima)`}
                className="flex flex-col gap-[4cqw]"
              >
                <span
                  aria-hidden="true"
                  className="font-display text-[length:34cqw] leading-[0.85] font-extrabold tracking-[-0.04em] text-[var(--card-accent)] tabular-nums"
                >
                  {percent}
                  <span className="ml-[0.08em] text-[0.4em] tracking-normal">%</span>
                </span>
                <div className="h-[2.2cqw] overflow-hidden rounded-full bg-white/25">
                  <div
                    className="gw-loading-fill h-full w-full rounded-full bg-[var(--card-accent)]"
                    style={{ transform: `scaleX(${shown / 100})` }}
                  />
                </div>
              </div>
              <p className="font-display text-[length:8cqw] leading-tight font-extrabold">
                {copy.ui.loading_story}
              </p>
              {/* Solo decorativa: gli screen reader leggono già la barra. */}
              <CardText className="min-h-[2.6em] opacity-85" key={lineIndex}>
                <span aria-hidden="true" className="gw-loading-line inline-block">
                  {copy.loading[lineIndex]}
                </span>
              </CardText>
            </CardLayout>
          </ThemeSurface>
        </div>
      </div>
    </div>
  );
}
