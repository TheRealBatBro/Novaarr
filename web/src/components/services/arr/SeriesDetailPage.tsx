import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Eye, EyeOff, Radio, CalendarDays, Activity, Wand2, Loader2, ChevronDown, ChevronRight, CheckCircle2, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { EpisodeDetailDialog } from './detail/EpisodeDetailDialog';
import { daysUntil, countdownLabel } from './ArrLibraryGrid';
import { useBazarrInstance, useBazarrSeriesSubtitles, useBazarrSeasonAutoSearch, SubtitleLanguageChips } from './BazarrSubtitles';

type SonarrSeriesFull = Record<string, unknown> & {
  id: number;
  title: string;
  overview?: string;
  runtime?: number;
  genres?: string[];
  monitored: boolean;
  qualityProfileId: number;
  rootFolderPath?: string;
  seriesType?: 'standard' | 'anime' | 'daily';
  tags?: number[];
  images?: { coverType: string; remoteUrl?: string; url?: string }[];
  year?: number;
  network?: string;
  status?: string;
  added?: string;
  firstAired?: string;
  tmdbId?: number;
  ratings?: { tmdb?: { value?: number }; imdb?: { value?: number }; value?: number };
  statistics?: {
    seasonCount?: number;
    episodeFileCount?: number;
    episodeCount?: number;
    totalEpisodeCount?: number;
    sizeOnDisk?: number;
    percentOfEpisodes?: number;
  };
};
type Profile = { id: number; name: string };
type RootFolder = { id: number; path: string };
type Tag = { id: number; label: string };
type Episode = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  monitored: boolean;
  hasFile: boolean;
  episodeFileId?: number;
  airDateUtc?: string;
};

const SERIES_TYPES = ['standard', 'anime', 'daily'] as const;

function imageUrl(series: SonarrSeriesFull | undefined, coverType: string): string | undefined {
  const img = series?.images?.find((i) => i.coverType === coverType);
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

function formatAirDate(iso?: string): string {
  if (!iso) return 'Unaired';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unaired';
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const days = daysUntil(iso);
  return days !== undefined && days > 0 ? `Airs ${label}` : label;
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SeasonCompletionChart({ seasons, episodes }: { seasons: number[]; episodes: Episode[] }) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-sm font-medium">Episodes by season</p>
      {seasons.map((sn) => {
        const eps = episodes.filter((e) => e.seasonNumber === sn);
        const total = eps.length;
        const downloaded = eps.filter((e) => e.hasFile).length;
        const pct = total > 0 ? (downloaded / total) * 100 : 0;
        return (
          <div key={sn} className="flex items-center gap-3 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">{sn === 0 ? 'Specials' : `S${sn}`}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" title={`${downloaded}/${total} downloaded`}>
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
              {downloaded}/{total}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SeriesDetailPage({
  instance,
  seriesId,
  onBack,
}: {
  instance: ServiceInstance;
  seriesId: number;
  /** Overrides the default "navigate to the Sonarr library" back behavior — used when this
   * page is rendered inside a dashboard modal, where "back" should just close the dialog. */
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [releaseSearch, setReleaseSearch] = useState<
    null | { title: string; params: { episodeId: number } | { seriesId: number; seasonNumber: number }; autoCommand: 'episode' | 'season'; ids?: number[] }
  >(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [openEpisodeId, setOpenEpisodeId] = useState<number | null>(null);
  const { data: instances = [] } = useServices();
  const overseerr = instances.find((i) => i.serviceId === 'overseerr');

  const { data: seriesResp, isLoading } = useServiceProxy<SonarrSeriesFull>(instance, { path: `/api/v3/series/${seriesId}` });
  const { data: episodesResp } = useServiceProxy<Episode[]>(instance, { path: '/api/v3/episode', query: { seriesId: String(seriesId) } });
  const { data: profilesResp } = useServiceProxy<Profile[]>(instance, { path: '/api/v3/qualityprofile' });
  const { data: rootFoldersResp } = useServiceProxy<RootFolder[]>(instance, { path: '/api/v3/rootfolder' });
  const { data: tagsResp } = useServiceProxy<Tag[]>(instance, { path: '/api/v3/tag' });
  const bazarr = useBazarrInstance();
  const subtitleMap = useBazarrSeriesSubtitles(seriesId);
  const seasonAutoSearch = useBazarrSeasonAutoSearch(bazarr);
  const trailerKey = useTrailerKey(overseerr, seriesResp?.data?.tmdbId, 'tv');

  const series = seriesResp?.data;
  const episodes = episodesResp?.data ?? [];
  const profiles = profilesResp?.data ?? [];
  const rootFolders = rootFoldersResp?.data ?? [];
  const tags = tagsResp?.data ?? [];
  const seasons = Array.from(new Set(episodes.map((e) => e.seasonNumber))).sort((a, b) => b - a);

  function goBack() {
    if (onBack) return onBack();
    navigate({ to: '/service/$serviceId', params: { serviceId: String(instance.id) } });
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const saveSeries = useMutation({
    mutationFn: (patch: Partial<SonarrSeriesFull>) =>
      proxyApi.call(instance.id, { path: `/api/v3/series/${seriesId}`, method: 'PUT', body: { ...series, ...patch } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Update failed');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  const deleteSeries = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: `/api/v3/series/${seriesId}`, method: 'DELETE', query: { deleteFiles: 'false' } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Delete failed');
      toast.success(`${series?.title ?? 'Series'} removed`);
      invalidate();
      goBack();
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

  const toggleEpisodeMonitor = useMutation({
    mutationFn: ({ episodeIds, monitored }: { episodeIds: number[]; monitored: boolean }) =>
      proxyApi.call(instance.id, { path: '/api/v3/episode/monitor', method: 'PUT', body: { episodeIds, monitored } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Update failed');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  function toggleTag(tagId: number) {
    const current = series?.tags ?? [];
    const next = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId];
    saveSeries.mutate({ tags: next });
  }

  if (isLoading || !series) {
    return (
      <div>
        <Skeleton className="-mx-4 -mt-6 aspect-video w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]" />
        <Skeleton className="mt-6 h-96 w-full rounded-xl" />
      </div>
    );
  }

  const hasAnyFile = episodes.some((e) => e.hasFile);
  const days = hasAnyFile ? undefined : daysUntil(series.firstAired);
  const upcoming = days !== undefined && days >= 0;
  const rating = series.ratings?.tmdb?.value ?? series.ratings?.imdb?.value ?? series.ratings?.value;
  const subtitle = [series.year ? String(series.year) : undefined, series.runtime ? `${series.runtime}m` : undefined, series.network || series.genres?.[0]]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <MediaHero
        backdropUrl={imageUrl(series, 'fanart')}
        posterUrl={imageUrl(series, 'poster')}
        title={series.title}
        subtitle={subtitle}
        rating={rating}
        badge={upcoming ? { label: countdownLabel(days!), tone: 'upcoming' } : undefined}
        onBack={goBack}
        onDelete={() => deleteSeries.mutate()}
        deleteDisabled={deleteSeries.isPending}
        deleteLabel="Remove series"
        onPlayTrailer={trailerKey ? () => setTrailerOpen(true) : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Monitored</span>
          <Switch checked={series.monitored} onCheckedChange={(v) => saveSeries.mutate({ monitored: v })} aria-label="Monitored" />
        </div>
        <Button variant="outline" disabled={runCommand.isPending} onClick={() => runCommand.mutate({ name: 'SeriesSearch', seriesId })}>
          <Search className="h-3.5 w-3.5" /> Search all
        </Button>
        <Select className="col-span-2 sm:col-span-1" value={series.qualityProfileId} onChange={(e) => saveSeries.mutate({ qualityProfileId: Number(e.target.value) })}>
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
            {series.title} premieres {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} on {formatDate(series.firstAired, true)}.
          </p>
        </div>
      )}

      {series.overview && (
        <div className="mb-6">
          <h2 className="mb-2 text-lg font-bold tracking-tight">Overview</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{series.overview}</p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Size on disk" value={formatSize(series.statistics?.sizeOnDisk)} />
        <StatTile
          label="Episodes"
          value={`${episodes.filter((e) => e.hasFile).length}/${episodes.length}${
            episodes.length > 0 ? ` (${Math.round((episodes.filter((e) => e.hasFile).length / episodes.length) * 100)}%)` : ''
          }`}
        />
        <StatTile label="Seasons" value={String(seasons.length)} />
        <StatTile label="Status" value={series.status ? series.status[0].toUpperCase() + series.status.slice(1) : '—'} />
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">Details</h2>
          {detailsOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {detailsOpen && (
          <div className="mt-1">
            <DetailRow icon={Radio} label="Network">
              {series.network || '—'}
            </DetailRow>
            <DetailRow icon={Activity} label="Status">
              {series.status ? series.status[0].toUpperCase() + series.status.slice(1) : '—'}
            </DetailRow>
            <DetailRow icon={CalendarDays} label="Added">
              {formatDate(series.added)}
            </DetailRow>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
              <span className="text-muted-foreground">Series type</span>
              <Select
                className="h-8 w-40 text-xs capitalize"
                value={series.seriesType ?? 'standard'}
                onChange={(e) => saveSeries.mutate({ seriesType: e.target.value as SonarrSeriesFull['seriesType'] })}
              >
                {SERIES_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
              <span className="text-muted-foreground">Root folder</span>
              <Select className="h-8 w-52 text-xs" value={series.rootFolderPath ?? ''} onChange={(e) => saveSeries.mutate({ rootFolderPath: e.target.value })}>
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
                  const active = series.tags?.includes(t.id);
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

      <div className="mb-6">
        <h2 className="mb-3 text-lg font-bold tracking-tight">Seasons</h2>
        {seasons.length > 0 && <SeasonCompletionChart seasons={seasons} episodes={episodes} />}

        <div className="flex flex-col gap-3">
          {seasons.map((sn) => {
            const seasonEpisodes = episodes.filter((e) => e.seasonNumber === sn);
            const expanded = expandedSeason === sn;
            const allMonitored = seasonEpisodes.every((e) => e.monitored);
            return (
              <div key={sn} className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between px-4 py-3 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setExpandedSeason(expanded ? null : sn)}
                    className="flex flex-1 items-center gap-1.5 text-left"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    {sn === 0 ? 'Specials' : `Season ${sn}`}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      {seasonEpisodes.filter((e) => e.hasFile).length}/{seasonEpisodes.length}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={allMonitored ? 'Unmonitor season' : 'Monitor season'}
                      onClick={() => toggleEpisodeMonitor.mutate({ episodeIds: seasonEpisodes.map((e) => e.id), monitored: !allMonitored })}
                    >
                      {allMonitored ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Search season"
                      onClick={() => setReleaseSearch({ title: `${series.title} — Season ${sn}`, params: { seriesId, seasonNumber: sn }, autoCommand: 'season' })}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    {bazarr && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Auto-search subtitles for season"
                        title="Auto-search subtitles for season"
                        disabled={seasonAutoSearch.isPending}
                        onClick={() =>
                          seasonAutoSearch.mutate({
                            seriesId,
                            episodes: seasonEpisodes.map((e) => ({ episodeId: e.id, missing: subtitleMap[e.id]?.missing ?? [] })),
                          })
                        }
                      >
                        {seasonAutoSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="flex flex-col gap-1 border-t border-border p-3">
                    {seasonEpisodes.map((ep) => {
                      const subInfo = subtitleMap[ep.id];
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => setOpenEpisodeId(ep.id)}
                          className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={ep.monitored}
                              onCheckedChange={(v) => toggleEpisodeMonitor.mutate({ episodeIds: [ep.id], monitored: v })}
                              aria-label="Monitored"
                              className="h-5 w-9"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              E{ep.episodeNumber} — {ep.title}
                            </p>
                            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                              <span className="shrink-0">{formatAirDate(ep.airDateUtc)}</span>
                              {subInfo && <SubtitleLanguageChips info={subInfo} />}
                            </div>
                          </div>
                          {ep.hasFile ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Downloaded" />
                          ) : (
                            <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Missing" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <MediaCastCrew overseerr={overseerr} tmdbId={series.tmdbId} mediaType="tv" />
      <MediaSimilar overseerr={overseerr} tmdbId={series.tmdbId} mediaType="tv" title={series.title} />

      {trailerOpen && trailerKey && <TrailerModal youtubeKey={trailerKey} title={series.title} onClose={() => setTrailerOpen(false)} />}

      {openEpisodeId !== null && (
        <EpisodeDetailDialog
          instance={instance}
          episodeId={openEpisodeId}
          seriesId={seriesId}
          seriesTitle={series.title}
          bazarr={bazarr}
          subtitleInfo={subtitleMap[openEpisodeId]}
          onClose={() => setOpenEpisodeId(null)}
          onOpenSearch={(ep) => {
            setOpenEpisodeId(null);
            setReleaseSearch({ title: `${series.title} — E${ep.episodeNumber}`, params: { episodeId: ep.id }, autoCommand: 'episode', ids: [ep.id] });
          }}
        />
      )}

      {releaseSearch && (
        <ReleaseSearchDialog
          instance={instance}
          title={releaseSearch.title}
          params={releaseSearch.params}
          onClose={() => setReleaseSearch(null)}
          onAutoSearch={() => {
            if (releaseSearch.autoCommand === 'episode') runCommand.mutate({ name: 'EpisodeSearch', episodeIds: releaseSearch.ids });
            else if ('seasonNumber' in releaseSearch.params) runCommand.mutate({ name: 'SeasonSearch', seriesId, seasonNumber: releaseSearch.params.seasonNumber });
            setReleaseSearch(null);
          }}
        />
      )}
    </div>
  );
}
