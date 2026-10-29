/** Piccole utilità numeriche condivise dai moduli del motore. */

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, x));
}

export function round(x: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

/** Arrotonda per difetto: usato per le quote, così la somma non supera mai 1. */
export function floorTo(x: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.floor(x * f + 1e-9) / f;
}

/** Rapporto sicuro: 0 se il denominatore è 0. */
export function safeRatio(num: number, den: number): number {
  return den > 0 ? num / den : 0;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Fiducia nel campione: cresce linearmente fino a 1 quando `n` raggiunge `full`. */
export function confidence(n: number, full: number): number {
  return clamp01(n / full);
}

export function increment<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Voci di una mappa ordinate per conteggio decrescente e chiave crescente (deterministico). */
export function rankCounts(map: Map<string, number>, limit: number): [string, number][] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, limit);
}

/** Lunghezza in caratteri visibili (code point), non in unità UTF-16. */
export function charLength(s: string): number {
  return [...s].length;
}

export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
