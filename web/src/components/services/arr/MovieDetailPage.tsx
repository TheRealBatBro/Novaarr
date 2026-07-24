import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Trash2, Clapperboard, Cloud, Disc, Building2, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useServiceProxy, useServices } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { ReleaseSearchDialog } from './ReleaseSearchDialog';
import { MediaHero } from './detail/MediaHero';
import { MediaCastCrew } from './detail/MediaCastCrew';
import { MediaSimilar } from './detail/MediaSimilar';
import { TrailerModal } from './detail/TrailerModal';
import { useTrailerKey } from './detail/useTrailerKey';
import { daysUntil, countdownLabel } from './ArrLibraryGrid';
import { useBazarrInstance, useBazarrMovieSubtitles, SubtitleLanguageChips, BazarrSubtitleControls } from './BazarrSubtitles';

type RadarrMovieFull = Record<string, unknown> & {
  id: number;
  title: string;
  year?: number;
  overview?: string;
  runtime?: number;
  genres?: string[];
  monitored: boolean;
  qualityProfileId: number;
  rootFolderPath?: string;
  minimumAvailability?: 'tba' | 'announced' | 'inCinemas' | 'released';
  tags?: number[];
  hasFile?: boolean;
  sizeOnDisk?: number;
  status?: string;
  studio?: string;
  added?: string;
  inCinemas?: string;
  physicalRelease?: string;
  digitalRelease?: string;
  tmdbId?: number;
  ratings?: { tmdb?: { value?: number }; imdb?: { value?: number } };
  movieFile?: { id: number; quality?: { quality?: { name?: string } } };
  images?: { coverType: string; remoteUrl?: string; url?: string }[];
};
type Profile = { id: number; name: string };
type RootFolder = { id: number; path: string };
type Tag = { id: number; label: string };

const MIN_AVAILABILITY = ['tba', 'announced', 'inCinemas', 'released'] as const;
const MIN_AVAILABILITY_LABEL: Record<string, string> = { tba: 'TBA', announced: 'Announced', inCinemas: 'In cinemas', released: 'Released' };

function imageUrl(movie: RadarrMovieFull | undefined, coverType: string): string | undefined {
  const img = movie?.images?.find((i) => i.coverType === coverType);
  return img?.remoteUrl || img?.url;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '0 GB';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function formatDate(iso?: string, withWeekday = false): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString(undefined, withWeekday ? { weekday: 'long', month: 'long', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
}

function DetailRow({ icon: Icon, label, children }: { icon: typeof Search; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-b-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

export function MovieDetailPage({
  instance,
  movieId,
  onBack,
}: {
  instance: ServiceInstance;
  movieId: number;
  /** Overrides the default "navigate to the Radarr library" back behavior — used when this
   * page is rendered inside a dashboard modal, where "back" should just close the dialog. */
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [releaseSearchOpen, setReleaseSearchOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const { data: instances = [] } = useServices();
  const overseerr = instances.find((i) => i.serviceId === 'overseerr');
  const bazarr = useBazarrInstance();
  const subtitleInfo = useBazarrMovieSubtitles(movieId);

  const { data: movieResp, isLoading } = useServiceProxy<RadarrMovieFull>(instance, { path: `/api/v3/movie/${movieId}` });
  const trailerKey = useTrailerKey(overseerr, movieResp?.data?.tmdbId, 'movie');
  const { data: profilesResp } = useServiceProxy<Profile[]>(instance, { path: '/api/v3/qualityprofile' });
  const { data: rootFoldersResp } = useServiceProxy<RootFolder[]>(instance, { path: '/api/v3/rootfolder' });
  const { data: tagsResp } = useServiceProxy<Tag[]>(instance, { path: '/api/v3/tag' });

  const movie = movieResp?.data;
  const profiles = profilesResp?.data ?? [];
  const rootFolders = rootFoldersResp?.data ?? [];
  const tags = tagsResp?.data ?? [];

  function goBack() {
    if (onBack) return onBack();
    navigate({ to: '/service/$serviceId', params: { serviceId: instance.serviceId } });
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const saveMovie = useMutation({
    mutationFn: (patch: Partial<RadarrMovieFull>) =>
      proxyApi.call(instance.id, { path: `/api/v3/movie/${movieId}`, method: 'PUT', body: { ...movie, ...patch } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Update failed');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  const deleteMovie = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: `/api/v3/movie/${movieId}`, method: 'DELETE', query: { deleteFiles: 'false' } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Delete failed');
      toast.success(`${movie?.title ?? 'Movie'} removed`);
      invalidate();
      goBack();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  });

  const deleteFile = useMutation({
    mutationFn: (movieFileId: number) => proxyApi.call(instance.id, { path: `/api/v3/moviefile/${movieFileId}`, method: 'DELETE' }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Delete failed');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  });

  const runCommand = useMutation({
    mutationFn: (body: Record<string, unknown>) => proxyApi.call(instance.id, { path: '/api/v3/command', method: 'POST', body }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Search failed to start');
      toast.success('Searching…');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Search failed to start'),
  });

  function toggleTag(tagId: number) {
    const current = movie?.tags ?? [];
    const next = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId];
    saveMovie.mutate({ tags: next });
  }

  if (isLoading || !movie) {
    return (
      <div>
        <Skeleton className="-mx-4 -mt-6 aspect-video w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]" />
        <Skeleton className="mt-6 h-64 w-full rounded-xl" />
      </div>
    );
  }

  const nextRelease = [movie.digitalRelease, movie.physicalRelease, movie.inCinemas]
    .filter((d): d is string => !!d)
    .sort((a, b) => a.localeCompare(b))
    .find((d) => (daysUntil(d) ?? -1) >= 0);
  const days = movie.hasFile ? undefined : daysUntil(nextRelease);
  const upcoming = days !== undefined && days >= 0;
  const missing = !movie.hasFile && movie.monitored && !upcoming;
  const rating = movie.ratings?.tmdb?.value ?? movie.ratings?.imdb?.value;
  const subtitle = [movie.year ? String(movie.year) : undefined, movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : undefined, movie.genres?.[0]]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <MediaHero
        backdropUrl={imageUrl(movie, 'fanart')}
        posterUrl={imageUrl(movie, 'poster')}
        title={movie.title}
        subtitle={subtitle}
        rating={rating}
        badge={upcoming ? { label: countdownLabel(days!), tone: 'upcoming' } : missing ? { label: 'Missing', tone: 'missing' } : undefined}
        onBack={goBack}
        onDelete={() => deleteMovie.mutate()}
        deleteDisabled={deleteMovie.isPending}
        deleteLabel="Remove movie"
        onPlayTrailer={trailerKey ? () => setTrailerOpen(true) : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 sm:col-span-1">
          <span className="text-xs text-muted-foreground">Monitored</span>
          <Switch checked={movie.monitored} onCheckedChange={(v) => saveMovie.mutate({ monitored: v })} aria-label="Monitored" />
        </div>
        <Button variant="outline" disabled={runCommand.isPending} onClick={() => runCommand.mutate({ name: 'MoviesSearch', movieIds: [movieId] })}>
          <Search className="h-3.5 w-3.5" /> Search
        </Button>
        <Button variant="outline" onClick={() => setReleaseSearchOpen(true)}>
          <Search className="h-3.5 w-3.5" /> Manual
        </Button>
        <Select value={movie.qualityProfileId} onChange={(e) => saveMovie.mutate({ qualityProfileId: Number(e.target.value) })}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {upcoming && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <p className="font-semibold text-primary">Coming soon!</p>
          <p className="text-sm text-muted-foreground">
            This movie will release {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} on {formatDate(nextRelease, true)}.
          </p>
        </div>
      )}

      {movie.overview && (
        <div className="mb-6">
          <h2 className="mb-2 text-lg font-bold tracking-tight">Overview</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{movie.overview}</p>
        </div>
      )}

      {movie.hasFile && movie.movieFile && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <span className="text-muted-foreground">
            {movie.movieFile.quality?.quality?.name ?? 'Unknown quality'} · {formatSize(movie.sizeOnDisk)}
          </span>
          <Button variant="outline" size="sm" disabled={deleteFile.isPending} onClick={() => deleteFile.mutate(movie.movieFile!.id)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete file
          </Button>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">Details</h2>
          {detailsOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {detailsOpen && (
          <div className="mt-1">
            <div className="mb-2 grid grid-cols-3 gap-2 border-b border-border py-3 text-center">
              <div>
                <Clapperboard className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Theaters</p>
                <p className="text-xs font-medium">{formatDate(movie.inCinemas)}</p>
              </div>
              <div>
                <Cloud className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Digital</p>
                <p className="text-xs font-medium">{formatDate(movie.digitalRelease)}</p>
              </div>
              <div>
                <Disc className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Physical</p>
                <p className="text-xs font-medium">{formatDate(movie.physicalRelease)}</p>
              </div>
            </div>

            <DetailRow icon={Building2} label="Studio">
              {movie.studio || '—'}
            </DetailRow>
            <DetailRow icon={CalendarDays} label="Added">
              {formatDate(movie.added)}
            </DetailRow>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
              <span className="text-muted-foreground">Min. availability</span>
              <Select
                className="h-8 w-40 text-xs"
                value={movie.minimumAvailability ?? 'released'}
                onChange={(e) => saveMovie.mutate({ minimumAvailability: e.target.value as RadarrMovieFull['minimumAvailability'] })}
              >
                {MIN_AVAILABILITY.map((m) => (
                  <option key={m} value={m}>
                    {MIN_AVAILABILITY_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
              <span className="text-muted-foreground">Root folder</span>
              <Select className="h-8 w-52 text-xs" value={movie.rootFolderPath ?? ''} onChange={(e) => saveMovie.mutate({ rootFolderPath: e.target.value })}>
                {rootFolders.map((f) => (
                  <option key={f.id} value={f.path}>
                    {f.path}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Tags</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
                {tags.map((t) => {
                  const active = movie.tags?.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                        active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {bazarr && movie.hasFile && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Subtitles</h2>
            <div className="flex items-center gap-1">
              <BazarrSubtitleControls bazarr={bazarr} target={{ kind: 'movie', radarrId: movieId }} missing={subtitleInfo?.missing ?? []} title={movie.title} size="md" />
            </div>
          </div>
          {subtitleInfo && (subtitleInfo.missing.length > 0 || subtitleInfo.subtitles.length > 0) ? (
            <SubtitleLanguageChips info={subtitleInfo} />
          ) : (
            <p className="text-sm text-muted-foreground">No subtitle data yet.</p>
          )}
        </div>
      )}

      <MediaCastCrew overseerr={overseerr} tmdbId={movie.tmdbId} mediaType="movie" />
      <MediaSimilar overseerr={overseerr} tmdbId={movie.tmdbId} mediaType="movie" title={movie.title} />

      {trailerOpen && trailerKey && <TrailerModal youtubeKey={trailerKey} title={movie.title} onClose={() => setTrailerOpen(false)} />}

      {releaseSearchOpen && (
        <ReleaseSearchDialog
          instance={instance}
          title={`${movie.title} — Manual search`}
          params={{ movieId }}
          onClose={() => setReleaseSearchOpen(false)}
          onAutoSearch={() => {
            runCommand.mutate({ name: 'MoviesSearch', movieIds: [movieId] });
            setReleaseSearchOpen(false);
          }}
        />
      )}
    </div>
  );
}
