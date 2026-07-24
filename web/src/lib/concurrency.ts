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

// The per-widget cap above only helps within a single widget's own fan-out — it doesn't stop
// several independent widgets that all happen to share one backend (e.g. Tautulli: its own
// Now Playing + Recently Watched + Recently Added + the recommendations widget's history and
// per-seed metadata calls) from all firing at once and piling onto that one service. Each proxy
// call funnels through here (see proxyApi.call in api.ts) and queues per service instance —
// unrelated services aren't slowed down by one busy one, and requests only actually go out once
// admitted, so a queued request's own timeout doesn't start ticking while it waits its turn.
const MAX_CONCURRENT_PER_INSTANCE = 3;
const instanceQueues = new Map<number, { active: number; waiting: (() => void)[] }>();

export async function runWithInstanceLimit<T>(instanceId: number, fn: () => Promise<T>): Promise<T> {
  let state = instanceQueues.get(instanceId);
  if (!state) {
    state = { active: 0, waiting: [] };
    instanceQueues.set(instanceId, state);
  }
  if (state.active >= MAX_CONCURRENT_PER_INSTANCE) {
    await new Promise<void>((resolve) => state!.waiting.push(resolve));
  }
  state.active++;
  try {
    return await fn();
  } finally {
    state.active--;
    const next = state.waiting.shift();
    if (next) next();
  }
}
