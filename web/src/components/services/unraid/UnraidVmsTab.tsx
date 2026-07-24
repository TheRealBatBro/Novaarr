import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { type ServiceInstance } from '@/lib/api';
import { VMS_QUERY, VM_START, VM_STOP, useUnraidQuery, gqlData, unraidMutate } from './UnraidApi';

type Vm = { id: string; name?: string; state?: string };
type VmsData = { vms?: { domains?: Vm[] } };

function isRunning(v: Vm): boolean {
  return (v.state ?? '').toUpperCase() === 'RUNNING';
}

export function UnraidVmsTab({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading } = useUnraidQuery<VmsData>(instance, VMS_QUERY, { refetchInterval: 15_000 });
  const vms = gqlData(data)?.vms?.domains ?? [];

  const toggle = useMutation({
    mutationFn: (v: Vm) => unraidMutate(instance, isRunning(v) ? VM_STOP : VM_START, { id: v.id }),
    onSuccess: (res, v) => {
      if (!res.ok) return toast.error(res.error || 'Failed to update VM');
      toast.success(`${v.name ?? 'VM'} ${isRunning(v) ? 'stopping' : 'starting'}`);
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update VM'),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">
        {vms.filter(isRunning).length} of {vms.length} running
      </h2>
      <div className="flex flex-col gap-2">
        {vms.length === 0 && <p className="text-sm text-muted-foreground">No virtual machines found.</p>}
        {vms.map((v) => {
          const running = isRunning(v);
          const busy = toggle.isPending && toggle.variables?.id === v.id;
          return (
            <div key={v.id} className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3', !running && 'opacity-70')}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{v.name ?? v.id}</p>
                <span
                  className={cn(
                    'mt-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium capitalize',
                    running ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {(v.state ?? 'unknown').toLowerCase()}
                </span>
              </div>
              <Switch checked={running} disabled={busy} onCheckedChange={() => toggle.mutate(v)} aria-label={running ? `Stop ${v.name}` : `Start ${v.name}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
