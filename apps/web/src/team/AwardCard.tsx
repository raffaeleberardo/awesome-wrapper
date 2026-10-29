import type { CSSProperties } from 'react';
import type { TeamAward } from '@git-wrapped/contracts';
import { copy, format } from '@git-wrapped/copy';
import { awardValue, emojiGlyph, joinNames } from '../cards/format';

/** Sfondo red carpet usato sia a video sia nel PNG. */
export const CARPET_BACKGROUND =
  'radial-gradient(120% 70% at 50% 0%, #7a0f1f 0%, #3a0610 55%, #14030a 100%)';
export const GOLD = '#f5c451';

const wrap: CSSProperties = { overflowWrap: 'anywhere', wordBreak: 'break-word' };

function clampLines(n: number): CSSProperties {
  return {
    ...wrap,
    display: '-webkit-box',
    WebkitLineClamp: n,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
}

export function awardTexts(award: TeamAward) {
  const c = copy.awards[award.id];
  const detail =
    award.detail === null
      ? undefined
      : award.id === 'emoji_of_the_year'
        ? emojiGlyph(award.detail)
        : award.detail;
  const vars = {
    winner: joinNames(award.winners.map((w) => w.displayName)),
    value: awardValue(award),
    ...(detail === undefined ? {} : { detail }),
  };
  return {
    title: format('awards', c.title, vars),
    description: format('awards', c.description, vars),
    winners: award.winners.map((w) => w.displayName),
  };
}

/** Testo completo di un premio, per gli screen reader. */
export function awardAriaLabel(award: TeamAward): string {
  const t = awardTexts(award);
  return [t.title, ...t.winners, t.description].join('. ');
}

/** Premio in formato 9:16: statuetta, titolo, vincitori, motivazione. Misure in `cqw`. */
export function AwardCard({ award }: { award: TeamAward; exporting?: boolean }) {
  const t = awardTexts(award);
  return (
    <div style={{ containerType: 'inline-size', width: '100%', height: '100%' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          padding: '10cqw 8cqw',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '5cqw',
          textAlign: 'center',
          color: '#fff',
          background: CARPET_BACKGROUND,
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <div aria-hidden="true" style={{ fontSize: '26cqw', lineHeight: 1 }}>
          🏆
        </div>
        <h3
          style={{
            ...clampLines(4),
            margin: 0,
            fontFamily: 'var(--font-display, system-ui, sans-serif)',
            fontWeight: 900,
            fontSize: '10cqw',
            lineHeight: 1.02,
            color: GOLD,
          }}
        >
          {t.title}
        </h3>
        <div style={{ display: 'grid', gap: '2cqw' }}>
          {t.winners.slice(0, 4).map((w, i) => (
            <div
              key={`${w}-${i}`}
              style={{
                ...clampLines(2),
                fontFamily: 'var(--font-display, system-ui, sans-serif)',
                fontWeight: 800,
                fontSize: t.winners.length > 1 ? '8cqw' : '10cqw',
                lineHeight: 1.05,
              }}
            >
              {w}
            </div>
          ))}
        </div>
        <p style={{ ...clampLines(6), margin: 0, fontSize: '4.6cqw', opacity: 0.9 }}>
          {t.description}
        </p>
      </div>
    </div>
  );
}
