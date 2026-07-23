import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServices, useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';

type ProwlarrRelease = {
  guid: string;
  title: string;
  indexer?: string;
  indexerId: number;
  size?: number;
  seeders?: number;
  protocol: 'usenet' | 'torrent';
  infoUrl?: string;
  downloadUrl?: string;
};
type SabnzbdCategoriesResponse = { categories?: string[] };

const PRIORITIES = [
  { value: '-100', label: 'Default priority' },
  { value: '-2', label: 'Paused' },
  { value: '-1', label: 'Low' },
  { value: '0', label: 'Normal' },
  { value: '1', label: 'High' },
  { value: '2', label: 'Force' },
];

function formatBytes(bytes?: number): string {
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

/** Searches across every enabled indexer at once. "Send" goes straight to your configured
 * SABnzbd instance (its own /api?mode=addurl, same call as the "Add NZB" dialog elsewhere in the
 * app) using the category/priority chosen here — Prowlarr's own grab endpoint (POST /api/v1/search)
 * always routes to whatever single "Default Category" is configured on its download client and
 * can't be overridden per request, which is exactly the control this is meant to add. Falls back
 * to Prowlarr's own grab for anything that isn't a Usenet release with SABnzbd configured (e.g. a
 * torrent-protocol result), since no torrent client is wired up for direct sending yet. */
export function ProwlarrSearchTab({ instance }: { instance: ServiceInstance }) {
  const { data: instances = [] } = useServices();
  const sabnzbd = instances.find((i) => i.serviceId === 'sabnzbd' && i.enabled);

  const { data: catsResp } = useServiceProxy<SabnzbdCategoriesResponse>(sabnzbd, {
    path: '/api',
    query: { mode: 'get_cats', output: 'json' },
    refetchInterval: false,
  });
  const categories = (catsResp?.ok ? catsResp.data?.categories ?? [] : []).filter((c) => c !== '*');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProwlarrRelease[] | null>(null);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('-100');

  const search = useMutation({
    mutationFn: (q: string) =>
      proxyApi.call<ProwlarrRelease[]>(instance.id, { path: '/api/v1/search', query: { query: q, type: 'search' }, timeoutMs: 25_000 }),
    onSuccess: (res) => {
      if (!res.ok || !Array.isArray(res.data)) {
        toast.error(res.error || 'Search failed');
        setResults([]);
        return;
      }
      setResults(res.data);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    },
  });

  const grab = useMutation({
    mutationFn: (r: ProwlarrRelease) => {
      if (sabnzbd && r.protocol === 'usenet' && r.downloadUrl) {
        return proxyApi.call(sabnzbd.id, {
          path: '/api',
          query: { mode: 'addurl', name: r.downloadUrl, ...(category ? { cat: category } : {}), priority },
        });
      }
      return proxyApi.call(instance.id, { path: '/api/v1/search', method: 'POST', body: { guid: r.guid, indexerId: r.indexerId } });
    },
    onSuccess: (res, r) => {
      if (!res.ok) return toast.error(res.error || `Failed to send "${r.title}"`);
      toast.success(`Sent "${r.title}"${category ? ` to ${category}` : ''}`);
    },
    onError: (e, r) => toast.error(e instanceof Error ? e.message : `Failed to send "${r.title}"`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    search.mutate(query.trim());
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-3 flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search across all indexers…" className="flex-1" />
        <Button type="submit" disabled={search.isPending || !query.trim()}>
          Search
        </Button>
      </form>

      {sabnzbd && categories.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1">
            <option value="">Default category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-40 shrink-0">
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {search.isPending && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        {!search.isPending && results === null && <p className="text-sm text-muted-foreground">Search for something to get started.</p>}
        {!search.isPending && results !== null && results.length === 0 && <p className="text-sm text-muted-foreground">No results.</p>}
        {!search.isPending &&
          results?.map((r) => {
            const sending = grab.isPending && grab.variables?.guid === r.guid;
            return (
              <div key={r.guid} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 font-medium',
                        r.protocol === 'torrent' ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success',
                      )}
                    >
                      {r.protocol === 'torrent' ? 'Torrent' : 'Usenet'}
                    </span>
                    {r.indexer && <span>{r.indexer}</span>}
                    {formatBytes(r.size) && <span>{formatBytes(r.size)}</span>}
                    {r.protocol === 'torrent' && r.seeders !== undefined && <span>{r.seeders} seeders</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {r.infoUrl && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={r.infoUrl} target="_blank" rel="noreferrer" aria-label="Open info page">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={sending} onClick={() => grab.mutate(r)}>
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {sending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
