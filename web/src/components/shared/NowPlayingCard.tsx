import { User } from 'lucide-react';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { cn } from '@/lib/utils';

// Sits behind session content inside any `relative overflow-hidden` container. The gradient runs
// solid-card → transparent left-to-right so the backdrop image "fades in" as it goes right, while
// the left side (where title/text sit) stays legible.
export function SessionBackdrop({ url }: { url?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-muted/50 to-card" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-card/25" />
    </div>
  );
}

export function SessionDetails({
  posterUrl,
  title,
  subtitle,
  userLabel,
  userAvatarUrl,
  state,
  meta,
  progressPercent,
  remaining,
  size = 'md',
}: {
  posterUrl?: string;
  title: string;
  subtitle?: string;
  userLabel?: string;
  userAvatarUrl?: string | null;
  state?: string;
  meta?: string;
  progressPercent: number;
  remaining?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex gap-3">
      {posterUrl && (
        <div
          className={cn(
            'shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-black/10',
            size === 'sm' ? 'h-14 w-10' : 'h-20 w-14',
          )}
        >
          <img src={posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold leading-tight">{title}</p>
          {state && (
            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {state}
            </span>
          )}
        </div>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
          ) : (
            userLabel && <User className="h-3 w-3 shrink-0" />
          )}
          {userLabel && <span className="truncate">{userLabel}</span>}
          {meta && (
            <>
              {userLabel && <span className="shrink-0">·</span>}
              <span className="truncate">{meta}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ProgressBar value={progressPercent} className="flex-1" />
          {remaining && <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{remaining}</span>}
        </div>
      </div>
    </div>
  );
}
