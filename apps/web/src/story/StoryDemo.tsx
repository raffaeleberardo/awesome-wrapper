import { useState } from 'react';
import type { StoryCard } from '../shared/types';
import { Accent, BigNumber, CardLayout, CardText, DisplayTitle, Kicker } from '../theme';
import { StoryPlayer } from './StoryPlayer';

/**
 * Durata delle card della demo. Si può accorciare per i test con `?durationMs=1500`
 * prima dell'hash (es. `/?durationMs=1500#/dev/story`).
 */
function demoDuration(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get('durationMs');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function demoCards(durationMs?: number): StoryCard[] {
  return [
    {
      id: 'demo-intro',
      theme: 'electric',
      durationMs,
      ariaLabel: 'Il tuo 2026 su GitLab. Ciao Ada, è stato un anno pieno di commit.',
      render: () => (
        <CardLayout align="end">
          <Kicker>Il tuo 2026 su GitLab</Kicker>
          <DisplayTitle as="h1" size="xl">
            Ciao <Accent>Ada</Accent>, che anno!
          </DisplayTitle>
          <CardText>
            Mettiti comoda: abbiamo contato tutto, anche i commit delle 3 di notte.
          </CardText>
        </CardLayout>
      ),
    },
    {
      id: 'demo-numbers',
      theme: 'sunset',
      durationMs,
      ariaLabel: 'Hai fatto 1.234 commit quest’anno, in 87 giorni diversi.',
      render: ({ exporting }) => (
        <CardLayout>
          <Kicker>Numeri chiave</Kicker>
          <BigNumber value={1234} exporting={exporting} label="commit quest’anno" />
          <CardText>
            Sparsi su <strong>87 giorni</strong> diversi. La tastiera ringrazia.
          </CardText>
        </CardLayout>
      ),
    },
    {
      id: 'demo-badge',
      theme: 'lime',
      durationMs,
      ariaLabel: 'Badge sbloccato: Gufo notturno. Il 38% dei tuoi commit è arrivato dopo le 22.',
      render: ({ exporting }) => (
        <CardLayout align="start">
          <Kicker>Badge sbloccato</Kicker>
          <DisplayTitle size="xl">Gufo notturno</DisplayTitle>
          <BigNumber value={38} unit="%" maxSize={22} exporting={exporting} />
          <CardText>dei tuoi commit è arrivato dopo le 22. La luna è la tua CI.</CardText>
        </CardLayout>
      ),
    },
  ];
}

const endButton =
  'gw-control rounded-full bg-white px-6 py-3 font-display text-lg font-bold text-black hover:bg-white/85';

/** Storia di prova con 3 card finte, servita su `#/dev/story`. */
export function StoryDemo() {
  const [cards] = useState(() => demoCards(demoDuration()));
  const [state, setState] = useState<'playing' | 'complete' | 'closed'>('playing');
  const [run, setRun] = useState(0);
  const [overlayClicks, setOverlayClicks] = useState(0);

  if (state !== 'playing') {
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div
          className="flex flex-col items-center gap-6"
          role="status"
          data-testid="story-demo-end"
        >
          <p className="font-display text-4xl font-extrabold">
            {state === 'complete' ? 'Fine della storia' : 'Storia chiusa'}
          </p>
          <button
            type="button"
            className={endButton}
            onClick={() => {
              setRun((r) => r + 1);
              setState('playing');
            }}
          >
            Rivedi la storia
          </button>
        </div>
      </main>
    );
  }

  return (
    <StoryPlayer
      key={run}
      label="Storia di prova"
      cards={cards}
      onClose={() => setState('closed')}
      onComplete={() => setState('complete')}
      renderOverlay={() => (
        <button
          type="button"
          className="gw-control rounded-full bg-black/70 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-black/85"
          data-testid="story-demo-overlay-button"
          onClick={() => setOverlayClicks((n) => n + 1)}
        >
          Azione di prova ({overlayClicks})
        </button>
      )}
    />
  );
}
