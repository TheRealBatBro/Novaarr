import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

const PROFILE_IMAGE = 'https://image.tmdb.org/t/p/w185';

type CastMember = { id: number; name: string; character?: string; profilePath?: string; order: number };
type CrewMember = { id: number; name: string; job?: string; department?: string };
type CreditsResponse = { credits?: { cast?: CastMember[]; crew?: CrewMember[] } };

// Best-effort enrichment via Overseerr's TMDB proxy — Radarr/Sonarr don't carry cast/crew
// themselves. Silently renders nothing if Overseerr isn't configured or the lookup fails.
export function MediaCastCrew({
  overseerr,
  tmdbId,
  mediaType,
}: {
  overseerr?: ServiceInstance;
  tmdbId?: number;
  mediaType: 'movie' | 'tv';
}) {
  const { data } = useServiceProxy<CreditsResponse>(overseerr, {
    path: `/api/v1/${mediaType}/${tmdbId}`,
    refetchInterval: false,
    timeoutMs: 15_000,
    enabled: !!overseerr && !!tmdbId,
  });

  if (!data?.ok) return null;
  const cast = [...(data.data?.credits?.cast ?? [])].sort((a, b) => a.order - b.order).slice(0, 12);
  const crew = data.data?.credits?.crew ?? [];
  const directors = [...new Set(crew.filter((c) => c.job === 'Director').map((c) => c.name))];
  const writers = [...new Set(crew.filter((c) => c.department === 'Writing').map((c) => c.name))];

  if (cast.length === 0 && directors.length === 0 && writers.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-bold tracking-tight">Cast &amp; crew</h2>

      {cast.length > 0 && (
        <div className="no-scrollbar mb-4 flex gap-3 overflow-x-auto pb-1">
          {cast.map((c) => (
            <div key={c.id} className="w-16 shrink-0 text-center">
              <div className="mx-auto mb-1 h-16 w-16 overflow-hidden rounded-full bg-muted">
                {c.profilePath && <img src={`${PROFILE_IMAGE}${c.profilePath}`} alt={c.name} loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <p className="truncate text-[11px] font-medium">{c.name}</p>
              {c.character && <p className="truncate text-[10px] text-muted-foreground">{c.character}</p>}
            </div>
          ))}
        </div>
      )}

      {directors.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Director{directors.length > 1 ? 's' : ''}</p>
          <div className="flex flex-wrap gap-1.5">
            {directors.map((name) => (
              <span key={name} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {writers.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Writers</p>
          <div className="flex flex-wrap gap-1.5">
            {writers.map((name) => (
              <span key={name} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
