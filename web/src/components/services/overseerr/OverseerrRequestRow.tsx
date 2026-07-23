import { Check, X, User } from 'lucide-react';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

const POSTER_IMAGE = 'https://image.tmdb.org/t/p/w200';

// Media availability enum (Overseerr): 1=unknown, 2=pending, 3=processing, 4=partially available, 5=available.
const MEDIA_STATUS: Record<number, { label: string; tone: 'muted' | 'primary' | 'success' }> = {
  1: { label: 'Unknown', tone: 'muted' },
  2: { label: 'Requested', tone: 'primary' },
  3: { label: 'Requested', tone: 'primary' },
  4: { label: 'Partially available', tone: 'primary' },
  5: { label: 'Available', tone: 'success' },
};

const TONE_CLASS: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
};

export type OverseerrRequest = {
  id: number;
  type: 'movie' | 'tv';
  status: number;
  is4k?: boolean;
  createdAt: string;
  requestedBy?: { displayName?: string; username?: string; avatar?: string };
  media?: { tmdbId?: number; status?: number };
  seasons?: { seasonNumber: number; status: number }[];
};

type TmdbDetails = { title?: string; name?: string; posterPath?: string; releaseDate?: string; firstAirDate?: string };

export function OverseerrRequestRow({
  instance,
  request,
  onApprove,
  onDecline,
  busy,
}: {
  instance: ServiceInstance;
  request: OverseerrRequest;
  onApprove: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const tmdbId = request.media?.tmdbId;
  const { data } = useServiceProxy<TmdbDetails>(instance, {
    path: `/api/v1/${request.type}/${tmdbId}`,
    refetchInterval: false,
    enabled: !!tmdbId,
  });

  const details = data?.data;
  const title = details?.title ?? details?.name ?? `Request #${request.id}`;
  const year = (details?.releaseDate ?? details?.firstAirDate)?.slice(0, 4);
  const declined = request.status === 3;
  const status = declined ? { label: 'Declined', tone: 'destructive' as const } : MEDIA_STATUS[request.media?.status ?? 1];
  const pending = request.status === 1;
  const requester = request.requestedBy?.displayName ?? request.requestedBy?.username ?? 'Unknown';

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-2.5 shadow-sm">
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {details?.posterPath ? (
          <img src={`${POSTER_IMAGE}${details.posterPath}`} alt={title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">{title}</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold leading-tight">{title}</p>
          {year && <span className="shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">{year}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn('rounded-full px-1.5 py-0.5 font-medium', TONE_CLASS[status.tone])}>{status.label}</span>
          {request.is4k && <span className="rounded bg-accent px-1.5 py-0.5 font-medium text-muted-foreground">4K</span>}
          {request.type === 'tv' && !!request.seasons?.length && (
            <span className="flex items-center gap-1 text-muted-foreground">
              S:
              {request.seasons.map((s) => (
                <span
                  key={s.seasonNumber}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold',
                    s.status === 5 ? 'bg-success/20 text-success' : s.status === 4 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {s.seasonNumber}
                </span>
              ))}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {request.requestedBy?.avatar ? (
                <img src={request.requestedBy.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-2.5 w-2.5" />
              )}
            </span>
            <span className="truncate">{requester}</span>
            <span>·</span>
            <span className="shrink-0">{timeAgo(request.createdAt)}</span>
          </div>

          {pending && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                aria-label="Approve request"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success transition-colors hover:bg-success/25 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDecline}
                aria-label="Decline request"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
