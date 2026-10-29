import {
  AWARD_IDS,
  BADGE_IDS,
  CARD_IDS,
  PERSONALITY_IDS,
  UI_KEYS,
  type CopyCatalog,
  type CopyPlaceholder,
  type CopySection,
} from '@git-wrapped/contracts';

/**
 * Catalogo dei testi italiani. Questo è lo stub di A0: ogni voce è un segnaposto
 * `[chiave]` perché il resto dell'app possa già leggere i testi. A4 lo sostituisce.
 */

const stub = (key: string) => `[${key}]`;
const fill = <K extends string, V>(keys: readonly K[], make: (k: K) => V) =>
  Object.fromEntries(keys.map((k) => [k, make(k)])) as Record<K, V>;
const many = (key: string, n: number) => Array.from({ length: n }, (_, i) => stub(`${key}.${i}`));

export const copy: CopyCatalog = {
  badges: fill(BADGE_IDS, (k) => ({
    title: stub(`badges.${k}.title`),
    description: stub(`badges.${k}.description`),
  })),
  personalities: fill(PERSONALITY_IDS, (k) => ({
    name: stub(`personalities.${k}.name`),
    description: stub(`personalities.${k}.description`),
    emoji: '✨',
  })),
  awards: fill(AWARD_IDS, (k) => ({
    title: stub(`awards.${k}.title`),
    description: stub(`awards.${k}.description`),
  })),
  cards: fill(CARD_IDS, (k) => ({
    title: stub(`cards.${k}.title`),
    subtitle: stub(`cards.${k}.subtitle`),
  })),
  horoscope: {
    openings: many('horoscope.openings', 14),
    middles: many('horoscope.middles', 14),
    closings: many('horoscope.closings', 14),
  },
  loading: many('loading', 8),
  intro: many('intro', 3),
  outro: many('outro', 3),
  ui: fill(UI_KEYS, (k) => stub(`ui.${k}`)),
};

/**
 * Sostituisce i segnaposto `{nome}` con i valori. I segnaposto ammessi per sezione
 * sono tipizzati da `COPY_PLACEHOLDERS`; quelli senza valore restano visibili.
 */
export function format<S extends CopySection>(
  _section: S,
  template: string,
  vars: Partial<Record<CopyPlaceholder<S>, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = (vars as Record<string, string | number | undefined>)[name];
    return value === undefined ? match : String(value);
  });
}

/** Oroscopo deterministico: una frase per gruppo, scelta dal seme. */
export function horoscope(seed: number, catalog: CopyCatalog = copy): [string, string, string] {
  const { openings, middles, closings } = catalog.horoscope;
  const pick = (list: string[], salt: number) => list[((seed >>> 0) ^ salt) % list.length] ?? '';
  return [pick(openings, 0), pick(middles, 0x9e3779b9 >>> 0), pick(closings, 0x85ebca6b)];
}
