import { Clapperboard, Volume2, Captions, MessageSquare, User, CheckCircle2 } from 'lucide-react';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

const POSTER_IMAGE = 'https://image.tmdb.org/t/p/w200';

// Issue type enum (Overseerr): 1=video, 2=audio, 3=subtitles, 4=other.
const ISSUE_TYPE: Record<number, { label: string; icon: typeof Clapperboard }> = {
  1: { label: 'Video', icon: Clapperboard },
  2: { label: 'Audio', icon: Volume2 },
  3: { label: 'Subtitles', icon: Captions },
  4: { label: 'Other', icon: MessageSquare },
};

export type OverseerrIssue = {
  id: number;
  issueType: number;
  status: number;
  problemSeason?: number;
  problemEpisode?: number;
  createdAt: string;
  createdBy?: { displayName?: string; username?: string; avatar?: string };
  media?: { tmdbId?: number; mediaType?: 'movie' | 'tv' };
};

type TmdbDetails = { title?: string; name?: string; posterPath?: string };

export function OverseerrIssueRow({
  instance,
  issue,
  onResolve,
  onReopen,
  busy,
}: {
  instance: ServiceInstance;
  issue: OverseerrIssue;
  onResolve: () => void;
  onReopen: () => void;
  busy: boolean;
}) {
  const tmdbId = issue.media?.tmdbId;
  const mediaType = issue.media?.mediaType ?? 'movie';
  const { data } = useServiceProxy<TmdbDetails>(instance, {
    path: `/api/v1/${mediaType}/${tmdbId}`,
    refetchInterval: false,
    enabled: !!tmdbId,
  });

  const details = data?.data;
  const title = details?.title ?? details?.name ?? `Issue #${issue.id}`;
  const type = ISSUE_TYPE[issue.issueType] ?? ISSUE_TYPE[4];
  const TypeIcon = type.icon;
  const open = issue.status === 1;
  const reporter = issue.createdBy?.displayName ?? issue.createdBy?.username ?? 'Unknown';

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
        <p className="truncate font-semibold leading-tight">{title}</p>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 font-medium',
              open ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success',
            )}
          >
            {open ? 'Open' : 'Resolved'}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 font-medium text-muted-foreground">
            <TypeIcon className="h-2.5 w-2.5" /> {type.label}
          </span>
          {issue.problemSeason !== undefined && issue.problemSeason > 0 && (
            <span className="text-muted-foreground">
              S{issue.problemSeason}
              {issue.problemEpisode ? `E${issue.problemEpisode}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {issue.createdBy?.avatar ? (
                <img src={issue.createdBy.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-2.5 w-2.5" />
              )}
            </span>
            <span className="truncate">{reporter}</span>
            <span>·</span>
            <span className="shrink-0">{timeAgo(issue.createdAt)}</span>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={open ? onResolve : onReopen}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50',
              open ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-accent text-muted-foreground hover:bg-accent/70',
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            {open ? 'Resolve' : 'Reopen'}
          </button>
        </div>
      </div>
    </div>
  );
}
