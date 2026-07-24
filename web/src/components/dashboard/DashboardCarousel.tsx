import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import type { ServiceInstance } from '@/lib/api';
import type { CarouselItem, PosterStatus } from '@/lib/dashboardWidgets';
import { OverseerrRequestDialog } from '@/components/services/overseerr/OverseerrRequestDialog';
import { TitleDetailDialog } from '@/components/services/arr/TitleDetailDialog';

const STATUS_DOT: Record<PosterStatus, string> = {
  downloaded: 'bg-success',
  downloading: 'bg-primary',
  upcoming: 'bg-violet-400',
  missing: 'bg-amber-500',
};
const STATUS_LABEL: Record<PosterStatus, string> = {
  downloaded: 'Downloaded',
  downloading: 'Downloading',
  upcoming: 'Upcoming',
  missing: 'Missing',
};

export function DashboardCarousel({
  title,
  sourceId,
  sourceLabel,
  sourceColor,
  items,
  isLoading,
  error,
  sourceInstance,
  overseerrInstance,
  refetch,
}: {
  title: string;
  sourceId: string;
  sourceLabel: string;
  sourceColor: string;
  items: CarouselItem[];
  isLoading: boolean;
  /** Set when the underlying fetch failed (auth, network, or upstream blocked it) — rendered as
   * a visible "couldn't load" card instead of silently disappearing, which is exactly what made
   * a real Cloudflare block on a Trakt widget look like the widget had simply gone missing. */
  error?: string;
  /** The service instance that owns these items (Radarr/Sonarr) — opens the title detail dialog
   * in place, so "back" closes it and returns to the dashboard instead of full-page navigation. */
  sourceInstance?: ServiceInstance;
  overseerrInstance?: ServiceInstance;
  /** Named to match CarouselResult's own field, so callers can just spread {...result} instead of
   * remapping it — present on widgets that run on a slow/cached schedule rather than the default
   * ~10s poll, and shown as a manual refresh button next to the source label. */
  refetch?: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [detailItem, setDetailItem] = useState<CarouselItem | null>(null);
  const [titleDetail, setTitleDetail] = useState<{ serviceId: 'radarr' | 'sonarr'; itemId: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const Icon = getServiceIcon(sourceId);

  if (!isLoading && items.length === 0 && !error) return null;

  async function handleRefresh() {
    if (!refetch) return;
    setRefreshing(true);
    try {
      await refetch();
      toast.success(`${title} refreshed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  function scrollByPage(dir: 1 | -1) {
    trackRef.current?.scrollBy({ left: dir * trackRef.current.clientWidth * 0.85, behavior: 'smooth' });
  }

  function openItem(item: CarouselItem) {
    if (item.overseerrDetail && overseerrInstance) {
      setDetailItem(item);
    } else if (item.to.itemId && sourceInstance && (sourceId === 'radarr' || sourceId === 'sonarr')) {
      setTitleDetail({ serviceId: sourceId, itemId: Number(item.to.itemId) });
    } else if (item.to.itemId) {
      navigate({ to: '/service/$serviceId/title/$itemId', params: { serviceId: item.to.serviceId, itemId: item.to.itemId } });
    } else {
      navigate({ to: '/service/$serviceId', params: { serviceId: item.to.serviceId } });
    }
  }

  return (
    <motion.div
      className="group/carousel relative mb-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setHovering(true)}
      onHoverEnd={() => setHovering(false)}
    >
      <div className="mb-2 flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center" style={{ color: sourceColor }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <p className="truncate text-xs font-semibold uppercase tracking-wide" style={{ color: sourceColor }}>
            {sourceLabel}
          </p>
        </div>
        {refetch && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={`Refresh ${title}`}
            title={`Refresh ${title}`}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        )}
      </div>
      <h2 className="mb-2 text-lg font-bold tracking-tight">{title}</h2>

      {!isLoading && items.length === 0 && error ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate">Couldn't load — {error}</span>
        </div>
      ) : (
      <div className="relative -mx-4 sm:-mx-6">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent sm:w-10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent sm:w-10"
          aria-hidden
        />

        <div ref={trackRef} className="no-scrollbar flex snap-x snap-proximity gap-3 overflow-x-auto px-4 pb-1 sm:px-6">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 w-32 shrink-0 rounded-2xl" />)}

          {!isLoading && (
            <AnimatePresence>
              {items.map((item, i) => (
                <motion.button
                  key={item.id}
                  layout
                  type="button"
                  onClick={() => openItem(item)}
                  className="group w-28 shrink-0 snap-start text-left sm:w-32"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    opacity: { delay: Math.min(i, 10) * 0.02 },
                    y: { delay: Math.min(i, 10) * 0.02 },
                    layout: { duration: 0.25, ease: 'easeOut' },
                  }}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-muted shadow-md ring-1 ring-black/5 transition-shadow group-hover:shadow-xl group-hover:ring-primary/40 dark:ring-white/10">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-1.5 text-center text-[10px] text-muted-foreground">
                        {item.title}
                      </div>
                    )}
                    {item.rating !== undefined && (
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {item.rating}
                      </span>
                    )}
                    {item.status && (
                      <span
                        title={STATUS_LABEL[item.status]}
                        className={cn('absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-black/40', STATUS_DOT[item.status])}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-2 pb-1.5 pt-6">
                      <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                      {item.subtitle && <p className="truncate text-[10px] text-white/70">{item.subtitle}</p>}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>

        <AnimatePresence>
          {hovering && !isLoading && (
            <>
              <motion.button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollByPage(-1)}
                className="absolute left-1 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-lg backdrop-blur-md hover:scale-110 hover:bg-background sm:flex"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.button>
              <motion.button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollByPage(1)}
                className="absolute right-1 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-lg backdrop-blur-md hover:scale-110 hover:bg-background sm:flex"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>
      )}

      {detailItem?.overseerrDetail && overseerrInstance && (
        <OverseerrRequestDialog
          instance={overseerrInstance}
          mediaType={detailItem.overseerrDetail.mediaType}
          tmdbId={detailItem.overseerrDetail.tmdbId}
          fallbackTitle={detailItem.title}
          fallbackPoster={detailItem.imageUrl}
          onClose={() => setDetailItem(null)}
        />
      )}

      {titleDetail && sourceInstance && (
        <TitleDetailDialog
          serviceId={titleDetail.serviceId}
          instance={sourceInstance}
          itemId={titleDetail.itemId}
          onClose={() => setTitleDetail(null)}
        />
      )}
    </motion.div>
  );
}
