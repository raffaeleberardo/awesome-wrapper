import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryCard, StoryPlayerProps } from '../shared/types';
import { StoryPlayer } from './StoryPlayer';

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const makeCards = (durationMs?: number): StoryCard[] =>
  (['electric', 'sunset', 'lime'] as const).map((theme, i) => ({
    id: `c${i + 1}`,
    theme,
    durationMs,
    ariaLabel: `Testo della card ${i + 1}`,
    render: () => <p>Contenuto {i + 1}</p>,
  }));

function setup(props: Partial<StoryPlayerProps> = {}) {
  const onComplete = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <StoryPlayer
      label="Storia di test"
      cards={makeCards(1000)}
      onComplete={onComplete}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...utils, onComplete, onClose };
}

const current = () => Number(screen.getByTestId('story-player').dataset.index);
const live = () => screen.getByTestId('story-live').textContent;
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(window, { key: k, ...init });
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StoryPlayer: struttura e accessibilità', () => {
  it('espone la storia con etichetta e la card corrente in una regione live', () => {
    setup();
    const region = screen.getByRole('region', { name: 'Storia di test' });
    expect(region.getAttribute('aria-roledescription')).toBe('storia');
    const liveRegion = screen.getByTestId('story-live');
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(live()).toBe('Card 1 di 3. Testo della card 1');
  });

  it('ha pulsanti accessibili per indietro, avanti, pausa e chiusura', () => {
    setup();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    fireEvent.click(screen.getByTestId('story-next'));
    expect(current()).toBe(1);
    fireEvent.click(screen.getByTestId('story-prev'));
    expect(current()).toBe(0);
  });

  it('non mostra il pulsante di chiusura senza onClose', () => {
    render(<StoryPlayer label="x" cards={makeCards()} />);
    expect(screen.queryByTestId('story-close')).toBeNull();
  });

  it('non renderizza nulla senza card', () => {
    const { container } = render(<StoryPlayer label="x" cards={[]} />);
    expect(container.childElementCount).toBe(0);
  });

  it('rispetta initialIndex e lo limita al numero di card', () => {
    setup({ initialIndex: 9 });
    expect(current()).toBe(2);
  });
});

describe('StoryPlayer: tastiera', () => {
  it('le frecce cambiano card, sulla prima ← riparte da capo', () => {
    setup();
    key('ArrowRight');
    expect(live()).toBe('Card 2 di 3. Testo della card 2');
    key('ArrowRight');
    expect(current()).toBe(2);
    key('ArrowLeft');
    expect(current()).toBe(1);
    key('ArrowLeft');
    key('ArrowLeft');
    expect(current()).toBe(0);
  });

  it('ignora la ripetizione automatica dei tasti freccia', () => {
    setup();
    key('ArrowRight', { repeat: true });
    expect(current()).toBe(0);
  });

  it('Esc chiama onClose', () => {
    const { onClose } = setup();
    key('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Spazio mette in pausa e riprende', () => {
    mockReducedMotion(false);
    setup();
    key(' ');
    expect(screen.getByTestId('story-pause').getAttribute('aria-pressed')).toBe('true');
    tick(5000);
    expect(current()).toBe(0);
    key(' ');
    tick(1000);
    expect(current()).toBe(1);
  });

  it('Spazio su un pulsante attiva il pulsante e non mette in pausa la storia', () => {
    setup();
    const next = screen.getByTestId('story-next');
    next.focus();
    fireEvent.keyDown(next, { key: ' ' });
    expect(screen.getByTestId('story-pause').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('StoryPlayer: avanzamento automatico', () => {
  it('avanza dopo durationMs', () => {
    mockReducedMotion(false);
    setup();
    tick(999);
    expect(current()).toBe(0);
    tick(1);
    expect(current()).toBe(1);
    tick(1000);
    expect(current()).toBe(2);
  });

  it('usa 6000 ms di default senza reduced motion', () => {
    mockReducedMotion(false);
    render(<StoryPlayer label="x" cards={makeCards()} />);
    tick(5999);
    expect(current()).toBe(0);
    tick(1);
    expect(current()).toBe(1);
  });

  it('con prefers-reduced-motion non scende sotto 10 secondi per card', () => {
    setup();
    tick(9999);
    expect(current()).toBe(0);
    tick(1);
    expect(current()).toBe(1);
  });

  it('la pausa conserva il tempo già trascorso', () => {
    mockReducedMotion(false);
    setup();
    tick(400);
    fireEvent.click(screen.getByTestId('story-pause'));
    tick(10_000);
    expect(current()).toBe(0);
    fireEvent.click(screen.getByTestId('story-pause'));
    tick(599);
    expect(current()).toBe(0);
    tick(1);
    expect(current()).toBe(1);
  });

  it('chiama onComplete dopo l’ultima card e si ferma', () => {
    mockReducedMotion(false);
    const { onComplete } = setup();
    // Un tick per card: dentro un solo act() React non rende tra un timer e l'altro.
    tick(1000);
    tick(1000);
    expect(onComplete).not.toHaveBeenCalled();
    tick(1000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(current()).toBe(2);
    tick(10_000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    key('ArrowRight');
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('si mette in pausa quando la scheda è nascosta', () => {
    mockReducedMotion(false);
    setup();
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('story-player').dataset.paused).toBe('true');
    tick(5000);
    expect(current()).toBe(0);
    state.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    tick(1000);
    expect(current()).toBe(1);
    state.mockRestore();
  });
});

describe('StoryPlayer: gesti e overlay', () => {
  const area = () => screen.getByTestId('story-tap-area');
  const rect = { left: 0, top: 0, width: 400, height: 700, right: 400, bottom: 700, x: 0, y: 0 };
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      ...rect,
      toJSON: () => rect,
    } as DOMRect);
  });

  const tap = (x: number, y = 300) => {
    fireEvent.pointerDown(area(), {
      pointerId: 1,
      clientX: x,
      clientY: y,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(area(), {
      pointerId: 1,
      clientX: x,
      clientY: y,
      button: 0,
      pointerType: 'mouse',
    });
  };

  it('tap a destra avanza, tap a sinistra torna indietro', () => {
    setup();
    tap(350);
    expect(current()).toBe(1);
    tap(350);
    expect(current()).toBe(2);
    tap(50);
    expect(current()).toBe(1);
  });

  it('swipe verso sinistra avanza, verso destra torna indietro', () => {
    setup();
    const swipe = (from: number, to: number) => {
      fireEvent.pointerDown(area(), {
        pointerId: 2,
        clientX: from,
        clientY: 300,
        pointerType: 'touch',
      });
      fireEvent.pointerMove(area(), {
        pointerId: 2,
        clientX: (from + to) / 2,
        clientY: 305,
        pointerType: 'touch',
      });
      fireEvent.pointerUp(area(), {
        pointerId: 2,
        clientX: to,
        clientY: 305,
        pointerType: 'touch',
      });
    };
    swipe(100, 20);
    expect(current()).toBe(1);
    swipe(20, 300);
    expect(current()).toBe(0);
  });

  it('tenere premuto mette in pausa e il rilascio non cambia card', () => {
    mockReducedMotion(false);
    setup();
    fireEvent.pointerDown(area(), {
      pointerId: 3,
      clientX: 350,
      clientY: 300,
      pointerType: 'mouse',
      button: 0,
    });
    tick(200);
    expect(screen.getByTestId('story-player').dataset.paused).toBe('true');
    tick(5000);
    expect(current()).toBe(0);
    fireEvent.pointerUp(area(), {
      pointerId: 3,
      clientX: 350,
      clientY: 300,
      pointerType: 'mouse',
      button: 0,
    });
    expect(current()).toBe(0);
    expect(screen.getByTestId('story-player').dataset.paused).toBe('false');
    // La pausa scatta dopo 200 ms di pressione: restano 800 ms.
    tick(799);
    expect(current()).toBe(0);
    tick(1);
    expect(current()).toBe(1);
  });

  it('l’overlay riceve la card corrente e i click lì non cambiano card', () => {
    const onAction = vi.fn();
    setup({
      renderOverlay: (card, index) => (
        <button type="button" onClick={onAction}>
          Esporta {card.id} {index}
        </button>
      ),
    });
    const button = screen.getByRole('button', { name: 'Esporta c1 0' });
    fireEvent.pointerDown(button, {
      pointerId: 4,
      clientX: 350,
      clientY: 650,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.pointerUp(button, {
      pointerId: 4,
      clientX: 350,
      clientY: 650,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(current()).toBe(0);
    key('ArrowRight');
    expect(screen.getByRole('button', { name: 'Esporta c2 1' })).toBeTruthy();
  });
});
