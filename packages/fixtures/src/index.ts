import type { Member, RawActivity } from '@git-wrapped/contracts';
import teamData from '../data/team.json' with { type: 'json' };
import sampleIcsData from '../data/sample-ics.json' with { type: 'json' };

/**
 * Dati demo: un team finto, mai persone reali. Generati da `scripts/generate.ts`
 * (seed fisso, riproducibili) e salvati in `data/`. Non usano `fs`: funzionano
 * sia in Node sia nel browser.
 */

export const DEMO_YEAR = 2026;

/** Membri del team demo, nell'ordine in cui compaiono nella lista. */
export const demoMembers: Member[] = teamData.members;

/**
 * Attività grezza per username (per l'anno `DEMO_YEAR`). Il cast è sicuro perché
 * `src/fixtures.test.ts` valida ogni voce con `rawActivitySchema`.
 */
export const demoActivities = teamData.activities as unknown as Record<string, RawActivity>;

/** Contenuto di un file .ics di esempio (riunioni ricorrenti, call Teams, inviti rifiutati). */
export const sampleIcs: string = sampleIcsData;
