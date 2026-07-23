import { useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { cn, timeAgo } from '@/lib/utils';
import { tautulliImageUrl, historySubtitle, historyDisplayTitle, type TautulliHistoryItem } from './TautulliShared';
import type { ServiceInstance } from '@/lib/api';

type TautulliHistoryResponse = { response?: { result: string; data?: { data?: TautulliHistoryItem[]; recordsFiltered?: number } } };

const PAGE_SIZE = 25;

export function TautulliHistoryTab({ instance }: { instance: ServiceInstance }) {
  const [length, setLength] = useState(PAGE_SIZE);
  const { data, isLoading } = useServiceProxy<TautulliHistoryResponse>(instance, {
    path: '/api/v2',
    query: { cmd: 'get_history', order_column: 'date', order_dir: 'desc', start: '0', length: String(length) },
    refetchInterval: false,
  });

  const items = data?.data?.response?.data?.data ?? [];
  const total = data?.data?.response?.data?.recordsFiltered ?? 0;

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold tracking-tight">{total} History Item{total === 1 ? '' : 's'}</h2>

      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
        {items.map((item) => {
          const posterUrl = tautulliImageUrl(instance, item.thumb, { width: 150, height: 225 });
          const tone = item.watched_status >= 1 ? 'bg-success' : item.watched_status > 0 ? 'bg-primary' : 'bg-muted-foreground/40';
          return (
            <div key={item.id} className="relative flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-2.5">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {posterUrl ? (
                  <img src={posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <p className="truncate font-semibold leading-tight">{historyDisplayTitle(item)}</p>
                <p className="truncate text-sm text-muted-foreground">{historySubtitle(item)}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {item.user_thumb ? <img src={item.user_thumb} alt="" className="h-full w-full object-cover" /> : <User className="h-2.5 w-2.5" />}
                  </span>
                  <span className="truncate">{item.friendly_name}</span>
                  <span>·</span>
                  <span className="shrink-0">{timeAgo(new Date(item.date * 1000).toISOString())}</span>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                <div className={cn('h-full', tone)} style={{ width: `${Math.min(100, item.percent_complete)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && items.length < total && (
        <Button variant="outline" className="mt-4 w-full" onClick={() => setLength((l) => l + PAGE_SIZE)}>
          Load more
        </Button>
      )}
    </div>
  );
}
