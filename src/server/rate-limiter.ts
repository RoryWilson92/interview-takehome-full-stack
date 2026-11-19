const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lets at most `limit` calls start in any rolling `windowMs`. Extra callers
 * wait in line instead of failing, which smooths out bursts before they
 * reach a rate-limited API.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const startTimes: number[] = [];
  let queue = Promise.resolve();

  return function acquire(): Promise<void> {
    const turn = queue.then(async () => {
      for (;;) {
        const now = Date.now();
        while (startTimes.length > 0 && now - startTimes[0] >= windowMs) startTimes.shift();
        if (startTimes.length < limit) {
          startTimes.push(now);
          return;
        }
        await sleep(windowMs - (now - startTimes[0]));
      }
    });
    queue = turn;
    return turn;
  };
}
