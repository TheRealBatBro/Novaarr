import { Check, X, Trash2, User } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { ombiStatusLabel, TMDB_IMAGE, type OmbiRequest } from './OmbiShared';

const TONE_CLASS: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
};

export function OmbiRequestRow({
  request,
  busy,
  onApprove,
  onDeny,
  onDelete,
}: {
  request: OmbiRequest;
  busy: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onDelete: () => void;
}) {
  const status = ombiStatusLabel(request);
  const requester = request.requestedUser?.userName ?? request.requestedUser?.username ?? 'Unknown';
  const pending = !request.approved && !request.available && !request.denied;

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

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{requester}</span>
            <span>·</span>
            <span className="shrink-0">{timeAgo(request.requestedDate)}</span>
          </div>

          <div className="flex shrink-0 gap-1">
            {pending && (
              <>
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
                  onClick={onDeny}
                  aria-label="Deny request"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              aria-label="Remove request"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
