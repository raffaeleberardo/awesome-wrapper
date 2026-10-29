import { LRUCache } from 'lru-cache';

/**
 * Cache in memoria con TTL e deduplica delle richieste concorrenti in volo.
 * Gli errori non vengono memorizzati. Nessuna scrittura su disco.
 */
export class MemoCache<V> {
  // Valore «inscatolato»: lru-cache non accetta null (es. «membro senza dati»).
  private readonly cache: LRUCache<string, { value: V }>;
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(ttlMs: number, max = 500) {
    this.cache = new LRUCache<string, { value: V }>({ max, ttl: ttlMs });
  }

  async get(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit.value;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        this.cache.set(key, { value });
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

/** Esegue `fn` su ogni elemento con al massimo `limit` esecuzioni contemporanee. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
