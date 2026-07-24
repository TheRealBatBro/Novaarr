import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { type ServiceInstance } from '@/lib/api';
import { JACKETT_INDEXERS_PATH, type JackettIndexer } from './JackettApi';

export function JackettServerTab({ instance }: { instance: ServiceInstance }) {
  const { data, isLoading } = useServiceProxy<JackettIndexer[]>(instance, {
    path: JACKETT_INDEXERS_PATH,
    query: { configured: 'true' },
    refetchInterval: 60_000,
  });
  const indexers = data?.ok && Array.isArray(data.data) ? data.data : [];
  const errorCount = indexers.filter((ix) => !!ix.last_error).length;

  const openUrl = instance.preferredMode === 'remote' && instance.remoteUrl ? instance.remoteUrl : instance.localUrl;

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Overview</p>
        {isLoading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : (
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-xl font-bold tabular-nums">{indexers.length}</p>
              <p className="text-xs text-muted-foreground">Indexers</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        )}
      </div>

      {openUrl && (
        <Button variant="outline" asChild className="w-full">
          <a href={openUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Open Jackett
          </a>
        </Button>
      )}
    </div>
  );
}
