import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WIDGET_CATALOG, REFRESH_INTERVAL_LIMITS } from '@/lib/dashboardWidgets';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { getServiceIcon } from '@/lib/serviceIcons';
import { useDashboardWidgets, useSetDashboardWidgets, useServices, useUpdateService } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

export const Route = createFileRoute('/settings/dashboard')({ component: SettingsDashboard });

type Row = { key: string; enabled: boolean };

// Live "now playing"/"now downloading" status cards (SABnzbd, Tautulli/Tracearr activity) need
// to stay fast and aren't part of this — only the catalog-style feeds (recently added, trending,
// rule violations) that are actually worth caching on a schedule.
const CONFIGURABLE_SOURCES = [...new Set(WIDGET_CATALOG.filter((w) => w.kind !== 'status' && w.kind !== 'search').map((w) => w.source))];

function formatMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function RefreshIntervalRow({ source, instance }: { source: string; instance?: ServiceInstance }) {
  const updateService = useUpdateService();
  const sourceDef = getServiceDefinition(source);
  const Icon = getServiceIcon(source);
  const limits = REFRESH_INTERVAL_LIMITS[source] ?? REFRESH_INTERVAL_LIMITS.default;
  const [value, setValue] = useState(instance?.refreshIntervalMinutes ?? limits.min);

  useEffect(() => {
    if (instance) setValue(instance.refreshIntervalMinutes);
  }, [instance?.refreshIntervalMinutes]);

  function commit() {
    if (!instance) return;
    const clamped = Math.min(limits.max, Math.max(limits.min, Math.round(value) || limits.min));
    setValue(clamped);
    if (clamped !== instance.refreshIntervalMinutes) {
      updateService.mutate(
        { id: instance.id, input: { refreshIntervalMinutes: clamped } },
        { onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save') },
      );
    }
  }

  return (
    <Card className={!instance ? 'opacity-50' : undefined}>
      <CardContent className="flex items-center gap-3 p-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${sourceDef?.brandColor ?? '#888'}22`, color: sourceDef?.brandColor ?? '#888' }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{instance?.displayName ?? sourceDef?.displayName ?? source}</p>
          <p className="truncate text-xs text-muted-foreground">
            {instance ? `Every ${formatMinutes(limits.min)}–${formatMinutes(limits.max)}` : 'Not configured'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            type="number"
            className="w-16 text-right"
            min={limits.min}
            max={limits.max}
            step={5}
            disabled={!instance}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            onBlur={commit}
            aria-label={`Refresh interval for ${instance?.displayName ?? sourceDef?.displayName ?? source}`}
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsDashboard() {
  const { data: instances = [] } = useServices();
  const { data: config, isLoading } = useDashboardWidgets();
  const setWidgets = useSetDashboardWidgets();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (isLoading || rows) return;
    if (config && config.length > 0) {
      const byKey = new Map(config.map((c) => [c.key, c.enabled]));
      const known = config.filter((c) => WIDGET_CATALOG.some((w) => w.key === c.key));
      const missing = WIDGET_CATALOG.filter((w) => !byKey.has(w.key)).map((w) => ({ key: w.key, enabled: true }));
      setRows([...known, ...missing]);
    } else {
      setRows(WIDGET_CATALOG.map((w) => ({ key: w.key, enabled: true })));
    }
  }, [config, isLoading, rows]);

  const configuredSources = new Set(instances.filter((i) => i.enabled).map((i) => i.serviceId));
  const instanceBySource = new Map(instances.map((i) => [i.serviceId, i]));

  async function save(next: Row[]) {
    setRows(next);
    try {
      await setWidgets.mutateAsync(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  function toggle(key: string) {
    if (!rows) return;
    save(rows.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)));
  }

  return (
    <div>
      <SettingsTabs active="dashboard" />
      <h1 className="text-2xl font-bold tracking-tight">Customize dashboard</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Choose which carousels appear on the Home dashboard and drag to reorder them. Widgets whose service isn’t configured are hidden automatically.
      </p>

      {rows && (
        <Reorder.Group axis="y" values={rows} onReorder={save} className="flex flex-col gap-2">
          {rows.map((row) => {
            const def = WIDGET_CATALOG.find((w) => w.key === row.key);
            if (!def) return null;
            const sourceDef = getServiceDefinition(def.source);
            const Icon = getServiceIcon(def.source);
            const available = configuredSources.has(def.source);
            return (
              <Reorder.Item key={row.key} value={row} as="div">
                <Card className={!available ? 'opacity-50' : undefined}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${sourceDef?.brandColor ?? '#888'}22`, color: sourceDef?.brandColor ?? '#888' }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{def.title}</p>
                      <p className="truncate text-xs" style={{ color: sourceDef?.brandColor }}>
                        {instanceBySource.get(def.source)?.displayName ?? sourceDef?.displayName ?? def.source}
                        {!available && ' · not configured'}
                      </p>
                    </div>
                    <Switch checked={row.enabled} onCheckedChange={() => toggle(row.key)} disabled={!available} aria-label={`Toggle ${def.title}`} />
                  </CardContent>
                </Card>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}

      <Button variant="outline" className="mt-6" onClick={() => save(WIDGET_CATALOG.map((w) => ({ key: w.key, enabled: true })))}>
        Reset to defaults
      </Button>

      <h2 className="mb-1 mt-8 text-lg font-bold tracking-tight">Refresh schedule</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        How often each service's dashboard data is refreshed in the background. Cached data shows instantly while a
        stale check quietly updates it — Trakt is limited to 1–24 hours since it's a shared cloud API; everything
        else can go as low as 5 minutes.
      </p>
      <div className="flex flex-col gap-2">
        {CONFIGURABLE_SOURCES.map((source) => (
          <RefreshIntervalRow key={source} source={source} instance={instanceBySource.get(source)} />
        ))}
      </div>
    </div>
  );
}
