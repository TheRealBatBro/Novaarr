import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';

export const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w200';

// Media availability enum: 2=pending, 3=processing, 4=partially available, 5=available.
export const MEDIA_STATUS_LABEL: Record<number, string> = { 2: 'Requested', 3: 'Requested', 4: 'Partially available', 5: 'Available' };

export type OverseerrSearchResult = {
  id: number;
  mediaType: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  posterPath?: string;
  mediaInfo?: { status: number };
};
type SearchResponse = { results?: OverseerrSearchResult[] };

export function useOverseerrSearch(instance: ServiceInstance) {
  return useMutation({
    mutationFn: (q: string) => proxyApi.call<SearchResponse>(instance.id, { path: '/api/v1/search', query: { query: q, page: '1' } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Search failed'),
  });
}

export function OverseerrSearchResultRow({ result, onClick }: { result: OverseerrSearchResult; onClick: () => void }) {
  const title = result.title ?? result.name ?? 'Untitled';
  const available = result.mediaInfo?.status;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left shadow-sm transition-colors hover:border-primary"
    >
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {result.posterPath ? (
          <img src={`${TMDB_IMAGE}${result.posterPath}`} alt={title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">{title}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{title}</p>
        <p className="text-xs capitalize text-muted-foreground">{result.mediaType === 'tv' ? 'TV Series' : 'Movie'}</p>
        {available && (
          <span
            className={cn(
              'mt-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium',
              available === 5 ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary',
            )}
          >
            {MEDIA_STATUS_LABEL[available] ?? 'Requested'}
          </span>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
