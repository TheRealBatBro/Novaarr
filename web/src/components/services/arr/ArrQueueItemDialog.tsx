import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, FolderInput, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { MoviePickerDialog, SeriesEpisodePickerDialog } from './ArrMatchPickerDialog';

type ManualImportEpisode = { id: number; seasonNumber: number; episodeNumber: number };
type ManualImportCandidate = {
  path: string;
  folderName?: string;
  size?: number;
  quality?: { quality?: { name?: string } };
  languages?: { id: number; name: string }[];
  seriesId?: number;
  series?: { id: number; title: string };
  episodes?: ManualImportEpisode[];
  movieId?: number;
  movie?: { id: number; title: string; year?: number };
  rejections?: { reason: string }[];
};

// A user-chosen match always wins over whatever the system guessed for that same candidate.
type MatchOverride =
  | { kind: 'movie'; movieId: number; label: string }
  | { kind: 'series'; seriesId: number; episodes: ManualImportEpisode[]; label: string };

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function episodeLabel(episodes?: ManualImportEpisode[]): string {
  return (episodes ?? []).map((e) => `S${e.seasonNumber}E${String(e.episodeNumber).padStart(2, '0')}`).join(', ');
}

function currentMatchLabel(c: ManualImportCandidate, override?: MatchOverride): string | null {
  if (override) return override.label;
  if (c.movie) return `${c.movie.title}${c.movie.year ? ` (${c.movie.year})` : ''}`;
  if (c.series) return [c.series.title, episodeLabel(c.episodes)].filter(Boolean).join(' · ');
  return null;
}

// Forwards exactly the fields Sonarr/Radarr's own ManualImport command needs. A user override
// (picked via MoviePickerDialog/SeriesEpisodePickerDialog) always wins; otherwise this falls
// back to whichever series/episode or movie mapping the GET already resolved on its own.
function toImportPayload(c: ManualImportCandidate, override: MatchOverride | undefined, downloadId?: string) {
  const base = { path: c.path, folderName: c.folderName, quality: c.quality, languages: c.languages, downloadId };
  if (override?.kind === 'movie') return { ...base, movieId: override.movieId };
  if (override?.kind === 'series') return { ...base, seriesId: override.seriesId, episodeIds: override.episodes.map((e) => e.id) };
  return {
    ...base,
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
  const [overrides, setOverrides] = useState<Record<number, MatchOverride>>({});
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);
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
    mutationFn: ({ c, index }: { c: ManualImportCandidate; index: number }) =>
      proxyApi.call(instance.id, {
        path: `/api/${apiVersion}/command`,
        method: 'POST',
        body: { name: 'ManualImport', files: [toImportPayload(c, overrides[index], record.downloadId)], importMode: 'auto' },
      }),
    onSuccess: (res, { c }) => {
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
      <DialogContent className="max-w-xl min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words pr-6">{record.title}</DialogTitle>
          <DialogDescription className="min-w-0 break-words">
            {record.indexer && <span>{record.indexer}</span>}
            {record.downloadClient && <span> · {record.downloadClient}</span>}
          </DialogDescription>
        </DialogHeader>

        {record.warning && (
          <div className="flex min-w-0 items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{record.warning}</span>
          </div>
        )}

        {!showImport && (
          <div className="flex min-w-0 flex-wrap gap-2">
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
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm text-muted-foreground">Files found for this download, with anything blocking automatic import.</p>
            <div className="flex max-h-80 min-w-0 flex-col gap-2 overflow-y-auto">
              {fetchCandidates.isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              {fetchCandidates.isSuccess && candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">No importable files found for this download.</p>
              )}
              {candidates.map((c, i) => {
                const busy = importFile.isPending && importFile.variables?.index === i;
                const matchLabel = currentMatchLabel(c, overrides[i]);
                return (
                  <div key={i} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.folderName || c.path.split('/').pop()}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.quality?.quality?.name ?? 'Unknown quality'}
                          {formatSize(c.size) ? ` · ${formatSize(c.size)}` : ''}
                          {c.rejections?.length ? ` · ${c.rejections[0].reason}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={busy}
                        onClick={() => importFile.mutate({ c, index: i })}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                        Import
                      </Button>
                    </div>
                    {canManualImport && (
                      <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-accent/50 px-2 py-1.5 text-xs">
                        <span className="min-w-0 truncate text-muted-foreground">
                          Matched to: <span className="font-medium text-foreground">{matchLabel ?? 'no match found'}</span>
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-primary hover:underline"
                          onClick={() => setPickerOpenFor(i)}
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowImport(false)}>
              Back
            </Button>
          </div>
        )}

        {pickerOpenFor !== null &&
          (serviceId === 'radarr' ? (
            <MoviePickerDialog
              instance={instance}
              onClose={() => setPickerOpenFor(null)}
              onPick={(movie) => {
                setOverrides((prev) => ({
                  ...prev,
                  [pickerOpenFor]: { kind: 'movie', movieId: movie.id, label: `${movie.title}${movie.year ? ` (${movie.year})` : ''}` },
                }));
                setPickerOpenFor(null);
              }}
            />
          ) : (
            <SeriesEpisodePickerDialog
              instance={instance}
              onClose={() => setPickerOpenFor(null)}
              onPick={(pickedSeries, pickedEpisodes) => {
                setOverrides((prev) => ({
                  ...prev,
                  [pickerOpenFor]: {
                    kind: 'series',
                    seriesId: pickedSeries.id,
                    episodes: pickedEpisodes,
                    label: `${pickedSeries.title} · ${episodeLabel(pickedEpisodes)}`,
                  },
                }));
                setPickerOpenFor(null);
              }}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
