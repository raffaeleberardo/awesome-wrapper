import type { StoryPlayerProps } from '../shared/types';
import { THEMES } from '../theme';

/**
 * Player a storie (A6). Stub di A0: mostra solo la prima card.
 * La firma di `StoryPlayer` è congelata; `StoryDemo` è la storia di prova servita su `#/dev/story`.
 */
export function StoryPlayer({ cards, label }: StoryPlayerProps) {
  const card = cards[0];
  if (!card) return null;
  const theme = THEMES[card.theme];
  return (
    <section aria-label={label} style={{ background: theme.background, color: theme.foreground }}>
      <div aria-label={card.ariaLabel}>{card.render({ exporting: false })}</div>
    </section>
  );
}

export function StoryDemo() {
  return (
    <StoryPlayer
      label="Storia di prova"
      cards={[
        { id: 'demo-1', ariaLabel: 'Card di prova', theme: 'electric', render: () => <p>1</p> },
      ]}
    />
  );
}
