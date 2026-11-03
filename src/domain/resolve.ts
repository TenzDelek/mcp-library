/**
 * Bounded fan-out for "resolve N related ids" lookups. Failures are dropped
 * (the key is simply absent from the result) so one missing record never
 * fails a whole tool call.
 */
export interface ResolveOptions {
  /** Maximum number of distinct keys resolved; the rest are ignored. */
  cap?: number;
  concurrency?: number;
}

export async function resolveMany<K, V>(
  keys: Iterable<K>,
  fn: (key: K) => Promise<V>,
  opts: ResolveOptions = {},
): Promise<Map<K, V>> {
  const cap = opts.cap ?? 10;
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const unique = Array.from(new Set(keys)).slice(0, cap);
  const out = new Map<K, V>();
  let next = 0;
  async function worker(): Promise<void> {
    while (next < unique.length) {
      const key = unique[next++]!;
      try {
        out.set(key, await fn(key));
      } catch {
        // dropped on purpose
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return out;
}

/** Memoizes an async lookup by key for the lifetime of one tool call. */
export function memoize<K, V>(fn: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return (key) => {
    let p = cache.get(key);
    if (!p) {
      p = fn(key);
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    return p;
  };
}
