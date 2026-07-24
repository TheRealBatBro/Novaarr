import { Activity, HardDrive } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { cn } from '@/lib/utils';
import { type ServiceInstance } from '@/lib/api';
import { ARRAY_QUERY, useUnraidQuery, gqlData, formatBytes, kbToBytes, diskStatusTone, formatUptimeSeconds } from './UnraidApi';

type Disk = {
  name?: string;
  device?: string;
  size?: number | string;
  status?: string;
  type?: string;
  temp?: number | null;
  fsSize?: number | string;
  fsFree?: number | string;
  fsUsed?: number | string;
  numErrors?: number;
  isSpinning?: boolean;
};
type ParityHistoryEntry = { date?: string; duration?: number; speed?: number; status?: string; errors?: number };
type ArrayData = {
  array?: {
    state?: string;
    capacity?: { kilobytes?: { free?: string; used?: string; total?: string } };
    parities?: Disk[];
    disks?: Disk[];
    caches?: Disk[];
  };
  parityHistory?: ParityHistoryEntry[];
};

const TONE_DOT: Record<string, string> = { success: 'bg-success', destructive: 'bg-destructive', muted: 'bg-muted-foreground' };

function DiskRow({ disk }: { disk: Disk }) {
  const used = Number(disk.fsUsed ?? 0);
  const total = Number(disk.fsSize ?? 0);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : undefined;
  const tone = diskStatusTone(disk.status);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[tone])} />
          <p className="truncate text-sm font-medium">{disk.name ?? disk.device ?? 'Disk'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {disk.isSpinning === false ? (
            <span>Spun down</span>
          ) : (
            typeof disk.temp === 'number' && <span>{disk.temp}°C</span>
          )}
          {pct !== undefined && <span className="tabular-nums">{Math.round(pct)}%</span>}
        </div>
      </div>
      {pct !== undefined && <ProgressBar value={pct} />}
      {!!disk.numErrors && <p className="mt-1.5 text-xs text-destructive">{disk.numErrors} error{disk.numErrors === 1 ? '' : 's'}</p>}
    </div>
  );
}

export function UnraidArrayTab({ instance }: { instance: ServiceInstance }) {
  const { data, isLoading } = useUnraidQuery<ArrayData>(instance, ARRAY_QUERY, { refetchInterval: 30_000 });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  const array = gqlData(data)?.array;
  const lastParity = gqlData(data)?.parityHistory?.[0];
  const cap = array?.capacity?.kilobytes;
  const capUsed = kbToBytes(cap?.used);
  const capTotal = kbToBytes(cap?.total);

  return (
    <div className="flex flex-col gap-4">
      {lastParity && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Parity</p>
            {lastParity.status && <span className="text-xs capitalize text-muted-foreground">{lastParity.status.toLowerCase()}</span>}
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {lastParity.date && (
              <p>
                Last ran on <span className="font-medium text-foreground">{new Date(lastParity.date).toLocaleDateString()}</span>
              </p>
            )}
            {typeof lastParity.duration === 'number' && (
              <p>
                Took <span className="font-medium text-foreground">{formatUptimeSeconds(lastParity.duration) ?? `${lastParity.duration}s`}</span>
              </p>
            )}
            {typeof lastParity.speed === 'number' && (
              <p>
                Average speed <span className="font-medium text-foreground">{formatBytes(lastParity.speed)}/s</span>
              </p>
            )}
            <p>
              Found <span className="font-medium text-foreground">{lastParity.errors ?? 0}</span> error{(lastParity.errors ?? 0) === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <HardDrive className="h-4 w-4" /> Array
          </h2>
          {capTotal > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatBytes(capUsed)} used of {formatBytes(capTotal)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {array?.parities?.map((d, i) => <DiskRow key={`parity-${i}`} disk={d} />)}
          {array?.disks?.map((d, i) => <DiskRow key={`disk-${i}`} disk={d} />)}
          {!array?.disks?.length && !array?.parities?.length && <p className="text-sm text-muted-foreground">No array disks found.</p>}
        </div>
      </div>

      {!!array?.caches?.length && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold tracking-tight">
            <HardDrive className="h-4 w-4" /> Cache
          </h2>
          <div className="flex flex-col gap-2">
            {array.caches.map((d, i) => (
              <DiskRow key={`cache-${i}`} disk={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
