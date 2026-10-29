import { useEffect, useState } from 'react';
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { animate } from 'motion/react';
import type { ThemeName } from '../shared/types';
import { themeStyle } from './palette';
import { useReducedMotion } from './motion';

/**
 * Componenti tipografici riutilizzabili per le card (A6 → A7).
 * Le misure sono in `cqw` (larghezza del contenitore): dentro un `ThemeSurface` scalano allo
 * stesso modo nel player, su telefono e nell'export PNG 1080×1920.
 * I colori vengono dalle variabili `--card-fg` / `--card-accent` impostate da `ThemeSurface`.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const formatters = new Map<number, Intl.NumberFormat>();
/** Formatta un numero all'italiana (`1.234,5`) con il numero di decimali indicato. */
export function formatNumber(value: number, decimals = 0): string {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: 'always',
    });
    formatters.set(decimals, f);
  }
  return f.format(value);
}

const roundTo = (n: number, decimals: number) => {
  const k = 10 ** decimals;
  return Math.round(n * k) / k;
};

export interface ThemeSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  theme: ThemeName;
  children?: ReactNode;
}

/**
 * Superficie colorata di una card: sfondo del tema, variabili CSS, font di testo e contenitore
 * per le unità `cqw`. Il player la usa per ogni card; A7 può usarla per il nodo da esportare.
 */
export function ThemeSurface({ theme, className, style, children, ...rest }: ThemeSurfaceProps) {
  return (
    <div
      data-theme={theme}
      className={cx('gw-surface', className)}
      style={{ ...themeStyle(theme), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardLayoutProps {
  children?: ReactNode;
  /** Allineamento verticale del contenuto. Default `center`. */
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/** Colonna con i margini giusti per stare sotto le barre di avanzamento e sopra l'overlay. */
export function CardLayout({ children, align = 'center', className }: CardLayoutProps) {
  return (
    <div
      className={cx(
        'flex h-full w-full flex-col gap-[4cqw] px-[8cqw] pt-[26cqw] pb-[22cqw]',
        align === 'start' && 'justify-start',
        align === 'center' && 'justify-center',
        align === 'end' && 'justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface AnimatedNumberProps {
  value: number;
  /** Durata del conteggio. Default 1400 ms. */
  durationMs?: number;
  /** Ritardo prima di iniziare a contare. Default 0. */
  delayMs?: number;
  /** Cifre decimali mostrate. Default 0. */
  decimals?: number;
  /** Formattazione personalizzata (riceve il valore già arrotondato). */
  format?: (value: number) => string;
  /** `true` durante l'export PNG: mostra subito il valore finale. */
  exporting?: boolean;
  className?: string;
}

/**
 * Numero che conta da 0 fino a `value`. Con `prefers-reduced-motion` o `exporting` mostra
 * subito il valore finale. Gli screen reader leggono sempre e solo il valore finale.
 */
export function AnimatedNumber({
  value,
  durationMs = 1400,
  delayMs = 0,
  decimals = 0,
  format,
  exporting = false,
  className,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const still = exporting || reduced || !Number.isFinite(value) || value === 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (still) return;
    const controls = animate(0, value, {
      duration: durationMs / 1000,
      delay: delayMs / 1000,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    });
    return () => controls.stop();
  }, [still, value, durationMs, delayMs]);

  const fmt = format ?? ((n: number) => formatNumber(n, decimals));
  const finalText = fmt(value);
  const text = still ? finalText : fmt(roundTo(shown, decimals));
  return (
    <span className={cx('tabular-nums', className)} data-value={value}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}

export interface BigNumberProps extends Omit<AnimatedNumberProps, 'className'> {
  /** Unità accanto al numero, più piccola (es. `h`, `%`). */
  unit?: string;
  /** Didascalia sotto il numero. */
  label?: ReactNode;
  /** Dimensione massima in `cqw`. Si riduce da sola per numeri lunghi. Default 28. */
  maxSize?: number;
  className?: string;
}

/**
 * Numero enorme nel colore d'accento, che conta fino al valore. La dimensione si adatta alla
 * lunghezza del numero formattato, così anche valori estremi (es. `1.234.567`) restano nella card.
 */
export function BigNumber({
  unit,
  label,
  maxSize = 28,
  className,
  ...numberProps
}: BigNumberProps) {
  const { value, decimals = 0, format } = numberProps;
  const chars = (format ? format(value) : formatNumber(value, decimals)).length + (unit ? 1 : 0);
  // ~0.6em per carattere: la riga resta entro l'84% della larghezza della card.
  const size = Math.min(maxSize, 84 / Math.max(1, chars * 0.6));
  return (
    <div className={cx('flex flex-col', className)}>
      <span
        className="font-display leading-[0.85] font-extrabold tracking-[-0.04em] text-[var(--card-accent)]"
        style={{ fontSize: `${size}cqw` }}
      >
        <AnimatedNumber {...numberProps} />
        {unit && <span className="ml-[0.08em] text-[0.4em] tracking-normal">{unit}</span>}
      </span>
      {label && (
        <span className="mt-[2cqw] text-[length:5.5cqw] leading-tight font-semibold">{label}</span>
      )}
    </div>
  );
}

export interface DisplayTitleProps {
  children?: ReactNode;
  /** Elemento HTML. Default `h2`. */
  as?: ElementType;
  /** `xl` 15cqw, `lg` 11cqw, `md` 8cqw. Default `lg`. */
  size?: 'xl' | 'lg' | 'md';
  /** Usa il colore d'accento (solo per testo grande: contrasto ≥ 3:1). */
  accent?: boolean;
  className?: string;
  style?: CSSProperties;
}

const TITLE_SIZE = {
  xl: 'text-[length:15cqw]',
  lg: 'text-[length:11cqw]',
  md: 'text-[length:8cqw]',
};

/** Titolo tipografico grande in Bricolage Grotesque. */
export function DisplayTitle({
  children,
  as: Tag = 'h2',
  size = 'lg',
  accent = false,
  className,
  style,
}: DisplayTitleProps) {
  return (
    <Tag
      className={cx(
        'font-display leading-[0.92] font-extrabold tracking-[-0.03em] text-balance break-words',
        TITLE_SIZE[size],
        accent && 'text-[var(--card-accent)]',
        className,
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Etichetta piccola in maiuscolo sopra un titolo. */
export function Kicker({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <p className={cx('text-[length:3.8cqw] font-bold tracking-[0.18em] uppercase', className)}>
      {children}
    </p>
  );
}

/** Testo di corpo leggibile (Inter, ~5cqw). */
export function CardText({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <p className={cx('text-[length:5cqw] leading-snug font-medium text-pretty', className)}>
      {children}
    </p>
  );
}

/** Parola o frase nel colore d'accento (solo testo grande). */
export function Accent({ children }: { children?: ReactNode }) {
  return <span className="text-[var(--card-accent)]">{children}</span>;
}
