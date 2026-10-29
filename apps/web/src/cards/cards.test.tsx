import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { CARD_IDS, calendarStatsSchema, wrappedStatsSchema } from '@git-wrapped/contracts';
import { buildStoryCards } from './build';
import { CardExportButton } from './export';
import { CardsDemo } from './CardsDemo';
import { VARIANT_NAMES, VARIANTS } from './variants';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

afterEach(cleanup);

describe('varianti di dati', () => {
  it.each(VARIANT_NAMES)('%s è valida per i contratti', (name) => {
    expect(wrappedStatsSchema.safeParse(VARIANTS[name].stats).success).toBe(true);
    expect(calendarStatsSchema.safeParse(VARIANTS[name].calendar).success).toBe(true);
  });
});

describe('buildStoryCards', () => {
  it.each(VARIANT_NAMES)('rispetta l’ordine di CARD_IDS (%s)', (name) => {
    const { stats, calendar } = VARIANTS[name];
    expect(buildStoryCards({ stats, calendar }).map((c) => c.id)).toEqual([...CARD_IDS]);
  });

  it('salta la card calendario se calendar è null', () => {
    const ids = buildStoryCards({ stats: VARIANTS.example.stats, calendar: null }).map((c) => c.id);
    expect(ids).not.toContain('calendar');
    expect(ids).toEqual(CARD_IDS.filter((id) => id !== 'calendar'));
  });

  it.each(VARIANT_NAMES)('ogni card ha ariaLabel e durata (%s)', (name) => {
    const { stats, calendar } = VARIANTS[name];
    for (const card of buildStoryCards({ stats, calendar })) {
      expect(card.ariaLabel.trim().length, card.id).toBeGreaterThan(0);
      expect(card.durationMs).toBeGreaterThan(0);
    }
  });

  it('l’ariaLabel contiene i dati della card', () => {
    const cards = buildStoryCards({
      stats: VARIANTS.example.stats,
      calendar: VARIANTS.example.calendar,
    });
    const key = cards.find((c) => c.id === 'key_numbers');
    expect(key?.ariaLabel).toContain('612');
    const duet = cards.find((c) => c.id === 'duet');
    expect(duet?.ariaLabel).toContain('Marco Vitale');
  });

  it('usa più di un tema', () => {
    const themes = new Set(
      buildStoryCards({ stats: VARIANTS.example.stats, calendar: null }).map((c) => c.theme),
    );
    expect(themes.size).toBeGreaterThan(3);
  });
});

describe('render delle card', () => {
  for (const name of VARIANT_NAMES) {
    for (const exporting of [false, true]) {
      it(`si renderizzano senza errori (${name}, exporting=${exporting})`, () => {
        const { stats, calendar } = VARIANTS[name];
        for (const card of buildStoryCards({ stats, calendar })) {
          const { container, unmount } = render(<>{card.render({ exporting })}</>);
          expect(container.firstElementChild, card.id).not.toBeNull();
          expect(container.textContent?.length ?? 0, card.id).toBeGreaterThan(0);
          unmount();
        }
      });
    }
  }

  it('non mostra NaN né undefined con dati a zero', () => {
    const { stats, calendar } = VARIANTS.zero;
    for (const card of buildStoryCards({ stats, calendar })) {
      const { container, unmount } = render(<>{card.render({ exporting: true })}</>);
      expect(container.textContent, card.id).not.toMatch(/NaN|undefined|Infinity/);
      unmount();
    }
  });
});

describe('CardExportButton', () => {
  it('mostra il bottone di download', () => {
    const [card] = buildStoryCards({ stats: VARIANTS.example.stats, calendar: null });
    if (!card) throw new Error('nessuna card');
    render(<CardExportButton card={card} fileName="prova" />);
    expect((screen.getByTestId('export-button') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('CardsDemo', () => {
  it('mostra tutte le card senza API', () => {
    render(<CardsDemo />);
    for (const id of CARD_IDS) expect(screen.getByTestId(`card-${id}`)).toBeTruthy();
  });
});
