import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';

export type ProwlarrIndexer = {
  id: number;
  name: string;
  enable: boolean;
  protocol: 'usenet' | 'torrent';
  privacy?: 'public' | 'private' | 'semiPrivate';
  priority: number;
};

export function ProwlarrIndexersTab({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading } = useServiceProxy<ProwlarrIndexer[]>(instance, { path: '/api/v1/indexer', refetchInterval: 60_000 });
  const indexers = data?.ok && Array.isArray(data.data) ? [...data.data].sort((a, b) => a.priority - b.priority) : [];

  const toggle = useMutation({
    mutationFn: (ix: ProwlarrIndexer) =>
      proxyApi.call(instance.id, { path: `/api/v1/indexer/${ix.id}`, method: 'PUT', body: { ...ix, enable: !ix.enable } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to update indexer');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update indexer'),
  });

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">
        {indexers.length} Indexer{indexers.length === 1 ? '' : 's'}
      </h2>
      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        {!isLoading && indexers.length === 0 && (
          <p className="text-sm text-muted-foreground">No indexers configured yet — add some from Prowlarr's own Web UI.</p>
        )}
        {!isLoading &&
          indexers.map((ix) => (
            <div key={ix.id} className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3', !ix.enable && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{ix.name}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 font-medium',
                      ix.protocol === 'torrent' ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success',
                    )}
                  >
                    {ix.protocol === 'torrent' ? 'Torrent' : 'Usenet'}
                  </span>
                  {ix.privacy && <span className="capitalize">{ix.privacy}</span>}
                  <span>Priority {ix.priority}</span>
                </div>
              </div>
              <Switch
                checked={ix.enable}
                onCheckedChange={() => toggle.mutate(ix)}
                aria-label={ix.enable ? `Disable ${ix.name}` : `Enable ${ix.name}`}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
