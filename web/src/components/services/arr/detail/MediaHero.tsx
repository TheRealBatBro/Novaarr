import { ArrowLeft, Trash2, Star, Clock, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MediaHero({
  backdropUrl,
  posterUrl,
  title,
  subtitle,
  badge,
  rating,
  onBack,
  onDelete,
  deleteDisabled,
  deleteLabel = 'Remove',
}: {
  backdropUrl?: string;
  posterUrl?: string;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: 'upcoming' | 'missing' };
  rating?: number;
  onBack: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteLabel?: string;
}) {
  return (
    <div className="mb-6">
      <div className="relative -mx-4 -mt-6 overflow-hidden sm:-mx-6">
        <div className="aspect-video w-full bg-muted sm:aspect-[21/9]">
          {backdropUrl ? (
            <img src={backdropUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted to-card" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to library" className="bg-black/30 text-white backdrop-blur-sm hover:bg-black/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={deleteDisabled}
              aria-label={deleteLabel}
              className="bg-black/30 text-white backdrop-blur-sm hover:bg-destructive/70"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative z-10 -mt-14 flex items-end gap-3 px-1 sm:-mt-16">
        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-muted shadow-lg ring-2 ring-background sm:h-36 sm:w-24">
          {posterUrl && <img src={posterUrl} alt={title} className="h-full w-full object-cover" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pb-1">
          {badge && (
            <span
              className={cn(
                'flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                badge.tone === 'upcoming' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground',
              )}
            >
              {badge.tone === 'upcoming' ? <Clock className="h-2.5 w-2.5" /> : <CloudOff className="h-2.5 w-2.5" />}
              {badge.label}
            </span>
          )}
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            {subtitle && <span className="truncate">{subtitle}</span>}
            {rating !== undefined && (
              <span className="flex shrink-0 items-center gap-0.5 font-medium text-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
