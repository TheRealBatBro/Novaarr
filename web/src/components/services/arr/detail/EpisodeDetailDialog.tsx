import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { SubtitleLanguageChips, BazarrSubtitleControls, type BazarrEpisodeSubtitleInfo } from '../BazarrSubtitles';

type EpisodeFull = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview?: string;
  airDateUtc?: string;
  monitored: boolean;
  hasFile: boolean;
  episodeFileId?: number;
  images?: { coverType: string; remoteUrl?: string; url?: string }[];
};
type EpisodeFile = {
  id: number;
  sceneName?: string;
  relativePath?: string;
  size?: number;
  quality?: { quality?: { name?: string } };
};

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function formatAirDate(iso?: string): string {
  if (!iso) return 'Unaired';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unaired';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function EpisodeDetailDialog({
  instance,
  episodeId,
  seriesId,
  seriesTitle,
  bazarr,
  subtitleInfo,
  onClose,
  onOpenSearch,
}: {
  instance: ServiceInstance;
  episodeId: number;
  seriesId: number;
  seriesTitle: string;
  bazarr?: ServiceInstance;
  subtitleInfo?: BazarrEpisodeSubtitleInfo;
  onClose: () => void;
  onOpenSearch: (ep: { id: number; episodeNumber: number }) => void;
}) {
  const qc = useQueryClient();
  const { data: epResp, isLoading } = useServiceProxy<EpisodeFull>(instance, { path: `/api/v3/episode/${episodeId}` });
  const ep = epResp?.ok ? epResp.data : undefined;

  const { data: fileResp } = useServiceProxy<EpisodeFile>(instance, {
    path: `/api/v3/episodefile/${ep?.episodeFileId}`,
    enabled: !!ep?.episodeFileId,
  });
  const file = fileResp?.ok ? fileResp.data : undefined;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const toggleMonitor = useMutation({
    mutationFn: (monitored: boolean) => proxyApi.call(instance.id, { path: '/api/v3/episode/monitor', method: 'PUT', body: { episodeIds: [episodeId], monitored } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Update failed');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  const deleteFile = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: `/api/v3/episodefile/${ep?.episodeFileId}`, method: 'DELETE' }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Delete failed');
      toast.success('File deleted');
      invalidate();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  });

  const screenshot = ep?.images?.find((i) => i.coverType === 'screenshot');
  const screenshotUrl = screenshot?.remoteUrl || screenshot?.url;

  if (isLoading || !ep) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <Skeleton className="h-48 w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg min-w-0">
        {screenshotUrl && (
          <div className="-mx-6 -mt-6 aspect-video w-[calc(100%+3rem)] overflow-hidden rounded-t-xl bg-muted">
            <img src={screenshotUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words pr-6">
            E{ep.episodeNumber} — {ep.title}
          </DialogTitle>
          <DialogDescription className="min-w-0 break-words">
            {seriesTitle} · S{ep.seasonNumber} · {formatAirDate(ep.airDateUtc)}
          </DialogDescription>
        </DialogHeader>

        {ep.overview && <p className="min-w-0 text-sm leading-relaxed text-muted-foreground">{ep.overview}</p>}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span className="text-muted-foreground">Monitored</span>
          <Switch checked={ep.monitored} onCheckedChange={(v) => toggleMonitor.mutate(v)} aria-label="Monitored" />
        </div>

        {ep.hasFile && (
          <div className="min-w-0 rounded-lg border border-border p-3 text-sm">
            <p className="mb-1 text-xs text-muted-foreground">Downloaded release</p>
            <p className="min-w-0 break-all font-mono text-xs">{file?.sceneName || file?.relativePath?.split('/').pop() || 'Unknown'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {file?.quality?.quality?.name ?? 'Unknown quality'}
              {formatSize(file?.size) ? ` · ${formatSize(file?.size)}` : ''}
            </p>
          </div>
        )}

        {subtitleInfo && (subtitleInfo.missing.length > 0 || subtitleInfo.subtitles.length > 0) && <SubtitleLanguageChips info={subtitleInfo} />}

        <div className="flex min-w-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenSearch({ id: ep.id, episodeNumber: ep.episodeNumber })}>
            <Search className="h-3.5 w-3.5" /> Search
          </Button>
          {ep.hasFile && ep.episodeFileId && (
            <Button variant="outline" size="sm" disabled={deleteFile.isPending} onClick={() => deleteFile.mutate()}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete file
            </Button>
          )}
          {bazarr && ep.hasFile && (
            <BazarrSubtitleControls
              bazarr={bazarr}
              target={{ kind: 'episode', episodeId: ep.id, seriesId }}
              missing={subtitleInfo?.missing ?? []}
              title={`${seriesTitle} — E${ep.episodeNumber}`}
              size="md"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
