import { useMemo, useState } from 'react';
import { THEMES } from '../theme';
import { buildStoryCards } from './build';
import { CardExportButton } from './export';
import { VARIANT_NAMES, VARIANTS, type VariantName } from './variants';

/** Tutte le card con dati di esempio, zero o estremi, servite su `#/dev/cards`. Non usa l'API. */
export function CardsDemo() {
  const [variant, setVariant] = useState<VariantName>('example');
  const [withCalendar, setWithCalendar] = useState(true);
  const data = VARIANTS[variant];
  const cards = useMemo(
    () => buildStoryCards({ stats: data.stats, calendar: withCalendar ? data.calendar : null }),
    [data, withCalendar],
  );

  return (
    <main style={{ height: '100%', overflowY: 'auto', padding: 16, background: '#0b0b12' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
          role="group"
          aria-label="varianti"
        >
          {VARIANT_NAMES.map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`variant-${v}`}
              aria-pressed={variant === v}
              onClick={() => setVariant(v)}
              style={{
                font: 'inherit',
                padding: '6px 14px',
                borderRadius: 999,
                border: '2px solid #c6ff3d',
                background: variant === v ? '#c6ff3d' : 'transparent',
                color: variant === v ? '#111' : '#c6ff3d',
                cursor: 'pointer',
              }}
            >
              {v}
            </button>
          ))}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={withCalendar}
              onChange={(e) => setWithCalendar(e.target.checked)}
            />
            calendar
          </label>
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 24,
            justifyItems: 'center',
          }}
        >
          {cards.map((card) => {
            const t = THEMES[card.theme];
            return (
              <li
                key={card.id}
                data-testid={`card-${card.id}`}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  display: 'grid',
                  gap: 8,
                  justifyItems: 'center',
                }}
              >
                <article
                  aria-label={card.ariaLabel}
                  style={{
                    width: '100%',
                    aspectRatio: '9 / 16',
                    overflow: 'hidden',
                    borderRadius: 20,
                    background: t.background,
                    color: t.foreground,
                  }}
                >
                  {card.render({ exporting: false })}
                </article>
                <CardExportButton card={card} fileName={`git-wrapped-${variant}-${card.id}`} />
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
