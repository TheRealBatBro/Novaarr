import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ombiStatusLabel, TMDB_IMAGE, type OmbiSearchResult } from './OmbiShared';

export type OmbiCombinedResult = OmbiSearchResult & { mediaType: 'movie' | 'tv' };

export function useOmbiSearch(instance: ServiceInstance) {
  return useMutation({
    mutationFn: async (term: string) => {
      const [movies, tv] = await Promise.all([
        proxyApi.call<OmbiSearchResult[]>(instance.id, { path: `/api/v1/Search/movie/${encodeURIComponent(term)}` }),
        proxyApi.call<OmbiSearchResult[]>(instance.id, { path: `/api/v1/Search/tv/${encodeURIComponent(term)}` }),
      ]);
      if (!movies.ok && !tv.ok) return { ok: false, status: movies.status, error: movies.error || tv.error };
      const results: OmbiCombinedResult[] = [
        ...(movies.data ?? []).map((r) => ({ ...r, mediaType: 'movie' as const })),
        ...(tv.data ?? []).map((r) => ({ ...r, mediaType: 'tv' as const })),
      ];
      return { ok: true, status: 200, data: results };
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Search failed'),
  });
}

export function OmbiSearchResultRow({ result, onClick }: { result: OmbiCombinedResult; onClick: () => void }) {
  const status = result.available || result.approved || result.requested ? ombiStatusLabel(result) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left shadow-sm transition-colors hover:border-primary"
    >
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {result.posterPath ? (
          <img src={`${TMDB_IMAGE}${result.posterPath}`} alt={result.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">{result.title}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{result.title}</p>
        <p className="text-xs capitalize text-muted-foreground">{result.mediaType === 'tv' ? 'TV Series' : 'Movie'}</p>
        {status && (
          <span
            className={cn(
              'mt-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium',
              status.tone === 'success' ? 'bg-success/15 text-success' : status.tone === 'destructive' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary',
            )}
          >
            {status.label}
          </span>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
