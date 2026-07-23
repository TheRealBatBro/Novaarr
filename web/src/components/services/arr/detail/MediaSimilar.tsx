import { useNavigate } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

const POSTER_IMAGE = 'https://image.tmdb.org/t/p/w342';

type SimilarItem = { id: number; title?: string; name?: string; posterPath?: string; voteAverage?: number };
type SimilarResponse = { results?: SimilarItem[] };

// Best-effort — same Overseerr/TMDB dependency as MediaCastCrew.
export function MediaSimilar({
  overseerr,
  tmdbId,
  mediaType,
  title,
}: {
  overseerr?: ServiceInstance;
  tmdbId?: number;
  mediaType: 'movie' | 'tv';
  title: string;
}) {
  const navigate = useNavigate();
  const { data } = useServiceProxy<SimilarResponse>(overseerr, {
    path: `/api/v1/${mediaType}/${tmdbId}/similar`,
    refetchInterval: false,
    timeoutMs: 15_000,
    enabled: !!overseerr && !!tmdbId,
  });

  if (!data?.ok) return null;
  const items = (data.data?.results ?? []).slice(0, 15);
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-bold tracking-tight">Similar to {title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'overseerr' } })}
            className="w-28 shrink-0 text-left"
          >
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-sm">
              {item.posterPath ? (
                <img src={`${POSTER_IMAGE}${item.posterPath}`} alt={item.title ?? item.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-1.5 text-center text-[10px] text-muted-foreground">
                  {item.title ?? item.name}
                </div>
              )}
            </div>
            <p className="mt-1 truncate text-xs font-medium">{item.title ?? item.name}</p>
            {item.voteAverage !== undefined && (
              <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {item.voteAverage.toFixed(1)}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
