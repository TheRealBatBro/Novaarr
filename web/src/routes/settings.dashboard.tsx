import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { WIDGET_CATALOG, instanceWidgetCatalog, mergeNewWidgetsByCatalogPosition, parseWidgetKey, type WidgetDef } from '@/lib/dashboardWidgets';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { getServiceIcon } from '@/lib/serviceIcons';
import { useDashboardWidgets, useSetDashboardWidgets, useServices, useUpdateService, useAuthStatus } from '@/lib/queries';
import { useUiStore } from '@/stores/useUiStore';
import { cn } from '@/lib/utils';
import type { ServiceInstance } from '@/lib/api';

export const Route = createFileRoute('/settings/dashboard')({ component: SettingsDashboard });

type Row = { key: string; enabled: boolean };

// Live "now playing"/"now downloading" status cards (SABnzbd, Tautulli/Tracearr activity) need
// to stay fast and aren't part of this — only the catalog-style feeds (recently added, trending,
// rule violations) that are actually worth caching on a schedule. "Because you watched" gets its
// own dedicated row below instead of sharing Tautulli's — it needs a slower, distinctly-bounded
// schedule (each refresh fans out to several Overseerr TMDB calls) without also throttling the
// fast-moving Recently Watched widget, which shares the same underlying Tautulli instance.
const CONFIGURABLE_SOURCES = [
  ...new Set(WIDGET_CATALOG.filter((w) => w.kind !== 'status' && w.kind !== 'search' && w.key !== 'tautulli-recommendations').map((w) => w.source)),
];

// A slider drags much better across a short list of sensible stops than across every raw minute
// in the range — mirrors db.js's REFRESH_INTERVAL_LIMITS (5m-12h, Trakt 1h-24h) without landing
// on an odd value like "347 minutes".
const PRESET_STOPS: Record<string, number[]> = {
  trakt: [60, 120, 180, 240, 360, 480, 720, 1440],
  default: [5, 10, 15, 30, 60, 120, 240, 360, 480, 720, 1440],
};

function formatMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function closestStopIndex(stops: number[], minutes: number): number {
  return stops.reduce((best, v, i) => (Math.abs(v - minutes) < Math.abs(stops[best] - minutes) ? i : best), 0);
}

function RefreshIntervalRow({ source, instance }: { source: string; instance?: ServiceInstance }) {
  const qc = useQueryClient();
  const updateService = useUpdateService();
  const sourceDef = getServiceDefinition(source);
  const Icon = getServiceIcon(source);
  const stops = PRESET_STOPS[source] ?? PRESET_STOPS.default;
  const [index, setIndex] = useState(() => closestStopIndex(stops, instance?.refreshIntervalMinutes ?? stops[0]));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (instance) setIndex(closestStopIndex(stops, instance.refreshIntervalMinutes));
  }, [instance?.refreshIntervalMinutes, stops]);

  function commit(newIndex: number) {
    setIndex(newIndex);
    if (!instance) return;
    const minutes = stops[newIndex];
    if (minutes !== instance.refreshIntervalMinutes) {
      updateService.mutate(
        { id: instance.id, input: { refreshIntervalMinutes: minutes } },
        { onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save') },
      );
    }
  }

  const label = instance?.displayName ?? sourceDef?.displayName ?? source;

  // type: 'all' rather than the default 'active' — this page doesn't have the dashboard's own
  // carousels mounted, so without it a refresh here would just mark the cache stale and do
  // nothing visible until the next dashboard visit.
  async function refreshNow() {
    if (!instance) return;
    setRefreshing(true);
    try {
      await qc.refetchQueries({ queryKey: ['proxy', instance.id], type: 'all' });
      toast.success(`${label} refreshed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card className={!instance ? 'opacity-50' : undefined}>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${sourceDef?.brandColor ?? '#888'}22`, color: sourceDef?.brandColor ?? '#888' }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">{label}</p>
          <button
            type="button"
            onClick={refreshNow}
            disabled={!instance || refreshing}
            aria-label={`Refresh ${label} now`}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
            {instance ? `Every ${formatMinutes(stops[index])}` : 'Not configured'}
          </span>
        </div>
        <Slider
          disabled={!instance}
          min={0}
          max={stops.length - 1}
          step={1}
          value={[index]}
          onValueChange={([v]) => setIndex(v)}
          onValueCommit={([v]) => commit(v)}
          aria-label={`Refresh interval for ${label}`}
        />
      </CardContent>
    </Card>
  );
}

// Separate from RefreshIntervalRow because this schedule lives client-side (useUiStore), not on
// the Tautulli instance — sharing that field would also slow down the fast-moving Recently
// Watched widget, which reads the same instance.
function RecommendationRefreshRow({ available }: { available: boolean }) {
  const { plexRecommendationRefreshMinutes, setPlexRecommendationRefreshMinutes } = useUiStore();
  const stops = PRESET_STOPS.trakt; // same 60m-24h bounds this widget needs
  const [index, setIndex] = useState(() => closestStopIndex(stops, plexRecommendationRefreshMinutes));
  const sourceDef = getServiceDefinition('tautulli');
  const Icon = getServiceIcon('tautulli');

  useEffect(() => {
    setIndex(closestStopIndex(stops, plexRecommendationRefreshMinutes));
  }, [plexRecommendationRefreshMinutes, stops]);

  function commit(newIndex: number) {
    setIndex(newIndex);
    setPlexRecommendationRefreshMinutes(stops[newIndex]);
  }

  return (
    <Card className={!available ? 'opacity-50' : undefined}>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${sourceDef?.brandColor ?? '#888'}22`, color: sourceDef?.brandColor ?? '#888' }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">Because you watched</p>
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
            Every {formatMinutes(stops[index])}
          </span>
        </div>
        <Slider
          disabled={!available}
          min={0}
          max={stops.length - 1}
          step={1}
          value={[index]}
          onValueChange={([v]) => setIndex(v)}
          onValueCommit={([v]) => commit(v)}
          aria-label="Refresh interval for Because you watched"
        />
      </CardContent>
    </Card>
  );
}

function WidgetRow({
  row,
  def,
  available,
  instanceLabel,
  onToggle,
}: {
  row: Row;
  def: WidgetDef;
  available: boolean;
  instanceLabel: string;
  onToggle: () => void;
}) {
  const dragControls = useDragControls();
  const sourceDef = getServiceDefinition(def.source);
  const Icon = getServiceIcon(def.source);

  return (
    <Reorder.Item value={row} as="div" dragListener={false} dragControls={dragControls}>
      <Card className={!available ? 'opacity-50' : undefined}>
        <CardContent className="flex items-center gap-3 p-3">
          <button
            type="button"
            onPointerDown={(e) => dragControls.start(e)}
            aria-label={`Drag to reorder ${def.title}`}
            className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${sourceDef?.brandColor ?? '#888'}22`, color: sourceDef?.brandColor ?? '#888' }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{def.title}</p>
            <p className="truncate text-xs" style={{ color: sourceDef?.brandColor }}>
              {instanceLabel}
              {!available && ' · not configured'}
            </p>
          </div>
          <Switch checked={row.enabled} onCheckedChange={onToggle} disabled={!available} aria-label={`Toggle ${def.title}`} />
        </CardContent>
      </Card>
    </Reorder.Item>
  );
}

function SettingsDashboard() {
  const { data: instances = [] } = useServices();
  const { data: config, isLoading } = useDashboardWidgets();
  const { data: authStatus } = useAuthStatus();
  const setWidgets = useSetDashboardWidgets();
  const [rows, setRows] = useState<Row[] | null>(null);
  const widgetKeys = authStatus?.user?.widgetKeys;
  const fullCatalog = [...WIDGET_CATALOG, ...instanceWidgetCatalog(instances)].filter((w) => !widgetKeys || widgetKeys.includes(w.key));

  useEffect(() => {
    if (isLoading || rows) return;
    if (config && config.length > 0) {
      // Same reconciliation the dashboard page itself uses — otherwise a toggle or reorder here
      // re-saves whatever position this effect picked, and if that position was "brand new
      // widget appended at the very end," it cements it there permanently.
      const byEnabled = new Map(config.map((c) => [c.key, c.enabled]));
      const known = config.filter((c) => fullCatalog.some((w) => w.key === c.key)).map((c) => c.key);
      const newKeys = new Set(fullCatalog.filter((w) => !byEnabled.has(w.key)).map((w) => w.key));
      const mergedKeys = mergeNewWidgetsByCatalogPosition(known, fullCatalog, newKeys);
      setRows(mergedKeys.map((key) => ({ key, enabled: byEnabled.get(key) ?? true })));
    } else {
      setRows(fullCatalog.map((w) => ({ key: w.key, enabled: true })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, isLoading, rows]);

  const configuredSources = new Set(instances.filter((i) => i.enabled).map((i) => i.serviceId));
  const instanceBySource = new Map<string, ServiceInstance>();
  for (const i of instances) {
    if (!instanceBySource.has(i.serviceId)) instanceBySource.set(i.serviceId, i);
  }
  const instanceById = new Map(instances.map((i) => [i.id, i]));

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
          {/* A restricted-out row would otherwise still surface here via the WIDGET_CATALOG
              fallback below (meant for "instance removed", not "not permitted") — filtering the
              rows themselves, not just fullCatalog, keeps a curated role from ever revealing a
              widget's title/existence to someone it wasn't granted to. */}
          {(widgetKeys ? rows.filter((r) => widgetKeys.includes(r.key)) : rows).map((row) => {
            const { baseKey, instanceId } = parseWidgetKey(row.key);
            const def = fullCatalog.find((w) => w.key === row.key) ?? WIDGET_CATALOG.find((w) => w.key === baseKey);
            if (!def) return null;
            // An @instanceId-suffixed row targets that specific instance; a plain key targets
            // the first/default instance of the source, same as before multi-instance existed.
            const targetInstance = instanceId !== undefined ? instanceById.get(instanceId) : instanceBySource.get(def.source);
            const available = !!targetInstance?.enabled;
            return (
              <WidgetRow
                key={row.key}
                row={row}
                def={def}
                available={available}
                instanceLabel={targetInstance?.displayName ?? getServiceDefinition(def.source)?.displayName ?? def.source}
                onToggle={() => toggle(row.key)}
              />
            );
          })}
        </Reorder.Group>
      )}

      <Button variant="outline" className="mt-6" onClick={() => save(fullCatalog.map((w) => ({ key: w.key, enabled: true })))}>
        Reset to defaults
      </Button>

      <h2 className="mb-1 mt-8 text-lg font-bold tracking-tight">Refresh schedule</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        How often each service's dashboard data is refreshed in the background. Cached data shows instantly while a
        stale check quietly updates it — Trakt and Because you watched only go down to 1 hour since each refresh is a
        heavier shared/multi-call request; everything else can go as low as 5 minutes. Every schedule tops out at 24
        hours.
      </p>
      <div className="flex flex-col gap-2">
        {CONFIGURABLE_SOURCES.flatMap((source) => {
          const matching = instances.filter((i) => i.serviceId === source);
          // Zero configured instances: keep today's single disabled "not configured" placeholder
          // row; one row per instance once any exist, so a second instance gets its own slider.
          return matching.length > 0
            ? matching.map((instance) => <RefreshIntervalRow key={instance.id} source={source} instance={instance} />)
            : [<RefreshIntervalRow key={source} source={source} instance={undefined} />];
        })}
        <RecommendationRefreshRow available={configuredSources.has('tautulli') && configuredSources.has('overseerr')} />
      </div>
    </div>
  );
}
