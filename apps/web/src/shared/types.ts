import type { ReactNode } from 'react';
import type { CalendarStats, WrappedStats } from '@git-wrapped/contracts';

/**
 * Interfacce tra i moduli del frontend, congelate a `contracts-v1`.
 * - A6 (`story/`, `theme/`) implementa `StoryPlayerProps` e `ThemeName`.
 * - A7 (`cards/`) implementa `BuildStoryCards` e `CardExportButtonProps`.
 * - A8 (`calendar/`) implementa `CalendarUploadProps`.
 */

/** Palette di sfondo di una card, definite da A6 in `theme/`. */
export type ThemeName = 'electric' | 'sunset' | 'lime' | 'ocean' | 'candy' | 'midnight';

export interface StoryCard {
  /** Identificatore stabile: un `CardId` dei contratti o un id libero (es. `badge-night_owl`). */
  id: string;
  /** Testo completo della card letto dagli screen reader. */
  ariaLabel: string;
  /** Durata dell'avanzamento automatico. Default 6000 ms. */
  durationMs?: number;
  theme: ThemeName;
  /**
   * Contenuto della card. Riceve `exporting: true` quando viene renderizzata per il PNG
   * (niente animazioni, valori finali). Si adatta a un contenitore 9:16 qualsiasi.
   */
  render: (props: { exporting: boolean }) => ReactNode;
}

export interface StoryPlayerProps {
  cards: StoryCard[];
  initialIndex?: number;
  /** Etichetta accessibile dell'intera storia. */
  label: string;
  onClose?: () => void;
  /** Chiamata quando si supera l'ultima card. */
  onComplete?: () => void;
  /** Contenuto sovrapposto alla card corrente, fuori dall'area di tap (es. bottone export di A7). */
  renderOverlay?: (card: StoryCard, index: number) => ReactNode;
}

export interface BuildStoryCardsInput {
  stats: WrappedStats;
  /** `null` se l'utente non ha caricato il calendario: la card calendario viene saltata. */
  calendar: CalendarStats | null;
}
export type BuildStoryCards = (input: BuildStoryCardsInput) => StoryCard[];

export interface CardExportButtonProps {
  card: StoryCard;
  /** Nome del file senza estensione, es. `git-wrapped-2026-key_numbers`. */
  fileName: string;
}

export interface CalendarUploadProps {
  year: number;
  /** Commit dell'anno, per il rapporto riunioni/commit. */
  commits: number | null;
  onStats: (stats: CalendarStats) => void;
  onSkip: () => void;
}
