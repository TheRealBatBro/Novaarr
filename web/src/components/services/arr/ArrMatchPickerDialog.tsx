import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type RadarrMovie = { id: number; title: string; year?: number };
type SonarrSeries = { id: number; title: string; year?: number };
type SonarrEpisode = { id: number; seasonNumber: number; episodeNumber: number; title?: string };

const LIST_LIMIT = 100;

/** Picks from the movies already in this Radarr instance's own library — manual import
 * reassigns a file to an existing library entry, it doesn't add a new one. */
export function MoviePickerDialog({
  instance,
  onClose,
  onPick,
}: {
  instance: ServiceInstance;
  onClose: () => void;
  onPick: (movie: RadarrMovie) => void;
}) {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useServiceProxy<RadarrMovie[]>(instance, { path: '/api/v3/movie', refetchInterval: false });
  const movies = (data?.ok ? data.data ?? [] : []).filter((m) => m.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle>Pick the movie</DialogTitle>
        </DialogHeader>
        <Input autoFocus placeholder="Search your library…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex max-h-80 min-w-0 flex-col gap-1 overflow-y-auto">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
          {!isLoading && movies.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No matches.</p>}
          {!isLoading &&
            movies.slice(0, LIST_LIMIT).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m)}
                className="min-w-0 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {m.title} {m.year ? <span className="text-muted-foreground">({m.year})</span> : null}
              </button>
            ))}
          {!isLoading && movies.length > LIST_LIMIT && (
            <p className="px-2 py-1 text-xs text-muted-foreground">{movies.length - LIST_LIMIT} more — narrow your search.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Two-step picker for Sonarr: pick a series already in the library, then pick one or more of
 * its episodes (multi-select, since a single file can cover a double episode). */
export function SeriesEpisodePickerDialog({
  instance,
  onClose,
  onPick,
}: {
  instance: ServiceInstance;
  onClose: () => void;
  onPick: (series: SonarrSeries, episodes: SonarrEpisode[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<SonarrSeries | null>(null);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<Set<number>>(new Set());

  const { data: seriesData, isLoading: seriesLoading } = useServiceProxy<SonarrSeries[]>(instance, {
    path: '/api/v3/series',
    refetchInterval: false,
  });
  const series = (seriesData?.ok ? seriesData.data ?? [] : []).filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));

  const { data: episodeData, isLoading: episodesLoading } = useServiceProxy<SonarrEpisode[]>(instance, {
    path: '/api/v3/episode',
    query: selectedSeries ? { seriesId: String(selectedSeries.id) } : undefined,
    enabled: !!selectedSeries,
    refetchInterval: false,
  });
  const episodes = [...(episodeData?.ok ? episodeData.data ?? [] : [])].sort(
    (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
  );

  function toggleEpisode(id: number) {
    setSelectedEpisodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (!selectedSeries) return;
    const chosen = episodes.filter((e) => selectedEpisodeIds.has(e.id));
    if (chosen.length === 0) return;
    onPick(selectedSeries, chosen);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words">{selectedSeries ? `Pick episode(s) — ${selectedSeries.title}` : 'Pick the series'}</DialogTitle>
        </DialogHeader>

        {!selectedSeries ? (
          <>
            <Input autoFocus placeholder="Search your library…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="flex max-h-80 min-w-0 flex-col gap-1 overflow-y-auto">
              {seriesLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
              {!seriesLoading && series.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No matches.</p>}
              {!seriesLoading &&
                series.slice(0, LIST_LIMIT).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSeries(s)}
                    className="min-w-0 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    {s.title} {s.year ? <span className="text-muted-foreground">({s.year})</span> : null}
                  </button>
                ))}
            </div>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setSelectedSeries(null)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Different series
            </Button>
            <div className="flex max-h-72 min-w-0 flex-col gap-1 overflow-y-auto">
              {episodesLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
              {!episodesLoading &&
                episodes.map((ep) => (
                  <label key={ep.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={selectedEpisodeIds.has(ep.id)}
                      onChange={() => toggleEpisode(ep.id)}
                      className="shrink-0"
                    />
                    <span className="min-w-0 truncate">
                      S{ep.seasonNumber}E{String(ep.episodeNumber).padStart(2, '0')}
                      {ep.title ? ` — ${ep.title}` : ''}
                    </span>
                  </label>
                ))}
            </div>
            <Button disabled={selectedEpisodeIds.size === 0} onClick={confirm}>
              Use {selectedEpisodeIds.size || ''} episode{selectedEpisodeIds.size === 1 ? '' : 's'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
