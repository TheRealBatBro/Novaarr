import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type Video = { type?: string; site?: string; key?: string };
type VideosResponse = { relatedVideos?: Video[] };

// Shares the same query key as MediaCastCrew's credits lookup (same path/instance), so this
// rides the existing cached fetch instead of issuing a second request to Overseerr.
export function useTrailerKey(overseerr: ServiceInstance | undefined, tmdbId: number | undefined, mediaType: 'movie' | 'tv'): string | undefined {
  const { data } = useServiceProxy<VideosResponse>(overseerr, {
    path: `/api/v1/${mediaType}/${tmdbId}`,
    refetchInterval: false,
    timeoutMs: 15_000,
    enabled: !!overseerr && !!tmdbId,
  });

  const videos = data?.ok ? data.data?.relatedVideos ?? [] : [];
  const trailer = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ?? videos.find((v) => v.site === 'YouTube');
  return trailer?.key;
}
