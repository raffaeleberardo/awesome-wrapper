/** Utilità sulle date: normalizzazione ISO con offset e anno nel fuso configurato. */

const formatters = new Map<string, Intl.DateTimeFormat>();

function yearFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' });
    formatters.set(timeZone, f);
  }
  return f;
}

/**
 * Normalizza una data GitLab in ISO 8601 con offset.
 * Senza offset si assume UTC; `+0100` diventa `+01:00`. Ritorna `null` se non è una data.
 */
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim();
  if (/[+-]\d{4}$/.test(v)) v = `${v.slice(0, -2)}:${v.slice(-2)}`;
  else if (!/(Z|[+-]\d{2}:\d{2})$/i.test(v)) v = v.length === 10 ? `${v}T00:00:00Z` : `${v}Z`;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

/** Anno di calendario dell'istante dato, nel fuso `timeZone`. */
export function yearInZone(iso: string, timeZone: string): number {
  return Number(yearFormatter(timeZone).format(new Date(iso)));
}

/** Finestra larga attorno all'anno per le query: poi si filtra esattamente con `yearInZone`. */
export function marginWindow(year: number): {
  from: string;
  to: string;
  afterDate: string;
  beforeDate: string;
} {
  return {
    from: `${year - 1}-12-30T00:00:00Z`,
    to: `${year + 1}-01-02T00:00:00Z`,
    // `after`/`before` degli eventi sono date esclusive
    afterDate: `${year - 1}-12-30`,
    beforeDate: `${year + 1}-01-03`,
  };
}
