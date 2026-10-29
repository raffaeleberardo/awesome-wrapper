import type { Member, RawActivity } from '@git-wrapped/contracts';

/**
 * Dati demo: un team finto, mai persone reali. Stub di A0; A5 lo sostituisce con
 * 8 sviluppatori e un anno di attività generato con seed fisso.
 * Deve restare importabile sia da Node sia dal browser: niente `fs` a runtime.
 */

export const DEMO_YEAR = 2026;

/** Membri del team demo, nell'ordine in cui compaiono nella lista. */
export const demoMembers: Member[] = [];

/** Attività grezza per username. */
export const demoActivities: Record<string, RawActivity> = {};

/** Contenuto di un file .ics di esempio (riunioni ricorrenti, call Teams, inviti rifiutati). */
export const sampleIcs = '';
