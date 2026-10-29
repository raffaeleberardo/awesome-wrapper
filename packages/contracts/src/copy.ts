import { z } from 'zod';
import { awardIdSchema, badgeIdSchema, cardIdSchema, personalityIdSchema } from './catalog';

/**
 * Struttura del catalogo dei testi italiani (`packages/copy`).
 * I segnaposto sono scritti come `{nome}` e ogni sezione ammette solo quelli elencati
 * in `COPY_PLACEHOLDERS`. Ogni testo deve stare in 2 righe su telefono (≈ 90 caratteri).
 */

export const COPY_PLACEHOLDERS = {
  badges: ['value'],
  personalities: ['name'],
  awards: ['winner', 'value', 'detail'],
  cards: ['name', 'value', 'year'],
  horoscope: ['name', 'year'],
  loading: [],
  intro: ['name', 'year'],
  outro: ['name', 'year'],
  ui: ['name', 'year', 'value'],
} as const satisfies Record<string, readonly string[]>;
export type CopySection = keyof typeof COPY_PLACEHOLDERS;
export type CopyPlaceholder<S extends CopySection> = (typeof COPY_PLACEHOLDERS)[S][number];

/** Lunghezza massima consigliata di un singolo testo (2 righe su telefono). */
export const COPY_MAX_LENGTH = 90;

/** Testi fissi dell'interfaccia. */
export const UI_KEYS = [
  'app_title',
  'app_tagline',
  'demo_mode_banner',
  'pick_member',
  'pick_member_hint',
  'start_story',
  'loading_story',
  'download_png',
  'download_summary_png',
  'share_hint',
  'calendar_upload_title',
  'calendar_upload_hint',
  'calendar_privacy_note',
  'calendar_parsing',
  'calendar_error',
  'calendar_skip',
  'oscar_title',
  'oscar_cta',
  'error_generic',
  'error_not_found',
  'retry',
  'pause',
  'resume',
  'next',
  'previous',
  'close',
  'restart',
] as const;
export const uiKeySchema = z.enum(UI_KEYS);
export type UiKey = z.infer<typeof uiKeySchema>;

const text = z
  .string()
  .min(1)
  .max(COPY_MAX_LENGTH * 2);
const titleDescription = z.object({ title: text, description: text });

export const copyCatalogSchema = z.object({
  badges: z.record(badgeIdSchema, titleDescription),
  personalities: z.record(
    personalityIdSchema,
    z.object({ name: text, description: text, emoji: z.string().min(1) }),
  ),
  awards: z.record(awardIdSchema, titleDescription),
  cards: z.record(cardIdSchema, z.object({ title: text, subtitle: text })),
  /** Oroscopo combinabile: una frase per gruppo, scelta col seme. Almeno 42 frasi in tutto. */
  horoscope: z.object({
    openings: z.array(text).min(14),
    middles: z.array(text).min(14),
    closings: z.array(text).min(14),
  }),
  loading: z.array(text).min(8),
  intro: z.array(text).min(3),
  outro: z.array(text).min(3),
  ui: z.record(uiKeySchema, text),
});
export type CopyCatalog = z.infer<typeof copyCatalogSchema>;
