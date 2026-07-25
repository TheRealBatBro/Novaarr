import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { PosterRatingBadges } from './ArrPosterBadges';

type LookupImage = { coverType: string; remoteUrl?: string; url?: string };
type RatingSource = { votes: number; value: number };
export type MovieLookupResult = {
  title: string;
  year?: number;
  tmdbId: number;
  images?: LookupImage[];
  runtime?: number;
  certification?: string;
  genres?: string[];
  studio?: string;
  overview?: string;
  ratings?: { imdb?: RatingSource; tmdb?: RatingSource; rottenTomatoes?: RatingSource; metacritic?: RatingSource };
};
type Profile = { id: number; name: string };
type RootFolder = { id: number; path: string };

function posterUrl(item: { images?: LookupImage[] }): string | undefined {
  const img = item.images?.find((i) => i.coverType === 'poster');
  return img?.remoteUrl || img?.url;
}

function subtitle(r: MovieLookupResult): string {
  return [r.year, r.runtime ? `${r.runtime}m` : undefined, r.certification].filter(Boolean).join(' · ');
}

export function AddMovieDialog({
  instance,
  open,
  onOpenChange,
  onAdded,
  initialResult,
}: {
  instance: ServiceInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
  /** Skips straight to the quality-profile/root-folder step, pre-selected — used when the caller
   * (e.g. universal search) already picked a specific title instead of searching from scratch. */
  initialResult?: MovieLookupResult;
}) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieLookupResult[] | null>(null);
  const [selected, setSelected] = useState<MovieLookupResult | null>(initialResult ?? null);
  const [qualityProfileId, setQualityProfileId] = useState<number | ''>('');
  const [rootFolderPath, setRootFolderPath] = useState('');

  const { data: profiles } = useServiceProxy<Profile[]>(instance, { path: '/api/v3/qualityprofile' });
  const { data: rootFolders } = useServiceProxy<RootFolder[]>(instance, { path: '/api/v3/rootfolder' });

  useEffect(() => {
    if (qualityProfileId === '' && profiles?.ok && profiles.data?.[0]) setQualityProfileId(profiles.data[0].id);
    if (rootFolderPath === '' && rootFolders?.ok && rootFolders.data?.[0]) setRootFolderPath(rootFolders.data[0].path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, rootFolders]);

  const search = useMutation({
    mutationFn: (term: string) => proxyApi.call<MovieLookupResult[]>(instance.id, { path: '/api/v3/movie/lookup', query: { term } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || 'Search failed');
        setResults([]);
        return;
      }
      setResults(res.data ?? []);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    },
  });

  const add = useMutation({
    mutationFn: () =>
      proxyApi.call(instance.id, {
        path: '/api/v3/movie',
        method: 'POST',
        body: {
          title: selected!.title,
          tmdbId: selected!.tmdbId,
          qualityProfileId: Number(qualityProfileId),
          rootFolderPath,
          monitored: true,
          minimumAvailability: 'released',
          addOptions: { searchForMovie: true },
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || 'Failed to add movie');
        return;
      }
      toast.success(`${selected!.title} added`);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
      onAdded();
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add movie'),
  });

  function close() {
    setQuery('');
    setResults(null);
    setSelected(null);
    onOpenChange(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    search.mutate(query.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-xl sm:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add movie</DialogTitle>
          <DialogDescription>Search for a movie and add it to Radarr.</DialogDescription>
        </DialogHeader>

        {!selected ? (
          <>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a movie…" className="flex-1" />
              <Button type="submit" disabled={search.isPending || !query.trim()}>
                Search
              </Button>
            </form>
            {/* auto-rows-max: with the default `grid-auto-rows: auto`, Chrome sizes each row from
                the aspect-ratio poster's min-content contribution instead of its rendered height,
                collapsing every row to ~text-height and stacking posters on top of each other. */}
            <div className="grid max-h-80 grid-cols-3 auto-rows-max gap-2 overflow-y-auto sm:max-h-[28rem] sm:grid-cols-4 lg:max-h-[36rem] lg:grid-cols-5">
              {search.isPending && Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />)}
              {!search.isPending &&
                results?.map((r) => (
                  <button
                    key={r.tmdbId}
                    type="button"
                    onClick={() => setSelected(r)}
                    className="overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary"
                  >
                    <div className="relative aspect-[2/3] w-full bg-muted">
                      {posterUrl(r) && <img src={posterUrl(r)} alt={r.title} className="h-full w-full object-cover" />}
                      <PosterRatingBadges imdb={r.ratings?.imdb?.value} rottenTomatoes={r.ratings?.rottenTomatoes?.value} />
                    </div>
                    <div className="p-1.5">
                      <p className="line-clamp-2 text-xs font-medium leading-snug">{r.title}</p>
                      {subtitle(r) && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{subtitle(r)}</p>}
                    </div>
                  </button>
                ))}
              {!search.isPending && results?.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No results.</p>}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="h-28 w-20 shrink-0 overflow-hidden rounded bg-muted">
                {posterUrl(selected) && <img src={posterUrl(selected)} alt={selected.title} className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium leading-snug">{selected.title}</p>
                {subtitle(selected) && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle(selected)}</p>}
                {(selected.ratings?.imdb?.value !== undefined || selected.ratings?.rottenTomatoes?.value !== undefined) && (
                  <p className="mt-1 flex items-center gap-3 text-xs">
                    {selected.ratings?.imdb?.value !== undefined && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {selected.ratings.imdb.value.toFixed(1)} IMDb
                      </span>
                    )}
                    {selected.ratings?.rottenTomatoes?.value !== undefined && (
                      <span>🍅 {Math.round(selected.ratings.rottenTomatoes.value)}%</span>
                    )}
                  </p>
                )}
                {(selected.studio || !!selected.genres?.length) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[selected.studio, selected.genres?.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                  </p>
                )}
                {selected.overview && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{selected.overview}</p>}
                <button type="button" onClick={() => setSelected(null)} className="mt-1 text-xs text-primary hover:underline">
                  Choose a different movie
                </button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Quality profile</Label>
              <Select value={qualityProfileId} onChange={(e) => setQualityProfileId(Number(e.target.value))}>
                {profiles?.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Root folder</Label>
              <Select value={rootFolderPath} onChange={(e) => setRootFolderPath(e.target.value)}>
                {rootFolders?.data?.map((f) => (
                  <option key={f.id} value={f.path}>
                    {f.path}
                  </option>
                ))}
              </Select>
            </div>

            <Button onClick={() => add.mutate()} disabled={add.isPending || !qualityProfileId || !rootFolderPath}>
              Add movie &amp; search
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
