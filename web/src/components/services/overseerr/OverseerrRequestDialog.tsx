import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTrailerKey } from '@/components/services/arr/detail/useTrailerKey';
import { TrailerModal } from '@/components/services/arr/detail/TrailerModal';

const BACKDROP_IMAGE = 'https://image.tmdb.org/t/p/w780';
const POSTER_IMAGE = 'https://image.tmdb.org/t/p/w200';

// Media availability enum: 1=unknown, 2=pending, 3=processing, 4=partially available, 5=available.
const MEDIA_STATUS_LABEL: Record<number, string> = { 2: 'Requested', 3: 'Requested', 4: 'Partially available', 5: 'Available' };

type MediaInfo = { status?: number; seasons?: { seasonNumber: number; status: number }[] };
type TmdbSeason = { seasonNumber: number; episodeCount: number };
type TmdbDetails = {
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  runtime?: number;
  genres?: { id: number; name: string }[];
  seasons?: TmdbSeason[];
  mediaInfo?: MediaInfo;
};

type Profile = { id: number; name: string };
type RootFolder = { id: number; path: string; freeSpace: number };
type Tag = { id: number; label: string };
type ServiceInfo = {
  server: { activeProfileId: number; activeDirectory: string; activeTags: number[] };
  profiles: Profile[];
  rootFolders: RootFolder[];
  tags: Tag[];
};

export function OverseerrRequestDialog({
  instance,
  mediaType,
  tmdbId,
  fallbackTitle,
  fallbackPoster,
  onClose,
}: {
  instance: ServiceInstance;
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  fallbackTitle: string;
  fallbackPoster?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(new Set());
  const [profileId, setProfileId] = useState<number | null>(null);
  const [rootFolder, setRootFolder] = useState<string | null>(null);
  const [tags, setTags] = useState<number[] | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);

  // Same path/instance as the details fetch below, so this rides that same cached request
  // instead of firing a second one — see useTrailerKey's own comment.
  const trailerKey = useTrailerKey(instance, tmdbId, mediaType);

  const { data: detailsResp, isLoading } = useServiceProxy<TmdbDetails>(instance, { path: `/api/v1/${mediaType}/${tmdbId}`, refetchInterval: false });
  const { data: serviceResp } = useServiceProxy<ServiceInfo>(instance, {
    path: `/api/v1/service/${mediaType === 'movie' ? 'radarr' : 'sonarr'}/0`,
    refetchInterval: false,
  });

  const details = detailsResp?.data;
  const service = serviceResp?.data;
  const title = details?.title ?? details?.name ?? fallbackTitle;
  const year = (details?.releaseDate ?? details?.firstAirDate)?.slice(0, 4);
  const subtitle = [year, mediaType === 'movie' && details?.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : undefined, details?.genres?.[0]?.name]
    .filter(Boolean)
    .join(' · ');

  const effectiveProfileId = profileId ?? service?.server.activeProfileId;
  const effectiveRootFolder = rootFolder ?? service?.server.activeDirectory;
  const effectiveTags = tags ?? service?.server.activeTags ?? [];

  const seasons = (details?.seasons ?? []).filter((s) => s.seasonNumber > 0);
  const seasonInfo = new Map((details?.mediaInfo?.seasons ?? []).map((s) => [s.seasonNumber, s.status]));
  const selectableSeasons = seasons.filter((s) => !seasonInfo.has(s.seasonNumber));
  const allSelected = selectableSeasons.length > 0 && selectableSeasons.every((s) => selectedSeasons.has(s.seasonNumber));

  function toggleSeason(seasonNumber: number) {
    setSelectedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) next.delete(seasonNumber);
      else next.add(seasonNumber);
      return next;
    });
  }

  function toggleAll() {
    setSelectedSeasons(allSelected ? new Set() : new Set(selectableSeasons.map((s) => s.seasonNumber)));
  }

  function toggleTag(tagId: number) {
    setTags(effectiveTags.includes(tagId) ? effectiveTags.filter((t) => t !== tagId) : [...effectiveTags, tagId]);
  }

  const request = useMutation({
    mutationFn: () =>
      proxyApi.call(instance.id, {
        path: '/api/v1/request',
        method: 'POST',
        body: {
          mediaType,
          mediaId: tmdbId,
          ...(mediaType === 'tv' ? { seasons: [...selectedSeasons] } : {}),
          profileId: effectiveProfileId,
          rootFolder: effectiveRootFolder,
          tags: effectiveTags,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Request failed');
      toast.success('Request sent');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Request failed'),
  });

  const alreadyRequested = mediaType === 'movie' && details?.mediaInfo?.status !== undefined;
  const canRequest = mediaType === 'movie' ? !alreadyRequested : selectedSeasons.size > 0;

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <div className="relative h-36 w-full overflow-hidden rounded-t-xl bg-muted">
          {(details?.backdropPath || fallbackPoster) && (
            <img src={details?.backdropPath ? `${BACKDROP_IMAGE}${details.backdropPath}` : fallbackPoster} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-black/30" />
          {trailerKey && (
            <button
              type="button"
              onClick={() => setTrailerOpen(true)}
              aria-label="Play trailer"
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60">
                <Play className="h-5 w-5 translate-x-0.5 fill-white" />
              </span>
            </button>
          )}
        </div>

        <div className="relative -mt-10 flex items-end gap-3 px-4">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted shadow-lg ring-2 ring-card">
            {(details?.posterPath || fallbackPoster) && (
              <img src={details?.posterPath ? `${POSTER_IMAGE}${details.posterPath}` : fallbackPoster} alt={title} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h2 className="truncate text-lg font-bold leading-tight">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          {isLoading && <Skeleton className="h-24 w-full rounded-lg" />}

          {!isLoading && details?.overview && <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{details.overview}</p>}

          {alreadyRequested && (
            <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              {MEDIA_STATUS_LABEL[details!.mediaInfo!.status!] ?? 'Already requested'}
            </div>
          )}

          {mediaType === 'tv' && seasons.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-3 border-b border-border bg-accent/50 px-3 py-2">
                <Switch checked={allSelected} onCheckedChange={toggleAll} disabled={selectableSeasons.length === 0} aria-label="Select all seasons" />
                <div className="grid flex-1 grid-cols-[1fr_auto_auto] gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Season</span>
                  <span>Episodes</span>
                  <span>Status</span>
                </div>
              </div>
              {seasons.map((s) => {
                const status = seasonInfo.get(s.seasonNumber);
                const label = status === undefined ? 'Not requested' : (MEDIA_STATUS_LABEL[status] ?? 'Requested');
                const tone = status === 5 ? 'bg-success/15 text-success' : status !== undefined ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground';
                return (
                  <div key={s.seasonNumber} className="flex items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0">
                    <Switch
                      checked={selectedSeasons.has(s.seasonNumber)}
                      onCheckedChange={() => toggleSeason(s.seasonNumber)}
                      disabled={status !== undefined}
                      aria-label={`Select season ${s.seasonNumber}`}
                    />
                    <div className="grid flex-1 grid-cols-[1fr_auto_auto] items-center gap-3">
                      <span className="font-medium">{s.seasonNumber}</span>
                      <span className="text-muted-foreground">{s.episodeCount}</span>
                      <span className={cn('w-fit justify-self-end rounded-full px-2 py-0.5 text-xs font-medium', tone)}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && !alreadyRequested && (
            <div className="mb-2 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm">
                <span className="font-medium text-primary">Quality Profile</span>
                <Select
                  className="h-8 w-40 text-xs"
                  value={effectiveProfileId ?? ''}
                  onChange={(e) => setProfileId(Number(e.target.value))}
                >
                  {(service?.profiles ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm">
                <span className="font-medium text-primary">Root Folder</span>
                <Select className="h-8 w-40 text-xs" value={effectiveRootFolder ?? ''} onChange={(e) => setRootFolder(e.target.value)}>
                  {(service?.rootFolders ?? []).map((f) => (
                    <option key={f.id} value={f.path}>
                      {f.path}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="font-medium text-primary">Tags</span>
                <div className="flex max-w-[65%] flex-wrap justify-end gap-1.5">
                  {(service?.tags ?? []).length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                  {(service?.tags ?? []).map((t) => {
                    const active = effectiveTags.includes(t.id);
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

          {!alreadyRequested && (
            <Button className="mt-2 w-full" disabled={!canRequest || request.isPending} onClick={() => request.mutate()}>
              {request.isPending ? 'Requesting…' : 'Request'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {trailerOpen && trailerKey && <TrailerModal youtubeKey={trailerKey} title={title} onClose={() => setTrailerOpen(false)} />}
    </>
  );
}
