import { describe, expect, it } from 'vitest';
import { BADGE_IDS } from '@git-wrapped/contracts';
import { copy, format } from '@git-wrapped/copy';
import { badgeValue } from './format';

describe('unità di value tra motore (A3) e testi (A4)', () => {
  it('le quote dei badge diventano percentuali, il resto resta un numero', () => {
    expect(badgeValue('night_owl', 0.81)).toBe('81%');
    expect(badgeValue('early_bird', 1)).toBe('100%');
    expect(badgeValue('main_breaker', 14)).toBe('14');
    expect(badgeValue('novelist', 284.4)).toBe('284,4');
  });

  it('nessun testo di badge resta con segnaposto o valori non numerici', () => {
    for (const id of BADGE_IDS) {
      const text = format('badges', copy.badges[id].description, { value: badgeValue(id, 0.5) });
      expect(text, id).not.toMatch(/\{\w+\}|NaN|undefined/);
    }
  });
});
