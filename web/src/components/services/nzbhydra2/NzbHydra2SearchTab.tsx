import { useState } from 'react';
import { Download } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { proxyApi, type ServiceInstance } from '@/lib/api';

type TorznabAttr = { '@_name': string; '@_value': string };
type TorznabItem = {
  title?: string;
  link?: string;
  size?: string | number;
  enclosure?: { '@_url'?: string };
  'newznab:attr'?: TorznabAttr | TorznabAttr[];
};
type TorznabResponse = { rss?: { channel?: { item?: TorznabItem[] } } };

function getAttr(item: TorznabItem, name: string): string | undefined {
  const attrs = item['newznab:attr'];
  if (!attrs) return undefined;
  const arr = Array.isArray(attrs) ? attrs : [attrs];
  return arr.find((a) => a['@_name'] === name)?.['@_value'];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function NzbHydra2SearchTab({ instance }: { instance: ServiceInstance }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TorznabItem[] | null>(null);

  const search = useMutation({
    mutationFn: (q: string) => proxyApi.call<TorznabResponse>(instance.id, { path: '', query: { t: 'search', q } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || 'Search failed');
        setResults([]);
        return;
      }
      setResults(res.data?.rss?.channel?.item ?? []);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    search.mutate(query.trim());
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search across all your indexers…" className="flex-1" />
        <Button type="submit" disabled={search.isPending || !query.trim()}>
          Search
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {search.isPending && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          {!search.isPending && results === null && <p className="text-sm text-muted-foreground">Search for something to get started.</p>}
          {!search.isPending && results !== null && results.length === 0 && <p className="text-sm text-muted-foreground">No results.</p>}
          {!search.isPending &&
            results?.map((item, i) => {
              const downloadUrl = item.enclosure?.['@_url'] || item.link;
              const sizeBytes = Number(getAttr(item, 'size') ?? item.size ?? 0);
              return (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title ?? 'Untitled'}</p>
                    {sizeBytes > 0 && <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>}
                  </div>
                  {downloadUrl && (
                    <Button variant="outline" size="sm" className="shrink-0" asChild>
                      <a href={downloadUrl} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5" /> Get
                      </a>
                    </Button>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
