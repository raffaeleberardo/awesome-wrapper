import type { CSSProperties, ReactNode } from 'react';
import type { ThemeName } from '../shared/types';
import { AnimatedNumber, THEMES } from '../theme';
import { fitSize, fmt } from './format';

/**
 * Primitive grafiche delle card. Tutte le misure sono in `cqw` (1cqw = 1% della larghezza della card)
 * così la stessa card sta nel player, nelle anteprime e nel PNG 1080×1920 senza media query.
 */

export const wrapText: CSSProperties = { overflowWrap: 'anywhere', wordBreak: 'break-word' };

export const displayFont = 'var(--font-display, system-ui, sans-serif)';

/** Sfondo tenue che funziona su qualsiasi tema. */
export const softSurface = 'color-mix(in srgb, currentColor 14%, transparent)';

export function clamp(lines: number): CSSProperties {
  return {
    ...wrapText,
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
}

interface FrameProps {
  theme: ThemeName;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Contenuto in fondo (es. una battuta). */
  footer?: ReactNode;
}

/** Cornice comune: titolo, sottotitolo e corpo che occupa lo spazio restante. */
export function Frame({ theme, title, subtitle, children, footer }: FrameProps) {
  const t = THEMES[theme];
  return (
    <div style={{ containerType: 'inline-size', width: '100%', height: '100%' }}>
      <div
        style={
          {
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            padding: '9cqw 8cqw',
            display: 'flex',
            flexDirection: 'column',
            gap: '4cqw',
            color: t.foreground,
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            '--accent': t.accent,
          } as CSSProperties
        }
      >
        <header style={{ flex: '0 0 auto', minWidth: 0 }}>
          <h2
            style={{
              ...clamp(3),
              margin: 0,
              fontFamily: displayFont,
              fontWeight: 800,
              fontSize: '9cqw',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p style={{ ...clamp(3), margin: '2.5cqw 0 0', fontSize: '4.2cqw', opacity: 0.85 }}>
              {subtitle}
            </p>
          ) : null}
        </header>
        <div
          style={{
            flex: '1 1 0',
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'safe center',
            overflow: 'hidden',
            gap: '4cqw',
          }}
        >
          {children}
        </div>
        {footer ? (
          <footer style={{ flex: '0 0 auto', fontSize: '4cqw', opacity: 0.85, ...wrapText }}>
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

interface BigNumberProps {
  value: number;
  exporting: boolean;
  /** Larghezza disponibile in cqw, per ridurre il corpo dei numeri a 7+ cifre. */
  width?: number;
  max?: number;
  suffix?: string;
}

/**
 * Numero grande che conta fino al valore (con `AnimatedNumber` del tema di A6: rispetta
 * `prefers-reduced-motion` ed `exporting`); si adatta a numeri a 7 cifre.
 */
export function BigNumber({ value, exporting, width = 84, max = 26, suffix = '' }: BigNumberProps) {
  const finalText = `${fmt(value)}${suffix}`;
  return (
    <div
      aria-hidden="true"
      style={{
        fontFamily: displayFont,
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: '-0.03em',
        fontVariantNumeric: 'tabular-nums',
        fontSize: `${fitSize(finalText, width, max, 6)}cqw`,
        color: 'var(--accent)',
        ...wrapText,
      }}
    >
      <AnimatedNumber value={value} exporting={exporting} format={(n) => fmt(Math.round(n))} />
      {suffix}
    </div>
  );
}

interface TileProps {
  value: string;
  label: string;
  size?: number;
}

/** Riquadro con un numero e una piccola etichetta tecnica. */
export function Tile({ value, label, size = 8 }: TileProps) {
  return (
    <div
      style={{
        background: softSurface,
        borderRadius: '3cqw',
        padding: '3cqw',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontFamily: displayFont,
          fontWeight: 800,
          lineHeight: 1.05,
          fontSize: `${fitSize(value, 34, size, 3.5)}cqw`,
          color: 'var(--accent)',
          ...wrapText,
        }}
      >
        {value}
      </div>
      <div style={{ ...clamp(1), fontSize: '3.2cqw', opacity: 0.85, marginTop: '1cqw' }}>
        {label}
      </div>
    </div>
  );
}

export function TileGrid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: '3cqw',
      }}
    >
      {children}
    </div>
  );
}

/** Barra orizzontale proporzionale (0..1). */
export function Bar({ ratio }: { ratio: number }) {
  const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return (
    <div
      aria-hidden="true"
      style={{
        height: '2.4cqw',
        borderRadius: '2cqw',
        background: softSurface,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${r * 100}%`,
          height: '100%',
          background: 'var(--accent)',
          borderRadius: '2cqw',
        }}
      />
    </div>
  );
}

/** Istogramma verticale. Valori tutti a zero: barre minime, nessuna divisione per zero. */
export function Histogram({
  values,
  labels,
  highlight,
  height = 30,
}: {
  values: number[];
  labels?: (i: number) => string;
  highlight?: number | null;
  height?: number;
}) {
  const max = Math.max(0, ...values);
  return (
    <div aria-hidden="true">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: values.length > 12 ? '0.7cqw' : '1.6cqw',
          height: `${height}cqw`,
        }}
      >
        {values.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              height: `${max > 0 ? Math.max(2, (v / max) * 100) : 2}%`,
              background: i === highlight ? 'var(--accent)' : softSurface,
              borderRadius: '0.8cqw 0.8cqw 0 0',
              opacity: i === highlight || max === 0 ? 1 : 0.9,
            }}
          />
        ))}
      </div>
      {labels ? (
        <div style={{ display: 'flex', gap: values.length > 12 ? '0.7cqw' : '1.6cqw' }}>
          {values.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'center',
                fontSize: values.length > 12 ? '2.4cqw' : '3cqw',
                opacity: values.length > 12 && i % 6 !== 0 ? 0 : 0.8,
                overflow: 'hidden',
              }}
            >
              {labels(i)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Glifo decorativo grande (non letto dagli screen reader). */
export function Glyph({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <div aria-hidden="true" style={{ fontSize: `${size}cqw`, lineHeight: 1 }}>
      {children}
    </div>
  );
}

/** Riga con testo lungo che non deve sforare. */
export function Line({
  children,
  size = 5,
  lines = 2,
  bold = false,
}: {
  children: ReactNode;
  size?: number;
  lines?: number;
  bold?: boolean;
}) {
  return (
    <div style={{ ...clamp(lines), fontSize: `${size}cqw`, fontWeight: bold ? 700 : 400 }}>
      {children}
    </div>
  );
}
