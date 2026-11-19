import { describe, expect, it, vi } from "vitest";
import { createCache } from "./cache";

describe("createCache", () => {
  it("shares one load between concurrent callers and serves hits until expiry", async () => {
    vi.useFakeTimers();
    const cached = createCache<number>({ ttlMs: 1_000 });
    const load = vi.fn(async () => 42);
    await Promise.all([cached("k", load), cached("k", load)]);
    await cached("k", load);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_001);
    await cached("k", load);
    expect(load).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("never caches a failure", async () => {
    const cached = createCache<number>({ ttlMs: 60_000 });
    await expect(cached("k", async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    await expect(cached("k", async () => 1)).resolves.toBe(1);
  });
});
