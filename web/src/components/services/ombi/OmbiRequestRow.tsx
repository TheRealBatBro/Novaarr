import { User } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { ombiStatusLabel, TMDB_IMAGE, type OmbiRequest } from './OmbiShared';

const TONE_CLASS: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
};

export function OmbiRequestRow({ request }: { request: OmbiRequest }) {
  const status = ombiStatusLabel(request);
  const requester = request.requestedUser?.userName ?? request.requestedUser?.username ?? 'Unknown';

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-2.5 shadow-sm">
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {request.posterPath ? (
          <img src={`${TMDB_IMAGE}${request.posterPath}`} alt={request.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">{request.title}</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="truncate font-semibold leading-tight">{request.title}</p>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn('rounded-full px-1.5 py-0.5 font-medium', TONE_CLASS[status.tone])}>{status.label}</span>
          {request.denied && request.deniedReason && <span className="text-muted-foreground">{request.deniedReason}</span>}
        </div>

        <div className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{requester}</span>
          <span>·</span>
          <span className="shrink-0">{timeAgo(request.requestedDate)}</span>
        </div>
      </div>
    </div>
  );
}
