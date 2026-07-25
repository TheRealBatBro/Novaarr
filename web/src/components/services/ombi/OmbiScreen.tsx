import { useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { WolButton } from '@/components/shared/WolButton';
import { useServiceProxy } from '@/lib/queries';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import type { ServiceInstance } from '@/lib/api';
import { OmbiRequestRow } from './OmbiRequestRow';
import { OmbiRequestDialog } from './OmbiRequestDialog';
import { useOmbiSearch, OmbiSearchResultRow, type OmbiCombinedResult } from './OmbiSearch';
import type { OmbiRequest, OmbiRequestCount } from './OmbiShared';

const Icon = getServiceIcon('ombi');

const FILTERS = ['pending', 'approved', 'available', 'denied'] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { pending: 'Pending', approved: 'Approved', available: 'Available', denied: 'Denied' };

export function OmbiScreen({ instance }: { instance: ServiceInstance }) {
  const [tab, setTab] = useState<'search' | 'requests'>('requests');
  useResetScrollOnChange(tab);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OmbiCombinedResult[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [openResult, setOpenResult] = useState<OmbiCombinedResult | null>(null);

  const { data: countResp, isLoading: countLoading } = useServiceProxy<OmbiRequestCount>(instance, {
    path: '/api/v1/Request/count',
    refetchInterval: 15000,
  });

  // Ombi's V2 request-list endpoint takes the status filter as a literal path segment
  // (pending/approved/available/denied/...) — confirmed from RequestsController (V2) source.
  // The trailing count/position/sort/sortOrder segments are real params, but their exact
  // value domain wasn't verified against a live instance — best-effort defaults.
  const { data: movieResp, isLoading: moviesLoading } = useServiceProxy<OmbiRequest[]>(instance, {
    path: `/api/v2/Requests/movie/${filter}/50/0/Requested/Desc`,
    refetchInterval: 15000,
    enabled: tab === 'requests',
  });
  const { data: tvResp, isLoading: tvLoading } = useServiceProxy<OmbiRequest[]>(instance, {
    path: `/api/v2/Requests/tv/${filter}/50/0/Requested/Desc`,
    refetchInterval: 15000,
    enabled: tab === 'requests',
  });

  const status: ServiceStatus = countLoading ? 'unknown' : countResp?.ok ? 'online' : 'offline';
  const count = countResp?.data;
  const requestsLoading = moviesLoading || tvLoading;
  const requests = [...(Array.isArray(movieResp?.data) ? movieResp!.data : []), ...(Array.isArray(tvResp?.data) ? tvResp!.data : [])].sort(
    (a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime(),
  );

  const search = useOmbiSearch(instance);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    search.mutate(q, {
      onSuccess: (res) => {
        if (!res.ok) {
          toast.error(res.error || 'Search failed');
          setResults([]);
          return;
        }
        setResults(res.data ?? []);
      },
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#e3720022', color: '#e37200' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {status === 'offline' ? 'Unreachable' : count ? `${count.pending} pending · ${count.available} available` : 'Requests & discovery'}
          </p>
        </div>
        <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} className="ml-auto" />
      </div>

      <div className="mb-4 flex gap-1.5">
        {(['requests', 'search'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
              tab === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <>
          <form onSubmit={handleSearch} className="mb-4 flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search movies or TV shows…" className="flex-1" />
            <Button type="submit" disabled={search.isPending || !query.trim()}>
              Search
            </Button>
          </form>
          <div className="flex flex-col gap-2">
            {search.isPending && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            {!search.isPending && results === null && <p className="text-sm text-muted-foreground">Search for something to get started.</p>}
            {!search.isPending && results !== null && results.length === 0 && <p className="text-sm text-muted-foreground">No results.</p>}
            {!search.isPending &&
              results?.map((r) => (
                <OmbiSearchResultRow key={`${r.mediaType}-${r.id}`} result={r} onClick={() => setOpenResult(r)} />
              ))}
          </div>
        </>
      )}

      {openResult && <OmbiRequestDialog instance={instance} result={openResult} onClose={() => setOpenResult(null)} />}

      {tab === 'requests' && (
        <>
          <div className="mb-4 flex gap-1.5">
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
            {requestsLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            {!requestsLoading && requests.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
            {requests.map((req) => (
              <OmbiRequestRow key={req.id} request={req} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
