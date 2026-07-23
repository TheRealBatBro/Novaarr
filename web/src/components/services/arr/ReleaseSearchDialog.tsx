import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
};

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

  const releases = [...(data?.data ?? [])].sort((a, b) => (a.rejected === b.rejected ? 0 : a.rejected ? 1 : -1));

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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-2">
            <span>Pick a release to grab manually.</span>
            <button type="button" onClick={onAutoSearch} className="shrink-0 text-xs text-primary hover:underline">
              Or search automatically instead
            </button>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Refresh
          </Button>
        </div>

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          {!isLoading && releases.length === 0 && <p className="text-sm text-muted-foreground">No releases found.</p>}
          {!isLoading &&
            releases.map((r) => {
              const busy = grab.isPending && grab.variables?.guid === r.guid;
              const grabbed = grabbedGuid === r.guid;
              return (
                <div
                  key={r.guid}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${r.rejected ? 'border-border opacity-50' : 'border-border'}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.indexer} · {formatSize(r.size)} · {r.protocol === 'torrent' ? `${r.seeders ?? 0} seeders` : 'Usenet'} ·{' '}
                      {r.quality?.quality?.name ?? 'Unknown quality'} · {Math.round(r.age)}d
                      {r.rejected && r.rejections?.length ? ` · Rejected: ${r.rejections[0]}` : ''}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" disabled={busy || grabbed} onClick={() => grab.mutate(r)}>
                    <Download className="h-3.5 w-3.5" /> {grabbed ? 'Grabbed' : 'Grab'}
                  </Button>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
