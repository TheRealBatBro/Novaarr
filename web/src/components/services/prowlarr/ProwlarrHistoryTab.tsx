import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { type ServiceInstance } from '@/lib/api';
import { timeAgo, cn } from '@/lib/utils';

type ProwlarrHistoryRecord = {
  id: number;
  indexerId: number;
  date: string;
  successful: boolean;
  eventType: string;
  data?: { query?: string; grabTitle?: string; source?: string };
};
type ProwlarrHistoryResponse = { records?: ProwlarrHistoryRecord[] };
type ProwlarrIndexerLite = { id: number; name: string };

const EVENT_LABEL: Record<string, string> = {
  indexerQuery: 'Query',
  releaseGrabbed: 'Grabbed',
  indexerRss: 'RSS Sync',
  indexerAuth: 'Auth',
  indexerIgnoredResult: 'Ignored',
};

export function ProwlarrHistoryTab({ instance }: { instance: ServiceInstance }) {
  const { data, isLoading } = useServiceProxy<ProwlarrHistoryResponse>(instance, {
    path: '/api/v1/history',
    query: { page: '1', pageSize: '50', sortKey: 'date', sortDirection: 'descending' },
    refetchInterval: 30_000,
  });
  // Shares the Indexers tab's query cache (same instance + path) — history rows only carry an
  // indexerId, not a name, so this is the only way to show something better than a raw number.
  const { data: indexersResp } = useServiceProxy<ProwlarrIndexerLite[]>(instance, { path: '/api/v1/indexer', refetchInterval: 60_000 });
  const indexerNames = new Map(
    (indexersResp?.ok && Array.isArray(indexersResp.data) ? indexersResp.data : []).map((ix) => [ix.id, ix.name]),
  );

  const records = data?.ok && Array.isArray(data.data?.records) ? data.data!.records! : [];

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">Recent Activity</h2>
      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        {!isLoading && records.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        {!isLoading &&
          records.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', r.successful ? 'bg-success' : 'bg-destructive')} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.data?.grabTitle || r.data?.query || EVENT_LABEL[r.eventType] || r.eventType}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {indexerNames.get(r.indexerId) ?? `Indexer #${r.indexerId}`} · {EVENT_LABEL[r.eventType] ?? r.eventType} · {timeAgo(r.date)}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
