import http from 'node:http';
import https from 'node:https';
import { SourceError } from '../source';
import type { GitLabSourceConfig } from '../source';

/**
 * Client HTTP minimale per le API GitLab v4.
 * Usa `node:http(s)` (e non `fetch`) per poter passare una CA aziendale senza dipendenze extra.
 * Messaggi d'errore generici: mai token, username o URL completi.
 */

export interface RetryOptions {
  /** Tentativi totali per richiesta (primo incluso). */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Iniettabile nei test per non aspettare davvero. */
  sleep: (ms: number) => Promise<void>;
}

export interface ClientOptions {
  /** Richieste in parallelo verso GitLab (default 6). */
  concurrency?: number;
  retry?: Partial<RetryOptions>;
  /** Sorgente del jitter, 0..1 (default casuale). Iniettabile nei test. */
  random?: () => number;
}

export type Query = Record<string, string | number | boolean | undefined>;

type Headers = Record<string, string | string[] | undefined>;

interface RawResponse {
  status: number;
  headers: Headers;
  body: string;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Errore interno per risposte 4xx non fatali (es. 404), gestibile da chi chiama. */
export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`risposta HTTP ${status}`);
    this.name = 'HttpStatusError';
  }
}

export class GitLabClient {
  private readonly base: URL;
  private readonly retry: RetryOptions;
  private readonly random: () => number;
  private readonly maxParallel: number;
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  /** Numero di richieste HTTP effettuate (tentativi inclusi), per le note di performance. */
  requestCount = 0;

  constructor(
    private readonly config: GitLabSourceConfig,
    options: ClientOptions = {},
  ) {
    const url = new URL(config.url);
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/api/v4`;
    url.search = '';
    this.base = url;
    this.maxParallel = Math.max(1, options.concurrency ?? 6);
    this.random = options.random ?? Math.random;
    this.retry = {
      maxAttempts: 5,
      baseDelayMs: 500,
      maxDelayMs: 60_000,
      sleep: defaultSleep,
      ...options.retry,
    };
  }

  /** Singola GET; ritorna JSON e header. */
  async get<T>(path: string, query: Query = {}): Promise<{ data: T; headers: Headers }> {
    const url = new URL(this.base.href + path);
    this.applyQuery(url, query);
    return this.fetchJson<T>(url);
  }

  /** Come `get` ma ritorna `null` su 404 (risorsa assente o funzione non disponibile). */
  async getOrNull<T>(path: string, query: Query = {}): Promise<T | null> {
    try {
      return (await this.get<T>(path, query)).data;
    } catch (e) {
      if (e instanceof HttpStatusError && e.status === 404) return null;
      throw e;
    }
  }

  /**
   * Scarica tutte le pagine. Segue `Link: rel="next"` (keyset) oppure `x-next-page` (offset).
   * `maxPages` limita i casi patologici (diff enormi).
   */
  async getAll<T>(path: string, query: Query = {}, maxPages = Infinity): Promise<T[]> {
    const out: T[] = [];
    let url: URL | null = new URL(this.base.href + path);
    this.applyQuery(url, { per_page: 100, ...query });
    let pages = 0;
    while (url && pages < maxPages) {
      const res: { data: T[]; headers: Headers } = await this.fetchJson<T[]>(url);
      if (Array.isArray(res.data)) out.push(...res.data);
      pages++;
      url = this.nextUrl(url, res.headers);
    }
    return out;
  }

  /** Come `getAll` ma ritorna `[]` su 404. */
  async getAllOrEmpty<T>(path: string, query: Query = {}, maxPages = Infinity): Promise<T[]> {
    try {
      return await this.getAll<T>(path, query, maxPages);
    } catch (e) {
      if (e instanceof HttpStatusError && e.status === 404) return [];
      throw e;
    }
  }

  private applyQuery(url: URL, query: Query): void {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  private nextUrl(current: URL, headers: Headers): URL | null {
    const link = firstHeader(headers['link']);
    if (link) {
      const m = /<([^>]+)>\s*;\s*rel="next"/.exec(link);
      if (!m?.[1]) return null;
      // Si riusa solo path e query: l'host resta quello configurato.
      const parsed = new URL(m[1], current);
      return new URL(this.base.origin + parsed.pathname + parsed.search);
    }
    const nextPage = firstHeader(headers['x-next-page']);
    if (nextPage) {
      const next = new URL(current.href);
      next.searchParams.set('page', nextPage);
      return next;
    }
    return null;
  }

  private async fetchJson<T>(url: URL): Promise<{ data: T; headers: Headers }> {
    let lastStatus = 0;
    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
      let res: RawResponse | null;
      try {
        res = await this.limited(() => this.rawGet(url));
      } catch {
        // errore di rete: si ritenta come un 5xx
        res = null;
      }
      const status = res?.status ?? 0;
      lastStatus = status;
      if (res && status >= 200 && status < 300) {
        try {
          return { data: JSON.parse(res.body) as T, headers: res.headers };
        } catch {
          throw new SourceError('upstream_error', 'Risposta GitLab non valida');
        }
      }
      if (status === 401 || status === 403) {
        throw new SourceError('unauthorized', 'Accesso a GitLab non autorizzato');
      }
      const retriable = !res || status === 429 || status >= 500;
      if (!retriable) throw new HttpStatusError(status);
      if (attempt < this.retry.maxAttempts) {
        await this.retry.sleep(this.delayFor(attempt, res));
      }
    }
    if (lastStatus === 429) {
      throw new SourceError('rate_limited', 'Limite di richieste GitLab raggiunto');
    }
    throw new SourceError('upstream_error', 'GitLab non risponde correttamente');
  }

  /** Backoff esponenziale con jitter; `Retry-After` ha la precedenza se più lungo. */
  private delayFor(attempt: number, res: RawResponse | null): number {
    const exp = this.retry.baseDelayMs * 2 ** (attempt - 1);
    let delay = exp + exp * 0.5 * this.random();
    const ra = res ? parseRetryAfter(firstHeader(res.headers['retry-after'])) : null;
    if (ra !== null) delay = Math.max(delay, ra);
    return Math.min(delay, this.retry.maxDelayMs);
  }

  private async limited<T>(fn: () => Promise<T>): Promise<T> {
    while (this.active >= this.maxParallel) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  private rawGet(url: URL): Promise<RawResponse> {
    this.requestCount++;
    const isHttps = url.protocol === 'https:';
    const doRequest = isHttps ? https.request : http.request;
    return new Promise((resolve, reject) => {
      const req = doRequest(
        url,
        {
          method: 'GET',
          headers: { 'PRIVATE-TOKEN': this.config.token, Accept: 'application/json' },
          ...(isHttps && this.config.caCert ? { ca: this.config.caCert } : {}),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            }),
          );
          res.on('error', reject);
        },
      );
      req.setTimeout(60_000, () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      req.end();
    });
  }
}

function firstHeader(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** `Retry-After` in secondi o data HTTP; ritorna millisecondi. */
export function parseRetryAfter(value: string | undefined): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** `map` con parallelismo limitato, ordine dei risultati preservato. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
