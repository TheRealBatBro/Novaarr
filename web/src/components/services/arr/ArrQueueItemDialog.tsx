import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, FolderInput, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { proxyApi, type ServiceInstance } from '@/lib/api';

type ManualImportCandidate = {
  path: string;
  folderName?: string;
  size?: number;
  quality?: { quality?: { name?: string } };
  languages?: { id: number; name: string }[];
  seriesId?: number;
  episodes?: { id: number }[];
  movieId?: number;
  rejections?: { reason: string }[];
};

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

// Forwards exactly the fields Sonarr/Radarr's own ManualImport command needs, using whichever
// series/episode or movie mapping the GET already resolved — this accepts the system's own best
// guess rather than offering to reassign it, which covers the common "stuck download" case
// without building out a full per-file quality/episode picker.
function toImportPayload(c: ManualImportCandidate, downloadId?: string) {
  return {
    path: c.path,
    folderName: c.folderName,
    quality: c.quality,
    languages: c.languages,
    downloadId,
    ...(c.seriesId !== undefined ? { seriesId: c.seriesId, episodeIds: c.episodes?.map((e) => e.id) ?? [] } : {}),
    ...(c.movieId !== undefined ? { movieId: c.movieId } : {}),
  };
}

export function ArrQueueItemDialog({
  instance,
  apiVersion,
  serviceId,
  record,
  onClose,
  onRemoved,
}: {
  instance: ServiceInstance;
  apiVersion: 'v3' | 'v1';
  serviceId: string;
  record: { id: number; downloadId?: string; title: string; status: string; indexer?: string; downloadClient?: string; warning?: string };
  onClose: () => void;
  onRemoved: () => void;
}) {
  const qc = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const canManualImport = serviceId === 'sonarr' || serviceId === 'radarr';

  const remove = useMutation({
    mutationFn: (blocklist: boolean) =>
      proxyApi.call(instance.id, {
        path: `/api/${apiVersion}/queue/${record.id}`,
        method: 'DELETE',
        query: { removeFromClient: 'true', blocklist: String(blocklist) },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to remove');
      toast.success('Removed from queue');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
      onRemoved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove'),
  });

  const fetchCandidates = useMutation({
    mutationFn: () =>
      proxyApi.call<ManualImportCandidate[]>(instance.id, {
        path: `/api/${apiVersion}/manualimport`,
        query: { downloadId: record.downloadId ?? '' },
        timeoutMs: 30_000,
      }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to look up files'),
  });

  const importFile = useMutation({
    mutationFn: (c: ManualImportCandidate) =>
      proxyApi.call(instance.id, {
        path: `/api/${apiVersion}/command`,
        method: 'POST',
        body: { name: 'ManualImport', files: [toImportPayload(c, record.downloadId)], importMode: 'auto' },
      }),
    onSuccess: (res, c) => {
      if (!res.ok) return toast.error(res.error || 'Import failed');
      toast.success(`Importing ${c.folderName || c.path.split('/').pop()}`);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Import failed'),
  });

  function openImport() {
    setShowImport(true);
    if (!fetchCandidates.data) fetchCandidates.mutate();
  }

  const candidates = fetchCandidates.data?.ok ? fetchCandidates.data.data ?? [] : [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate">{record.title}</DialogTitle>
          <DialogDescription>
            {record.indexer && <span>{record.indexer}</span>}
            {record.downloadClient && <span> · {record.downloadClient}</span>}
          </DialogDescription>
        </DialogHeader>

        {record.warning && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="truncate">{record.warning}</span>
          </div>
        )}

        {!showImport && (
          <div className="flex flex-wrap gap-2">
            {canManualImport && (
              <Button variant="outline" size="sm" onClick={openImport}>
                <FolderInput className="h-3.5 w-3.5" /> Manual import
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(false)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
            <Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove & blocklist
            </Button>
          </div>
        )}

        {showImport && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Files found for this download, with anything blocking automatic import.</p>
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {fetchCandidates.isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              {fetchCandidates.isSuccess && candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">No importable files found for this download.</p>
              )}
              {candidates.map((c, i) => {
                const busy = importFile.isPending && importFile.variables === c;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.folderName || c.path.split('/').pop()}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.quality?.quality?.name ?? 'Unknown quality'}
                        {formatSize(c.size) ? ` · ${formatSize(c.size)}` : ''}
                        {c.rejections?.length ? ` · ${c.rejections[0].reason}` : ''}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => importFile.mutate(c)}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                      Import
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowImport(false)}>
              Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
