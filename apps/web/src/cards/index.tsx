import { copy } from '@git-wrapped/copy';
import type { BuildStoryCards, CardExportButtonProps } from '../shared/types';

/** Card ed export (A7). Stub di A0: firme congelate, contenuto minimo. */

export const buildStoryCards: BuildStoryCards = ({ stats }) => [
  {
    id: 'intro',
    ariaLabel: `${copy.cards.intro.title} ${stats.member.displayName}`,
    theme: 'electric',
    render: () => <h1>{stats.member.displayName}</h1>,
  },
];

export function CardExportButton({ fileName }: CardExportButtonProps) {
  return (
    <button type="button" disabled data-file-name={fileName}>
      {copy.ui.download_png}
    </button>
  );
}
