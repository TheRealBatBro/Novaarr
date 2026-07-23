import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WIDGET_CATALOG } from '@/lib/dashboardWidgets';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { getServiceIcon } from '@/lib/serviceIcons';
import { useDashboardWidgets, useSetDashboardWidgets, useServices } from '@/lib/queries';

export const Route = createFileRoute('/settings/dashboard')({ component: SettingsDashboard });

type Row = { key: string; enabled: boolean };

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
                        {sourceDef?.displayName ?? def.source}
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
    </div>
  );
}
