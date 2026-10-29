import { describe, expect, it } from 'vitest';
import { COPY_MAX_LENGTH, COPY_PLACEHOLDERS, copyCatalogSchema } from '@git-wrapped/contracts';
import type { CopySection } from '@git-wrapped/contracts';
import { copy, format, horoscope } from './index';

function strings(section: CopySection): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key?: string) => {
    if (typeof v === 'string') {
      if (key !== 'emoji') out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(copy[section]);
  return out;
}
const sections = Object.keys(COPY_PLACEHOLDERS) as CopySection[];

describe('catalogo testi', () => {
  it('rispetta lo schema', () => {
    expect(() => copyCatalogSchema.parse(copy)).not.toThrow();
  });

  it.each(sections)('%s: lunghezza, stub e segnaposto', (section) => {
    const allowed: readonly string[] = COPY_PLACEHOLDERS[section];
    for (const s of strings(section)) {
      expect(s.length, s).toBeLessThanOrEqual(COPY_MAX_LENGTH);
      expect(s, s).not.toMatch(/[[\]]/);
      for (const m of s.matchAll(/\{(\w+)\}/g)) expect(allowed, s).toContain(m[1]);
      expect(s.replace(/\{\w+\}/g, ''), s).not.toMatch(/[{}]/);
    }
  });

  it('non usa forme marcate per genere rivolte alla persona', () => {
    const all = sections.flatMap(strings).join('\n');
    expect(all).not.toMatch(/\b(sei stat[oa]|bravo|brava|pront[oa]|contento|contenta)\b/i);
  });
});

describe('format', () => {
  it('sostituisce i segnaposto e lascia quelli senza valore', () => {
    expect(format('cards', 'Ciao {name}, {year}', { name: 'Ada', year: 2026 })).toBe(
      'Ciao Ada, 2026',
    );
    expect(format('cards', '{value} e {name}', { value: 3 })).toBe('3 e {name}');
  });
});

describe('horoscope', () => {
  it('è deterministico', () => {
    expect(horoscope(2840193771)).toEqual(horoscope(2840193771));
  });

  it('copre tutte le frasi al variare del seme', () => {
    const seen = [new Set<string>(), new Set<string>(), new Set<string>()];
    for (let seed = 0; seed < 5000; seed++) {
      horoscope(seed * 2654435761).forEach((p, i) => seen[i]!.add(p));
    }
    expect(seen[0]!.size).toBe(copy.horoscope.openings.length);
    expect(seen[1]!.size).toBe(copy.horoscope.middles.length);
    expect(seen[2]!.size).toBe(copy.horoscope.closings.length);
    expect([...seen[0]!, ...seen[1]!, ...seen[2]!]).not.toContain('');
  });
});
