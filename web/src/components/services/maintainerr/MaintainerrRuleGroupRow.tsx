import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MaintainerrRuleGroup } from './MaintainerrTypes';

function Badge({ active }: { active: boolean }) {
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground')}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function MaintainerrRuleGroupRow({ instance, group, isExecuting }: { instance: ServiceInstance; group: MaintainerrRuleGroup; isExecuting: boolean }) {
  const qc = useQueryClient();

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const runOne = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: `/api/rules/${group.id}/execute`, method: 'POST' }),
    onSuccess: () => {
      toast.success(`Running "${group.name}"`);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to start this rule group'),
  });

  const stopOne = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: `/api/rules/${group.id}/execute/stop`, method: 'POST' }),
    onSuccess: () => {
      toast.success(`Stopping "${group.name}"`);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to stop this rule group'),
  });

  const remove = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: `/api/rules/${group.id}`, method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Rule group deleted');
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete rule group'),
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{group.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {group.libraryId ? `Library ${group.libraryId}` : 'No library'}
          {group.ruleHandlerCronSchedule ? ` · custom schedule` : ''}
          {isExecuting ? ' · running now' : ''}
        </p>
      </div>
      {/* Grouped into one flex item so `justify-between` above only splits name vs. this
          cluster — with these as separate top-level children it spread all of them out evenly
          across the row instead. */}
      <div className="flex shrink-0 items-center gap-1">
        <Badge active={group.isActive} />
        {isExecuting ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Stop" disabled={stopOne.isPending} onClick={() => stopOne.mutate()}>
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Run now" disabled={runOne.isPending} onClick={() => runOne.mutate()}>
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Delete rule group" disabled={remove.isPending} onClick={() => remove.mutate()}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
