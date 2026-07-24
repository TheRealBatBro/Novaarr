import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';

// NZBHydra2's /api/stats/indexers response shape isn't published with a stable, versioned
// schema the way Prowlarr's Swagger API is — this is a best-effort reading based on its public
// wiki docs (github.com/theotherp/nzbhydra2/wiki/External-API,-RSS-and-cached-queries), not a
// live-verified instance. Every field is read defensively with fallbacks so an unexpected shape
// degrades to "Indexer" / no status line instead of a crash.
type NzbHydra2IndexerStat = {
  name?: string;
  indexerName?: string;
  state?: string;
  disabledUntil?: string | null;
  disabledPermanently?: boolean;
  reason?: string;
  lastError?: string;
};

function isEnabled(ix: NzbHydra2IndexerStat): boolean {
  return !ix.state || ix.state.toUpperCase() === 'ENABLED';
}

export function NzbHydra2IndexersTab({ instance }: { instance: ServiceInstance }) {
  const { data, isLoading } = useServiceProxy<NzbHydra2IndexerStat[]>(instance, { path: 'stats/indexers', refetchInterval: 60_000 });
  const indexers = data?.ok && Array.isArray(data.data) ? data.data : [];
  const openUrl = instance.preferredMode === 'remote' && instance.remoteUrl ? instance.remoteUrl : instance.localUrl;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">
        {indexers.length} Indexer{indexers.length === 1 ? '' : 's'}
      </h2>
      <div className="mb-4 flex flex-col gap-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        {!isLoading && indexers.length === 0 && (
          <p className="text-sm text-muted-foreground">No indexers found — add some from NZBHydra2's own Web UI.</p>
        )}
        {!isLoading &&
          indexers.map((ix, i) => {
            const enabled = isEnabled(ix);
            const reason = ix.reason || ix.lastError;
            return (
              <div key={i} className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3', !enabled && 'opacity-80')}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ix.name ?? ix.indexerName ?? 'Indexer'}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('rounded-full px-1.5 py-0.5 font-medium', enabled ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {!enabled && reason && <span className="truncate">{reason}</span>}
                    {!enabled && ix.disabledUntil && <span className="shrink-0">until {new Date(ix.disabledUntil).toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {openUrl && (
        <Button variant="outline" asChild className="w-full">
          <a href={openUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Open NZBHydra2 for stats &amp; history
          </a>
        </Button>
      )}
    </div>
  );
}
