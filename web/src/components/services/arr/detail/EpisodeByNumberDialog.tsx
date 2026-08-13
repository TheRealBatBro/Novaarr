import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';
import { EpisodeDetailDialog } from './EpisodeDetailDialog';

type SonarrEpisode = { id: number; seasonNumber: number; episodeNumber: number };

/** A Plex-triggered click only carries the season/episode numbers Plex itself reports, not
 * Sonarr's internal episode id — this resolves that id first, then hands off to the same
 * episode-only dialog SeriesDetailPage uses, instead of a whole-series page. */
export function EpisodeByNumberDialog({
  instance,
  seriesId,
  seriesTitle,
  season,
  episode,
  onClose,
}: {
  instance: ServiceInstance;
  seriesId: number;
  seriesTitle: string;
  season: number;
  episode: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useServiceProxy<SonarrEpisode[]>(instance, { path: '/api/v3/episode', query: { seriesId: String(seriesId) } });
  const episodes = data?.ok && Array.isArray(data.data) ? data.data : [];
  const match = episodes.find((e) => e.seasonNumber === season && e.episodeNumber === episode);

  if (isLoading) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <Skeleton className="h-48 w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    );
  }

  if (!match) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <p className="text-sm text-muted-foreground">
            Couldn't find S{season}E{episode} in Sonarr.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return <EpisodeDetailDialog instance={instance} episodeId={match.id} seriesId={seriesId} seriesTitle={seriesTitle} onClose={onClose} />;
}
