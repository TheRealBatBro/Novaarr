import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { type ServiceInstance } from '@/lib/api';
import { DOCKER_QUERY, DOCKER_START, DOCKER_STOP, useUnraidQuery, gqlData, unraidMutate } from './UnraidApi';

type Container = {
  id: string;
  names?: string[];
  image?: string;
  state?: string;
  status?: string;
  autoStart?: boolean;
  isUpdateAvailable?: boolean;
  webUiUrl?: string | null;
};
type DockerData = { docker?: { containers?: Container[] } };

function isRunning(c: Container): boolean {
  return (c.state ?? '').toLowerCase() === 'running';
}

export function UnraidDockerTab({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading } = useUnraidQuery<DockerData>(instance, DOCKER_QUERY, { refetchInterval: 15_000 });
  const containers = gqlData(data)?.docker?.containers ?? [];

  const toggle = useMutation({
    mutationFn: (c: Container) => unraidMutate(instance, isRunning(c) ? DOCKER_STOP : DOCKER_START, { id: c.id }),
    onSuccess: (res, c) => {
      if (!res.ok) return toast.error(res.error || 'Failed to update container');
      toast.success(`${(c.names?.[0] ?? 'Container').replace(/^\//, '')} ${isRunning(c) ? 'stopping' : 'starting'}`);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update container'),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">
        {containers.filter(isRunning).length} of {containers.length} running
      </h2>
      <div className="flex flex-col gap-2">
        {containers.length === 0 && <p className="text-sm text-muted-foreground">No containers found.</p>}
        {containers.map((c) => {
          const running = isRunning(c);
          const busy = toggle.isPending && toggle.variables?.id === c.id;
          return (
            <div key={c.id} className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3', !running && 'opacity-70')}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{(c.names?.[0] ?? c.id).replace(/^\//, '')}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('rounded-full px-1.5 py-0.5 font-medium', running ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                    {c.status || c.state || 'Unknown'}
                  </span>
                  {c.autoStart && <span>Autostart</span>}
                  {c.isUpdateAvailable && <span className="text-amber-500">Update available</span>}
                </div>
              </div>
              <Switch checked={running} disabled={busy} onCheckedChange={() => toggle.mutate(c)} aria-label={running ? `Stop ${c.names?.[0]}` : `Start ${c.names?.[0]}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
