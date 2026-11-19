import "server-only";
import { trace } from "@opentelemetry/api";

type Entry<T> = { value: Promise<T>; expiresAt: number };

/**
 * In-memory TTL cache that also merges concurrent calls for the same key into
 * one upstream request. Failed loads are dropped, so errors are never cached.
 *
 * Why not Next's `'use cache'`: errors thrown inside it cross a serialization
 * boundary, and production builds hide their messages. Lookup errors must keep
 * their codes, so this small cache stays in our control.
 *
 * TODO: it is per server instance. With several instances or serverless, move
 * it to a shared store such as Redis (`'use cache: remote'` once errors are
 * returned as values rather than thrown).
 */
export function createCache<T>({ ttlMs, maxEntries = 500 }: { ttlMs: number; maxEntries?: number }) {
  const entries = new Map<string, Entry<T>>();

  return function cached(key: string, load: () => Promise<T>): Promise<T> {
    const hit = entries.get(key);
    const fresh = hit !== undefined && hit.expiresAt > Date.now();
    trace.getActiveSpan()?.setAttribute("cache.hit", fresh);
    if (fresh) return hit.value;

    const value = load();
    entries.delete(key); // re-insert so Map order stays oldest-first for eviction
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    return value;
  };
}
