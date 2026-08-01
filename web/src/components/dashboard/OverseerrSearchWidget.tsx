import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import type { ServiceInstance } from '@/lib/api';
import {
  useOverseerrSearch,
  OverseerrSearchResultRow,
  TMDB_IMAGE,
  type OverseerrSearchResult,
} from '@/components/services/overseerr/OverseerrSearch';
import { OverseerrRequestDialog } from '@/components/services/overseerr/OverseerrRequestDialog';

const RESULT_LIMIT = 4;

export function OverseerrSearchWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const definition = getServiceDefinition('overseerr');
  const Icon = getServiceIcon('overseerr');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OverseerrSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<OverseerrSearchResult | null>(null);
  const search = useOverseerrSearch(instance);
  // Guards against a slower response for an earlier, shorter query (e.g. "young") resolving
  // after a newer one ("young sheldon") and overwriting its results with stale data.
  const latestQueryRef = useRef('');

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      latestQueryRef.current = '';
      setResults(null);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      latestQueryRef.current = q;
      search.mutate(q, {
        onSuccess: (res) => {
          if (latestQueryRef.current !== q) return;
          if (!res.ok) {
            setResults([]);
            setError(res.error || `Server returned HTTP ${res.status}`);
            return;
          }
          setError(null);
          setResults((res.data?.results ?? []).filter((r) => r.mediaType === 'movie' || r.mediaType === 'tv').slice(0, RESULT_LIMIT));
        },
      });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <p className="truncate text-sm font-semibold">{title}</p>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies or TV shows…"
          className="h-9 pl-8 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          Couldn't load — {error}
        </p>
      )}

      {!error && results !== null && (
        <div className="flex flex-col gap-2">
          {results.length === 0 && <p className="text-sm text-muted-foreground">No results.</p>}
          {results.map((r) => (
            <OverseerrSearchResultRow key={`${r.mediaType}-${r.id}`} result={r} onClick={() => setOpenResult(r)} />
          ))}
        </div>
      )}

      {openResult && (
        <OverseerrRequestDialog
          instance={instance}
          mediaType={openResult.mediaType === 'tv' ? 'tv' : 'movie'}
          tmdbId={openResult.id}
          fallbackTitle={openResult.title ?? openResult.name ?? 'Untitled'}
          fallbackPoster={openResult.posterPath ? `${TMDB_IMAGE}${openResult.posterPath}` : undefined}
          onClose={() => setOpenResult(null)}
        />
      )}
    </div>
  );
}
