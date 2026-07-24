import { Activity, Battery, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { type ServiceInstance } from '@/lib/api';
import { useUnraidQuery, gqlData, SYSTEM_QUERY, UPS_QUERY, formatUptimeSeconds } from './UnraidApi';

type SystemData = { info?: { os?: { hostname?: string; uptime?: number | string } }; array?: { state?: string } };
type UpsDevice = {
  id: string;
  name?: string;
  model?: string;
  status?: string;
  battery?: { chargeLevel?: number; estimatedRuntime?: number; health?: string };
  power?: { inputVoltage?: number; outputVoltage?: number; loadPercentage?: number };
};
type UpsData = { upsDevices?: UpsDevice[] };

export function UnraidSystemTab({ instance }: { instance: ServiceInstance }) {
  const { data, isLoading } = useUnraidQuery<SystemData>(instance, SYSTEM_QUERY, { refetchInterval: 30_000 });
  const { data: upsResp } = useUnraidQuery<UpsData>(instance, UPS_QUERY, { refetchInterval: 30_000 });

  const info = gqlData(data)?.info;
  const arrayState = gqlData(data)?.array?.state;
  const uptime = typeof info?.os?.uptime === 'number' ? formatUptimeSeconds(info.os.uptime) : undefined;
  const upsDevices = gqlData(upsResp)?.upsDevices ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{info?.os?.hostname ?? instance.displayName}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {arrayState && (
            <div>
              <p className="text-xs text-muted-foreground">Array</p>
              <p className="font-medium capitalize">{arrayState.toLowerCase().replace(/_/g, ' ')}</p>
            </div>
          )}
          {uptime && (
            <div>
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="font-medium">{uptime}</p>
            </div>
          )}
        </div>
      </div>

      {upsDevices.map((ups) => (
        <div key={ups.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold">{ups.name ?? 'UPS'}</p>
            {ups.model && <p className="text-xs text-muted-foreground">{ups.model}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {ups.status && (
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{ups.status.toLowerCase()}</p>
              </div>
            )}
            {ups.power?.loadPercentage !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">UPS load</p>
                <p className="font-medium">{Math.round(ups.power.loadPercentage)}%</p>
              </div>
            )}
            {ups.battery?.estimatedRuntime !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Runtime left</p>
                <p className="font-medium">{Math.round(ups.battery.estimatedRuntime / 60)} min</p>
              </div>
            )}
          </div>
          {ups.battery?.chargeLevel !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              <Battery className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <ProgressBar value={ups.battery.chargeLevel} className="flex-1" />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(ups.battery.chargeLevel)}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
