import { AlertTriangle, CheckCircle2, ExternalLink, Info, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';

type SystemStatus = { version?: string };
type HealthCheck = { source: string; type: 'ok' | 'notice' | 'warning' | 'error'; message: string };
type ProwlarrApp = { id: number; name: string; syncLevel?: string };
type IndexerStat = { indexerId: number; numberOfQueries?: number; numberOfGrabs?: number };
type IndexerStatsResponse = { indexers?: IndexerStat[] };

const HEALTH_ICON: Record<string, typeof AlertTriangle> = { ok: CheckCircle2, notice: Info, warning: AlertTriangle, error: XCircle };
const HEALTH_TONE: Record<string, string> = {
  ok: 'text-success',
  notice: 'text-muted-foreground',
  warning: 'text-amber-500',
  error: 'text-destructive',
};

export function ProwlarrServerTab({ instance }: { instance: ServiceInstance }) {
  const { data: statusResp } = useServiceProxy<SystemStatus>(instance, { path: '/api/v1/system/status', refetchInterval: false });
  const { data: healthResp } = useServiceProxy<HealthCheck[]>(instance, { path: '/api/v1/health', refetchInterval: 30_000 });
  const { data: appsResp } = useServiceProxy<ProwlarrApp[]>(instance, { path: '/api/v1/applications', refetchInterval: false });
  const { data: statsResp, isLoading: statsLoading } = useServiceProxy<IndexerStatsResponse>(instance, {
    path: '/api/v1/indexerstats',
    refetchInterval: 60_000,
  });

  const health = healthResp?.ok && Array.isArray(healthResp.data) ? healthResp.data : [];
  const apps = appsResp?.ok && Array.isArray(appsResp.data) ? appsResp.data : [];
  const stats = statsResp?.ok && Array.isArray(statsResp.data?.indexers) ? statsResp.data!.indexers! : [];
  const totalQueries = stats.reduce((sum, s) => sum + (s.numberOfQueries ?? 0), 0);
  const totalGrabs = stats.reduce((sum, s) => sum + (s.numberOfGrabs ?? 0), 0);

  const openUrl = instance.preferredMode === 'remote' && instance.remoteUrl ? instance.remoteUrl : instance.localUrl;

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Overview</p>
        {statsLoading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold tabular-nums">{stats.length}</p>
              <p className="text-xs text-muted-foreground">Indexers</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{totalQueries}</p>
              <p className="text-xs text-muted-foreground">Queries</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{totalGrabs}</p>
              <p className="text-xs text-muted-foreground">Grabs</p>
            </div>
          </div>
        )}
        {statusResp?.data?.version && <p className="mt-3 text-center text-xs text-muted-foreground">Version {statusResp.data.version}</p>}
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-lg font-bold tracking-tight">Health</h2>
        {health.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issues reported.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {health.map((h, i) => {
              const HIcon = HEALTH_ICON[h.type] ?? Info;
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-sm">
                  <HIcon className={cn('mt-0.5 h-4 w-4 shrink-0', HEALTH_TONE[h.type])} />
                  <div className="min-w-0">
                    <p className="font-medium">{h.message}</p>
                    <p className="text-xs text-muted-foreground">{h.source}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {apps.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Connected Apps</h2>
          <div className="flex flex-col gap-2">
            {apps.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span className="font-medium">{a.name}</span>
                {a.syncLevel && <span className="text-xs capitalize text-muted-foreground">{a.syncLevel}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {openUrl && (
        <Button variant="outline" asChild className="w-full">
          <a href={openUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Open Prowlarr
          </a>
        </Button>
      )}
    </div>
  );
}
