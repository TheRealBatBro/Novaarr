import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useServiceProxy } from '@/lib/queries';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { OverseerrRequestRow, type OverseerrRequest } from './OverseerrRequestRow';
import { OverseerrIssueRow, type OverseerrIssue } from './OverseerrIssueRow';
import { OverseerrRequestDialog } from './OverseerrRequestDialog';
import { useOverseerrSearch, OverseerrSearchResultRow, TMDB_IMAGE, type OverseerrSearchResult } from './OverseerrSearch';

const Icon = getServiceIcon('overseerr');

const REQUEST_FILTERS = ['all', 'pending', 'approved', 'processing', 'available', 'unavailable', 'failed'] as const;
const REQUEST_FILTER_LABEL: Record<(typeof REQUEST_FILTERS)[number], string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  processing: 'Processing',
  available: 'Available',
  unavailable: 'Unavailable',
  failed: 'Failed',
};
const ISSUE_FILTERS = ['all', 'open', 'resolved'] as const;
const ISSUE_FILTER_LABEL: Record<(typeof ISSUE_FILTERS)[number], string> = { all: 'All', open: 'Open', resolved: 'Resolved' };
const SORTS = ['added', 'modified'] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { added: 'Most recent', modified: 'Last modified' };

type RequestList = { results?: OverseerrRequest[] };
type IssueList = { results?: OverseerrIssue[] };

export function OverseerrScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'search' | 'requests' | 'issues'>('requests');
  useResetScrollOnChange(tab);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OverseerrSearchResult[] | null>(null);
  const [requestFilter, setRequestFilter] = useState<(typeof REQUEST_FILTERS)[number]>('all');
  const [issueFilter, setIssueFilter] = useState<(typeof ISSUE_FILTERS)[number]>('all');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('added');
  const [openResult, setOpenResult] = useState<OverseerrSearchResult | null>(null);

  const { data: requestData, isLoading: requestsLoading } = useServiceProxy<RequestList>(instance, {
    path: '/api/v1/request',
    query: { take: '50', skip: '0', filter: requestFilter, sort },
    refetchInterval: 15000,
    enabled: tab === 'requests',
  });

  const { data: issueData, isLoading: issuesLoading } = useServiceProxy<IssueList>(instance, {
    path: '/api/v1/issue',
    query: { take: '50', skip: '0', filter: issueFilter, sort },
    refetchInterval: 15000,
    enabled: tab === 'issues',
  });

  const status = requestsLoading ? 'unknown' : requestData?.ok ? 'online' : 'offline';
  const requests = requestData?.data?.results ?? [];
  const issues = issueData?.data?.results ?? [];

  const requestAction = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'approve' | 'decline' }) =>
      proxyApi.call(instance.id, { path: `/api/v1/request/${id}/${decision}`, method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  // Overseerr's issue-status update is a PUT with a target status, unlike requests' dedicated
  // approve/decline endpoints — unverified against a live instance since none had open issues to test.
  const issueAction = useMutation({
    mutationFn: ({ id, resolve }: { id: number; resolve: boolean }) =>
      proxyApi.call(instance.id, { path: `/api/v1/issue/${id}`, method: 'PUT', body: { status: resolve ? 2 : 1 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', instance.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  });

  const search = useOverseerrSearch(instance);

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
        setResults((res.data?.results ?? []).filter((r) => r.mediaType === 'movie' || r.mediaType === 'tv'));
      },
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#6c56e622', color: '#6c56e6' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
          <p className="text-sm text-muted-foreground">{status === 'offline' ? 'Unreachable' : 'Requests & discovery'}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-1.5">
        {(['requests', 'issues', 'search'] as const).map((t) => (
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
                <OverseerrSearchResultRow key={`${r.mediaType}-${r.id}`} result={r} onClick={() => setOpenResult(r)} />
              ))}
          </div>
        </>
      )}

      {openResult && (
        <OverseerrRequestDialog
          instance={instance}
          mediaType={openResult.mediaType === 'tv' ? 'tv' : 'movie'}
          tmdbId={openResult.id}
          fallbackTitle={openResult.title ?? openResult.name ?? 'Untitled'}
          fallbackPoster={openResult.posterPath ? `${TMDB_IMAGE}${openResult.posterPath}` : undefined}
          onClose={() => setOpenResult(null)}
        />
      )}

      {tab === 'requests' && (
        <>
          <div className="mb-4 flex gap-2">
            <Select value={requestFilter} onChange={(e) => setRequestFilter(e.target.value as (typeof REQUEST_FILTERS)[number])} className="flex-1">
              {REQUEST_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {REQUEST_FILTER_LABEL[f]}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} className="flex-1">
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {requestsLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            {!requestsLoading && requests.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
            {requests.map((req) => (
              <OverseerrRequestRow
                key={req.id}
                instance={instance}
                request={req}
                busy={requestAction.isPending && requestAction.variables?.id === req.id}
                onApprove={() => requestAction.mutate({ id: req.id, decision: 'approve' })}
                onDecline={() => requestAction.mutate({ id: req.id, decision: 'decline' })}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'issues' && (
        <>
          <div className="mb-4 flex gap-2">
            <Select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as (typeof ISSUE_FILTERS)[number])} className="flex-1">
              {ISSUE_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {ISSUE_FILTER_LABEL[f]}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} className="flex-1">
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {issuesLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            {!issuesLoading && issues.length === 0 && <p className="text-sm text-muted-foreground">No issues.</p>}
            {issues.map((issue) => (
              <OverseerrIssueRow
                key={issue.id}
                instance={instance}
                issue={issue}
                busy={issueAction.isPending && issueAction.variables?.id === issue.id}
                onResolve={() => issueAction.mutate({ id: issue.id, resolve: true })}
                onReopen={() => issueAction.mutate({ id: issue.id, resolve: false })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
