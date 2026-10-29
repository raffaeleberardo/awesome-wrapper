import type { CopyCatalog, CopyPlaceholder, CopySection } from '@git-wrapped/contracts';
import { awards } from './awards';
import { badges } from './badges';
import { cards } from './cards';
import { horoscopeTexts } from './horoscope';
import { personalities } from './personalities';
import { intro, loading, outro, ui } from './ui';

/** Catalogo dei testi italiani, indicizzato con le chiavi dei contratti. */
export const copy: CopyCatalog = {
  badges,
  personalities,
  awards,
  cards,
  horoscope: horoscopeTexts,
  loading,
  intro,
  outro,
  ui,
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
  const pick = (list: string[], salt: number) =>
    list[(((seed >>> 0) ^ salt) >>> 0) % list.length] ?? '';
  return [pick(openings, 0), pick(middles, 0x9e3779b9 >>> 0), pick(closings, 0x85ebca6b)];
}
