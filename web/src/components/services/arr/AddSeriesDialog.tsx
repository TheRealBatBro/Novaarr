import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';

type LookupImage = { coverType: string; remoteUrl?: string; url?: string };
export type SeriesLookupResult = { title: string; year?: number; tvdbId: number; images?: LookupImage[] };
type Profile = { id: number; name: string };
type RootFolder = { id: number; path: string };

function posterUrl(item: { images?: LookupImage[] }): string | undefined {
  const img = item.images?.find((i) => i.coverType === 'poster');
  return img?.remoteUrl || img?.url;
}

export function AddSeriesDialog({
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
  initialResult?: SeriesLookupResult;
}) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SeriesLookupResult[] | null>(null);
  const [selected, setSelected] = useState<SeriesLookupResult | null>(initialResult ?? null);
  const [qualityProfileId, setQualityProfileId] = useState<number | ''>('');
  const [languageProfileId, setLanguageProfileId] = useState<number | ''>('');
  const [rootFolderPath, setRootFolderPath] = useState('');

  const { data: profiles } = useServiceProxy<Profile[]>(instance, { path: '/api/v3/qualityprofile' });
  const { data: langProfiles } = useServiceProxy<Profile[]>(instance, { path: '/api/v3/languageprofile' });
  const { data: rootFolders } = useServiceProxy<RootFolder[]>(instance, { path: '/api/v3/rootfolder' });

  useEffect(() => {
    if (qualityProfileId === '' && profiles?.ok && profiles.data?.[0]) setQualityProfileId(profiles.data[0].id);
    if (languageProfileId === '' && langProfiles?.ok && langProfiles.data?.[0]) setLanguageProfileId(langProfiles.data[0].id);
    if (rootFolderPath === '' && rootFolders?.ok && rootFolders.data?.[0]) setRootFolderPath(rootFolders.data[0].path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, langProfiles, rootFolders]);

  const search = useMutation({
    mutationFn: (term: string) => proxyApi.call<SeriesLookupResult[]>(instance.id, { path: '/api/v3/series/lookup', query: { term } }),
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
        path: '/api/v3/series',
        method: 'POST',
        body: {
          title: selected!.title,
          tvdbId: selected!.tvdbId,
          qualityProfileId: Number(qualityProfileId),
          languageProfileId: Number(languageProfileId),
          rootFolderPath,
          monitored: true,
          addOptions: { monitor: 'all', searchForMissingEpisodes: true },
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || 'Failed to add series');
        return;
      }
      toast.success(`${selected!.title} added`);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
      onAdded();
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add series'),
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
          <DialogTitle>Add series</DialogTitle>
          <DialogDescription>Search for a show and add it to Sonarr.</DialogDescription>
        </DialogHeader>

        {!selected ? (
          <>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a TV show…" className="flex-1" />
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
                    key={r.tvdbId}
                    type="button"
                    onClick={() => setSelected(r)}
                    className="overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary"
                  >
                    <div className="aspect-[2/3] w-full bg-muted">
                      {posterUrl(r) && <img src={posterUrl(r)} alt={r.title} className="h-full w-full object-cover" />}
                    </div>
                    <p className="truncate p-1 text-xs font-medium">
                      {r.title} {r.year ? `(${r.year})` : ''}
                    </p>
                  </button>
                ))}
              {!search.isPending && results?.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No results.</p>}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
                {posterUrl(selected) && <img src={posterUrl(selected)} alt={selected.title} className="h-full w-full object-cover" />}
              </div>
              <div>
                <p className="font-medium">
                  {selected.title} {selected.year ? `(${selected.year})` : ''}
                </p>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-primary hover:underline">
                  Choose a different show
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
              <Label>Language profile</Label>
              <Select value={languageProfileId} onChange={(e) => setLanguageProfileId(Number(e.target.value))}>
                {langProfiles?.data?.map((p) => (
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
              Add series &amp; search for episodes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
