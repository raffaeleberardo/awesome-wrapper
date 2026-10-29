import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Variants } from 'motion/react';
import { copy } from '@git-wrapped/copy';
import type { StoryCard, StoryPlayerProps } from '../shared/types';
import {
  DEFAULT_CARD_DURATION_MS,
  REDUCED_MOTION_MIN_DURATION_MS,
  THEMES,
  ThemeSurface,
  useReducedMotion,
} from '../theme';

/** Oltre questa durata un pointer down diventa "tieni premuto" (pausa, nessun avanzamento). */
export const HOLD_DELAY_MS = 200;
/** Spostamento orizzontale minimo perché un gesto conti come swipe. */
export const SWIPE_THRESHOLD_PX = 40;
/** Movimento oltre il quale un pointer down non è più un tap né una pressione prolungata. */
const MOVE_TOLERANCE_PX = 10;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function subscribeVisibility(cb: () => void) {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
}

/** `true` mentre la scheda del browser è nascosta. */
function useDocumentHidden(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'hidden',
    () => false,
  );
}

/** Durata effettiva di una card, allungata se l'utente preferisce meno movimento. */
export function effectiveDuration(card: StoryCard | undefined, reducedMotion: boolean): number {
  const base = card?.durationMs ?? DEFAULT_CARD_DURATION_MS;
  return reducedMotion ? Math.max(base, REDUCED_MOTION_MIN_DURATION_MS) : base;
}

interface Nav {
  index: number;
  /** Cambia a ogni navigazione, anche verso la stessa card: riavvia timer e barra. */
  nonce: number;
  dir: -1 | 0 | 1;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  moved: boolean;
  held: boolean;
  timer: number;
}

const cardVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * 14}%`, scale: 0.94 }),
  center: { opacity: 1, x: '0%', scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: `${dir * -14}%`, scale: 0.94 }),
};

const controlClass =
  'gw-control grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70';

/**
 * Player a storie a schermo intero (A6).
 * Tap a sinistra/destra, swipe, frecce, Spazio per la pausa, Esc per chiudere,
 * pressione prolungata per fermare il tempo. La firma è congelata in `shared/types.ts`.
 */
export function StoryPlayer({
  cards,
  initialIndex = 0,
  label,
  onClose,
  onComplete,
  renderOverlay,
}: StoryPlayerProps) {
  const count = cards.length;
  const reduced = useReducedMotion();
  const hidden = useDocumentHidden();
  const [nav, setNav] = useState<Nav>(() => ({
    index: clamp(initialIndex, 0, Math.max(0, count - 1)),
    nonce: 0,
    dir: 0,
  }));
  const [userPaused, setUserPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [finished, setFinished] = useState(false);

  const index = clamp(nav.index, 0, Math.max(0, count - 1));
  const card = cards[index];
  const hasCard = card !== undefined;
  const duration = effectiveDuration(card, reduced);
  const paused = userPaused || holding || hidden || finished;
  const runKey = `${index}:${nav.nonce}`;

  const goTo = (target: number, dir: Nav['dir']) => {
    setFinished(false);
    setNav((n) => ({ index: target, nonce: n.nonce + 1, dir }));
  };
  const next = () => {
    if (count === 0) return;
    if (index >= count - 1) {
      setFinished(true);
      onComplete?.();
      return;
    }
    goTo(index + 1, 1);
  };
  /** Sulla prima card riparte dall'inizio. */
  const prev = () => {
    if (count === 0) return;
    goTo(Math.max(0, index - 1), -1);
  };
  const togglePause = () => setUserPaused((p) => !p);

  // Avanzamento automatico: il tempo trascorso si conserva tra pausa e ripresa della stessa card.
  const elapsed = useRef({ key: '', ms: 0 });
  const advance = useEffectEvent(() => next());
  useEffect(() => {
    if (paused || !hasCard) return;
    if (elapsed.current.key !== runKey) elapsed.current = { key: runKey, ms: 0 };
    const start = Date.now();
    const timer = window.setTimeout(advance, Math.max(0, duration - elapsed.current.ms));
    return () => {
      window.clearTimeout(timer);
      if (elapsed.current.key === runKey) elapsed.current.ms += Date.now() - start;
    };
  }, [runKey, paused, duration, hasCard]);

  // Tastiera: frecce, Spazio, Esc. Ascolta su `window` così funziona senza dare il focus.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        if (!e.repeat) next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (!e.repeat) prev();
        break;
      case ' ':
      case 'Spacebar':
        // Su un pulsante lo Spazio lo attiva: non lo intercettiamo.
        if (target?.closest('button, a[href], [role="button"]')) return;
        e.preventDefault();
        if (!e.repeat) togglePause();
        break;
      case 'Escape':
        if (onClose) {
          e.preventDefault();
          onClose();
        }
        break;
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Gesti sull'area di tap: tap, swipe, pressione prolungata.
  const gesture = useRef<Gesture | null>(null);
  const endGesture = () => {
    const g = gesture.current;
    if (g) window.clearTimeout(g.timer);
    gesture.current = null;
    setHolding(false);
    return g;
  };
  useEffect(() => () => window.clearTimeout(gesture.current?.timer), []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (gesture.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const timer = window.setTimeout(() => {
      const g = gesture.current;
      if (g && !g.moved) {
        g.held = true;
        setHolding(true);
      }
    }, HOLD_DELAY_MS);
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      held: false,
      timer,
    };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.moved) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > MOVE_TOLERANCE_PX) {
      g.moved = true;
      window.clearTimeout(g.timer);
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    endGesture();
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
      return;
    }
    // Una pressione prolungata o un trascinamento non orizzontale non cambiano card.
    if (g.held || g.moved) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 2) prev();
    else next();
  };
  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.current?.id === e.pointerId) endGesture();
  };

  if (!card) return null;

  const theme = THEMES[card.theme];
  const stageStyle = {
    '--stage-bg': theme.background,
    '--stage-accent': theme.accent,
  } as CSSProperties;

  const cardNode = card.render({ exporting: false });

  return (
    <section
      aria-label={label}
      aria-roledescription="storia"
      className="gw-story fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-stage"
      style={stageStyle}
      data-index={index}
      data-paused={paused ? 'true' : 'false'}
      data-testid="story-player"
    >
      <div aria-hidden="true" className="gw-story-backdrop absolute inset-0 hidden sm:block" />

      <div className="relative h-full w-full sm:aspect-[9/16] sm:h-[min(calc(100dvh-3rem),calc((100vw-9rem)*16/9))] sm:w-auto">
        <div className="absolute inset-0 overflow-hidden sm:rounded-[1.75rem] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="story-live">
            {`Card ${index + 1} di ${count}. ${card.ariaLabel}`}
          </p>

          {/* Contenuto visivo: per gli screen reader vale il testo della regione live. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: theme.background }}
          >
            {reduced ? (
              <ThemeSurface
                key={runKey}
                theme={card.theme}
                className="absolute inset-0"
                data-card-id={card.id}
              >
                {cardNode}
              </ThemeSurface>
            ) : (
              <AnimatePresence initial={false} custom={nav.dir}>
                <motion.div
                  key={runKey}
                  className="absolute inset-0"
                  custom={nav.dir}
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ThemeSurface theme={card.theme} className="h-full w-full" data-card-id={card.id}>
                    {cardNode}
                  </ThemeSurface>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          <div
            data-testid="story-tap-area"
            className="gw-tap-area absolute inset-0 z-10"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
          />

          <div
            className={cx(
              'pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-3 bg-gradient-to-b from-black/40 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6 transition-opacity duration-200',
              holding && 'opacity-0',
            )}
          >
            <div className="flex gap-1" aria-hidden="true" data-testid="story-progress">
              {cards.map((c, i) => (
                <div
                  key={`${c.id}-${i}`}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-white/35"
                >
                  <div
                    key={i === index ? runKey : undefined}
                    data-progress
                    data-state={
                      i < index || (i === index && finished)
                        ? 'done'
                        : i > index
                          ? 'todo'
                          : 'current'
                    }
                    className="gw-progress-fill h-full w-full rounded-full bg-white"
                    style={
                      i === index
                        ? {
                            animationDuration: `${duration}ms`,
                            animationPlayState: paused ? 'paused' : 'running',
                          }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={cx(controlClass, 'pointer-events-auto')}
                aria-label={userPaused ? copy.ui.resume : copy.ui.pause}
                aria-pressed={userPaused}
                data-testid="story-pause"
                onClick={togglePause}
              >
                {userPaused ? <PlayIcon /> : <PauseIcon />}
              </button>
              {onClose && (
                <button
                  type="button"
                  className={cx(controlClass, 'pointer-events-auto')}
                  aria-label={copy.ui.close}
                  data-testid="story-close"
                  onClick={onClose}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>

          {renderOverlay && (
            <div
              data-testid="story-overlay"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] *:pointer-events-auto"
            >
              {renderOverlay(card, index)}
            </div>
          )}
        </div>

        {/* Indietro/avanti: visibili ai lati su desktop; su telefono compaiono con il focus. */}
        <button
          type="button"
          className={cx(
            controlClass,
            'absolute top-1/2 left-2 z-20 -translate-y-1/2 opacity-0 focus-visible:opacity-100 max-sm:pointer-events-none sm:-left-16 sm:opacity-100',
          )}
          aria-label={copy.ui.previous}
          data-testid="story-prev"
          onClick={prev}
        >
          <ChevronIcon dir="left" />
        </button>
        <button
          type="button"
          className={cx(
            controlClass,
            'absolute top-1/2 right-2 z-20 -translate-y-1/2 opacity-0 focus-visible:opacity-100 max-sm:pointer-events-none sm:-right-16 sm:opacity-100',
          )}
          aria-label={copy.ui.next}
          data-testid="story-next"
          onClick={next}
        >
          <ChevronIcon dir="right" />
        </button>
      </div>
    </section>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

function PauseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg {...iconProps} fill="currentColor">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg {...iconProps}>
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}
