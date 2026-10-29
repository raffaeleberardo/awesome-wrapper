import { describe, expect, it } from 'vitest';
import { BADGE_IDS, AWARD_IDS } from '@git-wrapped/contracts';
import { copy, format } from '@git-wrapped/copy';
import { awardValue, badgeValue, joinNames } from './format';
import { awardTexts } from '../team/AwardCard';

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

  it('i premi compongono i vincitori all’italiana e formattano value', () => {
    expect(joinNames(['Ada'])).toBe('Ada');
    expect(joinNames(['Ada', 'Bruno'])).toBe('Ada e Bruno');
    expect(joinNames(['Ada', 'Bruno', 'Carla'])).toBe('Ada, Bruno e Carla');
    expect(awardValue({ id: 'golden_broom', value: 2.918 })).toBe('2,92');
    expect(awardValue({ id: 'marathon_mr', value: 1.5 })).toBe('1,5');
    for (const id of AWARD_IDS) {
      const t = awardTexts({
        id,
        winners: [
          { username: 'a', displayName: 'Ada' },
          { username: 'b', displayName: 'Bruno' },
        ],
        value: 3,
        detail: '05:47',
      });
      expect(t.description, id).not.toMatch(/\{\w+\}|NaN|undefined|&/);
    }
  });
});
