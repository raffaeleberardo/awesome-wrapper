/**
 * PRNG deterministico (mulberry32). Stesso seed → stessa sequenza su ogni piattaforma.
 * Nessun `Math.random()` né `Date.now()` nel pacchetto fixtures.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Intero in [min, max], estremi inclusi. */
export function int(r: Rng, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1));
}

export function chance(r: Rng, p: number): boolean {
  return r() < p;
}

export function pick<T>(r: Rng, items: readonly T[]): T {
  const item = items[Math.floor(r() * items.length)];
  if (item === undefined) throw new Error('pick: lista vuota');
  return item;
}

/** Sceglie un elemento con probabilità proporzionale al peso. */
export function weighted<T>(r: Rng, items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let x = r() * total;
  for (const item of items) {
    x -= item.weight;
    if (x < 0) return item.value;
  }
  const last = items[items.length - 1];
  if (last === undefined) throw new Error('weighted: lista vuota');
  return last.value;
}

export function hex(r: Rng, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += int(r, 0, 15).toString(16);
  return out;
}
