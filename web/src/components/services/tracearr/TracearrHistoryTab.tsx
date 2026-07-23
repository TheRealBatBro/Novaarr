import { useMemo, useState } from 'react';
import { Play, Clock, Users, Film, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { cn, timeAgo } from '@/lib/utils';
import {
  tracearrImageUrl,
  formatMsDuration,
  historyDisplayTitle,
  historySubtitle,
  type TracearrSessionHistory,
} from './TracearrShared';
import type { ServiceInstance } from '@/lib/api';

type HistoryResponse = { data?: TracearrSessionHistory[]; meta?: { total: number } };

const FILTERS = ['all', 'movie', 'episode', 'track'] as const;
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = { all: 'All', movie: 'Movies', episode: 'Shows', track: 'Music' };

function StatTile({ icon: Icon, value, label }: { icon: typeof Play; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xl font-bold leading-tight tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function TracearrHistoryTab({ instance }: { instance: ServiceInstance }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const startDate = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), []);

  const { data, isLoading } = useServiceProxy<HistoryResponse>(instance, {
    path: '/api/v1/public/history',
    query: { pageSize: '100', startDate, ...(filter !== 'all' ? { mediaType: filter } : {}) },
    refetchInterval: false,
  });

  const items = data?.data?.data ?? [];
  const totalPlays = data?.data?.meta?.total ?? items.length;
  const watchSeconds = items.reduce((sum, i) => sum + Number(i.durationMs ?? 0) / 1000, 0);
  const uniqueUsers = new Set(items.map((i) => i.user.id)).size;
  const uniqueTitles = new Set(items.map((i) => historyDisplayTitle(i))).size;

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">Watch History (last 7 days)</h2>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatTile icon={Play} value={totalPlays} label="Total Plays" />
        <StatTile icon={Clock} value={`${Math.floor(watchSeconds / 3600)}h ${Math.floor((watchSeconds % 3600) / 60)}m`} label="Watch Time" />
        <StatTile icon={Users} value={uniqueUsers} label="Unique Users" />
        <StatTile icon={Film} value={uniqueTitles} label="Unique Titles" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === f ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">No history in the last 7 days.</p>}
        {items.map((item) => {
          const posterUrl = tracearrImageUrl(instance, item.posterUrl);
          const progress = Number(item.progressMs ?? 0);
          const total = Number(item.totalDurationMs ?? item.durationMs ?? 0);
          const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;
          return (
            <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-2.5">
              <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {posterUrl && <img src={posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span
                  className={cn(
                    'absolute bottom-1 left-1 rounded px-1 py-0.5 text-[9px] font-semibold text-white',
                    item.watched ? 'bg-success' : 'bg-primary',
                  )}
                >
                  {item.watched ? 'Watched' : 'Engaged'}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold leading-tight">{historyDisplayTitle(item)}</p>
                  <span className="shrink-0 pl-2 text-right text-xs text-muted-foreground">
                    {new Date(item.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    <br />
                    {new Date(item.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{historySubtitle(item)}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {item.user.avatarUrl ? <img src={item.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-2.5 w-2.5" />}
                  </span>
                  <span className="truncate">{item.user.username}</span>
                  {item.device && (
                    <>
                      <span>·</span>
                      <span className="truncate">{item.device}</span>
                    </>
                  )}
                  {item.platform && (
                    <>
                      <span>·</span>
                      <span className="shrink-0">{item.platform}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-0.5 text-xs">
                  <span className="flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 font-medium text-muted-foreground">
                    <Play className="h-2.5 w-2.5" />
                    {item.isTranscode ? 'Transcode' : 'Direct Play'}
                  </span>
                  {item.durationMs && <span className="text-muted-foreground">{formatMsDuration(item.durationMs)}</span>}
                  <span className="flex-1" />
                  <span className="tabular-nums text-muted-foreground">{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
