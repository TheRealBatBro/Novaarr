// Dashboard widgets that fan out one request per poster (Trakt lists resolving art through
// Overseerr, the recommendations widget resolving TMDB ids) used a bare Promise.all — fine for
// a handful of items, but with 4 Trakt carousels × ~15 items each, a single dashboard load could
// fire 40-60 simultaneous proxy requests. On a slower/higher-latency connection (reported on
// mobile) that's enough to make unrelated, otherwise-cheap requests (a plain Radarr/Sonarr list
// call) queue behind them and blow their own timeout. Capping concurrency spreads the same work
// out over time instead of firing it all at once.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
