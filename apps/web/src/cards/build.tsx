import { copy, format } from '@git-wrapped/copy';
import type { BuildStoryCards, StoryCard } from '../shared/types';
import { Frame } from './ui';
import { CARD_SPECS, type CardContext, type CardSpec } from './specs';

function texts(spec: CardSpec, ctx: CardContext) {
  const { stats } = ctx;
  const c = copy.cards[spec.id];
  const vars = { name: stats.member.displayName, value: spec.value(ctx), year: stats.year };
  return {
    title: format('cards', c.title, vars),
    subtitle: format('cards', c.subtitle, vars),
  };
}

function CardView({
  spec,
  ctx,
  exporting,
}: {
  spec: CardSpec;
  ctx: CardContext;
  exporting: boolean;
}) {
  const { title, subtitle } = texts(spec, ctx);
  return (
    <Frame theme={spec.theme} title={title} subtitle={subtitle}>
      <spec.Body ctx={ctx} exporting={exporting} />
    </Frame>
  );
}

/** `ariaLabel`: titolo, sottotitolo e tutti i dati della card in testo. */
function ariaLabelOf(spec: CardSpec, ctx: CardContext): string {
  const { title, subtitle } = texts(spec, ctx);
  return [title, subtitle, ...spec.facts(ctx)].filter((s) => s.trim().length > 0).join('. ');
}

/**
 * Costruisce le card nell'ordine di `CARD_IDS`.
 * Sempre presenti tranne `calendar`, che manca se `calendar` è `null`. Le altre card, senza dati,
 * restano ma mostrano uno stato vuoto neutro (simbolo, nessun numero inventato).
 */
export const buildStoryCards: BuildStoryCards = ({ stats, calendar }) => {
  const ctx: CardContext = { stats, calendar };
  return CARD_SPECS.filter((spec) => spec.id !== 'calendar' || calendar !== null).map(
    (spec): StoryCard => ({
      id: spec.id,
      ariaLabel: ariaLabelOf(spec, ctx),
      durationMs: spec.durationMs,
      theme: spec.theme,
      render: ({ exporting }) => <CardView spec={spec} ctx={ctx} exporting={exporting} />,
    }),
  );
};
