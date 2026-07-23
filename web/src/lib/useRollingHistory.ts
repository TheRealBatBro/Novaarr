import { useEffect, useState } from 'react';
import type { SparklinePoint } from '@/components/shared/Sparkline';

/**
 * Accumulates a rolling client-side history of a polled value, one point per poll tick
 * (keyed off the query's own dataUpdatedAt so flat/idle periods still advance in time).
 * Resets on page load — this is a live "since you opened this screen" view, not a
 * persisted historical stat, which sidesteps depending on any backend history endpoint.
 */
export function useRollingHistory(value: number | undefined, tick: number, maxPoints = 40): SparklinePoint[] {
  const [history, setHistory] = useState<SparklinePoint[]>([]);

  useEffect(() => {
    if (value === undefined || !tick) return;
    setHistory((prev) => {
      const next = [...prev, { t: tick, v: value }];
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
    // `tick` (query dataUpdatedAt) is the intentional trigger; `value` is read fresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return history;
}
