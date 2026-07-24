import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FlaskConical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';
import { JACKETT_INDEXERS_PATH, type JackettIndexer } from './JackettApi';

export function JackettIndexersTab({ instance }: { instance: ServiceInstance }) {
  const { data, isLoading } = useServiceProxy<JackettIndexer[]>(instance, {
    path: JACKETT_INDEXERS_PATH,
    query: { configured: 'true' },
    refetchInterval: 60_000,
  });
  const indexers = data?.ok && Array.isArray(data.data) ? data.data : [];
  // A redirect-to-login or an HTML error page both fail JSON parsing — data.data ends up a raw
  // string instead of an array in that case, which is exactly the "admin password is set" scenario
  // called out in this service's helpText.
  const blockedByLogin = data?.ok && typeof data.data === 'string';

  const test = useMutation({
    mutationFn: (ix: JackettIndexer) => proxyApi.call(instance.id, { path: `${JACKETT_INDEXERS_PATH}/${ix.id}/test`, method: 'POST' }),
    onSuccess: (res, ix) => {
      if (!res.ok) return toast.error(res.error || `${ix.name} test failed`);
      toast.success(`${ix.name} is working`);
    },
    onError: (e, ix) => toast.error(e instanceof Error ? e.message : `${ix.name} test failed`),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (blockedByLogin) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load the indexer list — this usually means Jackett has an admin password set, which the indexer-management API doesn't accept a
        plain API key for. Search still works either way.
      </p>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">
        {indexers.length} Indexer{indexers.length === 1 ? '' : 's'}
      </h2>
      <div className="flex flex-col gap-2">
        {indexers.length === 0 && <p className="text-sm text-muted-foreground">No indexers configured yet — add some from Jackett's own Web UI.</p>}
        {indexers.map((ix) => (
          <div key={ix.id} className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3', !!ix.last_error && 'border-destructive/40')}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ix.name}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {ix.type && (
                  <span className={cn('rounded-full px-1.5 py-0.5 font-medium capitalize', ix.type === 'private' ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success')}>
                    {ix.type}
                  </span>
                )}
                {ix.language && <span className="uppercase">{ix.language}</span>}
                {ix.last_error && <span className="truncate text-destructive">{ix.last_error}</span>}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={test.isPending && test.variables?.id === ix.id}
              onClick={() => test.mutate(ix)}
            >
              <FlaskConical className="h-3.5 w-3.5" /> Test
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
