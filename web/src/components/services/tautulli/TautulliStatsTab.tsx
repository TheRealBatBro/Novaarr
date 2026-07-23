import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { tautulliImageUrl } from './TautulliShared';
import type { ServiceInstance } from '@/lib/api';

type StatRow = { title: string; year?: number; total_plays?: number; users_watched?: number; thumb?: string; grandparent_thumb?: string; media_type: string };
type StatBlock = { stat_id: string; stat_title: string; rows: StatRow[] };
type HomeStatsResponse = { response?: { result: string; data?: StatBlock } };

const TIMEFRAMES = ['7', '30', '90', '365'] as const;
const TIMEFRAME_LABEL: Record<(typeof TIMEFRAMES)[number], string> = { '7': 'Last Week', '30': 'Last Month', '90': 'Last 3 Months', '365': 'Last Year' };

const STAT_IDS = [
  { id: 'top_movies', title: 'Most Watched Movies', column: 'Plays', valueKey: 'total_plays' as const },
  { id: 'popular_movies', title: 'Most Popular Movies', column: 'Users', valueKey: 'users_watched' as const },
  { id: 'top_tv', title: 'Most Watched TV Shows', column: 'Plays', valueKey: 'total_plays' as const },
  { id: 'popular_tv', title: 'Most Popular TV Shows', column: 'Users', valueKey: 'users_watched' as const },
];

function StatSection({ instance, statId, title, column, valueKey, timeRange }: { instance: ServiceInstance; statId: string; title: string; column: string; valueKey: 'total_plays' | 'users_watched'; timeRange: string }) {
  const { data, isLoading } = useServiceProxy<HomeStatsResponse>(instance, {
    path: '/api/v2',
    query: { cmd: 'get_home_stats', time_range: timeRange, stats_count: '5', stat_id: statId },
    refetchInterval: false,
  });

  const rows = data?.data?.response?.data?.rows ?? [];

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span>{column}</span>
      </div>
      {isLoading && <Skeleton className="h-32 w-full rounded-lg" />}
      {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">No data for this period.</p>}
      {!isLoading && rows.length > 0 && (
        <div className="flex gap-3">
          <div className="h-32 w-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-muted">
            {(() => {
              const url = tautulliImageUrl(instance, rows[0].thumb || rows[0].grandparent_thumb, { width: 150, height: 225 });
              return url ? <img src={url} alt={rows[0].title} className="h-full w-full object-cover" /> : null;
            })()}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-muted-foreground">{i + 1}</span>
                  <span className="truncate">{r.title}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{r[valueKey]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TautulliStatsTab({ instance }: { instance: ServiceInstance }) {
  const [timeRange, setTimeRange] = useState<(typeof TIMEFRAMES)[number]>('30');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Watch Statistics</h2>
          <p className="text-sm text-muted-foreground">Within the specified timeframe…</p>
        </div>
        <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as (typeof TIMEFRAMES)[number])} className="w-40 shrink-0">
          {TIMEFRAMES.map((t) => (
            <option key={t} value={t}>
              {TIMEFRAME_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      {STAT_IDS.map((s) => (
        <StatSection key={s.id} instance={instance} statId={s.id} title={s.title} column={s.column} valueKey={s.valueKey} timeRange={timeRange} />
      ))}
    </div>
  );
}
