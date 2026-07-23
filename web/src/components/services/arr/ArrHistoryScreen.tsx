import { Download, CheckCircle2, Trash2, XCircle, History as HistoryIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type HistoryImage = { coverType: string; remoteUrl?: string; url?: string };
type HistoryRecord = {
  id: number;
  eventType: string;
  date: string;
  quality?: { quality?: { name?: string } };
  data?: { indexer?: string; downloadClient?: string; reason?: string };
  movie?: { title: string; images?: HistoryImage[] };
  series?: { title: string; images?: HistoryImage[] };
  episode?: { seasonNumber?: number; episodeNumber?: number };
};
type HistoryResponse = { records?: HistoryRecord[] };

const EVENT_META: Record<string, { label: string; className: string; icon: typeof Download }> = {
  grabbed: { label: 'Grabbed', className: 'bg-amber-500/15 text-amber-500', icon: Download },
  downloadFolderImported: { label: 'Imported', className: 'bg-success/15 text-success', icon: CheckCircle2 },
  movieFileDeleted: { label: 'File deleted', className: 'bg-destructive/15 text-destructive', icon: Trash2 },
  episodeFileDeleted: { label: 'File deleted', className: 'bg-destructive/15 text-destructive', icon: Trash2 },
  downloadFailed: { label: 'Failed', className: 'bg-destructive/15 text-destructive', icon: XCircle },
  movieFileRenamed: { label: 'Renamed', className: 'bg-accent text-muted-foreground', icon: HistoryIcon },
  episodeFileRenamed: { label: 'Renamed', className: 'bg-accent text-muted-foreground', icon: HistoryIcon },
};

function posterUrl(images?: HistoryImage[]): string | undefined {
  const img = images?.find((i) => i.coverType === 'poster');
  return img?.remoteUrl || img?.url;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}hr ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function ArrHistoryScreen({ instance, apiVersion = 'v3' }: { instance: ServiceInstance; apiVersion?: 'v3' | 'v1' }) {
  const { data, isLoading } = useServiceProxy<HistoryResponse>(instance, {
    path: `/api/${apiVersion}/history`,
    query: {
      page: '1',
      pageSize: '40',
      sortKey: 'date',
      sortDirection: 'descending',
      includeMovie: 'true',
      includeSeries: 'true',
      includeEpisode: 'true',
    },
    refetchInterval: 30_000,
  });

  const records = data?.data?.records ?? [];

  return (
    <div>
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && records.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}

      <div className="flex flex-col gap-2">
        {records.map((rec) => {
          const meta = EVENT_META[rec.eventType] ?? { label: rec.eventType, className: 'bg-accent text-muted-foreground', icon: HistoryIcon };
          const Icon = meta.icon;
          const media = rec.movie ?? rec.series;
          const title = media?.title ?? 'Unknown';
          const subtitle = rec.episode ? `S${rec.episode.seasonNumber}E${rec.episode.episodeNumber}` : undefined;
          const url = posterUrl(media?.images);
          return (
            <div key={rec.id} className="flex gap-3 rounded-xl border border-border bg-card p-2.5">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                {url && <img src={url} alt={title} loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {title}
                    {subtitle && <span className="font-normal text-muted-foreground"> · {subtitle}</span>}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(rec.date)}</span>
                </div>
                <span className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', meta.className)}>
                  <Icon className="h-2.5 w-2.5" /> {meta.label}
                </span>
                <p className="truncate text-xs text-muted-foreground">
                  {[rec.quality?.quality?.name, rec.data?.indexer, rec.data?.downloadClient].filter(Boolean).join(' · ') || rec.data?.reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
