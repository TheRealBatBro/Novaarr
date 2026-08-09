import { HardDrive } from 'lucide-react';
import { useServices, useServiceProxy, useServiceProxyQueries } from '@/lib/queries';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressBar } from '@/components/shared/ProgressBar';
import type { ServiceInstance } from '@/lib/api';

// Sonarr/Radarr's own /api/v3/diskspace — every mount actually relevant to that app (typically
// wherever its own root folders live, e.g. Sonarr's /tv, Radarr's /movies), NOT necessarily every
// host-wide mount. Different arr apps commonly point at different mounts, so every configured
// instance needs its own query — querying only one (as this used to do) silently dropped any
// mount not shared with whichever instance happened to be first. Merged and deduped by `path`
// across instances afterward, since two apps sharing a mount (e.g. both under one big /data
// volume) would otherwise render the same disk twice.
type DiskSpaceEntry = { path: string; label?: string; freeSpace: number; totalSpace: number };

// SABnzbd's own /api?mode=queue response carries its two configured folders' free/total space
// directly (complete + incomplete download dirs) — decimal GB strings, not bytes like Sonarr/
// Radarr's diskspace endpoint, and with no path string to dedupe against those by, so these are
// kept as their own separate rows rather than merged in.
type SabnzbdQueueDiskspace = {
  queue?: { diskspace1?: string; diskspace2?: string; diskspacetotal1?: string; diskspacetotal2?: string };
};

function formatGb(bytesOrGb: number, unit: 'bytes' | 'gb'): number {
  return unit === 'bytes' ? bytesOrGb / 1024 / 1024 / 1024 : bytesOrGb;
}

type Row = { label: string; freeGb: number; totalGb: number };

function DiskSpaceRows({ instances }: { instances: ServiceInstance[] }) {
  const results = useServiceProxyQueries<DiskSpaceEntry[]>(instances, { path: '/api/v3/diskspace', refetchInterval: 300_000 });

  // Dedupe by mount path across every instance — a second app pointed at the same underlying
  // volume (e.g. Sonarr and Radarr both under one /data mount) would otherwise render it twice.
  const byPath = new Map<string, DiskSpaceEntry>();
  for (const r of results) {
    if (!r.data?.ok) continue;
    for (const d of r.data.data ?? []) {
      if (!byPath.has(d.path)) byPath.set(d.path, d);
    }
  }

  return (
    <>
      {[...byPath.values()].map((d) => (
        <Row key={d.path} label={d.label || d.path} freeGb={formatGb(d.freeSpace, 'bytes')} totalGb={formatGb(d.totalSpace, 'bytes')} />
      ))}
    </>
  );
}

function SabnzbdRows({ instance }: { instance: ServiceInstance }) {
  const { data } = useServiceProxy<SabnzbdQueueDiskspace>(instance, {
    path: '/api',
    query: { mode: 'queue', output: 'json' },
    refetchInterval: 300_000,
    staleTime: 300_000,
  });
  if (!data?.ok) return null;
  const q = data.data?.queue;
  if (!q) return null;
  const rows: { label: string; free?: string; total?: string }[] = [
    { label: `${instance.displayName} — downloads`, free: q.diskspace1, total: q.diskspacetotal1 },
    { label: `${instance.displayName} — incomplete`, free: q.diskspace2, total: q.diskspacetotal2 },
  ];
  return (
    <>
      {rows
        .filter((r) => r.free !== undefined && r.total !== undefined)
        .map((r) => <Row key={r.label} label={r.label} freeGb={Number(r.free)} totalGb={Number(r.total)} />)}
    </>
  );
}

function Row({ label, freeGb, totalGb }: { label: string; freeGb: number; totalGb: number }) {
  if (!Number.isFinite(freeGb) || !Number.isFinite(totalGb) || totalGb <= 0) return null;
  const usedGb = totalGb - freeGb;
  const pct = Math.min(100, Math.max(0, (usedGb / totalGb) * 100));
  const low = pct >= 90;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 text-muted-foreground">
          {freeGb.toFixed(0)} GB free of {totalGb.toFixed(0)} GB
        </span>
      </div>
      <ProgressBar value={pct} className={low ? '[&>div]:bg-destructive' : undefined} />
    </div>
  );
}

// Aggregates disk usage across every configured Sonarr/Radarr's own /api/v3/diskspace plus
// SABnzbd's two download folders — one place to see "am I about to run out of room" instead of
// checking each service's own admin UI separately.
export function StorageWidget({ title }: { title: string }) {
  const { data: instances = [] } = useServices();
  const arrInstances = instances.filter((i) => (i.serviceId === 'sonarr' || i.serviceId === 'radarr') && i.enabled);
  const sabInstances = instances.filter((i) => i.serviceId === 'sabnzbd' && i.enabled);
  const definition = getServiceDefinition('sonarr');

  if (arrInstances.length === 0 && sabInstances.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
        >
          <HardDrive className="h-5 w-5" />
        </span>
        <p className="truncate text-sm font-semibold">{title}</p>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        {arrInstances.length > 0 && <DiskSpaceRows instances={arrInstances} />}
        {sabInstances.map((i) => <SabnzbdRows key={i.id} instance={i} />)}
        {arrInstances.length === 0 && sabInstances.length === 0 && <Skeleton className="h-4 w-full" />}
      </div>
    </div>
  );
}
