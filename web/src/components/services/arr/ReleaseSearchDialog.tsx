import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, ChevronDown, ChevronRight, Download, ExternalLink, RefreshCw, Search, ArrowDown, ArrowUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';

type Release = {
  guid: string;
  indexerId: number;
  indexer: string;
  title: string;
  size: number;
  seeders?: number;
  leechers?: number;
  age: number;
  protocol: 'usenet' | 'torrent';
  quality?: { quality?: { name?: string } };
  rejected?: boolean;
  rejections?: string[];
  infoUrl?: string;
};

const SORT_KEYS = ['best', 'size', 'age', 'seeders'] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORT_LABEL: Record<SortKey, string> = { best: 'Best Match', size: 'Size', age: 'Age', seeders: 'Seeders' };

function formatSize(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

/**
 * Interactive/manual release picker — hits Sonarr's own /api/v3/release search (the same
 * one its web UI uses), so the user can see actual candidate releases and pick one instead
 * of firing a blind automatic search.
 */
export function ReleaseSearchDialog({
  instance,
  params,
  title,
  onClose,
  onAutoSearch,
}: {
  instance: ServiceInstance;
  params: { episodeId: number } | { seriesId: number; seasonNumber: number } | { movieId: number };
  title: string;
  onClose: () => void;
  onAutoSearch: () => void;
}) {
  const qc = useQueryClient();
  const [grabbedGuid, setGrabbedGuid] = useState<string | null>(null);
  const [expandedGuid, setExpandedGuid] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('best');
  const [sortAsc, setSortAsc] = useState(false);

  const query =
    'episodeId' in params
      ? { episodeId: String(params.episodeId) }
      : 'movieId' in params
        ? { movieId: String(params.movieId) }
        : { seriesId: String(params.seriesId), seasonNumber: String(params.seasonNumber) };

  const { data, isLoading, isFetching, refetch } = useServiceProxy<Release[]>(instance, {
    path: '/api/v3/release',
    query,
    refetchInterval: false,
    timeoutMs: 30_000,
  });

  const releases = useMemo(() => {
    const all = data?.data ?? [];
    const filtered = filter.trim() ? all.filter((r) => r.title.toLowerCase().includes(filter.trim().toLowerCase())) : all;
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'size') cmp = a.size - b.size;
      else if (sortKey === 'age') cmp = a.age - b.age;
      else if (sortKey === 'seeders') cmp = (a.seeders ?? 0) - (b.seeders ?? 0);
      // "Best Match" keeps the API's own ranked order, just with rejected releases sunk last.
      if (cmp === 0 && sortKey !== 'best') return 0;
      return sortAsc ? cmp : -cmp;
    });
    if (sortKey === 'best') {
      sorted.sort((a, b) => (a.rejected === b.rejected ? 0 : a.rejected ? 1 : -1));
    }
    return sorted;
  }, [data, filter, sortKey, sortAsc]);

  const grab = useMutation({
    mutationFn: (release: Release) =>
      proxyApi.call(instance.id, { path: '/api/v3/release', method: 'POST', body: { guid: release.guid, indexerId: release.indexerId } }),
    onSuccess: (res, release) => {
      if (!res.ok) return toast.error(res.error || 'Failed to grab release');
      toast.success('Sent to download client');
      setGrabbedGuid(release.guid);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to grab release'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {title} {!isLoading && `(${releases.length})`}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-2">
            <span>Pick a release to grab manually.</span>
            <button type="button" onClick={onAutoSearch} className="shrink-0 text-xs text-primary hover:underline">
              Or search automatically instead
            </button>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search releases…" className="pl-8" />
          </div>
          <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-36 shrink-0">
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="icon" aria-label={sortAsc ? 'Sort descending' : 'Sort ascending'} onClick={() => setSortAsc((v) => !v)}>
            {sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Refresh" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          </Button>
        </div>

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          {!isLoading && releases.length === 0 && <p className="text-sm text-muted-foreground">No releases found.</p>}
          {!isLoading &&
            releases.map((r) => {
              const busy = grab.isPending && grab.variables?.guid === r.guid;
              const grabbed = grabbedGuid === r.guid;
              const expanded = expandedGuid === r.guid;
              return (
                <div key={r.guid} className={`rounded-xl border border-border bg-card p-3 text-sm ${r.rejected ? 'opacity-60' : ''}`}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => setExpandedGuid(expanded ? null : r.guid)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">{r.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {r.rejected && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                        {r.quality?.quality?.name && (
                          <span className="rounded-full bg-accent px-1.5 py-0.5 font-medium text-foreground">{r.quality.quality.name}</span>
                        )}
                        <span>{formatSize(r.size)}</span>
                        <span>·</span>
                        <span>{Math.round(r.age)}d</span>
                        <span>·</span>
                        <span className="truncate">
                          {r.indexer}
                          {r.protocol === 'torrent' && r.seeders !== undefined ? ` · ${r.seeders} seeders` : ''}
                        </span>
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {expanded && !!r.rejections?.length && (
                    <div className="mt-2 border-t border-border pt-2">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">Rejection reasons</p>
                      <ul className="list-inside list-disc text-xs text-destructive">
                        {r.rejections.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-2 flex gap-2">
                    {r.infoUrl && (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={r.infoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-3.5 w-3.5" /> View
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={busy || grabbed}
                      onClick={(e) => {
                        e.stopPropagation();
                        grab.mutate(r);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> {grabbed ? 'Downloaded' : 'Download'}
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
