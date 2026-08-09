import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Trash2, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getServiceIcon } from '@/lib/serviceIcons';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { MaintainerrCollectionRow } from './MaintainerrCollectionRow';
import { MaintainerrRuleGroupRow } from './MaintainerrRuleGroupRow';
import type { MaintainerrCollection, MaintainerrRuleGroup, RuleExecuteStatus } from './MaintainerrTypes';

const Icon = getServiceIcon('maintainerr');

export function MaintainerrScreen({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();

  const { data: statusResp } = useServiceProxy<RuleExecuteStatus>(instance, { path: '/api/rules/execute/status', refetchInterval: 5_000 });
  const { data: rulesResp, isLoading: rulesLoading } = useServiceProxy<MaintainerrRuleGroup[]>(instance, { path: '/api/rules', refetchInterval: 60_000 });
  const { data: collectionsResp, isLoading: collectionsLoading } = useServiceProxy<MaintainerrCollection[]>(instance, {
    path: '/api/collections',
    refetchInterval: 60_000,
  });

  const running = !!statusResp?.data?.processingQueue;
  const executingRuleGroupId = statusResp?.data?.executingRuleGroupId ?? null;
  const ruleGroups = rulesResp?.ok ? rulesResp.data ?? [] : [];
  const collections = collectionsResp?.ok ? collectionsResp.data ?? [] : [];

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const runRules = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: '/api/rules/execute', method: 'POST' }),
    onSuccess: () => {
      toast.success('Rule evaluation started');
      invalidateAll();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to start rule evaluation'),
  });

  const handleCollections = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: '/api/collections/handle', method: 'POST' }),
    onSuccess: () => {
      toast.success('Collection handling started — matched media will be actioned per each collection\'s rules');
      invalidateAll();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to start collection handling'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#6366f122', color: '#6366f1' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
          <p className="text-sm text-muted-foreground">Automated library cleanup</p>
        </div>
      </div>

      {running && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
          Rule evaluation is currently running…
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={() => runRules.mutate()} disabled={runRules.isPending || running}>
          <Play className="mr-2 h-4 w-4" /> Run rules now
        </Button>
        <Button variant="outline" onClick={() => handleCollections.mutate()} disabled={handleCollections.isPending}>
          <Trash2 className="mr-2 h-4 w-4" /> Handle collections now
        </Button>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
          <Layers className="h-4 w-4 text-muted-foreground" /> Rule groups
        </h2>
        {rulesLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : ruleGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rule groups configured yet — set them up from Maintainerr's own interface.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ruleGroups.map((g) => (
              <MaintainerrRuleGroupRow key={g.id} instance={instance} group={g} isExecuting={executingRuleGroupId === g.id} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
          <Clock className="h-4 w-4 text-muted-foreground" /> Collections
        </h2>
        {collectionsLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collections yet — a collection is created automatically once a rule group runs.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {collections.map((c) => (
              <MaintainerrCollectionRow key={c.id} instance={instance} collection={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
