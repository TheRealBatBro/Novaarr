import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  const [openResult, setOpenResult] = useState<OverseerrSearchResult | null>(null);
  const search = useOverseerrSearch(instance);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    search.mutate(q, {
      onSuccess: (res) => {
        if (!res.ok) {
          setResults([]);
          return;
        }
        setResults((res.data?.results ?? []).filter((r) => r.mediaType === 'movie' || r.mediaType === 'tv').slice(0, RESULT_LIMIT));
      },
    });
  }

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

      <form onSubmit={handleSearch} className="mb-3 flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search movies or TV shows…" className="h-9 flex-1 text-sm" />
        <Button type="submit" size="sm" disabled={search.isPending || !query.trim()}>
          <Search className="h-3.5 w-3.5" />
        </Button>
      </form>

      {results !== null && (
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
